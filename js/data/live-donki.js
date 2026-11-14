/* Live NASA DONKI space weather (shown only when it really loaded) */
"use strict";
/* ============================================================
   LIVE NASA DONKI ("space weather today")
   Only shown as live when the request actually succeeded.
   ============================================================ */
let liveState = 'idle', liveSummary = '';
function refreshLiveBoxes(){
  const a = document.getElementById('liveStart'); if(a) a.innerHTML = liveBoxHTML();
  const b = document.querySelector('#live span'); if(b) b.innerHTML = liveState==='ok' ? liveSummary : liveState==='fail' ? L('онлайн-данные сейчас недоступны. Игра использует архив выше.','live data is not reachable right now. The game uses the archive above.') : L('проверяем связь…','checking the link…');
}
async function getJSON(paths){
  for(const u of paths){
    try{
      const ctl = new AbortController(); const to = setTimeout(()=>ctl.abort(), 7000);
      const r = await fetch(u, {signal: ctl.signal}); clearTimeout(to);
      if(!r.ok) continue; const d = await r.json(); if(Array.isArray(d)) return d;
    }catch(e){ /* next */ }
  }
  return null;
}
async function loadLive(){
  if(liveState==='loading' || liveState==='ok') return;
  liveState = 'loading'; refreshLiveBoxes();
  const end = new Date(), start = new Date(end.getTime() - 30*86400000);
  const q = d => d.toISOString().slice(0,10);
  const both = kind => [`https://kauai.ccmc.gsfc.nasa.gov/DONKI/WS/get/${kind}?startDate=${q(start)}&endDate=${q(end)}`, `https://api.nasa.gov/DONKI/${kind}?startDate=${q(start)}&endDate=${q(end)}&api_key=DEMO_KEY`];
  const flr = await getJSON(both('FLR'));
  if(!flr){ liveState = 'fail'; refreshLiveBoxes(); return; }
  const sep = (await getJSON(both('SEP'))) || [];
  const xs = flr.filter(f=>/^X/.test(f.classType||'')).length;
  const rank = c => { const m = /^([CMX])(\d+(?:\.\d+)?)/.exec(c||''); return m ? ({C:1,M:10,X:100})[m[1]]*parseFloat(m[2]) : 0; };
  const strong = flr.filter(f=>/^[MX]/.test(f.classType||'')).sort((a,b)=>rank(b.classType)-rank(a.classType));
  liveSummary = flr.length
    ? L(`за последние 30 дней ${flr.length} ${plural(flr.length,'вспышка','вспышки','вспышек')}, из них класса X: ${xs}; протонных событий: ${sep.length}.`,`in the last 30 days: ${flr.length} ${flr.length===1?'flare':'flares'}, ${xs} of class X; ${sep.length} proton ${sep.length===1?'event':'events'}.`)
    : L('за последние 30 дней вспышек не записано.','no flares recorded in the last 30 days.');
  if(strong.length){
    const f = strong[0]; const t = new Date(f.peakTime || f.beginTime);
    const hasSep = sep.some(e=>{ const st = new Date(e.eventTime); return st >= t - 3600e3 && st - t < 3*86400e3; });
    LIVE = { date: (f.peakTime||f.beginTime||'').slice(0,10), cls: f.classType, s: hasSep?1:0, pfu:'—', ar: f.activeRegionNum ? String(f.activeRegionNum) : '', dose: hasSep?20:1, src:'NASA DONKI', live:true,
      note: hasSep ? {ru:'Онлайн-данные NASA DONKI: после этой вспышки зарегистрирован поток протонов (SEP). В игре он считается слабой бурей S1.',en:'Live NASA DONKI data: a proton event (SEP) was recorded after this flare. The game treats it as a minor S1 storm.'}
                   : {ru:'Онлайн-данные NASA DONKI: протонного события после вспышки не зарегистрировано, поэтому доза почти не вырастет.',en:'Live NASA DONKI data: no proton event was recorded after this flare, so the dose barely changes.'} };
    useLive = true;
  }
  liveState = 'ok'; refreshLiveBoxes();
}
