/* 単語のイラスト（Muse 作成。ステージ2〜6 の28語）。
   完成した瞬間に、空いたパーツ置き場へ、ポンと弾けるように出す。プレイ中は出さない（文字と枠が読みにくくなるため）。
   絵のない単語（ステージ1の2文字）や、読み込みに失敗した時は、何も出さない（レイアウトは崩さない）。 */
(function () {
  'use strict';
  var WP = window.WP;
  var $ = function (s) { return document.querySelector(s); };
  var WORDS = ['ANT', 'APPLE', 'BEACH', 'BEE', 'BIRD', 'BOOK', 'BUS', 'CAKE', 'CAR', 'CAT', 'COW', 'DOG', 'EGG', 'FISH', 'FOX',
               'HAPPY', 'HOUSE', 'MILK', 'MOON', 'MUSIC', 'PIG', 'PIZZA', 'RAIN', 'SNOW', 'STAR', 'SUN', 'TRAIN', 'WATER'];
  // 絵の中身（透明でない部分）の範囲 [x0, y0, x1, y1]（256px の画像の中）。`tools/measure_pics.py` で測る。新しい絵を足したら測り直す
  var META = {
    ant: [31, 23, 227, 255],
    apple: [23, 11, 234, 247],
    beach: [7, 15, 248, 247],
    bee: [54, 22, 204, 255],
    bird: [12, 27, 233, 235],
    book: [42, 27, 220, 240],
    bus: [20, 30, 234, 246],
    cake: [11, 35, 244, 225],
    car: [0, 38, 255, 223],
    cat: [24, 5, 239, 255],
    cow: [16, 4, 238, 251],
    dog: [12, 14, 246, 255],
    egg: [62, 21, 193, 252],
    fish: [16, 46, 240, 222],
    fox: [3, 11, 251, 255],
    happy: [15, 17, 244, 245],
    house: [12, 14, 245, 248],
    milk: [73, 14, 189, 245],
    moon: [40, 36, 223, 230],
    music: [10, 34, 247, 225],
    pig: [5, 34, 250, 255],
    pizza: [5, 16, 252, 244],
    rain: [12, 27, 235, 239],
    snow: [37, 30, 218, 234],
    star: [26, 38, 222, 229],
    sun: [46, 14, 212, 255],
    train: [2, 35, 251, 225],
    water: [34, 16, 225, 244]
  };
  // Muse の元の絵で、縦に引き伸ばされているものの補正（横に何倍に広げて見せるか）。元の絵が直ったら、1 に戻す（=この行を消す）
  var ASPECT = { sun: 1.4, egg: 1.3, bee: 1.12, milk: 1.1 };
  var TARGET = 188;   // 見た目の大きさのそろえ方（絵の中身の面積の平方根）。横に広い絵と、縦に細い絵の、大きさの印象をそろえる
  var known = {}, failed = {}, cache = {};

  WORDS.forEach(function (w) { known[w] = true; });

  function url(w) { return 'assets/images/words/' + w.toLowerCase() + '.webp?v=' + WP.BUILD; }
  function has(w) { return !!known[w] && !failed[w]; }
  function load(w) {
    if (!known[w]) return null;
    if (!cache[w]) { var im = new Image(); im.decoding = 'async'; im.onerror = function () { failed[w] = true; }; im.src = url(w); cache[w] = im; }
    return cache[w];
  }
  function preload(words) { words.forEach(load); }

  // 絵の見せ方: 縦伸びの補正 + 大きさのそろえ + 中央寄せ（CSS の transform の値）
  function transformOf(word) {
    var m = META[word.toLowerCase()]; if (!m) return '';
    var w = m[2] - m[0] + 1, h = m[3] - m[1] + 1, ax = ASPECT[word.toLowerCase()] || 1, ew = w * ax;
    var s = Math.min(TARGET / Math.sqrt(ew * h), 250 / Math.max(ew, h)); s = Math.max(0.8, Math.min(1.12, s));
    var cx = (m[0] + m[2]) / 2, cy = (m[1] + m[3]) / 2;
    return 'translate(' + (-(s * ax) * (cx - 128) / 256 * 100).toFixed(2) + '%, ' + (-s * (cy - 128) / 256 * 100).toFixed(2) + '%) scale(' + (s * ax).toFixed(3) + ', ' + s.toFixed(3) + ')';
  }

  var wrap = $('#wordPic'), img = wrap.querySelector('img'), tag = $('#newTag'), hideTimer = null;

  // 完成した単語の絵を、top〜bottom（盤面の座標）の間の中央に出す。出せたら true
  function pop(word, first, top, bottom) {
    if (!has(word)) return false;
    var W = $('#stage').getBoundingClientRect().width, avail = bottom - top;
    var size = Math.floor(Math.min(184, avail - 8, W * 0.5));
    if (size < 110) return false;                       // 置き場が狭すぎる時は出さない
    clearTimeout(hideTimer);
    load(word);
    img.onerror = function () { failed[word] = true; wrap.hidden = true; };   // 表示の最中に失敗しても、壊れた絵を出さない
    img.src = url(word); img.alt = word; img.style.transform = transformOf(word);
    wrap.style.width = wrap.style.height = size + 'px';
    wrap.style.left = Math.round((W - size) / 2) + 'px';
    wrap.style.top = Math.round(top + (avail - size) / 2) + 'px';
    tag.hidden = !first;
    wrap.hidden = false; wrap.classList.remove('hide');
    wrap.classList.remove('show'); void wrap.offsetWidth; wrap.classList.add('show');
    return true;
  }
  function hide() {
    if (wrap.hidden) return;
    wrap.classList.remove('show'); wrap.classList.add('hide');
    clearTimeout(hideTimer); hideTimer = setTimeout(function () { wrap.hidden = true; wrap.classList.remove('hide'); }, 280);
  }

  WP.pics = { has: has, url: url, transformOf: transformOf, preload: preload, pop: pop, hide: hide, words: WORDS.slice(),
              visible: function () { return !wrap.hidden && wrap.classList.contains('show'); } };
})();
