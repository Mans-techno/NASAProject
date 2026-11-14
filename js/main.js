/* Start-up: buttons, language, first screen */
"use strict";
function harvest(){
  if(!S || S.over || S.mode==='cadet') return;
  const active = Math.max(0, S.gh - S.ghBroken); if(active<=0 || S.lv.farm<=0 || S.harvestDay===S.day) return;
  const kg = 0.4*active; S.food += kg; S.health = Math.min(100, S.health + 2); S.harvestDay = S.day;
  closeModal(); render();
  toast(L(`Урожай собран: +${fmt(kg)} кг свежих овощей и +2% к здоровью. Свежая еда поднимает настроение экипажа.`,`Harvest in: +${fmt(kg)} kg of fresh vegetables and +2% health. Fresh food lifts the crew’s mood.`), 'good');
}

function startMission(pid, seed, mode, opts={}){
  S = newState(pid, seed, mode || chosenMode, {live: useLive && !!LIVE && !opts.demo, ...opts});
  modalRoot.innerHTML=''; reopen = null;
  let seen = false; try{ seen = localStorage.getItem('outpost-tut')==='1'; }catch(e){}
  TUT = (opts.demo || !seen) ? 0 : null;
  SUIT.o2 = 100; SUIT.warned = false; SUIT.rad = 0;
  if(G3){ G3.setView('fp'); G3.teleport(6.5, 0, Math.PI/2); setWalk(true); syncView(); } else render();
  window.scrollTo({top:0});
}

document.addEventListener('change', e=>{ if(e.target.id==='useLive') useLive = e.target.checked; });
document.addEventListener('click', e=>{
  if(BUSY){ if(e.target.closest('#sceneBox') || e.target.closest('[data-cmd="skip"]')) G3 && G3.skip(); return; }
  const t = e.target.closest('button'); if(!t) return;
  if(t.dataset.replay!=null && S && G3){ const h = S.history[+t.dataset.replay]; if(h){ BUSY = true; document.body.classList.add('busy'); const box = document.getElementById('sceneBox'); if(box){ const r = box.getBoundingClientRect(); if(r.top<0||r.bottom>innerHeight) box.scrollIntoView({block:'center', behavior:'smooth'}); }
    G3.replay(h).then(()=>{ BUSY = false; document.body.classList.remove('busy'); }); } return; }
  if(t.dataset.start){ startMission(t.dataset.start, null, t.dataset.mode || chosenMode); return; }
  if(t.dataset.mode && !t.dataset.start){ chosenMode = t.dataset.mode; modalRoot.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed', String(b.dataset.mode===chosenMode))); return; }
  if(t.dataset.lv && S && !S.over){ S.lv[t.dataset.lv] = +t.dataset.v; render(); if(modalRoot.querySelector('.powmodal') && reopen) reopen(); return; }
  if(t.dataset.pick && S && !S.over){ S.action = t.dataset.pick; closeModal(); render(); toast(L(`Задание дня: ${val(ACT[S.action].name,S)}. Когда всё готово, ляг спать в спальном отсеке, чтобы закончить день.`,`Today’s task: ${val(ACT[S.action].name,S)}. When you are ready, go to sleep in the bunks to end the day.`), 'good'); return; }
  if(t.dataset.act && S && !S.over){ S.action = t.dataset.act; render(); return; }
  switch(t.dataset.cmd){
    case 'end': if(S && !S.over){ if(modalRoot.innerHTML){ modalRoot.innerHTML=''; reopen=null; } if(TUT!==null) tutDone(); SUIT.o2 = 100; endDay(); } break;
    case 'close': closeModal(); break;
    case 'interact': if(G3 && G3.near) showStation(G3.near); else toast(L('Подойди к светящемуся кругу или к члену экипажа','Walk up to a glowing ring or a crew member')); break;
    case 'walk': setWalk(true); break;
    case 'dash': modalRoot.innerHTML=''; reopen=null; setWalk(false); break;
    case 'power-open': showPower('power'); break;
    case 'view': toggleView(); break;
    case 'jump': if(G3) G3.input.jump = true; break;
    case 'harvest': harvest(); break;
    case 'run': if(G3){ G3.input.run = !G3.input.run; t.classList.toggle('on', G3.input.run); } break;
    case 'final': showFinal(); break;
    case 'replay': startMission(S.pid, S.seed, S.mode, {demo:S.demo}); break;
    case 'menu': case 'start': showStart(); break;
    case 'science': showScience(); break;
    case 'demo': chosenMode = 'cadet'; startMission('moon', DEMO_SEED, 'cadet', {demo:true}); break;
    case 'live-check': loadLive(); break;
    case 'tut-next': TUT++; if(TUT>=tutSteps().length) tutDone(); else renderTutorial(); break;
    case 'tut-skip': tutDone(); break;
    case 'lang': {
      setLang(LANG==='ru'?'en':'ru');
      const again = reopen;
      if(S) render();
      if(again) again(); else if(!S) showStart();
      break;
    }
  }
});
document.addEventListener('submit', e=>{
  if(e.target.id!=='codeForm') return; e.preventDefault();
  const v = (document.getElementById('mcode').value||'').trim().toUpperCase();
  const m = v.match(/^([LM])-?(\d{4})$/);
  if(!m){ document.getElementById('codeErr').textContent = L('Код выглядит так: буква L (Луна) или M (Марс), дефис и 4 цифры. Например M-1234.','A code looks like this: L (Moon) or M (Mars), a dash and 4 digits. For example M-1234.'); return; }
  startMission(m[1]==='L'?'moon':'mars', +m[2], chosenMode);
});
document.addEventListener('keydown', e=>{
  if(e.key==='Escape' && BUSY && G3){ G3.skip(); return; }
  if(e.key==='Escape' && modalRoot.innerHTML && S && !S.over){ closeModal(); }
  else if(e.key==='Escape' && TUT!==null){ tutDone(); }
});
let rz; window.addEventListener('resize', ()=>{ clearTimeout(rz); rz = setTimeout(()=>{ drawScene(); if(modalRoot.querySelector('canvas[data-preview]')) paintPreviews(); }, 80); });

/* ---------- boot (with hot-reload support in the artifact viewer) ---------- */
setLang(LANG);
function paintStars(){
  let cv = document.getElementById('bgstars');
  if(!cv){ cv = document.createElement('canvas'); cv.id='bgstars'; cv.setAttribute('aria-hidden','true'); document.body.prepend(cv); }
  const dpr = Math.min(2, devicePixelRatio||1), w = innerWidth, h = innerHeight; cv.width = w*dpr; cv.height = h*dpr;
  const c = cv.getContext('2d'); c.scale(dpr,dpr); const r = mulberry32(2024);
  for(let k=0;k<Math.round(w*h/2600);k++){ const x=r()*w, y=r()*h, s=r(); c.fillStyle=`rgba(${200+s*55|0},${215+s*40|0},255,${0.15+0.7*s*s})`; c.beginPath(); c.arc(x,y,s<0.96?0.5+s*0.7:1.5,0,Math.PI*2); c.fill(); }
}
paintStars(); window.addEventListener('resize', ()=>{ clearTimeout(paintStars.t); paintStars.t = setTimeout(paintStars, 150); });
function start(data){
  if(data && data.S){ S = data.S; render(); if(S.over) showFinal(); }
  else {
    let demo = false; try{ demo = new URLSearchParams(location.search).has('demo'); }catch(e){}
    if(demo) startMission('moon', DEMO_SEED, 'cadet', {demo:true}); else { render(); showStart(); }
  }
}
window.claude?.hot?.snapshot?.(()=>({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
/* expose for automated playtests */
window.__game = { G3, get busy(){ return BUSY; }, simulate, newState, PLANETS, ACTIONS, SOLAR, isDark, isFlare, flareOn, get S(){return S}, set S(v){S=v}, endDay, setLang, startMission, loadLive };
