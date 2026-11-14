/* Fallback 2D picture when WebGL is missing */
"use strict";
/* ============================================================
   SCENE (canvas)
   ============================================================ */
let anim = null, tAnim = 0;
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
function drawScene(){
  const cv = document.getElementById('scene'); if(!cv || !S) return;
  const dpr = Math.min(2, window.devicePixelRatio||1);
  const w = cv.clientWidth, h = cv.clientHeight; if(!w||!h) return;
  if(cv.width !== Math.round(w*dpr)){ cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const c = cv.getContext('2d'); c.setTransform(dpr,0,0,dpr,0,0);
  paintBase(c, w, h, S, tAnim);
  const storm = S.pid==='mars' && isDark(S,S.day);
  cancelAnimationFrame(anim);
  if(storm && !reduceMotion){ anim = requestAnimationFrame(t=>{ tAnim = t/1000; drawScene(); }); }
}
