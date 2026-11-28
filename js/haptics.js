/* 振動。
   Android など: navigator.vibrate（Chrome で動くはず。実機未確認）。
   iPhone Safari: vibrate は使えないため、iOS 17.4 以降の <input type="checkbox" switch> を
   クリックした時の触覚を使う回避策を試す。効くかどうかは端末次第なので、方式を4つ用意して、
   開発メニュー（⚙）で切り替えて試せるようにしてある。
   ユーザー操作（pointerdown / pointerup / click）の中で同期的に呼ぶこと。 */
(function () {
  'use strict';
  var WP = window.WP;
  var mode = 'none', label = null, input = null;

  // 方式: 'label-onscreen' 画面内に置いたほぼ透明な label をクリック / 'label-offscreen' 画面外の label をクリック
  //       'input' input を直接クリック / 'dispatch' クリックイベントを送る
  //       'ondemand' 毎回 label を作って（display:none で）クリックし、すぐ消す（ios-haptics と同じ方式）
  WP.HAPTIC_METHODS = ['label-onscreen', 'label-offscreen', 'input', 'dispatch', 'ondemand'];

  function removeNode() { if (label && label.parentNode) label.parentNode.removeChild(label); label = null; input = null; }

  function make() {
    removeNode();
    var m = WP.cfg.IOS_HAPTIC;
    label = document.createElement('label');
    var onscreen = m !== 'label-offscreen';
    label.style.cssText = onscreen
      ? 'position:fixed;right:4px;bottom:4px;width:28px;height:28px;opacity:0.02;pointer-events:none;z-index:1;'
      : 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
    input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
  }

  function init() {
    if (typeof navigator.vibrate === 'function') { mode = 'vibrate'; return; }
    var ua = navigator.userAgent || '';
    var isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    try { make(); mode = 'ios-switch'; } catch (e) { mode = 'none'; removeNode(); }
  }

  var PATTERNS = { light: [12], medium: [22], strong: [18, 40, 34] };
  var CLICKS = { light: 1, medium: 2, strong: 3 };

  function tick() {
    var m = WP.cfg.IOS_HAPTIC;
    if (m === 'ondemand') {
      var l = document.createElement('label'), i = document.createElement('input');
      l.setAttribute('aria-hidden', 'true'); l.style.display = 'none';
      i.type = 'checkbox'; i.setAttribute('switch', ''); l.appendChild(i);
      document.head.appendChild(l); l.click();
      setTimeout(function () { if (l.parentNode) l.parentNode.removeChild(l); }, 80);
      return;
    }
    if (m === 'input') input.click();
    else if (m === 'dispatch') label.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    else label.click();
  }

  WP.haptic = function (level, force) {
    if (!WP.cfg.HAPTICS && !force) return;
    try {
      if (mode === 'vibrate') navigator.vibrate(PATTERNS[level] || PATTERNS.light);
      else if (mode === 'ios-switch' && label) { var n = CLICKS[level] || 1; for (var i = 0; i < n; i++) tick(); } // 同期で発火
    } catch (e) { /* 効かなくてもエラーにしない */ }
  };

  // はめた瞬間の振動。iPhone で「タッチが終わる瞬間（touchend）」のほうが効く場合に備えて、遅らせる方式も選べる
  var pending = null;
  WP.hapticDeferred = function (level) {
    if (mode === 'ios-switch' && WP.cfg.IOS_HAPTIC_CTX === 'touchend') { pending = { level: level, t: Date.now() }; return; }
    WP.haptic(level);
  };
  function flush() {
    if (pending && Date.now() - pending.t < 500) { var l = pending.level; pending = null; WP.haptic(l); } else pending = null;
  }
  document.addEventListener('touchend', flush, true);
  WP.hapticMode = function () { return mode === 'ios-switch' ? mode + '/' + WP.cfg.IOS_HAPTIC : mode; };
  WP.hapticSetMethod = function (m) { WP.cfg.IOS_HAPTIC = m; WP.saveCfg(); if (mode === 'ios-switch') { try { make(); } catch (e) {} } };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
