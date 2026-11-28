/* 着せ替え: コインで「背景」と「文字の色」を買って、選べる。
   背景は CSS の変数（色）を差し替え、文字の色は WP.COLORS（型ごとの色）を差し替える。
   所持・選択中は localStorage に保存（使えない環境でも、その場では動く）。 */
(function () {
  'use strict';
  var WP = window.WP;
  var $ = function (s) { return document.querySelector(s); };

  // ---- 背景（色の変数のセット） ----
  var BASE = {
    '--bg1': '#faf8f2', '--bg2': '#eee9dc', '--ink': '#23211d', '--sub': '#7a766c', '--slot': '#d3cec1',
    '--panel': '#ffffff', '--panel-line': '#e4e0d6', '--dot': '#d9d4c6', '--dotcur': '#b9b3a1', '--barbg': '#e6e1d4',
    '--veil': 'rgba(246,244,239,.9)', '--veil2': 'rgba(246,244,239,.97)', '--btn': '#23211d', '--btn-ink': '#ffffff',
    '--shadow-w': 'rgba(255,255,255,.9)', '--pulse': '#f2a98c', '--wcard': 'rgba(255,255,255,.78)', '--wcard-line': '#e8e3d6', '--wcard-sh': 'rgba(0,0,0,.05)'
  };
  function mk(o) { var r = {}, k; for (k in BASE) r[k] = BASE[k]; for (k in o) r[k] = o[k]; return r; }

  var BG = [
    { id: 'cream', name: 'クリーム', price: 0, vars: mk({}) },
    { id: 'sky', name: 'そら', price: 30, vars: mk({ '--bg1': '#e8f4ff', '--bg2': '#cfe6fb', '--ink': '#1d2a3a', '--sub': '#5f7185', '--slot': '#b7cde3',
        '--panel-line': '#cfe0f0', '--dot': '#bcd3e8', '--dotcur': '#8fb0cf', '--barbg': '#d4e5f4', '--veil': 'rgba(232,244,255,.9)', '--veil2': 'rgba(232,244,255,.97)',
        '--btn': '#1d2a3a', '--wcard': 'rgba(255,255,255,.7)', '--wcard-line': '#cfe0f0' }) },
    { id: 'forest', name: 'もり', price: 50, vars: mk({ '--bg1': '#eef7ea', '--bg2': '#d6ebcf', '--ink': '#1f2b1d', '--sub': '#5d7557', '--slot': '#bcd3b4',
        '--panel-line': '#cfe3c7', '--dot': '#c3d9bb', '--dotcur': '#93b58a', '--barbg': '#d5e8cf', '--veil': 'rgba(238,247,234,.9)', '--veil2': 'rgba(238,247,234,.97)',
        '--btn': '#1f2b1d', '--wcard': 'rgba(255,255,255,.7)', '--wcard-line': '#cfe3c7' }) },
    { id: 'sunset', name: 'ゆうやけ', price: 80, vars: mk({ '--bg1': '#fff1e4', '--bg2': '#fbd0c0', '--ink': '#3a2220', '--sub': '#8a6560', '--slot': '#ebc4b4',
        '--panel-line': '#f3d3c6', '--dot': '#efcdbd', '--dotcur': '#d9a595', '--barbg': '#f6d9cc', '--veil': 'rgba(255,241,228,.9)', '--veil2': 'rgba(255,241,228,.97)',
        '--btn': '#3a2220', '--wcard': 'rgba(255,255,255,.65)', '--wcard-line': '#f3d3c6' }) },
    { id: 'night', name: 'よぞら', price: 120, vars: mk({ '--bg1': '#1b2240', '--bg2': '#0e1226', '--ink': '#f2efe6', '--sub': '#a9b0c2', '--slot': '#3b4560',
        '--panel': '#262e52', '--panel-line': '#38426b', '--dot': '#3b4560', '--dotcur': '#6f7aa3', '--barbg': '#2c3560', '--veil': 'rgba(14,18,38,.88)', '--veil2': 'rgba(14,18,38,.97)',
        '--btn': '#f2efe6', '--btn-ink': '#14182f', '--shadow-w': 'rgba(0,0,0,.4)', '--pulse': '#e4846a', '--wcard': 'rgba(255,255,255,.07)', '--wcard-line': '#38426b', '--wcard-sh': 'rgba(0,0,0,.25)' }) }
  ];

  // ---- 文字の色（型ごとの色） ----
  var PAL = [
    { id: 'standard', name: 'ふつう', price: 0, colors: { I: '#e4572e', C: '#17a5a8', V: '#e8b100', L: '#6aa332', D: '#2e86ab', O: '#a23b72', P: '#7b2cbf', F: '#f18f01', J: '#0b8a63' } },
    { id: 'pastel', name: 'パステル', price: 30, colors: { I: '#f08a7c', C: '#6fcfcb', V: '#f3cf62', L: '#9cca78', D: '#7db4d1', O: '#c77aa2', P: '#a98ae0', F: '#f5b25e', J: '#58b99a' } },
    { id: 'pop', name: 'ポップ', price: 50, colors: { I: '#ff3b3b', C: '#00c2d1', V: '#ffd400', L: '#3ddc4a', D: '#2f6bff', O: '#e6199a', P: '#8a2be2', F: '#ff8a00', J: '#00a86b' } },
    { id: 'mono', name: 'ブルーグレー', price: 80, colors: { I: '#5b6b85', C: '#7d8ea8', V: '#44546e', L: '#8b9cb5', D: '#33445f', O: '#6d7d96', P: '#4b5b76', F: '#93a3bb', J: '#576781' } },
    { id: 'neon', name: 'ネオン', price: 120, colors: { I: '#ff4d6d', C: '#00e5ff', V: '#ffe600', L: '#7cff4d', D: '#4d7cff', O: '#ff4df0', P: '#b04dff', F: '#ff9a3c', J: '#00ffa3' } }
  ];

  var LISTS = { bg: BG, pal: PAL };
  function find(kind, id) { var L = LISTS[kind]; for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return L[0]; }

  // ---- 保存 ----
  var KEY = 'wp.shop.v1';
  function load() {
    var o = {};
    try { o = JSON.parse(WP.store.get(KEY, '{}') || '{}') || {}; } catch (e) { o = {}; }
    o.own = o.own || {}; o.eq = o.eq || {};
    ['bg', 'pal'].forEach(function (k) {
      var base = LISTS[k][0].id;
      o.own[k] = Array.isArray(o.own[k]) && o.own[k].length ? o.own[k] : [base];
      if (o.own[k].indexOf(base) < 0) o.own[k].push(base);
      if (o.own[k].indexOf(o.eq[k]) < 0) o.eq[k] = base; // 持っていない物は選べない
    });
    return o;
  }
  var S = load();
  function save() { WP.store.set(KEY, JSON.stringify(S)); }

  // ---- 反映 ----
  function applyBg(id) {
    var t = find('bg', id), root = document.documentElement, k;
    for (k in t.vars) root.style.setProperty(k, t.vars[k]);
    var m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t.vars['--bg1']);
  }
  function applyPal(id) {
    var p = find('pal', id), root = document.documentElement;
    WP.COLORS = {}; Object.keys(p.colors).forEach(function (k) { WP.COLORS[k] = p.colors[k]; root.style.setProperty('--tc-' + k, p.colors[k]); });
  }
  function applyAll() { applyBg(S.eq.bg); applyPal(S.eq.pal); }

  // ---- 画面 ----
  var tab = 'bg', sel = { bg: null, pal: null };
  var SW = 'fill="none" stroke-linecap="round" stroke-linejoin="round"';

  function previewBg(t, i) {
    var v = t.vars, A = WP.LETTERS.A, B = WP.LETTERS.B, std = PAL[0].colors;
    return '<svg viewBox="0 0 96 64" width="96" height="64"><defs><linearGradient id="bgp' + i + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + v['--bg1'] + '"/><stop offset="1" stop-color="' + v['--bg2'] + '"/></linearGradient></defs>' +
      '<rect x="1.5" y="1.5" width="93" height="61" rx="12" fill="url(#bgp' + i + ')" stroke="' + v['--panel-line'] + '" stroke-width="2"/>' +
      '<g transform="translate(14 9) scale(.46)">' + A.map(function (p) { return '<path d="' + p.d + '" ' + SW + ' stroke="' + std[p.t] + '" stroke-width="12"/>'; }).join('') + '</g>' +
      '<g transform="translate(52 9) scale(.46)">' + B.map(function (p) { return '<path d="' + p.d + '" ' + SW + ' stroke="' + v['--slot'] + '" stroke-width="12"/>'; }).join('') + '</g></svg>';
  }
  function previewPal(p) {
    var types = ['I', 'V', 'C', 'L', 'D'], o = '<svg viewBox="0 0 96 64" width="96" height="64">';
    types.forEach(function (t, i) { o += '<g transform="translate(' + (1 + i * 19) + ' 14) scale(.34)"><path d="' + WP.CANON[t] + '" ' + SW + ' stroke="' + p.colors[t] + '" stroke-width="13"/></g>'; });
    return o + '</svg>';
  }

  function render() {
    var list = LISTS[tab], cur = S.eq[tab];
    if (!sel[tab]) sel[tab] = cur;
    $('#shopCoins').textContent = '🪙 ' + WP.fx.coinTotal();
    $('#tabBg').classList.toggle('on', tab === 'bg'); $('#tabPal').classList.toggle('on', tab === 'pal');
    $('#shopList').innerHTML = list.map(function (it, i) {
      var owned = S.own[tab].indexOf(it.id) >= 0, eq = it.id === cur;
      var tag = eq ? '<span class="tag eq">✓ つかっている</span>' : owned ? '<span class="tag">もっている</span>' : '<span class="tag">🪙 ' + it.price + '</span>';
      return '<button type="button" class="shopitem' + (it.id === sel[tab] ? ' sel' : '') + '" data-id="' + it.id + '"><span class="pv">' +
        (tab === 'bg' ? previewBg(it, i) : previewPal(it)) + '</span><span class="nm">' + it.name + '</span>' + tag + '</button>';
    }).join('');
    var it2 = find(tab, sel[tab]), own2 = S.own[tab].indexOf(it2.id) >= 0, btn = $('#btnShopAct'), msg = $('#shopMsg'), coins = WP.fx.coinTotal();
    msg.textContent = '';
    if (it2.id === cur) { btn.textContent = 'つかっている'; btn.disabled = true; }
    else if (own2) { btn.textContent = 'つかう'; btn.disabled = false; }
    else if (coins >= it2.price) { btn.textContent = '🪙 ' + it2.price + ' で買う'; btn.disabled = false; }
    else { btn.textContent = '🪙 ' + it2.price; btn.disabled = true; msg.textContent = 'コインが足りません（あと ' + (it2.price - coins) + '）'; }
  }

  function act() {
    var it = find(tab, sel[tab]), own = S.own[tab].indexOf(it.id) >= 0, btn = $('#btnShopAct'), r = btn.getBoundingClientRect();
    if (!own) {
      if (!WP.fx.spend(it.price)) { render(); return; }
      S.own[tab].push(it.id);
      WP.audio.coin(); WP.fx.ringView(r.left + r.width / 2, r.top + r.height / 2, '#f6c542', 90); WP.fx.burstView(r.left + r.width / 2, r.top + r.height / 2, '#f6c542', 14);
    } else { WP.audio.star(1); }
    S.eq[tab] = it.id; save();
    if (tab === 'bg') applyBg(it.id); else applyPal(it.id);
    render();
  }

  $('#tabBg').addEventListener('click', function () { tab = 'bg'; render(); });
  $('#tabPal').addEventListener('click', function () { tab = 'pal'; render(); });
  $('#shopList').addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.shopitem'); if (!b) return;
    sel[tab] = b.getAttribute('data-id'); render();
  });
  $('#btnShopAct').addEventListener('click', function () { WP.audio.unlock(); act(); });

  WP.shop = {
    open: function () { tab = 'bg'; sel.bg = S.eq.bg; sel.pal = S.eq.pal; render(); },
    state: function () { return JSON.parse(JSON.stringify(S)); },
    items: function () { return { bg: BG.map(function (i) { return i.id; }), pal: PAL.map(function (i) { return i.id; }) }; },
    reset: function () { WP.store.set(KEY, '{}'); S = load(); applyAll(); render(); }
  };

  applyAll();
})();
