/* One mission day: power, oxygen, water, food, radiation */
"use strict";
/* ============================================================
   SIMULATION — one day. Same function drives the forecast and the real turn.
   ============================================================ */
function clone(o){ return JSON.parse(JSON.stringify(o)); }

function simulate(s0){
  const s = clone(s0), P = PLANETS[s.pid], A = ACT[s.action] || ACT.rest;
  const eng = s.mode !== 'cadet';
  const info = {};
  if(A.parts) s.parts -= A.parts;
  switch(A.id){
    case 'panel': s.panels++; break;
    case 'battery': s.batCap += BAT_ADD; break;
    case 'greenhouse': s.gh++; break;
    case 'shield': s.shield = Math.min(4, s.shield+1); break;
    case 'repair': s.ghBroken = 0; s.recyclerBroken = false; s.leak = false; break;
    case 'clean': s.dust = 0; break;
    case 'reactor': s.reactor = true; break;
    case 'science': s.data += 1; break;
  }
  const dark = isDark(s, s.day);
  const sun = (dark ? P.darkFactor : 1) * (1 - s.dust);
  info.sun = sun; info.dark = dark;
  info.solar = s.panels * P.panel * sun;
  info.nuc = s.reactor ? 40 : 0;
  info.prod = info.solar + info.nuc;
  const ghOn = eng ? Math.max(0, s.gh - s.ghBroken) : 0;
  const dem = {
    o2: O2_SYS_KWH * s.lv.o2/100,
    water: (!eng || s.recyclerBroken) ? 0 : WATER_SYS_KWH * s.lv.water/100,
    heat: P.heat * s.lv.heat/100,
    farm: GH_KWH * ghOn * s.lv.farm/100,
    comm: COMM_KWH[s.pid] * s.lv.comm/100,
    task: A.energy || 0
  };
  info.dem = dem;
  info.demand = dem.o2 + dem.water + dem.heat + dem.farm + dem.comm + dem.task;
  const avail = info.prod + s.battery;
  let k = 1; info.blackout = false; info.wasted = 0;
  const bat0 = s.battery;
  if(info.demand > avail + 1e-9){ k = info.demand>0 ? avail/info.demand : 1; s.battery = 0; info.blackout = true; }
  else { s.battery = s.battery + info.prod - info.demand; if(s.battery > s.batCap){ info.wasted = s.battery - s.batCap; s.battery = s.batCap; } }
  info.k = k; info.batDelta = s.battery - bat0;
  const f = { o2: s.lv.o2/100*k, water: s.recyclerBroken?0:s.lv.water/100*k, heat: s.lv.heat/100*k, farm: s.lv.farm/100*k, comm: s.lv.comm/100*k };
  info.f = f;
  info.o2Made = O2_SYS_KG * f.o2; info.o2Plants = GH_O2 * ghOn * f.farm; info.o2Use = O2_PER*CREW;
  info.o2Leak = s.leak ? 1.5 : 0;
  s.o2 += info.o2Made + info.o2Plants - info.o2Use - info.o2Leak;
  info.vented = 0; if(s.o2 > O2_CAP){ info.vented = s.o2 - O2_CAP; s.o2 = O2_CAP; }
  const gross = WATER_GROSS*CREW;
  info.waterBack = RECOVERY * f.water * gross;
  info.waterElec = info.o2Made * O2_WATER_PER_KG;
  info.waterIce = A.id==='ice' ? 60 : 0;
  info.foodMade = GH_FOOD * ghOn * f.farm; info.foodUse = FOOD_PER*CREW;
  if(eng){
    s.water += -(gross - info.waterBack) - info.waterElec + info.waterIce;
    s.food += info.foodMade - info.foodUse;
  }
  info.sent = Math.min(s.data, f.comm);
  s.data -= info.sent; s.science += info.sent;
  if(s.data < 1e-6) s.data = 0;
  const sf = SHIELD[s.shield];
  info.doseBg = P.bgDose * sf; info.doseEva = A.eva ? P.eva : 0; info.doseFlare = flareDose(s, s.day);
  info.dose = info.doseBg + info.doseEva + info.doseFlare;
  s.dose += info.dose;
  let dh = 0; const causes = [];
  if(f.heat < 0.999){ dh -= Math.round((1-f.heat)*30); causes.push('cold'); }
  if(s.food < 0){ s.food = 0; dh -= 15; causes.push('hunger'); }
  if(s.water < 0){ s.water = 0; dh -= 25; causes.push('thirst'); }
  if(A.id==='rest') dh += 10;
  if(!causes.length) dh += 3;
  info.dh = dh; info.causes = causes;
  s.health = Math.max(0, Math.min(100, s.health + dh));
  if(s.o2 <= 0){ s.o2 = 0; s.over = 'o2'; }
  else if(s.dose >= DOSE_LIMIT){ s.over = 'dose'; }
  else if(s.health <= 0){ s.over = 'health'; s.lastCause = causes[0] || 'cold'; }
  return { s, info };
}

/* Real turn: simulate, then roll tomorrow's events. */
function endDay(){
  const before = clone(S);
  const { s, info } = simulate(S);
  const P = PLANETS[s.pid], dn = tr(P.dayName).toLowerCase();
  const rng = mulberry32(s.seed*1009 + s.day*97);
  const ev = [];
  const A = ACT[s.action];
  if(info.blackout) s.stats.blackouts++;
  if(info.causes.includes('cold')) s.stats.coldDays++;
  if(info.causes.includes('hunger')) s.stats.hungryDays++;
  if(A.eva) s.stats.evas++;
  if(['panel','battery','greenhouse','shield','reactor'].includes(A.id)) s.stats.builds++;
  if(A.id==='repair') s.stats.repairs++;
  s.stats.vented += info.vented; s.stats.wasted += info.wasted;

  if(isFlare(s, s.day)){
    const fl = flareOn(s, s.day);
    s.stats.flaresTaken.push({dose:+info.doseFlare.toFixed(1), cls:fl.cls, date:fl.date, s:fl.s});
    const storm = fl.s>0;
    ev.push({tone: info.doseFlare>30?'bad':storm?'warn':'good', real:fl,
      title: storm ? L(`Вспышка ${fl.cls} и протонная буря ${S_NAME(fl.s)}`,`Flare ${fl.cls} and an ${S_NAME(fl.s)} proton storm`) : L(`Вспышка ${fl.cls} без протонной бури`,`Flare ${fl.cls} with no proton storm`),
      text: storm ? L(`Экипаж укрылся в модуле. Доза от бури: ${fmt(info.doseFlare)} мЗв. Без реголита было бы ${fmt(flareDose(s,s.day,0))}. Слоёв реголита: ${s.shield}.`,`The crew sheltered in the habitat. Storm dose: ${fmt(info.doseFlare)} mSv. Without regolith it would be ${fmt(flareDose(s,s.day,0))}. Regolith layers: ${s.shield}.`)
                  : L('Вспышка была яркой, но протонов почти не пришло. Доза почти не выросла.','The flare was bright, but almost no protons arrived. The dose barely changed.'),
      why: storm ? (s.pid==='moon' ? L('Свет и рентген от вспышки долетают за 8 минут и почти безвредны внутри модуля. Опасны протоны, которые приходят потом. У Луны нет атмосферы и магнитного поля, поэтому базу засыпают грунтом.','Light and X-rays from a flare arrive in 8 minutes and are mostly harmless inside the habitat. The danger is the protons that follow. The Moon has no air and no magnetic field, so bases are buried under soil.')
                                     : L('Тонкая атмосфера Марса задерживает часть протонов, но глобального магнитного поля нет. Прибор RAD на Curiosity измеряет радиацию на поверхности Марса с 2012 года.','Mars’s thin air stops some protons, but the planet has no global magnetic field. The RAD instrument on Curiosity has measured surface radiation since 2012.'))
                 : L('Протонная буря случается только тогда, когда выброс с Солнца разгоняет частицы и они летят в нашу сторону. Поэтому учёные следят не только за вспышками, но и за потоком протонов.','A proton storm happens only when an eruption accelerates particles and they head our way. That is why scientists watch proton flux, not just flares.')});
  }
  if(info.blackout) ev.push({tone:'bad', title:L('Нехватка энергии','Power shortage'), text:L(`Батарея опустела, все системы работали только на ${Math.round(info.k*100)}% мощности.`,`The battery ran flat. Every system ran at only ${Math.round(info.k*100)}% power.`),
      why:L('На настоящей базе инженеры заранее решают, что отключать первым. Сначала жертвуют тем, что может подождать, а кислород и тепло берегут до последнего.','On a real base, engineers decide in advance what to switch off first. Things that can wait go first; oxygen and heat are protected to the end.')});
  if(info.causes.includes('cold')) ev.push({tone:'warn', title:L('В модуле холодно','The habitat is cold'), text:L('Обогреву не хватило энергии, экипаж мёрзнет и слабеет.','Heating did not get enough power. The crew is cold and getting weaker.'), why: s.pid==='moon' ? L('В тени на Луне бывает −170 °C и ниже. Тепло уходит в космос излучением, поэтому модуль надо всё время греть.','In shadow the Moon can drop below −170 °C. Heat radiates away into space, so the habitat must be heated all the time.') : L('Средняя температура на Марсе около −60 °C. Атмосфера слишком тонкая, чтобы держать тепло.','Mars averages about −60 °C. The air is too thin to hold heat.')});
  if(info.causes.includes('hunger')) ev.push({tone:'bad', title:L('Закончилась еда','Out of food'), text:L('Экипаж голодает: здоровье падает каждый день.','The crew is hungry: health drops every day.'), why:L('Астронавту нужно около 1,8 кг еды в день вместе с упаковкой. Для Марса еду придётся выращивать на месте.','An astronaut needs about 1.8 kg of food a day including packaging. On Mars, food will have to be grown locally.')});
  if(info.causes.includes('thirst')) ev.push({tone:'bad', title:L('Закончилась вода','Out of water'), text:L('Воды нет, экипажу очень плохо.','No water left. The crew is in a bad way.'), why:L('Вода нужна для питья, еды, гигиены и для получения кислорода. Поэтому на МКС перерабатывают почти всю воду, даже пот и мочу.','Water is needed for drinking, food, hygiene and making oxygen. That is why the ISS recycles nearly all its water, even sweat and urine.')});
  if(info.vented>0.05) ev.push({tone:'info', title:L('Баки кислорода полны','Oxygen tanks are full'), text:L(`Лишние ${fmt(info.vented)} кг O₂ не поместились. Можно убавить электролиз и сэкономить энергию.`,`${fmt(info.vented)} kg of extra O₂ did not fit. You could turn electrolysis down and save power.`)});
  if(info.wasted>1) ev.push({tone:'info', title:L('Батарея полна','Battery is full'), text:L(`${fmt(info.wasted,0)} кВт·ч энергии пропало зря. ${s.mode==='cadet'?'Можно было включить радио или построить аккумулятор.':'Можно было отдать их теплице или построить аккумулятор.'}`,`${fmt(info.wasted,0)} kWh went to waste. ${s.mode==='cadet'?'You could have used the radio or built a battery.':'You could have powered the greenhouse or built a battery.'}`)});
  if(info.sent>0.01) ev.push({tone:'good', title:L('Данные ушли на Землю','Data sent to Earth'), text:L(`Передано: ${fmt(info.sent)}. Всего на Земле: ${fmt(s.science)} из ${SCIENCE_GOAL}. Сигнал идёт ${delayText(s.pid)}.`,`Sent: ${fmt(info.sent)}. Total at Earth: ${fmt(s.science)} of ${SCIENCE_GOAL}. The signal takes ${delayText(s.pid)}.`)});
  if(A.id==='science') ev.push({tone:'good', title:L('Новые научные данные','New science data'), text: s.data>0.01 ? L(`Данные ждут отправки: ${fmt(s.data)}. Включи радиосвязь, иначе Земля их не получит.`,`Data waiting to be sent: ${fmt(s.data)}. Turn on the radio or Earth will never get it.`) : L('Данные сразу ушли на Землю по радио.','The data went straight to Earth by radio.'),
      why: s.pid==='moon' ? L('В кратерах у южного полюса Луны есть области вечной тени. Там миллиарды лет хранится водяной лёд.','Craters near the lunar south pole hold regions of permanent shadow, where water ice has been stored for billions of years.') : L('Марсоход Perseverance собирает образцы в кратере Езеро, где когда-то было озеро. В них ищут следы древней жизни.','The Perseverance rover collects samples in Jezero crater, once a lake. Scientists search them for signs of ancient life.')});
  if(A.id==='reactor') ev.push({tone:'good', title:L('Реактор запущен','Reactor online'), text:L('Теперь база получает 40 кВт·ч в день при любой погоде.','The base now gets 40 kWh a day in any weather.'), why:L('NASA разрабатывает проект Fission Surface Power: небольшой ядерный реактор около 40 кВт для Луны. Ему не нужно Солнце.','NASA’s Fission Surface Power project is a small ~40 kW nuclear reactor for the Moon. It does not need sunlight.')});
  if(A.id==='shield') ev.push({tone:'good', title:L(`Слой реголита №${s.shield}`,`Regolith layer #${s.shield}`), text:L(`Теперь радиация внутри модуля в ${fmt(1/SHIELD[s.shield],1)} раза слабее, чем без защиты.`,`Radiation inside is now ${fmt(1/SHIELD[s.shield],1)} times weaker than with no shielding.`), why:L('Использовать местные материалы выгоднее, чем везти всё с Земли: запуск каждого килограмма стоит тысячи долларов.','Using local materials beats shipping everything from Earth: launching each kilogram costs thousands of dollars.')});
  if(A.id==='clean') ev.push({tone:'good', title:L('Панели чистые','Panels clean'), text:L('Выработка солнечной энергии восстановлена.','Solar output is back to full.')});
  if(A.id==='ice') ev.push({tone:'good', title:L('Лёд добыт','Ice mined'), text:L('+60 л воды. Из неё можно получить и кислород.','+60 L of water, which can also become oxygen.'), why: s.pid==='moon' ? L('Прибор NASA M3 на индийском аппарате Chandrayaan-1 подтвердил водяной лёд в затенённых кратерах у полюсов Луны.','NASA’s M3 instrument on India’s Chandrayaan-1 confirmed water ice in shadowed craters near the lunar poles.') : L('Аппарат MRO увидел под равниной Утопия слой льда: по объёму почти как озеро Верхнее.','The MRO orbiter found ice under Utopia Planitia holding about as much water as Lake Superior.')});
  if(P.cargo.includes(s.day)){
    s.food += 25; s.water += 40; s.parts += 4;
    ev.push({tone:'good', title:L('Прилетел грузовой корабль','A cargo ship arrived'), text: s.mode==='cadet' ? L('+4 запчасти.','+4 spare parts.') : L('+25 кг еды, +40 л воды, +4 запчасти.','+25 kg food, +40 L water, +4 spare parts.'), why:L('До Луны лететь около 3 дней, поэтому базу можно снабжать с Земли. До Марса 6–9 месяцев, а окно старта открывается раз в 26 месяцев.','The Moon is about 3 days away, so Earth can resupply it. Mars is 6–9 months away, with a launch window every 26 months.')});
  }

  const t = s.day + 1;
  if(!s.over && t <= P.days){
    if(s.day >= 3){
      const r = rng();
      if(r < P.meteor){
        s.o2 = Math.max(0.1, s.o2 - 5); s.leak = true;
        const ghHit = s.mode!=='cadet' && s.gh - s.ghBroken > 0; if(ghHit) s.ghBroken++;
        ev.push({tone:'bad', title:L('Удар микрометеорита','Micrometeoroid strike'), text:L(`Утекло 5 кг кислорода, и через пробоину уходит ещё 1,5 кг в день.${ghHit?' Теплица тоже пробита.':''} Нужен ремонт.`,`5 kg of oxygen escaped and 1.5 kg more leaks out every day.${ghHit?' A greenhouse was hit too.':''} Repair needed.`), why:L('У Луны нет атмосферы, в которой сгорают мелкие метеориты. Песчинка летит быстрее пули, поэтому модули закрывают многослойным щитом Уиппла, как на МКС.','The Moon has no air to burn up tiny meteoroids. A grain of sand flies faster than a bullet, so modules use layered Whipple shields, like the ISS.')});
      } else if(s.mode!=='cadet' && r < P.meteor + P.fail && !s.recyclerBroken){
        s.recyclerBroken = true;
        ev.push({tone:'bad', title:L('Сломалась очистка воды','Water recycler broke'), text:L('Пока её не починят, вода не возвращается в оборот и запас тает в разы быстрее.','Until it is fixed, no water is recovered and the supply drains many times faster.'), why:L('Система на МКС возвращает около 98% воды. Без неё запас тает очень быстро, поэтому на борту держат запчасти.','The ISS system recovers about 98% of water. Without it supplies vanish fast, so spare parts are kept on board.')});
      } else if(s.pid==='mars' && s.dust>0.08 && r > 0.88){
        s.dust = 0;
        ev.push({tone:'good', title:L('Ветер очистил панели','Wind cleaned the panels'), text:L('Порыв ветра сдул пыль, панели снова работают на полную.','A gust blew the dust away; panels are back to full power.'), why:L('Марсоходы Spirit и Opportunity не раз «оживали», когда ветер сдувал пыль с их панелей.','The Spirit and Opportunity rovers were revived more than once when wind blew dust off their panels.')});
      }
    }
    if(s.pid==='mars') s.dust = Math.min(0.45, s.dust + P.dustRate*(isDark(s,t)?2:1));
    if(isFlare(s,t)){
      const fl = flareOn(s,t);
      ev.push({tone:'warn', real:fl, title:L(`Завтра: солнечная вспышка`,`Tomorrow: a solar flare`), text:L(`Обсерватории видят опасную группу пятен. Вспышка ожидается в ${dn} ${t}. Возможная доза при нынешней защите: до ${fmt(flareDose(s,t))} мЗв. С ещё одним слоем реголита: ${fmt(flareDose(s,t,Math.min(4,s.shield+1)))}.`,`Observatories see a dangerous sunspot group. A flare is expected on ${dn} ${t}. Possible dose with current shielding: up to ${fmt(flareDose(s,t))} mSv. With one more regolith layer: ${fmt(flareDose(s,t,Math.min(4,s.shield+1)))}.`),
        why:L('За Солнцем следят обсерватории SDO и SOHO. Свет вспышки долетает за 8 минут, а протонам нужно от получаса до нескольких часов. Этого хватает, чтобы укрыться.','Observatories such as SDO and SOHO watch the Sun. Flare light arrives in 8 minutes; protons take from half an hour to several hours. That is enough time to take shelter.')});
    }
    if(isDark(s,t) && !isDark(s,s.day)){
      const i = s.sched.dark.indexOf(t); const len = i>=0 ? darkLenAt(s,i) : P.darkLen;
      ev.push({tone:'warn', title: L(`Завтра: ${tr(P.darkName).toLowerCase()} на ${len} ${plural(len,'день','дня','дней')}`,`Tomorrow: ${tr(P.darkName).toLowerCase()} for ${len} ${s.pid==='mars'?'sols':'days'}`), text:L(`Панели дадут только ${Math.round(P.darkFactor*100)}% энергии. Запаси энергию в батарее или реши, что отключить.`,`Panels will give only ${Math.round(P.darkFactor*100)}% power. Fill the battery or decide what to switch off.`),
        why: s.pid==='moon' ? L('На южном полюсе Солнце висит низко, и тени от гор тянутся на километры. Базу ставят на гребни с почти постоянным светом, но и там бывают дни в тени.','At the south pole the Sun hangs low and mountain shadows stretch for kilometres. Bases sit on ridges with near-constant light, but even there some days are shadowed.') : L('Марсианские бури закрывают Солнце на дни и даже месяцы. В 2018 году буря оставила марсоход Opportunity без энергии, и он больше не вышел на связь.','Martian storms can block the Sun for days or months. In 2018 a storm cut off power to the Opportunity rover and it never called home again.')});
    }
  }

  const flT = isFlare(s, s.day) ? flareOn(s, s.day) : null;
  s.history.push({ day:s.day, o2:s.o2, water:s.water, food:s.food, battery:s.battery, batCap:s.batCap, health:s.health, dose:s.dose,
    act:A.id, lv:{...before.lv}, dDose:+(s.dose-before.dose).toFixed(1), dSci:+(s.science-before.science).toFixed(2), blackout:!!info.blackout, dark:!!info.dark, flare: flT ? {cls:flT.cls, s:flT.s} : null, bad: ev.filter(e=>e.tone==='bad').length });
  const reportDay = s.day;
  if(!s.over){ if(s.day >= P.days) s.over = 'win'; else s.day++; }
  const blk = actionBlock(s, ACT[s.action]); if(blk) s.action = 'rest';
  S = s;
  const box = document.getElementById('sceneBox');
  if(G3 && !reduceMotion && box){
    BUSY = true; document.body.classList.add('busy');
    const r = box.getBoundingClientRect(); if(r.top < 0 || r.bottom > innerHeight) box.scrollIntoView({block:'center', behavior:'smooth'});
    const cap = `<b>${tr(P.dayName)} ${reportDay}</b> ${esc(val(A.name, before))}`;
    G3.play(before, s, A.id, ev, cap).then(()=>{ BUSY = false; document.body.classList.remove('busy'); render(); showReport(before, s, info, ev, reportDay); });
  } else { render(); showReport(before, s, info, ev, reportDay); }
}
let BUSY = false;
