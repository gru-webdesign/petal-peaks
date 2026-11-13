// Petal Peaks — all sound synthesised live with WebAudio (no audio files).
// Music: slow lo-fi chords (Fmaj7 Em7 Dm7 Cmaj7) with a soft pentatonic melody,
// vinyl-ish noise and occasional bird chirps. Every bloom plays notes from the same scale,
// so combos sound like a little melody.
// window.Audio2 = { unlock(), sfx: {...}, setMusic(on), setSound(on) }
(() => {
  "use strict";

  let ctx = null, master = null, musicBus = null, sfxBus = null, noiseBuf = null;
  let musicOn = true, soundOn = true, musicTimer = null, nextBar = 0, bar = 0;
  const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // C major pentatonic across a few octaves
  const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84, 86, 88];
  const CHORDS = [
    [53, 57, 60, 64], // Fmaj7
    [52, 55, 59, 62], // Em7
    [50, 53, 57, 60], // Dm7
    [48, 52, 55, 59], // Cmaj7
  ];
  const BPM = 72;
  const BEAT = 60 / BPM;

  function unlock() {
    if (ctx) { if (ctx.state === "suspended") ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    // gentle low-pass "warmth" on the music
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 2200; lp.connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = musicOn ? 0.32 : 0; musicBus.connect(lp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = soundOn ? 0.55 : 0; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextBar = ctx.currentTime + 0.2;
    musicTimer = setInterval(schedule, 200);
  }

  function tone(freq, t, dur, { type = "sine", vol = 0.2, attack = 0.01, bus = sfxBus, detune = 0, glide = 0 } = {}) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
    if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(t, dur, { vol = 0.1, freq = 1200, q = 0.7, type = "bandpass", bus = sfxBus } = {}) {
    if (!ctx) return;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.05, dur / 3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // soft electric-piano chord: two detuned sines + a bell partial
  function epiano(m, t, dur, vol, bus = musicBus) {
    tone(hz(m), t, dur, { vol, attack: 0.02, bus });
    tone(hz(m), t, dur * 0.8, { vol: vol * 0.5, attack: 0.02, bus, detune: 7 });
    tone(hz(m) * 4, t, 0.4, { vol: vol * 0.08, attack: 0.005, bus });
  }

  function bird(t) {
    const base = 2600 + Math.random() * 1400;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
      tone(base * (1 + Math.random() * 0.2), t + i * 0.11, 0.08, { vol: 0.05, attack: 0.005, bus: musicBus, glide: 1.4 });
    }
  }

  function schedule() {
    if (!ctx || !musicOn) { if (ctx) nextBar = Math.max(nextBar, ctx.currentTime + 0.1); return; }
    while (nextBar < ctx.currentTime + 1.2) {
      const t = nextBar, ch = CHORDS[bar % 4];
      // chord, softly strummed
      ch.forEach((m, i) => epiano(m, t + i * 0.03, BEAT * 3.6, 0.05));
      // bass on 1 and 3
      tone(hz(ch[0] - 12), t, BEAT * 1.8, { vol: 0.12, attack: 0.02, bus: musicBus });
      tone(hz(ch[0] - 12), t + BEAT * 2, BEAT * 1.6, { vol: 0.09, attack: 0.02, bus: musicBus });
      // lazy hats + kick (lo-fi)
      for (let b = 0; b < 8; b++) {
        noise(t + b * BEAT / 2 + (b % 2 ? 0.03 : 0), 0.05, { vol: b % 2 ? 0.012 : 0.02, freq: 8000, q: 1, bus: musicBus });
      }
      tone(110, t, 0.25, { vol: 0.12, bus: musicBus, glide: 0.4 });
      tone(110, t + BEAT * 2.5, 0.25, { vol: 0.08, bus: musicBus, glide: 0.4 });
      noise(t + BEAT, 0.12, { vol: 0.03, freq: 1800, q: 0.6, bus: musicBus });
      noise(t + BEAT * 3, 0.12, { vol: 0.03, freq: 1800, q: 0.6, bus: musicBus });
      // melody: a few pentatonic notes that fit the chord
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) {
        const m = PENTA[5 + Math.floor(Math.random() * 6)];
        const at = t + BEAT * (Math.floor(Math.random() * 8) / 2);
        tone(hz(m), at, BEAT * 1.2, { type: "triangle", vol: 0.035, attack: 0.02, bus: musicBus });
      }
      if (Math.random() < 0.35) bird(t + Math.random() * BEAT * 3);
      nextBar += BEAT * 4;
      bar++;
    }
  }

  let bloomStep = 0, bloomReset = 0;
  const sfx = {
    tap() { if (!ctx) return; tone(880, ctx.currentTime, 0.06, { type: "triangle", vol: 0.08 }); },
    pick() { if (!ctx) return; tone(520, ctx.currentTime, 0.08, { type: "triangle", vol: 0.1, glide: 1.5 }); },
    place() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(t, 0.09, { vol: 0.12, freq: 500, q: 0.8 });           // soil thud
      tone(196, t, 0.12, { vol: 0.12, glide: 0.7 });
    },
    bad() { if (!ctx) return; tone(160, ctx.currentTime, 0.15, { type: "triangle", vol: 0.1, glide: 0.8 }); },
    // one call per cleared cell; notes climb the pentatonic scale
    bloom(i) {
      if (!ctx) return;
      const now = ctx.currentTime;
      if (now > bloomReset) bloomStep = 0;
      bloomReset = now + 0.6;
      const m = PENTA[Math.min(PENTA.length - 1, 3 + (bloomStep++ % 10))];
      const t = now + i * 0.035;
      tone(hz(m), t, 0.5, { vol: 0.07, attack: 0.005 });
      tone(hz(m) * 2, t, 0.25, { vol: 0.025, attack: 0.005 });
    },
    combo(k) {
      if (!ctx) return;
      const t = ctx.currentTime + 0.1;
      [72, 76, 79, 84, 88].slice(0, 2 + k).forEach((m, i) => tone(hz(m), t + i * 0.08, 0.5, { type: "triangle", vol: 0.08 }));
    },
    rain() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(t, 2.5, { vol: 0.06, freq: 3000, q: 0.3 });
      for (let i = 0; i < 18; i++) tone(1800 + Math.random() * 1600, t + Math.random() * 2, 0.05, { vol: 0.03, glide: 0.6 });
    },
    bee() { if (!ctx) return; const t = ctx.currentTime; tone(220, t, 0.5, { type: "sawtooth", vol: 0.015, glide: 1.1 }); },
    win() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(hz(m), t + i * 0.09, 0.7, { type: "triangle", vol: 0.09 }));
    },
    lose() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [67, 64, 60, 55].forEach((m, i) => tone(hz(m), t + i * 0.16, 0.6, { type: "triangle", vol: 0.08 }));
    },
    star(i) { if (!ctx) return; tone(hz(79 + i * 5), ctx.currentTime, 0.4, { type: "triangle", vol: 0.1 }); },
    breathe(inhale) {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(t, 1.4, { vol: 0.05, freq: inhale ? 900 : 600, q: 0.4, type: "bandpass" });
    },
    compost() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.2, { vol: 0.1, freq: 400 }); tone(150, t, 0.2, { vol: 0.08, glide: 0.6 }); },
    chime() { if (!ctx) return; const t = ctx.currentTime; [84, 88, 91].forEach((m, i) => tone(hz(m), t + i * 0.06, 0.6, { vol: 0.05 })); },
  };

  function setMusic(on) {
    musicOn = on;
    if (musicBus) musicBus.gain.setTargetAtTime(on ? 0.32 : 0, ctx.currentTime, 0.2);
  }
  function setSound(on) {
    soundOn = on;
    if (sfxBus) sfxBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05);
  }
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend(); else ctx.resume();
  });

  window.Audio2 = { unlock, sfx, setMusic, setSound };
})();
