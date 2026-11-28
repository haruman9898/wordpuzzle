/* ゲーム全体の流れ: タイトル → ステージ選択 → プレイ（タイマー・ボーナス・星） → 結果／失敗。
   時間のかかる処理（setTimeout・アニメーション）は、必ず世代番号（gen）を確かめてから実行する。
   リトライ・やめる・一時停止の後に、古い処理が別の画面で動かないようにするため。 */
(function () {
  'use strict';
  var WP = window.WP, cfg = WP.cfg;
  var $ = function (s) { return document.querySelector(s); };

  var scr = { title: $('#scrTitle'), select: $('#scrSelect'), result: $('#scrResult'), fail: $('#scrFail'), pause: $('#scrPause') };
  var strip = $('#strip'), stageLabel = $('#stageLabel'), dotsEl = $('#dots'), barFill = $('#barFill'), secsEl = $('#secs');
  var pauseBtn = $('#pauseBtn'), bannerEl = $('#banner');

  var gen = 0;                 // 世代番号。ステージの開始・終了のたびに増やす
  var state = 'boot';          // boot | title | select | intro | enter | play | celebrate | result | fail | paused | free
  var prevState = null;
  var run = null;              // プレイ中のステージの状態
  var lastWords = [];

  function setState(s) {
    state = s; document.body.setAttribute('data-scene', s);
    pauseBtn.disabled = !(s === 'play' || s === 'enter');
  }
  function later(ms, fn) { var g = gen; return setTimeout(function () { if (g === gen) fn(); }, ms); }
  function showScreen(name) { Object.keys(scr).forEach(function (k) { scr[k].hidden = (k !== name); }); }
  function banner(text) { bannerEl.textContent = text; bannerEl.classList.remove('show'); void bannerEl.offsetWidth; bannerEl.classList.add('show'); }
  function stars(n) { var o = ''; for (var i = 1; i <= 3; i++) o += '<span class="st' + (i <= n ? ' on' : '') + '">★</span>'; return o; }

  // ---- HUD（タイマー・進捗） ----
  function renderDots() {
    var o = '';
    for (var i = 0; i < run.words.length; i++) o += '<i class="' + (i < run.idx ? 'on' : (i === run.idx ? 'cur' : '')) + '"></i>';
    dotsEl.innerHTML = o;
  }
  function timeLeft() { return run.limit + run.bonus - run.elapsed / 1000; }
  function renderTime() {
    var left = timeLeft();
    secsEl.textContent = Math.max(0, left).toFixed(1);
    barFill.style.width = (Math.max(0, Math.min(1, left / run.limit)) * 100) + '%';
    strip.classList.toggle('warn', left <= 10);
  }

  // ---- 画面遷移 ----
  function stop() { gen++; run = null; WP.game.cancelDrag(); WP.game.clear(); WP.game.resetCombo(); if (WP.audio.bgm) WP.audio.bgm(false); }

  function goTitle() { stop(); setState('title'); showScreen('title'); strip.classList.remove('warn'); }

  function goSelect() {
    stop(); setState('select');
    var o = '';
    WP.STAGES.forEach(function (st) {
      var ok = WP.progress.unlocked(st.id), n = WP.progress.stars(st.id);
      o += '<button type="button" class="cardbtn" data-id="' + st.id + '"' + (ok ? '' : ' disabled') + '>' +
           '<span class="num">' + st.id + '</span>' +
           '<span class="info">' + st.words + 'ワード ／ ' + st.limit + '秒</span>' +
           '<span class="stars">' + (ok ? stars(n) : '🔒') + '</span></button>';
    });
    $('#cards').innerHTML = o;
    $('#selCoins').textContent = '🪙 ' + WP.fx.coinTotal();
    showScreen('select');
  }

  function startStage(id) {
    stop();
    var st = WP.STAGES[id - 1];
    var words = WP.drawWords(st, lastWords);
    lastWords = words.slice();
    run = { st: st, words: words, idx: 0, limit: st.limit, bonus: 0, elapsed: 0, running: false, last: 0, warned: false, coins: 0 };
    var g = gen;
    setState('intro'); showScreen(null);
    stageLabel.textContent = 'STAGE ' + st.id;
    strip.classList.remove('free'); strip.classList.remove('warn');
    renderDots(); renderTime();
    banner('STAGE ' + st.id);
    if (WP.audio.bgm) WP.audio.bgm(true);
    later(750, function () { showWord(g); });
  }

  function showWord() {
    var g = gen;
    setState('enter'); renderDots();
    WP.game.show(run.words[run.idx], { animate: true, onReady: function () {
      if (g !== gen || !run) return;
      if (state === 'paused') { prevState = 'play'; return; } // 一時停止中に入場が終わった: 再開した時に始める
      if (document.hidden) { // 裏に回っている間に入場が終わった: 時間は動かさず、戻った時に一時停止の画面から始める
        prevState = 'play'; setState('paused'); WP.game.lock(true); showScreen('pause'); return;
      }
      setState('play'); run.running = true; run.last = performance.now();
    } });
  }

  // 盤面から呼ばれる: 単語が1つ完成した
  WP.game.onWordComplete = function () {
    if (state === 'free') { later(2400, function () { WP.game.show(WP.game.pickWord(), { animate: false }); }); return; }
    if (!run) return;
    run.elapsed += performance.now() - run.last; run.running = false; // 最後の1つをはめた瞬間に時間を止める（クリアが優先）
    run.idx++; run.coins += cfg.COINS_PER_WORD;
    setState('celebrate'); renderDots(); renderTime();
    if (run.idx >= run.words.length) { later(1500, showClear); return; }
    run.bonus += cfg.BONUS_SECONDS;
    if (cfg.BONUS_SECONDS > 0) floatBonus('+' + cfg.BONUS_SECONDS + '秒');
    renderTime();
    var g = gen;
    later(1250, function () { WP.game.exit(function () { if (g === gen && run) showWord(); }); });
  };
  function floatBonus(txt) {
    var r = secsEl.getBoundingClientRect(), n = document.createElement('div');
    n.className = 'float fixed'; n.textContent = txt; n.style.left = (r.left + r.width / 2) + 'px'; n.style.top = (r.top + r.height / 2) + 'px';
    n.addEventListener('animationend', function () { n.remove(); });
    document.body.appendChild(n);
  }

  // 時間切れ
  function timeUp() {
    run.running = false;
    setState('fail');
    WP.game.cancelDrag(); WP.game.lock(true);
    WP.audio.fail(); if (WP.audio.bgm) WP.audio.bgm(false);
    later(450, function () { showScreen('fail'); });
  }

  function showClear() {
    var st = run.st, sec = run.elapsed / 1000, n = WP.starsFor(st, sec);
    var before = WP.progress.stars(st.id);
    WP.progress.setStars(st.id, n);
    $('#resTitle').textContent = 'STAGE ' + st.id + ' CLEAR!';
    $('#resStars').innerHTML = stars(0);
    $('#resTime').textContent = 'タイム ' + sec.toFixed(1) + '秒';
    $('#resBest').textContent = 'ベスト ' + '★'.repeat(Math.max(n, before)) + '☆'.repeat(3 - Math.max(n, before));
    $('#resCoins').textContent = '🪙 +' + run.coins;
    var last = st.id >= WP.STAGES.length;
    $('#btnNext').hidden = last;
    $('#resNote').textContent = last ? 'ここまでが試作です。遊んでくれてありがとう！' : '';
    setState('result'); showScreen('result'); run.result = { stars: n };
    if (WP.audio.bgm) WP.audio.bgm(false);
    WP.audio.clear();
    var g = gen;
    for (var i = 1; i <= n; i++) (function (k) {
      setTimeout(function () {
        if (g !== gen) return;
        var all = $('#resStars').children; if (all[k - 1]) { all[k - 1].classList.add('on', 'pop'); WP.audio.star(k); WP.haptic('light'); }
      }, 350 + k * 330);
    })(i);
  }

  // ---- 一時停止 ----
  function pause() {
    if (state !== 'play' && state !== 'enter') return;
    if (run && run.running) run.elapsed += performance.now() - run.last;
    if (run) run.running = false;
    prevState = state; setState('paused'); WP.game.cancelDrag(); WP.game.lock(true);
    if (WP.audio.bgm) WP.audio.bgm(false);
    showScreen('pause');
  }
  function resume() {
    if (state !== 'paused') return;
    showScreen(null); WP.game.lock(false); setState(prevState || 'play');
    if (state === 'play' && run) { run.running = true; run.last = performance.now(); }
    if (WP.audio.bgm) WP.audio.bgm(true);
  }

  // ---- 毎フレーム（game.js の tick から呼ばれる） ----
  function tick(t) {
    if (!run || !run.running) return;
    run.elapsed += Math.min(t - run.last, 250); run.last = t; // 上限 250ms: 裏に回った等で飛んでも、一気に減らさない
    var left = timeLeft();
    renderTime();
    if (left <= 10 && !run.warned) { run.warned = true; WP.audio.warn(); }
    if (left > 10.5) run.warned = false;
    if (left <= 0) timeUp();
  }

  // ---- 開発用: タイマーなしで単語だけ遊ぶ ----
  function freePlay() {
    stop(); setState('free'); showScreen(null);
    stageLabel.textContent = 'FREE'; strip.classList.add('free'); dotsEl.innerHTML = '';
    WP.game.show(WP.game.pickWord(), { animate: false });
  }

  // ---- ボタン ----
  function on(id, fn) { $(id).addEventListener('click', function () { WP.audio.unlock(); fn(); }); }
  on('#btnPlay', goSelect);
  on('#btnTitleDev', function () { $('#gear').click(); });
  on('#btnSelBack', goTitle);
  $('#cards').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.cardbtn'); if (!b || b.disabled) return;
    WP.audio.unlock(); startStage(Number(b.getAttribute('data-id')));
  });
  on('#btnNext', function () { startStage(run ? run.st.id + 1 : 1); });
  on('#btnRetry', function () { startStage(run ? run.st.id : 1); });
  on('#btnToSelect', goSelect);
  on('#btnFailRetry', function () { startStage(run ? run.st.id : 1); });
  on('#btnFailSelect', goSelect);
  on('#btnResume', resume);
  on('#btnQuit', goSelect);
  pauseBtn.addEventListener('click', function () { WP.audio.unlock(); pause(); });
  // アプリが裏に回った・コントロールセンターを開いた時は、時間を止める
  function onHide() {
    if (WP.audio.bgm) WP.audio.bgm(false); // どの状態でも、裏に回ったら BGM を止める
    pause();
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { onHide(); return; }
    if (run && (state === 'intro' || state === 'enter' || state === 'play' || state === 'celebrate') && WP.audio.bgm) WP.audio.bgm(true);
  });
  window.addEventListener('pagehide', onHide);

  WP.flow = {
    tick: tick, goTitle: goTitle, goSelect: goSelect, startStage: startStage, freePlay: freePlay, pause: pause, resume: resume,
    state: function () { return state; },
    setTimeLeft: function (sec) { if (run) { run.bonus = sec - run.limit + run.elapsed / 1000; renderTime(); } },
    debug: function () {
      return { state: state, gen: gen, idx: run && run.idx, words: run && run.words, elapsed: run && run.elapsed, left: run && timeLeft(),
               running: run && run.running, bonus: run && run.bonus, result: run && run.result, coinsRun: run && run.coins };
    }
  };

  $('#ver').textContent = WP.BUILD;
  goTitle();
})();
