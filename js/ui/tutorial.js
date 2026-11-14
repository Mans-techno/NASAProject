/* First-mission tutorial */
"use strict";
/* ============================================================
   TUTORIAL (first mission): highlight one area at a time
   ============================================================ */
let TUT = null;
const TUT_STEPS = [
  { sel:'#c-res', t:()=>L('Это запасы базы. Зелёное число показывает, сколько прибавится за день, жёлтое — сколько уйдёт. Самое важное: кислород и доза радиации.','These are the base’s supplies. Green shows what you gain each day, yellow what you lose. Most important: oxygen and radiation dose.') },
  { sel:'#c-pow', t:()=>L('Здесь ты делишь энергию. Нажимай проценты: каждая система берёт свою часть. Внизу видно, хватает ли энергии.','Here you split the power. Tap the percentages: each system takes its share. The bar at the bottom shows if there is enough.') },
  { sel:'#c-act', t:()=>L('Выбери одно задание на день. У каждого есть цена: запчасти, энергия или доза радиации, если выходить наружу.','Pick one task for the day. Each has a cost: spare parts, power, or radiation dose for going outside.') },
  { sel:'#c-scene', t:()=>L('Тут видна база и подсказки. Солнечные вспышки и тени предупреждают за день. Подготовься заранее!','Here you see the base and tips. Solar flares and shadows come with a day’s warning. Get ready early!') },
  { sel:'#c-end', t:()=>L('Нажми, чтобы прожить день и увидеть, что случилось. Удачи, командир!','Press to live through the day and see what happened. Good luck, commander!') },
];
function renderTutorial(){
  document.querySelectorAll('.coach').forEach(e=>e.classList.remove('coach'));
  const old = document.getElementById('coachbox'); if(old) old.remove();
  if(TUT===null || !S || modalRoot.innerHTML) return;
  const st = tutSteps()[TUT]; if(!st){ TUT = null; return; } const el = st.sel && document.querySelector(st.sel); if(el) el.classList.add('coach');
  const box = document.createElement('div'); box.id='coachbox'; box.className='coachbox'; box.setAttribute('role','dialog'); box.setAttribute('aria-label',L('Подсказка','Tip'));
  box.innerHTML = `<div class="cstep">${L('Обучение','Tutorial')} ${TUT+1} / ${tutSteps().length}</div><p>${esc(st.t())}</p><div class="row-btns"><button class="btn primary" type="button" data-cmd="tut-next">${TUT===tutSteps().length-1?L('Понятно!','Got it!'):L('Дальше','Next')}</button><button class="btn" type="button" data-cmd="tut-skip">${L('Пропустить','Skip')}</button></div>`;
  document.body.appendChild(box);
  if(el && !WALK){ if(!reduceMotion) el.scrollIntoView({block:'center', behavior:'smooth'}); else el.scrollIntoView({block:'center'}); }
}
function tutDone(){ TUT = null; try{ localStorage.setItem('outpost-tut','1'); }catch(e){} renderTutorial(); }
