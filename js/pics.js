/* 単語のイラスト（Muse 作成。ステージ2〜6 の28語）。
   完成した瞬間に、空いたパーツ置き場へ、ポンと弾けるように出す。プレイ中は出さない（文字と枠が読みにくくなるため）。
   絵のない単語（ステージ1の2文字）や、読み込みに失敗した時は、何も出さない（レイアウトは崩さない）。 */
(function () {
  'use strict';
  var WP = window.WP;
  var $ = function (s) { return document.querySelector(s); };
  var WORDS = ['ANT', 'APPLE', 'BEACH', 'BEE', 'BIRD', 'BOOK', 'BUS', 'CAKE', 'CAR', 'CAT', 'COW', 'DOG', 'EGG', 'FISH', 'FOX',
               'HAPPY', 'HOUSE', 'MILK', 'MOON', 'MUSIC', 'PIG', 'PIZZA', 'RAIN', 'SNOW', 'STAR', 'SUN', 'TRAIN', 'WATER'];
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

  var wrap = $('#wordPic'), img = wrap.querySelector('img'), tag = $('#newTag'), hideTimer = null;

  // 完成した単語の絵を、top〜bottom（盤面の座標）の間の中央に出す。出せたら true
  function pop(word, first, top, bottom) {
    if (!has(word)) return false;
    var W = $('#stage').getBoundingClientRect().width, avail = bottom - top;
    var size = Math.floor(Math.min(220, avail - 8, W * 0.62));
    if (size < 110) return false;                       // 置き場が狭すぎる時は出さない
    clearTimeout(hideTimer);
    load(word);
    img.onerror = function () { failed[word] = true; wrap.hidden = true; };   // 表示の最中に失敗しても、壊れた絵を出さない
    img.src = url(word); img.alt = word;
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

  WP.pics = { has: has, url: url, preload: preload, pop: pop, hide: hide, words: WORDS.slice(),
              visible: function () { return !wrap.hidden && wrap.classList.contains('show'); } };
})();
