// 描画の計測: 通常の URL でも、プレイ中・演出中のフレーム時間をいつも記録し、?dev=1 のログで読める
const {launch,state,fitOne} = require('./lib.js');
const BASE = process.env.URL||'http://localhost:8123';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
async function waitState(p, want, ms=9000){ const t=Date.now(); while(Date.now()-t<ms){ if(await p.evaluate(()=>WP.flow.state())===want) return true; await p.waitForTimeout(60);} return false; }
async function completeWord(p){ let n=0; while(n++<30){ const st=await state(p); if(!st.slots||st.slots.every(s=>s.filled)) break; await fitOne(p); } }
(async()=>{
  const {b,p,errs} = await launch(393,700);
  await p.addInitScript(()=>{ if(!sessionStorage.getItem('init')){ localStorage.setItem('wp.tut','1'); localStorage.setItem('wp.unlockAll','1'); localStorage.setItem('wp.dev','0'); localStorage.setItem('wp.perf.v1','[]'); sessionStorage.setItem('init','1'); } });
  // 通常の URL: 開発用の表示は出ないし、表示の更新も走らない。それでも計測は記録される
  await p.goto(BASE+'/index.html'); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>document.querySelector('#diag').textContent)==='','normal URL: the diagnostics text is never updated (no hidden work)');
  await p.evaluate(()=>WP.flow.startStage(2)); ok(await waitState(p,'play'),'stage 2 starts');
  await completeWord(p); await p.waitForTimeout(300);
  const e1 = await p.evaluate(()=>WP.log.entries[0]);
  ok(e1 && e1.perfPlay && e1.perfPlay.n>20 && e1.perfPlay.avg>0 && e1.perfPlay.p95>=e1.perfPlay.avg,'play-phase frames are recorded for the word ('+JSON.stringify(e1&&e1.perfPlay)+')');
  ok(await waitState(p,'play',9000),'next word starts'); await p.waitForTimeout(200);
  const rec1 = await p.evaluate(()=>JSON.parse(localStorage.getItem('wp.perf.v1')));
  ok(rec1.length===1 && rec1[0].dev===0 && rec1[0].celeb.n>10 && rec1[0].play.n>20,'a record is saved when the celebration ends (dev=0, celebration frames: '+(rec1[0]&&rec1[0].celeb.n)+')');
  // ?dev=1 で開く: 通常の URL で遊んだ記録が、ログに出る
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(400);
  await p.evaluate(()=>WP.flow.startStage(2)); ok(await waitState(p,'play'),'stage 2 starts again (dev URL)');
  await completeWord(p); ok(await waitState(p,'play',9000),'next word starts (dev URL)'); await p.waitForTimeout(200);
  const sum = await p.evaluate(()=>WP.perfSummary());
  ok(sum.length===2 && /通常の URL（1語）/.test(sum[0]) && /dev=1 の URL（1語）/.test(sum[1]),'summary separates normal-URL and dev-URL words ('+sum.join(' || ')+')');
  const log = await p.evaluate(()=>WP.logText());
  ok(/計測（端末に保存/.test(log) && /描画 平均/.test(log),'the copied log contains the saved measurements and per-word frame times');
  console.log('errors',errs); await b.close();
})();
