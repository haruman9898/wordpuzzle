/* 単語図鑑: 完成させた単語が溜まる。絵のある単語は、絵（未完成の間は灰色のシルエット）で並ぶ。
   ステージ1の2文字の単語は絵がないので、文字だけのチップで並ぶ。 */
(function () {
  'use strict';
  var WP = window.WP;
  var $ = function (s) { return document.querySelector(s); };

  // 出題される全単語（ステージの出題順に、重複なし）
  var ALL = [];
  WP.STAGES.forEach(function (st) { st.pool.forEach(function (w) { if (ALL.indexOf(w) < 0) ALL.push(w); }); });
  var PICS = ALL.filter(function (w) { return WP.pics.has(w); });
  var TEXTS = ALL.filter(function (w) { return !WP.pics.has(w); });

  var KEY = 'wp.book.v1';
  function load() {
    var o = {};
    try { o = JSON.parse(WP.store.get(KEY, '{}') || '{}') || {}; } catch (e) { o = {}; }
    if (!o.words || typeof o.words !== 'object') o.words = {};
    return o;
  }
  var S = load();
  function save() { WP.store.set(KEY, JSON.stringify(S)); }

  // 完成を記録する。初めての単語なら first = true
  function record(word) {
    var e = S.words[word], first = !e;
    if (first) e = S.words[word] = { n: 0 };
    e.n++; save();
    return { first: first, count: e.n };
  }
  function count(w) { return (S.words[w] && S.words[w].n) || 0; }
  function total() { return ALL.filter(function (w) { return count(w) > 0; }).length; }

  // ---- 画面 ----
  function wordHtml(w) {
    // 文字ごとに、最初のパーツの型の色（今の文字の色）で
    return w.split('').map(function (ch) { var t = WP.LETTERS[ch][0].t; return '<b style="color:' + WP.COLORS[t] + '">' + ch + '</b>'; }).join('');
  }
  function render() {
    $('#bookCount').textContent = total() + ' / ' + ALL.length;
    var o = PICS.map(function (w) {
      var seen = count(w) > 0;
      return '<button type="button" class="bk' + (seen ? ' seen' : '') + '" data-w="' + w + '"><span class="bkimg"><img src="' + WP.pics.url(w) + '" alt="' + (seen ? w : '') + '" class="' + (seen ? '' : 'sil') + '" style="transform:' + WP.pics.transformOf(w) + '"></span><span class="bkname">' + (seen ? wordHtml(w) : '？？？') + '</span></button>';
    }).join('');
    $('#bookList').innerHTML = o + (TEXTS.length ? '<h3 class="bksec">さいしょのことば</h3><div class="chips">' + TEXTS.map(function (w) {
      var seen = count(w) > 0; return '<span class="chip' + (seen ? ' seen' : '') + '">' + (seen ? wordHtml(w) : '？？') + '</span>';
    }).join('') + '</div>' : '');
  }
  function detail(w) {
    $('#bdImg').src = WP.pics.url(w); $('#bdImg').alt = w; $('#bdImg').style.transform = WP.pics.transformOf(w);
    $('#bdWord').innerHTML = wordHtml(w);
    $('#bdCount').textContent = count(w) + ' かい つくった';
    $('#bookDetail').hidden = false;
  }

  $('#bookList').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.bk'); if (!b) return;
    var w = b.getAttribute('data-w');
    if (count(w) > 0) { WP.audio.unlock(); WP.audio.star(1); detail(w); }
  });
  $('#bookDetail').addEventListener('click', function () { $('#bookDetail').hidden = true; });

  WP.book = {
    record: record, count: count, total: total, all: ALL.slice(), pics: PICS.slice(), texts: TEXTS.slice(),
    render: render, closeDetail: function () { $('#bookDetail').hidden = true; },
    reset: function () { S = { words: {} }; save(); render(); }
  };
})();
