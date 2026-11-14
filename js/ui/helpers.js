/* Number formatting and small helpers */
"use strict";
/* ============================================================
   HELPERS
   ============================================================ */
function fmt(n, d=1){ return Number(n).toLocaleString(LANG==='en'?'en-US':'ru-RU',{maximumFractionDigits:d, minimumFractionDigits:0}); }
function sgn(n, d=1){ const r = Number(n.toFixed(d)); return (r>0?'+':r<0?'−':'±') + fmt(Math.abs(r), d); }
function plural(n,a,b,c){ n=Math.abs(n)%100; const n1=n%10; if(n>10&&n<20) return c; if(n1>1&&n1<5) return b; if(n1===1) return a; return c; }
function esc(t){ return String(t).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
const U = { kg:()=>L('кг','kg'), l:()=>L('л','L'), kwh:()=>L('кВт·ч','kWh'), msv:()=>L('мЗв','mSv') };

const ICON = {
  power:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11.5 1.5 4 11h5l-1 7.5L15.5 9h-5z" fill="var(--power)"/></svg>',
  o2:'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="8.5" fill="none" stroke="var(--o2)" stroke-width="1.6"/><text x="10" y="13.4" text-anchor="middle" font-size="8.5" font-weight="700" fill="var(--o2)" font-family="JetBrains Mono,monospace">O₂</text></svg>',
  water:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2C10 2 4 9 4 12.5a6 6 0 0 0 12 0C16 9 10 2 10 2z" fill="var(--water)"/></svg>',
  food:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 3.5C8 3.5 3.5 7.5 3.5 13c0 1.3.3 2.4.8 3.3C6 12 9 9.5 12.5 8 9.5 10 7 13 5.6 17.3c.9.5 2 .7 3.2.7 5.8 0 7.7-6.3 7.7-14.5z" fill="var(--food)"/></svg>',
  hp:'<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 17.5S2.5 13 2.5 7.6A4 4 0 0 1 10 5.5a4 4 0 0 1 7.5 2.1C17.5 13 10 17.5 10 17.5z" fill="var(--hp)"/></svg>',
  rad:'<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="1.8" fill="var(--rad)"/><path d="M10 10 6.2 3.4A7.6 7.6 0 0 1 13.8 3.4zM10 10l7.6 0a7.6 7.6 0 0 1-3.8 6.6zM10 10l-3.8 6.6A7.6 7.6 0 0 1 2.4 10z" fill="var(--rad)"/></svg>',
};
