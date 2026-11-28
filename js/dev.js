/* 開発用: 診断表示（左上）と、定数を調整できる開発メニュー（⚙）。 */
(function () {
  'use strict';
  var WP = window.WP, cfg = WP.cfg;
  var $ = function (s) { return document.querySelector(s); };
  var diag = $('#diag'), dev = $('#dev'), gear = $('#gear');

  // ---- 診断表示 ----
  function refreshDiag() {
    diag.textContent = [
      WP.BUILD + '  FPS ' + WP.perf.fps + ' (min ' + WP.perf.minFps + ') worst ' + WP.perf.worstMs + 'ms',
      '振動 ' + WP.hapticMode() + ' / 音 ' + WP.audio.state() + ' / ' + window.innerWidth + 'x' + window.innerHeight + '@' + (window.devicePixelRatio || 1) + 'x'
    ].join('\n');
  }
  setInterval(refreshDiag, 500); refreshDiag();

  // ---- 開発メニュー ----
  var SLIDERS = [
    ['SNAP_RADIUS', '吸着範囲 (px)', 20, 120, 1, false],
    ['DRAG_OFFSET_Y', 'ドラッグ上オフセット (px)', 0, 100, 1, false],
    ['HINT_DELAY_SEC', 'ヒント開始 (秒)', 2, 12, 0.5, false],
    ['COINS_PER_WORD', 'コイン / 単語', 0, 20, 1, false],
    ['STROKE', '線の太さ', 8, 16, 1, true],
    ['VOLUME', '音量', 0, 1, 0.05, false]
  ];

  function build() {
    var h = '<div class="btns"><button class="primary" id="devClose">閉じる</button><button id="devReload">再読み込み</button></div>';
    h += '<h3>調整用の定数</h3>';
    SLIDERS.forEach(function (s) {
      h += '<div class="row"><label>' + s[1] + '</label><input type="range" data-k="' + s[0] + '" data-rb="' + s[5] + '" min="' + s[2] + '" max="' + s[3] + '" step="' + s[4] + '" value="' + cfg[s[0]] + '"><span class="v" data-v="' + s[0] + '">' + cfg[s[0]] + '</span></div>';
    });
    h += '<div class="row"><label>パーツの見せ方</label><select id="devOrient"><option value="matched">matched（枠と同じ形）</option><option value="canonical">canonical（型ごとの標準形）</option></select></div>';
    h += '<div class="row"><label>出題する単語</label><select id="devWord"><option value="random">ランダム</option>' + WP.WORDS_ALL.map(function (w) { return '<option>' + w + '</option>'; }).join('') + '</select></div>';
    h += '<div class="row"><label>ミュート</label><input type="checkbox" id="devMute"></div>';
    h += '<div class="row"><label>振動</label><input type="checkbox" id="devHaptics"></div>';
    h += '<h3>振動テスト（現在の方式: <span id="devHm"></span>）</h3><div class="btns"><button data-h="light">弱</button><button data-h="medium">中</button><button data-h="strong">強</button></div>';
    h += '<h3>音テスト</h3><div class="btns"><button data-s="fit">はまる</button><button data-s="wrong">違う枠</button><button data-s="letter">文字完成</button><button data-s="word">単語完成</button><button data-s="coin">コイン</button></div>';
    h += '<h3>その他</h3><div class="btns"><button id="devTut">チュートリアルをもう一度</button><button id="devCoins">コインを0に</button><button id="devNew">別の単語</button></div>';
    h += '<h3>プレイログ</h3><textarea id="devLog" readonly></textarea><div class="btns" style="margin-top:8px"><button class="primary" id="devCopy">ログをコピー</button><button id="devClear">ログを消す</button></div>';
    dev.innerHTML = h;

    $('#devOrient').value = cfg.POOL_ORIENTATION;
    $('#devWord').value = cfg.WORD;
    $('#devMute').checked = cfg.MUTE;
    $('#devHaptics').checked = cfg.HAPTICS;
  }

  function open() {
    $('#devHm').textContent = WP.hapticMode();
    $('#devLog').value = WP.logText();
    dev.hidden = false;
  }
  function close() { dev.hidden = true; }

  function changed(rebuild) { WP.saveCfg(); if (rebuild) WP.game.rebuild(); }

  build();
  gear.addEventListener('click', open);

  dev.addEventListener('input', function (e) {
    var t = e.target, k = t.getAttribute && t.getAttribute('data-k');
    if (!k) return;
    cfg[k] = Number(t.value);
    dev.querySelector('[data-v="' + k + '"]').textContent = t.value;
    if (k === 'VOLUME') WP.audio.setVolume(cfg.VOLUME);
    if (t.getAttribute('data-rb') !== 'true') changed(false);
  });
  dev.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute('data-k') && t.getAttribute('data-rb') === 'true') changed(true);
  });
  $('#devOrient').addEventListener('change', function (e) { cfg.POOL_ORIENTATION = e.target.value; changed(true); });
  $('#devWord').addEventListener('change', function (e) { cfg.WORD = e.target.value; changed(false); WP.game.newWord(cfg.WORD === 'random' ? null : cfg.WORD); });
  $('#devMute').addEventListener('change', function (e) { cfg.MUTE = e.target.checked; changed(false); });
  $('#devHaptics').addEventListener('change', function (e) { cfg.HAPTICS = e.target.checked; changed(false); });

  dev.addEventListener('click', function (e) {
    var t = e.target;
    WP.audio.unlock();
    var hs = t.getAttribute('data-h'), ss = t.getAttribute('data-s');
    if (hs) { WP.haptic(hs); return; } // クリックの中で同期的に呼ぶ
    if (ss) { if (ss === 'fit') WP.audio.fit(3); else WP.audio[ss](); return; }
    switch (t.id) {
      case 'devClose': close(); break;
      case 'devReload': location.reload(); break;
      case 'devTut': WP.game.resetTutorial(); close(); break;
      case 'devCoins': WP.game.resetCoins(); break;
      case 'devNew': WP.game.newWord(); close(); break;
      case 'devClear': WP.game.clearLog(); $('#devLog').value = WP.logText(); break;
      case 'devCopy': {
        var ta = $('#devLog'); ta.value = WP.logText(); ta.focus(); ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (err) {}
        if (!ok && navigator.clipboard) { navigator.clipboard.writeText(ta.value).catch(function () {}); }
        t.textContent = 'コピーしました'; setTimeout(function () { t.textContent = 'ログをコピー'; }, 1500);
        break;
      }
    }
  });
})();
