// 単語のイラスト（完成時に表示）と、単語図鑑
const {launch,state,fitOne} = require('./lib.js');
const OUT = process.env.OUT || '/tmp', BASE = process.env.URL||'http://localhost:8123';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const flow = p => p.evaluate(()=>WP.flow.debug());
async function waitState(p, want, ms=8000){ const t=Date.now(); while(Date.now()-t<ms){ if(await p.evaluate(()=>WP.flow.state())===want) return true; await p.waitForTimeout(60);} return false; }
async function completeWord(p){ let n=0; while(n++<30){ const st=await state(p); if(!st.slots||st.slots.every(s=>s.filled)) break; await fitOne(p); } }
// 絵の位置・大きさは、アニメーション（拡大・回転）の影響を受けない、レイアウト上の値で測る
const pic = p => p.evaluate(()=>{ const w=document.querySelector('#wordPic'); const s=document.querySelector('#stage').getBoundingClientRect(); const i=w.querySelector('img');
  return { hidden:w.hidden, shown:WP.pics.visible(), w:w.offsetWidth, top:w.offsetTop, bottom:w.offsetTop+w.offsetHeight, stageH:s.height, left:w.offsetLeft, right:w.offsetLeft+w.offsetWidth, stageW:s.width, nat:i.naturalWidth, tag:!document.querySelector('#newTag').hidden }; });
(async()=>{
  let {b,p,errs} = await launch(393,700);
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(400);
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.progress.unlockAll(); WP.book.reset(); WP.fx.resetCoins(); });

  // 1) 28枚すべてが読み込める。出題される単語との対応
  const load = await p.evaluate(()=>Promise.all(WP.pics.words.map(w=>new Promise(res=>{ const i=new Image(); i.onload=()=>res([w,i.naturalWidth]); i.onerror=()=>res([w,0]); i.src=WP.pics.url(w); }))));
  ok(load.length===28 && load.every(x=>x[1]===256),'all 28 illustrations load at 256px ('+load.filter(x=>x[1]!==256).map(x=>x[0])+')');
  const cov = await p.evaluate(()=>{ const pool=[...new Set(WP.STAGES.flatMap(s=>s.pool))]; return { withPic:pool.filter(w=>WP.pics.has(w)).length, noPic:pool.filter(w=>!WP.pics.has(w)), all:pool.length, stage1Pics:WP.STAGES[0].pool.filter(w=>WP.pics.has(w)).length, later:WP.STAGES.slice(1).flatMap(s=>s.pool).filter(w=>!WP.pics.has(w)) }; });
  ok(cov.withPic===28 && cov.all===40 && cov.stage1Pics===0 && cov.later.length===0,'28 of 40 words have pictures: every word in stages 2-6, none in stage 1 ('+cov.withPic+'/'+cov.all+')');

  // 1b) 縦に伸びている4枚は、横に広げて見せる。ほかは、ほぼ等倍。大きさの印象をそろえる
  const tf = await p.evaluate(()=>{ const o={}; WP.pics.words.forEach(w=>{ const m=/scale\(([\d.]+), ([\d.]+)\)/.exec(WP.pics.transformOf(w)); o[w]=[+m[1],+m[2]]; }); return o; });
  const stretched=['SUN','EGG','BEE','MILK'];
  ok(stretched.every(w=>tf[w][0]/tf[w][1]>1.05) && Object.keys(tf).filter(w=>!stretched.includes(w)).every(w=>Math.abs(tf[w][0]/tf[w][1]-1)<0.001),'only the 4 vertically stretched pictures are widened');
  ok(Object.values(tf).every(v=>v[1]>=0.8 && v[1]<=1.12),'every picture is scaled within 0.8-1.12 (balanced sizes)');

  // 2) ステージ2: 完成すると絵がポンと出る（初めてなので NEW! とコインのボーナス）
  await p.evaluate(()=>WP.flow.startStage(2)); ok(await waitState(p,'play'),'stage 2 reaches play');
  ok((await pic(p)).hidden,'no picture while playing');
  const w1 = (await state(p)).word;
  await completeWord(p); await p.waitForTimeout(700);
  let g = await pic(p);
  ok(!g.hidden && g.shown && g.nat===256,'picture pops when '+w1+' completes');
  ok(g.w>=110 && g.w<=184 && g.top>=0 && g.bottom<=g.stageH && g.left>=0 && g.right<=g.stageW,'picture fits inside the stage ('+Math.round(g.w)+'px, top '+Math.round(g.top)+', bottom '+Math.round(g.bottom)+' / '+Math.round(g.stageH)+')');
  ok(g.top >= 700*0.36*0.8,'picture sits below the word card / banner area (top='+Math.round(g.top)+')');
  ok(g.tag,'NEW! tag on the first completion');
  ok((await flow(p)).coinsRun===10,'first-time word gives COINS_PER_WORD + NEW_WORD_BONUS (10)');
  ok(await p.evaluate(w=>WP.book.count(w),w1)===1,'the word is recorded in the book');
  await p.screenshot({path:OUT+'/q_pop.png'});
  // 次の単語になると、絵は消える
  ok(await waitState(p,'play',9000),'next word starts');
  ok((await pic(p)).hidden,'picture is gone when the next word starts');

  // 3) すでに図鑑にある単語は、NEW! もボーナスもない
  const w2 = (await state(p)).word; await p.evaluate(w=>WP.book.record(w),w2);
  await completeWord(p); await p.waitForTimeout(700); g = await pic(p);
  ok(!g.hidden && !g.tag,'no NEW! tag for a word already in the book');
  ok((await flow(p)).coinsRun===15,'no bonus for a known word (10 + 5)');

  // 4) 最後まで: 結果画面に、そのステージの単語の絵が並ぶ
  ok(await waitState(p,'play',9000),'word 3 ready'); await completeWord(p); await p.waitForTimeout(2300);
  ok((await flow(p)).state==='result','stage 2 cleared');
  const col = await p.evaluate(()=>({imgs:document.querySelectorAll('#resPics img').length, chips:document.querySelectorAll('#resPics .chip').length}));
  ok(col.imgs===3 && col.chips===0,'result screen shows 3 pictures ('+JSON.stringify(col)+')');
  await p.waitForTimeout(1500); await p.screenshot({path:OUT+'/q_result.png'});

  // 5) ステージ1（2文字）: 絵は出ない。NEW! は文字で出る。結果は文字のチップ
  await p.evaluate(()=>WP.flow.startStage(1)); ok(await waitState(p,'play'),'stage 1 reaches play');
  await completeWord(p); await p.waitForTimeout(600);
  ok((await pic(p)).hidden,'no picture for a 2-letter word');
  ok(await p.evaluate(()=>[...document.querySelectorAll('.float')].some(e=>e.textContent==='NEW!')),'a NEW! label appears for a new picture-less word');
  ok(await waitState(p,'play',9000),'stage 1 word 2 ready'); await completeWord(p); await p.waitForTimeout(2300);
  const col1 = await p.evaluate(()=>({imgs:document.querySelectorAll('#resPics img').length, chips:document.querySelectorAll('#resPics .chip').length}));
  ok(col1.imgs===0 && col1.chips===2,'stage 1 result shows text chips ('+JSON.stringify(col1)+')');

  // 6) ずかん
  await p.evaluate(()=>WP.flow.goBook('title')); await p.waitForTimeout(200);
  const book = await p.evaluate(()=>({count:document.querySelector('#bookCount').textContent, cards:document.querySelectorAll('.bk').length, seen:document.querySelectorAll('.bk.seen').length, sil:document.querySelectorAll('.bk img.sil').length, chips:document.querySelectorAll('.chips .chip').length, chipSeen:document.querySelectorAll('.chips .chip.seen').length}));
  ok(book.cards===28 && book.chips===12,'book lists 28 pictured words + 12 text words');
  ok(book.seen===3 && book.sil===25 && book.chipSeen===2,'seen cards are colored, unseen are silhouettes ('+JSON.stringify(book)+')');
  ok(book.count==='5 / 40','book shows progress 5 / 40 ('+book.count+')');
  await p.screenshot({path:OUT+'/q_book.png'});
  await p.click('.bk.seen'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.querySelector('#bookDetail').hidden && /かい/.test(document.querySelector('#bdCount').textContent)),'tapping a seen card opens the detail');
  await p.screenshot({path:OUT+'/q_detail.png'});
  await p.click('#bookDetail'); await p.waitForTimeout(100);
  ok(await p.evaluate(()=>document.querySelector('#bookDetail').hidden),'tapping the detail closes it');
  await p.evaluate(()=>{ document.querySelector('.bk:not(.seen)').click(); });
  ok(await p.evaluate(()=>document.querySelector('#bookDetail').hidden),'tapping an unseen card does nothing');
  await p.click('#btnBookBack'); await p.waitForTimeout(100);
  ok(await p.evaluate(()=>WP.flow.state())==='title','back returns to the title');
  await p.reload(); await p.waitForTimeout(400); await p.evaluate(()=>WP.flow.goBook('select')); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>document.querySelector('#bookCount').textContent)==='5 / 40','book survives a reload');

  // 7) 絵が読み込めない時は、何も出さない（エラーも出ない）
  await p.evaluate(()=>{ WP.flow.freePlay(); });
  await p.route('**/assets/images/words/cat.webp*', r=>r.abort());
  await p.evaluate(()=>{ WP.game.newWord('CAT'); }); await p.waitForTimeout(400);
  await completeWord(p); await p.waitForTimeout(700);
  ok((await pic(p)).hidden,'a missing picture shows nothing (no broken image)');
  ok(errs.filter(e=>!/ERR_FAILED|Failed to load resource/.test(e)).length===0,'no script errors when a picture is missing');
  console.log('errors',errs.filter(e=>!/ERR_FAILED|Failed to load resource/.test(e))); await b.close();

  // 8) 小さい画面でも、絵が枠に収まる（5文字 + お邪魔パーツ）
  for (const [W,H] of [[393,641],[375,667]]) {
    ({b,p,errs} = await launch(W,H));
    await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(300);
    await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); WP.game.show('HAPPY',{animate:false,decoys:4}); }); await p.waitForTimeout(250);
    const r = await p.evaluate(()=>{ const d=WP.game.debug(); const shown=WP.pics.pop('HAPPY',true,Math.round(d.H*0.36)+64,d.poolBottom); return {shown,H:d.H,pb:d.poolBottom}; });
    await p.waitForTimeout(600); g = await pic(p);
    ok(r.shown && g.w>=110 && g.bottom<=g.stageH && g.top>=0,'picture fits at '+W+'x'+H+' ('+Math.round(g.w)+'px, bottom '+Math.round(g.bottom)+' / '+Math.round(g.stageH)+')');
    console.log('errors',errs); await b.close();
  }
})();
