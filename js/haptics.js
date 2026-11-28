/* 振動。
   Android など: navigator.vibrate。
   iPhone Safari: vibrate は使えないため、iOS 17.4 以降の <input type="checkbox" switch> を
   クリックした時の触覚を使う回避策を試す（要実機確認）。ユーザー操作（pointerup など）の中で
   同期的に呼ぶこと。setTimeout や requestAnimationFrame の中では効かない可能性が高い。 */
(function () {
  'use strict';
  var WP = window.WP;
  var mode = 'none', label = null;

  function init() {
    if (typeof navigator.vibrate === 'function') { mode = 'vibrate'; return; }
    var ua = navigator.userAgent || '';
    var isIOS = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (!isIOS) return;
    try {
      label = document.createElement('label');
      label.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('switch', '');
      label.appendChild(input);
      document.body.appendChild(label);
      mode = 'ios-switch';
    } catch (e) { mode = 'none'; label = null; }
  }

  var PATTERNS = { light: [12], medium: [22], strong: [18, 40, 34] };
  var CLICKS = { light: 1, medium: 2, strong: 3 };

  WP.haptic = function (level) {
    if (!WP.cfg.HAPTICS) return;
    try {
      if (mode === 'vibrate') {
        navigator.vibrate(PATTERNS[level] || PATTERNS.light);
      } else if (mode === 'ios-switch' && label) {
        var n = CLICKS[level] || 1;
        for (var i = 0; i < n; i++) label.click(); // 同期で発火（ジェスチャ内）
      }
    } catch (e) { /* 効かなくてもエラーにしない */ }
  };
  WP.hapticMode = function () { return mode; };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
