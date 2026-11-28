// ステージ構造のテスト（タイトル→選択→プレイ→結果／失敗、タイマー、星、一時停止、世代のずれ、出題の範囲）
const {launch,state,fitOne} = require('./lib.js');
const OUT = process.env.OUT || '/tmp', URL = (process.env.URL||'http://localhost:8123')+'/index.html';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const flow = p => p.evaluate(()=>WP.flow.debug());
async function waitPlay(p, ms=6000){ const t=Date.now(); while(Date.now()-t<ms){ if(await p.evaluate(()=>WP.flow.state())==='play') return true; await p.waitForTimeout(50);} return false; }
async function completeWord(p){ let n=0; while(n++<14){ const st=await state(p); if(!st.slots||st.slots.every(s=>s.filled)) break; await fitOne(p); } }
(async()=>{
  const W=+process.env.W||390, H=+process.env.H||844;
  let {b,p,errs} = await launch(W,H);
  await p.goto(URL); await p.waitForTimeout(400);

  // 1) タイトル→選択
  ok(await p.evaluate(()=>WP.flow.state())==='title','starts on title');
  await p.screenshot({path:OUT+'/s_title.png'});
  await p.click('#btnPlay'); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>WP.flow.state())==='select','select screen after Play');
  const dis = await p.evaluate(()=>[...document.querySelectorAll('.cardbtn')].map(b=>b.disabled));
  ok(dis[0]===false && dis[1]===true && dis[2]===true,'only stage 1 unlocked at first ('+dis+')');
  await p.screenshot({path:OUT+'/s_select.png'});

  // 2) ステージ1 開始 → タイマー
  await p.click('.cardbtn[data-id="1"]');
  await p.waitForTimeout(300); await p.screenshot({path:OUT+'/s_intro.png'});
  ok(await waitPlay(p),'reaches play state after intro + fly-in');
  let f1 = await flow(p); await p.waitForTimeout(1000); let f2 = await flow(p);
  ok(f2.elapsed-f1.elapsed>800 && f2.elapsed-f1.elapsed<1300,'timer runs while playing (+'+Math.round(f2.elapsed-f1.elapsed)+'ms)');
  ok(f2.words.length===2,'stage 1 has 2 words ('+f2.words+')');
  await p.screenshot({path:OUT+'/s_play.png'});

  // 3) 1語目を完成 → ボーナス・演出中は時間が止まる
  const leftBefore=(await flow(p)).left;
  await completeWord(p);
  await p.waitForTimeout(120);
  let fc = await flow(p);
  ok(fc.state==='celebrate' && fc.idx===1,'celebrate after word 1 (idx='+fc.idx+')');
  ok(fc.bonus===2,'bonus +2s added (bonus='+fc.bonus+')');
  await p.screenshot({path:OUT+'/s_celebrate.png'});
  await p.waitForTimeout(700); let fd=await flow(p);
  ok(Math.abs(fd.elapsed-fc.elapsed)<5,'timer is stopped during celebration');
  ok(await waitPlay(p,5000),'next word starts after celebration');
  await p.screenshot({path:OUT+'/s_play2.png'});

  // 4) 2語目を完成 → 結果（⭐3）
  await completeWord(p); await p.waitForTimeout(1900);
  fc = await flow(p);
  ok(fc.state==='result','result screen after last word');
  await p.waitForTimeout(1500);
  const nStar = await p.evaluate(()=>document.querySelectorAll('#resStars .st.on').length);
  ok(nStar===3,'3 stars for a fast clear ('+nStar+')');
  await p.screenshot({path:OUT+'/s_result.png'});
  ok(await p.evaluate(()=>WP.progress.stars(1))===3,'progress saved (stage 1 = 3 stars)');
  ok(await p.evaluate(()=>WP.progress.unlocked(2)),'stage 2 unlocked');
  await p.reload(); await p.waitForTimeout(400); await p.click('#btnPlay'); await p.waitForTimeout(150);
  const dis2 = await p.evaluate(()=>[...document.querySelectorAll('.cardbtn')].map(b=>b.disabled));
  ok(dis2[1]===false,'progress survives reload (stage 2 open)');
  await p.screenshot({path:OUT+'/s_select2.png'});

  // 5) 時間切れ → 失敗 → リトライ（新しい単語）
  await p.click('.cardbtn[data-id="1"]'); await waitPlay(p);
  const w1 = (await flow(p)).words.slice();
  await p.evaluate(()=>WP.flow.setTimeLeft(8)); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.querySelector('#strip').classList.contains('warn')),'timer turns red at <=10s');
  await p.screenshot({path:OUT+'/s_warn.png'});
  await p.evaluate(()=>WP.flow.setTimeLeft(0.6)); await p.waitForTimeout(1300);
  ok(await p.evaluate(()=>WP.flow.state())==='fail','time up -> fail');
  ok(await p.evaluate(()=>!document.querySelector('#scrFail').hidden),'fail overlay visible');
  await p.screenshot({path:OUT+'/s_fail.png'});
  await p.click('#btnFailRetry'); await waitPlay(p);
  const w2 = (await flow(p)).words.slice();
  ok(!w2.some(w=>w1.includes(w)),'retry draws new words ('+w1+' -> '+w2+')');

  // 6) 一時停止でタイマーが止まる
  await p.click('#pauseBtn'); await p.waitForTimeout(100);
  const pa = await flow(p); await p.waitForTimeout(900); const pb = await flow(p);
  ok(pa.state==='paused' && Math.abs(pb.elapsed-pa.elapsed)<5,'pause freezes the timer');
  await p.screenshot({path:OUT+'/s_pause.png'});
  await p.click('#btnResume'); await p.waitForTimeout(500); const pc = await flow(p);
  ok(pc.running && pc.elapsed>pb.elapsed+300,'resume continues the timer');
  // アプリが裏に回ったら止まる
  await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:true,configurable:true}); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(100); ok(await p.evaluate(()=>WP.flow.state())==='paused','hidden page pauses the game');
  await p.evaluate(()=>{ Object.defineProperty(document,'hidden',{value:false,configurable:true}); });
  await p.click('#btnResume');

  // 7) 演出の途中でリトライしても、二重に組み立たない
  await completeWord(p); await p.waitForTimeout(250);
  await p.evaluate(()=>WP.flow.startStage(1)); await p.waitForTimeout(3200);
  const dup = await p.evaluate(()=>({letters:document.querySelectorAll('#board g.letter').length, pieces:document.querySelectorAll('#board g.piece').length, d:WP.game.debug()}));
  ok(dup.letters===dup.d.word.length && dup.pieces===dup.d.slots.length,'no double build after retry mid-celebration (letters '+dup.letters+', pieces '+dup.pieces+')');
  ok((await flow(p)).idx===0 && (await flow(p)).state==='play','new run is at word 1, play state');

  // 8) 出題: 200回引いて、全て範囲内・重複なし
  const draw = await p.evaluate(()=>WP.STAGES.map(st=>{ let bad=0, rep=0, longBad=0; for(let i=0;i<200;i++){ const ws=WP.drawWords(st,[]); const tot=ws.reduce((a,w)=>a+WP.partsOf(w),0); if(tot<st.band[0]||tot>st.band[1]) bad++; if(new Set(ws).size!==ws.length) rep++; if(ws.length!==st.words) bad++; if(ws.filter(w=>w.length>=4).length<(st.minLong||0)) longBad++; } return {id:st.id,bad,rep,longBad}; }));
  draw.forEach(d=>ok(d.bad===0&&d.rep===0&&d.longBad===0,'stage '+d.id+': 200 draws all in band, distinct'));
  // 9) 星の境界（実際にかかった時間・ボーナス除く）
  const sb = await p.evaluate(()=>{const s=WP.STAGES[0]; return [WP.starsFor(s,13),WP.starsFor(s,13.01),WP.starsFor(s,17),WP.starsFor(s,17.01)];});
  ok(sb.join()==='3,2,2,1','star thresholds stage 1: '+sb);

  console.log('errors',errs); await b.close();
})();
