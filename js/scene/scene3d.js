/* 3D world: terrain, base, crew, rover, walking and driving */
"use strict";
/* ============================================================
   3D SCENE (Three.js, bundled inline). Falls back to the 2D canvas if WebGL is missing.
   The renderer and its <canvas> persist across render() calls; render() only moves the canvas
   into the fresh .scene container and calls G3.sync(S).
   ============================================================ */
/* ---------- our own symbol set (drawn as strokes, no emoji) ---------- */
const ICONS = {
  door:'M6 21V4h12v17M3 21h18M14.5 12.5h.01',
  bolt:'M13 2 4 14h7l-1 8 9-12h-7z',
  battery:'M5 7h12v10H5zM17 10h2.5v4H17M8.5 10v4M11.5 10v4',
  sun:'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1',
  mound:'M2 19h20M4 19c2-6 5-9 8-9s6 3 8 9M8.5 15h7',
  drill:'M9 3h6v5H9zM12 8v8M9.5 16 12 22l2.5-6z',
  dish:'M4 13a8 8 0 0 0 9 7.5zM8.5 15.5 14 10M14 10a2.5 2.5 0 0 1 2.5 2.5M14 10a6 6 0 0 1 6 6M13 20.5l-1.5 1.5h-4',
  leaf:'M5 19C5 11 11 5 20 5c0 9-6 15-14 15M5 19l7-7',
  atom:'M3 12c0-2 4-4 9-4s9 2 9 4-4 4-9 4-9-2-9-4M7.5 4.2c1.7-1 5.4 1.5 7.9 5.8s3 8.8 1.3 9.8-5.4-1.5-7.9-5.8-3-8.8-1.3-9.8M16.5 4.2c1.7 1 1.2 5.5-1.3 9.8s-6.2 6.8-7.9 5.8-1.2-5.5 1.3-9.8 6.2-6.8 7.9-5.8',
  bed:'M3 19V7M3 14h18v5M7 10.5h4V14H7z',
  wrench:'M15 3a5 5 0 0 0-4.5 7L3 17.5 6.5 21l7.5-7.5A5 5 0 0 0 21 9l-3 1.5L15.5 8 17 5z',
  broom:'M15 2l-3.5 9M6.5 12h9l1.5 9H5zM9 16v5M13 16v5',
  flask:'M9 3h6M10 3v6L5 19a1.5 1.5 0 0 0 1.3 2h11.4A1.5 1.5 0 0 0 19 19l-5-10V3M7.5 14h9',
  ice:'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 2 3-2M9 20l3-2 3 2',
  eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6',
  log:'M5 3h12l2 2v16H5zM8 8h8M8 12h8M8 16h5',
  crew:'M12 4a3 3 0 1 0 0 6a3 3 0 1 0 0-6M5 21c0-4 3-7 7-7s7 3 7 7',
  warn:'M12 3 2 21h20zM12 10v5M12 18v.01',
  rad:'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 9.5V3a9 9 0 0 1 7.8 4.5l-5.6 3.2M9.8 13.3l-5.6 3.2A9 9 0 0 1 4.2 7.5l5.6 3.2M14.2 13.3l5.6 3.2A9 9 0 0 1 12 21v-6.5',
  walk:'M13 3.5a1.8 1.8 0 1 0 0 .1M10 21l2.2-6 2.8 3v3M7.5 12l3.3-4 3 3 3 1M12.2 15l-1.4-7',
  jump:'M12 18V5M6.5 10.5 12 5l5.5 5.5M5 21h14',
  basket:'M3 10h18l-2.2 10H5.2zM8 10l4-6 4 6M9 14v3M15 14v3M12 14v3',
  med:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  screen:'M3 4h18v12H3zM8 20h8M12 16v4M6.5 12l3-3 3 2 4-4',
  drop:'M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11z',
  run:'M5 6l6 6-6 6M13 6l6 6-6 6',
  star:'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  rotate:'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5',
  close:'M6 6l12 12M18 6 6 18',
  play:'M7 4.5v15l12.5-7.5z',
};
function ic(n, cls){ return `<svg class="ic${cls?' '+cls:''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[n]||''}"/></svg>`; }

/* ---------- shooting stars: a small pool of glowing streaks that fall across the sky ---------- */
function meteorShower(T, scene, o){
  o = Object.assign({ n:6, rate:0.25, w:0.0035, len:1, dist:1500, minEl:0.35, maxEl:1.2, spreadAz:1.6, fog:false }, o||{});
  const c = document.createElement('canvas'); c.width = 256; c.height = 16;
  { const g = c.getContext('2d'), gr = g.createLinearGradient(0,0,256,0);
    gr.addColorStop(0,'rgba(120,160,255,0)'); gr.addColorStop(0.7,'rgba(190,215,255,.55)'); gr.addColorStop(0.96,'rgba(255,255,255,1)'); gr.addColorStop(1,'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0,0,256,16);
    const v = g.createLinearGradient(0,0,0,16); v.addColorStop(0,'rgba(0,0,0,1)'); v.addColorStop(0.5,'rgba(0,0,0,0)'); v.addColorStop(1,'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out'; g.fillStyle = v; g.fillRect(0,0,256,16); }
  const tex = new T.CanvasTexture(c);
  const geo = new T.PlaneGeometry(1,1); geo.translate(-0.5,0,0);   // head at the local origin, tail trails behind
  const pool = [];
  for(let i=0;i<o.n;i++){
    const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map:tex, transparent:true, opacity:0, depthWrite:false, blending:T.AdditiveBlending, side:T.DoubleSide, fog:o.fog }));
    m.visible = false; m.frustumCulled = false; m.renderOrder = 2; scene.add(m);
    pool.push({ m, age:0, life:1, p:new T.Vector3(), v:new T.Vector3(), len:1 });
  }
  const X = new T.Vector3(), Y = new T.Vector3(), Z = new T.Vector3(), fwd = new T.Vector3();
  let wait = 0.5;
  function spawn(cam){
    const s = pool.find(q=>!q.m.visible); if(!s) return;
    cam.getWorldDirection(fwd);
    const az = Math.atan2(fwd.z, fwd.x) + (Math.random()-0.5)*o.spreadAz;
    const el = o.minEl + Math.random()*(o.maxEl-o.minEl), d = o.dist*(0.8+Math.random()*0.4);
    s.p.set(cam.position.x + Math.cos(az)*Math.cos(el)*d, cam.position.y + Math.sin(el)*d, cam.position.z + Math.sin(az)*Math.cos(el)*d);
    // fall mostly downward along the sky, with a sideways drift
    const side = (Math.random()<0.5?-1:1)*(0.6+Math.random()*0.9);
    Z.set(-Math.sin(az), 0, Math.cos(az));                       // horizontal tangent
    s.v.set(0,-1,0).addScaledVector(Z, side).normalize().multiplyScalar(d*(0.3+Math.random()*0.2));
    s.len = d*o.len*(0.06+Math.random()*0.05); s.life = 0.7+Math.random()*0.7; s.age = 0;
    s.m.scale.set(s.len, d*o.w, 1); s.m.visible = true;
  }
  function step(dt, cam, on){
    if(on){ wait -= dt; if(wait <= 0){ spawn(cam); wait = -Math.log(1-Math.random())/o.rate; } }
    for(const s of pool){ if(!s.m.visible) continue;
      s.age += dt; if(s.age >= s.life){ s.m.visible = false; s.m.material.opacity = 0; continue; }
      s.p.addScaledVector(s.v, dt);
      const q = s.age/s.life; s.m.material.opacity = Math.min(1, q*6) * (1-q*q);
      s.m.scale.x = s.len*Math.min(1, 0.3 + q*2.5);
      X.copy(s.v).normalize(); Z.subVectors(cam.position, s.p).normalize();
      Y.crossVectors(Z, X).normalize(); Z.crossVectors(X, Y);
      s.m.matrix.makeBasis(X, Y, Z); s.m.matrix.setPosition(s.p); s.m.matrix.scale(s.m.scale);
      s.m.matrixAutoUpdate = false; s.m.matrixWorldNeedsUpdate = true;
    }
  }
  return { step };
}
const G3 = (()=>{
  const T = window.THREE; if(!T || !T.GLTFLoader) return null;
  let renderer;
  try{
    const cv = document.createElement('canvas'); cv.id = 'scene3d';
    renderer = new T.WebGLRenderer({canvas:cv, antialias:true, powerPreference:'high-performance'});
  }catch(e){ return null; }
  const canvas = renderer.domElement;
  canvas.setAttribute('role','img'); canvas.tabIndex = 0;
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio||1));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;

  /* ---------- noise ---------- */
  function hash(x,y,s){ let h = (x*374761393 + y*668265263 + s*1442695041)|0; h = (h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
  function vnoise(x,y,s){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi; const u=xf*xf*(3-2*xf), v=yf*yf*(3-2*yf);
    const a=hash(xi,yi,s), b=hash(xi+1,yi,s), c=hash(xi,yi+1,s), d=hash(xi+1,yi+1,s); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
  function fbm(x,y,s,o=5){ let f=0, a=0.5, fr=1; for(let i=0;i<o;i++){ f += a*vnoise(x*fr,y*fr,s+i*17); fr*=2.03; a*=0.5; } return f; }
  const sstep = (a,b,x)=>{ const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };

  /* ---------- procedural textures ---------- */
  function canvasTex(w,h,draw,rep){ const c=document.createElement('canvas'); c.width=w; c.height=h; draw(c.getContext('2d'),w,h); const t=new T.CanvasTexture(c); if(rep){ t.wrapS=t.wrapT=T.RepeatWrapping; t.repeat.set(rep,rep); } t.anisotropy=8; return t; }
  const grainTex = canvasTex(512,512,(c,w,h)=>{ const im=c.createImageData(w,h); for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const f = (X,Y)=>0.65*fbm(X/52,Y/52,3,4)+0.35*fbm(X/20,Y/20,8,2); const a = x/w, b = y/h; const n = f(x,y)*(1-a)*(1-b) + f(x-w,y)*a*(1-b) + f(x,y-h)*(1-a)*b + f(x-w,y-h)*a*b; const v = 175+(n-0.5)*1.6*70+35|0; const i=(y*w+x)*4; im.data[i]=im.data[i+1]=im.data[i+2]=v; im.data[i+3]=255; } c.putImageData(im,0,0); }, 160);
  grainTex.encoding = T.sRGBEncoding;
  const glowTex = canvasTex(128,128,(c,w,h)=>{ const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(.18,'rgba(255,255,255,.75)'); g.addColorStop(.45,'rgba(255,255,255,.18)'); g.addColorStop(1,'rgba(255,255,255,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); });
  const earthTex = canvasTex(512,256,(c,w,h)=>{ const im=c.createImageData(w,h); for(let y=0;y<h;y++)for(let x=0;x<w;x++){ const lat=Math.abs(y/h-0.5)*2; const n=fbm(x/60,y/40,9,5); const cl=fbm(x/28+50,y/18,21,5); let r=20,g=60,b=150; if(n>0.53){ r=70+n*80; g=110+n*40; b=50; if(lat>0.55){ r=g=b=235; } } if(lat>0.82){ r=g=b=240; } if(cl>0.56){ const k=Math.min(1,(cl-0.56)*5); r=r+(255-r)*k; g=g+(255-g)*k; b=b+(255-b)*k; } const i=(y*w+x)*4; im.data[i]=r; im.data[i+1]=g; im.data[i+2]=b; im.data[i+3]=255; } c.putImageData(im,0,0); });
  earthTex.encoding = T.sRGBEncoding;

  /* ---------- scene graph ---------- */
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 16/9, 0.08, 6000);
  const sun = new T.DirectionalLight(0xffffff, 3);
  const LIT = {sun:3.4, hemi:0.3, fill:0.4, k:0, sky:new T.Color(0x8899bb), gnd:new T.Color(0x222222), skyIn:new T.Color(0xf2f0ea), gndIn:new T.Color(0x6a6e78)};
  sun.castShadow = true; sun.shadow.mapSize.set(2048,2048); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  Object.assign(sun.shadow.camera, {left:-60,right:60,top:60,bottom:-60,near:10,far:420});
  scene.add(sun, sun.target);
  const hemi = new T.HemisphereLight(0x8899bb, 0x222222, 0.15); scene.add(hemi);
  const fill = new T.DirectionalLight(0x9fb6ff, 0.4); fill.position.set(-120,80,-200); scene.add(fill);
  const sunSprite = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:0xfff2d8, blending:T.AdditiveBlending, depthWrite:false, fog:false}));
  sunSprite.scale.set(240,240,1); scene.add(sunSprite);
  const sunCore = new T.Sprite(new T.SpriteMaterial({map:canvasTex(64,64,(c,w,h)=>{ const g=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2); g.addColorStop(0,'rgba(255,255,255,1)'); g.addColorStop(0.62,'rgba(255,255,255,1)'); g.addColorStop(0.8,'rgba(255,250,235,0.35)'); g.addColorStop(1,'rgba(255,250,235,0)'); c.fillStyle=g; c.fillRect(0,0,w,h); }), color:0xffffff, depthWrite:false, fog:false}));
  sunSprite.add(sunCore); sunCore.scale.set(0.3,0.3,1);   // the disc itself, inside the glow
  const M = (o)=> new T.MeshStandardMaterial(o);
  const mat = {
    metal: M({color:0xa8b0bd, roughness:0.4, metalness:0.35}),
    dark: M({color:0x2c3240, roughness:0.6, metalness:0.4}),
    red: M({color:0xff4a4a, emissive:0xff2020, emissiveIntensity:2}),
    amber: M({color:0xffc94a, emissive:0xffb020, emissiveIntensity:2}),
    orange: M({color:0xff8a3c, roughness:0.5, emissive:0x3a1400}),
  };
  function mesh(geo, m, cast=true, recv=true){ const o = new T.Mesh(geo, m); o.castShadow = cast; o.receiveShadow = recv; return o; }

  /* ---------- Blender models (embedded .glb, gzip + base64) ---------- */
  const ASSET = {}; let ready = false; const whenReady = []; let pending = null;
  (async()=>{
    try{
      const src = window.__GLB || {}; const loader = new T.GLTFLoader();
      for(const name of Object.keys(src)){ if(name.startsWith('tex_')) continue;
        const bin = Uint8Array.from(atob(src[name]), c=>c.charCodeAt(0));
        const buf = await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        const g = await new Promise((res, rej)=>loader.parse(buf, '', res, rej));
        g.scene.traverse(o=>{ if(!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
          (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{ if(m.transparent){ m.depthWrite = false; m.side = T.DoubleSide; o.castShadow = false; } }); });
        ASSET[name] = g.scene;
      }
    }catch(e){ console.warn('3D models could not be loaded', e); }
    ready = true;
    if(pending){ const [s,o] = pending; pending = null; sync(s,o); }
    whenReady.splice(0).forEach(f=>{ try{ f(); }catch(e){} });
  })();
  // real NASA imagery (NASA 3D Resources, public domain), embedded as JPEG
  const NTEX = {};
  function nasaTex(k){ if(NTEX[k]) return NTEX[k]; const b = (window.__GLB||{})['tex_'+k]; if(!b) return null; const t = new T.TextureLoader().load('data:image/jpeg;base64,'+b); t.encoding = T.sRGBEncoding; t.anisotropy = 4; return NTEX[k] = t; }
  // a NASA model scaled to a real size in metres along its longest side
  function nasaModel(name, metres){ const o = inst('nasa_'+name); const b = new T.Box3().setFromObject(o), sz = b.getSize(new T.Vector3()); const k = metres/Math.max(sz.x,sz.y,sz.z||1); o.scale.setScalar(k);
    o.traverse(m=>{ if(m.isMesh){ m.castShadow = true; m.receiveShadow = true; (Array.isArray(m.material)?m.material:[m.material]).forEach(q=>{ if(q && q.metalness>0.6) q.metalness = 0.6; }); } }); return o; }
  function inst(name){ const s = ASSET[name]; return s ? s.clone(true) : new T.Group(); }
  function find(root, name){ let r = null; root.traverse(o=>{ if(!r && o.name===name) r = o; }); return r; }
  const PARTS = ['torso','head','armL','armR','legL','legR'];
  function person(kind, tint){
    const root = new T.Group(), body = inst(kind); root.add(body); const parts = {};
    body.traverse(o=>{ if(PARTS.includes(o.name) && !parts[o.name]) parts[o.name] = o; });
    if(tint!=null) body.traverse(o=>{ if(o.isMesh && o.material && o.material.name==='fabric_blue'){ o.material = o.material.clone(); o.material.color.set(tint); } });
    root.userData.parts = parts; return root;
  }
  function animPerson(p, ph, amp, work){ const q = p.userData.parts; if(!q) return; const s = Math.sin(ph)*amp;
    if(q.legL) q.legL.rotation.x = s; if(q.legR) q.legR.rotation.x = -s;
    if(q.armL) q.armL.rotation.x = work ? -0.9 + Math.sin(ph*1.7)*0.35 : -s*0.8;
    if(q.armR) q.armR.rotation.x = work ? -1.1 + Math.cos(ph*1.7)*0.35 : s*0.8;
    if(q.head) q.head.rotation.y = work ? Math.sin(ph*0.4)*0.25 : 0; }

  /* ---------- base layout (metres; +x east, -z south) ---------- */
  const DOORS = [[1,0],[-1,0],[0,-1]];
  const GH = {x:-33.4, z:0}, LAB = {x0:-8, x1:8, z:-24};
  const AIRLOCK = new T.Vector3(25.4,0,0);
  const SLOT = {
    panel: k => { const row = k>>2, col = k&3; return new T.Vector3(-20 - col*5.4 - (row&1)*1.6, 0, 16 + row*4.8); },
    battery: k => new T.Vector3(29.5 + (k%4)*2.1, 0, 13.4 + Math.floor(k/4)*1.7),
    bed: k => { const p = [[2.8,1.8],[-2.8,1.8],[2.8,-1.8],[-2.8,-1.8],[2.8,4.0],[-2.8,4.0],[2.8,-4.0],[-2.8,-4.0]][k]; return new T.Vector3(GH.x+p[0], 0.25, GH.z+p[1]); },
    reactor: () => new T.Vector3(54,0,-42),
    dish: () => new T.Vector3(24,0,24),
    rover: () => new T.Vector3(34,0,8),
    drill: pid => pid==='mars' ? new T.Vector3(36,0,34) : new T.Vector3(40,0,30),
    lander: () => new T.Vector3(-52,0,-44),
    quarry: () => new T.Vector3(28,0,-24),
    hab: () => new T.Vector3(0,0,0),
  };
  const FOOT = [[0,0,16],[GH.x,0,13],[0,-24,12],[18,0,6],[-18,0,6],[0,-16,6],[-52,-44,10]];

  /* ---------- terrain (900 m square, distant mountains) ---------- */
  const SIZE = 900, SEG = 300;
  let heightFn = ()=>0;
  // the walkable ground is the rendered triangle mesh (3 m grid), not the smooth height function
  let TH = null; const TN = SEG+1, TS = SIZE/SEG;
  function groundAt(x,z){ if(!TH) return heightFn(x,z);
    const fx = (x + SIZE/2)/TS, fz = (z + SIZE/2)/TS;
    if(!(fx>=0 && fz>=0 && fx<SEG && fz<SEG)) return heightFn(x,z);
    const ix = Math.floor(fx), iz = Math.floor(fz), u = fx-ix, v = fz-iz;
    const ha = TH[iz*TN+ix], hb = TH[(iz+1)*TN+ix], hc = TH[(iz+1)*TN+ix+1], hd = TH[iz*TN+ix+1];
    return u+v <= 1 ? ha + (hd-ha)*u + (hb-ha)*v : hc + (hb-hc)*(1-u) + (hd-hc)*(1-v); }
  function makeHeight(pid){
    const mars = pid==='mars', seed = mars?7:3;
    const craters = []; const r = mulberry32(mars?91:57);
    for(let k=0;k<(mars?26:90);k++){ const a=r()*Math.PI*2, d=60+r()*320, R=(mars?3:2)+Math.pow(r(),2)*(mars?18:26); craters.push([Math.cos(a)*d, Math.sin(a)*d, R]); }
    craters.push([-70,90,30],[110,-70,22],[-150,-160,48]);
    return (x,z)=>{
      const d = Math.hypot(x,z);
      const amp = 0.35 + 0.65*sstep(30,140,d);
      let h = (mars ? (fbm(x/40,z/40,seed,5)-0.5)*9 + Math.sin(x/9+fbm(x/30,z/30,seed+3,3)*4)*0.6
                    : (fbm(x/34,z/34,seed,6)-0.5)*6) * amp;
      for(const [cx,cz,R] of craters){ const q = Math.hypot(x-cx,z-cz)/R; if(q<1.6){ h += q<1 ? -R*0.32*(1-q*q) + R*0.1*q*q*q : R*0.1*Math.exp(-(q-1)*(q-1)*12); } }
      if(!mars){ // polar massifs on the horizon, and the floor of Shackleton falling away to the south-west
        h += Math.pow(Math.max(0, d-200)/250, 1.6) * 85 * (0.35 + fbm(x/90,z/90,11,4));
        const sh = Math.hypot(x+330, z+300); if(sh < 260) h -= (1 - sh/260)*(1 - sh/260)*90;
      } else { // mesas and the far rim
        h += Math.max(0,(fbm(x/70,z/70,13,3)-0.52))*65*sstep(110,190,d);
        h += Math.pow(Math.max(0, d-260)/190, 2) * 50 * fbm(x/120,z/120,17,3);
      }
      let m = 1e9; for(const [cx,cz,R] of FOOT) m = Math.min(m, Math.hypot(x-cx,z-cz) - R);
      const fl = sstep(0, 16, m);
      return h*fl - 0.03*(1-fl);
    };
  }
  function buildTerrain(pid){
    const mars = pid==='mars';
    heightFn = makeHeight(pid);
    const g = new T.PlaneGeometry(SIZE, SIZE, SEG, SEG); g.rotateX(-Math.PI/2);
    const p = g.attributes.position, col = new Float32Array(p.count*3); TH = new Float32Array(p.count);
    const c1 = new T.Color(mars?0xb5643a:0x8a8c90), c2 = new T.Color(mars?0x6e3420:0x55575c), c3 = new T.Color(mars?0xd08a58:0xa9abb0), tmp = new T.Color();
    for(let i=0;i<p.count;i++){
      const x=p.getX(i), z=p.getZ(i); const y = heightFn(x,z); p.setY(i,y); TH[i] = y;
      const n = fbm(x/14,z/14,mars?31:33,4);
      tmp.copy(c2).lerp(c1, Math.min(1,n*1.3)); if(n>0.62) tmp.lerp(c3,(n-0.62)*2.2);
      col[i*3]=tmp.r; col[i*3+1]=tmp.g; col[i*3+2]=tmp.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col,3)); g.computeVertexNormals();
    const m = M({vertexColors:true, map:grainTex, roughness:1, metalness:0, bumpMap:grainTex, bumpScale:mars?0.25:0.15});
    const t = mesh(g, m, false, true); t.name='terrain'; return t;
  }

  /* ---------- Mars only: the base is built differently from the Moon one ----------
     - the habitat wears a 3D-printed regolith shell (the idea from NASA's 3D-Printed Habitat Challenge):
       rust-red, with the printer's horizontal layers, openings left for the three tunnels
     - an oxygen plant that makes O2 from the CO2 air (like the MOXIE test on Perseverance)
     - a small scout helicopter on its pad (like Ingenuity)
     - a sand fence against dust storms */
  function marsBase(w, group){
    const layerTex = canvasTex(64, 256, (c,W,H)=>{ for(let y=0;y<H;y+=8){ const g=c.createLinearGradient(0,y,0,y+8); g.addColorStop(0,'#c47a52'); g.addColorStop(0.55,'#a65c3a'); g.addColorStop(1,'#7c3f26'); c.fillStyle=g; c.fillRect(0,y,W,8); } });
    layerTex.wrapS = layerTex.wrapT = T.RepeatWrapping; layerTex.repeat.set(10, 1.3);
    const shellM = M({color:0xffffff, map:layerTex, bumpMap:layerTex, bumpScale:0.6, roughness:0.95, metalness:0});
    { // printed shell: a hemisphere a bit outside the dome; triangles in front of the tunnel doors are dropped
      const R = 11.45, g = new T.SphereGeometry(R, 72, 22, 0, Math.PI*2, 0, Math.PI/2).toNonIndexed(), pa = g.attributes.position, ua = g.attributes.uv;
      const keepP = [], keepU = [], doors = [0, Math.PI, -Math.PI/2];
      for(let i=0;i<pa.count;i+=3){ let cx=0, cy=0, cz=0; for(let j=0;j<3;j++){ cx+=pa.getX(i+j); cy+=pa.getY(i+j); cz+=pa.getZ(i+j); } cx/=3; cy/=3; cz/=3;
        const az = Math.atan2(cz, cx); const hole = doors.some(d=>{ const da = Math.atan2(Math.sin(az-d), Math.cos(az-d)); return Math.abs(da)*R < 2.7 && cy < 4.3; });
        if(hole) continue; for(let j=0;j<3;j++){ keepP.push(pa.getX(i+j), pa.getY(i+j), pa.getZ(i+j)); keepU.push(ua.getX(i+j), ua.getY(i+j)); } }
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(keepP,3)); sg.setAttribute('uv', new T.Float32BufferAttribute(keepU,2)); sg.computeVertexNormals();
      const shell = mesh(sg, shellM, true, true); shell.name = 'marsShell'; group.add(shell); w.marsShell = shell;
      // arched door frames where the tunnels pass through the shell
      const frameM = M({color:0x8a4a2e, roughness:0.9, map:layerTex});
      doors.forEach(d=>{ const f = mesh(new T.TorusGeometry(2.7, 0.35, 8, 24, Math.PI), frameM); f.position.set(Math.cos(d)*11.1, 0.4, Math.sin(d)*11.1); f.rotation.y = -d + Math.PI/2; f.scale.set(1, 1.45, 1); group.add(f); });
      // a ring of small round windows high up
      const winM = M({color:0x223040, emissive:0xffc070, emissiveIntensity:0.35, roughness:0.2, metalness:0.3});
      for(let k=0;k<10;k++){ const a = (k+0.5)/10*Math.PI*2, el = 0.62; const wn = mesh(new T.CircleGeometry(0.55, 20), winM, false, false);
        wn.position.set(Math.cos(a)*Math.cos(el)*(R+0.03), Math.sin(el)*(R+0.03), Math.sin(a)*Math.cos(el)*(R+0.03)); wn.lookAt(wn.position.clone().multiplyScalar(2)); group.add(wn); }
    }
    const metal = M({color:0xd5d8de, roughness:0.5, metalness:0.15}), white = M({color:0xf1efe9, roughness:0.6}), dark = M({color:0x30343c, roughness:0.6, metalness:0.3}), orange = M({color:0xe8752a, roughness:0.6});
    const gy = (x,z)=>groundAt(x,z);
    { // oxygen plant (CO2 in, O2 out) with two tanks and a pipe to the habitat
      const ox = -22, oz = -24, g = new T.Group(); g.position.set(ox, gy(ox,oz), oz); group.add(g);
      const box = mesh(new T.BoxGeometry(4.2, 2.4, 2.6), white); box.position.y = 1.2; g.add(box);
      const band = mesh(new T.BoxGeometry(4.25, 0.25, 2.65), orange); band.position.y = 1.9; g.add(band);
      for(let k=0;k<3;k++){ const fan = mesh(new T.CylinderGeometry(0.45,0.45,0.12,20), dark); fan.position.set(-1.3+k*1.3, 2.46, 0); g.add(fan); }
      [[-1.2,2.4],[1.2,2.4]].forEach(([x,z])=>{ const t = mesh(new T.CylinderGeometry(0.75,0.75,2.6,24), metal); t.position.set(x,1.3,z); g.add(t);
        const cap = mesh(new T.SphereGeometry(0.75,24,10,0,Math.PI*2,0,Math.PI/2), metal); cap.position.set(x,2.6,z); g.add(cap);
        const lab = mesh(new T.BoxGeometry(0.02,0.5,0.9), M({color:0x3c8dde})); lab.position.set(x+0.76,1.4,z); g.add(lab); });
      const pipe = mesh(new T.CylinderGeometry(0.12,0.12,1,10), metal); const a = new T.Vector3(ox+2.1, 0.5, oz), b = new T.Vector3(-8.6, 0.5, -12.8);
      pipe.scale.y = a.distanceTo(b); pipe.position.copy(a).add(b).multiplyScalar(0.5); pipe.position.y = gy(pipe.position.x, pipe.position.z) + 0.25; pipe.lookAt(b.x, pipe.position.y, b.z); pipe.rotateX(Math.PI/2); group.add(pipe);
      w.marsO2 = g; }
    { // scout helicopter on a landing pad
      const hx = 12, hz = 30, g = new T.Group(); g.position.set(hx, gy(hx,hz)+0.05, hz); group.add(g);
      const pad = mesh(new T.CylinderGeometry(2.4,2.4,0.08,40), M({color:0x5e3a2a, roughness:1}), false, true); g.add(pad);
      const ring = mesh(new T.RingGeometry(1.7,1.95,40), M({color:0xf2f2f2, roughness:0.8}), false, false); ring.rotation.x = -Math.PI/2; ring.position.y = 0.05; g.add(ring);
      const body = mesh(new T.BoxGeometry(0.45,0.4,0.45), M({color:0xd9c79b, roughness:0.5, metalness:0.4})); body.position.y = 0.75; g.add(body);
      for(let k=0;k<4;k++){ const a = k*Math.PI/2+Math.PI/4, leg = mesh(new T.CylinderGeometry(0.02,0.02,0.85,6), metal); leg.position.set(Math.cos(a)*0.35, 0.4, Math.sin(a)*0.35); leg.rotation.set(Math.sin(a)*0.5, 0, -Math.cos(a)*0.5); g.add(leg); }
      const mast = mesh(new T.CylinderGeometry(0.03,0.03,0.7,8), metal); mast.position.y = 1.3; g.add(mast);
      const panel = mesh(new T.BoxGeometry(0.55,0.03,0.4), M({color:0x1b2a55, roughness:0.3, metalness:0.5})); panel.position.y = 1.67; g.add(panel);
      const rotors = new T.Group(); [1.05,1.25].forEach((y,i)=>{ const r = mesh(new T.BoxGeometry(2.4,0.02,0.12), dark); r.position.y = y; r.rotation.y = i*0.8; rotors.add(r); }); g.add(rotors);
      w.heli = g; w.heliRotors = rotors; }
    { // sand fence on the windward side: posts with a mesh screen
      const fm = M({color:0x6b6f78, roughness:0.8, metalness:0.4}), net = M({color:0xd0b48c, roughness:1, transparent:true, opacity:0.55, side:T.DoubleSide});
      for(let k=0;k<9;k++){ const a = -2.2 + k*0.12, r = 48, x = Math.cos(a)*r, z = Math.sin(a)*r, y = gy(x,z);
        const post = mesh(new T.CylinderGeometry(0.06,0.06,2.2,8), fm); post.position.set(x, y+1.1, z); group.add(post);
        if(k<8){ const a2 = a+0.06, nx = Math.cos(a2)*r, nz = Math.sin(a2)*r; const n = mesh(new T.PlaneGeometry(r*0.12, 1.6), net, false, false); n.position.set(nx, gy(nx,nz)+1.2, nz); n.rotation.y = -a2; group.add(n); } } }
  }
  function rocks(pid, group){
    const mars = pid==='mars', r = mulberry32(mars?5:6);
    const geo = new T.DodecahedronGeometry(1,1); const pos = geo.attributes.position;
    for(let i=0;i<pos.count;i++){ const x=pos.getX(i), y=pos.getY(i), z=pos.getZ(i); const k = 0.8+0.35*hash(Math.round(x*97)+Math.round(z*53)*131, Math.round(y*89), 9); pos.setXYZ(i,x*k,y*k*0.7,z*k); } geo.computeVertexNormals();
    const m = M({color: mars?0x7a3a22:0x6d6f74, roughness:0.95, map:grainTex});
    const n = 520, inst = new T.InstancedMesh(geo, m, n); inst.castShadow = inst.receiveShadow = true;
    const o = new T.Object3D(); const keep = [...FOOT.map(f=>[f[0],f[1],f[2]+4]), [24,24,5],[34,8,5],[40,30,6],[36,34,6],[28,-24,8],[54,-42,9],[-28,23,16], [0,0,bermDims(4).rf+3],[-22,-24,6],[12,30,4]];   // no rocks where the regolith berm can grow (they would float on its slope)
    for(let k=0;k<n;k++){ let x,z,ok; do{ x=(r()-0.5)*760; z=(r()-0.5)*760; ok = !keep.some(([cx,cz,R])=>Math.hypot(x-cx,z-cz)<R); }while(!ok);
      const s=0.25+Math.pow(r(),3)*2.6*(Math.hypot(x,z)>120?1.8:1); o.position.set(x, heightFn(x,z)+s*0.2, z); o.rotation.set(r()*3,r()*3,r()*3); o.scale.setScalar(s); o.updateMatrix(); inst.setMatrixAt(k,o.matrix); }
    group.add(inst);
    return (x,z,R)=>{}; // (rocks are scenery only)
  }

  /* ---------- sky ---------- */
  function stars(n, rad, size, op){
    const g = new T.BufferGeometry(), a = new Float32Array(n*3), c = new Float32Array(n*3), r = mulberry32(77);
    for(let i=0;i<n;i++){ let x,y,z;
      if(i%3===0){ const t=r()*Math.PI*2, w=(r()-0.5)*0.35; x=Math.cos(t); y=w+0.25*Math.sin(t); z=Math.sin(t); } else { x=r()*2-1; y=r()*2-1; z=r()*2-1; }
      const l=Math.hypot(x,y,z)||1; a[i*3]=x/l*rad; a[i*3+1]=Math.abs(y/l)*rad*0.98+20; a[i*3+2]=z/l*rad;
      const t=r(); c[i*3]=0.8+0.2*t; c[i*3+1]=0.85+0.1*r(); c[i*3+2]=1; }
    g.setAttribute('position',new T.BufferAttribute(a,3)); g.setAttribute('color',new T.BufferAttribute(c,3));
    return new T.Points(g, new T.PointsMaterial({size, sizeAttenuation:false, vertexColors:true, transparent:true, opacity:op, depthWrite:false, fog:false}));
  }
  function skyDome(top, hor){
    const g = new T.SphereGeometry(3000, 32, 16), p = g.attributes.position, c = new Float32Array(p.count*3), a = new T.Color(top), b = new T.Color(hor), t = new T.Color();
    for(let i=0;i<p.count;i++){ const y = Math.max(0, p.getY(i)/3000); t.copy(b).lerp(a, Math.pow(y,0.55)); c[i*3]=t.r; c[i*3+1]=t.g; c[i*3+2]=t.b; }
    g.setAttribute('color', new T.BufferAttribute(c,3));
    return new T.Mesh(g, new T.MeshBasicMaterial({vertexColors:true, side:T.BackSide, fog:false, depthWrite:false}));
  }

  /* ---------- regolith berm: hugs the dome, trenches for the three tunnels ---------- */
  const domeR = y => Math.sqrt(Math.max(0, 121 - y*y));
  function bermDims(layers){ const H = Math.min(9.6, 2.2 + layers*1.8); const rc = domeR(H) + 0.15 + 0.8*layers; return {H, rc: Math.max(rc, domeR(H)+0.6), rf: Math.max(rc, domeR(H)+0.6) + H/0.7}; }
  function trench(x,z){ let k = 1; for(const [dx,dz] of DOORS){ if(x*dx+z*dz > 0){ const lat = Math.abs(x*dz - z*dx); k = Math.min(k, sstep(2.1, 3.8, lat)); } } return k; }
  function bermY(x,z,layers){ if(!(layers>0)) return -1e9; const r = Math.hypot(x,z); const d = bermDims(layers); if(r > d.rf || r < 11.4) return -1e9; // -1e9 = no berm here (a real number like -1 would fill every pit deeper than 1 m)
    const y = r < d.rc ? d.H : d.H*(1 - (r-d.rc)/(d.rf-d.rc)); const t = trench(x,z), n = (fbm(x/1.6,z/1.6,5,3)-0.5)*0.5*Math.min(1,y); return Math.max(-0.05, (y+n)*t - (1-t)*0.3); }
  function berm(layers){
    const d = bermDims(layers), pts = [];
    for(let k=0;k<=8;k++){ const y = d.H*k/8; pts.push(new T.Vector2(domeR(y)+0.15, y)); }
    pts.push(new T.Vector2(d.rc, d.H));
    for(let k=1;k<=10;k++){ const t=k/10; pts.push(new T.Vector2(d.rc + (d.rf-d.rc)*t, d.H*(1-t))); }
    const g = new T.LatheGeometry(pts.reverse(), 128);
    const p = g.attributes.position; for(let i=0;i<p.count;i++){ const x=p.getX(i), z=p.getZ(i), y=p.getY(i); const n = (fbm(x/1.6,z/1.6,5,3)-0.5)*0.5*Math.min(1,y); const ny = Math.max(-0.05, (y+n)*trench(x,z) - (1-trench(x,z))*0.3); p.setY(i, ny);
      // a vertex lowered into a tunnel trench must also move out to the dome wall, or it pokes through the dome as a grey spike
      if(ny < y - 0.01){ const r = Math.hypot(x,z), rMin = domeR(Math.max(0,ny)) + 0.15; if(r > 1e-3 && r < rMin){ p.setX(i, x*rMin/r); p.setZ(i, z*rMin/r); } } }
    g.computeVertexNormals();
    return mesh(g, M({color: built==='mars'?0xb06640:0x85878c, roughness:1, map:grainTex, side:T.DoubleSide}));
  }

  /* ---------- collision, floors and ceilings ---------- */
  const PR = 0.35; let SOLID = [], BOXES = [];
  const drv = { on:false, v:0, h:0, steer:0 };   // rover driving state
  const PARTS_DEG = [];   // radial room walls inside the dome (same angles as in the Blender model)
  function labD(x,z){ const cx = Math.max(LAB.x0, Math.min(LAB.x1, x)); return Math.hypot(x-cx, z-LAB.z); }
  function inDoorGap(x,z){ for(const [dx,dz] of DOORS){ if(x*dx+z*dz > 0 && Math.abs(x*dz - z*dx) < 1.25) return true; } return false; }
  function region(x,z){
    if(Math.hypot(x,z) < 10.75) return 'hab';
    if(Math.abs(z) < 1.4 && x > 10.5 && x < 24.15) return 'cE';
    if(Math.abs(z) < 1.4 && x < -10.5 && x > -25.4) return 'cW';
    if(Math.abs(x) < 1.4 && z < -10.5 && z > -22.6) return 'cS';
    if(Math.hypot(x-GH.x, z-GH.z) < 8.75) return 'gh';
    if(labD(x,z) < 2.45) return 'lab';
    return null;
  }
  function floorY(x,z){ const rg = region(x,z);
    if(rg==='hab') return 0.3; if(rg==='gh') return 0.27; if(rg==='lab') return 0.65;
    if(rg==='cS') return 0.2 + 0.45*Math.max(0, Math.min(1, (-20.4 - z)/1.5));   // ramp up into the lab
    if(rg) return 0.2;
    return Math.max(groundAt(x,z), world ? bermY(x,z,world.bermLayers) : -1e9); }
  function inPortal(x,z){ for(const [dx,dz] of DOORS){ const a = x*dx+z*dz; if(a > 9.6 && a < 11.6 && Math.abs(x*dz - z*dx) < 1.7) return true; } return (x - GH.x > 7.3 && x - GH.x < 9.6 && Math.abs(z) < 1.7) || (z > -22.8 && z < -20.3 && Math.abs(x) < 1.7); }
  function ceilAt(x,z){ const rg = region(x,z);
    if(inPortal(x,z)) return 2.95;
    if(rg==='hab'){ const r = Math.hypot(x,z); return Math.max(2.9, Math.sqrt(Math.max(0,121-r*r)) - 0.35); }
    if(rg==='gh'){ const r = Math.hypot(x-GH.x,z-GH.z); return Math.max(2.9, Math.sqrt(Math.max(0,81-r*r)) - 0.35); }
    if(rg==='lab'){ const dz = z-LAB.z; return 3.4 + Math.sqrt(Math.max(0, 11.56-dz*dz)) - 0.35; }
    if(rg) return 2.85; return Infinity; }
  function blocked(x,z){
    const r = Math.hypot(x,z);
    if(r > 10.65-PR && r < 11.6+PR && !inDoorGap(x,z)) return true;
    if(x>10.4 && x<24.3 && Math.abs(Math.abs(z)-1.62) < 0.37+PR) return true;
    if(x<-10.4 && x>-25.0 && Math.abs(Math.abs(z)-1.62) < 0.37+PR) return true;
    if(z<-10.4 && z>-21.6 && Math.abs(Math.abs(x)-1.62) < 0.37+PR) return true;
    const gr = Math.hypot(x-GH.x, z-GH.z);
    if(gr > 8.6-PR && gr < 9.5+PR && !(x>GH.x && Math.abs(z-GH.z)<1.25)) return true;
    const ld = labD(x,z);
    if(ld > 2.3-PR && ld < 3.6+PR && !(z>LAB.z && Math.abs(x)<1.25)) return true;
    for(const [dx,dz] of DOORS){ const a = x*dx+z*dz, lt = Math.abs(x*dz - z*dx); if(a > 9.9-PR && a < 11.3+PR && lt > 1.25 && lt < 2.4+PR) return true; }
    { const a = x - GH.x, lt = Math.abs(z - GH.z); if(a > 7.6-PR && a < 9.3+PR && lt > 1.25 && lt < 2.4+PR) return true; }
    if(z < -20.55+PR && z > -22.55-PR && Math.abs(x) > 1.25 && Math.abs(x) < 2.4+PR) return true;
    if(world && world.door && world.door.open < 0.6 && Math.abs(x - 23.61) < 0.1+PR && Math.abs(z) < 1.6) return true;
    if(world && world.door2 && world.door2.open < 0.6 && Math.abs(x - 10.6) < 0.1+PR && Math.abs(z) < 1.6) return true;
    for(const c of SOLID) if((x-c[0])*(x-c[0])+(z-c[1])*(z-c[1]) < (c[2]+PR)*(c[2]+PR)) return true;
    for(const b of BOXES) if(x>b[0]-PR && x<b[2]+PR && z>b[1]-PR && z<b[3]+PR) return true;
    if(r > 6.0-PR && r < 10.7){ for(const ga of PARTS_DEG){ const a = ga*Math.PI/180, ux = Math.cos(a), uz = Math.sin(a); const along = x*ux + z*uz, lat = Math.abs(-x*uz + z*ux); if(along > 5.85 && lat < 0.12+PR) return true; } }
    return r > 400;
  }
  const HAB_SOLID = [[-5.49,-6.96,0.42],[-4.67,-7.54,0.42],[-4.42,-6.31,0.3],[-6.91,-5.55,0.42],[-6.24,-6.29,0.42],[-5.72,-5.15,0.3],[-7.98,-3.85,0.42],[-7.50,-4.73,0.42],[-6.73,-3.73,0.3],[-4.38,-8.60,0.45],[5.76,-5.19,0.5],[6.58,-5.92,0.5],[5.66,-6.99,0.22],[6.53,-4.08,0.32],[8.91,-4.54,0.55],[5.04,-8.18,0.4],[5.70,-7.74,0.4],
    
    [2.44,7.74,0.55],[1.47,7.98,0.55],[-0.07,8.12,0.55],[-1.06,8.05,0.55],[-2.57,7.70,0.55],[-3.50,7.32,0.55],[-4.82,6.53,0.55],[-5.59,5.88,0.55],[8.54,3.84,0.4],[8.13,4.65,0.4],[7.64,5.40,0.4],[7.09,6.11,0.4],[6.47,6.76,0.4],[5.79,7.35,0.4],[5.43,4.72,0.75],[5.07,7.80,0.48],[-6.91,3.83,0.48],[-7.87,4.36,0.48],[-7.52,2.74,0.35],[-8.36,3.04,0.35],[-8.95,1.9,0.6],[-9.18,4.09,0.6]];
  function rebuildSolids(){
    const w = world; SOLID = HAB_SOLID.slice(); BOXES = [[7.75,-27.5,10,-20.5],[-10,-27.5,-7.75,-20.5],[-7.7,-26.1,7.7,-25.1],[-7.3,-22.4,-4.7,-21.8],[2.9,-23.95,5.1,-23.05],[-3.7,-22.6,-2.7,-21.8],[5.1,-22.3,6.4,-21.8],[6.9,-22.6,7.75,-21.9]];
    const v = (o,r)=>SOLID.push([o.position.x,o.position.z,r]);
    w.panels.forEach(p=>v(p,0.6)); w.batteries.forEach(b=>v(b,1.0));
    w.beds.forEach(b=>BOXES.push([b.position.x-2.5,b.position.z-0.7,b.position.x+2.5,b.position.z+0.7]));
    (w.ghRacks||[]).forEach(r=>SOLID.push([r.position.x, r.position.z, 0.75]));
    if(w.reactor.visible) SOLID.push([SLOT.reactor().x, SLOT.reactor().z, 5.6]);
    SOLID.push([SLOT.dish().x, SLOT.dish().z, 1.2],[SLOT.quarry().x, SLOT.quarry().z, 3.8],[33.4,-18.6,2.2],[25.2,-21.4,1.0],[22.4,-19.2,0.9],
      [SLOT.drill(w.pid).x, SLOT.drill(w.pid).z, 1.0],[27,5,0.25]);
    if(w.marsO2) SOLID.push([-23.2,-24,1.6],[-20.8,-24,1.6],[-23.2,-21.6,0.9],[-20.8,-21.6,0.9]);
    if(w.heli) SOLID.push([12,30,0.6]);
    if(w.viking) SOLID.push([w.viking.position.x, w.viking.position.z, 1.9]);
    w.crates.forEach(c=>SOLID.push([c[0],c[1],0.75]));
    w.roverSolid = [drv.on ? 1e6 : w.rover.position.x, w.rover.position.z, 1.7]; SOLID.push(w.roverSolid);
  }

  /* ---------- the world ---------- */
  let world = null, built = null, cur = null;
  const tweens = [];
  const ground = (x,z)=> groundAt(x,z);
  const place = (o, v, lift=0)=>{ o.position.set(v.x, ground(v.x,v.z)+lift, v.z); return o; };
  function outdoorSign(x, z, title, sub, col, icn, ry){
    const tex = canvasTex(512,160,(c,W,H)=>{ c.fillStyle='rgba(8,14,30,.95)'; c.fillRect(0,0,W,H); c.fillStyle=col; c.fillRect(0,0,12,H);
      c.save(); c.translate(30,40); c.scale(3,3); c.strokeStyle=col; c.lineWidth=2; c.lineCap='round'; c.lineJoin='round'; c.stroke(new Path2D(ICONS[icn])); c.restore();
      const fit = (t, px, wt)=>{ let f = px; do { c.font = `${wt} ${f}px system-ui,sans-serif`; f -= 1; } while(c.measureText(t).width > W - 140 && f > 12); };
      c.textBaseline='middle'; c.fillStyle='#fff'; fit(title, 40, 700); c.fillText(title, 120, 58);
      c.fillStyle='#c9d6ee'; fit(sub, 24, 500); c.fillText(sub, 120, 112); });
    const g = new T.Group(), post = M({color:0x2a2f3a, roughness:0.6, metalness:0.4});
    for(const sx of [-1.15,1.15]){ const p = mesh(new T.CylinderGeometry(0.05,0.05,2.6,8), post); p.position.set(sx,1.3,0); g.add(p); }
    const board = mesh(new T.PlaneGeometry(2.6,0.81), new T.MeshBasicMaterial({map:tex}), false, false); board.position.set(0, 2.1, 0.005); g.add(board);
    const back = mesh(new T.BoxGeometry(2.7,0.9,0.05), post); back.position.set(0,2.1,-0.04); g.add(back);
    ry = Math.atan2(26 - x, 0 - z); g.position.set(x, ground(x,z), z); g.rotation.y = ry; world.group.add(g); world.crates.push([x - Math.cos(ry)*1.15, z + Math.sin(ry)*1.15], [x + Math.cos(ry)*1.15, z - Math.sin(ry)*1.15]);
  }
  function put(o, x, y, z, ry=0){ o.position.set(x,y,z); o.rotation.y = ry; world.group.add(o); return o; }

  function solarPanel(){ const g = inst('solar'); g.userData.arr = find(g,'array'); g.traverse(o=>{ if(o.isMesh && o.material && o.material.name==='solar_cell') o.material = world.cellMat; }); return g; }
  function battery(){ const g = inst('battery'); const strip = mesh(new T.BoxGeometry(0.22,1.0,0.04), mat.amber.clone(), false,false); strip.position.set(0.55,0.9,0.53); g.add(strip); g.userData.strip = strip; return g; }
  const PLANT = ['lettuce','tomato','wheat'];
  function bedWithPlants(k){
    const g = inst('bed'); const plants = [];
    for(let i=0;i<10;i++) for(const dz of [-0.45,-0.15,0.15,0.45]){ const p = inst(PLANT[k%3]); p.position.set(-2.25+i*0.5, 0.73, dz + (i%2)*0.05); p.rotation.y = (i*1.7+dz*5); p.userData.big = 1.45 + 0.2*(((i*3+Math.round(dz*20))%3)/2); g.add(p); plants.push(p); }
    let led = null; g.traverse(o=>{ if(o.isMesh && o.material && o.material.name==='grow_led'){ o.material = o.material.clone(); led = o; } });
    g.userData.plants = plants; g.userData.led = led; return g;
  }

  function buildWorld(pid){
    if(world){ scene.remove(world.group); world.group.traverse(o=>{ if(o.geometry && !o.userData.shared) o.geometry.dispose(); }); }
    built = pid; const mars = pid==='mars';
    const group = new T.Group(); scene.add(group);
    const w = { group, pid, panels:[], batteries:[], beds:[], berm:null, bermLayers:-1, crates:[] };
    world = w;
    w.cellMat = (()=>{ let m = null; const s = ASSET.solar; if(s) s.traverse(o=>{ if(!m && o.isMesh && o.material && o.material.name==='solar_cell') m = o.material.clone(); }); return m || M({color:0x16307a, roughness:0.2, metalness:0.6}); })();
    w.terrain = buildTerrain(pid); group.add(w.terrain); rocks(pid, group);
    w.stars = stars(mars?600:6000, 2600, mars?1.2:1.6, mars?0.25:0.95); group.add(w.stars);
    w.meteors = meteorShower(T, group, { n:5, rate:0.18, w:0.005, dist:1700 });
    if(mars){ w.sky = skyDome(0x5a3a2c, 0xd59a68); group.add(w.sky); scene.fog = new T.Fog(0xc98b5c, 120, 700); scene.background = new T.Color(0x3a261d);
      // Phobos and Deimos with real NASA surface maps (shown larger than life so they read on screen)
      const ph = mesh(new T.SphereGeometry(7,32,20), M({color:0xffffff, roughness:1, map:nasaTex('phobos')||grainTex}),false,false); ph.scale.set(1.3,1,1.1); ph.position.set(700,560,-1200); group.add(ph); w.phobos = ph;
      const de = mesh(new T.SphereGeometry(2.6,24,16), M({color:0xffffff, roughness:1, map:nasaTex('deimos')||grainTex}),false,false); de.position.set(-900,700,-900); group.add(de); }
    else { scene.fog = null; scene.background = new T.Color(0x000002);
      const earth = new T.Mesh(new T.SphereGeometry(40,48,32), M({map:nasaTex('earth')||earthTex, roughness:0.7, metalness:0, emissive:0x0a1a40, emissiveIntensity:0.25})); earth.position.set(-400,380,-1400); earth.rotation.z = 0.4; group.add(earth); w.earth = earth;
      const atm = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:0x6fa8ff, blending:T.AdditiveBlending, opacity:0.55, depthWrite:false})); atm.scale.set(125,125,1); atm.position.copy(earth.position); group.add(atm); }
    // pressurised modules (Blender models)
    w.hab = put(inst('hab'), 0,0,0);
    // ---- real NASA hardware (NASA 3D Resources, public domain) ----
    // RASSOR: NASA Kennedy's regolith-mining robot, shuttles between the pit and the hopper
    w.rassor = put(nasaModel('rassor', 2.0), 25, ground(25,-30.5), -30.5, 0); w.rassor.userData = { x0:23.5, x1:33, t:0 };
    // an orbiter crossing the sky: LRO over the Moon, MRO over Mars
    w.orbiter = nasaModel(mars ? 'mro' : 'lro', mars ? 14 : 8); group.add(w.orbiter); w.orbiter.userData.ph = 0;
    if(mars){ // Viking 2 really landed in Utopia Planitia on 3 Sep 1976
      w.viking = put(nasaModel('viking', 3.3), -62, ground(-62,-8), -8, 0.6); }
    put(inst('corr_air'), 10.8,0,0);
    put(inst('corr_gh'), -10.8,0,0, Math.PI);
    put(inst('corr_lab'), 0,0,-10.8, Math.PI/2);
    put(inst('greenhouse'), GH.x,0,GH.z);
    put(inst('lab'), 0,0,LAB.z);
    if(mars) marsBase(w, group);
    // portal collars: seal the arched tunnels into the round modules (no light gaps, no ground showing)
    { const shapeOf = hw => { const sh = new T.Shape(); sh.moveTo(-hw,-0.1); sh.lineTo(-1.6,-0.1); sh.lineTo(-1.6,1.4); sh.absarc(0,1.4,1.6,Math.PI,0,true); sh.lineTo(1.6,-0.1); sh.lineTo(hw,-0.1); sh.lineTo(hw,3.7); sh.quadraticCurveTo(hw,4.05,hw-0.35,4.05); sh.lineTo(-hw+0.35,4.05); sh.quadraticCurveTo(-hw,4.05,-hw,3.7); sh.lineTo(-hw,-0.1); return sh; };
      const sh = shapeOf(2.4);
      const pm = M({color:0xaab1bd, roughness:0.55, metalness:0.25, side:T.DoubleSide}), stripe = M({color:0xf2b233, roughness:0.6});
      const collar = (depth, x, z, ry, shp)=>{ const g = new T.ExtrudeGeometry(shp || sh, {depth, bevelEnabled:false, curveSegments:24}); const m = mesh(g, pm, true, true); m.name = "collar"; m.position.set(x,0,z); m.rotation.y = ry; group.add(m);
        const st = mesh(new T.TorusGeometry(1.62, 0.05, 6, 32, Math.PI), stripe, false, false); st.position.set(0,1.4,-0.02); m.add(st); return m; };
      const innerC = collar(1.4, 9.9, 0, Math.PI/2); collar(1.4, -9.9, 0, -Math.PI/2); collar(1.4, 0, -9.9, Math.PI);
      // flat bulkhead that fills the dome wall around each habitat doorway, so the cut edges of the dome don't show as slanted stripes
      { const Rin = 10.72, d = 9.84, hmax = Math.sqrt(Rin*Rin - d*d), lat = h => Math.sqrt(Math.max(0, Rin*Rin - h*h - d*d));
        const bs = new T.Shape(); bs.moveTo(-lat(0), 0); for(let i=1;i<=24;i++){ const h = hmax*i/24; bs.lineTo(-lat(h), h); } for(let i=23;i>=0;i--){ const h = hmax*i/24; bs.lineTo(lat(h), h); } bs.lineTo(1.6, 0); bs.lineTo(1.6, 1.4); bs.absarc(0, 1.4, 1.6, 0, Math.PI, false); bs.lineTo(-1.6, 0); bs.lineTo(-lat(0), 0);
        const bg = new T.ExtrudeGeometry(bs, {depth:0.08, bevelEnabled:false, curveSegments:24});
        for(const [x,z,ry] of [[9.9-0.06,0,Math.PI/2],[-9.9+0.06,0,-Math.PI/2],[0,-9.9+0.06,Math.PI]]){ const b = mesh(bg, pm, false, true); b.position.set(x,0,z); b.rotation.y = ry; group.add(b);
          const st = mesh(new T.TorusGeometry(1.62, 0.05, 6, 32, Math.PI), stripe, false, false); st.position.set(0,1.4,-0.02); b.add(st); } }
      collar(1.7, GH.x+9.3, GH.z, -Math.PI/2); collar(2.0, 0, -20.55, Math.PI);
      const fm = M({color:0x5c626e, roughness:0.85, map:grainTex});
      const ramp = mesh(new T.BoxGeometry(3.2, 0.12, 1.57), fm, false, true); ramp.position.set(0, 0.36, -21.15); ramp.rotation.x = Math.atan2(0.45, 1.5); group.add(ramp);
      const pad = mesh(new T.BoxGeometry(3.2, 0.5, 1.0), fm, false, true); pad.position.set(0, 0.4, -22.4); group.add(pad);
      // outer airlock hatch: a real door that slides open when you walk up to it
      const outer = collar(0.45, 23.75, 0, Math.PI/2, shapeOf(3.3));
      const leafMat = M({color:0xdfe3ea, roughness:0.5, metalness:0.2}), edgeMat = M({color:0x2a2f3a, roughness:0.6}), winMat = M({color:0x8fc4ff, emissive:0x24476e, emissiveIntensity:0.6, roughness:0.1, metalness:0.3});
      const leaf = (s, par=outer, lz=-0.14) => { const q = new T.Shape(); q.moveTo(0,0.2); q.lineTo(s*1.6,0.2); q.lineTo(s*1.6,1.4); q.absarc(0,1.4,1.6, s>0?0:Math.PI, Math.PI/2, s<0); q.lineTo(0,0.2);
        const m = mesh(new T.ExtrudeGeometry(q, {depth:0.08, bevelEnabled:false, curveSegments:16}), leafMat, true, true); m.position.z = lz;
        const edge = mesh(new T.BoxGeometry(0.06, 2.8, 0.1), edgeMat, false, false); edge.position.set(0, 1.6, 0.04); m.add(edge);
        const win = mesh(new T.CircleGeometry(0.26, 24), winMat, false, false); win.position.set(s*0.75, 1.75, 0.09); m.add(win);
        const win2 = win.clone(); win2.position.z = -0.01; win2.rotation.y = Math.PI; m.add(win2);
        for(let k=0;k<4;k++){ const st = mesh(new T.BoxGeometry(0.34, 0.1, 0.02), M({color: k%2 ? 0x1b1d22 : 0xf2b233}), false, false); st.position.set(s*(0.35+k*0.36), 0.42, 0.09); st.rotation.z = 0.6*s; m.add(st); }
        par.add(m); return m; };
      w.door = { L: leaf(-1), R: leaf(1), open: 0, x: 23.7 };
      // inner hatch at the habitat end of the airlock tunnel: a real airlock has two doors
      w.door2 = { L: leaf(-1, innerC, 0.66), R: leaf(1, innerC, 0.66), open: 0, x: 10.6 };
      const lampI = mesh(new T.BoxGeometry(0.5,0.16,0.16), M({color:0xff4040, emissive:0xff2020, emissiveIntensity:1.2}), false, false); lampI.position.set(0, 3.35, 0.0); innerC.add(lampI); w.door2.lamp = lampI;
      const lampD = mesh(new T.BoxGeometry(0.5,0.16,0.16), M({color:0xff4040, emissive:0xff2020, emissiveIntensity:1.2}), false, false); lampD.position.set(0, 3.35, 0.47); outer.add(lampD); w.door.lamp = lampD;
      // floor plating so the rooms do not look like bare plastic
      const plate = canvasTex(256,256,(c,W,H)=>{ c.fillStyle='#8b919c'; c.fillRect(0,0,W,H); for(let i=0;i<2;i++) for(let j=0;j<2;j++){ const x=i*W/2, y=j*H/2; const g=c.createLinearGradient(x,y,x+W/2,y+H/2); g.addColorStop(0,'#959ba6'); g.addColorStop(1,'#80868f'); c.fillStyle=g; c.fillRect(x+3,y+3,W/2-6,H/2-6); c.fillStyle='#5d636d'; for(const [bx,by] of [[12,12],[W/2-12,12],[12,H/2-12],[W/2-12,H/2-12]]){ c.beginPath(); c.arc(x+bx,y+by,3,0,7); c.fill(); } } c.strokeStyle='rgba(60,66,76,.55)'; c.lineWidth=1; for(let k=0;k<6;k++){ c.beginPath(); c.moveTo(40+k*30,40); c.lineTo(40+k*30,88); c.stroke(); } });
      plate.encoding = T.sRGBEncoding;
      const floorMat = (rx, ry)=>{ const t = plate.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rx, ry); return M({map:t, roughness:0.75, metalness:0.15, polygonOffset:true, polygonOffsetFactor:-2, polygonOffsetUnits:-2}); };
      const deck = (geo, m, x, y, z)=>{ geo.rotateX(-Math.PI/2); const d = mesh(geo, m, false, true); d.position.set(x,y,z); group.add(d); return d; };
      deck(new T.CircleGeometry(10.7, 72), floorMat(5.3,5.3), 0, 0.302, 0);
      deck(new T.PlaneGeometry(13.0, 3.2), floorMat(6.5,1.6), 17.3, 0.203, 0);
      deck(new T.PlaneGeometry(14.0, 3.2), floorMat(7,1.6), -17.8, 0.203, 0);
      deck(new T.PlaneGeometry(3.2, 9.6), floorMat(1.6,4.8), 0, 0.203, -15.6);
      deck(new T.PlaneGeometry(16.0, 4.4), floorMat(8,2.2), 0, 0.652, LAB.z);
    }
    const bc = mesh(new T.SphereGeometry(0.3,12,8), mat.amber,false,false); bc.position.set(0,11.15,0); group.add(bc); w.beacon = bc;
    // interior lights
    const lamp = (x,y,z,c,i,d)=>{ const l = new T.PointLight(c,i,d,1.2); l.position.set(x,y,z); group.add(l); return l; };
    w.lamps = [lamp(0,6.4,0,0xfff1dd,0.42,24), lamp(0,5.6,LAB.z,0xe8f4ff,0.9,18), lamp(17,2.6,0,0xfff1dd,0.55,10), lamp(-17,2.6,0,0xfff1dd,0.55,10), lamp(0,2.6,-16,0xfff1dd,0.55,10)];
    // vertical grow racks along the greenhouse wall: three shelves of lettuce/herbs under pink LED strips
    w.ghRacks = [];
    { const shelfM = M({color:0xdfe3ea, roughness:0.5, metalness:0.3}), soilM = M({color:0x4a3324, roughness:1}), ledM = M({color:0xff9ae6, emissive:0xff5ad2, emissiveIntensity:2.2});
      for(const deg of [50, 90, 130, 180, 230, 270, 310]){ const an = deg*Math.PI/180, r = 7.25, rg = new T.Group();
        rg.position.set(GH.x + Math.cos(an)*r, 0.27, GH.z + Math.sin(an)*r); rg.rotation.y = -an - Math.PI/2;
        for(const sx of [-0.88, 0.88]) for(const sz of [-0.22, 0.22]){ const post = mesh(new T.BoxGeometry(0.06,2.6,0.06), shelfM); post.position.set(sx,1.3,sz); rg.add(post); }   // four corner posts the trays and lights hang on
        const cap = mesh(new T.BoxGeometry(1.82,0.05,0.5), shelfM); cap.position.set(0,2.6,0); rg.add(cap);
        for(let lv=0; lv<3; lv++){ const y = 0.45 + lv*0.7;
          const tray = mesh(new T.BoxGeometry(1.8,0.12,0.5), shelfM); tray.position.set(0,y,0); rg.add(tray);
          const soil = mesh(new T.BoxGeometry(1.7,0.04,0.42), soilM, false); soil.position.set(0,y+0.07,0); rg.add(soil);
          const lf = mesh(new T.BoxGeometry(1.76,0.04,0.44), shelfM, false); lf.position.set(0,y+0.62,0); rg.add(lf);   // light panel spans the posts
          const led = mesh(new T.BoxGeometry(1.6,0.015,0.3), ledM, false, false); led.position.set(0,y+0.595,0); rg.add(led);
          for(let i=0;i<5;i++){ const pl2 = inst(lv===1 ? 'tomato' : 'lettuce'); pl2.position.set(-0.68+i*0.34, y+0.08, 0); pl2.scale.setScalar(lv===1 ? 0.55 : 0.85); pl2.rotation.y = i*1.3+lv; rg.add(pl2); } }
        group.add(rg); w.ghRacks.push(rg); } }
    w.ghLamp = lamp(GH.x,5.5,GH.z,0xff8fe0,1.0,20); w.ghLamp2 = lamp(GH.x,3,GH.z,0xfff4e0,0.5,14);
    const dl = new T.PointLight(0xffe0a0, 1.2, 16); dl.position.set(26.5,3,0); group.add(dl);
    // outdoor kit
    w.dish = put(inst('dish'), SLOT.dish().x, ground(24,24), SLOT.dish().z, -2.3); w.dishHead = find(w.dish,'head');
    const beam = new T.Mesh(new T.CylinderGeometry(0.2,3,140,24,1,true), new T.MeshBasicMaterial({color:0x8fd0ff, transparent:true, opacity:0, blending:T.AdditiveBlending, depthWrite:false, side:T.DoubleSide}));
    beam.position.set(SLOT.dish().x-30, ground(24,24)+70, SLOT.dish().z-40); beam.lookAt(SLOT.dish().x, ground(24,24)+6, SLOT.dish().z); beam.rotateX(Math.PI/2); group.add(beam); w.beam = beam;
    w.rover = put(inst('rover'), SLOT.rover().x, ground(34,8), SLOT.rover().z, -0.8);
    const dp = SLOT.drill(pid); w.drill = put(inst('drill'), dp.x, ground(dp.x,dp.z), dp.z); w.drillBit = find(w.drill,'bit');
    const rp = SLOT.reactor(); w.reactor = put(inst('reactor'), rp.x, ground(rp.x,rp.z), rp.z, 0.4); w.reactor.visible = false;
    const lp = SLOT.lander(); w.lander = put(inst('lander'), lp.x, ground(lp.x,lp.z), lp.z); w.lander.visible = false;
    const flame = new T.Sprite(new T.SpriteMaterial({map:glowTex, color:0xffb060, blending:T.AdditiveBlending, depthWrite:false, opacity:0})); flame.scale.set(5,8,1); flame.position.y=0.8; w.lander.add(flame); w.lander.userData.flame = flame;
    const pad = mesh(new T.CylinderGeometry(8,8.4,0.25,48), M({color:0x5d6068, roughness:0.9})); place(pad, lp, 0.05); group.add(pad);
    const ring = mesh(new T.RingGeometry(6,6.4,48), M({color:0xffc94a, emissive:0x6a4a00, side:T.DoubleSide}),false,false); ring.rotation.x=-Math.PI/2; place(ring, lp, 0.2); group.add(ring);
    const reg = M({color: mars?0xa85d38:0x7d7f84, roughness:1, map:grainTex});
    const qp = SLOT.quarry(); const pg = new T.SphereGeometry(1, 32, 12, 0, Math.PI*2, 0, Math.PI/2); const pp = pg.attributes.position; for(let i=0;i<pp.count;i++){ const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i); const k = 1 + 0.18*(fbm(x*1.7+3, z*1.7+3, 21, 3)-0.5); const rr = Math.min(1, Math.hypot(x,z)); pp.setXYZ(i, x*4.6*k, 2.6*Math.pow(1-rr, 0.85)*(0.88+0.24*k) + 0.12*Math.sin(x*7)*Math.cos(z*6)*(1-rr), z*4.6*k); } /* a tipped cone of loose regolith, not a dome */ pg.computeVertexNormals(); const pile = mesh(pg, reg);
    place(pile, qp, -0.15); group.add(pile);
    { const rg = new T.DodecahedronGeometry(0.35, 0); const rm = M({color: mars?0x6e3a24:0x5f6166, roughness:1, map:grainTex}); const r = mulberry32(44);
      for(let k=0;k<16;k++){ const a = r()*Math.PI*2, d = 1.5 + r()*3.6, x = qp.x + Math.cos(a)*d, z = qp.z + Math.sin(a)*d, sc = 0.4 + r()*0.9;
        const rr = Math.min(1, d/(4.6*0.91)), hy = rr < 1 ? 2.6*Math.pow(1-rr, 0.85)*0.86 - 0.15 - 0.12*sc : 0; /* same cone profile as the pile (low side), so rocks sit in it, not above it */ const rk = mesh(rg, rm); rk.scale.set(sc, sc*0.7, sc); rk.rotation.set(r()*3, r()*3, r()*3); rk.position.set(x, ground(x,z) + hy + (rr<1?0:0.1), z); group.add(rk); } }
    put(inst('excavator'), 33.4, ground(33.4,-18.6), -18.6, 2.36);   // parked clear of the regolith pile, bucket reaching its edge
    // regolith bagging line: the excavator fills a hopper, a belt carries regolith to the bagger, filled bags wait on pallets
    { const steel = M({color:0x9aa2ae, roughness:0.45, metalness:0.7}), dark = M({color:0x2c323e, roughness:0.6, metalness:0.3}), yel = M({color:0xf2b233, roughness:0.5, metalness:0.2});
      const bagM = M({color: mars?0xd9c3a8:0xe4e2dc, roughness:0.95}), strap = M({color:0x3b6bd1, roughness:0.7}), wood = M({color:0x8a7a5a, roughness:0.9});
      const at = (o, x, z, dy=0)=>{ o.position.set(x, ground(x,z) + dy, z); group.add(o); return o; };
      const glowY = M({color:0xffb347, emissive:0xff9a1f, emissiveIntensity:1.6});
      // hopper: yellow funnel in a steel frame with a grid on top, the excavator tips regolith in here
      const hx = 25.2, hz = -21.4, hg = ground(hx,hz);
      for(const [dx,dz] of [[-0.75,-0.75],[0.75,-0.75],[-0.75,0.75],[0.75,0.75]]){ at(mesh(new T.BoxGeometry(0.12,2.1,0.12), steel), hx+dx, hz+dz, 1.05); }
      for(const y of [0.5, 1.9]) for(const [ax,az,rx] of [[0,-0.75,0],[0,0.75,0],[-0.75,0,1],[0.75,0,1]]){ const b = at(mesh(new T.BoxGeometry(1.5,0.08,0.08), steel), hx+ax, hz+az, y); if(rx) b.rotation.y = Math.PI/2; }
      at(mesh(new T.CylinderGeometry(1.15,0.32,1.2,4,1,true), M({color:0xf2b233, roughness:0.5, metalness:0.2, side:T.DoubleSide})), hx, hz, 2.55).rotation.y = Math.PI/4;
      for(let k=-3;k<=3;k++){ at(mesh(new T.BoxGeometry(0.04,0.04,1.6), dark), hx+k*0.22, hz, 3.15); }
      at(mesh(new T.CylinderGeometry(0.75,0.75,0.25,4), reg), hx, hz, 2.95).rotation.y = Math.PI/4;   // regolith heaped inside
      // conveyor: a lattice frame on A-frame legs, rollers, a dark belt carrying a line of regolith, side rails
      const bx = 22.4, bz = -19.2, dx = bx-hx, dz = bz-hz, len = Math.hypot(dx,dz), ang = -Math.atan2(dz, dx), y0 = 1.75, y1 = 1.45;
      const conv = new T.Group(); conv.position.set((hx+bx)/2, ground((hx+bx)/2,(hz+bz)/2) + (y0+y1)/2, (hz+bz)/2); conv.rotation.y = ang; conv.rotation.z = Math.atan2(y1-y0, len) * -1; group.add(conv);
      const cp = (o,x,y,z)=>{ o.position.set(x,y,z); conv.add(o); return o; };
      cp(mesh(new T.BoxGeometry(len, 0.05, 0.62), M({color:0x1a1d24, roughness:0.85})), 0, 0.06, 0);
      cp(mesh(new T.BoxGeometry(len, 0.07, 0.3), reg), 0, 0.12, 0);
      for(const zz of [-0.36, 0.36]){ cp(mesh(new T.BoxGeometry(len, 0.14, 0.05), yel), 0, 0.12, zz); cp(mesh(new T.BoxGeometry(len, 0.06, 0.06), steel), 0, -0.12, zz); }
      for(let k=0;k<=Math.floor(len/0.45);k++){ const r = cp(mesh(new T.CylinderGeometry(0.05,0.05,0.7,8), steel), -len/2 + k*0.45, 0, 0); r.rotation.x = Math.PI/2; }
      for(let k=0;k<Math.floor(len/0.6);k++){ const d = cp(mesh(new T.BoxGeometry(0.04,0.04,0.75), steel), -len/2 + 0.3 + k*0.6, -0.08, 0); d.rotation.y = (k%2 ? 0.6 : -0.6); }
      for(const t of [0.2, 0.75]){ const x = hx + dx*t, z = hz + dz*t, h = y0 + (y1-y0)*t;
        for(const side of [-1,1]){ const leg = at(mesh(new T.BoxGeometry(0.07, h, 0.07), steel), x + Math.sin(ang)*0.3*side, z + Math.cos(ang)*0.3*side, h/2); leg.rotation.y = ang; } }
      // bagging machine: housing, control panel with a screen, chute down into a bag on a weighing scale, warning beacon
      const bag0 = M({color:0xd6dbe3, roughness:0.5, metalness:0.2});
      const bm = new T.Group(); bm.position.set(bx, ground(bx,bz), bz); bm.rotation.y = ang; group.add(bm);
      const bp = (o,x,y,z)=>{ o.position.set(x,y,z); bm.add(o); return o; };
      bp(mesh(new T.BoxGeometry(1.5,0.12,1.3), dark), 0, 0.06, 0);
      bp(mesh(new T.BoxGeometry(1.2,1.25,1.1), bag0), 0.1, 0.75, 0);
      bp(mesh(new T.CylinderGeometry(0.45,0.2,0.5,4,1,true), M({color:0xf2b233, roughness:0.5, side:T.DoubleSide})), -0.1, 1.55, 0).rotation.y = Math.PI/4;
      bp(mesh(new T.BoxGeometry(0.06,0.5,0.7), dark), 0.73, 0.95, 0);
      bp(mesh(new T.PlaneGeometry(0.55,0.3), M({color:0x0e2846, emissive:0x2a7fd8, emissiveIntensity:0.9})), 0.765, 1.02, 0).rotation.y = Math.PI/2;
      for(const [zz,c] of [[-0.2,0x55ff88],[0,0xffd35a],[0.2,0xff5555]]){ const bt = bp(mesh(new T.CylinderGeometry(0.035,0.035,0.03,10), M({color:c, emissive:c, emissiveIntensity:0.8})), 0.77, 0.8, zz); bt.rotation.z = Math.PI/2; }
      const chute = bp(mesh(new T.CylinderGeometry(0.16,0.2,0.7,12,1,true), M({color:0x9aa2ae, roughness:0.45, metalness:0.7, side:T.DoubleSide})), -0.85, 0.75, 0); chute.rotation.z = -0.5;
      bp(mesh(new T.BoxGeometry(0.75,0.08,0.75), steel), -1.15, 0.04, 0);                    // scale
      const fill = bp(mesh(new T.CylinderGeometry(0.32,0.36,0.62,14), bagM), -1.15, 0.4, 0);   // the bag being filled
      for(const zz of [-0.24,0.24]) bp(mesh(new T.TorusGeometry(0.08,0.02,6,12,Math.PI), strap), -1.15, 0.72, zz);
      const beacon = bp(mesh(new T.CylinderGeometry(0.08,0.08,0.16,12), glowY), 0.35, 1.46, 0.35);
      const bl = new T.PointLight(0xffa020, 0, 6, 2); bl.position.set(0.35, 1.7, 0.35); bm.add(bl);
      w.bagger = { beacon, bl, fill };
      // work-light mast so the quarry is lit in the shadow of the mountains
      { const lx = 26.8, lz = -17.6; at(mesh(new T.CylinderGeometry(0.06,0.09,4.2,8), steel), lx, lz, 2.1);
        const head = at(mesh(new T.BoxGeometry(0.5,0.25,0.18), dark), lx, lz, 4.25); head.rotation.y = 0.9;
        const lens = mesh(new T.PlaneGeometry(0.42,0.18), M({color:0xffffff, emissive:0xfff1d0, emissiveIntensity:2})); lens.position.z = 0.1; head.add(lens);
        const sl = new T.SpotLight(0xfff1d0, 1.4, 22, 0.7, 0.6, 1.5); sl.position.set(lx, ground(lx,lz)+4.2, lz); sl.target.position.set(qp.x-2, ground(qp.x,qp.z), qp.z+2); group.add(sl, sl.target); }
      // a flattened, darker work area with tyre tracks between the pile and the line
      { const pad = mesh(new T.CircleGeometry(5.5, 40), M({color: mars?0x6b3a26:0x55575c, roughness:1, map:grainTex, transparent:true, opacity:0.55, depthWrite:false}), false, true);
        pad.rotation.x = -Math.PI/2; pad.position.set(25.6, ground(25.6,-19.6)+0.04, -19.6); group.add(pad);
        for(let k=0;k<2;k++){ const tr = mesh(new T.PlaneGeometry(0.35, 7.5), M({color:0x3a3c42, roughness:1, transparent:true, opacity:0.45, depthWrite:false}), false, false);
          tr.rotation.x = -Math.PI/2; tr.rotation.z = 0.9; tr.position.set(27.6 + k*0.9*Math.cos(0.9), ground(27.6,-20.4)+0.05, -20.4 - k*0.9*Math.sin(0.9)); group.add(tr); } }
      // filled bags stacked on pallets
      const bagG = new T.BoxGeometry(0.9,0.32,0.55, 3,2,2); { const p = bagG.attributes.position; for(let i=0;i<p.count;i++){ const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const k = 1 - 0.18*(Math.abs(x)/0.45)**2*(Math.abs(z)/0.275); p.setY(i, y*k); } bagG.computeVertexNormals(); }
      for(const [px,pz] of [[20.2,-17.2],[20.4,-15.3]]){
        at(mesh(new T.BoxGeometry(2.0,0.14,1.3), wood), px, pz, 0.07);
        for(let l=0;l<3;l++) for(let i=0;i<2;i++) for(let j=0;j<2;j++){ if(l===2 && i+j>1) continue;
          const b = at(mesh(bagG, bagM), px - 0.48 + i*0.96, pz - 0.3 + j*0.6, 0.31 + l*0.32); b.rotation.y = (l%2)*0.04;
          const st = mesh(new T.BoxGeometry(0.06,0.34,0.57), strap, false, false); b.add(st); }
        w.crates.push([px, pz]);
      }
      // (signboards removed: the stations already show what each place is)
    }
    [[27,-6],[28.2,-6.6],[26.8,-7.4],[-46,-34],[-47.2,-35],[-45.4,-36]].forEach(([x,z],k)=>{ put(inst('crate'), x, ground(x,z), z, k*0.7); w.crates.push([x,z]); });
    // path lights from the airlock to each work site
    const paths = [[26,0,26,20],[26,0,26,-20],[26,0,36,26],[26,0,32,6],[26,0,50,-36],[26,2,29,10],[-12,12,-18,12],[24,6,-10,13],[-30,12,-48,-38]];
    for(const [x0,z0,x1,z1] of paths){ const n = Math.max(2, Math.round(Math.hypot(x1-x0,z1-z0)/7)); for(let k=1;k<n;k++){ const x = x0+(x1-x0)*k/n, z = z0+(z1-z0)*k/n; if(region(x,z) || Math.hypot(x,z)<24 && Math.hypot(x,z)>10) continue; put(inst('pathlight'), x, ground(x,z), z); } }
    // mission flag (an invented mission patch, not a real logo)
    const flagTex = canvasTex(128,80,(c,w2,h)=>{ c.fillStyle='#0f2a66'; c.fillRect(0,0,w2,h); c.strokeStyle='#ffd35a'; c.lineWidth=4; c.beginPath(); c.ellipse(64,40,40,14,-0.3,0,Math.PI*2); c.stroke(); c.fillStyle='#8fb8ff'; c.beginPath(); c.arc(64,40,12,0,Math.PI*2); c.fill(); c.fillStyle='#fff'; for(let k=0;k<12;k++) c.fillRect((k*53)%w2,(k*29)%h,2,2); });
    const pole = mesh(new T.CylinderGeometry(0.05,0.05,4,6), mat.metal); place(pole, new T.Vector3(27,0,5), 2); group.add(pole);
    const fl = mesh(new T.PlaneGeometry(1.8,1.1), M({map:flagTex, side:T.DoubleSide, roughness:0.8})); place(fl, new T.Vector3(27.9,0,5), 3.4); group.add(fl);
    const trk = M({color: mars?0x6a3018:0x45474c, roughness:1, transparent:true, opacity:0.55});
    for(let k=0;k<40;k++){ const t = k/40, x = 30 - t*44, z = 8 + Math.sin(t*4)*6 + t*20; const s = mesh(new T.PlaneGeometry(0.4,1.1), trk,false,true); s.rotation.x=-Math.PI/2; s.rotation.z = 0.5; place(s, new T.Vector3(x,0,z), 0.04); if(!region(x,z)) group.add(s); }
    w.dust = dustParticles(3000, mars?0xe0a070:0xbbbbbb, 200); w.dust.visible = false; group.add(w.dust);
    w.protons = dustParticles(1200, 0xd38bff, 160); w.protons.material.size = 0.3; w.protons.material.blending = T.AdditiveBlending; w.protons.visible = false; group.add(w.protons);
    w.astro = person('astronaut'); w.astro.visible = false; group.add(w.astro);
    buildWalk(w); buildCrew(w);
    const el = mars ? 34 : 24, az = mars ? 215 : 250;   // high enough to clear the ring of mountains, so the Sun is in the sky
    const d = new T.Vector3(Math.cos(el*Math.PI/180)*Math.cos(az*Math.PI/180), Math.sin(el*Math.PI/180), Math.cos(el*Math.PI/180)*Math.sin(az*Math.PI/180));
    w.sunDir = d;
    sunSprite.position.copy(d).multiplyScalar(2400); sunSprite.scale.setScalar(mars?180:280);
    hemi.color.set(mars?0xd9a070:0x8899bb); hemi.groundColor.set(mars?0x5a2a18:0x1a1a1a);
  }
  function dustParticles(n, color, spread){
    const g = new T.BufferGeometry(), a = new Float32Array(n*3), r = mulberry32(3);
    for(let i=0;i<n;i++){ a[i*3]=(r()-0.5)*spread; a[i*3+1]=r()*30; a[i*3+2]=(r()-0.5)*spread; }
    g.setAttribute('position', new T.BufferAttribute(a,3));
    return new T.Points(g, new T.PointsMaterial({color, size:0.22, map:glowTex, transparent:true, opacity:0.7, depthWrite:false}));
  }
  function setCount(arr, n, make, slot, animate, lift){
    const added = [];
    while(arr.length < n){ const k = arr.length; const o = make(k); const v = slot(k); if(lift==null) place(o, v); else o.position.copy(v); world.group.add(o); arr.push(o); if(animate) added.push(o); }
    while(arr.length > n){ const o = arr.pop(); world.group.remove(o); }
    return added;
  }

  /* bring the 3D world in line with the game state (day = the day whose lighting to show) */
  function sync(s, opt={}){
    if(!ready){ pending = [s, opt]; cur = s; return []; }
    if(!world || built!==s.pid) buildWorld(s.pid);
    cur = s;
    const w = world, mars = s.pid==='mars', day = opt.day ?? s.day, eng = s.mode!=='cadet';
    const dark = isDark(s, day), flare = isFlare(s, day) && !opt.noFlare;
    const added = [];
    added.push(...setCount(w.panels, Math.min(s.panels,16), solarPanel, SLOT.panel, opt.animate));
    const sd = w.sunDir; w.panels.forEach(p=>{ p.rotation.y = Math.atan2(sd.x, sd.z); if(p.userData.arr) p.userData.arr.rotation.x = (Math.PI/2 - Math.asin(sd.y))*0.85; });
    w.cellMat.color.setRGB(0.09,0.17,0.43).lerp(new T.Color(0xc07a4a), Math.min(0.8, s.dust*2.2));
    const nb = Math.min(Math.round((s.batCap-BAT_START_CAP)/BAT_ADD)+1, 8);
    added.push(...setCount(w.batteries, nb, battery, SLOT.battery, opt.animate));
    w.batteries.forEach(b=>{ const f = Math.max(0.05, s.battery/s.batCap); b.userData.strip.scale.y = f; b.userData.strip.position.y = 0.4 + 0.5*f; });
    const ng = eng ? Math.min(s.gh, 8) : 4;
    added.push(...setCount(w.beds, ng, bedWithPlants, SLOT.bed, opt.animate, true));
    const grow = Math.min(1, 0.3 + 0.25*Math.max(0, day - (s.harvestDay ?? -9)));
    w.beds.forEach((g,k)=>{ const broken = eng && k >= s.gh - s.ghBroken, on = (!eng || s.lv.farm>0) && !broken;
      if(g.userData.led){ g.userData.led.material.emissiveIntensity = on ? 0.6 + 4*(eng ? s.lv.farm/100 : 1) : 0; g.userData.led.material.emissive.set(broken ? 0xff3030 : 0xff5ad2); }
      g.userData.plants.forEach((p,i)=>{ const sc = broken ? 0.5 : grow*(0.85+0.15*Math.sin(i*2.3)); p.scale.setScalar(Math.max(0.2, sc)*(p.userData.big||1)); }); });
    w.ghLamp.intensity = w.beds.some(b=>b.userData.led && b.userData.led.material.emissiveIntensity>0) ? 1.1 : 0.15;
    if(w.bermLayers !== s.shield){ if(w.berm) w.group.remove(w.berm); w.berm = s.shield>0 ? berm(s.shield) : null; if(w.berm){ w.group.add(w.berm); if(opt.animate && s.shield>w.bermLayers && w.bermLayers>=0) added.push(w.berm); } w.bermLayers = s.shield; }
    if(s.reactor && !w.reactor.visible){ w.reactor.visible = true; if(opt.animate) added.push(w.reactor); } else if(!s.reactor) w.reactor.visible = false;
    w.beacon.material = s.leak ? mat.red : mat.amber;
    rebuildSolids();
    // lighting
    const sunK = dark ? (mars ? 0.25 : 0.04) : 1;
    sun.intensity = (mars ? 2.6 : 3.4) * sunK; LIT.sun = sun.intensity;
    sun.color.set(flare ? 0xffd2c0 : (mars ? 0xffe2c4 : 0xfff6ea));
    hemi.intensity = mars ? (dark?0.55:0.45) : (dark?0.22:0.3); fill.intensity = mars ? 0.15 : (dark?0.35:0.45); LIT.hemi = hemi.intensity; LIT.fill = fill.intensity;
    sunSprite.material.opacity = dark ? (mars?0.15:0) : 1; sunCore.material.opacity = sunSprite.material.opacity;
    sunSprite.material.color.set(flare ? 0xffb0a0 : 0xfff2d8);
    if(mars){ scene.fog.near = dark ? 8 : 120; scene.fog.far = dark ? 110 : 700; scene.fog.color.set(dark?0x9a6440:0xc98b5c); w.sky.material.color.set(dark?0x9a7060:0xffffff); }
    w.stars.material.opacity = mars ? (dark?0:0.25) : 0.95;
    w.dust.visible = mars && dark;
    w.protons.visible = !!(flare && flareOn(s,day) && flareOn(s,day).s>0);
    w.lander.visible = PLANETS[s.pid].cargo.includes(day) || (opt.cargoArrived ?? false);
    w.crew.forEach(n=>n.avail = !n.ghOnly || eng);
    canvas.setAttribute('aria-label', L('Трёхмерный вид базы. Перетащи, чтобы повернуть.','3D view of the base. Drag to rotate.'));
    kick();
    return added;
  }

  /* ---------- station markers (own symbols) ---------- */
  function iconSprite(name, color, scale){
    const tex = canvasTex(128,128,(c)=>{ c.fillStyle='rgba(6,10,22,.82)'; c.beginPath(); c.arc(64,64,56,0,Math.PI*2); c.fill(); c.lineWidth=6; c.strokeStyle=color; c.stroke();
      c.save(); c.translate(64-36,64-36); c.scale(3,3); c.strokeStyle='#fff'; c.lineWidth=2; c.lineCap='round'; c.lineJoin='round'; c.stroke(new Path2D(ICONS[name]||'')); c.restore(); });
    const sp = new T.Sprite(new T.SpriteMaterial({map:tex, depthWrite:false, depthTest:false, transparent:true, fog:false})); sp.scale.set(scale,scale,1); sp.renderOrder = 10; return sp;
  }
  const STATIONS = pid => [
    {id:'door', x:22.4, z:0.35, icon:'door', col:'#8fb8ff', in:'both'},
    {id:'repair', x:19.6, z:-0.45, icon:'wrench', col:'#ffb070', in:true},
    {id:'bunks', x:0.7, z:5.5, icon:'bed', col:'#8fb8ff', in:true},
    {id:'comms', x:-5.0, z:-3.9, icon:'screen', col:'#7fd3ff', in:true},
    {id:'med', x:5.0, z:-3.8, icon:'med', col:'#ff8fa3', in:true},
    {id:'lab', x:1.2, z:-23.4, icon:'flask', col:'#8ddc6a', in:true},
    {id:'greenhouse', x:-28.4, z:0, icon:'leaf', col:'#8ddc6a', in:true},
    {id:'battery', x:29.6, z:10.6, icon:'battery', col:'#ffd35a'},
    {id:'panels', x:-17.5, z:12.4, icon:'sun', col:'#7fd3ff'},
    {id:'shield', x:23.6, z:-19.6, icon:'mound', col:'#d38bff'},
    {id:'drill', x: pid==='mars'?33:37, z: pid==='mars'?31:27, icon:'drill', col:'#8ddc6a'},
    {id:'radio', x:21.4, z:20.6, icon:'dish', col:'#7fd3ff'},
    {id:'reactor', x:48.6, z:-37, icon:'atom', col:'#4fd08f'},
  ];

  /* ---------- crew NPCs walking through the base ---------- */
  const NAV = { hub:[1.5,-2], E:[9.6,0], W:[-9.6,0], S:[0,-9.6], N1:[6,0.5], gal:[6.62,5.17], tab:[4.4,3.7], bunk:[-1.11,6.3], desk:[-5.0,-4.5], med:[5.2,-3.4], tread:[-7.52,4.17], gym:[-5.2,2.6],
    cE:[17,0], suits:[15.8,0.5], cW:[-17,0], ghE:[-26.5,0], gh1:[-30.6,0.1], gh2:[-36.2,-0.1], cS:[0,-16], labE:[0,-21.8], lab1:[-4,-24.5], lab2:[2.0,-24.6] };
  const EDGES = [['hub','E'],['hub','W'],['hub','S'],['hub','N1'],['N1','gal'],['hub','tab'],['tab','bunk'],['tab','gym'],['gym','tread'],['hub','gym'],['hub','desk'],['hub','med'],['E','cE'],['cE','suits'],['W','cW'],['cW','ghE'],['ghE','gh1'],['gh1','gh2'],['S','cS'],['cS','labE'],['labE','lab1'],['labE','lab2']];
  const ADJ = {}; for(const [a,b] of EDGES){ (ADJ[a]=ADJ[a]||[]).push(b); (ADJ[b]=ADJ[b]||[]).push(a); }
  const SPOT = { gal:{face:[7.37,5.76],work:1}, tab:{face:[5.43,4.72]}, bunk:{face:[-1.4,8.0]}, gym:{face:[-9.18,4.09]}, desk:{face:[-6.50,-5.85],work:1}, med:{face:[6.17,-5.55],work:1}, tread:{face:[-6.6,3.66],run:1},
    suits:{face:[15.8,2]}, gh1:{face:[-30.6,1.8],work:1}, gh2:{face:[-36.2,-1.8],work:1}, lab1:{face:[-4,-26],work:1}, lab2:{face:[2.0,-26],work:1} };
  const CREW_DEF = [
    {tint:0x345caa, spots:['gal','tab','desk','tread','bunk','suits'], start:'gal'},
    {tint:0x6b4fb8, spots:['med','tab','lab1','lab2','desk','tread'], start:'med'},
    {tint:0x3a9a5c, spots:['gh1','gh2','gal','lab2','tab'], start:'gh1'},
  ];
  function route(a, b){ const prev = {[a]:null}, q = [a]; while(q.length){ const n = q.shift(); if(n===b) break; for(const m of ADJ[n]||[]) if(!(m in prev)){ prev[m] = n; q.push(m); } }
    const out = []; let n = b; while(n){ out.unshift(n); n = prev[n]; } return out; }
  function buildCrew(w){
    w.crew = CREW_DEF.map((d,k)=>{ const p = person('crew', d.tint); const at = NAV[d.start]; p.position.set(at[0], 0.3, at[1]); w.group.add(p);
      return { k, p, node:d.start, path:[], wait:3+k*2, ph:k, def:d, avail:true, ghOnly:false, x:at[0], z:at[1] }; });
  }
  function stepCrew(dt){
    if(!world || !world.crew) return;
    for(const n of world.crew){
      const p = n.p;
      if(n.path.length){
        const [tx,tz] = NAV[n.path[0]]; const dx = tx-n.x, dz = tz-n.z, d = Math.hypot(dx,dz);
        if(d < 0.15){ n.node = n.path.shift(); if(!n.path.length){ n.wait = 7 + Math.random()*9; } }
        else { const sp = Math.min(d, 1.25*dt); n.x += dx/d*sp; n.z += dz/d*sp; const want = Math.atan2(dx,dz); let dy = want - p.rotation.y; while(dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2; p.rotation.y += dy*Math.min(1,dt*8); n.ph += dt*7; animPerson(p, n.ph, 0.55, false); }
      } else {
        const sp = SPOT[n.node] || {}; n.wait -= dt; n.ph += dt*(sp.run?9:2.2);
        if(sp.face){ const want = Math.atan2(sp.face[0]-n.x, sp.face[1]-n.z); let dy = want - p.rotation.y; while(dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2; p.rotation.y += dy*Math.min(1,dt*4); }
        animPerson(p, n.ph, sp.run?0.6:0.05, !!sp.work);
        // stop and look at the commander when they are close
        if(mode==='walk' && Math.hypot(pl.x-n.x, pl.z-n.z) < 2.4){ const want = Math.atan2(pl.x-n.x, pl.z-n.z); let dy = want - p.rotation.y; while(dy>Math.PI) dy-=Math.PI*2; while(dy<-Math.PI) dy+=Math.PI*2; p.rotation.y += dy*Math.min(1,dt*5); n.wait = Math.max(n.wait, 1.5); animPerson(p, n.ph, 0.02, false); }
        if(n.wait <= 0){ const opts = n.def.spots.filter(s=>s!==n.node); const goal = opts[Math.floor(Math.random()*opts.length)]; n.path = route(n.node, goal).slice(1); }
      }
      const sp = SPOT[n.node]; const lift = (!n.path.length && sp && sp.run) ? 0.42 : 0;
      p.position.set(n.x, floorY(n.x, n.z) + lift, n.z);
    }
  }

  /* ---------- walk mode: first or third person ---------- */
  let mode = 'orbit', view = 'tp';
  const input = { keys:{}, jx:0, jy:0, run:false, jump:false };
  const pl = { x:6.5, z:0, y:0.3, vy:0, yaw:Math.PI/2, phase:0, near:null, ground:true, indoor:true, air:0 };
  const look = { yaw:Math.PI/2, pitch:-0.05 };
  let playerMesh = null, markers = [], hooks = { near:null, tick:null, jump:null, land:null };
  function buildWalk(w){
    playerMesh = person('astronaut'); playerMesh.visible = mode==='walk' && view==='tp';
    const lamp = new T.SpotLight(0xfff0d0, 0, 30, 0.5, 0.6); lamp.position.set(0,1.9,0.2); lamp.target.position.set(0,0,6); playerMesh.add(lamp, lamp.target); playerMesh.userData.lamp = lamp;
    w.group.add(playerMesh);
    drv.on = false; w.driver = person('astronaut'); w.driver.position.set(-0.22, 0.17, -0.42); w.driver.rotation.y = Math.PI/2; w.driver.visible = false;
    { const q = w.driver.userData.parts; if(q.legL){ q.legL.rotation.x = q.legR.rotation.x = -1.45; } if(q.armL){ q.armL.rotation.x = -0.75; q.armR.rotation.x = -0.95; } }
    w.rover.add(w.driver); w.rover.userData.wheels = ['wFL','wFR','wRL','wRR'].map(n=>find(w.rover,n));
    markers = STATIONS(w.pid).map(st=>{
      const grp = new T.Group(), indoor = st.in===true, R = indoor ? 0.75 : 1.3;
      const ring = new T.Mesh(new T.RingGeometry(R, R+0.25, 40), new T.MeshBasicMaterial({color:new T.Color(st.col), transparent:true, opacity:0.55, side:T.DoubleSide, depthWrite:false, fog:false})); ring.geometry.rotateX(-Math.PI/2); { const rp = ring.geometry.attributes.position, y0 = floorY(st.x, st.z); for(let i=0;i<rp.count;i++) rp.setY(i, indoor ? 0.06 : floorY(st.x+rp.getX(i), st.z+rp.getZ(i)) - y0 + 0.08); } grp.add(ring);
      const icon = iconSprite(st.icon, st.col, indoor ? 0.5 : 1.1); icon.position.y = indoor ? 1.85 : 3.0; icon.material.depthTest = indoor; grp.add(icon);
      grp.position.set(st.x, floorY(st.x, st.z), st.z); w.group.add(grp);
      return {st, grp, ring, icon};
    });
  }
  function tryMove(mx, mz){
    const step = (x,z)=> !blocked(x,z) && (floorY(x,z) - pl.y < 0.6 || !pl.ground && floorY(x,z) < pl.y);
    const nx = pl.x+mx, nz = pl.z+mz;
    if(step(nx,nz)){ pl.x = nx; pl.z = nz; } else if(step(nx,pl.z)){ pl.x = nx; } else if(step(pl.x,nz)){ pl.z = nz; }
  }
  function stepWalk(dt){
    if(drv.on){ stepDrive(dt); return; }
    const k = input.keys, G = built==='mars' ? 3.71 : 1.62;
    let ix = (k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft?1:0) + input.jx;
    let iy = (k.KeyW||k.ArrowUp?1:0) - (k.KeyS||k.ArrowDown?1:0) + input.jy;
    const m = Math.hypot(ix,iy); if(m>1){ ix/=m; iy/=m; }
    let fx, fz, rx, rz;
    if(view==='fp'){ fx = Math.sin(look.yaw); fz = Math.cos(look.yaw); rx = -Math.cos(look.yaw); rz = Math.sin(look.yaw); }
    else { fx = -Math.cos(cam.az); fz = -Math.sin(cam.az); rx = Math.sin(cam.az); rz = -Math.cos(cam.az); }
    const dx = fx*iy + rx*ix, dz = fz*iy + rz*ix, sp = Math.hypot(dx,dz);
    const run = k.ShiftLeft||k.ShiftRight||input.run;
    const speed = (pl.indoor ? (run ? 7.5 : 4.5) : (run ? 11 : 6.5)) * (pl.ground ? 1 : 0.85);
    if(sp > 0.05){
      const dist = speed*dt, n = Math.max(1, Math.ceil(dist/0.2));
      for(let i=0;i<n;i++) tryMove(dx*dist/n, dz*dist/n);
      if(view==='fp') pl.yaw = look.yaw;
      else { const want = Math.atan2(dx, dz); let dy = want - pl.yaw; while(dy > Math.PI) dy -= Math.PI*2; while(dy < -Math.PI) dy += Math.PI*2; pl.yaw += dy*Math.min(1, dt*10); }
      if(pl.ground) pl.phase += dt * speed * 1.5;
    } else { pl.phase *= 0.9; if(view==='fp') pl.yaw = look.yaw; }
    // jumping with the real surface gravity (Moon 1.62, Mars 3.71 m/s²)
    // inside the base the game uses an Earth-like jump (low ceilings); outside, real Moon/Mars gravity
    if(input.jump){ input.jump = false; if(pl.indoor && pl.ground){ pl.vy = 3.0; pl.ground = false; pl.air = 0; hooks.nojump && hooks.nojump(G); } else if(pl.ground){ pl.vy = 2.2; pl.ground = false; pl.air = 0; hooks.jump && hooks.jump(G); } }
    const fy = floorY(pl.x, pl.z);
    if(!pl.ground || pl.y > fy + 0.35){
      pl.ground = false; pl.air += dt; pl.vy -= (pl.indoor ? 9.81 : G)*dt; pl.y += pl.vy*dt;
      const ceil = ceilAt(pl.x, pl.z); if(pl.y + 1.95 > ceil){ pl.y = ceil - 1.95; if(pl.vy > 0) pl.vy = 0; }
      if(pl.y <= fy){ pl.y = fy; pl.vy = 0; pl.ground = true; hooks.land && hooks.land(pl.air); }
    } else { pl.y = fy; pl.vy = 0; pl.ground = true; }
    pl.indoor = !!region(pl.x, pl.z);
    const hop = pl.ground && sp > 0.05 && !pl.indoor ? Math.abs(Math.sin(pl.phase))*(built==='mars'?0.06:0.14) : 0;
    playerMesh.position.set(pl.x, pl.y + hop, pl.z); playerMesh.rotation.y = pl.yaw; playerMesh.visible = view==='tp';
    if(pl.ground) animPerson(playerMesh, pl.phase, sp > 0.05 ? 0.6 : 0, false);
    else { const q = playerMesh.userData.parts; if(q.legL){ q.legL.rotation.x = -0.5; q.legR.rotation.x = 0.3; } if(q.armL){ q.armL.rotation.x = -0.9; q.armR.rotation.x = -0.6; } }
    playerMesh.userData.lamp.intensity = (cur && isDark(cur, cur.day) && !pl.indoor) ? 2.4 : 0;
    // shadows follow the player
    sun.target.position.set(pl.x, 0, pl.z); sun.position.copy(world.sunDir).multiplyScalar(200).add(sun.target.position);
    Object.assign(sun.shadow.camera, {left:-40,right:40,top:40,bottom:-40}); sun.shadow.camera.updateProjectionMatrix();
    // what is close enough to use?
    let best = null, bd = 2.6;
    for(const mk of markers){ const on = mk.st.in==='both' || mk.st.in===pl.indoor || (!mk.st.in && !pl.indoor); mk.grp.visible = on; if(!on) continue;
      const d = Math.hypot(mk.st.x-pl.x, mk.st.z-pl.z); if(d < (mk.st.in===true ? 1.9 : 3.2) && d < bd + (mk.st.in===true?0:1)){ bd = d; best = mk.st.id; }
      mk.ring.material.opacity = 0.35 + 0.25*Math.sin(tNow*3);
      // indoor stations: no floating round icons (the E prompt and the minimap show them); only a faint floor ring when near
      if(mk.st.in===true){ mk.icon.visible = false; mk.ring.material.opacity = d < 3.5 ? 0.18 + 0.1*Math.sin(tNow*3) : 0; } }
    for(const n of world.crew){ const d = Math.hypot(n.x-pl.x, n.z-pl.z); if(d < 2.0 && d < bd){ bd = d; best = 'npc'+n.k; } }
    if(!pl.indoor && world.rover){ const d = Math.hypot(world.rover.position.x-pl.x, world.rover.position.z-pl.z); if(d < 3.4 && d < bd + 1){ bd = d; best = 'rover'; } }
    if(best !== pl.near){ pl.near = best; hooks.near && hooks.near(best); }
    hooks.tick && hooks.tick(dt, { indoor: pl.indoor, ground: pl.ground });
  }
  /* ---------- driving the rover ---------- */
  function roverPose(r, x, z, h){
    const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
    const g = (a,b)=> floorY(x+fx*a+lx*b, z+fz*a+lz*b);
    const fl = g(1.05,0.88), fr = g(1.05,-0.88), rl = g(-1.05,0.88), rr = g(-1.05,-0.88);
    r.rotation.order = 'YZX'; r.position.set(x, (fl+fr+rl+rr)/4, z);
    r.rotation.set(Math.atan2((fl+rl)-(fr+rr), 3.52), h - Math.PI/2, Math.atan2((fl+fr)-(rl+rr), 4.2));
  }
  function roverClear(x, z, h){
    const fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h);
    for(const [a,b] of [[1.6,0.95],[1.6,-0.95],[-1.5,0.95],[-1.5,-0.95],[1.6,0],[-1.5,0],[0,1.0],[0,-1.0]]){ const px = x+fx*a+lx*b, pz = z+fz*a+lz*b; if(region(px,pz) || blocked(px,pz)) return false; }
    return true;
  }
  function stepDrive(dt){
    const r = world.rover, k = input.keys;
    const ix = Math.max(-1, Math.min(1, (k.KeyD||k.ArrowRight?1:0) - (k.KeyA||k.ArrowLeft?1:0) + input.jx));
    const iy = Math.max(-1, Math.min(1, (k.KeyW||k.ArrowUp?1:0) - (k.KeyS||k.ArrowDown?1:0) + input.jy));
    const vmax = (k.ShiftLeft||k.ShiftRight||input.run) ? 11 : 7.5;
    if(input.jump){ input.jump = false; drv.v *= 0.3; }
    if(iy > 0) drv.v += (drv.v < 0 ? 7 : 3.4)*iy*dt; else if(iy < 0) drv.v += (drv.v > 0 ? 7 : 2.2)*iy*dt;
    else drv.v -= Math.sign(drv.v)*Math.min(Math.abs(drv.v), 1.8*dt);
    drv.v = Math.max(-3, Math.min(vmax, drv.v));
    drv.steer += (ix*0.5 - drv.steer)*Math.min(1, dt*5);
    const dh = -drv.v*Math.tan(drv.steer)/2.1*dt, nh = drv.h + dh, d = drv.v*dt;
    const nx = r.position.x + Math.sin(nh)*d, nz = r.position.z + Math.cos(nh)*d;
    if(roverClear(nx, nz, nh)){ drv.h = nh; roverPose(r, nx, nz, nh); if(view==='fp') look.yaw += dh; }
    else { if(Math.abs(drv.v) > 3) hooks.bump && hooks.bump(); drv.v = 0; }
    // terrain: slopes speed the rover up or slow it down, crests can throw it into a low-gravity hop
    const Gp = built==='mars' ? 3.71 : 1.62, tgt = r.position.y;
    if(drv.y == null){ drv.y = tgt; drv.prevT = tgt; drv.vy = 0; }
    drv.v -= Gp*Math.sin(r.rotation.z)*dt*1.6;
    drv.vy -= Gp*dt; drv.y += drv.vy*dt;
    if(drv.y <= tgt){ const climb = (tgt - drv.prevT)/Math.max(dt, 1e-3); if(drv.vy < -2.2){ hooks.bump && hooks.bump(); } drv.y = tgt; drv.vy = Math.max(0, Math.min(1.5, climb)); drv.air = 0; }
    else drv.air = (drv.air||0) + dt;
    drv.prevT = tgt; r.position.y = drv.y;
    if(drv.air > 0.15) r.rotation.z += 0.05*Math.sin(tNow*3);   // a little nose wobble while airborne
    r.userData.wheels.forEach((w,i)=>{ if(!w) return; w.rotation.z -= drv.v*dt/0.41; if(i<2) w.rotation.y = -drv.steer*0.8; });
    pl.x = r.position.x; pl.z = r.position.z; pl.y = r.position.y; pl.yaw = drv.h; pl.indoor = false; pl.ground = true;
    world.driver.visible = view==='tp'; playerMesh.visible = false;
    if(view!=='fp') camGoal.az = behind();
    playerMesh.userData.lamp.intensity = 0;
    sun.target.position.set(pl.x, 0, pl.z); sun.position.copy(world.sunDir).multiplyScalar(200).add(sun.target.position);
    markers.forEach(mk=>{ mk.grp.visible = !mk.st.in || mk.st.in==='both'; });
    if(pl.near !== 'rover'){ pl.near = 'rover'; hooks.near && hooks.near('rover'); }
    hooks.tick && hooks.tick(dt, { indoor:false, ground:true, driving:true, speed:Math.abs(drv.v) });
  }
  function drive(on){
    if(!world || !world.rover) return false;
    const r = world.rover;
    if(on){
      if(drv.on) return true;
      drv.on = true; drv.v = 0; drv.steer = 0; drv.y = null; drv.h = r.rotation.y + Math.PI/2; world.roverSolid[0] = 1e6;
      pl.yaw = drv.h; look.yaw = drv.h; look.pitch = -0.12; camGoal.az = behind(); cam.az = camGoal.az; kick(); return true;
    }
    if(!drv.on) return true;
    const h = drv.h, fx = Math.sin(h), fz = Math.cos(h), lx = Math.cos(h), lz = -Math.sin(h), x = r.position.x, z = r.position.z;
    for(const [a,b] of [[0,2.1],[0,-2.1],[-2.9,0],[2.9,0],[0,3.2],[0,-3.2]]){
      const px = x+fx*a+lx*b, pz = z+fz*a+lz*b;
      if(region(px,pz) || blocked(px,pz)) continue;
      drv.on = false; drv.v = 0; world.driver.visible = false; world.roverSolid[0] = x; world.roverSolid[1] = z;
      teleport(px, pz, h); playerMesh.visible = view==='tp'; return true;
    }
    return false;
  }
  let walkR = 7;
  function setMode(m){
    mode = m; if(m!=='walk') unlock(); if(!world) return;
    if(playerMesh) playerMesh.visible = m==='walk' && view==='tp';
    markers.forEach(mk=>mk.grp.visible = m==='walk');
    if(m==='walk'){ cam.drift = false; camGoal.el = 0.28; camGoal.az = behind(); }
    else { home(); Object.assign(sun.shadow.camera, {left:-70,right:70,top:70,bottom:-70}); sun.shadow.camera.updateProjectionMatrix(); sun.target.position.set(-6,0,-6); if(world) sun.position.copy(world.sunDir).multiplyScalar(220).add(sun.target.position); }
    kick();
  }
  function setView(v){ view = v==='fp' ? 'fp' : 'tp'; if(view!=='fp') unlock(); if(view==='fp'){ look.yaw = pl.yaw; look.pitch = -0.05; } else { camGoal.az = behind(); cam.az = camGoal.az; } if(playerMesh) playerMesh.visible = mode==='walk' && view==='tp'; kick(); return view; }
  function behind(){ return Math.atan2(-Math.cos(pl.yaw), -Math.sin(pl.yaw)); }
  function teleport(x, z, yaw){ if(drv.on && world){ drv.on = false; drv.v = 0; world.driver.visible = false; world.roverSolid[0] = world.rover.position.x; world.roverSolid[1] = world.rover.position.z; }
    pl.x = x; pl.z = z; pl.vy = 0; pl.ground = true; pl.y = world ? floorY(x,z) : 0.3; if(yaw!=null){ pl.yaw = yaw; look.yaw = yaw; } camGoal.az = behind(); cam.az = camGoal.az; kick(); }

  /* ---------- camera ---------- */
  const cam = { az:0.55, el:0.36, r:90, tx:-6, ty:2, tz:-6, drift:true };
  const camGoal = { ...cam };
  let drag = null;
  canvas.addEventListener('pointerdown', e=>{ drag = {x:e.clientX, y:e.clientY, az:camGoal.az, el:camGoal.el, yaw:look.yaw, pitch:look.pitch, id:e.pointerId}; try{ canvas.setPointerCapture(e.pointerId); }catch(_){} cam.drift = false; if(cine) cine.skip = true; });
  canvas.addEventListener('pointermove', e=>{ if(!drag || document.pointerLockElement === canvas) return;
    if(mode==='walk' && view==='fp'){ look.yaw = drag.yaw - (e.clientX-drag.x)*0.006; look.pitch = Math.max(-1.25, Math.min(1.25, drag.pitch - (e.clientY-drag.y)*0.005)); }
    else { camGoal.az = drag.az + (e.clientX-drag.x)*0.006; camGoal.el = Math.max(-0.05, Math.min(1.2, drag.el + (e.clientY-drag.y)*0.004)); }
    kick(); });
  const locked = ()=> document.pointerLockElement === canvas;
  canvas.addEventListener('click', ()=>{ if(mode!=='walk' || view!=='fp' || cine || locked() || !matchMedia('(pointer:fine)').matches) return;
    try{ const p = canvas.requestPointerLock(); if(p && p.catch) p.catch(()=>{}); }catch(_){} });
  document.addEventListener('mousemove', e=>{ if(!locked()) return; look.yaw -= (e.movementX||0)*0.0024; look.pitch = Math.max(-1.25, Math.min(1.25, look.pitch - (e.movementY||0)*0.002)); kick(); });
  function unlock(){ try{ if(locked()) document.exitPointerLock(); }catch(_){} }
  const up = ()=>{ drag = null; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', e=>{ e.preventDefault(); if(mode==='walk'){ walkR = Math.max(3, Math.min(26, walkR*(1+Math.sign(e.deltaY)*0.1))); kick(); return; } camGoal.r = Math.max(25, Math.min(220, camGoal.r * (1 + Math.sign(e.deltaY)*0.08))); cam.drift=false; kick(); }, {passive:false});
  canvas.addEventListener('keydown', e=>{ if(mode==='walk') return; const k = e.key; if(k==='ArrowLeft') camGoal.az -= 0.15; else if(k==='ArrowRight') camGoal.az += 0.15; else if(k==='ArrowUp') camGoal.el = Math.min(1.2, camGoal.el+0.08); else if(k==='ArrowDown') camGoal.el = Math.max(0.08, camGoal.el-0.08); else if(k==='+'||k==='=') camGoal.r = Math.max(25, camGoal.r*0.9); else if(k==='-') camGoal.r = Math.min(220, camGoal.r*1.1); else return; e.preventDefault(); cam.drift=false; kick(); });
  function walkCamera(){
    const hx = pl.x, hz = pl.z;
    if(view==='fp' && drv.on){ const v = world.rover.localToWorld(new T.Vector3(-0.12, 1.86, -0.42)); camera.position.copy(v);
      camera.lookAt(v.x + Math.sin(look.yaw)*Math.cos(look.pitch), v.y + Math.sin(look.pitch), v.z + Math.cos(look.yaw)*Math.cos(look.pitch)); return; }
    if(view==='fp'){ const hy = pl.y + 1.72; camera.position.set(hx, hy, hz);
      camera.lookAt(hx + Math.sin(look.yaw)*Math.cos(look.pitch), hy + Math.sin(look.pitch), hz + Math.cos(look.yaw)*Math.cos(look.pitch)); return; }
    const ty = pl.y + 1.6, R = pl.indoor ? Math.min(walkR, 4.6) : drv.on ? Math.max(walkR, 9) : walkR;
    const ex = Math.cos(cam.az)*Math.cos(cam.el), ey = Math.sin(cam.el), ez = Math.sin(cam.az)*Math.cos(cam.el);
    let r = R;
    if(pl.indoor){ for(let i=1;i<=14;i++){ const q = R*i/14, x = hx+ex*q, y = ty+ey*q, z = hz+ez*q; if(!region(x,z) || y > ceilAt(x,z) - 0.25 || blocked(x,z) && i>2){ r = Math.max(0.6, q - R/14 - 0.2); break; } } }
    let cx = hx+ex*r, cy = ty+ey*r, cz = hz+ez*r;
    if(!pl.indoor){ cy = Math.max(cy, Math.max(groundAt(cx,cz), world ? bermY(cx,cz,world.bermLayers) : -1e9) + 0.6); }
    camera.position.set(cx, cy, cz); camera.lookAt(hx, ty, hz);
  }

  /* ---------- animation loop ---------- */
  let raf = 0, last = 0, tNow = 0, cine = null; const perf = {n:0, k:0, sum:0, low:false, tier:0};
  const reduce = reduceMotion;
  function kick(){ if(!raf) raf = requestAnimationFrame(loop); }
  function resize(){
    const p = canvas.parentElement; if(!p) return false;
    const w = p.clientWidth, h = p.clientHeight; if(!w || !h) return false;
    const sz = renderer.getSize(new T.Vector2());
    if(sz.x !== w || sz.y !== h){ renderer.setSize(w, h, false); camera.aspect = w/h; }
    const fov = mode==='walk' ? (view==='fp' ? 70 : 58) : (w/h < 1.2 ? 55 : 42);
    if(camera.fov !== fov || sz.x !== w || sz.y !== h){ camera.fov = fov; camera.updateProjectionMatrix(); }
    return true;
  }
  function loop(t){
    raf = 0;
    if(!canvas.isConnected || document.hidden || !world) return;
    const dt = Math.min(0.25, (t - (last||t))/1000); last = t; tNow += dt;
    perf.n++; if(perf.n > 30){ perf.sum += dt; perf.k++; }   // skip the first frames (shader compile, loading)
    if(perf.k >= 90){ const avg = perf.sum/perf.k; perf.sum = 0; perf.k = 0;
      // step quality down while the game runs slower than ~35 fps: cheaper shadows, then no shadows and a smaller canvas
      if(avg > 0.028 && perf.tier < 3){ perf.tier++;
        const dpr = window.devicePixelRatio||1;
        if(perf.tier===1){ renderer.setPixelRatio(Math.min(1.25, dpr)); renderer.shadowMap.type = T.PCFShadowMap; sun.shadow.mapSize.set(1024,1024); if(sun.shadow.map){ sun.shadow.map.dispose(); sun.shadow.map = null; } }
        if(perf.tier===2){ renderer.setPixelRatio(Math.min(1, dpr)); renderer.shadowMap.enabled = false; perf.low = true; }
        if(perf.tier===3){ renderer.setPixelRatio(Math.min(0.75, dpr)); }
        scene.traverse(o=>{ if(o.material){ (Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.needsUpdate=true); } }); renderer.setSize(1,1,false); } }
    if(!resize()) return;
    const w = world;
    const walking = mode==='walk' && !cine;
    if(walking) stepWalk(dt);
    else if(cam.drift && !reduce && !cine) camGoal.az += dt*0.035;
    const k = 1 - Math.pow(walking ? 0.00002 : 0.0015, dt);
    for(const key of ['az','el','r','tx','ty','tz']) cam[key] += (camGoal[key]-cam[key])*k;
    if(walking) walkCamera();
    // Stable indoor lighting: inside the base the sun (which changes with the lunar day, flares and the player's
    // shadow box) is faded out and the room is lit only by the fixed ceiling lamps and a constant soft fill.
    { const want = (walking && pl.indoor && !drv.on) ? 1 : 0; LIT.k += (want - LIT.k)*Math.min(1, dt*5); const k = LIT.k;
      sun.intensity = LIT.sun*(1-k); fill.intensity = LIT.fill*(1-k);
      hemi.intensity = LIT.hemi*(1-k) + 0.62*k; hemi.color.lerpColors(LIT.sky, LIT.skyIn, k); hemi.groundColor.lerpColors(LIT.gnd, LIT.gndIn, k);
      renderer.toneMappingExposure = 1.05*(1-k) + 0.9*k; }
    if(w.berm){ const cp = camera.position; w.berm.visible = !(cp.x*cp.x + cp.y*cp.y + cp.z*cp.z < 118); }   // inside the dome the berm is behind the wall: skip it (no spikes, less to draw)
    else { camera.position.set(cam.tx + Math.cos(cam.az)*Math.cos(cam.el)*cam.r, cam.ty + Math.sin(cam.el)*cam.r, cam.tz + Math.sin(cam.az)*Math.cos(cam.el)*cam.r); camera.lookAt(cam.tx, cam.ty, cam.tz); }
    stepCrew(dt);
    const bl = (Math.sin(tNow*3)+1)/2;
    w.beacon.scale.setScalar(0.7+bl*0.6);
    if(w.dishHead) w.dishHead.rotation.z = Math.sin(tNow*0.25)*0.3;
    if(w.meteors) w.meteors.step(dt, camera, w.stars.visible !== false && w.stars.material.opacity > 0.2 && !reduce);
    if(w.rassor){ const r = w.rassor, u = r.userData; u.t += dt*0.09; const q = (1-Math.cos(u.t*Math.PI*2))/2, x = u.x0 + (u.x1-u.x0)*q, z = r.position.z;
      r.position.set(x, ground(x,z), z); r.rotation.y = Math.sin(u.t*Math.PI*2) >= 0 ? -Math.PI/2 : Math.PI/2; }
    if(w.heliRotors){ w.heliRotors.children[0].rotation.y += dt*0.6; w.heliRotors.children[1].rotation.y -= dt*0.6; }
    if(w.orbiter){ const o = w.orbiter; o.userData.ph = (o.userData.ph + dt/90) % 1; const a = -1.2 + o.userData.ph*2.4; o.position.set(Math.sin(a)*420, 260 + Math.cos(a)*120, -260 + Math.cos(a)*60); o.rotation.set(0.3, a*0.5, 0.2); o.visible = w.stars.material.opacity > 0.2; }
    if(walking){ w.told = w.told || {}; const near = (o,r)=> o && Math.hypot(pl.x-o.position.x, pl.z-o.position.z) < r;
      if(!w.told.v && near(w.viking, 7)){ w.told.v = 1; toast(L('Это «Викинг-2» NASA: настоящий аппарат сел здесь, на равнине Утопия, 3 сентября 1976 года. Модель из NASA 3D Resources.','This is NASA\'s Viking 2: the real lander touched down here in Utopia Planitia on 3 Sep 1976. Model from NASA 3D Resources.')); }
      else if(!w.told.r && near(w.rassor, 5)){ w.told.r = 1; toast(L('RASSOR: робот-копатель реголита, его создали в Космическом центре Кеннеди NASA. Модель из NASA 3D Resources.','RASSOR: a regolith-digging robot designed at NASA Kennedy Space Center. Model from NASA 3D Resources.')); } }
      else if(!w.told.o && near(w.marsO2, 6)){ w.told.o = 1; toast(L('Кислородная установка: берёт углекислый газ из воздуха Марса и делает из него кислород. Так работал опыт MOXIE на марсоходе Perseverance NASA, он сделал 122 г кислорода.','Oxygen plant: it takes carbon dioxide from the Martian air and makes oxygen. NASA’s MOXIE experiment on the Perseverance rover did this and made 122 g of oxygen.')); }
      else if(!w.told.h && near(w.heli, 5)){ w.told.h = 1; toast(L('Вертолёт-разведчик. Настоящий вертолёт NASA Ingenuity совершил на Марсе 72 полёта, хотя воздух там в 100 раз реже земного.','Scout helicopter. NASA’s real Ingenuity helicopter made 72 flights on Mars, even though the air there is 100 times thinner than on Earth.')); }
      else if(!w.told.s && w.marsShell && Math.hypot(pl.x, pl.z) < 17 && Math.hypot(pl.x, pl.z) > 12){ w.told.s = 1; toast(L('На Марсе купол накрыт оболочкой, напечатанной 3D-принтером из марсианского грунта. NASA проводило конкурс таких домов (3D-Printed Habitat Challenge). Оболочка защищает от радиации и холода.','On Mars the dome is covered by a shell 3D-printed from Martian soil. NASA ran a contest for such homes (the 3D-Printed Habitat Challenge). The shell protects from radiation and cold.')); }
    if(w.bagger){ const g = w.bagger, on = Math.sin(tNow*5) > 0.2; g.beacon.material.emissiveIntensity = on ? 2.4 : 0.2; if(g.bl) g.bl.intensity = on ? 1.6 : 0; if(g.fill){ const f = (tNow*0.08)%1; const sy = 0.35+0.65*f; g.fill.scale.set(1, sy, 1); g.fill.position.y = 0.09+0.31*sy; } }
    if(w.earth) w.earth.rotation.y += dt*0.02;
    if(w.dust.visible){ const p = w.dust.geometry.attributes.position; const ox = mode==='walk'?pl.x:0, oz = mode==='walk'?pl.z:0; w.dust.position.set(ox, pl.y, oz); for(let i=0;i<p.count;i++){ let x = p.getX(i)+dt*(18+ (i%7)*3); if(x>100) x-=200; p.setX(i,x); p.setY(i, (p.getY(i)+dt*((i%5)-2)*0.6+30)%30); } p.needsUpdate = true; }
    if(w.protons.visible){ if(mode==='walk') w.protons.position.set(pl.x, pl.y, pl.z); const p = w.protons.geometry.attributes.position; for(let i=0;i<p.count;i++){ let y = p.getY(i)-dt*(35+(i%9)*4); if(y<0) y+=30; p.setY(i,y); } p.needsUpdate = true; }
    if(w.lander.visible) w.lander.userData.flame.material.opacity *= 0.96;
    for(const d of [w.door, w.door2]){ if(!d) continue; const want = (cine || (mode==='walk' && Math.hypot(pl.x-d.x, pl.z) < (d===w.door2 ? 3.6 : 4.8)) || (w.crew && w.crew.some(n=>Math.hypot(n.x-d.x, n.z) < 2.6))) ? 1 : 0;
      if(d.open !== want){ d.open = want > d.open ? Math.min(1, d.open + dt*2.6) : Math.max(0, d.open - dt*1.6); d.L.position.x = -1.62*d.open; d.R.position.x = 1.62*d.open; d.lamp.material.emissive.setHex(d.open > 0.05 ? 0x20ff60 : 0xff2020); } }
    for(let i=tweens.length-1;i>=0;i--){ const tw = tweens[i]; tw.t += dt; const q = Math.min(1, tw.t/tw.d); tw.f(q); if(q>=1){ tweens.splice(i,1); tw.done && tw.done(); } }
    if(cine) cine.step(dt);
    renderer.render(scene, camera);
    const alive = mode==='walk' || !reduce || tweens.length || cine || drag || Math.abs(camGoal.az-cam.az)>0.001 || Math.abs(camGoal.r-cam.r)>0.01 || (w.crew && w.crew.length);
    if(alive) raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('resize', kick);

  const ease = q => q<0.5 ? 2*q*q : 1 - Math.pow(-2*q+2,2)/2;
  const back = q => { const c1=1.70158, c3=c1+1; return 1 + c3*Math.pow(q-1,3) + c1*Math.pow(q-1,2); };
  function tween(d, f, done){ tweens.push({t:0, d, f, done}); kick(); }
  function grow(o, delay=0){ o.scale.setScalar(0.001); tween(delay+0.9, q=>{ const r = Math.max(0,(q*(delay+0.9)-delay)/0.9); o.scale.setScalar(Math.max(0.001, back(r))); }, ()=>o.scale.setScalar(1)); puff(o.position); }
  function puff(at){
    if(!world) return; const n = 60, g = new T.BufferGeometry(), a = new Float32Array(n*3), v = [];
    for(let i=0;i<n;i++){ a[i*3]=at.x; a[i*3+1]=at.y+0.3; a[i*3+2]=at.z; v.push([(Math.random()-0.5)*6, Math.random()*3, (Math.random()-0.5)*6]); }
    g.setAttribute('position', new T.BufferAttribute(a,3));
    const p = new T.Points(g, new T.PointsMaterial({color: built==='mars'?0xd09060:0xbfbfbf, size:0.45, transparent:true, opacity:0.9, depthWrite:false})); world.group.add(p);
    tween(1.6, q=>{ const pa = g.attributes.position; for(let i=0;i<n;i++){ pa.setXYZ(i, at.x+v[i][0]*q*1.4, at.y+0.3+v[i][1]*q*(1.6-q*1.2), at.z+v[i][2]*q*1.4); } pa.needsUpdate = true; p.material.opacity = 0.9*(1-q); }, ()=>{ world && world.group.remove(p); g.dispose(); });
  }
  function sparks(at, color=0xffd070){
    const n=40, g=new T.BufferGeometry(), a=new Float32Array(n*3), v=[]; for(let i=0;i<n;i++){ v.push([(Math.random()-0.5)*4, Math.random()*4, (Math.random()-0.5)*4]); }
    g.setAttribute('position', new T.BufferAttribute(a,3));
    const p = new T.Points(g, new T.PointsMaterial({color, size:0.25, transparent:true, blending:T.AdditiveBlending, depthWrite:false})); world.group.add(p);
    tween(1.2, q=>{ const pa=g.attributes.position; for(let i=0;i<n;i++) pa.setXYZ(i, at.x+v[i][0]*q, at.y+v[i][1]*q-4*q*q, at.z+v[i][2]*q); pa.needsUpdate=true; p.material.opacity=1-q; }, ()=>{ world && world.group.remove(p); g.dispose(); });
  }

  /* ---------- per-step cinematic ---------- */
  const SITE = {
    panel: s => SLOT.panel(Math.max(0, Math.min(s.panels,16)-1)), battery: s => SLOT.battery(Math.max(0, Math.min(Math.round((s.batCap-BAT_START_CAP)/BAT_ADD),7))),
    greenhouse: s => new T.Vector3(GH.x, 0, GH.z), reactor: () => SLOT.reactor(), shield: () => new T.Vector3(16,0,-9),
    science: s => SLOT.drill(s.pid), ice: s => SLOT.drill(s.pid), clean: () => SLOT.panel(1), repair: () => new T.Vector3(19,0,-1), rest: () => new T.Vector3(0,0,0),
  };
  const EVA = new Set(['panel','battery','reactor','shield','science','ice','clean']);
  function focus(v, r, el){ camGoal.tx = v.x*0.8; camGoal.tz = v.z*0.8; camGoal.ty = 2; if(r) camGoal.r = r; if(el!=null) camGoal.el = el; }
  function home(){ Object.assign(camGoal, {tx:-6, ty:2, tz:-6, r:90, el:0.4}); }

  function play(before, after, act, ev, caption){
    return new Promise(res=>{
      const wasWalk = mode==='walk'; if(wasWalk){ mode = 'orbit'; if(playerMesh) playerMesh.visible = false; markers.forEach(mk=>mk.grp.visible=false); Object.assign(cam, {az:camGoal.az, el:0.35, r:60, tx:pl.x, ty:2, tz:pl.z}); }
      if(!ready || !world || !canvas.isConnected){ sync(after); if(wasWalk) setMode('walk'); res(); return; }
      const capEl = document.getElementById('scap');
      if(capEl){ capEl.innerHTML = caption; capEl.classList.add('on'); }
      Object.assign(sun.shadow.camera, {left:-70,right:70,top:70,bottom:-70}); sun.shadow.camera.updateProjectionMatrix(); sun.target.position.set(-6,0,-6); sun.position.copy(world.sunDir).multiplyScalar(220).add(sun.target.position);
      const added = sync(after, {animate:true, day:before.day, action:act, noFlare:false});
      const site = (SITE[act]||SITE.rest)(after);
      const eva = EVA.has(act);
      const a = world.astro; place(a, AIRLOCK); a.visible = eva;
      if(act==='rest') focus(new T.Vector3(0,0,0), 34, 0.35); else if(act==='greenhouse'||act==='repair') focus(site, 30, 0.5); else focus(site, eva ? 40 : 44, 0.32);
      if(reduce){ added.forEach(o=>o.scale.setScalar(1)); finish(); return; }
      const path = { from: AIRLOCK.clone(), to: site.clone().add(new T.Vector3(site.x>AIRLOCK.x?-3:3,0,2.5)) };
      let t = 0, phase = 0; const walkT = eva ? Math.min(3.2, path.from.distanceTo(path.to)/12) : 0;
      cine = { skip:false, step(dt){
        if(this.skip){ added.forEach(o=>o.scale.setScalar(1)); cine=null; finish(); return; }
        t += dt;
        if(eva && t < walkT){ const q = ease(t/walkT); const p = path.from.clone().lerp(path.to, q); place(a, p); a.lookAt(path.to.x, a.position.y, path.to.z); animPerson(a, t*12, 0.6, false); a.position.y += Math.abs(Math.sin(t*6))*0.25; }
        else if(phase===0){ phase = 1; a.lookAt(site.x, a.position.y, site.z); animPerson(a, 0, 0, true);
          added.forEach((o,i)=>grow(o, i*0.15));
          if(act==='clean'){ world.panels.forEach(p=>sparks(p.position.clone().add(new T.Vector3(0,2.4,0)), 0xbfe0ff)); }
          if(act==='repair'){ sparks(new T.Vector3(19,2.2,-1)); sparks(new T.Vector3(20,2.4,-1.2)); }
          if(act==='science'||act==='ice'){ const bit = world.drillBit || world.drill; const y0 = bit.position.y; tween(1.4, q=>{ bit.rotation.y = q*40; if(world.drillBit) bit.position.y = y0 - q*0.8; }, ()=>{ if(world.drillBit) bit.position.y = y0; }); puff(world.drill.position.clone()); }
          if(act==='rest'){ const L0 = world.lamps[0], i0 = 0.42; tween(1.4, q=>{ L0.intensity = i0 + Math.sin(q*Math.PI)*1.2; }); }
          if(act==='shield' && world.berm && !added.includes(world.berm)) puff(new T.Vector3(16,0.5,-9));
        }
        if(eva && phase===1) animPerson(a, t*6, 0, true);
        if(phase===1 && t > walkT + 1.5){ phase = 2;
          if(after.lv.comm>0){ const b = world.beam; tween(1.0, q=>{ b.material.opacity = 0.22*Math.sin(q*Math.PI); }); }
          const fl = flareOn(after, before.day); if(fl){ world.protons.position.set(0,0,0); world.protons.visible = fl.s>0; const s0 = built==='mars'?260:400; sunSprite.scale.setScalar(s0); tween(1.2, q=>{ sunSprite.scale.setScalar(s0 - q*s0*0.35); }); }
          if(PLANETS[after.pid].cargo.includes(before.day)){ const ld = world.lander; ld.visible = true; const y0 = ld.position.y; ld.userData.flame.material.opacity = 1; tween(1.2, q=>{ ld.position.y = y0 + (1-ease(q))*30; ld.userData.flame.material.opacity = 1-q*0.6; }, ()=>{ puff(ld.position.clone()); }); }
        }
        if(t > walkT + (eva?2.6:2.2)){ cine = null; finish(); }
      }};
      kick();
      function finish(){ a.visible = false; if(capEl) capEl.classList.remove('on'); home(); sync(after); if(wasWalk){ teleport(0.9, 4.4, Math.PI); setMode('walk'); } res(); }
    });
  }

  /* static snapshot for menu previews */
  function snapshot(pid, w, h){
    if(!ready) return null;
    const s = newState(pid, 1234, 'engineer'); s.sched = {dark:[99], darkLens:[1], flares:[99], ev:[SOLAR[0],SOLAR[1]]}; s.shield = 1; s.lv.comm = 100; s.reactor = pid==='moon'; s.gh = 4; s.panels = 8;
    const host = document.createElement('div'); host.style.cssText = `position:fixed;left:-9999px;top:0;width:${w}px;height:${h}px`; document.body.appendChild(host); const prev = canvas.parentElement; host.appendChild(canvas);
    const save = {...camGoal}, saveC = {...cam}, m0 = mode; mode = 'orbit'; sync(s); resize();
    if(playerMesh) playerMesh.visible = false; markers.forEach(mk=>mk.grp.visible=false);
    sun.target.position.set(-6,0,-6); sun.position.copy(world.sunDir).multiplyScalar(220).add(sun.target.position); Object.assign(sun.shadow.camera, {left:-70,right:70,top:70,bottom:-70}); sun.shadow.camera.updateProjectionMatrix();
    Object.assign(cam, {az:0.9, el:0.3, r:78, tx:-8, ty:2, tz:-4}); camera.fov = 42; camera.updateProjectionMatrix(); camera.position.set(cam.tx + Math.cos(cam.az)*Math.cos(cam.el)*cam.r, cam.ty + Math.sin(cam.el)*cam.r, cam.tz + Math.sin(cam.az)*Math.cos(cam.el)*cam.r); camera.lookAt(cam.tx,cam.ty,cam.tz);
    renderer.render(scene, camera); const url = canvas.toDataURL('image/jpeg', 0.85);
    host.remove(); if(prev) prev.prepend(canvas); Object.assign(camGoal, save); Object.assign(cam, saveC); mode = m0; if(mode==='walk') setMode('walk');
    if(cur && cur!==s) sync(cur);
    return url;
  }

  function mount(container){ if(canvas.parentElement !== container) container.prepend(canvas); resize(); kick(); }
  function replay(entry){ if(!cur) return Promise.resolve(); const a = entry.act; const cap = document.getElementById('scap');
    const after = clone(cur); return play(after, after, a, [], cap ? `${tr(PLANETS[cur.pid].dayName)} ${entry.day} · ${esc(val(ACT[a].name, cur))}` : ''); }
  function mapData(){ if(!world) return null; return { pl:{x:pl.x, z:pl.z, yaw: view==='fp' ? look.yaw : pl.yaw}, st: markers.map(m=>({x:m.st.x, z:m.st.z, col:m.st.col, id:m.st.id})), crew: (world.crew||[]).map(n=>({x:n.x, z:n.z})), indoor: pl.indoor }; }
  return { unlock:()=>unlock(), groundAt:(x,z)=>groundAt(x,z), _dbg:()=>({scene, camera, renderer, world, pl, look, blocked, floorY, region}), setMode, get mode(){ return mode; }, setView, get view(){ return view; }, input, teleport, hooks, get near(){ return pl.near; }, drive, get driving(){ return drv.on; }, get indoor(){ return pl.indoor; },
    sync, mount, play, snapshot, replay, mapData, get ready(){ return ready; }, onReady(f){ if(ready) f(); else whenReady.push(f); }, get busy(){ return !!cine; }, skip(){ if(cine) cine.skip = true; } };
})();
