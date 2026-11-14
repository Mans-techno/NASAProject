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
  if(t.dataset.stview){ showStart(t.dataset.stview); const f = modalRoot.querySelector(`[data-stview="${t.dataset.stview}"]`); if(f) setTimeout(()=>f.focus({preventScroll:true}), 40); if(innerWidth<=880){ const pn=modalRoot.querySelector('.st-panel'); if(pn) setTimeout(()=>pn.scrollIntoView({behavior:'smooth',block:'start'}), 60); } return; }
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
/* ---------- 3D starfield behind the menus: stars fly past, the Milky Way band turns slowly ----------
   Runs only while the start menu (or another full-screen window without the 3D base) is open, so it never
   competes with the game scene. Falls back to a still 2D sky without WebGL or with reduced motion. */
const SKY = (()=>{
  let cv = document.getElementById('bgstars');
  if(!cv){ cv = document.createElement('canvas'); cv.id='bgstars'; cv.setAttribute('aria-hidden','true'); document.body.prepend(cv); }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const T = window.THREE;
  function flat(){
    const dpr = Math.min(2, devicePixelRatio||1), w = innerWidth, h = innerHeight; cv.width = w*dpr; cv.height = h*dpr;
    const c = cv.getContext('2d'); if(!c) return; c.scale(dpr,dpr); const r = mulberry32(2024);
    for(let k=0;k<Math.round(w*h/2600);k++){ const x=r()*w, y=r()*h, s=r(); c.fillStyle=`rgba(${200+s*55|0},${215+s*40|0},255,${0.15+0.7*s*s})`; c.beginPath(); c.arc(x,y,s<0.96?0.5+s*0.7:1.5,0,Math.PI*2); c.fill(); }
  }
  let ren = null;
  try{ if(T && !still) ren = new T.WebGLRenderer({ canvas:cv, antialias:false, alpha:false, powerPreference:'low-power' }); }catch(e){ ren = null; }
  if(!ren){ flat(); window.addEventListener('resize', ()=>{ clearTimeout(flat.t); flat.t = setTimeout(flat, 150); }); return { wake(){} }; }

  ren.setPixelRatio(Math.min(1.5, devicePixelRatio||1)); ren.setClearColor(0x03050c, 1);
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(60, 1, 0.1, 2000);
  const rnd = mulberry32(4242);
  // a soft round dot, drawn once, used by every star
  const dot = document.createElement('canvas'); dot.width = dot.height = 64;
  { const g = dot.getContext('2d'), gr = g.createRadialGradient(32,32,0,32,32,32); gr.addColorStop(0,'rgba(255,255,255,1)'); gr.addColorStop(0.25,'rgba(255,255,255,.85)'); gr.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0,0,64,64); }
  const tex = new T.CanvasTexture(dot);
  const tints = [[0.75,0.82,1],[1,1,1],[1,0.92,0.8],[1,0.8,0.65],[0.7,0.8,1]];
  function layer(n, spread, depth, size, band){
    const pos = new Float32Array(n*3), col = new Float32Array(n*3);
    for(let k=0;k<n;k++){
      let x = (rnd()-0.5)*spread, y = (rnd()-0.5)*spread*0.7;
      if(band && rnd()<0.6){ const a = (rnd()-0.5)*spread; x = a; y = a*0.35 + (rnd()-0.5)*spread*0.08; } // a Milky Way strip
      pos[k*3] = x; pos[k*3+1] = y; pos[k*3+2] = -rnd()*depth;
      const t = tints[(rnd()*tints.length)|0], b = 0.55 + rnd()*0.45; col[k*3] = t[0]*b; col[k*3+1] = t[1]*b; col[k*3+2] = t[2]*b;
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos,3)); g.setAttribute('color', new T.BufferAttribute(col,3));
    const m = new T.PointsMaterial({ size, map:tex, vertexColors:true, transparent:true, depthWrite:false, blending:T.AdditiveBlending, sizeAttenuation:true });
    const p = new T.Points(g, m); scene.add(p); return { p, pos, depth };
  }
  const far = layer(5000, 1600, 900, 2.6, true);     // distant sky, slowly turning
  const near = layer(1400, 260, 300, 1.7, false);    // close stars that slowly fall past the camera
  // faint coloured nebula clouds
  const neb = [];
  [[0x5a6cff,-260,120,-700,520],[0xff6a8a,300,-90,-760,460],[0x3fd0c0,60,220,-820,420]].forEach(([c,x,y,z,sz])=>{
    const m = new T.SpriteMaterial({ map:tex, color:c, transparent:true, opacity:0.11, depthWrite:false, blending:T.AdditiveBlending });
    const sp = new T.Sprite(m); sp.position.set(x,y,z); sp.scale.set(sz,sz,1); scene.add(sp); neb.push(sp);
  });
  const shower = meteorShower(T, scene, { n:8, rate:1.4, w:0.01, len:2, dist:420, minEl:-0.15, maxEl:0.45, spreadAz:1.3 });
  let mx = 0, my = 0, tx = 0, ty = 0, running = false, last = 0, t0 = performance.now();
  addEventListener('pointermove', e=>{ tx = (e.clientX/innerWidth-0.5); ty = (e.clientY/innerHeight-0.5); }, {passive:true});
  function size(){ const w = innerWidth, h = innerHeight; ren.setSize(w, h, false); cam.aspect = w/h; cam.updateProjectionMatrix(); }
  size(); addEventListener('resize', size);
  // animate only while a full-screen menu covers the page and the 3D base is not on screen
  const wanted = ()=> !document.hidden && !!document.querySelector('.modal.start');
  function frame(now){
    if(!wanted()){ running = false; return; }
    const dt = Math.min(0.05, (now - last)/1000 || 0.016); last = now; const t = (now - t0)/1000;
    const a = near.pos;
    for(let k=0;k<a.length;k+=3){ a[k+1] -= dt*(10+(k%7)*2); a[k] += dt*3; a[k+2] += dt*6;
      if(a[k+1] < -150 || a[k+2] > 5){ a[k+1] += 300; a[k] = (Math.random()-0.5)*260; a[k+2] = -20-Math.random()*near.depth; } }
    shower.step(dt, cam, true);
    near.p.geometry.attributes.position.needsUpdate = true;
    far.p.rotation.z = t*0.006; far.p.rotation.y = Math.sin(t*0.05)*0.04;
    neb.forEach((n,i)=>{ n.material.opacity = 0.09 + 0.03*Math.sin(t*0.3 + i*2); });
    mx += (tx - mx)*0.04; my += (ty - my)*0.04;
    cam.rotation.set(-my*0.12, -mx*0.18, 0);
    ren.render(scene, cam);
    requestAnimationFrame(frame);
  }
  function wake(){ if(running || !wanted()) return; running = true; last = performance.now(); requestAnimationFrame(frame); }
  new MutationObserver(wake).observe(document.getElementById('modalRoot'), { childList:true });
  document.addEventListener('visibilitychange', wake);
  ren.render(scene, cam);
  return { wake };
})();
function start(data){
  if(data && data.S){ S = data.S; render(); if(S.over) showFinal(); }
  else {
    render(); showStart();
  }
}
window.claude?.hot?.snapshot?.(()=>({ S }));
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
/* expose for automated playtests */
window.__game = { G3, get busy(){ return BUSY; }, simulate, newState, PLANETS, ACTIONS, SOLAR, isDark, isFlare, flareOn, get S(){return S}, set S(v){S=v}, endDay, setLang, startMission, loadLive };
