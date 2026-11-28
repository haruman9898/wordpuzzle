/* ステージ定義・出題・星の判定・進行の保存（仕様書 v0.1 §8、決定事項ログ参照）。 */
(function () {
  'use strict';
  var WP = window.WP;

  var W2 = ['IT', 'IN', 'GO', 'UP', 'ON', 'NO', 'TO', 'WE', 'DO', 'BE', 'AT', 'OK'];
  var W3 = ['CAT', 'CAR', 'COW', 'PIG', 'DOG', 'EGG', 'SUN', 'BUS', 'BEE', 'ANT', 'FOX'];
  var W4 = ['BIRD', 'CAKE', 'MILK', 'RAIN', 'FISH', 'BOOK', 'STAR', 'SNOW', 'MOON'];
  var W5 = ['APPLE', 'PIZZA', 'TRAIN', 'MUSIC', 'WATER', 'BEACH', 'HOUSE', 'HAPPY'];

  WP.partsOf = function (w) { var n = 0; for (var i = 0; i < w.length; i++) n += WP.LETTERS[w[i]].length; return n; };

  // limit = 制限時間(秒)、rem3 / rem2 = ⭐3 / ⭐2 に必要な「残り秒数」（仕様書の表）。
  // band = 出題する単語の総パーツ数の範囲（運で難易度が変わらないようにする）。
  // minLong = longLen 文字以上の単語を最低いくつ含めるか（longLen の既定は 4。ステージ3は「3〜4文字」なので1つは入れる）。
  // decoys = お邪魔パーツの数（そのワードに不要な型から選ぶ。はめられない）。
  WP.STAGES = [
    { id: 1, words: 2, pool: W2, band: [6, 8], limit: 20, rem3: 7, rem2: 3 },
    { id: 2, words: 3, pool: W3, band: [15, 17], limit: 30, rem3: 10, rem2: 5 },
    { id: 3, words: 3, pool: W3.concat(W4), band: [19, 23], limit: 35, rem3: 12, rem2: 5, minLong: 1 },
    { id: 4, words: 4, pool: W4, band: [28, 33], limit: 45, rem3: 16, rem2: 7, decoys: 2 },
    { id: 5, words: 4, pool: W4.concat(W5), band: [34, 40], limit: 50, rem3: 18, rem2: 8, decoys: 3, minLong: 1, longLen: 5 },
    { id: 6, words: 5, pool: W5, band: [46, 51], limit: 60, rem3: 21, rem2: 9, decoys: 4 }
  ];

  function combos(arr, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // そのステージの単語を引く。avoid（直前に出た単語）はできるだけ避ける。
  WP.drawWords = function (st, avoid) {
    avoid = avoid || [];
    var all = combos(st.pool, st.words).filter(function (c) {
      var total = c.reduce(function (a, w) { return a + WP.partsOf(w); }, 0);
      var longN = c.filter(function (w) { return w.length >= (st.longLen || 4); }).length;
      return total >= st.band[0] && total <= st.band[1] && longN >= (st.minLong || 0);
    });
    var fresh = all.filter(function (c) { return !c.some(function (w) { return avoid.indexOf(w) >= 0; }); });
    var from = fresh.length ? fresh : all;
    return shuffle(from[Math.floor(Math.random() * from.length)].slice());
  };

  // ⭐の判定は、ボーナス（+秒）を除いた、実際にかかった時間で行う。
  WP.starsFor = function (st, elapsedSec) {
    if (elapsedSec <= st.limit - st.rem3) return 3;
    if (elapsedSec <= st.limit - st.rem2) return 2;
    return 1;
  };

  // 進行（ステージごとの最高⭐）の保存
  var KEY = 'wp.progress.v1';
  function load() { try { var o = JSON.parse(WP.store.get(KEY, '{}') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
  WP.progress = {
    stars: function (id) { return load()[id] || 0; },
    setStars: function (id, n) { var o = load(); if (n > (o[id] || 0)) { o[id] = n; WP.store.set(KEY, JSON.stringify(o)); } },
    unlocked: function (id) { return id <= 1 || (load()[id - 1] || 0) >= 1 || WP.progress.allUnlocked(); },
    allUnlocked: function () { return WP.store.get('wp.unlockAll', '0') === '1'; },
    unlockAll: function () { WP.store.set('wp.unlockAll', '1'); },
    clear: function () { WP.store.set(KEY, '{}'); WP.store.set('wp.unlockAll', '0'); }
  };
})();
