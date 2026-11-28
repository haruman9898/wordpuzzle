/* 盤面（1単語ぶん）: 枠とパーツの生成、ドラッグ・吸着・はめる、ヒント、チュートリアル。
   ステージ・タイマー・画面の切り替えは flow.js が担当し、ここは WP.game の関数を呼ばれる側。 */
(function () {
  'use strict';
  var WP = window.WP, cfg = WP.cfg;
  var NS = 'http://www.w3.org/2000/svg';
  var $ = function (s) { return document.querySelector(s); };

  var stageEl = $('#stage'), board = $('#board');
  var comboEl = $('#combo'), bannerEl = $('#banner'), safeProbe = $('#safeProbe');

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  // ---- 計測用の隠し SVG（パスの外接矩形を測る） ----
  var mSvg = el('svg', { width: 1, height: 1, style: 'position:absolute;left:-9999px;top:0' }, document.body);
  var mPath = el('path', {}, mSvg);
  function bboxOf(d) { mPath.setAttribute('d', d); var b = mPath.getBBox(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }
  function unionBox(list) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    list.forEach(function (b) { x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + b.w); y1 = Math.max(y1, b.y + b.h); });
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ---- 状態 ----
  var W = 0, H = 0, buildGen = 0;
  var cur = null;          // 現在の単語 {text, letters, slots, pieces, ...}
  var drag = null;
  var combo = 0;
  var busy = false;        // 単語完成の演出中
  var hintTimer = null, hintPiece = null, hintSlot = null;
  var lastWord = null;
  var tutorialActive = WP.store.get('wp.tut', '0') !== '1';
  var ghostEl = null;
  WP.perf = { fps: 0, minFps: 0, worstMs: 0 };
  WP.log = { entries: [], sessionStart: Date.now() };

  function now() { return performance.now(); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOutBack(t) { var c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }
  function tween(dur, step, done) {
    var t0 = now(), tk = { cancel: false };
    (function f(ts) {
      if (tk.cancel) return;
      var t = Math.min(1, (ts - t0) / dur);
      step(t);
      if (t < 1) requestAnimationFrame(f); else if (done) done();
    })(t0);
    return tk;
  }
  function restartClass(node, cls) { node.classList.remove(cls); void node.getBoundingClientRect(); node.classList.add(cls); }

  // ---- 単語の組み立て ----
  function clearBoard() {
    stopHint(); stopGhostEl();
    if (cur && cur.enterTween) cur.enterTween.cancel = true;
    while (board.firstChild) board.removeChild(board.firstChild);
    cur = null; drag = null;
  }

  function measureLayout() {
    var r = stageEl.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height);
    board.setAttribute('width', W); board.setAttribute('height', H);
    board.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  }

  function pickWord() {
    if (cfg.WORD && cfg.WORD !== 'random') return cfg.WORD;
    var pool = WP.WORDS.filter(function (w) { return w !== lastWord; });
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function buildWord(text, opts) {
    clearBoard();
    measureLayout();
    lastWord = text;
    var sw = cfg.STROKE, gap = WP.LETTER_GAP;

    var letters = [];
    for (var i = 0; i < text.length; i++) {
      var ch = text[i], parts = WP.LETTERS[ch];
      var boxes = parts.map(function (p) { return bboxOf(p.d); });
      var bb = unionBox(boxes);
      letters.push({ ch: ch, parts: parts, boxes: boxes, bb: bb, cellW: bb.w + sw + gap, slots: [] });
    }
    var total = letters.reduce(function (a, l) { return a + l.cellW; }, 0);
    var wordArea = Math.max(140, H * 0.33);
    var maxS = text.length <= 2 ? 2.0 : text.length === 3 ? 1.75 : 1.5;
    var s = Math.min((W - 32) / total, (wordArea * 0.9) / (80 + sw), maxS);
    // パーツ置き場に重ならずに収まるか、実際に置いてみる。収まらなければ少し縮める
    var safeB = parseFloat(getComputedStyle(safeProbe).paddingBottom) || 0;
    var poolTop = wordArea + 30, poolBottom = H - safeB - 16;
    var specs = [];
    letters.forEach(function (L) { L.parts.forEach(function (pt, pi) { specs.push(pieceSpec(pt, L.boxes[pi])); }); });
    var layout = null;
    for (var guard = 0; guard < 14 && !layout; guard++) { layout = packPieces(specs, s, sw, poolTop, poolBottom, 6); if (!layout) s *= 0.95; }
    if (!layout) layout = packPieces(specs, s, sw, poolTop, poolBottom, -8); // 最後の手段: 少し重なっても置く
    var X = (W - total * s) / 2, cy = wordArea * 0.5 + 6;

    if (cfg.CARD) {
      el('rect', { x: 16, y: 10, width: W - 32, height: wordArea, rx: 26, fill: 'rgba(0,0,0,.05)' }, board);
      el('rect', { x: 14, y: 6, width: W - 28, height: wordArea, rx: 26, fill: 'rgba(255,255,255,.78)', stroke: '#e8e3d6', 'stroke-width': 2 }, board);
    }
    var slots = [];
    letters.forEach(function (L, li) {
      var tx = X - (L.bb.x - sw / 2 - gap / 2) * s, ty = cy - 50 * s;
      X += L.cellW * s;
      // 位置は外側の g の transform 属性、アニメーションは内側の g（CSS の transform が属性を上書きするため分ける）
      var outer = el('g', { transform: 'translate(' + tx + ' ' + ty + ') scale(' + s + ')' }, board);
      L.g = el('g', { 'class': 'letter' }, outer);
      L.parts.forEach(function (p, pi) {
        var b = L.boxes[pi];
        var slot = { letter: li, type: p.t, d: p.d, box: b, filled: false, color: WP.COLORS[p.t],
                     cx: tx + s * (b.x + b.w / 2), cy: ty + s * (b.y + b.h / 2) };
        slot.slotEl = el('path', { 'class': 'slot', d: p.d, 'stroke-width': sw }, L.g);
        slot.fillEl = el('path', { 'class': 'fill', d: p.d, 'stroke-width': sw, stroke: slot.color }, L.g);
        if (cfg.GLOSS) el('path', { 'class': 'fillhi', d: p.d, 'stroke-width': sw * 0.28, transform: 'translate(-1.6 -1.8)' }, L.g);
        L.slots.push(slot); slots.push(slot);
      });
    });

    cur = { text: text, letters: letters, slots: slots, pieces: [], s: s, sw: sw, wordArea: wordArea,
            t0: now(), lastFit: now(), fits: [], misses: 0, hints: 0, done: false,
            orient: cfg.POOL_ORIENTATION, gen: ++buildGen, entering: false, layout: layout, poolTop: poolTop, poolBottom: poolBottom };
    buildPool();
    combo = 0; updateCombo();
    if (opts && opts.animate) enter(cur, opts.onReady); else if (opts && opts.onReady) opts.onReady();
    restartHint();
    if (tutorialActive && !drag) startGhost();
  }

  // パーツが画面の下から飛んでくる（入場）。終わるまでは掴めない。
  function enter(c, onReady) {
    c.entering = true;
    var n = c.pieces.length, STAG = 55, DUR = 430, total = DUR + STAG * (n - 1);
    c.pieces.forEach(function (p) { p.sy = H + p.h; setPos(p, p.hx, p.sy); });
    c.enterTween = tween(total, function (t) {
      var ms = t * total;
      c.pieces.forEach(function (p, i) {
        var u = clamp((ms - i * STAG) / DUR, 0, 1);
        setPos(p, p.hx, p.sy + (p.hy - p.sy) * easeOutBack(u));
      });
    }, function () { if (cur !== c) return; c.entering = false; if (onReady) onReady(); });
  }

  // パーツの見た目（matched = 枠と同じ形 / canonical = 型ごとの標準形）
  function pieceSpec(part, slotBox) {
    if (cfg.POOL_ORIENTATION === 'canonical') { var d = WP.CANON[part.t]; return { d: d, box: bboxOf(d) }; }
    return { d: part.d, box: slotBox };
  }

  // パーツ置き場に、重ならないように置く。置けなければ null
  function packPieces(specs, s, sw, top, bottom, margin) {
    var items = specs.map(function (sp, i) { return { i: i, w: (sp.box.w + sw) * s, h: (sp.box.h + sw) * s }; });
    items.sort(function (a, b) { return b.w * b.h - a.w * a.h; }); // 大きいものから
    var placed = [], out = [];
    for (var k = 0; k < items.length; k++) {
      var it = items[k], ok = false, x, y;
      for (var tries = 0; tries < 500 && !ok; tries++) {
        x = 16 + it.w / 2 + Math.random() * Math.max(0, W - 32 - it.w);
        y = top + it.h / 2 + Math.random() * Math.max(0, bottom - top - it.h);
        ok = placed.every(function (q) { return Math.abs(x - q.x) > (it.w + q.w) / 2 + margin || Math.abs(y - q.y) > (it.h + q.h) / 2 + margin; });
      }
      if (!ok) { if (margin >= 0) return null; }
      placed.push({ x: x, y: y, w: it.w, h: it.h }); out[it.i] = { x: x, y: y };
    }
    return out;
  }

  function buildPool() {
    var s = cur.s, sw = cur.sw;
    var pieces = cur.slots.map(function (slot, i) {
      var sp = pieceSpec({ t: slot.type, d: slot.d }, slot.box), box = sp.box;
      return { slot: i, type: slot.type, d: sp.d, box: box, color: slot.color, locked: false,
               hx: cur.layout[i].x, hy: cur.layout[i].y,
               w: (box.w + sw) * s, h: (box.h + sw) * s, cx: box.x + box.w / 2, cy: box.y + box.h / 2 };
    });
    // 見た目の重なり順をばらす
    pieces.slice().sort(function () { return Math.random() - 0.5; }).forEach(function (p) {
      p.g = el('g', { 'class': 'piece' }, board);
      p.tilt = el('g', {}, p.g);                    // 傾きは属性で指定（CSS の transform と混ぜない）
      p.inner = el('g', { 'class': 'pinner' }, p.tilt);
      p.angle = 0;
      el('path', { 'class': 'pshadow', d: p.d, 'stroke-width': sw }, p.inner);
      p.pathEl = el('path', { 'class': 'pp', d: p.d, 'stroke-width': sw, stroke: p.color }, p.inner);
      if (cfg.GLOSS) el('path', { 'class': 'phi', d: p.d, 'stroke-width': sw * 0.28, transform: 'translate(-1.6 -1.8)' }, p.inner);
      var len = p.pathEl.getTotalLength(), n = Math.max(2, Math.ceil(len / 4));
      p.pts = [];
      for (var i = 0; i <= n; i++) { var pt = p.pathEl.getPointAtLength(len * i / n); p.pts.push([pt.x, pt.y]); }
      setPos(p, p.hx, p.hy);
    });
    cur.pieces = pieces;
  }

  function setAngle(p, a) {
    p.angle = a;
    p.tilt.setAttribute('transform', a ? 'rotate(' + a.toFixed(2) + ' ' + p.cx + ' ' + p.cy + ')' : '');
  }

  function setPos(p, x, y) {
    p.x = x; p.y = y;
    p.g.setAttribute('transform', 'translate(' + (x - cur.s * p.cx) + ' ' + (y - cur.s * p.cy) + ') scale(' + cur.s + ')');
  }

  // ---- 入力 ----
  function pointerPos(e) { var r = board.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }

  // 線の近くを押せば掴める（細いパーツでも押しやすいように、線までの距離で判定する）
  function hitPiece(pt) {
    var best = null, bd = Infinity, s = cur.s, r = WP.HIT_RADIUS + cur.sw * s / 2;
    cur.pieces.forEach(function (p) {
      if (p.locked) return;
      var gx = p.x - s * p.cx, gy = p.y - s * p.cy, md = Infinity;
      for (var i = 0; i < p.pts.length; i++) {
        var dx = pt.x - (gx + s * p.pts[i][0]), dy = pt.y - (gy + s * p.pts[i][1]);
        var d = dx * dx + dy * dy; if (d < md) md = d;
      }
      md = Math.sqrt(md);
      if (md <= r && md <= bd) { bd = md; best = p; } // 同距離なら後ろ（手前に描かれた方）を優先
    });
    return best;
  }

  function nearest(x, y, filter) {
    var best = null, bd = Infinity;
    cur.slots.forEach(function (sl) {
      if (sl.filled || !filter(sl)) return;
      var d = Math.hypot(x - sl.cx, y - sl.cy);
      if (d < bd) { bd = d; best = sl; }
    });
    return { slot: best, d: bd };
  }

  board.addEventListener('pointerdown', function (e) {
    WP.audio.unlock();
    if (busy || drag || !cur || cur.entering) return;
    var pt = pointerPos(e), p = hitPiece(pt);
    if (!p) return;
    e.preventDefault();
    try { board.setPointerCapture(e.pointerId); } catch (err) {}
    if (p.anim) p.anim.cancel = true;
    stopHint(); stopGhostEl();
    p.inner.style.opacity = 1;
    p.g.parentNode.appendChild(p.g);
    p.g.classList.add('lifted');
    if (cfg.HAPTIC_ON_GRAB) WP.haptic('light');
    drag = { p: p, id: e.pointerId, t0: now(), dx: p.x - pt.x, dy: p.y - pt.y, pt: pt, snap: null, wrong: false };
    updateDrag();
  });
  board.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    drag.pt = pointerPos(e);
    updateDrag();
  });
  function onEnd(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    WP.audio.unlock();
    endDrag(cancel);
  }
  board.addEventListener('pointerup', function (e) { onEnd(e, false); });
  board.addEventListener('pointercancel', function (e) { onEnd(e, true); });

  function updateDrag() {
    var d = drag, p = d.p, t = clamp((now() - d.t0) / 110, 0, 1), ease = t * t * (3 - 2 * t);
    var x = d.pt.x + d.dx * (1 - ease), y = d.pt.y + d.dy * (1 - ease) - cfg.DRAG_OFFSET_Y * ease;
    x = clamp(x, 8, W - 8); y = clamp(y, 8, H - 8);

    // 動いた速さに合わせて、少し傾ける（生き物のような手触り）
    var tn = now(), dtv = Math.max(8, tn - (d.tLast || tn)), vx = d.xLast == null ? 0 : (x - d.xLast) / dtv * 1000;
    d.tLast = tn; d.xLast = x;
    var targetA = clamp(vx * 0.03, -13, 13);
    setAngle(p, p.angle + (targetA - p.angle) * 0.3);

    var c = nearest(x, y, function (sl) { return sl.type === p.type; });
    var cand = (c.slot && c.d < cfg.SNAP_RADIUS) ? c.slot : null;
    // 吸着範囲に近づくと、枠のほうへ少し引き寄せられる（磁石）。吸着の判定は指の位置のまま
    if (!cand && c.slot && c.d < cfg.SNAP_RADIUS * 1.8) {
      var pull = Math.pow(1 - c.d / (cfg.SNAP_RADIUS * 1.8), 2) * 0.45;
      x += (c.slot.cx - x) * pull; y += (c.slot.cy - y) * pull;
    }
    if (cand !== d.snap) {
      if (d.snap) d.snap.fillEl.classList.remove('ghost');
      d.snap = cand;
      if (cand) cand.fillEl.classList.add('ghost');
      p.inner.style.opacity = cand ? 0 : 1; // 吸着中は、枠の形（自動で回転・拡大縮小した形）を見せる
    }
    // 合わない枠: 近づいたら軽く弾かれる演出（指の下から動かしはしない。離した時に元の場所へ戻る）
    var near = nearest(x, y, function () { return true; });
    var wrongNow = !cand && near.slot && near.slot.type !== p.type && near.d < cfg.SNAP_RADIUS * 0.55;
    if (wrongNow && !d.wrong) { restartClass(p.inner, 'wobble'); WP.audio.wrong(); }
    d.wrong = wrongNow;

    if (cand) { setAngle(p, 0); setPos(p, cand.cx, cand.cy); } else setPos(p, x, y);
  }

  function endDrag(cancel) {
    var d = drag, p = d.p; drag = null;
    try { board.releasePointerCapture(d.id); } catch (err) {}
    p.g.classList.remove('lifted');
    if (d.snap && !cancel) { lock(p, d.snap); }
    else {
      if (d.snap) d.snap.fillEl.classList.remove('ghost');
      p.inner.style.opacity = 1;
      if (d.wrong && !cancel) { cur.misses++; combo = 0; updateCombo(); } // ミス = 合わない枠の上で離した時
      returnHome(p);
    }
    restartHint();
  }

  function returnHome(p) {
    var x0 = p.x, y0 = p.y, a0 = p.angle;
    p.anim = tween(300, function (t) {
      var e = easeOutBack(t);
      setPos(p, x0 + (p.hx - x0) * e, y0 + (p.hy - y0) * e);
      setAngle(p, a0 * (1 - Math.min(1, t * 1.6)));
    });
  }

  // ---- はまる ----
  function lock(p, slot) {
    slot.filled = true; p.locked = true;
    slot.fillEl.classList.remove('ghost'); slot.fillEl.classList.add('on'); restartClass(slot.fillEl, 'pop');
    p.g.remove();
    var t = now(); cur.fits.push(Math.round(t - cur.lastFit)); cur.lastFit = t;
    combo++; updateCombo();
    if (combo >= 2) floatText(slot.cx, slot.cy - 30, '×' + combo);
    if (tutorialActive) { tutorialActive = false; WP.store.set('wp.tut', '1'); stopGhostEl(); }

    var L = cur.letters[slot.letter];
    var letterDone = L.slots.every(function (s) { return s.filled; });
    var wordDone = cur.slots.every(function (s) { return s.filled; });

    WP.audio.fit(combo);
    WP.haptic(wordDone ? 'strong' : letterDone ? 'medium' : 'light'); // pointerup の中で同期的に
    WP.fx.ring(slot.cx, slot.cy, slot.color, 46); WP.fx.burst(slot.cx, slot.cy, slot.color, 9);
    if (letterDone) {
      restartClass(L.g, 'bounce');
      var lx = 0, ly = 0; L.slots.forEach(function (q) { lx += q.cx; ly += q.cy; });
      WP.fx.ring(lx / L.slots.length, ly / L.slots.length, slot.color, 90); WP.fx.burst(lx / L.slots.length, ly / L.slots.length, slot.color, 10);
      if (!wordDone) WP.audio.letter();
    }
    if (wordDone) completeWord();
  }

  function updateCombo() {
    comboEl.textContent = combo >= 2 ? 'COMBO ×' + combo : '';
    comboEl.style.fontSize = (19 + Math.min(combo, 10) * 1.3) + 'px';
    comboEl.style.color = combo >= 8 ? '#e8a100' : combo >= 5 ? '#a23b72' : '#e4572e';
    if (combo >= 2) restartClass(comboEl, 'pop');
  }

  function floatText(x, y, str) {
    var n = document.createElement('div');
    n.className = 'float'; n.textContent = str; n.style.left = x + 'px'; n.style.top = y + 'px';
    n.addEventListener('animationend', function () { n.remove(); });
    stageEl.appendChild(n);
  }

  // ---- 単語完成（その後の流れ=次の単語・結果画面は flow.js が決める） ----
  function completeWord() {
    busy = true; cur.done = true; stopHint(); stopGhostEl();
    var ms = Math.round(now() - cur.t0), perfect = cur.misses === 0;
    var avg = cur.fits.length ? Math.round(cur.fits.reduce(function (a, b) { return a + b; }, 0) / cur.fits.length) : 0;
    var entry = { word: cur.text, orient: cur.orient, parts: cur.slots.length, ms: ms, avgFit: avg,
                  maxFit: Math.max.apply(null, cur.fits), misses: cur.misses, hints: cur.hints, perfect: perfect, fits: cur.fits.slice() };
    WP.log.entries.push(entry);
    cur.letters.forEach(function (L, i) { L.g.style.animationDelay = (i * 0.12) + 's'; restartClass(L.g, 'jump'); });
    WP.audio.word();
    WP.fx.shake();
    var myCur = cur, cols = ['#e4572e', '#2e86ab', '#e8b100', '#6aa332', '#a23b72'];
    cur.letters.forEach(function (L, i) {
      setTimeout(function () {
        if (cur !== myCur) return;
        var lx = 0, ly = 0; L.slots.forEach(function (q) { lx += q.cx; ly += q.cy; });
        WP.fx.burst(lx / L.slots.length, ly / L.slots.length - 20, cols[i % cols.length], 12);
      }, i * 120);
    });
    bannerEl.textContent = perfect ? 'PERFECT!' : 'NICE!';
    restartClass(bannerEl, 'show');
    WP.fx.coins(cfg.COINS_PER_WORD);
    if (WP.game.onWordComplete) WP.game.onWordComplete(entry);
  }

  // ---- ヒント: 操作が止まったら、はまるパーツが震える ----
  function hintTarget() {
    for (var i = 0; i < cur.letters.length; i++) {
      var s = cur.letters[i].slots.filter(function (x) { return !x.filled; })[0];
      if (s) return s;
    }
    return null;
  }
  function pieceFor(slot) {
    var best = null, bd = Infinity;
    cur.pieces.forEach(function (p) {
      if (p.locked || p.type !== slot.type) return;
      var d = Math.hypot(p.hx - slot.cx, p.hy - slot.cy);
      if (d < bd) { bd = d; best = p; }
    });
    return best;
  }
  function startHint() {
    if (!cur || busy || drag) return;
    var t = hintTarget(); if (!t) return;
    var p = pieceFor(t); if (!p) return;
    stopHint();
    p.inner.classList.add('shake'); hintPiece = p; cur.hints++;
    t.slotEl.classList.add('pulse'); hintSlot = t;
  }
  function stopHint() {
    clearTimeout(hintTimer); hintTimer = null;
    if (hintPiece) { hintPiece.inner.classList.remove('shake'); hintPiece = null; }
    if (hintSlot) { hintSlot.slotEl.classList.remove('pulse'); hintSlot = null; }
  }
  function restartHint() {
    stopHint();
    if (cur && !busy) hintTimer = setTimeout(startHint, cfg.HINT_DELAY_SEC * 1000);
  }

  // ---- チュートリアル: 指のゴーストが最初のパーツをドラッグして見せる ----
  function startGhost() {
    stopGhostEl();
    ghostEl = el('g', { id: 'ghost', opacity: 0 }, board);
    el('circle', { r: 22, fill: 'rgba(35,33,29,.18)', stroke: 'rgba(35,33,29,.55)', 'stroke-width': 3 }, ghostEl);
    el('circle', { r: 7, fill: 'rgba(35,33,29,.55)' }, ghostEl);
    ghostEl.t0 = now();
  }
  function stopGhostEl() { if (ghostEl) { ghostEl.remove(); ghostEl = null; } }
  function stepGhost(t) {
    if (!ghostEl || !cur || drag || busy) { if (ghostEl) ghostEl.setAttribute('opacity', 0); return; }
    var tg = hintTarget(); if (!tg) return;
    var p = pieceFor(tg); if (!p) return;
    var T = (t - ghostEl.t0 - 700) % 2600; if (t - ghostEl.t0 < 700) { ghostEl.setAttribute('opacity', 0); return; }
    var x0 = p.x, y0 = p.y - cfg.DRAG_OFFSET_Y * 0, x1 = tg.cx, y1 = tg.cy, x, y, a;
    if (T < 300) { x = x0; y = y0; a = T / 300; }
    else if (T < 1500) { var u = (T - 300) / 1200, e = u * u * (3 - 2 * u); x = x0 + (x1 - x0) * e; y = y0 + (y1 - y0) * e; a = 1; }
    else if (T < 2000) { x = x1; y = y1; a = 1; }
    else { x = x1; y = y1; a = 1 - (T - 2000) / 600; }
    ghostEl.setAttribute('transform', 'translate(' + x + ' ' + y + ')');
    ghostEl.setAttribute('opacity', a);
    if (board.lastChild !== ghostEl) board.appendChild(ghostEl);
  }

  // ---- フレームループ（FPS 計測・コイン・ゴースト） ----
  var lastT = now(), accT = 0, accN = 0, worst = 0, minFps = 999;
  function tick(ts) {
    var t = now(), dtMs = t - lastT; lastT = t;
    var dt = Math.min(dtMs, 50) / 1000;
    accT += dtMs; accN++; worst = Math.max(worst, dtMs);
    if (accT >= 500) {
      var fps = accN * 1000 / accT; if (t > 2500) minFps = Math.min(minFps, fps); // 起動直後のカクつきは除く
      WP.perf = { fps: Math.round(fps), minFps: minFps === 999 ? Math.round(fps) : Math.round(minFps), worstMs: Math.round(worst) };
      accT = 0; accN = 0; worst = 0;
    }
    WP.fx.step(dt, t); stepGhost(t);
    if (WP.flow && WP.flow.tick) WP.flow.tick(t);
    requestAnimationFrame(tick);
  }

  // ---- ログ ----
  WP.logText = function () {
    var lines = [];
    var cfgStr = ['SNAP_RADIUS', 'DRAG_OFFSET_Y', 'HINT_DELAY_SEC', 'STROKE', 'POOL_ORIENTATION', 'COINS_PER_WORD'].map(function (k) { return k + '=' + cfg[k]; }).join(' ');
    lines.push('BUILD ' + WP.BUILD + ' / ' + new Date().toISOString());
    lines.push('端末: ' + navigator.userAgent.replace(/\s+/g, ' ').slice(0, 90));
    lines.push('画面: ' + window.innerWidth + 'x' + window.innerHeight + ' @' + (window.devicePixelRatio || 1) + 'x');
    lines.push('振動: ' + WP.hapticMode() + ' / 音: ' + WP.audio.state() + ' / FPS: ' + WP.perf.fps + ' (最小 ' + WP.perf.minFps + ', 最悪フレーム ' + WP.perf.worstMs + 'ms)');
    lines.push('設定: ' + cfgStr);
    lines.push('コイン: ' + WP.fx.coinTotal() + ' / 完成した単語: ' + WP.log.entries.length);
    WP.log.entries.forEach(function (e, i) {
      lines.push((i + 1) + '. ' + e.word + ' [' + e.orient + '] ' + e.parts + 'パーツ ' + (e.ms / 1000).toFixed(1) + '秒 / 平均はめ ' + e.avgFit + 'ms (最大 ' + e.maxFit + 'ms) / ミス ' + e.misses + ' / ヒント ' + e.hints + (e.perfect ? ' / PERFECT' : ''));
    });
    return lines.join('\n');
  };

  // ---- 公開（flow.js・dev.js・テストから呼ぶ） ----
  function slideIn() {
    board.classList.remove('out'); board.classList.add('pre'); void board.offsetWidth; board.classList.remove('pre');
  }
  WP.game = {
    show: function (text, opts) { busy = false; if (opts && opts.animate) slideIn(); buildWord(text, opts); },
    newWord: function (w) { WP.game.show(w || pickWord(), { animate: false }); },
    pickWord: pickWord,
    exit: function (cb) { board.classList.add('out'); setTimeout(cb, 290); },
    clear: function () { clearBoard(); busy = false; board.classList.remove('out'); },
    lock: function (b) { busy = !!b; },
    cancelDrag: function () { if (drag) endDrag(true); },
    resetCombo: function () { combo = 0; updateCombo(); },
    rebuild: function () { if (cur && !busy) buildWord(cur.text, { animate: false }); },
    resetTutorial: function () { WP.store.set('wp.tut', '0'); tutorialActive = true; if (cur && !busy) startGhost(); },
    resetCoins: function () { WP.fx.resetCoins(); },
    clearLog: function () { WP.log.entries = []; },
    onWordComplete: null,
    debug: function () {
      return { word: cur && cur.text, combo: combo, busy: busy, entering: cur && cur.entering, coins: WP.fx.coinTotal(), misses: cur && cur.misses, hints: cur && cur.hints,
               W: W, H: H, s: cur && cur.s,
               slots: cur && cur.slots.map(function (s) { return { type: s.type, x: s.cx, y: s.cy, filled: s.filled, letter: s.letter }; }),
               pieces: cur && cur.pieces.map(function (p) { return { type: p.type, x: p.x, y: p.y, hx: p.hx, hy: p.hy, locked: p.locked, w: p.w, h: p.h, shaking: p === hintPiece }; }) };
    }
  };

  function init() {
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (cur && !busy && !drag && !cur.entering) buildWord(cur.text, { animate: false }); }, 200); });
    // iPhone のスクロール・ピンチ・ゴムバンドを止める（開発メニューの中だけはスクロールできる）
    document.addEventListener('touchmove', function (e) { if (!e.target.closest || !e.target.closest('#dev')) e.preventDefault(); }, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) { document.addEventListener(n, function (e) { e.preventDefault(); }); });
    document.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    requestAnimationFrame(tick);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
