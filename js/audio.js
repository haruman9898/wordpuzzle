/* 効果音は音声ファイルを使わず Web Audio で合成する。
   iPhone は最初のタッチ操作の中で AudioContext を起動する必要がある（unlock）。 */
(function () {
  'use strict';
  var WP = window.WP;
  var ctx = null, master = null, silentEl = null;

  // 連続ではめた時に音程を上げていく音階（ペンタトニック。どの順で鳴っても濁らない）
  var PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
  function noteFreq(semi) { return 523.25 * Math.pow(2, semi / 12); } // C5 を基準

  function silentWavUri() {
    // 0.1 秒の無音 WAV。再生しておくと、iPhone のサイレントスイッチ下でも Web Audio が鳴ることがある（要実機確認）
    var n = 800, bytes = new Uint8Array(44 + n);
    function w32(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; bytes[o + 2] = (v >> 16) & 255; bytes[o + 3] = (v >> 24) & 255; }
    function w16(o, v) { bytes[o] = v & 255; bytes[o + 1] = (v >> 8) & 255; }
    'RIFF'.split('').forEach(function (c, i) { bytes[i] = c.charCodeAt(0); });
    w32(4, 36 + n);
    'WAVEfmt '.split('').forEach(function (c, i) { bytes[8 + i] = c.charCodeAt(0); });
    w32(16, 16); w16(20, 1); w16(22, 1); w32(24, 8000); w32(28, 8000); w16(32, 1); w16(34, 8);
    'data'.split('').forEach(function (c, i) { bytes[36 + i] = c.charCodeAt(0); });
    w32(40, n);
    for (var i = 0; i < n; i++) bytes[44 + i] = 128;
    var s = ''; for (var j = 0; j < bytes.length; j++) s += String.fromCharCode(bytes[j]);
    return 'data:audio/wav;base64,' + btoa(s);
  }

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = WP.cfg.VOLUME;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function unlock() {
    var c = ensure();
    if (!c) return;
    try { if (c.state !== 'running' && c.resume) c.resume().catch(function () {}); } catch (e) {}
    try {
      var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
    if (WP.cfg.SILENT_AUDIO && !silentEl) {
      try { silentEl = new Audio(silentWavUri()); silentEl.loop = true; silentEl.volume = 0.01; var p = silentEl.play(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
  }

  // 1つの音: 周波数 f から f2 へスライドしながら、短く減衰する
  function tone(o) {
    if (WP.cfg.MUTE) return;
    var c = ensure(); if (!c) return;
    var t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.15;
    var osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t0);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t0 + dur * 0.8);
    var vol = (o.vol == null ? 0.4 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.03);
  }

  WP.audio = {
    unlock: unlock,
    state: function () { return ctx ? ctx.state : 'none'; },
    setVolume: function (v) { if (master) master.gain.value = v; },

    // はまった瞬間の「ポコッ」。combo が増えると音程が上がる
    fit: function (combo) {
      var f = noteFreq(PENTA[Math.min(Math.max(combo, 1) - 1, PENTA.length - 1)]);
      tone({ f: f * 1.7, f2: f, dur: 0.16, type: 'sine', vol: 0.55 });
      tone({ f: f * 0.5, f2: f * 0.45, dur: 0.09, type: 'triangle', vol: 0.3 });
    },
    // 合わない枠。鈍くない短い音
    wrong: function () { tone({ f: 330, f2: 210, dur: 0.14, type: 'triangle', vol: 0.3 }); },
    // 文字が1つ完成
    letter: function () {
      tone({ f: 880, dur: 0.12, type: 'sine', vol: 0.4, delay: 0.07 });
      tone({ f: 1318.5, dur: 0.18, type: 'sine', vol: 0.4, delay: 0.14 });
    },
    // 単語完成のジングル
    word: function () {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone({ f: f, dur: 0.22, type: 'triangle', vol: 0.4, delay: 0.1 + i * 0.09 });
        tone({ f: f * 2, dur: 0.16, type: 'sine', vol: 0.12, delay: 0.1 + i * 0.09 });
      });
    },
    coinLand: function () { tone({ f: 1760, f2: 1500, dur: 0.07, type: 'sine', vol: 0.18 }); },
    coin: function () {
      var r = 1 + (Math.random() - 0.5) * 0.08;
      tone({ f: 1568 * r, dur: 0.1, type: 'sine', vol: 0.3 });
      tone({ f: 2093 * r, dur: 0.2, type: 'sine', vol: 0.3, delay: 0.06 });
    }
  };
})();
