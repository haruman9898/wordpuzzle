// ステージ4〜6（お邪魔パーツ）: 出題の範囲、お邪魔パーツの動き、置き場の重なり、1ステージの通し
const {launch,state,fitOne,drag} = require('./lib.js');
const OUT = process.env.OUT || '/tmp', BASE = process.env.URL||'http://localhost:8123';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const flow = p => p.evaluate(()=>WP.flow.debug());
async function waitState(p, want, ms=8000){ const t=Date.now(); while(Date.now()-t<ms){ if(await p.evaluate(()=>WP.flow.state())===want) return true; await p.waitForTimeout(60);} return false; }
async function completeWord(p){ let n=0; while(n++<24){ const st=await state(p); if(!st.slots||st.slots.every(s=>s.filled)) break; await fitOne(p); } }
(async()=>{
  let {b,p,errs} = await launch(393,700);
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(400);
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); });

  // 1) 出題: 200回引いて、全て範囲内・重複なし・条件を満たす
  const draw = await p.evaluate(()=>WP.STAGES.slice(3).map(st=>{ let bad=0, rep=0, longBad=0, none=0; const all=new Set();
    for(let i=0;i<200;i++){ const ws=WP.drawWords(st,[]); if(!ws||!ws.length){none++;continue;} const tot=ws.reduce((a,w)=>a+WP.partsOf(w),0); ws.forEach(w=>all.add(w));
      if(tot<st.band[0]||tot>st.band[1]) bad++; if(new Set(ws).size!==ws.length||ws.length!==st.words) rep++; if(ws.filter(w=>w.length>=(st.longLen||4)).length<(st.minLong||0)) longBad++; }
    return {id:st.id,bad,rep,longBad,none,variety:all.size}; }));
  draw.forEach(d=>ok(d.bad===0&&d.rep===0&&d.longBad===0&&d.none===0,'stage '+d.id+': 200 draws in band, distinct, conditions met (words seen: '+d.variety+')'));
  ok(await p.evaluate(()=>WP.STAGES.length)===6,'6 stages defined');

  // 2) 解放: ステージ4は、3をクリアするまで閉じている
  await p.evaluate(()=>{ WP.progress.clear(); WP.progress.setStars(1,3); WP.progress.setStars(2,3); WP.flow.goSelect(); });
  let dis = await p.evaluate(()=>[...document.querySelectorAll('.cardbtn')].map(b=>b.disabled||b.classList.contains('locked')));
  ok(dis.length===6 && dis[2]===false && dis[3]===true,'6 cards; stage 4 locked until stage 3 is cleared ('+dis+')');
  await p.screenshot({path:OUT+'/n_select6.png'});
  await p.evaluate(()=>{ WP.progress.setStars(3,3); WP.flow.goSelect(); });
  dis = await p.evaluate(()=>[...document.querySelectorAll('.cardbtn')].map(b=>b.disabled));
  ok(dis[3]===false && dis[4]===true,'clearing stage 3 opens stage 4');

  // 3) ステージ4を始める: お邪魔パーツが2つ、そのワードに使わない型
  await p.click('.cardbtn[data-id="4"]');
  ok(await waitState(p,'play'),'stage 4 reaches play');
  let st = await state(p);
  const decoys = st.pieces.filter(x=>x.decoy), real = st.pieces.filter(x=>!x.decoy);
  const wordTypes = new Set(st.slots.map(s=>s.type));
  ok(decoys.length===2 && real.length===st.slots.length,'2 decoys plus one piece per slot ('+decoys.length+' + '+real.length+')');
  ok(decoys.every(d=>!wordTypes.has(d.type)),'decoy types are not used by the word ('+decoys.map(d=>d.type)+' vs '+[...wordTypes]+')');
  await p.screenshot({path:OUT+'/n_stage4.png'});

  // 4) お邪魔パーツを枠の上で離す → ミス、元の場所へ戻る、はまらない
  const dc = decoys[0], sl = st.slots[0];
  await drag(p,{x:dc.x,y:dc.y},{x:sl.x,y:sl.y+45},{holdMs:150}); await p.waitForTimeout(500);
  let a = await state(p); const dcA = a.pieces.filter(x=>x.decoy)[0];
  ok(a.misses===1 && !dcA.locked && Math.hypot(dcA.x-dcA.hx,dcA.y-dcA.hy)<2,'dropping a decoy on a slot is a miss and it returns home (misses='+a.misses+')');
  ok(a.combo===0,'the miss resets the combo');

  // 5) ヒントはお邪魔パーツを指さない
  await p.waitForTimeout(5400); a = await state(p);
  ok(a.pieces.some(x=>x.shaking) && !a.pieces.filter(x=>x.shaking).some(x=>x.decoy),'the hint shakes a real piece, never a decoy');

  // 6) お邪魔パーツを無視して、ワードを完成できる。完成したらお邪魔パーツは消える
  await completeWord(p); await p.waitForTimeout(500);
  const gone = await p.evaluate(()=>[...document.querySelectorAll('#board g.piece')].map(g=>getComputedStyle(g.querySelector('.pinner')).opacity));
  ok((await flow(p)).idx===1,'word 1 completed with decoys present');
  ok(gone.length>=1 && gone.every(o=>parseFloat(o)<0.6),'decoys fade out when the word completes ('+gone+')');

  // 7) ステージ4を最後まで（残り3語）
  for (let k=0;k<3;k++){ ok(await waitState(p,'play',9000),'word '+(k+2)+' ready'); await completeWord(p); await p.waitForTimeout(300); }
  await p.waitForTimeout(2200);
  ok((await flow(p)).state==='result' && await p.evaluate(()=>WP.progress.stars(4))>=1,'stage 4 cleared via real drags -> result, stars saved ('+await p.evaluate(()=>WP.progress.stars(4))+')');
  await p.screenshot({path:OUT+'/n_result4.png'});
  ok(await p.evaluate(()=>WP.progress.unlocked(5)),'stage 5 unlocked');
  console.log('errors',errs); await b.close();

  // 8) 置き場の重なり: ステージ5・6 の単語 + お邪魔パーツで、小さい画面でも収まる
  for (const [W,H] of [[393,641],[375,667],[393,760]]) {
    ({b,p,errs} = await launch(W,H));
    await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(300);
    const res = await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); const out=[];
      [['BIRD',2],['MOON',2],['APPLE',3],['WATER',4],['HAPPY',4],['HOUSE',4],['BEACH',4],['MUSIC',4],['PIZZA',4],['TRAIN',4]].forEach(([w,n])=>{ let maxOv=0, oob=0, minS=9;
        for(let i=0;i<25;i++){ WP.game.show(w,{animate:false,decoys:n}); const d=WP.game.debug(); minS=Math.min(minS,d.s);
          const ps=d.pieces; let ov=0; for(let x=0;x<ps.length;x++){ const A=ps[x]; if(A.hx-A.w/2<0||A.hx+A.w/2>d.W||A.hy+A.h/2>d.H) oob++; for(let y=x+1;y<ps.length;y++){ const B=ps[y]; if(Math.abs(A.hx-B.hx)<(A.w+B.w)/2 && Math.abs(A.hy-B.hy)<(A.h+B.h)/2) ov++; } } maxOv=Math.max(maxOv,ov); }
        out.push({w,n,maxOv,oob,minS:+minS.toFixed(2)}); }); return out; });
    const bad = res.filter(r=>r.maxOv>0||r.oob>0), tiny = Math.min(...res.map(r=>r.minS));
    ok(bad.length===0,'no overlap/out-of-bounds with decoys at '+W+'x'+H+' (smallest scale '+tiny+')'+(bad.length?' '+JSON.stringify(bad):''));
    ok(tiny>=0.8,'letters stay big enough to drag at '+W+'x'+H+' (min scale '+tiny+' >= 0.8)');
    await p.evaluate(()=>{ WP.game.show('HAPPY',{animate:false,decoys:4}); }); await p.waitForTimeout(250);
    await p.screenshot({path:OUT+'/n_happy_'+W+'x'+H+'.png'});
    console.log('errors',errs); await b.close();
  }
})();
