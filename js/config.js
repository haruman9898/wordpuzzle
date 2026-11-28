/* 調整用の定数と設定の保存。ゲームの数値はここと開発メニュー（⚙）から変える。 */
(function () {
  'use strict';
  var WP = window.WP;

  // localStorage は使えない環境（プライベートモード等）があるので、常に try/catch で守る
  WP.store = {
    get: function (k, def) { try { var v = localStorage.getItem(k); return v === null ? def : v; } catch (e) { return def; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 保存できなくても動く */ } }
  };

  // 開発メニューで変えられる設定
  WP.DEFAULTS = {
    SNAP_RADIUS: 70,            // 吸着範囲 (px)
    DRAG_OFFSET_Y: 45,          // ドラッグ中、指より上に浮かせる量 (px)
    HINT_DELAY_SEC: 5,          // 操作が止まってからヒントが震え始めるまで (秒)
    COINS_PER_WORD: 5,
    BONUS_SECONDS: 2,           // 単語を1つ完成するごとに足す制限時間（0 にもできる）          // 1単語完成で降ってくるコインの数
    GLOSS: false,               // パーツ・文字のつや（白いハイライト線）。proto2-a では入れていたが、見た目が好まれず既定はオフ
    CARD: true,                 // 文字枠の後ろの白いカード
    STROKE: 12,                 // 線の太さ（座標単位。承認済み = 12）
    POOL_ORIENTATION: 'matched',// 'matched' = 枠と同じ形 / 'canonical' = 型ごとの標準形
    VOLUME: 0.7,
    BGM: true,                  // BGM（ミュートとは別に切れる）
    BGM_VOL: 0.6,
    MUTE: false,
    HAPTICS: true,
    IOS_HAPTIC: 'label-onscreen', // iPhone の振動方式（開発メニューで切り替え）
    HAPTIC_ON_GRAB: true,       // 掴んだ瞬間にも軽く振動（iPhone で pointerdown が効くかの実験も兼ねる）
    SILENT_AUDIO: true,         // サイレントスイッチ下でも鳴らすための無音 <audio> ループ（音楽が止まる副作用あり）
    WORD: 'random'              // 'random' か、特定の単語
  };

  var KEY = 'wp.settings.v1';
  WP.cfg = {};
  Object.keys(WP.DEFAULTS).forEach(function (k) { WP.cfg[k] = WP.DEFAULTS[k]; });
  try {
    var saved = JSON.parse(WP.store.get(KEY, '{}') || '{}');
    Object.keys(saved).forEach(function (k) { if (k in WP.DEFAULTS) WP.cfg[k] = saved[k]; });
  } catch (e) { /* 壊れた保存値は無視 */ }
  WP.saveCfg = function () { WP.store.set(KEY, JSON.stringify(WP.cfg)); };

  // 固定の定数
  WP.LETTER_GAP = 16;           // 文字と文字の間の余白（座標単位）
  WP.HIT_RADIUS = 30;           // パーツを掴める距離 (px)。線が細いので見た目より広く取る
  WP.WORDS = ['IT', 'GO', 'UP', 'CAT', 'DOG', 'COW', 'BIRD', 'MILK', 'CAKE', 'STAR', 'FISH', 'MOON'];
  WP.WORDS_ALL = WP.WORDS.concat(['APPLE', 'WATER']); // 5文字は幅の限界確認用（開発メニューから選ぶ）
})();
