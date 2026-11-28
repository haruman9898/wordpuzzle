// 1単語の通し（フリープレイ）: 実際のドラッグで全パーツをはめ、完成・コイン・次の単語を確認する
const {launch,state,fitOne} = require('./lib.js');
const OUT = process.env.OUT || '/tmp', URL = (process.env.URL||'http://localhost:8123')+'/index.html?dev=1';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
(async()=>{
  const {b,p,errs} = await launch();
  await p.goto(URL); await p.waitForTimeout(500);
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); WP.game.newWord('BIRD'); });
  await p.waitForTimeout(300);
  let st = await state(p);
  ok(st.word==='BIRD' && st.slots.length===7 && st.pieces.length===7,'BIRD builds 7 slots / 7 pieces');
  await p.screenshot({path:OUT+'/g1.png'});
  let n=0; while(await fitOne(p)) { if(++n>20) break; }
  await p.waitForTimeout(250);
  st = await state(p);
  ok(st.slots.every(s=>s.filled),'all 7 slots filled by real drags');
  ok(st.combo===7 && st.misses===0,'combo x7, no misses (combo='+st.combo+', misses='+st.misses+')');
  ok(st.busy,'word-complete celebration is running');
  await p.waitForTimeout(4600);
  st = await state(p);
  ok(st.coins===5,'5 coins arrived in the jar ('+st.coins+')');
  ok(st.word!=='BIRD' && !st.busy,'next word started ('+st.word+')');
  const log = await p.evaluate(()=>WP.log.entries.length);
  ok(log===1,'play log has 1 entry');
  console.log('errors',errs); await b.close();
})();
