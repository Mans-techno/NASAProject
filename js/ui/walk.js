/* Walk mode: HUD, work sites, crew, suit air */
"use strict";
/* ============================================================
   EVENTS
   ============================================================ */
/* ============================================================
   WALK MODE (game side): HUD, work sites, crew, suit survival
   ============================================================ */
let WALK = false, LAST_POW = '';
const SUIT = { o2:100, warned:false, rad:0, jumpTold:false };
const STATION_ACTS = {
  panels: ['panel','clean'], battery:['battery'], shield:['shield'], drill:['science','ice'], greenhouse:['greenhouse'], reactor:['reactor'], repair:['repair'], lab:['science'], med:['rest'], bunks:['rest'],
};
const CREW_INFO = [
  { name:()=>L('Аня','Anya'), role:()=>L('бортинженер','flight engineer') },
  { name:()=>L('Тимур','Timur'), role:()=>L('врач экипажа','crew doctor') },
  { name:()=>L('Лина','Lina'), role:()=>L('биолог','biologist') },
];
function setWalk(on){
  WALK = !!(on && G3 && S);
  document.body.classList.toggle('walk', WALK);
  if(G3) G3.setMode(WALK ? 'walk' : 'orbit');
  if(S) render();
  window.scrollTo({top:0});
}
function hudHTML(s, i){
  const P = PLANETS[s.pid], dn = tr(P.dayName);
  const bar = (k, label, v, max, col, txt) => `<div class="hb" data-k="${k}"><span class="hl">${label}</span><span class="hbar"><i style="width:${Math.max(0,Math.min(100,v/max*100))}%;background:${col}"></i></span><span class="hv">${txt}</span></div>`;
  const task = ACT[s.action];
  const flareNow = isFlare(s, s.day) && (flareOn(s,s.day)||{}).s > 0;
  const fp = G3 && G3.view==='fp';
  return `<div class="hud" id="hud">
    <div class="hud-tl">
      <div class="hud-day"><span>${dn}</span><b>${s.day}</b><span>/ ${P.days}</span><span class="hud-where" id="hudWhere">${G3 && G3.indoor ? L('внутри базы','inside the base') : L('снаружи','outside')}</span></div>
      ${bar('suit', L('Скафандр O₂','Suit O₂'), SUIT.o2, 100, SUIT.o2<25?'var(--bad)':'var(--o2)', `${Math.round(SUIT.o2)}%`)}
      ${bar('o2', L('База O₂','Base O₂'), s.o2, O2_CAP, 'var(--o2)', `${fmt(s.o2)} ${U.kg()}`)}
      ${bar('bat', L('Батарея','Battery'), s.battery, s.batCap, 'var(--power)', `${fmt(s.battery,0)} ${U.kwh()}`)}
      ${bar('hp', L('Здоровье','Health'), s.health, 100, 'var(--hp)', `${fmt(s.health,0)}%`)}
      ${bar('dose', L('Доза','Dose'), s.dose, DOSE_LIMIT, 'var(--rad)', `${fmt(s.dose)} ${U.msv()}`)}
      ${s.mode!=='cadet'?bar('food', L('Еда','Food'), s.food, 120, '#8ddc6a', `${fmt(s.food,0)} ${U.kg()}`):''}
      <div class="hud-sci">${L('Наука на Земле','Science at Earth')}: <b>${fmt(s.science)} / ${SCIENCE_GOAL}</b>${s.data>0.01?` · ${L('ждёт','waiting')} ${fmt(s.data)}`:''}</div>
    </div>
    <div class="hud-tr">
      <div class="hud-btns">
        <button class="btn" type="button" data-cmd="power-open" title="${L('Энергия (Q)','Power (Q)')}">${ic('bolt')}<span>${L('Энергия','Power')}</span></button>
        <button class="btn" type="button" data-cmd="view" title="${L('Вид (V)','View (V)')}">${ic('eye')}<span>${fp?L('3-е лицо','3rd person'):L('1-е лицо','1st person')}</span></button>
        <button class="btn" type="button" data-cmd="dash" title="${L('Журнал миссии','Mission log')}">${ic('log')}<span>${L('Журнал','Log')}</span></button>
        <button class="btn" type="button" data-cmd="science">${ic('flask')}<span>${L('Наука','Science')}</span></button>
        <button class="btn" type="button" data-cmd="menu">${L('Меню','Menu')}</button>
        ${langBtn()}
      </div>
      <canvas class="minimap" id="minimap" width="300" height="300" aria-label="${L('Карта базы','Base map')}" role="img"></canvas>
    </div>
    <div class="hud-task">${ic(ACT_ICON[s.action]||'star')} ${L('Задание дня','Today’s task')}: <b>${esc(val(task.name, s))}</b> · ${L('энергия','power')} ${fmt(i.prod,0)}/${fmt(i.demand,0)} ${U.kwh()}${i.blackout?` <span class="warnc">${L('не хватит!','short!')}</span>`:''}</div>
    <div class="hud-alert ${flareNow?'show':''}" id="hudAlert">${flareNow ? `${ic('rad')} ${L('Протонная буря! Снаружи опасно: уйди внутрь базы.','Proton storm! It is dangerous outside: get inside the base.')}` : ''}</div>
    <div class="crosshair" aria-hidden="true"></div>
    <div class="hud-prompt" id="hudPrompt" hidden></div>
    <div class="joy" id="joy" aria-hidden="true"><span></span></div>
    <button class="hud-act" type="button" data-cmd="interact" aria-label="${L('Действие','Action')}">E</button>
    <button class="hud-jump" type="button" data-cmd="jump" aria-label="${L('Прыжок','Jump')}">${ic('jump')}</button>
    <button class="hud-run" type="button" data-cmd="run" aria-label="${L('Бег','Run')}">${ic('run')}</button>
    <div class="hud-help">${L('WASD: идти · Shift: бег · Пробел: прыжок · E: действие · V: вид · Q: энергия · мышь: осмотреться (клик: захват, Esc: отпустить)','WASD: walk · Shift: run · Space: jump · E: action · V: view · Q: power · mouse: camera · click: capture mouse, Esc: release')}</div>
  </div>`;
}
const STATION_NAME = {
  door:()=>L('Шлюз базы','Base airlock'), battery:()=>L('Батарейный блок','Battery bank'), panels:()=>L('Солнечное поле','Solar field'),
  shield:()=>L('Карьер реголита','Regolith quarry'), drill:()=>L('Буровая площадка','Drill site'), radio:()=>L('Антенна связи','Radio antenna'), greenhouse:()=>L('Теплица','Greenhouse'), reactor:()=>L('Площадка реактора','Reactor pad'),
  repair:()=>L('Шкаф с инструментами','Tool locker'), bunks:()=>L('Спальные места','Crew bunks'), comms:()=>L('Пост связи','Comms desk'), med:()=>L('Медотсек','Medical bay'), lab:()=>L('Лаборатория','Laboratory'), rover:()=>L('Ровер','Rover'),
};
function stationLabel(id){ if(!id) return ''; if(id.startsWith('npc')){ const c = CREW_INFO[+id.slice(3)]; return c ? `${c.name()}, ${c.role()}` : ''; } return (STATION_NAME[id]||(()=>id))(); }
function stationPrompt(id){
  const el = document.getElementById('hudPrompt'); if(!el) return;
  if(!id || !S){ el.hidden = true; return; }
  el.hidden = false; el.innerHTML = id==='rover' ? `<kbd>E</kbd> ${G3 && G3.driving ? L('Выйти из ровера','Get out of the rover') : L('Сесть в ровер','Drive the rover')}` : `<kbd>E</kbd> ${id.startsWith('npc')?L('Поговорить: ','Talk: '):''}${esc(stationLabel(id))}`;
}
let hudT = 0, mapT = 0;
function hudLive(){
  const hud = document.getElementById('hud'); if(!hud || !S) return;
  const set = (k, v, max, txt, col) => { const b = hud.querySelector(`.hb[data-k="${k}"]`); if(!b) return; const i = b.querySelector('i'); i.style.width = Math.max(0,Math.min(100,v/max*100))+'%'; if(col) i.style.background = col; b.querySelector('.hv').textContent = txt; };
  set('suit', SUIT.o2, 100, `${Math.round(SUIT.o2)}%`, SUIT.o2<25?'var(--bad)':'var(--o2)');
  set('dose', S.dose, DOSE_LIMIT, `${fmt(S.dose)} ${U.msv()}`);
  set('hp', S.health, 100, `${fmt(S.health,0)}%`);
  const wh = document.getElementById('hudWhere'); if(wh && G3) wh.textContent = G3.driving ? L('за рулём ровера','driving the rover') : G3.indoor ? L('внутри базы','inside the base') : L('снаружи','outside');
}
function drawMinimap(){
  const cv = document.getElementById('minimap'); if(!cv || !G3) return; const d = G3.mapData(); if(!d) return;
  const c = cv.getContext('2d'), W = cv.width, sc = W/150, cx = W/2, cy = W/2;   // 150 m across, centred on the player, north up
  const X = x => cx + (x - d.pl.x)*sc, Y = z => cy + (z - d.pl.z)*sc;
  c.clearRect(0,0,W,W); c.save(); c.beginPath(); c.arc(cx,cy,W/2-2,0,Math.PI*2); c.clip();
  c.fillStyle = 'rgba(6,10,22,.78)'; c.fillRect(0,0,W,W);
  c.strokeStyle = 'rgba(220,230,255,.85)'; c.fillStyle = 'rgba(160,180,220,.28)'; c.lineWidth = 3;
  const circ = (x,z,r)=>{ c.beginPath(); c.arc(X(x),Y(z),r*sc,0,Math.PI*2); c.fill(); c.stroke(); };
  const rect = (x0,z0,x1,z1)=>{ c.fillRect(X(x0),Y(z0),(x1-x0)*sc,(z1-z0)*sc); c.strokeRect(X(x0),Y(z0),(x1-x0)*sc,(z1-z0)*sc); };
  rect(10.8,-1.6,24,1.6); rect(-24.8,-1.6,-10.8,1.6); rect(-1.6,-20.8,1.6,-10.8); rect(-11.4,-27.4,11.4,-20.6);
  circ(0,0,11); circ(-33.4,0,9);
  for(const s of d.st){ c.fillStyle = s.col; c.beginPath(); c.arc(X(s.x),Y(s.z),5,0,Math.PI*2); c.fill(); }
  c.fillStyle = '#ffd35a'; for(const n of d.crew){ c.beginPath(); c.arc(X(n.x),Y(n.z),4,0,Math.PI*2); c.fill(); }
  c.restore();
  c.save(); c.translate(cx,cy); c.rotate(Math.PI - d.pl.yaw); c.fillStyle = '#ff8a5c'; c.strokeStyle = '#fff'; c.lineWidth = 2;
  c.beginPath(); c.moveTo(0,-13); c.lineTo(9,10); c.lineTo(0,5); c.lineTo(-9,10); c.closePath(); c.fill(); c.stroke(); c.restore();
  c.strokeStyle = 'rgba(143,184,255,.7)'; c.lineWidth = 3; c.beginPath(); c.arc(cx,cy,W/2-2,0,Math.PI*2); c.stroke();
}
function walkTick(dt, info){
  if(!WALK || !S || S.over || BUSY || modalRoot.innerHTML) return;
  const storm = isFlare(S, S.day) && (flareOn(S,S.day)||{}).s > 0;
  if(info.indoor){ SUIT.o2 = Math.min(100, SUIT.o2 + 35*dt); SUIT.warned = false; }   // pressurised: the suit tops up from the base supply
  else {
    SUIT.o2 -= dt * 100/150 * (S.pid==='mars' && isDark(S,S.day) ? 1.3 : 1);   // ~2.5 minutes of air per trip outside
    if(storm){ const d = dt * 0.25 * PLANETS[S.pid].flareMul; S.dose += d; SUIT.rad += d; }
  }
  if(SUIT.o2 < 25 && !SUIT.warned){ SUIT.warned = true; toast(L('Мало кислорода в скафандре! Вернись внутрь базы через шлюз.','Suit oxygen low! Get back inside through the airlock.'), 'bad'); }
  if(SUIT.o2 <= 0){
    SUIT.o2 = 100; S.health = Math.max(0, S.health - 10);
    if(G3) G3.teleport(21, 0, -Math.PI/2);
    if(S.health <= 0){ S.over = 'health'; S.lastCause = 'cold'; render(); showFinal(); return; }
    openModal(`<div class="eyebrow">${L('Авария','Emergency')}</div><h2>${L('Кислород в скафандре закончился','Your suit ran out of oxygen')}</h2>
      <p class="lead">${L('Экипаж увидел сигнал тревоги и затащил тебя в шлюз. Ты цел, но здоровье −10%.','The crew saw the alarm and pulled you into the airlock. You are OK, but health −10%.')}</p>
      <div class="why"><b>${L('Почему так?','Why?')}</b>${L('Запаса в настоящем скафандре NASA хватает примерно на 8 часов работы снаружи. Астронавты всё время следят за ним и возвращаются заранее.','A real NASA spacesuit holds about 8 hours of air for a spacewalk. Astronauts watch it constantly and head back early.')}</div>
      <div class="row-btns"><button class="btn primary" type="button" data-cmd="close" data-focus>${L('Понятно','Got it')}</button></div>`, L('Авария','Emergency'));
    render(); return;
  }
  if(S.dose >= DOSE_LIMIT){ S.over = 'dose'; render(); showFinal(); return; }
  hudT += dt; if(hudT > 0.2){ hudT = 0; hudLive(); }
  mapT += dt; if(mapT > 0.12){ mapT = 0; drawMinimap(); }
}
function onJump(){
  if(SUIT.jumpTold || !S) return; SUIT.jumpTold = true;
  toast(S.pid==='mars'
    ? L('Прыжок на Марсе: гравитация 3,71 м/с², это 38% земной. Ты подпрыгнешь примерно в 2,6 раза выше, чем дома.','A jump on Mars: gravity is 3.71 m/s², 38% of Earth’s. You jump about 2.6 times higher than at home.')
    : L('Прыжок на Луне: гравитация 1,62 м/с², это 1/6 земной. Прыжок в 6 раз выше и длится в 6 раз дольше.','A jump on the Moon: gravity is 1.62 m/s², 1/6 of Earth’s. You jump 6 times higher and stay up 6 times longer.'), 'good');
}
let noJumpT = 0;
function onNoJump(){
  if(!S || SUIT.inJumpTold) return; SUIT.inJumpTold = true;
  toast(L('Внутри базы в игре прыжок как на Земле: так удобнее в тесных комнатах. На настоящей базе гравитация внутри такая же, как снаружи. Выйди наружу и прыгни, чтобы почувствовать настоящую.','Inside the base the game uses an Earth-like jump, which suits the cramped rooms. On a real base gravity inside is the same as outside. Step outside and jump to feel the real thing.'));
}
function toggleDrive(){
  if(!G3) return;
  if(G3.driving){ if(!G3.drive(false)) toast(L('Тут не выйти: отъедь от камней и стен.','No room to get out here: drive away from rocks and walls.')); }
  else if(G3.drive(true)){
    toast(L('Ты за рулём! W/S или ↑/↓ — газ и тормоз, A/D — руль, Shift — быстрее, пробел — тормоз, E — выйти. Настоящий лунный ровер Apollo ездил до 13 км/ч, в игре он быстрее.','You are driving! W/S or ↑/↓ — throttle and brake, A/D — steer, Shift — faster, Space — brake, E — get out. The real Apollo rover went up to 13 km/h; in the game it is faster.'), 'good');
  }
  stationPrompt(G3.near);
}
function toast(msg, tone=''){
  let t = document.getElementById('toast'); if(!t){ t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role','status'); document.body.appendChild(t); }
  t.className = 'toast show ' + tone; t.textContent = msg; clearTimeout(toast.h); toast.h = setTimeout(()=>{ t.className = 'toast'; }, 4200);
}
function actButtons(ids){
  const s = S, P = PLANETS[s.pid];
  return ids.map(id=>{ const a = ACT[id]; if(!a) return ''; const b = actionBlock(s,a); if(b==='hide') return '';
    const chips = []; if(a.parts) chips.push(`<span class="chip">${a.parts} ${L(plural(a.parts,'запчасть','запчасти','запчастей'), a.parts===1?'part':'parts')}</span>`); if(a.energy) chips.push(`<span class="chip">${a.energy} ${U.kwh()}</span>`); if(a.eva) chips.push(`<span class="chip eva">${L('выход','EVA')}: +${fmt(P.eva)} ${U.msv()}</span>`); if(b) chips.push(`<span class="chip why">${b}</span>`);
    return `<button type="button" class="act" data-pick="${id}" aria-pressed="${s.action===id}" ${b?'disabled':''}><span class="an">${ic(ACT_ICON[id]||'star')} ${esc(val(a.name,s))}</span><span class="ad">${esc(val(a.desc,s))}</span><span class="ac">${chips.join('')}</span></button>`; }).join('');
}
const STATION_FACT = {
  door:()=>L('Шлюз выравнивает давление, чтобы воздух базы не уходил наружу. Внутри базы скафандр заправляется сам.','The airlock equalises pressure so the base keeps its air. Inside the base your suit refills by itself.'),
  battery:()=>L('Аккумуляторы запасают энергию на тень, бурю и ночь.','Batteries store power for shadow, storms and night.'),
  panels:()=>L('Солнечные панели дают энергию, пока светит Солнце. На Марсе их покрывает пыль.','Solar panels make power while the Sun shines. On Mars, dust covers them.'),
  shield:()=>L('Грунт поверх жилого купола — лучшая защита от протонных бурь. Его не надо везти с Земли.','Soil piled over the dome is the best protection from proton storms. It does not have to come from Earth.'),
  drill:()=>L('Здесь бурят лёд и берут пробы для науки.','Here the crew drills for ice and samples for science.'),
  greenhouse:()=>L('Растения дают еду и немного кислорода. Им нужен свет фитоламп. На МКС астронавты уже выращивали салат в установке Veggie.','Plants give food and a little oxygen. They need grow lights. On the ISS, astronauts have already grown lettuce in the Veggie unit.'),
  reactor:()=>L('Небольшой ядерный реактор работает в тени и в бурю. Его ставят подальше от жилого модуля.','A small nuclear reactor works in shadow and storms. It is set up well away from the habitat.'),
  repair:()=>L('Здесь лежат запчасти и инструменты для ремонта.','Spare parts and repair tools are kept here.'),
  bunks:()=>L('Сон — тоже работа: без отдыха экипаж ошибается. Ляг спать, чтобы закончить день.','Sleep is part of the job: a tired crew makes mistakes. Go to sleep to end the day.'),
  med:()=>L('Медотсек следит за здоровьем и дозой радиации каждого члена экипажа.','The medical bay tracks every crew member’s health and radiation dose.'),
  lab:()=>L('В лаборатории изучают пробы. Наука засчитывается, только когда данные дошли до Земли по радио.','The lab studies the samples. Science only counts once the data reaches Earth by radio.'),
};
function showStation(id){
  if(!S || S.over) return;
  if(id==='rover'){ toggleDrive(); return; }
  if(id.startsWith('npc')){ showCrew(+id.slice(3)); return; }
  if(id==='radio' || id==='comms'){ showPower('radio'); return; }
  const dn = tr(PLANETS[S.pid].dayName).toLowerCase(), eng = S.mode!=='cadet';
  let body = '';
  const endBtn = `<button class="btn primary big" type="button" data-cmd="end" data-focus>${ic('bed')} ${L(`Лечь спать и закончить ${dn} ${S.day}`,`Go to sleep and end ${dn} ${S.day}`)}</button>`;
  if(id==='door' || id==='bunks'){
    body = `<div class="acts">${actButtons(id==='door'?['rest','repair']:['rest'])}</div>
      <div class="row-btns">${endBtn}<button class="btn" type="button" data-cmd="power-open">${ic('bolt')} ${L('Энергия','Power')}</button></div>
      <p class="note">${L(`Задание дня сейчас: ${val(ACT[S.action].name,S)}. Экипаж выполнит его, когда ты закончишь день.`,`Today’s task: ${val(ACT[S.action].name,S)}. The crew carries it out when you end the day.`)}</p>`;
  } else if(id==='med'){
    body = `<div class="medrow"><div><b>${fmt(S.health,0)}%</b><span>${L('здоровье экипажа','crew health')}</span></div><div><b>${fmt(S.dose)} ${U.msv()}</b><span>${L(`доза из ${DOSE_LIMIT} за миссию`,`dose out of ${DOSE_LIMIT} for the mission`)}</span></div><div><b>${fmt(SUIT.rad,2)} ${U.msv()}</b><span>${L('из них за твои выходы в бурю','of it from your walks in a storm')}</span></div></div>
      <div class="acts">${actButtons(['rest'])}</div><p class="note">${L('Отдых и тренировки возвращают здоровье. В низкой гравитации кости и мышцы слабеют, поэтому на МКС тренируются около 2 часов в день.','Rest and exercise restore health. In low gravity bones and muscles weaken, so ISS astronauts exercise about 2 hours a day.')}</p>`;
  } else if(id==='greenhouse'){
    const active = Math.max(0, S.gh - S.ghBroken), canH = eng && active>0 && S.lv.farm>0 && S.harvestDay !== S.day;
    const why = !eng ? L('Урожай считается в режиме «Инженер».','Harvests count in Engineer mode.') : active<=0 ? L('Сначала построй грядку.','Build a grow bed first.') : S.lv.farm<=0 ? L('Включи свет теплицы в разделе «Энергия».','Turn on the greenhouse lights under Power.') : S.harvestDay===S.day ? L('Сегодня урожай уже собран.','Today’s harvest is already in.') : '';
    body = `<div class="acts">${eng?actButtons(['greenhouse']):''}</div>
      <div class="row-btns"><button class="btn primary" type="button" data-cmd="harvest" ${canH?'':'disabled'}>${ic('basket')} ${L('Собрать урожай','Harvest')}</button>${eng?`<span class="note">${L(`Грядок работает: ${active}`,`Beds working: ${active}`)}</span>`:''}</div>
      ${why?`<p class="note">${why}</p>`:''}`;
  } else if(id==='lab'){
    body = `<div class="medrow"><div><b>${fmt(S.science)} / ${SCIENCE_GOAL}</b><span>${L('наука дошла до Земли','science received on Earth')}</span></div><div><b>${fmt(S.data)}</b><span>${L('данных ждут отправки','data waiting to send')}</span></div><div><b>${delayText(S.pid)}</b><span>${L('сигнал идёт до Земли','signal time to Earth')}</span></div></div>
      <div class="acts">${actButtons(['science'])}</div>
      <div class="row-btns"><button class="btn" type="button" data-cmd="science">${ic('flask')} ${L('Какие данные NASA в игре','Which NASA data is in the game')}</button></div>`;
  } else {
    body = `<div class="acts">${actButtons(STATION_ACTS[id]||[])}</div><p class="note">${L('Выбери задание на сегодня (одно в день). Потом вернись на базу и ляг спать, чтобы закончить день.','Pick today’s task (one a day). Then go back inside and go to sleep to end the day.')}</p>`;
  }
  openModal(`<div class="toprow"><div class="eyebrow">${esc(STATION_NAME[id]())}</div><button class="btn" type="button" data-cmd="close" aria-label="${L('Закрыть','Close')}">${ic('close')}</button></div>
    <p class="lead">${esc((STATION_FACT[id]||(()=>''))())}</p>${body}`, STATION_NAME[id](), ()=>showStation(id));
}
function crewLine(k){
  const s = S, pv = simulate(s), tip = engineerTip(s, pv);
  const lines = [
    [L('Я слежу за энергией.','I keep an eye on the power.'), tip ? tip[2] : ''],
    [L('Я врач. Вот что я вижу:','I am the doctor. Here is what I see:'), s.dose > DOSE_LIMIT*0.6 ? L('Доза уже большая. Побольше реголита над куполом, и в бурю никто не выходит.','The dose is getting high. More regolith over the dome, and nobody goes out in a storm.') : s.health < 60 ? L('Экипаж устал. Дай день отдыха и тренировок.','The crew is tired. Give us a day of rest and exercise.') : L('Все здоровы. Помни: в бурю безопаснее всего под толстым слоем грунта.','Everyone is healthy. Remember: in a storm the safest place is under thick soil.')],
    [L('Я отвечаю за теплицу.','I run the greenhouse.'), s.mode==='cadet' ? L('Пока мы едим запасы с Земли. В режиме «Инженер» теплица кормит экипаж.','For now we eat supplies from Earth. In Engineer mode the greenhouse feeds the crew.') : s.gh<=0 ? L('Построй грядку: каждая даёт 1,6 кг еды и немного кислорода в день.','Build a grow bed: each gives 1.6 kg of food and some oxygen a day.') : L(`Работает грядок: ${Math.max(0,s.gh-s.ghBroken)}. Не забудь собрать урожай!`,`Beds working: ${Math.max(0,s.gh-s.ghBroken)}. Don’t forget to harvest!`)],
  ];
  return lines[k] || ['',''];
}
function showCrew(k){
  const c = CREW_INFO[k]; if(!c) return; const [a,b] = crewLine(k);
  openModal(`<div class="toprow"><div class="eyebrow">${ic('crew')} ${esc(c.name())} · ${esc(c.role())}</div><button class="btn" type="button" data-cmd="close" aria-label="${L('Закрыть','Close')}">${ic('close')}</button></div>
    <p class="lead">«${esc(a)}${b?' '+esc(b):''}»</p>
    <div class="row-btns"><button class="btn primary" type="button" data-cmd="close" data-focus>${L('Спасибо!','Thanks!')}</button></div>`, c.name(), ()=>showCrew(k));
}
function showPower(focus){
  openModal(`<div class="toprow"><div class="eyebrow">${focus==='radio'?L('Связь с Землёй','Link to Earth'):L('Энергия на сегодня','Power for today')}</div><button class="btn" type="button" data-cmd="close" data-focus aria-label="${L('Закрыть','Close')}">${ic('close')}</button></div>
    ${focus==='radio'?`<p class="lead">${L(`Наука засчитывается, только когда данные дошли до Земли. Сигнал идёт ${delayText(S.pid)}. Включи радио, если есть данные.`,`Science only counts once the data reaches Earth. The signal takes ${delayText(S.pid)}. Turn the radio on if data is waiting.`)}</p>`:''}
    <div class="powmodal">${LAST_POW}</div>`, L('Энергия','Power'), ()=>showPower(focus));
}
const WALK_TUT = [
  { sel:null, t:()=>L('Ты командир базы и стоишь внутри жилого купола. Ходи клавишами WASD (на телефоне — джойстик слева), мышью крути камеру. V — вид от первого лица.','You are the base commander, standing inside the habitat dome. Walk with WASD (on a phone, the joystick on the left) and drag to turn the camera. V switches to first person.') },
  { sel:null, t:()=>L('Пробел — прыжок. На Луне и Марсе гравитация слабее, чем на Земле, поэтому прыжок выше и дольше. Попробуй!','Space jumps. Gravity on the Moon and Mars is weaker than on Earth, so you jump higher and stay up longer. Try it!') },
  { sel:null, t:()=>L('Светящиеся круги — рабочие места. Подойди и нажми E, чтобы выбрать задание дня. С экипажем тоже можно поговорить.','Glowing rings are work sites. Walk up and press E to pick today’s task. You can talk to the crew too.') },
  { sel:null, t:()=>L('Наружу ведёт шлюз на востоке. Снаружи следи за кислородом скафандра, а в протонную бурю сразу уходи внутрь.','The airlock to the east leads outside. Out there, watch your suit oxygen, and in a proton storm get back inside at once.') },
  { sel:null, t:()=>L('Энергию делят кнопкой «Энергия» (Q). Когда всё готово, ляг спать в спальном отсеке: экипаж выполнит задание. Продержись 20 дней!','Split the power with the Power button (Q). When everything is ready, go to sleep in the bunks: the crew does the task. Survive 20 days!') },
];
function tutSteps(){ return document.body.classList.contains('walk') ? WALK_TUT : TUT_STEPS; }
/* keyboard + joystick */
const MOVE_KEYS = new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight']);
function syncView(){ if(!G3) return; document.body.classList.toggle('fpv', G3.view==='fp'); const b = document.querySelector('[data-cmd="view"] span'); if(b) b.textContent = G3.view==='fp' ? L('3-е лицо','3rd person') : L('1-е лицо','1st person'); }
function toggleView(){ if(!G3) return; G3.setView(G3.view==='fp' ? 'tp' : 'fp'); syncView(); }
