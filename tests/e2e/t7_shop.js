// 着せ替え（背景・文字の色）と、?dev=1 の切り替え
const {launch,state,fitOne} = require('./lib.js');
const OUT = process.env.OUT || '/tmp', BASE = process.env.URL||'http://localhost:8123';
const ok=(c,m)=>console.log((c?'PASS ':'FAIL ')+m);
const shown = (p,sel) => p.evaluate(s=>{const e=document.querySelector(s); return !!e && getComputedStyle(e).display!=='none';}, sel);
const css = (p,v) => p.evaluate(v=>document.documentElement.style.getPropertyValue(v).trim(), v);
const coins = p => p.evaluate(()=>WP.fx.coinTotal());
const actText = p => p.evaluate(()=>({t:document.querySelector('#btnShopAct').textContent, d:document.querySelector('#btnShopAct').disabled, m:document.querySelector('#shopMsg').textContent}));
(async()=>{
  let {b,p,errs} = await launch(393,760);
  // ---- 開発用の表示: 通常は出ない / ?dev=1 で出る・保存される / ?dev=0 で消える ----
  await p.goto(BASE+'/index.html'); await p.waitForTimeout(300);
  ok(!(await shown(p,'#gear')) && !(await shown(p,'#diag')) && !(await shown(p,'#btnTitleDev')),'dev UI is hidden by default');
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(300);
  ok(await shown(p,'#btnTitleDev'),'?dev=1 shows the dev UI');
  await p.goto(BASE+'/index.html'); await p.waitForTimeout(300);
  ok(await shown(p,'#btnTitleDev'),'the flag is remembered on the next visit');
  await p.goto(BASE+'/index.html?dev=0'); await p.waitForTimeout(300);
  ok(!(await shown(p,'#btnTitleDev')),'?dev=0 hides it again');

  // ---- 着せ替え ----
  await p.goto(BASE+'/index.html?dev=1'); await p.waitForTimeout(300);
  await p.evaluate(()=>{ WP.shop.reset(); WP.fx.resetCoins(); WP.fx.addCoins(100); });
  await p.click('#btnTitleShop'); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>WP.flow.state())==='shop','shop opens from the title');
  ok(await p.evaluate(()=>document.querySelectorAll('#shopList .shopitem').length)===5,'5 backgrounds listed');
  let a = await actText(p); ok(a.d && a.t.includes('つかっている'),'default background is equipped (button disabled)');
  await p.screenshot({path:OUT+'/h1_shop_bg.png'});
  await p.click('.shopitem[data-id="sky"]'); a = await actText(p);
  ok(!a.d && a.t.includes('30'),'sky costs 30 and can be bought ('+a.t+')');
  await p.click('#btnShopAct'); await p.waitForTimeout(200);
  ok(await coins(p)===70,'30 coins spent (70 left)');
  ok((await css(p,'--bg1'))==='#e8f4ff','sky background is applied');
  ok((await p.evaluate(()=>WP.shop.state().eq.bg))==='sky','sky is saved as equipped');
  await p.click('.shopitem[data-id="night"]'); a = await actText(p);
  ok(a.d && a.m.includes('あと 50'),'not enough coins for night: disabled with a message ('+a.m+')');
  await p.click('#btnShopAct',{force:true}).catch(()=>{});
  ok(await coins(p)===70 && (await p.evaluate(()=>WP.shop.state().own.bg.indexOf('night')))<0,'nothing bought when coins are short');
  await p.click('.shopitem[data-id="cream"]'); a = await actText(p);
  ok(!a.d && a.t==='つかう','owned items can be re-equipped for free');
  await p.click('#btnShopAct'); await p.waitForTimeout(150);
  ok((await css(p,'--bg1'))==='#faf8f2' && await coins(p)===70,'back to cream, no coins spent');

  // 文字の色
  await p.click('#tabPal'); await p.waitForTimeout(100);
  ok(await p.evaluate(()=>document.querySelectorAll('#shopList .shopitem').length)===5,'5 color sets listed');
  await p.screenshot({path:OUT+'/h2_shop_pal.png'});
  await p.click('.shopitem[data-id="pop"]'); await p.click('#btnShopAct'); await p.waitForTimeout(150);
  ok(await coins(p)===20 && await p.evaluate(()=>WP.COLORS.I)==='#ff3b3b','pop colors bought and applied (coins 20)');

  // 再読み込みしても残る
  await p.reload(); await p.waitForTimeout(400);
  ok((await p.evaluate(()=>WP.shop.state().eq.pal))==='pop' && await p.evaluate(()=>WP.COLORS.D)==='#2f6bff','equipped colors survive a reload');
  ok(await coins(p)===20,'coin balance survives a reload');

  // ゲーム中に反映される（枠の色・パーツの色）
  await p.evaluate(()=>{ WP.store.set('wp.tut','1'); WP.flow.freePlay(); WP.game.newWord('IT'); });
  await p.waitForTimeout(250);
  const col = await p.evaluate(()=>{ const f=document.querySelector('#board .fill'); const pc=document.querySelector('#board .pp'); return [f.getAttribute('stroke'), pc.getAttribute('stroke')]; });
  ok(Object.values({a:'#ff3b3b',b:'#2f6bff',c:'#ffd400',d:'#00c2d1',e:'#3ddc4a',f:'#e6199a',g:'#8a2be2',h:'#ff8a00',i:'#00a86b'}).includes(col[0]) && col[0]===col[0] && /^#/.test(col[1]),'game uses the equipped color set ('+col+')');
  let n=0; while(await fitOne(p)&&n++<6){} await p.waitForTimeout(200);
  ok((await state(p)).slots.every(s=>s.filled),'can play normally with the new colors');

  // 夜空 + ネオンも買って、見た目を確認
  await p.evaluate(()=>{ WP.fx.addCoins(500); WP.flow.goTitle(); });
  await p.click('#btnTitleShop'); await p.click('.shopitem[data-id="night"]'); await p.click('#btnShopAct');
  await p.click('#tabPal'); await p.click('.shopitem[data-id="neon"]'); await p.click('#btnShopAct'); await p.waitForTimeout(250);
  ok((await css(p,'--bg1'))==='#1b2240' && await p.evaluate(()=>WP.COLORS.C)==='#00e5ff','night + neon applied');
  await p.screenshot({path:OUT+'/h3_night_shop.png'});
  await p.click('#btnShopBack'); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>WP.flow.state())==='title','back button returns to the title');
  await p.screenshot({path:OUT+'/h4_night_title.png'});
  await p.click('#btnPlay'); await p.waitForTimeout(150);
  ok(await shown(p,'#btnSelShop'),'select screen has a きせかえ button');
  await p.screenshot({path:OUT+'/h5_night_select.png'});
  await p.click('#btnSelShop'); await p.click('#btnShopBack'); await p.waitForTimeout(150);
  ok(await p.evaluate(()=>WP.flow.state())==='select','shop opened from select returns to select');
  await p.click('.cardbtn[data-id="1"]'); await p.waitForTimeout(2300);
  await fitOne(p); await fitOne(p); await p.waitForTimeout(200);
  await p.screenshot({path:OUT+'/h6_night_play.png'});
  // 夕焼けで遊ぶ画面も
  await p.evaluate(()=>{ WP.flow.goTitle(); });
  await p.click('#btnTitleShop'); await p.click('.shopitem[data-id="sky"]'); await p.click('#btnShopAct');
  await p.evaluate(()=>{ WP.fx.addCoins(100); }); await p.click('#tabBg'); await p.click('.shopitem[data-id="sunset"]'); await p.click('#btnShopAct');
  await p.click('#btnShopBack'); await p.click('#btnPlay'); await p.click('.cardbtn[data-id="1"]'); await p.waitForTimeout(2300);
  await fitOne(p); await p.waitForTimeout(150);
  await p.screenshot({path:OUT+'/h7_sunset_play.png'});
  console.log('errors',errs); await b.close();
})();
