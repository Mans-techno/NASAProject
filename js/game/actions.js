/* Crew tasks: one per day */
"use strict";
/* ============================================================
   ACTIONS — one crew task per day
   ============================================================ */
const ACTIONS = [
  { id:'rest', name:()=>L('Отдых и тренировки','Rest and exercise'), parts:0, desc:()=>L('+10 к здоровью. Тренажёры берегут мышцы и кости при низкой гравитации.','+10 health. Exercise protects muscles and bones in low gravity.') },
  { id:'science', name:s=>tr(PLANETS[s.pid].science), parts:0, eva:true, desc:s=>tr(PLANETS[s.pid].scienceDesc) + L(' Данные надо передать на Землю по радио.',' The data must be radioed to Earth.') },
  { id:'shield', name:()=>L('Насыпать слой реголита','Pile on a layer of regolith'), parts:0, eva:true, desc:()=>L('Грунт поверх жилого модуля ослабляет радиацию. Его не надо везти с Земли.','Soil over the habitat blocks radiation. No need to ship it from Earth.'),
    avail:s=> s.shield>=4 ? L('Уже 4 слоя','Already 4 layers') : null },
  { id:'panel', name:()=>L('Поставить солнечную панель','Install a solar panel'), parts:2, eva:true, desc:s=>L(`+${PLANETS[s.pid].panel} кВт·ч в день при ясном небе.`,`+${PLANETS[s.pid].panel} kWh per day under a clear sky.`) },
  { id:'battery', name:()=>L('Добавить аккумулятор','Add a battery'), parts:2, desc:()=>L(`+${BAT_ADD} кВт·ч к ёмкости. Запас на тень, бурю и ночь.`,`+${BAT_ADD} kWh of storage for shadow, storms and night.`) },
  { id:'greenhouse', eng:true, name:()=>L('Построить теплицу','Build a greenhouse'), parts:3, desc:()=>L(`+${fmt(GH_FOOD)} кг еды и +${fmt(GH_O2)} кг O₂ в день, но тратит ${GH_KWH} кВт·ч.`,`+${fmt(GH_FOOD)} kg food and +${fmt(GH_O2)} kg O₂ per day, but uses ${GH_KWH} kWh.`) },
  { id:'ice', eng:true, name:()=>L('Добыть лёд','Mine ice'), parts:0, eva:true, energy:10, desc:s=>tr(PLANETS[s.pid].iceDesc) },
  { id:'repair', name:()=>L('Ремонт','Repair'), parts:1, desc:s=> s.mode==='cadet' ? L('Заделать пробоину, через которую утекает воздух.','Patch the hole that is leaking air.') : L('Заделать пробоину и починить сломанное: теплицу или очистку воды.','Patch the hull and fix what is broken: greenhouse or water recycler.'),
    avail:s=> (s.ghBroken>0 || s.recyclerBroken || s.leak) ? null : L('Всё исправно','Nothing broken') },
  { id:'clean', name:()=>L('Очистить панели от пыли','Clean dust off the panels'), parts:0, eva:true, desc:()=>L('Пыль оседает на панелях и крадёт энергию.','Dust settles on the panels and steals power.'),
    avail:s=> s.dust<0.005 ? L('Панели чистые','Panels are clean') : null, only:'mars' },
  { id:'reactor', name:()=>L('Собрать ядерный реактор','Assemble a nuclear reactor'), parts:6, desc:()=>L('+40 кВт·ч каждый день: в тень, в бурю и ночью.','+40 kWh every day: in shadow, storms and at night.'),
    avail:s=> s.reactor ? L('Уже построен','Already built') : null },
];
const ACT = Object.fromEntries(ACTIONS.map(a=>[a.id,a]));
const val = (x,s)=> typeof x==='function' ? x(s) : tr(x);
function actionBlock(s, a){
  if(a.only && a.only!==s.pid) return 'hide';
  if(a.eng && s.mode==='cadet') return 'hide';
  const r = a.avail && a.avail(s); if(r) return r;
  if(a.parts > s.parts) return L(`Нужно запчастей: ${a.parts}`,`Needs ${a.parts} spare parts`);
  return null;
}
