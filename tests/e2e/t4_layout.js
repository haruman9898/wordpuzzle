// パーツ置き場のレイアウト検査: 全単語・3つの画面サイズ・多数回の試行で、重なりと画面外がないこと
const {launch} = require('./lib.js');
(async()=>{
  for (const [W,H] of [[390,844],[375,667],[430,932]]) {
    const {b,p,errs}=await launch(W,H);
    await p.goto((process.env.URL||'http://localhost:8123')+'/index.html'); await p.waitForTimeout(300);
    const res = await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); const out=[];
      WP.WORDS_ALL.forEach(w=>{ let maxOv=0, oob=0, minS=9, maxS=0;
        for(let i=0;i<25;i++){ WP.game.newWord(w); const d=WP.game.debug(); minS=Math.min(minS,d.s); maxS=Math.max(maxS,d.s);
          const ps=d.pieces; let ov=0;
          for(let a=0;a<ps.length;a++){ const A=ps[a]; if(A.hx-A.w/2<0||A.hx+A.w/2>d.W||A.hy+A.h/2>d.H) oob++;
            for(let c=a+1;c<ps.length;c++){ const B=ps[c]; if(Math.abs(A.hx-B.hx)<(A.w+B.w)/2 && Math.abs(A.hy-B.hy)<(A.h+B.h)/2) ov++; } }
          maxOv=Math.max(maxOv,ov); }
        out.push({w, s:+maxS.toFixed(2), maxOv, oob}); });
      return out; });
    const bad = res.filter(r=>r.maxOv>0||r.oob>0);
    console.log(`${W}x${H}: words=${res.length} overlapping=${bad.length}`, bad.length?JSON.stringify(bad):'', 'scales', res.filter(r=>['IT','CAT','BIRD','APPLE'].includes(r.w)).map(r=>r.w+':'+r.s).join(' '));
    console.log('errors',errs); await b.close();
  }
})();
