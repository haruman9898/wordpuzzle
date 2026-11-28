/* 効果音・BGM は音声ファイルを使わず Web Audio で合成する。
   iPhone は最初のタッチ操作の中で AudioContext を起動する必要がある（unlock）。 */
(function () {
  'use strict';
  var WP = window.WP;
  var ctx = null, master = null, revIn = null, noiseBuf = null, silentEl = null;
  var bgmGain = null, bgm = { on: false, timer: null, next: 0, step: 0 };

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
      master = ctx.createGain(); master.gain.value = WP.cfg.VOLUME; master.connect(ctx.destination);
      // 短いリバーブ（余韻）。減衰するノイズを残響の元にする
      var len = Math.floor(ctx.sampleRate * 1.1), imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = imp.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      var conv = ctx.createConvolver(); conv.buffer = imp;
      var wet = ctx.createGain(); wet.gain.value = 0.28;
      revIn = ctx.createGain(); revIn.connect(conv); conv.connect(wet); wet.connect(master);
      // ノイズ（打音のクリック用）
      noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.3), ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0); for (var k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
      bgmGain = ctx.createGain(); bgmGain.gain.value = 0; bgmGain.connect(master);
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

  // 1つの音: 周波数 f から f2 へスライドしながら、短く減衰する。rev = リバーブへ送る量
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
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(master);
    var rev = o.rev == null ? 0.35 : o.rev;
    if (rev > 0 && revIn) { var rg = c.createGain(); rg.gain.value = rev; g.connect(rg); rg.connect(revIn); }
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  // 打音のクリック（帯域を絞ったノイズの一瞬）
  function click(o) {
    if (WP.cfg.MUTE) return;
    var c = ensure(); if (!c || !noiseBuf) return;
    var t0 = c.currentTime + (o.delay || 0), dur = o.dur || 0.03;
    var src = c.createBufferSource(); src.buffer = noiseBuf;
    var bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = o.f || 2800; bp.Q.value = o.q || 1.2;
    var g = c.createGain();
    g.gain.setValueAtTime(o.vol || 0.2, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(bp); bp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function sparkle(n, delay, vol) {
    for (var i = 0; i < n; i++) tone({ f: 1800 + Math.random() * 1800, dur: 0.12, vol: vol || 0.07, delay: delay + i * 0.07 + Math.random() * 0.03, rev: 0.6 });
  }

  // ---- BGM: 静かな生成ループ（C - Am - F - G、ペンタトニックのアルペジオ） ----
  var CHORDS = [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]];       // C4 基準の半音
  var ARP = [0, 1, 2, 1, 2, 1, 0, 1];                                      // 和音の何番目の音を弾くか（8分音符）
  var STEP = 60 / 92 / 2;
  function bgmFreq(semi) { return 261.63 * Math.pow(2, semi / 12); }
  function bgmNote(semi, t, dur, vol, type) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'triangle'; o.frequency.value = bgmFreq(semi);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bgmGain);
    if (revIn) { var rg = ctx.createGain(); rg.gain.value = 0.5; g.connect(rg); rg.connect(revIn); }
    o.start(t); o.stop(t + dur + 0.05);
  }
  function bgmSchedule() {
    if (!ctx || !bgm.on) return;
    while (bgm.next < ctx.currentTime + 0.35) {
      var s = bgm.step, chord = CHORDS[Math.floor(s / 16) % 4], t = bgm.next;
      if (s % 16 === 0) chord.forEach(function (n) { bgmNote(n - 12, t, 2.6, 0.16, 'sine'); });         // 和音（低め・長め）
      var n = chord[ARP[s % 8]] + (s % 16 >= 8 ? 12 : 0);
      bgmNote(n + 12, t, 0.5, 0.22, 'triangle');                                                       // アルペジオ
      if (s % 8 === 4) bgmNote(n + 24, t + STEP * 0.5, 0.35, 0.08, 'sine');
      bgm.next += STEP; bgm.step = (s + 1) % 64;
    }
  }
  function bgmTarget() { return (bgm.on && !WP.cfg.MUTE && WP.cfg.BGM) ? 0.22 * WP.cfg.BGM_VOL : 0; }
  function bgmApply() {
    if (!ctx || !bgmGain) return;
    bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    bgmGain.gain.setTargetAtTime(bgmTarget(), ctx.currentTime, 0.25);
  }

  WP.audio = {
    unlock: unlock,
    state: function () { return ctx ? ctx.state : 'none'; },
    setVolume: function (v) { if (master) master.gain.value = v; },
    bgm: function (on) {
      var c = ensure(); if (!c) return;
      if (on && !bgm.on) { bgm.on = true; bgm.next = c.currentTime + 0.05; bgm.timer = setInterval(bgmSchedule, 90); }
      if (!on && bgm.on) { bgm.on = false; clearInterval(bgm.timer); bgm.timer = null; }
      bgmApply();
    },
    bgmRefresh: function () { bgmApply(); },

    // はまった瞬間の「ポコッ」。combo が増えると音程が上がる
    fit: function (combo) {
      var f = noteFreq(PENTA[Math.min(Math.max(combo, 1) - 1, PENTA.length - 1)]);
      tone({ f: f * 1.7, f2: f, dur: 0.17, type: 'sine', vol: 0.55 });
      tone({ f: f * 0.5, f2: f * 0.42, dur: 0.1, type: 'triangle', vol: 0.3, rev: 0 });
      click({ f: 3000, dur: 0.025, vol: 0.2 });
      if (combo >= 5) tone({ f: f * 2, dur: 0.2, type: 'sine', vol: 0.12, delay: 0.03, rev: 0.6 });
    },
    // 合わない枠。鈍くない短い音
    wrong: function () { tone({ f: 330, f2: 210, dur: 0.14, type: 'triangle', vol: 0.3, rev: 0.1 }); },
    // 文字が1つ完成
    letter: function () {
      tone({ f: 880, dur: 0.14, type: 'sine', vol: 0.4, delay: 0.07 });
      tone({ f: 1318.5, dur: 0.22, type: 'sine', vol: 0.4, delay: 0.14 });
      sparkle(2, 0.18, 0.06);
    },
    // 単語完成のジングル
    word: function () {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone({ f: f, dur: 0.24, type: 'triangle', vol: 0.4, delay: 0.1 + i * 0.09 });
        tone({ f: f * 2, dur: 0.18, type: 'sine', vol: 0.12, delay: 0.1 + i * 0.09 });
      });
      [783.99, 1046.5, 1318.5].forEach(function (f) { tone({ f: f, dur: 0.7, type: 'sine', vol: 0.18, delay: 0.55, attack: 0.02, rev: 0.5 }); });
      sparkle(5, 0.5, 0.07);
    },
    warn: function () { tone({ f: 880, dur: 0.12, type: 'square', vol: 0.12, rev: 0 }); },
    fail: function () { tone({ f: 392, f2: 262, dur: 0.4, type: 'triangle', vol: 0.3 }); tone({ f: 196, dur: 0.4, type: 'sine', vol: 0.15, delay: 0.1 }); },
    clear: function () {
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone({ f: f, dur: 0.3, type: 'triangle', vol: 0.4, delay: i * 0.11 }); });
      [783.99, 1046.5, 1318.5, 1568].forEach(function (f) { tone({ f: f, dur: 0.9, type: 'sine', vol: 0.2, delay: 0.5, attack: 0.02, rev: 0.55 }); });
      sparkle(6, 0.5, 0.07);
    },
    star: function (k) {
      var m = Math.pow(1.26, k - 1);
      tone({ f: 880 * m, dur: 0.24, type: 'sine', vol: 0.4 }); tone({ f: 1760 * m, dur: 0.18, type: 'sine', vol: 0.15, delay: 0.04, rev: 0.6 });
    },
    coinLand: function () { tone({ f: 1760, f2: 1500, dur: 0.07, type: 'sine', vol: 0.18, rev: 0.2 }); },
    coin: function () {
      var r = 1 + (Math.random() - 0.5) * 0.08;
      tone({ f: 1568 * r, dur: 0.1, type: 'sine', vol: 0.3 });
      tone({ f: 2093 * r, dur: 0.22, type: 'sine', vol: 0.3, delay: 0.06, rev: 0.5 });
    }
  };
})();
