/* Windows: start menu, day report, final, science for judges */
"use strict";
/* ============================================================
   MODALS
   ============================================================ */
let reopen = null; // re-renders the open modal after a language switch
function openModal(html, label, again, cls){
  reopen = again || null; if(G3 && G3.unlock) G3.unlock();
  modalRoot.innerHTML = `<div class="modal${cls?' '+cls:''}" role="dialog" aria-modal="true" aria-label="${esc(label)}"><div class="dlg">${html}</div></div>`;
  const first = modalRoot.querySelector('[data-focus]') || modalRoot.querySelector('button');
  if(first) setTimeout(()=>first.focus({preventScroll:true}), 30);
}
function closeModal(){ modalRoot.innerHTML=''; reopen = null; const b = app.querySelector('[data-cmd="end"]'); if(b) b.focus({preventScroll:true}); renderTutorial(); }

const SNAP = {};
function planetPreview(pid){ return G3 ? `<img data-preview3d="${pid}" alt="" ${SNAP[pid]?`src="${SNAP[pid]}"`:''}>` : `<canvas data-preview="${pid}" aria-hidden="true"></canvas>`; }
function paintPreviews(){
  if(G3 && !G3.ready){ G3.onReady(paintPreviews); return; }
  if(G3){ modalRoot.querySelectorAll('img[data-preview3d]').forEach(im=>{ const pid = im.dataset.preview3d; if(!SNAP[pid]){ try{ SNAP[pid] = G3.snapshot(pid, 640, 300); }catch(e){} } if(SNAP[pid]) im.src = SNAP[pid]; }); return; }
  modalRoot.querySelectorAll('canvas[data-preview]').forEach(cv=>{
    const pid = cv.dataset.preview; const dpr = Math.min(2, window.devicePixelRatio||1);
    const w = cv.clientWidth, h = cv.clientHeight; if(!w||!h) return; cv.width = w*dpr; cv.height = h*dpr;
    const c = cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
    const fake = newState(pid, 1234, 'engineer'); fake.sched = {dark:[99], darkLens:[1], flares:[99], ev:[SOLAR[0],SOLAR[1]]};
    paintBase(c, w, h, fake, 0);
  });
}

let chosenMode = 'cadet';
let useLive = false;
function liveBoxHTML(){
  if(liveState==='idle') return `<button class="btn" type="button" data-cmd="live-check">${L('Проверить космическую погоду сегодня (NASA DONKI)','Check today’s space weather (NASA DONKI)')}</button>`;
  if(liveState==='loading') return `<span>${L('Связываемся с NASA DONKI…','Contacting NASA DONKI…')}</span>`;
  if(liveState==='fail') return `<span>${L('Онлайн-данные сейчас недоступны. Миссия использует архив настоящих событий, это честно указано в игре.','Live data is not reachable right now. The mission uses the archive of real past events, and the game says so.')}</span>`;
  // ok
  const f = LIVE;
  const sum = liveSummary ? `<span>${liveSummary}</span>` : '';
  if(!f) return `${sum}<span>${L('Сильных вспышек за 30 дней не было: Солнце спокойно. Миссия возьмёт события из архива.','No strong flares in the last 30 days: the Sun is calm. The mission will use archived events.')}</span>`;
  return `${sum}<label class="chk"><input type="checkbox" id="useLive" ${useLive?'checked':''}> ${L(`Добавить в миссию настоящую вспышку ${esc(f.cls)} от ${solarDate(f.date)}`,`Add the real ${esc(f.cls)} flare from ${solarDate(f.date)} to the mission`)}</label>`;
}
let ST_VIEW = 'new';
function showStart(view){
  if(view) ST_VIEW = view;
  const canGo = !!(S && !S.over);
  const nav = [
    ['new', L('Новая миссия','New mission'), 'rocket'],
    ...(canGo ? [['continue', L('Продолжить','Continue'), 'play']] : []),
    ['code', L('Код миссии','Mission code'), 'key'],
    ['weather', L('Космическая погода','Space weather'), 'sun'],
    ['gloss', L('Словарик','Glossary'), 'book'],
    ['science', L('Данные NASA','NASA data'), 'flask'],
  ];
  const item = ([id, label]) => `<li><button type="button" class="nv${ST_VIEW===id?' on':''}" ${id==='continue'?'data-cmd="close"':id==='science'?'data-cmd="science"':`data-stview="${id}"`} ${ST_VIEW===id?'aria-current="true"':''}>${label}<i aria-hidden="true">→</i></button></li>`;
  let panel = '';
  if(ST_VIEW==='code') panel = `<h2>${L('Код миссии','Mission code')}</h2><p class="pd">${L('Учитель может дать код, чтобы весь класс играл одну и ту же миссию.','A teacher can share a code so the whole class plays the same mission.')}</p>
      <form class="codebox" id="codeForm"><label for="mcode" class="sr">${L('Код миссии','Mission code')}</label><input id="mcode" name="mcode" placeholder="M-1234" autocomplete="off" maxlength="7" data-focus><button class="btn primary" type="submit">${L('Начать','Start')}</button><span id="codeErr" role="alert"></span></form>`;
  else if(ST_VIEW==='weather') panel = `<h2>${L('Космическая погода','Space weather')}</h2><p class="pd">${L('Вспышки и протонные бури за последние 30 дней из базы NASA DONKI. Если связи нет, игра честно использует архив.','Flares and proton storms from the last 30 days, from NASA DONKI. Without a connection the game honestly uses the archive.')}</p><div class="live" id="liveStart">${liveBoxHTML()}</div>`;
  else if(ST_VIEW==='gloss') panel = `<h2>${L('Словарик','Glossary')}</h2><dl class="gl">
        <dt>${L('Сол','Sol')}</dt><dd>${L('Марсианские сутки. Они длиннее земных на 40 минут.','A Martian day. It is 40 minutes longer than an Earth day.')}</dd>
        <dt>${L('кВт·ч (киловатт-час)','kWh (kilowatt-hour)')}</dt><dd>${L('Количество энергии. Чайник тратит примерно 0,1 кВт·ч, чтобы вскипятить воду.','An amount of energy. A kettle uses about 0.1 kWh to boil water.')}</dd>
        <dt>${L('Электролиз','Electrolysis')}</dt><dd>${L('Электрический ток разделяет воду на водород и кислород. Так получают воздух для дыхания.','Electric current splits water into hydrogen and oxygen. That is how breathing air is made.')}</dd>
        <dt>${L('Реголит','Regolith')}</dt><dd>${L('Пыль и камешки на поверхности Луны и Марса. Из них можно насыпать защиту над домом.','Dust and pebbles on the Moon and Mars. You can pile it over a habitat as a shield.')}</dd>
        <dt>${L('мЗв (миллизиверт)','mSv (millisievert)')}</dt><dd>${L('Мера дозы радиации. Рентген зуба даёт около 0,005 мЗв, а день на Луне около 1,4 мЗв.','A measure of radiation dose. A dental X-ray is about 0.005 mSv; a day on the Moon is about 1.4 mSv.')}</dd>
        <dt>${L('Солнечная вспышка','Solar flare')}</dt><dd>${L('Яркий взрыв на Солнце. Класс X самый сильный по свету и рентгену.','A bright explosion on the Sun. Class X is the brightest in light and X-rays.')}</dd>
        <dt>${L('Протонная буря (шкала S1–S5)','Proton storm (S1–S5 scale)')}</dt><dd>${L('Поток быстрых протонов после выброса с Солнца. Именно он опасен для астронавтов. NOAA оценивает бури от S1 (слабая) до S5 (экстремальная).','A flood of fast protons after a solar eruption. This is what is dangerous to astronauts. NOAA rates storms from S1 (minor) to S5 (extreme).')}</dd>
        <dt>${L('Задержка связи','Signal delay')}</dt><dd>${L('Радиосигнал летит со скоростью света. До Луны чуть больше секунды, до Марса от 3 до 22 минут.','Radio travels at the speed of light: just over a second to the Moon, 3 to 22 minutes to Mars.')}</dd>
      </dl>`;
  else panel = `<h2>${L('Новая миссия','New mission')}</h2>
      <div class="seg" role="group" aria-label="${L('Уровень сложности','Difficulty')}">
        <button type="button" class="mode" data-mode="cadet" aria-pressed="${chosenMode==='cadet'}"><b>${L('Кадет','Cadet')}</b><span>${L('7–9 лет · энергия, O₂, радиация','ages 7–9 · power, O₂, radiation')}</span></button>
        <button type="button" class="mode" data-mode="engineer" aria-pressed="${chosenMode==='engineer'}"><b>${L('Инженер','Engineer')}</b><span>${L('10–12 лет · + вода, еда, теплицы','ages 10–12 · + water, food, farms')}</span></button>
      </div>
      <div class="st-go">
        <button class="pcard" type="button" data-start="moon" style="--pc:${PLANETS.moon.accent}" data-focus>${planetPreview('moon')}<div class="pb">
          <span class="pn">${L('Луна','Moon')}</span><span class="pf">${L('Кратер Шеклтон · сигнал 1,3 с','Shackleton crater · 1.3 s signal')}</span><span class="go" aria-hidden="true">→</span></div></button>
        <button class="pcard" type="button" data-start="mars" style="--pc:${PLANETS.mars.accent}">${planetPreview('mars')}<div class="pb">
          <span class="pn">${L('Марс','Mars')}</span><span class="pf">${L(`Равнина Утопия · сигнал ${delayText('mars')}`,`Utopia Planitia · ${delayText('mars')} signal`)}</span><span class="go" aria-hidden="true">→</span></div></button>
      </div>`;
  openModal(`<div class="st st2 st3">
    <header class="st-top"><div class="st-brand"><i class="st-dot" aria-hidden="true"></i><b>${L('Юный астронавт','Junior Astronaut')}</b><span>${L('База','Outpost')}</span></div>${langBtn()}</header>
    <div class="st-main">
      <section class="st-hero">
        <span class="eyebrow">NASA Space Apps · ${L('для детей 7–12 лет','for kids aged 7–12')}</span>
        <h1>${L('Построй базу и продержись <em>20&nbsp;дней</em>','Build a base and survive <em>20&nbsp;days</em>')}</h1>
        <nav aria-label="${L('Главное меню','Main menu')}"><ul class="nav">${nav.map(item).join('')}</ul></nav>
      </section>
      <section class="st-panel" aria-live="polite">${panel}</section>
    </div>
  </div>`, L('Главное меню','Main menu'), showStart, 'start');
  requestAnimationFrame(paintPreviews); SKY.wake && SKY.wake();
}

function realFlareHTML(f){
  const storm = f.s>0;
  return `<div class="real"><span class="rk">${f.live?L('Настоящая вспышка · онлайн','Real flare · live'):L('Настоящее событие · архив','Real event · archive')}</span><span class="rv">${esc(f.cls)} · ${esc(S_NAME(f.s))}</span><span>${solarDate(f.date)}${f.ar?` · ${L('группа пятен','sunspot region')} ${esc(f.ar)}`:''}${storm&&f.pfu&&f.pfu!=='—'?` · ${L('пик потока протонов','peak proton flux')} ${esc(f.pfu)} pfu`:''}</span><span class="rn">${esc(tr(f.note))}</span><span class="rs">${L('Данные','Data')}: ${esc(f.src)}${f.live?L(', получено сейчас',', fetched now'):L(', архив',', archive')}</span></div>`;
}
function showReport(b, s, info, ev, day){
  const P = PLANETS[s.pid];
  const d = (k, label, unit, digits=1, inv=false) => {
    const v = s[k]-b[k]; const cls = Math.abs(v)<0.05 ? '' : ((v>0)!==inv ? 'up' : (k==='o2'||k==='water'||k==='food') && s[k]<10 ? 'crit' : 'down');
    return `<div class="dl"><span class="k">${label}</span><span class="v ${cls}">${sgn(v,digits)} ${unit}</span><span class="k">${L('теперь','now')} ${fmt(s[k],digits)}</span></div>`;
  };
  const evHTML = ev.map(e=>`<div class="ev ${e.tone}"><div class="et"><span class="dot"></span>${esc(e.title)}</div><p>${esc(e.text)}</p>${e.real?realFlareHTML(e.real):''}${e.why?`<div class="why"><b>${L('Почему так?','Why?')}</b>${esc(e.why)}</div>`:''}</div>`).join('');
  const eng = s.mode !== 'cadet';
  const finished = !!s.over;
  const dn = tr(P.dayName);
  openModal(`
    <div class="eyebrow">${s.pid==='mars'?L('Бортовой журнал','Ship’s log'):L('Отчёт ЦУП','Mission Control report')} · ${dn} ${day}</div>
    <h2>${ev.some(e=>e.tone==='bad') ? L('Непростой день','A tough day') : L('День завершён','Day complete')}</h2>
    <div class="deltas">
      ${d('o2',L('Кислород','Oxygen'),U.kg())}${eng?d('water',L('Вода','Water'),U.l(),0)+d('food',L('Еда','Food'),U.kg()):''}${d('battery',L('Батарея','Battery'),U.kwh(),0)}${d('health',L('Здоровье','Health'),'%',0)}${d('dose',L('Доза','Dose'),U.msv(),1,true)}${d('science',L('Наука на Земле','Science at Earth'),'')}
    </div>
    <p class="lead">${L(`Выработано ${fmt(info.prod,0)} кВт·ч, потрачено ${fmt(Math.min(info.demand, info.prod+b.battery),0)}. Электролиз дал ${fmt(info.o2Made)} кг O₂${eng?`, растения ${fmt(info.o2Plants)}`:''}, экипаж вдохнул ${fmt(info.o2Use)}${info.o2Leak?`, утекло ${fmt(info.o2Leak)}`:''}.${eng?` Очистка вернула ${fmt(info.waterBack,0)} л воды из ${WATER_GROSS*CREW}.`:''}`,
      `Produced ${fmt(info.prod,0)} kWh, used ${fmt(Math.min(info.demand, info.prod+b.battery),0)}. Electrolysis made ${fmt(info.o2Made)} kg of O₂${eng?`, plants ${fmt(info.o2Plants)}`:''}; the crew breathed ${fmt(info.o2Use)}${info.o2Leak?`, ${fmt(info.o2Leak)} leaked`:''}.${eng?` The recycler returned ${fmt(info.waterBack,0)} L of water out of ${WATER_GROSS*CREW}.`:''}`)}</p>
    <div class="rep">${evHTML}</div>
    <div class="row-btns"><button class="btn primary big" type="button" data-cmd="${finished?'final':'close'}" data-focus>${finished ? L('Итоги миссии →','Mission results →') : L(`Начать ${dn.toLowerCase()} ${s.day} →`,`Start ${dn.toLowerCase()} ${s.day} →`)}</button></div>`, L('Отчёт за день','Daily report'), ()=>showReport(b, s, info, ev, day));
}

function showFinal(){
  const s = S, P = PLANETS[s.pid];
  const win = s.over==='win';
  const dn = tr(P.dayName).toLowerCase();
  const nd = n => L(`${n} ${plural(n,'день','дня','дней')}`, `${n} ${n===1?'day':'days'}`);
  let stars = 0; if(win){ stars = 1; if(s.science>=3) stars = 2; if(s.science>=SCIENCE_GOAL && s.health>=50) stars = 3; }
  const starSVG = k => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.1l-5.9 3.2 1.3-6.5L2.5 9.3l6.6-.8z" fill="${k<stars?'var(--power)':'var(--line2)'}"/></svg>`;
  const nf = s.stats.flaresTaken.length;
  const R = {
    win:{ t:L('Миссия выполнена!','Mission complete!'), p:L(`Экипаж продержался все ${nd(P.days)} и вернётся домой. ${stars===3?'Идеальная работа: наука сделана, экипаж в форме.':stars===2?`Неплохо! Для трёх звёзд нужно ${SCIENCE_GOAL} научных результатов и здоровье не ниже 50%.`:'Выжить уже успех. Попробуй найти время и для науки.'}`,
        `The crew lasted all ${nd(P.days)} and is coming home. ${stars===3?'Perfect work: the science is done and the crew is healthy.':stars===2?`Nice! For three stars you need ${SCIENCE_GOAL} science results and health of at least 50%.`:'Surviving is already a success. Try to make time for science too.'}`),
        why:L('Настоящие миссии планируют с запасом: системы дублируют, расходники берут с избытком, а ЦУП каждый день сверяет прогноз с реальностью. Именно так ты и играл.','Real missions are planned with margins: systems are doubled, supplies are packed with extra, and Mission Control checks the forecast against reality every day. That is exactly how you played.') },
    o2:{ t:L('Миссия прервана: кончился кислород','Mission aborted: out of oxygen'), p:L(`На ${dn} ${s.day} баки кислорода опустели. Экипаж надел скафандры и эвакуировался.`,`On ${dn} ${s.day} the oxygen tanks ran empty. The crew suited up and evacuated.`),
        why:L('Кислород на базе получают электролизом воды, а он требует много энергии и воды. Если энергии не хватает, кислорода тоже не будет. Поэтому на МКС есть запасные баллоны и кислородные «свечи»: химические генераторы на случай аварии.','Oxygen on a base comes from splitting water, which needs lots of power and water. No power means no oxygen. That is why the ISS carries spare tanks and oxygen “candles”, chemical generators for emergencies.') },
    dose:{ t:L('Миссия прервана: превышен лимит радиации','Mission aborted: radiation limit exceeded'), p:L(`Экипаж набрал ${fmt(s.dose)} мЗв, это выше лимита миссии ${DOSE_LIMIT} мЗв. Врачи ЦУП отправили всех домой.`,`The crew received ${fmt(s.dose)} mSv, above the mission limit of ${DOSE_LIMIT} mSv. Flight surgeons sent everyone home.`),
        why:L(`Вне магнитного поля Земли главная угроза — радиация: галактические лучи и протонные бури. NASA ограничивает дозу астронавта за всю карьеру 600 мЗв. Лучшая защита — масса над головой: грунт, вода, полиэтилен. Ты встретил ${nf} ${plural(nf,'солнечное событие','солнечных события','солнечных событий')} при защите ${s.shield} ${plural(s.shield,'слой','слоя','слоёв')}.`,
              `Outside Earth’s magnetic field, radiation is the main threat: cosmic rays and proton storms. NASA limits an astronaut’s whole-career dose to 600 mSv. The best protection is mass overhead: soil, water, plastic. You faced ${nf} solar ${nf===1?'event':'events'} with ${s.shield} shielding ${s.shield===1?'layer':'layers'}.`) },
    health:{ t:L('Миссия прервана: экипаж выбился из сил','Mission aborted: the crew is exhausted'), p:L(`На ${dn} ${s.day} здоровье экипажа упало до нуля. Миссию досрочно завершили.`,`On ${dn} ${s.day} crew health fell to zero. The mission ended early.`),
        why:({cold:L('Главная причина — холод. Тепло в космосе быстро уходит излучением, и без энергии модуль остывает за часы. Обогрев — одна из самых важных систем базы.','The main cause was cold. Heat radiates away fast in space, and without power a habitat cools in hours. Heating is one of the base’s most vital systems.'),
              hunger:L('Главная причина — голод. На долгой миссии еду нужно выращивать: теплицы дорого обходятся по энергии, но без них не прокормиться.','The main cause was hunger. On a long mission food must be grown: greenhouses cost a lot of power, but you cannot eat without them.'),
              thirst:L('Главная причина — нехватка воды. Без переработки воды запасы тают очень быстро. На МКС система регенерации возвращает в оборот почти всю воду.','The main cause was lack of water. Without recycling, supplies vanish fast. On the ISS the recycler returns almost all the water.')})[s.lastCause||'cold'] },
  }[s.over];
  const lessons = [];
  if(s.stats.blackouts) lessons.push(L(`Было ${nd(s.stats.blackouts)} с нехваткой энергии. Аккумуляторы и реактор дают запас на тень и бурю.`,`There ${s.stats.blackouts===1?'was':'were'} ${nd(s.stats.blackouts)} without enough power. Batteries and a reactor give a reserve for shadow and storms.`));
  if(nf){
    const list = s.stats.flaresTaken.map(x=>L(`${x.cls} от ${solarDate(x.date)} (${S_NAME(x.s)}, ${fmt(x.dose)} мЗв)`,`${x.cls} from ${solarDate(x.date)} (${S_NAME(x.s)}, ${fmt(x.dose)} mSv)`)).join(L(' и ',' and '));
    lessons.push(L(`Ты пережил настоящие солнечные события: ${list}. Опасна протонная буря, а не яркость вспышки. Каждый слой реголита заметно снижает дозу.`,`You lived through real solar events: ${list}. The proton storm is the danger, not how bright the flare is. Each regolith layer cuts the dose a lot.`));
  }
  if(s.stats.coldDays) lessons.push(L(`${nd(s.stats.coldDays)} экипаж мёрз. Обогрев нельзя выключать надолго.`,`The crew was cold for ${nd(s.stats.coldDays)}. Heating can’t be off for long.`));
  if(s.stats.wasted > 30) lessons.push(L(`${fmt(s.stats.wasted,0)} кВт·ч пропало, потому что батарея была полна. Лишнюю энергию лучше во что-то вложить.`,`${fmt(s.stats.wasted,0)} kWh was lost because the battery was full. Spare power is better put to use.`));
  if(s.stats.vented > 5) lessons.push(L(`${fmt(s.stats.vented)} кг кислорода не поместились в баки. Электролиз можно было убавить.`,`${fmt(s.stats.vented)} kg of oxygen did not fit in the tanks. Electrolysis could have been turned down.`));
  if(s.pid==='mars') lessons.push(L('На Марс нельзя быстро прислать помощь, поэтому марсианская база должна сама производить почти всё.','Help can’t reach Mars quickly, so a Mars base must make almost everything itself.'));
  else lessons.push(L('Луна близко: грузы с Земли выручают. Это одна из причин, почему NASA сначала возвращается на Луну по программе «Артемида», а потом летит к Марсу.','The Moon is close, so cargo from Earth can help. That is one reason NASA returns to the Moon with Artemis before going on to Mars.'));
  lessons.push(L('Каждая система тратит энергию. Инженеры всё время ищут баланс между безопасностью экипажа, наукой и запасом на случай аварий.','Every system uses power. Engineers constantly balance crew safety, science and a reserve for emergencies.'));
  const code = `${s.pid==='moon'?'L':'M'}-${s.seed}`;
  openModal(`
    <div class="toprow"><div class="eyebrow">${tr(P.base)} · ${L('итоги','results')}</div>${langBtn()}</div>
    <h2>${R.t}</h2>
    ${win?`<div class="stars" aria-label="${L(`${stars} из 3 звёзд`,`${stars} of 3 stars`)}">${[0,1,2].map(starSVG).join('')}</div>`:''}
    <p>${R.p}</p>
    <div class="why"><b>${L('Как это в реальной жизни','How it works in real life')}</b>${esc(R.why)}</div>
    <div class="endstats">
      <div class="dl"><span class="k">${L('Дней на базе','Days at base')}</span><span class="v">${s.over==='win'?P.days:s.day}</span></div>
      <div class="dl"><span class="k">${L('Наука','Science')}</span><span class="v">${fmt(s.science)} / ${SCIENCE_GOAL}</span></div>
      <div class="dl"><span class="k">${L('Здоровье','Health')}</span><span class="v">${fmt(s.health,0)}%</span></div>
      <div class="dl"><span class="k">${L('Доза','Dose')}</span><span class="v">${fmt(s.dose)} ${U.msv()}</span></div>
      <div class="dl"><span class="k">${L('Построено','Built')}</span><span class="v">${s.stats.builds}</span></div>
      <div class="dl"><span class="k">${L('Выходов наружу','Trips outside')}</span><span class="v">${s.stats.evas}</span></div>
    </div>
    <h3>${L('Чему научилась команда','What the team learned')}</h3>
    <ul class="lessons">${lessons.map(l=>`<li>${esc(l)}</li>`).join('')}</ul>
    ${`<p class="seed">${L(`Код миссии: ${code}. Введи его на стартовом экране, и события повторятся. Так весь класс может сыграть одну миссию и сравнить решения.`,`Mission code: ${code}. Enter it on the start screen to replay the same events, so a whole class can play one mission and compare decisions.`)}</p>`}
    <div class="row-btns">
      <button class="btn primary" type="button" data-cmd="replay" data-focus>${L('Повторить эту миссию','Replay this mission')}</button>
      <button class="btn" type="button" data-start="${s.pid}" data-mode="${s.mode}">${L(`Новая миссия: ${tr(P.name)}`,`New mission: ${tr(P.name)}`)}</button>
      <button class="btn" type="button" data-start="${s.pid==='moon'?'mars':'moon'}" data-mode="${s.mode}">${s.pid==='moon'?L('Попробовать Марс','Try Mars'):L('Попробовать Луну','Try the Moon')}</button>
      <button class="btn" type="button" data-cmd="menu">${L('Главное меню','Main menu')}</button>
    </div>`, L('Итоги миссии','Mission results'), showFinal);
}

function showScience(){
  const back = S ? (S.over ? 'final' : 'close') : 'start';
  const rows = SOLAR.map(f=>`<tr><td class="n">${f.date}</td><td class="n">${esc(f.cls)}</td><td class="n">${esc(S_NAME(f.s))}</td><td class="n">${esc(f.pfu)}</td><td>${esc(f.src)}</td><td class="n">${fmt(f.dose*PLANETS.moon.flareMul,0)} / ${fmt(f.dose*PLANETS.mars.flareMul,0)}</td></tr>`).join('');
  const row = (a,b,c)=>`<tr><td>${a}</td><td class="n">${b}</td><td>${c}</td></tr>`;
  const row2 = (a,b)=>`<tr><td>${a}</td><td>${b}</td></tr>`;
  openModal(`
    <div class="toprow"><div class="eyebrow">${L('Наука в игре','The science in the game')}</div>${langBtn()}</div>
    <h2>${L('Откуда взяты числа','Where the numbers come from')}</h2>
    <p class="lead">${L('Игра упрощает расчёты, но опирается на измерения и проектные данные NASA. Ниже видно, что взято из источника, а что упрощено ради игры.','The game simplifies the maths but is built on NASA measurements and design figures. Below you can see what comes from a source and what is simplified for play.')}</p>
    <h3>${L('1. Настоящие солнечные события','1. Real solar events')}</h3>
    <p class="lead">${L('В каждой миссии случайно выбираются два события из этого списка. Класс вспышки взят из записей NOAA и базы космической погоды NASA DONKI (с 2010 года). Сила протонной бури (шкала NOAA S1–S5) и пиковый поток протонов >10 МэВ взяты из списка NOAA «Solar Proton Events Affecting the Earth Environment». Это <b>архив</b>, а не прямая трансляция. Доза в игре зависит от протонной бури, а не от класса вспышки, как и в реальности. Сами числа доз подобраны для игры.',
      'Each mission draws two events at random from this list. Flare class comes from NOAA records and NASA’s DONKI space-weather database (from 2010). Proton storm strength (NOAA S1–S5 scale) and peak >10 MeV proton flux come from NOAA’s “Solar Proton Events Affecting the Earth Environment” list. This is an <b>archive</b>, not a live feed. As in reality, the game’s dose depends on the proton storm, not the flare class. The dose numbers themselves are tuned for the game.')}</p>
    <div class="tblwrap"><table class="data"><thead><tr><th>${L('Дата','Date')}</th><th>${L('Вспышка','Flare')}</th><th>${L('Протонная буря','Proton storm')}</th><th>${L('Пик, pfu','Peak, pfu')}</th><th>${L('Источник','Source')}</th><th>${L('Доза в игре без защиты, мЗв (Луна / Марс)','Game dose, no shielding, mSv (Moon / Mars)')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="note">${L('* Пары X3.1 и X1.6 от октября 2014 года показывают главный урок: очень яркие вспышки могут пройти без протонной бури.','* The X3.1 and X1.6 flares of October 2014 show the key lesson: very bright flares can come with no proton storm.')}</p>
    <div id="live" class="live"><b>${L('Сейчас на Солнце (онлайн, NASA DONKI):','On the Sun right now (live, NASA DONKI):')}</b> <span>${liveState==='ok'?(liveSummary||''):liveState==='fail'?L('онлайн-данные сейчас недоступны. Игра использует архив выше.','live data is not reachable right now. The game uses the archive above.'):L('проверяем связь…','checking the link…')}</span></div>
    <h3>${L('2. Задержка связи','2. Signal delay')}</h3>
    <p class="lead">${L(`Задержка до Марса считается по реальным орбитам Земли и Марса на сегодняшнюю дату (приближённые элементы орбит JPL). Сегодня сигнал идёт ${fmt(DELAY_MARS,1)} мин в одну сторону, это ${fmt(MARS_AU,2)} а. е. до Марса. До Луны сигнал идёт 1,3 секунды. Поэтому на Марсе советы даёт бортовой компьютер: ответ с Земли придёт слишком поздно.`,
      `The Mars delay is computed from the real orbits of Earth and Mars for today’s date (JPL approximate orbital elements). Today a signal takes ${fmt(DELAY_MARS,1)} min one way: Mars is ${fmt(MARS_AU,2)} AU away. To the Moon it takes 1.3 seconds. That is why on Mars the onboard computer gives advice: an answer from Earth would come too late.`)}</p>
    <h3>${L('3. Жизнеобеспечение, радиация, энергия','3. Life support, radiation, power')}</h3>
    <div class="tblwrap"><table class="data">
      <thead><tr><th>${L('Параметр','Parameter')}</th><th>${L('В игре','In the game')}</th><th>${L('В реальности','In reality')}</th></tr></thead>
      <tbody>
        ${row(L('Кислород на человека','Oxygen per person'), L('0,84 кг/день','0.84 kg/day'), L('0,82–0,84 кг/день (NASA BVAD)','0.82–0.84 kg/day (NASA BVAD)'))}
        ${row(L('Еда на человека','Food per person'), L('1,8 кг/день','1.8 kg/day'), L('около 1,8 кг/день вместе с упаковкой (NASA BVAD)','about 1.8 kg/day incl. packaging (NASA BVAD)'))}
        ${row(L('Переработка воды','Water recycling'), '90%', L('на МКС около 93%, с 2023 года до 98% (NASA)','ISS about 93%, up to 98% since 2023 (NASA)'))}
        ${row(L('Вода для кислорода','Water for oxygen'), L('1,125 л на 1 кг O₂','1.125 L per kg O₂'), L('по химии электролиза: из 9 г воды выходит 8 г кислорода','electrolysis chemistry: 9 g of water gives 8 g of oxygen'))}
        ${row(L('Фон радиации на Марсе','Background radiation, Mars'), L('0,67 мЗв/день','0.67 mSv/day'), L('≈0,67 мЗв/день, прибор RAD марсохода Curiosity (Hassler и др., 2014)','≈0.67 mSv/day, Curiosity RAD (Hassler et al., 2014)'))}
        ${row(L('Фон радиации на Луне','Background radiation, Moon'), L('1,37 мЗв/день','1.37 mSv/day'), L('≈1,37 мЗв/день, аппарат Chang’e-4 (Zhang и др., 2020)','≈1.37 mSv/day, Chang’e-4 LND (Zhang et al., 2020)'))}
        ${row(L('Протонная буря','Proton storm'), L('S0 ≈ 1, S3 ≈ 45–50, S4 ≈ 70–85 мЗв без защиты','S0 ≈ 1, S3 ≈ 45–50, S4 ≈ 70–85 mSv unshielded'), L('порядок величины по оценкам для бури августа 1972 года без укрытия; реальная доза сильно зависит от энергии протонов и защиты','order of magnitude from estimates for the unsheltered August 1972 storm; real dose depends strongly on proton energy and shielding'))}
        ${row(L('Лимит дозы','Dose limit'), L('100 мЗв за миссию','100 mSv per mission'), L('NASA: 600 мЗв за всю карьеру астронавта. Для игры лимит снижен','NASA: 600 mSv over a whole career. Lowered for the game'))}
        ${row(L('Защита реголитом','Regolith shielding'), L('×0,7 за первый слой','×0.7 for the first layer'), L('около 0,5 м грунта заметно ослабляет протоны бури. Точный эффект зависит от энергии частиц','about 0.5 m of soil noticeably weakens storm protons. The exact effect depends on particle energy'))}
        ${row(L('Реактор','Reactor'), L('40 кВт·ч/день','40 kWh/day'), L('Fission Surface Power: около 40 кВт. В игре взято меньше для баланса','Fission Surface Power: about 40 kW. Less in the game for balance'))}
        ${row(L('Тень от гор (Луна)','Mountain shadow (Moon)'), L('2 дня подряд, панели дают 15%','2 days in a row, panels give 15%'), L('по картам освещённости LRO/LOLA точки на гребне Шеклтона освещены 80–90% времени (Mazarico и др., 2011)','LRO/LOLA illumination maps: points on the Shackleton rim are lit 80–90% of the time (Mazarico et al., 2011)'))}
        ${row(L('Пылевая буря (Марс)','Dust storm (Mars)'), L('5 солов, панели дают 30%','5 sols, panels give 30%'), L('буря 2018 года: прозрачность неба упала до τ≈10,8, энергия Opportunity — с ~645 до ~22 Вт·ч за сол. В игре мягче','2018 storm: sky opacity reached τ≈10.8, Opportunity’s power fell from ~645 to ~22 Wh per sol. Gentler in the game'))}
        ${row(L('Перелёт до Луны / Марса','Trip to Moon / Mars'), L('грузы на 7 и 14 день / нет','cargo on days 7 and 14 / none'), L('около 3 дней / 6–9 месяцев, окно старта к Марсу раз в 26 месяцев','about 3 days / 6–9 months, Mars launch window every 26 months'))}
      </tbody></table></div>
    <h3>${L('4. Настоящие 3D-модели и снимки NASA','4. Real NASA 3D models and imagery')}</h3>
    <div class="tblwrap"><table class="data">
      <thead><tr><th>${L('Что в игре','In the game')}</th><th>${L('Что это','What it is')}</th></tr></thead>
      <tbody>
        ${row2(L('Робот у карьера','Robot at the quarry'), L('RASSOR — робот-копатель реголита, создан в Космическом центре Кеннеди NASA','RASSOR, a regolith-mining robot built at NASA Kennedy Space Center'))}
        ${row2(L('Аппарат на Марсе','Lander on Mars'), L('«Викинг-2» — сел на равнине Утопия 3 сентября 1976 года','Viking 2, landed in Utopia Planitia on 3 Sep 1976'))}
        ${row2(L('Спутник в небе','Satellite in the sky'), L('над Луной — LRO (снимает Луну с 2009 года), над Марсом — MRO (нашёл лёд под Утопией)','over the Moon: LRO (mapping it since 2009); over Mars: MRO (found the ice under Utopia)'))}
        ${row2(L('Земля, Фобос и Деймос','Earth, Phobos and Deimos'), L('настоящие карты поверхности NASA. Спутники Марса показаны крупнее, чтобы их было видно','real NASA surface maps. The moons of Mars are drawn larger so you can see them'))}
      </tbody></table></div>
    <h3>${L('Источники','Sources')}</h3>
    <ol class="src">
      <li>NASA, <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">DONKI</a> <span>— ${L('вспышки (FLR) и протонные события (SEP); онлайн-режим «Космическая погода сегодня».','flares (FLR) and proton events (SEP); the “space weather today” live mode.')}</span></li>
      <li>NOAA SWPC, <a href="https://umbra.nascom.nasa.gov/SEP/" target="_blank" rel="noopener">Solar Proton Events Affecting the Earth Environment</a> <span>— ${L('пиковый поток протонов и уровни S.','peak proton flux and S-levels.')}</span></li>
      <li>NOAA, <a href="https://www.swpc.noaa.gov/noaa-scales-explanation" target="_blank" rel="noopener">${L('Шкалы космической погоды NOAA','NOAA Space Weather Scales')}</a> <span>— ${L('что значат S1–S5.','what S1–S5 mean.')}</span></li>
      <li>NASA, <a href="https://ntrs.nasa.gov/citations/20210024855" target="_blank" rel="noopener">Life Support Baseline Values and Assumptions Document (BVAD)</a> <span>— ${L('нормы кислорода, воды и еды.','oxygen, water and food rates.')}</span></li>
      <li>NASA, <a href="https://www.nasa.gov/missions/station/iss-research/nasa-achieves-water-recovery-milestone-on-international-space-station/" target="_blank" rel="noopener">${L('98% переработки воды на МКС','98% water recovery on the ISS')}</a> <span>— 2023.</span></li>
      <li>Hassler D. M. et al., <a href="https://doi.org/10.1126/science.1244797" target="_blank" rel="noopener">Mars’ Surface Radiation Environment Measured with Curiosity</a> <span>— Science, 2014.</span></li>
      <li>Zhang S. et al., <a href="https://doi.org/10.1126/sciadv.aaz1334" target="_blank" rel="noopener">First measurements of the radiation dose on the lunar surface</a> <span>— Science Advances, 2020.</span></li>
      <li>NASA, <a href="https://osdr.nasa.gov/" target="_blank" rel="noopener">Open Science Data Repository (OSDR)</a> <span>— ${L('опыты с растениями и здоровьем в космосе. Основа идеи теплиц и восстановления здоровья.','plant and health experiments in space; the basis for greenhouses and crew health.')}</span></li>
      <li>JPL, <a href="https://ssd.jpl.nasa.gov/planets/approx_pos.html" target="_blank" rel="noopener">Approximate Positions of the Planets</a> <span>— ${L('элементы орбит для расчёта задержки связи.','orbital elements for the signal delay.')}</span></li>
      <li>NASA, <a href="https://www.nasa.gov/space-technology-mission-directorate/tdm/fission-surface-power/" target="_blank" rel="noopener">Fission Surface Power</a> <span>— ${L('малый реактор для Луны.','a small reactor for the Moon.')}</span></li>
      <li>NASA, <a href="https://science.nasa.gov/mission/mer-opportunity/" target="_blank" rel="noopener">Opportunity</a> <span>— ${L('миссия завершилась после пылевой бури 2018 года.','the mission ended after the 2018 dust storm.')}</span></li>
      <li>NASA, <a href="https://www.nasa.gov/humans-in-space/artemis/" target="_blank" rel="noopener">Artemis</a> <span>— ${L('возвращение людей на Луну, район южного полюса.','returning people to the Moon, south-pole region.')}</span></li>
      <li>NASA, <a href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noopener">NASA 3D Resources</a> <span>— ${L('модели RASSOR, «Викинг», LRO, MRO и карты Земли, Фобоса, Деймоса (общественное достояние).','RASSOR, Viking, LRO and MRO models; Earth, Phobos and Deimos maps (public domain).')}</span></li>
      <li>Mazarico E. et al., <a href="https://doi.org/10.1016/j.icarus.2010.10.030" target="_blank" rel="noopener">Illumination conditions of the lunar polar regions using LOLA topography</a> <span>— Icarus, 2011 (NASA GSFC).</span></li>
      <li>NASA/JPL, <a href="https://www.jpl.nasa.gov/news/nasas-opportunity-rover-mission-on-mars-comes-to-end/" target="_blank" rel="noopener">${L('Конец миссии Opportunity','Opportunity mission ends')}</a> <span>— ${L('пылевая буря 2018 года.','the 2018 dust storm.')}</span></li>
      <li>NASA/JPL, <a href="https://www.jpl.nasa.gov/news/mars-ice-deposit-holds-as-much-water-as-lake-superior/" target="_blank" rel="noopener">${L('Лёд под равниной Утопия','Ice under Utopia Planitia')}</a> <span>— MRO, 2016.</span></li>
    </ol>
    <div class="row-btns"><button class="btn primary" type="button" data-cmd="${back}" data-focus>${L('Вернуться','Back')}</button></div>`, L('Наука в игре','The science'), showScience);
  if(liveState==='idle') loadLive();
}
