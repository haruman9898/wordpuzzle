const { chromium } = require('playwright');
exports.launch = async (w=390,h=844,extra={}) => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{width:w,height:h}, deviceScaleFactor:2, hasTouch:false, ...extra });
  const p = await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push('pageerror: '+e.message)); p.on('console',m=>{ if(m.type()==='error') errs.push('console: '+m.text()); });
  return {b,ctx,p,errs};
};
exports.state = p => p.evaluate(()=>WP.game.debug());
// ステージ座標 -> ページ座標
exports.off = async p => p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.left,y:r.top};});
exports.drag = async (p, from, to, {steps=12, release=true, holdMs=0}={}) => {
  const o = await exports.off(p);
  await p.mouse.move(o.x+from.x, o.y+from.y);
  await p.mouse.down();
  await p.mouse.move(o.x+from.x+3, o.y+from.y-3, {steps:2});
  await p.mouse.move(o.x+to.x, o.y+to.y, {steps});
  if (holdMs) await p.waitForTimeout(holdMs);
  if (release) await p.mouse.up();
};
// 1つのパーツを、同じ型の最寄りの空き枠に入れる（指は枠の中心より offsetY 下）
exports.fitOne = async (p, offsetY=45, pick) => {
  const st = await exports.state(p);
  const pc = st.pieces.find(x=>!x.locked && (!pick || pick(x)));
  if(!pc) return false;
  const slots = st.slots.filter(s=>!s.filled && s.type===pc.type);
  slots.sort((a,b)=>Math.hypot(a.x-pc.x,a.y-pc.y)-Math.hypot(b.x-pc.x,b.y-pc.y));
  await exports.drag(p,{x:pc.x,y:pc.y},{x:slots[0].x,y:slots[0].y+offsetY});
  await p.waitForTimeout(60);
  return true;
};
