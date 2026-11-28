const {launch,state,fitOne,drag} = require('./lib.js');
(async()=>{
  const {b,p,errs} = await launch();
  await p.goto(''+(process.env.URL||'http://localhost:8123')+'/index.html');
  await p.waitForTimeout(500);
  await p.evaluate(()=>{WP.flow.freePlay(); WP.game.newWord('BIRD');});
  await p.waitForTimeout(300);
  let st = await state(p);
  console.log('word',st.word,'slots',st.slots.length,'pieces',st.pieces.length,'scale',st.s.toFixed(2),'W,H',st.W,st.H);
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/g1.png'});
  // 全パーツをはめる
  let n=0; while(await fitOne(p)) { n++; if(n===3) await p.screenshot({path:(process.env.OUT||'/tmp')+'/g2.png'}); if(n>20)break; }
  await p.waitForTimeout(250);
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/g3.png'});
  st = await state(p);
  console.log('after fits: busy',st.busy,'combo',st.combo,'misses',st.misses,'filled',st.slots.filter(s=>s.filled).length,'/',st.slots.length);
  await p.waitForTimeout(1200);
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/g4.png'});
  await p.waitForTimeout(3500);
  st = await state(p);
  console.log('after celebration: word',st.word,'coins',st.coins, 'busy', st.busy);
  console.log('log:\n'+await p.evaluate(()=>WP.logText()));
  console.log('errors',errs);
  await b.close();
})();
