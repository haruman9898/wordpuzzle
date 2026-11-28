// 画面の大きさが変わっても（iPhone のアドレスバーの出入り）、はめた分・コンボ・ミスを引き継ぐ
const {launch,state,fitOne} = require('./lib.js');
const URL = (process.env.URL||'http://localhost:8123')+'/index.html?dev=1';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
(async()=>{
  const {b,p,errs} = await launch(393,641);
  await p.goto(URL); await p.waitForTimeout(400);
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); WP.game.newWord('BIRD'); });
  await p.waitForTimeout(200);
  await fitOne(p); await fitOne(p); await fitOne(p); await p.waitForTimeout(200);
  let a = await state(p);
  const filledBefore = a.slots.filter(s=>s.filled).length;
  ok(filledBefore===3 && a.combo===3,'3 slots filled, combo 3 before resize');
  await p.setViewportSize({width:393,height:760}); await p.waitForTimeout(500);
  let c = await state(p);
  ok(c.slots.filter(s=>s.filled).length===3,'filled slots survive a resize (393x641 -> 393x760)');
  ok(c.pieces.filter(x=>!x.locked).length===c.slots.length-3,'remaining pieces = unfilled slots');
  ok(c.combo===3,'combo survives resize ('+c.combo+')');
  await p.setViewportSize({width:393,height:641}); await p.waitForTimeout(500);
  // 続きを遊んで完成できる
  let n=0; while(await fitOne(p)&&n++<10){}
  await p.waitForTimeout(250); c = await state(p);
  ok(c.slots.every(s=>s.filled),'can finish the word after resizing twice');
  console.log('errors',errs); await b.close();
})();
