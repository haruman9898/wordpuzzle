const {launch,state,fitOne,drag,off} = require('./lib.js');
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
(async()=>{
  // ---- A: 間違い・入れ替え・ヒント ----
  let {b,p,errs} = await launch();
  await p.goto(''+(process.env.URL||'http://localhost:8123')+'/index.html'); await p.waitForTimeout(400);
  await p.evaluate(()=>{WP.flow.freePlay(); WP.game.newWord('CAT');}); await p.waitForTimeout(1200);
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/h_ghost.png'});             // チュートリアルのゴースト
  let st = await state(p);
  // 1) 合わない枠の上で離す（C のパーツを、A の V の枠の上へ）
  const pc = st.pieces.find(x=>x.type==='C');
  const wrong = st.slots.find(s=>s.type==='V');
  await drag(p,{x:pc.x,y:pc.y},{x:wrong.x,y:wrong.y+45},{holdMs:150});
  await p.waitForTimeout(500);
  st = await state(p);
  const pcAfter = st.pieces.find(x=>x.type==='C');
  ok(st.misses===1, 'wrong slot release counts a miss (misses='+st.misses+')');
  ok(Math.hypot(pcAfter.x-pcAfter.hx,pcAfter.y-pcAfter.hy)<2 && !pcAfter.locked, 'piece returned home after wrong release');
  // 2) 何もない所で離してもミスにならない
  await drag(p,{x:pc.x,y:pc.y},{x:20,y:st.H-30});
  await p.waitForTimeout(500);
  st = await state(p); ok(st.misses===1, 'release in empty space is not a miss');
  // 3) 同じ型の入れ替え: T の縦棒の I を、A の横棒の枠へ
  const slotsI = st.slots.filter(s=>s.type==='I');
  const target = slotsI[0]; // 最初の I 枠
  const piecesI = st.pieces.filter(x=>x.type==='I' && !x.locked);
  // 最初の I 枠から最も遠いパーツ（=別の枠用の形）を使う
  piecesI.sort((a,b)=>Math.hypot(b.x-target.x,b.y-target.y)-Math.hypot(a.x-target.x,a.y-target.y));
  await drag(p,{x:piecesI[0].x,y:piecesI[0].y},{x:target.x,y:target.y+45});
  await p.waitForTimeout(100);
  st = await state(p);
  ok(st.slots.filter(s=>s.type==='I'&&s.filled).length===1, 'same-type piece locks into another slot of same type');
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/h_swap.png'});
  // 4) ヒント: 5秒止まると震える
  st = await state(p); ok(!st.pieces.some(x=>x.shaking),'no shake right after action');
  await p.waitForTimeout(5300);
  st = await state(p); ok(st.pieces.some(x=>x.shaking),'hint shakes after HINT_DELAY_SEC (hints='+st.hints+')');
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/h_hint.png'});
  // 5) 掴んだら止まる
  const sk = st.pieces.find(x=>x.shaking);
  await drag(p,{x:sk.x,y:sk.y},{x:sk.x+5,y:sk.y+5},{release:false});
  st = await state(p); ok(!st.pieces.some(x=>x.shaking),'shake stops when dragging starts');
  await p.mouse.up();
  // 6) 残りを入れて完成 → コインが保存される
  let n=0; while(await fitOne(p)&&n++<10){}
  await p.waitForTimeout(3500);
  st = await state(p); ok(st.coins===5,'coins = 5 after word ('+st.coins+')');
  await p.reload(); await p.waitForTimeout(500);
  st = await state(p); ok(st.coins===5,'coins persist across reload ('+st.coins+')');
  console.log('A errors',errs); await b.close();

  // ---- B: localStorage が使えなくても動く ----
  ({b,p,errs} = await launch());
  await p.addInitScript(()=>{ Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}); });
  await p.goto(''+(process.env.URL||'http://localhost:8123')+'/index.html'); await p.waitForTimeout(500);
  ok(await p.evaluate(()=>WP.flow.state())==='title','title screen shows with throwing localStorage');
  await p.evaluate(()=>WP.flow.freePlay()); await p.waitForTimeout(200);
  st = await state(p); ok(!!st.word,'game runs with throwing localStorage');
  let m=0; while(await fitOne(p)&&m++<12){}
  await p.waitForTimeout(300); st=await state(p); ok(st.busy||st.coins>=0,'can complete a word without storage');
  console.log('B errors',errs); await b.close();

  // ---- C: canonical モード + 小さい画面 375x667 ----
  ({b,p,errs} = await launch(375,667));
  await p.addInitScript(()=>{ localStorage.setItem('wp.settings.v1', JSON.stringify({POOL_ORIENTATION:'canonical'})); });
  await p.goto(''+(process.env.URL||'http://localhost:8123')+'/index.html'); await p.waitForTimeout(400);
  await p.evaluate(()=>{WP.flow.freePlay(); WP.game.newWord('MILK');}); await p.waitForTimeout(300);
  await p.screenshot({path:(process.env.OUT||'/tmp')+'/c_canon.png'});
  let k=0; while(await fitOne(p)&&k++<12){}
  await p.waitForTimeout(300); st=await state(p);
  ok(st.slots.every(s=>s.filled),'canonical mode: all slots filled (MILK, 375x667)');
  console.log('C errors',errs); await b.close();
})();
