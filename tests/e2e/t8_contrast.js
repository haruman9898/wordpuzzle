// 着せ替え 5背景 × 5文字色 = 25通りの読みやすさ（コントラスト比）を調べる。
// 基準 = 承認済みの「ふつう」の文字色 × 「クリーム」背景 の、いちばん悪い値。これより悪い組み合わせがあれば失敗。
const {chromium} = require('playwright');
const BASE = process.env.URL||'http://localhost:8123';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
function lin(c){ c/=255; return c<=0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055,2.4); }
function lum(h){ const n=parseInt(h.slice(1),16); return 0.2126*lin(n>>16&255)+0.7152*lin(n>>8&255)+0.0722*lin(n&255); }
function cr(a,b){ const A=lum(a),B=lum(b); return (Math.max(A,B)+0.05)/(Math.min(A,B)+0.05); }
(async()=>{
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(300);
  const d = await p.evaluate(()=>{ const x=WP.shop.data(); x.eff={}; x.bg.forEach(t=>x.pal.forEach(pl=>{ x.eff[t.id+'|'+pl.id]=WP.shop.effective(pl.id,t.id); })); x.floor=WP.shop.floor(); return x; }); await b.close();
  const types = Object.keys(d.pal[0].colors);
  // 背景に対して（パーツが置き場で見える）と、枠の色に対して（はめた文字が、空の枠と区別できる）
  const bgOf = t => [t.vars['--bg1'], t.vars['--bg2']];
  function worst(theme, pal, colors){ colors=colors||pal.colors; let wb=99, ws=99, wbT='', wsT='';
    types.forEach(k=>{ const c=colors[k]; const rb=Math.min(cr(c,bgOf(theme)[0]),cr(c,bgOf(theme)[1])); const rs=cr(c,theme.vars['--slot']);
      if(rb<wb){wb=rb;wbT=k;} if(rs<ws){ws=rs;wsT=k;} });
    return {wb,wbT,ws,wsT}; }
  const base = worst(d.bg[0], d.pal[0]);
  console.log('floor (standard on cream): vs background '+base.wb.toFixed(2)+' ('+base.wbT+'), vs empty slot '+base.ws.toFixed(2)+' ('+base.wsT+')');
  let bad=0;
  d.bg.forEach(t=>d.pal.forEach(pl=>{ const w=worst(t,pl,d.eff[t.id+'|'+pl.id]); const f1=w.wb>=base.wb-0.01, f2=w.ws>=base.ws-0.01;
    if(!(f1&&f2)){ bad++; console.log('  low: '+t.id+' x '+pl.id+'  bg '+w.wb.toFixed(2)+'('+w.wbT+')  slot '+w.ws.toFixed(2)+'('+w.wsT+')'); } }));
  ok(Math.abs(base.wb-d.floor.bg)<0.01 && Math.abs(base.ws-d.floor.slot)<0.01,'the floor in the game matches the accepted default');
  ok(bad===0,'all 25 background x color-set pairs are at least as readable as the accepted default ('+bad+' below the floor)');
})();
