// iPhone 風の環境（vibrate なし）で、振動の呼び出し（方式・場面・回数）を確認する。実際の触覚は実機でしか分からない。
const {chromium} = require('playwright');
const {state,fitOne} = require('./lib.js');
const URL = (process.env.URL||'http://localhost:8123')+'/index.html?dev=1';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
(async()=>{
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:393,height:700}, deviceScaleFactor:2,
    userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1' });
  const p = await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(()=>{ Object.defineProperty(navigator,'vibrate',{value:undefined,configurable:true});
    window.__clicks=0; window.__iclicks=0; document.addEventListener('click',e=>{ if(e.target && e.target.tagName==='LABEL') window.__clicks++; if(e.target && e.target.tagName==='INPUT' && e.target.hasAttribute('switch')) window.__iclicks++; },true); });
  await p.goto(URL); await p.waitForTimeout(400);
  ok((await p.evaluate(()=>WP.hapticMode())).startsWith('ios-switch'),'iPhone-like env uses the ios-switch path ('+await p.evaluate(()=>WP.hapticMode())+')');
  // 方式ごとに、強さに応じた回数のクリックが同期で出る
  for (const m of ['label-onscreen','label-offscreen','input','dispatch','ondemand']) {
    const r = await p.evaluate((m)=>{ WP.hapticSetMethod(m); const get=()=> m==='input' ? window.__iclicks : window.__clicks; window.__clicks=0; window.__iclicks=0; WP.haptic('light'); const a=get(); window.__clicks=0; window.__iclicks=0; WP.haptic('strong'); return [a,get()]; }, m);
    ok(r[0]===1 && r[1]===3, 'method '+m+' fires 1 / 3 ticks for light / strong ('+r+')');
  }
  // touchend に遅らせる方式
  const d = await p.evaluate(()=>{ WP.hapticSetMethod('label-onscreen'); WP.cfg.IOS_HAPTIC_CTX='touchend'; window.__clicks=0; WP.hapticDeferred('light'); const before=window.__clicks; document.dispatchEvent(new Event('touchend')); return [before,window.__clicks]; });
  ok(d[0]===0 && d[1]===1,'touchend mode waits for touchend ('+d+')');
  await p.evaluate(()=>{ WP.cfg.IOS_HAPTIC_CTX='pointerup'; });
  // ゲーム中: パーツをはめると、振動の呼び出しが出る
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.cfg.HAPTIC_ON_GRAB=false; WP.flow.freePlay(); WP.game.newWord('IT'); window.__clicks=0; });
  await p.waitForTimeout(200);
  await fitOne(p); await p.waitForTimeout(100);
  ok(await p.evaluate(()=>window.__clicks)>=1,'locking a piece fires a haptic call ('+await p.evaluate(()=>window.__clicks)+')');
  // 開発メニューの実験ボックスが動く
  await p.evaluate(()=>{ WP.flow.goTitle(); }); await p.click('#btnTitleDev'); await p.waitForTimeout(150);
  const boxes = await p.evaluate(()=>document.querySelectorAll('#hx .xbox').length);
  ok(boxes===8,'experiment menu has 8 boxes (A–H) ('+boxes+')');
  const res = await p.evaluate(()=>{ const out={}; const fire=(x,evs)=>{ window.__clicks=0; const b=document.querySelector('.xbox[data-x="'+x+'"]'); evs.forEach(t=>b.dispatchEvent(new Event(t,{bubbles:true}))); return window.__clicks; };
    out.A=fire('A',['click']); out.B=fire('B',['touchend']); out.C=fire('C',['pointerup']); out.D=fire('D',['pointerdown']); out.E=fire('E',['touchstart']); out.H=fire('H',['pointerup']); return out; });
  ok(['A','B','C','D','E','H'].every(k=>res[k]>=1),'each experiment box fires its haptic call '+JSON.stringify(res));
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/hx.png', fullPage:false});
  console.log('errors',errs); await b.close();
})();
