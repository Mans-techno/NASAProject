/* Main screen: meters, tasks, history */
"use strict";
/* ============================================================
   RENDER
   ============================================================ */
let S = null;
const app = document.getElementById('app');
const modalRoot = document.getElementById('modalRoot');

function meterHTML({name, icon, value, unit, max, color, delta, digits=1, inverse=false, limit=null, note=''}){
  const pct = Math.max(0, Math.min(100, value/max*100));
  const next = Math.max(0, Math.min(100, (value+delta)/max*100));
  const dTxt = `<span class="d ${delta>0.05?(inverse?'down':'up'):delta<-0.05?(inverse?'up':'down'):''}">${sgn(delta,digits)} ${unit} ${L('за день','per day')}</span>`;
  let right = note;
  if(!inverse && delta < -0.05 && !right){
    const days = value / -delta;
    right = days < 3 ? `<span class="crit">${L(`хватит на ${fmt(days,1)} дн.`,`lasts ${fmt(days,1)} days`)}</span>` : L(`хватит на ~${Math.floor(days)} дн.`,`lasts ~${Math.floor(days)} days`);
  }
  if(inverse && limit){ const left = limit - value; right = `<span class="${left<25?'crit':''}">${L('до лимита','to limit')} ${fmt(left,1)}</span>`; }
  const fc = `<div class="fc">${dTxt}<span>${right}</span></div>`;
  const bars = delta < 0 && !inverse ? `<span class="ghost" style="width:${pct}%;background:${color}"></span><span style="width:${next}%;background:${color}"></span>`
                                     : `<span style="width:${pct}%;background:${color}"></span>${inverse||delta<=0?'':`<span class="ghost" style="width:${next}%;background:${color}"></span>`}`;
  return `<div class="meter" role="group" aria-label="${esc(name)}: ${fmt(value,digits)} ${unit}">
    ${icon}<span class="name">${name}</span><span class="val">${fmt(value,digits)}<small> ${unit}${max&&!inverse&&unit!=='%'?' / '+fmt(max,0):''}</small></span>
    <div class="bar">${bars}${limit?`<span class="limit" style="left:calc(100% - 2px)"></span>`:''}</div>${fc}</div>`;
}

function engineerTip(s, pv){
  const P = PLANETS[s.pid], i = pv.info, n = pv.s;
  const tips = [];
  const days = (v,d)=> d<0 ? v/-d : Infinity;
  if(i.blackout) tips.push([10,L('Энергии не хватит!','Not enough power!'),L(`Расход ${fmt(i.demand,0)} кВт·ч больше, чем есть вместе с батареей. Все системы просядут. `,`Demand of ${fmt(i.demand,0)} kWh is more than you have, battery included. Every system will brown out. `) + (s.mode==='cadet'?L('Выключи радио или убавь кислород: запаса в баках хватит на несколько дней.','Turn off the radio or lower oxygen: the tanks hold a few days’ supply.'):L('Убавь теплицу, очистку воды или радио: кислород и тепло важнее.','Lower the greenhouse, water recycler or radio: oxygen and heat matter more.'))]);
  if(s.leak) tips.push([9,L('Утечка воздуха','Air leak'),L('Через пробоину уходит 1,5 кг кислорода в день. Назначь ремонт.','1.5 kg of oxygen leaks out each day. Assign a repair.')]);
  if(days(s.o2, n.o2-s.o2) < 4) tips.push([9,L('Кислород на исходе','Oxygen running low'),L('Подними мощность электролиза.','Raise electrolysis power.')]);
  if(s.data > 0.01 && s.lv.comm === 0) tips.push([6,L('Данные ждут','Data waiting'),L('Научные данные лежат на базе. Включи радиосвязь, чтобы отправить их на Землю.','Science data is sitting on the base. Turn on the radio to send it to Earth.')]);
  if(s.data < 0.01 && s.lv.comm > 0 && s.action!=='science') tips.push([4,L('Радио работает впустую','Radio is idle'),L(`Отправлять нечего, а радио тратит ${fmt(i.dem.comm,0)} кВт·ч. Можно выключить его до новой вылазки.`,`Nothing to send, yet the radio uses ${fmt(i.dem.comm,0)} kWh. Switch it off until the next sortie.`)]);
  if(s.recyclerBroken) tips.push([9,L('Очистка воды сломана','Water recycler broken'),L('Каждый день без неё уносит десятки литров воды. Назначь ремонт.','Every day without it costs tens of litres. Assign a repair.')]);
  if(isFlare(s, s.day)) tips.push([9,L('Сегодня вспышка','Flare today'),L('Сегодня безопаснее не выходить наружу. Слой реголита, насыпанный утром, защитит уже сегодня.','Better not go outside today. A regolith layer added this morning protects you today.')]);
  if(days(s.water, n.water-s.water) < 4) tips.push([8,L('Мало воды','Low water'),L('Добудь лёд или подними мощность очистки воды.','Mine ice or raise water recycling.')]);
  if(days(s.food, n.food-s.food) < 4) tips.push([8,L('Мало еды','Low food'),L('Включи теплицы на полную или построй ещё одну.','Run greenhouses at full power or build another one.')]);
  if(s.ghBroken>0) tips.push([6,L('Теплица пробита','Greenhouse damaged'),L('Она не даёт ни еды, ни кислорода, пока её не починят.','It gives no food or oxygen until repaired.')]);
  const left = s.sched.flares.filter(d=>d>=s.day);
  if(left.length && s.dose + left.reduce((a,d)=>a+flareDose(s,d),0) + P.bgDose*SHIELD[s.shield]*(P.days-s.day+1) > DOSE_LIMIT*0.85)
    tips.push([7,L('Радиация','Radiation'),L('Если придёт сильная протонная буря, при нынешней защите можно превысить лимит дозы. Насыпь ещё слой реголита.','If a strong proton storm hits, current shielding may not keep you under the dose limit. Add a regolith layer.')]);
  if(i.dark && !i.blackout) tips.push([5,tr(P.darkName),L(`Солнце даёт только ${Math.round(P.darkFactor*100)}% энергии. Следи, чтобы батарея не опустела.`,`The Sun gives only ${Math.round(P.darkFactor*100)}% power. Watch the battery.`)]);
  if(s.pid==='mars' && s.dust>=0.12) tips.push([5,L('Пыль на панелях','Dusty panels'),L(`Пыль съедает ${Math.round(s.dust*100)}% солнечной энергии. Пора чистить.`,`Dust is eating ${Math.round(s.dust*100)}% of solar power. Time to clean.`)]);
  if(s.health < 50) tips.push([6,L('Экипаж устал','Crew is worn out'),L('Дай экипажу отдохнуть: отдых добавляет 10 к здоровью.','Let the crew rest: rest adds 10 health.')]);
  if(s.dose > 70) tips.push([6,L('Высокая доза','High dose'),L('Меньше выходов наружу. Каждый выход добавляет дозу.','Fewer trips outside. Every trip adds dose.')]);
  if(i.wasted > 5) tips.push([3,L('Энергия пропадает','Power is wasted'),L(`${fmt(i.wasted,0)} кВт·ч не влезут в батарею. Добавь аккумулятор или займи энергию делом.`,`${fmt(i.wasted,0)} kWh will not fit in the battery. Add a battery or put the power to work.`)]);
  if(s.science < SCIENCE_GOAL && P.days - s.day + 1 <= SCIENCE_GOAL - s.science + 1) tips.push([4,L('Наука ждёт','Science is waiting'),L(`Для трёх звёзд нужно ${SCIENCE_GOAL} научных результатов, а дней осталось мало.`,`Three stars need ${SCIENCE_GOAL} science results, and few days are left.`)]);
  if(!tips.length){
    const g = [
      [L('Всё в норме','All good'),L('Хороший момент, чтобы построить что-то на будущее или заняться наукой.','A good moment to build for the future or do some science.')],
      [L('Подумай заранее','Plan ahead'),L('Вспышки и тени предупреждают за день. Лучше готовиться до предупреждения.','Flares and shadows come with one day’s warning. Better to prepare before that.')],
      [L('Совет','Tip'),L('Сравни, сколько энергии ест каждая система. Радио нужно только тогда, когда есть что отправить.','Compare how much power each system uses. The radio is only needed when there is data to send.')],
    ][s.day % 3]; tips.push([0,g[0],g[1]]);
  }
  tips.sort((a,b)=>b[0]-a[0]);
  return tips[0];
}

function histHTML(s){
  const P = PLANETS[s.pid];
  const H = [{day:0, o2:P.o2, battery:60, batCap:BAT_START_CAP, dose:0}, ...s.history];
  const W = 600, Ht = 210, L0 = 40, R0 = 14, T0 = 14, B0 = 26;
  const x = d => L0 + d/P.days*(W-L0-R0), y = v => T0 + (1-Math.max(0,Math.min(1,v)))*(Ht-T0-B0);
  const last = H[H.length-1], prev = H.length>1 ? H[H.length-2] : last, now = x(last.day);
  const series = [
    {k:'o2', f:h=>h.o2/O2_CAP, c:'var(--o2)', name:L('Кислород','Oxygen'), val:h=>`${fmt(h.o2,0)} ${L('кг','kg')}`, d:h=>h.o2, unit:L('кг','kg'), good:1},
    {k:'bat', f:h=>h.battery/(h.batCap||s.batCap), c:'var(--power)', name:L('Батарея','Battery'), val:h=>`${fmt(h.battery,0)} ${L('кВт·ч','kWh')}`, d:h=>h.battery, unit:L('кВт·ч','kWh'), good:1},
    {k:'dose', f:h=>h.dose/DOSE_LIMIT, c:'var(--rad)', name:L('Доза','Dose'), val:h=>`${fmt(h.dose,0)} ${L('мЗв','mSv')}`, d:h=>h.dose, unit:L('мЗв','mSv'), good:-1},
  ];
  const pts = f => H.map(h=>`${x(h.day).toFixed(1)},${y(f(h)).toFixed(1)}`).join(' ');
  const defs = series.map(se=>`<linearGradient id="hg-${se.k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${se.c}" stop-opacity=".28"/><stop offset="1" stop-color="${se.c}" stop-opacity="0"/></linearGradient>`).join('');
  const areas = '';
  const lines = series.map(se=>`<polyline fill="none" stroke="${se.c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${pts(se.f)}"/>`).join('');
  const dots = series.map(se=>H.map((h,i)=>`<circle cx="${x(h.day)}" cy="${y(se.f(h))}" r="${i===H.length-1?4:0}" fill="${i===H.length-1?'var(--bg,#0b1020)':se.c}" stroke="${se.c}" stroke-width="${i===H.length-1?2:0}"><title>${L('День','Day')} ${h.day}: ${se.name} ${se.val(h)}</title></circle>`).join('')).join('');
  const grid = [0,0.5,1].map(v=>`<line x1="${L0}" x2="${W-R0}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,${v?0.06:0.12})" stroke-width="1"/><text x="${L0-8}" y="${y(v)+3.5}" text-anchor="end" class="ax">${v*100}%</text>`).join('');
  const ticks = [1,5,10,15,20].filter(d=>d<=P.days).map(d=>`<text x="${x(d)}" y="${Ht-8}" text-anchor="middle" class="ax">${d}</text>`).join('') + `<text x="${L0}" y="${Ht-8}" text-anchor="start" class="ax">${tr(P.dayName).toLowerCase()}</text>`;
  const future = last.day < P.days ? `<line x1="${now}" x2="${now}" y1="${T0}" y2="${Ht-B0}" stroke="rgba(255,255,255,.18)" stroke-dasharray="2 3"/>` : '';
  const darks = s.sched.dark.map((st,i)=>{ const e = Math.min(st+darkLenAt(s,i)-1, s.day-1); return e>=st ? `<rect x="${x(st-0.5)}" y="${T0}" width="${x(e+0.5)-x(st-0.5)}" height="${Ht-T0-B0}" fill="#fff" opacity=".04"><title>${tr(P.darkName)}</title></rect>` : ''; }).join('');
  const marks = s.sched.flares.filter(d=>d<s.day).map(d=>`<line x1="${x(d)}" x2="${x(d)}" y1="${T0+6}" y2="${Ht-B0}" stroke="var(--rad)" stroke-opacity=".35"/><g transform="translate(${x(d)},${T0+2})"><circle r="3.5" fill="var(--rad)"/><title>${L('Вспышка, день','Flare, day')} ${d}</title></g>`).join('');
  const limit = '';
  const tiles = series.map(se=>{ const dv = se.d(last) - se.d(prev), up = dv > 0.05, dn = dv < -0.05, ok = (up && se.good>0) || (dn && se.good<0);
    return `<div class="ht" style="--c:${se.c}"><span class="hn"><i></i>${se.name}</span><b>${se.val(last)}</b><span class="hd ${up||dn ? (ok?'ok':'bad') : ''}">${up||dn ? (dv>0?'+':'−')+fmt(Math.abs(dv),1)+' '+L('за день','today') : '—'}</span></div>`; }).join('');
  return `<div class="card hist" id="c-hist"><h2>${L('Журнал миссии','Mission log')} <span class="hint">${L('день','day')} ${last.day} / ${P.days}</span></h2>
    <div class="htiles">${tiles}</div>
    <svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="${L('График запасов по дням','Supplies by day')}"><defs>${defs}<linearGradient id="hg-fut" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8fb8ff" stop-opacity=".07"/><stop offset="1" stop-color="#8fb8ff" stop-opacity="0"/></linearGradient></defs>
      ${grid}${future}${darks}${areas}${marks}${lines}${dots}${limit}${ticks}</svg>
    <div class="lg"><span>${L('Шкала: % от бака, заряда и лимита дозы','Scale: % of tank, charge and dose limit')}</span><span><i class="fl"></i>${L('вспышка','flare')}</span><span><i style="background:#fff;opacity:.15;height:8px"></i>${tr(P.darkName)}</span></div></div>`;
}

const ACT_ICON = { rest:'bed', science:'flask', ice:'ice', shield:'mound', panel:'sun', battery:'battery', greenhouse:'leaf', reactor:'atom', repair:'wrench', clean:'broom' };
function stepsHTML(s){
  const P = PLANETS[s.pid], dn = tr(P.dayName);
  const H = s.history.filter(h=>h.act).slice().reverse();
  const sysName = { o2:L('O₂','O₂'), heat:L('тепло','heat'), comm:L('радио','radio'), water:L('вода','water'), farm:L('теплицы','farms') };
  const rows = H.map((h)=>{
    const idx = s.history.indexOf(h);
    const lv = Object.entries(h.lv).filter(([k])=> s.mode!=='cadet' || ['o2','heat','comm'].includes(k)).map(([k,v])=>`<span class="pw" style="--v:${v}%">${sysName[k]} ${v}%</span>`).join('');
    const tags = [];
    if(h.flare) tags.push(`<span class="tg rad">${esc(h.flare.cls)} · ${esc(S_NAME(h.flare.s))}</span>`);
    if(h.dark) tags.push(`<span class="tg">${esc(tr(P.darkName))}</span>`);
    if(h.blackout) tags.push(`<span class="tg bad">${L('нехватка энергии','power short')}</span>`);
    if(h.dSci>0.01) tags.push(`<span class="tg ok">+${fmt(h.dSci)} ${L('науки','science')}</span>`);
    tags.push(`<span class="tg ${h.dDose>10?'bad':''}">+${fmt(h.dDose)} ${U.msv()}</span>`);
    return `<li><button type="button" class="step" data-replay="${idx}" aria-label="${L('Показать шаг','Show step')} ${h.day}">
      <span class="sd">${dn}<b>${h.day}</b></span>
      <span class="sm"><span class="sn">${ic(ACT_ICON[h.act]||'star')} ${esc(val(ACT[h.act].name, s))}</span><span class="spw">${lv}</span><span class="stg">${tags.join('')}</span></span>
      <span class="sp" aria-hidden="true">${ic('play')}</span></button></li>`;
  }).join('');
  return `<div class="card steps-card" id="c-steps"><h2>${L('Шаги командира','Commander’s steps')} <span class="hint">${L('нажми, чтобы показать в 3D','tap to replay in 3D')}</span></h2>
    ${rows ? `<ol class="steps-list">${rows}</ol>` : `<p class="empty">${L('Здесь появится каждый твой день: какое задание ты дал, как разделил энергию и что из этого вышло.','Every day you play shows up here: the task you gave, how you split the power, and what came of it.')}</p>`}</div>`;
}
function trackHTML(s){
  const P = PLANETS[s.pid]; let h = '';
  for(let d=1; d<=P.days; d++){
    const cls = [d<s.day?'done':'', d===s.day?'now':'', (isFlare(s,d) && d<=s.day)?'flare':'', (isDark(s,d) && d<=s.day)?'dark':''].join(' ');
    h += `<i class="${cls}" title="${tr(P.dayName)} ${d}"></i>`;
  }
  return `<div class="track" aria-hidden="true">${h}</div>`;
}

function langBtn(){ return `<button class="btn lang" type="button" data-cmd="lang" aria-label="${L('Switch to English','Переключить на русский')}">${L('EN','RU')}</button>`; }

function render(){
  if(!S){ app.innerHTML=''; return; }
  const s = S, P = PLANETS[s.pid], dn = tr(P.dayName), eng = s.mode !== 'cadet';
  document.documentElement.dataset.planet = s.pid;
  const pv = simulate(s), n = pv.s, i = pv.info;
  const tip = engineerTip(s, pv);
  const alerts = [];
  if(i.dark) alerts.push(['warn', `${tr(P.darkName)}: ${L('солнце','sun')} ${Math.round(P.darkFactor*100)}%`]);
  if(isFlare(s,s.day)) alerts.push(['bad',L('Сегодня солнечная вспышка','Solar flare today')]);
  if(isFlare(s,s.day+1)) alerts.push(['warn',L('Завтра солнечная вспышка','Solar flare tomorrow')]);
  if(isDark(s,s.day+1) && !i.dark) alerts.push(['warn',`${L('Завтра','Tomorrow')}: ${tr(P.darkName).toLowerCase()}`]);
  if(s.leak) alerts.push(['bad',L('Утечка воздуха','Air leak')]);
  if(s.data>0.01) alerts.push(['warn',L(`Данные ждут отправки: ${fmt(s.data)}`,`Data waiting to send: ${fmt(s.data)}`)]);
  if(s.recyclerBroken) alerts.push(['bad',L('Очистка воды сломана','Water recycler broken')]);
  if(s.ghBroken) alerts.push(['bad',L(`Пробита теплица (${s.ghBroken})`,`Greenhouse damaged (${s.ghBroken})`)]);
  if(P.cargo.includes(s.day)) alerts.push(['good',L('Сегодня прилетит грузовой корабль','Cargo ship arrives today')]);
  if(!alerts.length) alerts.push(['good',L('Системы в норме','All systems normal')]);
  alerts.push(['info',`${L('Сигнал до Земли','Signal to Earth')}: ${delayText(s.pid)}`]);
  if(s.sched.ev.some(e=>e.live)) alerts.push(['info',L('В миссии настоящая вспышка за последние 30 дней (онлайн, NASA DONKI)','This mission includes a real flare from the last 30 days (live, NASA DONKI)')]);

  const systems = [
    {id:'o2', nm:L('Кислород (электролиз)','Oxygen (electrolysis)'), ds: eng ? L(`Расщепляет воду: до ${fmt(O2_SYS_KG)} кг O₂ в день, тратит ${fmt(O2_SYS_KG*O2_WATER_PER_KG)} л воды.`,`Splits water: up to ${fmt(O2_SYS_KG)} kg O₂ a day, uses ${fmt(O2_SYS_KG*O2_WATER_PER_KG)} L of water.`) : L(`Ток расщепляет воду на водород и кислород: до ${fmt(O2_SYS_KG)} кг O₂ в день. Экипаж дышит ${fmt(O2_PER*CREW,2)} кг.`,`Electric current splits water into hydrogen and oxygen: up to ${fmt(O2_SYS_KG)} kg O₂ a day. The crew breathes ${fmt(O2_PER*CREW,2)} kg.`), kw:i.dem.o2},
    eng && {id:'water', nm:L('Очистка воды','Water recycler'), ds:L(`Возвращает ${RECOVERY*100}% использованной воды.`,`Recovers ${RECOVERY*100}% of used water.`), kw:i.dem.water, off:s.recyclerBroken},
    {id:'heat', nm:L('Обогрев','Heating'), ds:L(`Держит в модуле +21 °C. Нужно ${P.heat} кВт·ч в день.`,`Keeps the habitat at +21 °C. Needs ${P.heat} kWh a day.`), kw:i.dem.heat},
    eng && {id:'farm', nm:L(`Теплицы (${s.gh - s.ghBroken} из ${s.gh})`,`Greenhouses (${s.gh - s.ghBroken} of ${s.gh})`), ds:L(`Светодиоды для растений. Каждая даёт ${fmt(GH_FOOD)} кг еды и ${fmt(GH_O2)} кг O₂.`,`Grow lights for plants. Each gives ${fmt(GH_FOOD)} kg food and ${fmt(GH_O2)} kg O₂.`), kw:i.dem.farm},
    {id:'comm', nm:L('Радиосвязь с Землёй','Radio link to Earth'), ds:L(`Отправляет 1 научный результат в день. Сигнал идёт ${delayText(s.pid)}${s.pid==='mars'?', поэтому антенне нужно больше энергии':''}.`,`Sends 1 science result a day. The signal takes ${delayText(s.pid)}${s.pid==='mars'?', so the antenna needs more power':''}.`), kw:i.dem.comm},
  ].filter(Boolean);
  const levels = [0,25,50,75,100];
  const sysHTML = systems.map(x=>`<div class="sys ${x.off?'off':''}" data-off="${L(' · сломан',' · broken')}">
      <div class="row"><span class="nm">${x.nm}</span><span class="kw">${fmt(x.kw,1)} ${U.kwh()}</span></div>
      <div class="ds">${x.ds}</div>
      <div class="seg" role="group" aria-label="${L('Мощность','Power')}: ${esc(x.nm)}">${levels.map(l=>`<button type="button" data-lv="${x.id}" data-v="${l}" aria-pressed="${s.lv[x.id]===l}" ${x.off?'disabled':''}>${l}%</button>`).join('')}</div>
    </div>`).join('');

  const maxScale = Math.max(i.prod + s.battery, i.demand, 1);
  const net = i.prod - i.demand;
  const balTxt = i.blackout ? `<span class="res" style="color:var(--bad)">${L('Не хватит','Short by')} ${fmt(i.demand - i.prod - s.battery,0)} ${U.kwh()}</span>`
              : net >= 0 ? `<span class="res" style="color:var(--ok)">+${fmt(net,0)} ${L('в батарею','to battery')}</span>` : `<span class="res" style="color:var(--warn)">−${fmt(-net,0)} ${L('из батареи','from battery')}</span>`;

  const acts = ACTIONS.map(a=>{
    const b = actionBlock(s,a); if(b==='hide') return '';
    const chips = [];
    if(a.parts) chips.push(`<span class="chip">${a.parts} ${L(plural(a.parts,'запчасть','запчасти','запчастей'), a.parts===1?'part':'parts')}</span>`);
    if(a.energy) chips.push(`<span class="chip">${a.energy} ${U.kwh()}</span>`);
    if(a.eva) chips.push(`<span class="chip eva">${L('выход','EVA')}: +${fmt(P.eva)} ${U.msv()}</span>`);
    if(b) chips.push(`<span class="chip why">${b}</span>`);
    return `<button type="button" class="act" data-act="${a.id}" aria-pressed="${s.action===a.id}" ${b?'disabled':''}>
      <span class="an">${esc(val(a.name,s))}</span><span class="ad">${esc(val(a.desc,s))}</span><span class="ac">${chips.join('')}</span></button>`;
  }).join('');

  const shieldTxt = `${s.shield} ${L(plural(s.shield,'слой','слоя','слоёв'), s.shield===1?'layer':'layers')} · ×${fmt(SHIELD[s.shield],2)}`;

  app.innerHTML = `
  <header class="top">
    <div class="brand"><h1>${tr(P.base)}</h1><span class="sub">${tr(P.where)} · ${L('экипаж','crew')} ${CREW} · ${s.mode==='cadet'?L('режим «Кадет»','Cadet mode'):L('режим «Инженер»','Engineer mode')}</span></div>
    <div class="daybox">
      <div class="daycount"><span class="lbl">${dn}</span><span class="big">${s.day}</span><span class="of">/ ${P.days}</span></div>
      ${trackHTML(s)}
      <button class="btn" type="button" data-cmd="science">${L('Наука в игре','The science')}</button>
      <button class="btn" type="button" data-cmd="menu">${L('Новая миссия','New mission')}</button>
      ${langBtn()}
    </div>
  </header>
  <div class="alerts" role="status">${alerts.map(a=>`<span class="alert ${a[0]}"><span class="dot"></span>${a[1]}</span>`).join('')}</div>
  <main class="grid">
    <section class="card" id="c-res" aria-labelledby="h-res">
      <h2 id="h-res">${L('Запасы базы','Base supplies')} <span class="hint">${L('прогноз на день','forecast for today')}</span></h2>
      <div class="meters">
        ${meterHTML({name:L('Кислород','Oxygen'), icon:ICON.o2, value:s.o2, unit:U.kg(), max:O2_CAP, color:'var(--o2)', delta:n.o2-s.o2})}
        ${eng?meterHTML({name:L('Вода','Water'), icon:ICON.water, value:s.water, unit:U.l(), max:Math.max(200,s.water), color:'var(--water)', delta:n.water-s.water, digits:0}):''}
        ${eng?meterHTML({name:L('Еда','Food'), icon:ICON.food, value:s.food, unit:U.kg(), max:Math.max(120,s.food), color:'var(--food)', delta:n.food-s.food}):''}
        ${meterHTML({name:L('Батарея','Battery'), icon:ICON.power, value:s.battery, unit:U.kwh(), max:s.batCap, color:'var(--power)', delta:n.battery-s.battery, digits:0})}
        ${meterHTML({name:L('Здоровье','Health'), icon:ICON.hp, value:s.health, unit:'%', max:100, color:'var(--hp)', delta:n.health-s.health, digits:0, note: s.health<40?`<span class="crit">${L('опасно','danger')}</span>`:''})}
        ${meterHTML({name:L('Доза радиации','Radiation dose'), icon:ICON.rad, value:s.dose, unit:U.msv(), max:DOSE_LIMIT, color:'var(--rad)', delta:n.dose-s.dose, inverse:true, limit:DOSE_LIMIT})}
      </div>
      <div class="stats">
        <div class="stat"><div class="k">${L('Запчасти','Spare parts')}</div><div class="v">${s.parts}</div></div>
        <div class="stat"><div class="k">${L('Наука','Science')}</div><div class="v">${fmt(s.science)}<small> / ${SCIENCE_GOAL}${s.data>0.01?L(' · ждёт ',' · waiting ')+fmt(s.data):''}</small></div></div>
        <div class="stat"><div class="k">${L('Защита','Shielding')}</div><div class="v" style="font-size:14px">${shieldTxt}</div></div>
        <div class="stat"><div class="k">${L('Панели','Panels')}</div><div class="v">${s.panels}${s.reactor?`<small> + ${L('реактор','reactor')}</small>`:''}</div></div>
      </div>
    </section>
    <section class="scenecol" id="c-scene">
      <div class="scene ${G3?'is3d':''}" id="sceneBox">${G3?'':`<canvas id="scene" role="img" aria-label="${L('Вид базы','View of the base')}"></canvas>`}
        <div class="scap" id="scap" aria-live="polite"></div>${G3?`<span class="hint3d" aria-hidden="true">${ic('rotate')} ${L('потяни, чтобы повернуть','drag to rotate')}</span><button class="btn primary walkbtn" type="button" data-cmd="walk">${ic('walk')} ${L('Вернуться на базу','Back to the base')}</button>${hudHTML(s, i)}`:''}
        <span class="tag">${tr(P.name)} · ${L('солнце','sun')} ${Math.round(i.sun*100)}%</span>
        <span class="tag tag2">${s.pid==='mars'?L('пыль на панелях ','panel dust ')+Math.round(s.dust*100)+'%':(eng?L('грузы: дни ','cargo: days ')+P.cargo.join(L(' и ',' & ')):L('связь 1,3 с','signal 1.3 s'))}</span></div>
      ${histHTML(s)}
      ${stepsHTML(s)}
      <div class="card tip"><div class="who" aria-hidden="true">${s.pid==='mars'?L('ИИ','AI'):L('ЦУП','MC')}</div><div><div class="t">${s.pid==='mars'?L('Бортовой компьютер','Onboard computer'):L('ЦУП','Mission Control')} · ${esc(tip[1])}</div><p>${esc(tip[2])}</p></div></div>
    </section>
    <section class="card" id="c-pow" aria-labelledby="h-pow">
      <h2 id="h-pow">${L('Энергия на сегодня','Power for today')} <span class="hint">${L('кВт·ч в день','kWh per day')}</span></h2>
      <div class="supply">
        <div><span>${L('Солнце','Sun')}: ${s.panels} ${L('пан.','panels')} × ${P.panel} × ${Math.round(i.sun*100)}%</span><b>${fmt(i.solar,0)}</b></div>
        ${s.reactor?`<div><span>${L('Ядерный реактор','Nuclear reactor')}</span><b>40</b></div>`:''}
        <div><span>${L('В батарее сейчас','In the battery now')}</span><b>${fmt(s.battery,0)} / ${s.batCap}</b></div>
      </div>
      ${sysHTML}
      ${i.dem.task?`<div class="sys"><div class="row"><span class="nm">${L('Бур (задание дня)','Drill (today’s task)')}</span><span class="kw">${i.dem.task} ${U.kwh()}</span></div></div>`:''}
      <div class="balance">
        <div class="bbar" aria-hidden="true"><span class="p" style="width:${i.prod/maxScale*100}%"></span><span class="d" style="left:calc(${Math.min(100,i.demand/maxScale*100)}% - 1px)"></span></div>
        <div class="bline"><span>${L('Выработка','Supply')} <b class="num">${fmt(i.prod,0)}</b> · ${L('расход','demand')} <b class="num">${fmt(i.demand,0)}</b></span>${balTxt}</div>
      </div>
    </section>
  </main>
  <section class="card actions" id="c-act" aria-labelledby="h-act">
    <h2 id="h-act">${L(`Задание экипажу на ${dn.toLowerCase()} ${s.day}`,`Crew task for ${dn.toLowerCase()} ${s.day}`)} <span class="hint">${L('одно в день','one per day')}</span></h2>
    <div class="acts">${acts}</div>
    <div class="endrow"><span class="sel">${L('Выбрано','Selected')}: <b>${esc(val(ACT[s.action].name,s))}</b></span>
      <button class="btn primary big" type="button" data-cmd="end" id="c-end">${L(`Завершить ${dn.toLowerCase()} ${s.day}`,`End ${dn.toLowerCase()} ${s.day}`)} →</button></div>
  </section>`;
  LAST_POW = (document.getElementById('c-pow')||{}).innerHTML || '';
  if(G3){ G3.mount(document.getElementById('sceneBox')); if(!G3.busy) G3.sync(s); stationPrompt(G3.near); } else drawScene();
  renderTutorial();
}
