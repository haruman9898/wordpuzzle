/* 画面全体に重ねる演出（canvas）: コイン・火花・光の輪。画面の揺れ。コインの瓶。
   座標は、特に断りがなければ「ビューポートの px」。盤面の座標は boardToView で変換する。 */
(function () {
  'use strict';
  var WP = window.WP;
  var $ = function (s) { return document.querySelector(s); };
  var fx = $('#fx'), ctx = fx.getContext('2d');
  var stageEl = $('#stage'), jarEl = $('#jar'), jarDiscs = $('#jarDiscs'), coinCountEl = $('#coinCount');
  var coinList = [], sparks = [], rings = [], dirty = false;
  var MAX_SPARKS = 80;
  var total = Number(WP.store.get('wp.coins', '0')) || 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function restartClass(node, cls) { node.classList.remove(cls); void node.getBoundingClientRect(); node.classList.add(cls); }

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.width = Math.round(window.innerWidth * dpr); fx.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // ---- コインの瓶 ----
  function renderJar() {
    coinCountEl.textContent = String(total);
    var n = Math.min(total, 10), html = '';
    for (var i = 0; i < n; i++) {
      var cx = 22 + ((i % 3) - 1) * 5, cy = 48 - i * 3.4;
      html += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="9" ry="3.6" fill="#f6c542" stroke="#c58f12" stroke-width="1.4"/>';
    }
    jarDiscs.innerHTML = html;
  }

  function boardToView(x, y) { var r = stageEl.getBoundingClientRect(); return { x: x + r.left, y: y + r.top }; }

  // ---- 発生 ----
  function coins(n) {
    var sr = stageEl.getBoundingClientRect(), jr = jarEl.getBoundingClientRect();
    var jx = jr.left + jr.width * 0.3, jy = jr.top + jr.height * 0.5, t = performance.now();
    for (var i = 0; i < n; i++) {
      coinList.push({ state: 'wait', at: t + i * 110, x: 30 + Math.random() * (window.innerWidth - 60), y: -30, vy: 0,
                      ly: sr.top + sr.height * (0.38 + Math.random() * 0.35), bounces: 0, spin: Math.random() * 6, jx: jx, jy: jy, r: 15 });
    }
  }
  // 火花: 放射状に飛ぶ。burstView はビューポートの座標、burst は盤面の座標
  function burstView(x, y, color, n) {
    n = n || 12;
    for (var i = 0; i < n && sparks.length < MAX_SPARKS; i++) {
      var a = Math.random() * Math.PI * 2, sp = 90 + Math.random() * 220;
      sparks.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, life: 0, max: 0.45 + Math.random() * 0.3,
                    color: color, size: 2.5 + Math.random() * 3 });
    }
  }
  function burst(x, y, color, n) { var p = boardToView(x, y); burstView(p.x, p.y, color, n); }
  // 光の輪
  function ringView(x, y, color, r1) { rings.push({ x: x, y: y, life: 0, max: 0.38, color: color, r0: 8, r1: r1 || 56 }); }
  function ring(x, y, color, r1) { var p = boardToView(x, y); ringView(p.x, p.y, color, r1); }
  // コインの増減（着せ替えの購入など）
  function addCoins(n) { total += n; WP.store.set('wp.coins', String(total)); renderJar(); }
  function spend(n) { if (total < n) return false; total -= n; WP.store.set('wp.coins', String(total)); renderJar(); return true; }
  function shake() { restartClass(stageEl, 'shake'); }

  // ---- 描画 ----
  function drawCoin(c) {
    ctx.save(); ctx.translate(c.x, c.y);
    var k = c.scale == null ? 1 : c.scale;
    ctx.scale(Math.max(0.15, Math.abs(Math.cos(c.spin))) * k, k);
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = '#f6c542'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = '#c58f12'; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, c.r * 0.62, 0, Math.PI * 2); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(197,143,18,.8)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-c.r * 0.3, -c.r * 0.35, c.r * 0.25, c.r * 0.12, -0.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function step(dt, t) {
    if (!coinList.length && !sparks.length && !rings.length && !dirty) return;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (var i = coinList.length - 1; i >= 0; i--) {
      var c = coinList[i];
      if (c.state === 'wait') { if (t >= c.at) c.state = 'fall'; else continue; }
      if (c.state === 'fall') {
        c.vy += 1700 * dt; c.y += c.vy * dt; c.spin += dt * 9;
        if (c.y >= c.ly) {
          c.y = c.ly; c.vy *= -0.42; c.bounces++; WP.audio.coinLand();
          if (c.bounces >= 2) { c.state = 'rest'; c.restAt = t; }
        }
      } else if (c.state === 'rest') {
        c.spin += dt * 3;
        if (t - c.restAt > 450) { c.state = 'fly'; c.flyAt = t; c.fx = c.x; c.fy = c.y; }
      } else if (c.state === 'fly') {
        var u = clamp((t - c.flyAt) / 520, 0, 1), e = u * u * u;
        c.x = c.fx + (c.jx - c.fx) * e; c.y = c.fy + (c.jy - c.fy) * e; c.spin += dt * 12; c.scale = 1 - 0.45 * u;
        if (u >= 1) {
          total++; WP.store.set('wp.coins', String(total)); renderJar(); restartClass(jarEl, 'pop'); WP.audio.coin();
          coinList.splice(i, 1); continue;
        }
      }
      drawCoin(c);
    }

    for (var j = rings.length - 1; j >= 0; j--) {
      var r = rings[j]; r.life += dt;
      var q = r.life / r.max;
      if (q >= 1) { rings.splice(j, 1); continue; }
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - q, 2)), 0, Math.PI * 2);
      ctx.globalAlpha = 1 - q; ctx.lineWidth = 5 * (1 - q) + 1; ctx.strokeStyle = r.color; ctx.stroke(); ctx.globalAlpha = 1;
    }

    for (var k = sparks.length - 1; k >= 0; k--) {
      var s = sparks[k]; s.life += dt;
      if (s.life >= s.max) { sparks.splice(k, 1); continue; }
      s.vy += 520 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      ctx.globalAlpha = 1 - s.life / s.max; ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.size * (1 - 0.5 * s.life / s.max), 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }

    dirty = !!(coinList.length || sparks.length || rings.length);
    if (!dirty) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); // 最後に1回きれいに消す
  }

  WP.fx = {
    resize: resize, step: step, coins: coins, burst: burst, ring: ring, burstView: burstView, ringView: ringView, shake: shake,
    addCoins: addCoins, spend: spend,
    renderJar: renderJar,
    coinTotal: function () { return total; },
    resetCoins: function () { total = 0; WP.store.set('wp.coins', '0'); renderJar(); },
    jarRect: function () { return jarEl.getBoundingClientRect(); },
    active: function () { return coinList.length + sparks.length + rings.length; }
  };

  resize(); renderJar();
  window.addEventListener('resize', resize);
})();
