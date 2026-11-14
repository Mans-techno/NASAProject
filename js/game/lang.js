/* Language: Russian / English */
"use strict";
/* ============================================================
   LANGUAGE
   ============================================================ */
let LANG = 'ru';
try { const q = new URLSearchParams(location.search).get('lang'); LANG = q || localStorage.getItem('outpost-lang') || ((navigator.language||'').startsWith('ru') ? 'ru' : 'en'); } catch(e) {}
if(LANG!=='ru' && LANG!=='en') LANG = 'ru';
const L = (ru, en) => LANG==='en' ? en : ru;
const tr = x => (x && typeof x==='object' && 'ru' in x) ? x[LANG] : x;
function setLang(l){ LANG = l; try{ localStorage.setItem('outpost-lang', l); }catch(e){} document.documentElement.lang = l; document.title = L('Юный астронавт: База','Junior Astronaut: Outpost'); }
