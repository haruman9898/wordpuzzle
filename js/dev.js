/* 開発用: 診断表示（左上）と、定数を調整できる開発メニュー（⚙）。 */
(function () {
  'use strict';
  var WP = window.WP, cfg = WP.cfg;
  var $ = function (s) { return document.querySelector(s); };
  var diag = $('#diag'), dev = $('#dev'), gear = $('#gear'), bgmTest = false;

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
    ['BONUS_SECONDS', '単語完成ボーナス (秒)', 0, 5, 0.5, false],
    ['STROKE', '線の太さ', 8, 16, 1, true],
    ['VOLUME', '音量（効果音）', 0, 1, 0.05, false],
    ['BGM_VOL', 'BGM の音量', 0, 1, 0.05, false]
  ];

  function build() {
    var h = '<div class="btns"><button class="primary" id="devClose">閉じる</button><button id="devReload">再読み込み</button></div>';
    h += '<h3>調整用の定数</h3>';
    SLIDERS.forEach(function (s) {
      h += '<div class="row"><label>' + s[1] + '</label><input type="range" data-k="' + s[0] + '" data-rb="' + s[5] + '" min="' + s[2] + '" max="' + s[3] + '" step="' + s[4] + '" value="' + cfg[s[0]] + '"><span class="v" data-v="' + s[0] + '">' + cfg[s[0]] + '</span></div>';
    });
    h += '<div class="row"><label>パーツの見せ方</label><select id="devOrient"><option value="matched">matched（枠と同じ形）</option><option value="canonical">canonical（型ごとの標準形）</option></select></div>';
    h += '<div class="row"><label>フリープレイの単語</label><select id="devWord"><option value="random">ランダム</option>' + WP.WORDS_ALL.map(function (w) { return '<option>' + w + '</option>'; }).join('') + '</select></div>';
    h += '<div class="row"><label>パーツのつや</label><input type="checkbox" id="devGloss"></div>';
    h += '<div class="row"><label>文字枠のカード</label><input type="checkbox" id="devCard"></div>';
    h += '<div class="row"><label>ミュート（全部）</label><input type="checkbox" id="devMute"></div>';
    h += '<div class="row"><label>BGM</label><input type="checkbox" id="devBgm"></div>';
    h += '<div class="row"><label>振動</label><input type="checkbox" id="devHaptics"></div>';
    h += '<div class="row"><label>無音ループ（要再読み込み）</label><input type="checkbox" id="devSilent"></div>';
    h += '<h3>振動テスト（現在の方式: <span id="devHm"></span>）</h3>';
    h += '<div class="row"><label>iPhone の振動方式</label><select id="devHmethod">' + WP.HAPTIC_METHODS.map(function (m) { return '<option>' + m + '</option>'; }).join('') + '</select></div>';
    h += '<div class="btns"><button data-h="light">弱</button><button data-h="medium">中</button><button data-h="strong">強</button></div>';
    h += '<div class="row" style="margin-top:10px"><label>本物のスイッチ（直接タップして触覚を確認）</label><input type="checkbox" switch id="devRealSwitch"></div>';
    h += '<div class="row"><label>掴んだ瞬間にも振動</label><input type="checkbox" id="devGrab"></div>';
    h += '<h3>音テスト</h3><div class="btns"><button data-s="fit">はまる</button><button data-s="wrong">違う枠</button><button data-s="letter">文字完成</button><button data-s="word">単語完成</button><button data-s="coin">コイン</button><button data-s="bgmtest">BGM 試聴</button></div>';
    h += '<h3>ステージ</h3><div class="btns"><button data-st="1">ステージ1</button><button data-st="2">ステージ2</button><button data-st="3">ステージ3</button><button id="devLeft3">残り3秒にする</button></div>';
    h += '<div class="btns" style="margin-top:8px"><button id="devUnlock">全ステージ解放</button><button id="devProg">進行を消す</button><button id="devTitle">タイトルへ</button><button id="devFree">フリープレイ（タイマーなし）</button></div>';
    h += '<h3>その他</h3><div class="btns"><button id="devTut">チュートリアルをもう一度</button><button id="devCoins">コインを0に</button></div>';
    h += '<h3>プレイログ</h3><textarea id="devLog" readonly></textarea><div class="btns" style="margin-top:8px"><button class="primary" id="devCopy">ログをコピー</button><button id="devClear">ログを消す</button></div>';
    dev.innerHTML = h;

    $('#devOrient').value = cfg.POOL_ORIENTATION;
    $('#devWord').value = cfg.WORD;
    $('#devGloss').checked = cfg.GLOSS;
    $('#devCard').checked = cfg.CARD;
    $('#devMute').checked = cfg.MUTE;
    $('#devBgm').checked = cfg.BGM;
    $('#devHaptics').checked = cfg.HAPTICS;
    $('#devSilent').checked = cfg.SILENT_AUDIO;
    $('#devHmethod').value = cfg.IOS_HAPTIC;
    $('#devGrab').checked = cfg.HAPTIC_ON_GRAB;
  }

  function open() {
    WP.flow.pause();
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
    if (k === 'BGM_VOL') WP.audio.bgmRefresh();
    if (t.getAttribute('data-rb') !== 'true') changed(false);
  });
  dev.addEventListener('change', function (e) {
    var t = e.target;
    if (t.getAttribute('data-k') && t.getAttribute('data-rb') === 'true') changed(true);
  });
  $('#devOrient').addEventListener('change', function (e) { cfg.POOL_ORIENTATION = e.target.value; changed(true); });
  $('#devWord').addEventListener('change', function (e) { cfg.WORD = e.target.value; changed(false); WP.flow.freePlay(); close(); });
  $('#devGloss').addEventListener('change', function (e) { cfg.GLOSS = e.target.checked; changed(true); });
  $('#devCard').addEventListener('change', function (e) { cfg.CARD = e.target.checked; changed(true); });
  $('#devMute').addEventListener('change', function (e) { cfg.MUTE = e.target.checked; changed(false); WP.audio.bgmRefresh(); });
  $('#devBgm').addEventListener('change', function (e) { cfg.BGM = e.target.checked; changed(false); WP.audio.bgmRefresh(); });
  $('#devHmethod').addEventListener('change', function (e) { WP.hapticSetMethod(e.target.value); $('#devHm').textContent = WP.hapticMode(); });
  $('#devGrab').addEventListener('change', function (e) { cfg.HAPTIC_ON_GRAB = e.target.checked; changed(false); });
  $('#devSilent').addEventListener('change', function (e) { cfg.SILENT_AUDIO = e.target.checked; changed(false); });
  $('#devHaptics').addEventListener('change', function (e) { cfg.HAPTICS = e.target.checked; changed(false); });

  dev.addEventListener('click', function (e) {
    var t = e.target;
    WP.audio.unlock();
    var hs = t.getAttribute('data-h'), ss = t.getAttribute('data-s'), stg = t.getAttribute('data-st');
    if (stg) { close(); WP.flow.startStage(Number(stg)); return; }
    if (hs) { WP.haptic(hs); return; } // クリックの中で同期的に呼ぶ
    if (ss) { if (ss === 'fit') WP.audio.fit(3); else if (ss === 'bgmtest') { bgmTest = !bgmTest; WP.audio.bgm(bgmTest); t.textContent = bgmTest ? 'BGM 停止' : 'BGM 試聴'; } else WP.audio[ss](); return; }
    switch (t.id) {
      case 'devClose': close(); break;
      case 'devReload': location.reload(); break;
      case 'devTut': WP.game.resetTutorial(); close(); break;
      case 'devCoins': WP.game.resetCoins(); break;
      case 'devLeft3': WP.flow.setTimeLeft(3); close(); WP.flow.resume(); break;
      case 'devUnlock': WP.progress.unlockAll(); break;
      case 'devProg': WP.progress.clear(); break;
      case 'devTitle': close(); WP.flow.goTitle(); break;
      case 'devFree': close(); WP.flow.freePlay(); break;
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
