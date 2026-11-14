/* Keyboard and touch joystick */
"use strict";
document.addEventListener('keydown', e=>{
  if(!WALK || !G3 || modalRoot.innerHTML || BUSY) return;
  if(e.target.closest && e.target.closest('input,textarea')) return;
  if(MOVE_KEYS.has(e.code)){ G3.input.keys[e.code] = true; e.preventDefault(); }
  else if(e.code==='Space'){ e.preventDefault(); if(!e.repeat) G3.input.jump = true; }
  else if(e.code==='KeyV'){ toggleView(); }
  else if(e.code==='KeyQ'){ showPower('power'); }
  else if(e.code==='KeyE' || e.code==='Enter'){ if(G3.near){ e.preventDefault(); showStation(G3.near); } }
});
document.addEventListener('keyup', e=>{ if(G3) G3.input.keys[e.code] = false; });
window.addEventListener('blur', ()=>{ if(G3){ for(const k in G3.input.keys) G3.input.keys[k] = false; } });
let joyId = null, joyC = null;
document.addEventListener('pointerdown', e=>{ const j = e.target.closest && e.target.closest('#joy'); if(!j || !G3) return; joyId = e.pointerId; const r = j.getBoundingClientRect(); joyC = [r.left+r.width/2, r.top+r.height/2, r.width/2]; e.preventDefault(); joyMove(e); });
function joyMove(e){ if(e.pointerId!==joyId) return; let x = (e.clientX-joyC[0])/joyC[2], y = (e.clientY-joyC[1])/joyC[2]; const m = Math.hypot(x,y); if(m>1){ x/=m; y/=m; } G3.input.jx = x; G3.input.jy = -y; const k = document.querySelector('#joy span'); if(k) k.style.transform = `translate(${x*joyC[2]*0.6}px,${y*joyC[2]*0.6}px)`; }
document.addEventListener('pointermove', e=>{ if(joyId!==null) joyMove(e); });
const joyEnd = e=>{ if(e.pointerId!==joyId) return; joyId = null; if(G3){ G3.input.jx = 0; G3.input.jy = 0; } const k = document.querySelector('#joy span'); if(k) k.style.transform = ''; };
document.addEventListener('pointerup', joyEnd); document.addEventListener('pointercancel', joyEnd);
if(G3){ G3.hooks.near = stationPrompt; G3.hooks.tick = walkTick; G3.hooks.jump = onJump; G3.hooks.nojump = onNoJump; }
