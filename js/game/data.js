/* Real NASA data: planets, crew needs, archived solar storms */
"use strict";
/* ============================================================
   DATA — real-world anchors (see the "Science" screen)
   ============================================================ */
const CREW = 4;
const O2_PER = 0.84;          // kg O2 per person per day — NASA BVAD
const FOOD_PER = 1.8;         // kg food per person per day incl. packaging — NASA BVAD
const WATER_GROSS = 10;       // L per person per day: drinking, food prep, hygiene (simplified)
const RECOVERY = 0.90;        // ISS ECLSS ~93%, 98% since 2023
const O2_SYS_KWH = 20, O2_SYS_KG = 3.6, O2_WATER_PER_KG = 1.125; // electrolysis: 9 g water -> 8 g O2
const WATER_SYS_KWH = 8;
const GH_KWH = 12, GH_FOOD = 1.6, GH_O2 = 0.4;
const DOSE_LIMIT = 100;       // game mission limit, mSv
const SHIELD = [1, 0.7, 0.45, 0.3, 0.2]; // dose multiplier per regolith layer (~0.5 m each)
const BAT_START_CAP = 100, BAT_ADD = 60, O2_CAP = 60;
const SCIENCE_GOAL = 6;
const COMM_KWH = { moon:4, mars:10 }; // radio power at 100%: Mars is ~100-1000x farther, needs a stronger link

const PLANETS = {
  moon:{ id:'moon', name:{ru:'Луна',en:'Moon'}, base:{ru:'База «Шеклтон»',en:'Shackleton Base'}, where:{ru:'Южный полюс Луны, гребень кратера Шеклтон',en:'Lunar south pole, rim of Shackleton crater'},
    dayName:{ru:'День',en:'Day'}, days:20, panel:16, heat:16, cadetPanels:3, bgDose:1.37, flareMul:1, panels:5, parts:8,
    water:120, food:80, o2:30, darkName:{ru:'Тень от гор',en:'Mountain shadow'}, darkFactor:0.15, darkLen:2, cargo:[7,14],
    meteor:0.10, fail:0.07, dustRate:0, eva:0.8,
    science:{ru:'Взять керн льда со дна кратера',en:'Drill an ice core in the crater'}, scienceDesc:{ru:'+1 к науке. Лёд в вечной тени хранит историю Солнечной системы.',en:'+1 science. Ice in permanent shadow keeps a record of the Solar System.'},
    iceDesc:{ru:'+60 л воды из льда в затенённом кратере. Бур тратит 10 кВт·ч.',en:'+60 L of water from ice in a shadowed crater. The drill uses 10 kWh.'},
    accent:'#8fb8ff' },
  mars:{ id:'mars', name:{ru:'Марс',en:'Mars'}, base:{ru:'База «Утопия»',en:'Utopia Base'}, where:{ru:'Равнина Утопия, где под грунтом нашли лёд',en:'Utopia Planitia, where ice was found under the ground'},
    dayName:{ru:'Сол',en:'Sol'}, days:20, panel:14, heat:14, cadetPanels:3, bgDose:0.67, flareMul:0.6, panels:6, parts:12,
    water:150, food:90, o2:30, darkName:{ru:'Пылевая буря',en:'Dust storm'}, darkFactor:0.3, darkLen:5, cargo:[],
    meteor:0.03, fail:0.07, dustRate:0.025, eva:0.5,
    science:{ru:'Искать следы древней жизни',en:'Search for signs of ancient life'}, scienceDesc:{ru:'+1 к науке. Буровая проба из древних осадочных пород.',en:'+1 science. A drill sample from ancient sedimentary rock.'},
    iceDesc:{ru:'+60 л воды из подземного льда. Бур тратит 10 кВт·ч.',en:'+60 L of water from buried ice. The drill uses 10 kWh.'},
    accent:'#ff8a5c' }
};

/* ---------- Real solar events (archived, curated) ----------
   Flare class: NOAA/NASA flare records (DONKI from 2010). Proton storm (S-scale, peak >10 MeV flux in pfu):
   NOAA "Solar Proton Events Affecting the Earth Environment" list. Archived data, not live.
   Key lesson: radiation danger comes from the proton storm, not the flare's brightness. */
const SOLAR = [
  { date:'1972-08-04', cls:'≈X20', s:4, pfu:'≈70 000', ar:'MR 11976', dose:85, src:'NOAA · NASA', note:{ru:'Случилась между полётами «Аполлон-16» и «Аполлон-17». Будь астронавты в тот день на Луне, они получили бы опасную дозу.',en:'It happened between Apollo 16 and Apollo 17. Astronauts on the Moon that day would have received a dangerous dose.'} },
  { date:'1989-10-19', cls:'X13', s:4, pfu:'40 000', ar:'5747', dose:75, src:'NOAA', note:{ru:'Одна из сильнейших протонных бурь космической эры.',en:'One of the strongest proton storms of the space age.'} },
  { date:'2001-11-04', cls:'X1.0', s:4, pfu:'31 700', ar:'9684', dose:70, src:'NOAA', note:{ru:'Слабая вспышка класса X1, но огромная протонная буря. Яркость вспышки не говорит, насколько она опасна.',en:'Only an X1 flare, yet a huge proton storm. A flare’s brightness does not tell you how dangerous it is.'} },
  { date:'2003-10-28', cls:'X17', s:4, pfu:'29 500', ar:'10486', dose:70, src:'NOAA · NASA', note:{ru:'«Хеллоуинские бури». Экипаж МКС укрывался в самых защищённых отсеках станции.',en:'The “Halloween storms”. The ISS crew sheltered in the best-protected parts of the station.'} },
  { date:'2005-01-20', cls:'X7.1', s:3, pfu:'1 860', ar:'10720', dose:45, src:'NOAA', note:{ru:'Протоны пришли очень быстро и были очень энергичными: на подготовку почти не было времени.',en:'The protons arrived very fast and with very high energy, leaving almost no time to prepare.'} },
  { date:'2012-01-23', cls:'M8.7', s:3, pfu:'6 310', ar:'11402', dose:50, src:'NOAA · NASA DONKI', note:{ru:'Вспышка даже не класса X, а буря одна из самых сильных за десятилетие.',en:'Not even an X-class flare, yet one of the strongest proton storms of the decade.'} },
  { date:'2012-03-07', cls:'X5.4', s:3, pfu:'6 530', ar:'11429', dose:50, src:'NOAA · NASA DONKI', note:{ru:'Сильная протонная буря у Земли.',en:'A strong proton storm near Earth.'} },
  { date:'2017-09-10', cls:'X8.2', s:3, pfu:'1 490', ar:'12673', dose:45, src:'NOAA · NASA DONKI', note:{ru:'Её частицы долетели до Марса: прибор RAD на марсоходе Curiosity увидел резкий скачок дозы прямо на поверхности.',en:'Its particles reached Mars: the RAD instrument on the Curiosity rover saw the dose jump right on the surface.'} },
  { date:'2014-10-24', cls:'X3.1', s:0, pfu:'—', ar:'12192', dose:1, src:'NOAA · NASA DONKI', note:{ru:'Самая большая группа пятен за 24 года дала шесть вспышек класса X, но почти без протонов. Яркая вспышка ещё не значит опасная.',en:'The biggest sunspot group in 24 years fired six X-class flares but almost no protons. Bright does not mean dangerous.'} },
  { date:'2014-10-22', cls:'X1.6', s:0, pfu:'—', ar:'12192', dose:1, src:'NOAA · NASA DONKI', note:{ru:'Та же гигантская группа пятен 12192: вспышка без протонной бури.',en:'The same giant sunspot group 12192: a flare with no proton storm.'} },
];
const S_NAME = s => s===0 ? L('нет протонной бури','no proton storm') : `S${s}`;
function solarDate(d){ const [y,m,dd] = d.split('-').map(Number); return new Date(Date.UTC(y,m-1,dd)).toLocaleDateString(LANG==='en'?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric', timeZone:'UTC'}); }

/* ---------- Communication delay from real orbits (JPL approximate Keplerian elements, J2000) ---------- */
function helio(a,e,L0,Ldot,w,T){ const d2r=Math.PI/180; const M=((L0+Ldot*T-w)%360)*d2r; let E=M; for(let k=0;k<8;k++) E = E-(E-e*Math.sin(E)-M)/(1-e*Math.cos(E));
  const x=a*(Math.cos(E)-e), y=a*Math.sqrt(1-e*e)*Math.sin(E); const wr=w*d2r; return [x*Math.cos(wr)-y*Math.sin(wr), x*Math.sin(wr)+y*Math.cos(wr)]; }
function marsDistAU(date){ const T = (date.getTime()/86400000 + 2440587.5 - 2451545.0)/36525;
  const E = helio(1.00000261,0.01671123,100.46457166,35999.37244981,102.93768193,T);
  const M = helio(1.52371034,0.09339410,-4.55343205,19140.30268499,-23.94362959,T);
  return Math.hypot(M[0]-E[0], M[1]-E[1]); }
const MARS_AU = marsDistAU(new Date());
const DELAY_MARS = MARS_AU * 499.005 / 60;
function delayText(pid){ return pid==='moon' ? L('1,3 секунды','1.3 seconds') : L(`${Math.round(DELAY_MARS)} мин`, `${Math.round(DELAY_MARS)} min`); }

/* ---------- seeded RNG so a mission can be replayed in class ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function rint(rng,a,b){return a+Math.floor(rng()*(b-a+1))}

let LIVE = null; // {event, fetchedAt} when a real recent flare was fetched from NASA DONKI

function makeSchedule(pid, seed){
  const rng = mulberry32(seed*7919+13);
  // every mission gets at least one real proton storm; the other event may be a "bright but harmless" flare
  const storms = SOLAR.filter(x=>x.s>0);
  const a = storms[rint(rng,0,storms.length-1)];
  const rest = SOLAR.filter(x=>x!==a); const b = rest[rint(rng,0,rest.length-1)];
  const ev = rng()<0.5 ? [a,b] : [b,a];
  if(pid==='moon') return { dark:[rint(rng,5,8), rint(rng,12,15)], darkLens:[2,2], flares:[rint(rng,4,7), rint(rng,11,17)], ev };
  return { dark:[rint(rng,6,9), rint(rng,14,16)], darkLens:[5,3], flares:[rint(rng,4,7), rint(rng,12,17)], ev };
}
const DEMO_SEED = 7777;
function demoSchedule(pid){
  const big = SOLAR.find(x=>x.date==='2003-10-28'), quiet = SOLAR.find(x=>x.date==='2014-10-24');
  return pid==='moon' ? { dark:[5,13], darkLens:[2,2], flares:[3,9], ev:[big, quiet] } : { dark:[5,14], darkLens:[4,2], flares:[3,9], ev:[big, quiet] };
}

function newState(pid, seed, mode, opts={}){
  const P = PLANETS[pid];
  seed = seed || (Math.floor(Math.random()*9000)+1000);
  mode = mode || 'cadet';
  const sched = opts.demo ? demoSchedule(pid) : makeSchedule(pid, seed);
  if(opts.live && LIVE) sched.ev[0] = LIVE;
  return { pid, seed, mode, demo:!!opts.demo, day:1, battery:60, batCap:BAT_START_CAP, o2:P.o2, water:P.water, food:P.food, parts:P.parts,
    health:100, dose:0, science:0, data:0, leak:false, panels: mode==='cadet' ? P.cadetPanels : P.panels, gh:2, ghBroken:0, shield:1, reactor:false, recyclerBroken:false,
    dust:0, lv:{o2:100, water:100, heat:100, farm:100, comm:0}, action:'rest', sched,
    over:null, stats:{blackouts:0, coldDays:0, hungryDays:0, evas:0, flaresTaken:[], vented:0, wasted:0, builds:0, repairs:0},
    history:[], lastCause:null };
}

function darkLenAt(s, i){ return (s.sched.darkLens && s.sched.darkLens[i]) || PLANETS[s.pid].darkLen; }
function isDark(s, day){ return s.sched.dark.some((st,i)=> day>=st && day<st+darkLenAt(s,i)); }
function isFlare(s, day){ return s.sched.flares.includes(day); }
function flareOn(s, day){ const k = s.sched.flares.indexOf(day); return k<0 ? null : s.sched.ev[k]; }
function flareDose(s, day, shield){ const f = flareOn(s, day); if(!f) return 0; return f.dose * PLANETS[s.pid].flareMul * SHIELD[shield ?? s.shield]; }
