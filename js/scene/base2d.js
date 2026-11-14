/* 2D drawing of the base for the fallback scene */
"use strict";
function paintBase(c, w, h, s, t){
  const mars = s.pid==='mars', dark = isDark(s, s.day);
  const rng = mulberry32(42);
  const g = c.createLinearGradient(0,0,0,h);
  if(mars){ if(dark){ g.addColorStop(0,'#5a3622'); g.addColorStop(1,'#a0613a'); } else { g.addColorStop(0,'#1c1420'); g.addColorStop(.6,'#6b3b2a'); g.addColorStop(1,'#c27a4f'); } }
  else { g.addColorStop(0,'#000003'); g.addColorStop(1,'#05070f'); }
  c.fillStyle = g; c.fillRect(0,0,w,h);
  if(!mars || !dark){ for(let k=0;k<140;k++){ const x=rng()*w, y=rng()*h*0.62, r=rng()*1.2+0.2; c.fillStyle=`rgba(255,255,255,${mars?0.25*rng():0.35+0.6*rng()})`; c.fillRect(x,y,r,r);} } else { for(let k=0;k<140;k++) rng(); }
  if(!mars){ c.fillStyle='#2f6fcf'; c.beginPath(); c.arc(w*0.82, h*0.2, h*0.055, 0, Math.PI*2); c.fill(); c.fillStyle='rgba(255,255,255,.65)'; c.beginPath(); c.arc(w*0.82-h*0.012, h*0.2-h*0.015, h*0.022, 0, Math.PI*2); c.fill(); }
  const sunY = mars ? h*0.22 : h*0.5, sunX = mars ? w*0.18 : w*0.08;
  const sunA = dark ? (mars?0.25:0) : 1;
  if(sunA>0){ const sg = c.createRadialGradient(sunX,sunY,0,sunX,sunY,h*0.18); sg.addColorStop(0,`rgba(255,246,220,${sunA})`); sg.addColorStop(.15,`rgba(255,236,190,${sunA*0.8})`); sg.addColorStop(1,'rgba(255,220,160,0)'); c.fillStyle=sg; c.fillRect(0,0,w,h); }
  c.fillStyle = mars ? (dark?'#7a4a30':'#8e4f33') : '#2a2c33';
  c.beginPath(); c.moveTo(0,h*0.62); for(let x=0;x<=w;x+=w/24){ c.lineTo(x, h*0.6 - Math.sin(x/w*7+1)*h*0.03 - Math.sin(x/w*17)*h*0.012 - (mars?0:Math.max(0,Math.sin(x/w*3.2))*h*0.06)); } c.lineTo(w,h); c.lineTo(0,h); c.fill();
  const gg = c.createLinearGradient(0,h*0.62,0,h);
  if(mars){ gg.addColorStop(0, dark?'#8a5536':'#a65b37'); gg.addColorStop(1, dark?'#5a3522':'#6e3820'); } else { gg.addColorStop(0,'#5d606a'); gg.addColorStop(1,'#33353c'); }
  c.fillStyle = gg; c.beginPath(); c.moveTo(0,h*0.7); for(let x=0;x<=w;x+=w/30){ c.lineTo(x, h*0.69 + Math.sin(x/w*11)*h*0.008); } c.lineTo(w,h); c.lineTo(0,h); c.fill();
  for(let k=0;k<26;k++){ const x=rng()*w, y=h*0.74+rng()*h*0.25, r=(rng()*0.02+0.004)*w; c.fillStyle= mars?'rgba(60,25,10,.35)':'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x,y,r,r*0.3,0,0,Math.PI*2); c.fill(); }
  const base = h*0.78;
  const S2 = Math.min(w/16, h/8.4);
  const nP = Math.min(s.panels, 16);
  for(let k=0;k<nP;k++){
    const col = k%4, row = Math.floor(k/4);
    const x = w*0.04 + col*S2*1.55 + row*S2*0.35, y = base - row*S2*0.42 + S2*0.2;
    c.fillStyle='#555a66'; c.fillRect(x+S2*0.55, y-S2*0.1, S2*0.08, S2*0.45);
    c.save(); c.translate(x, y-S2*0.55); c.transform(1,0,-0.25,1,0,0);
    const pg = c.createLinearGradient(0,0,S2*1.3,S2*0.6); pg.addColorStop(0, '#2b4c9a'); pg.addColorStop(1, '#16285a');
    c.fillStyle = pg; c.fillRect(0,0,S2*1.3,S2*0.55);
    c.strokeStyle='rgba(180,200,255,.35)'; c.lineWidth=1; for(let q=1;q<4;q++){ c.beginPath(); c.moveTo(q*S2*1.3/4,0); c.lineTo(q*S2*1.3/4,S2*0.55); c.stroke(); }
    if(s.dust>0){ c.fillStyle=`rgba(190,110,70,${s.dust*1.6})`; c.fillRect(0,0,S2*1.3,S2*0.55); }
    if(!dark){ c.fillStyle='rgba(255,255,255,.12)'; c.fillRect(0,0,S2*1.3,S2*0.12); }
    c.restore();
  }
  const hx = w*0.5, hy = base, hw = S2*3.4, hh = S2*1.3;
  for(let Ly=s.shield; Ly>=1; Ly--){
    const e = Ly*S2*0.22;
    c.fillStyle = mars ? ['#7e4126','#8a4a2c','#955233','#a05a39'][Ly-1] : ['#4a4c54','#55575f','#5f626a','#6a6d75'][Ly-1];
    c.beginPath(); c.ellipse(hx, hy, hw/2+e+S2*0.3, hh+e, 0, Math.PI, 0); c.fill();
  }
  c.fillStyle='#d9dde6'; c.beginPath(); c.ellipse(hx, hy, hw/2, hh, 0, Math.PI, 0); c.fill();
  if(s.shield>0){ c.fillStyle = mars ? '#a05a39' : '#6a6d75'; c.globalAlpha = Math.min(0.85, 0.25*s.shield); c.beginPath(); c.ellipse(hx, hy, hw/2, hh, 0, Math.PI, 0); c.fill(); c.globalAlpha=1; }
  const lit = !dark;
  c.fillStyle= lit ? '#ffd88a' : '#6b5a3a'; for(let q=-1;q<=1;q++){ c.beginPath(); c.arc(hx+q*S2*0.7, hy-hh*0.45, S2*0.11, 0, Math.PI*2); c.fill(); }
  c.fillStyle='#b8bdc8'; c.fillRect(hx-S2*0.25, hy-S2*0.55, S2*0.5, S2*0.55);
  const nG = s.mode==='cadet' ? 0 : Math.min(s.gh, 8);
  for(let k=0;k<nG;k++){
    const broken = k >= s.gh - s.ghBroken;
    const on = s.lv.farm>0 && !broken;
    const gx = hx + hw/2 + S2*1.2 + (k%4)*S2*1.25, gy = base - Math.floor(k/4)*S2*0.55 + S2*0.12;
    const dg = c.createRadialGradient(gx, gy-S2*0.2, 0, gx, gy-S2*0.2, S2*0.7);
    dg.addColorStop(0, on ? `rgba(255,120,220,${0.35+0.4*s.lv.farm/100})` : 'rgba(80,90,110,.5)'); dg.addColorStop(1, on ? 'rgba(120,220,130,.25)' : 'rgba(60,70,90,.3)');
    c.fillStyle = dg; c.beginPath(); c.ellipse(gx, gy, S2*0.55, S2*0.5, 0, Math.PI, 0); c.fill();
    c.strokeStyle='rgba(220,235,255,.6)'; c.lineWidth=1.2; c.beginPath(); c.ellipse(gx, gy, S2*0.55, S2*0.5, 0, Math.PI, 0); c.stroke();
    if(on){ c.fillStyle='#5fd17a'; for(let q=-2;q<=2;q++){ c.fillRect(gx+q*S2*0.16-1, gy-S2*0.14, 2.5, S2*0.14); } }
    if(broken){ c.strokeStyle='#ff6363'; c.lineWidth=2; c.beginPath(); c.moveTo(gx-S2*0.2,gy-S2*0.42); c.lineTo(gx,gy-S2*0.25); c.lineTo(gx-S2*0.08,gy-S2*0.12); c.lineTo(gx+S2*0.12,gy-S2*0.02); c.stroke(); }
  }
  const nB = Math.min(Math.round((s.batCap-BAT_START_CAP)/BAT_ADD)+1, 8);
  for(let k=0;k<nB;k++){ const bx = hx - hw/2 - S2*1.1 - (k%4)*S2*0.42, by = base + S2*0.25 - Math.floor(k/4)*S2*0.5; c.fillStyle='#3a4150'; c.fillRect(bx, by-S2*0.42, S2*0.32, S2*0.42); c.fillStyle='#ffd35a'; c.fillRect(bx+S2*0.05, by-S2*0.42+S2*0.05+ (1-s.battery/s.batCap)*S2*0.32, S2*0.22, Math.max(1,(s.battery/s.batCap)*S2*0.32)); }
  if(s.reactor){ const rx = w*0.93, ry = h*0.71; c.fillStyle='#c9ced8'; c.fillRect(rx-S2*0.18, ry-S2*0.75, S2*0.36, S2*0.75); c.fillStyle='#8890a0'; for(let q=0;q<4;q++){ c.fillRect(rx-S2*0.7, ry-S2*0.68+q*S2*0.16, S2*0.48, S2*0.08); c.fillRect(rx+S2*0.22, ry-S2*0.68+q*S2*0.16, S2*0.48, S2*0.08);} c.fillStyle='#ffd35a'; c.beginPath(); c.arc(rx, ry-S2*0.85, S2*0.08, 0, Math.PI*2); c.fill(); }
  if(dark && !mars){ c.fillStyle='rgba(0,0,10,.55)'; c.fillRect(0,0,w,h); }
  if(dark && mars){
    c.fillStyle='rgba(160,90,50,.35)'; c.fillRect(0,0,w,h);
    const r2 = mulberry32(7);
    c.fillStyle='rgba(230,170,120,.45)';
    for(let k=0;k<180;k++){ const x = ((r2()*w + t*(120+r2()*220)) % (w+20)) - 10, y = r2()*h; c.fillRect(x, y, 6+r2()*14, 1.2); }
  }
}
