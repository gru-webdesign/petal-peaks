// Hike & Bloom — a cozy block puzzle on an endless mountain trail.
// Place pieces on a 9×9 garden bed; full rows, columns and 3×3 squares bloom.
(() => {
  "use strict";

  const L = window.Levels, I18N = window.I18N, A = window.Audio2;
  const W = 252;
  let H = 448;
  const CELL = 27, MINI = 14, BOARD = CELL * 9;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let K = 1; // backing pixels per logical pixel

  // ---------------------------------------------------------------- assets
  const IMG = {};
  const names = ["panel", "btn_green", "btn_wood", "btn_pink", "btn_gold", "btn_stone", "star_big", "star_big_off", "flag", "btn_green_down", "btn_brown", "btn_plate", "btn_red", "btn_round", "ui_sign", "ui_sign_small", "ui_bar_empty", "ui_bar_full", "ui_close", "hero_front", "hero_yoga", "hero_walk_0", "hero_walk_1", "hero_walk_2", "hero_walk_3", "hero_breathe_0", "hero_breathe_1", "hero_jump", "hero_tired",
    "camp_tent", "camp_van", "camp_hammock", "camp_fire", "camp_lights", "camp_mat", "camp_mugs", "camp_sign",
    "stone", "stone_cracked", "weed_0", "weed_1", "plastic", "mushroom",
    "bee_0", "bee_1", "sign_open", "sign_current", "sign_done", "sign_locked"];
  for (const i of ["pause", "play", "sound", "mute", "music", "gear", "home", "retry", "map", "close", "breath", "compost", "rain", "lock", "star", "star_off", "leaf", "check", "flower", "moves", "lang", "seed", "gift", "tasks", "shop"]) names.push("i_" + i);
  for (const c of ["orange", "blue", "pink"]) for (let f = 0; f < 2; f++) names.push(`fly_${c}_${f}`);
  for (const sp of L.SPECIES) { for (let s = 0; s < 3; s++) names.push(`p_${sp}_${s}`); names.push(`m_${sp}_1`); }
  for (const b of L.BIOMES) if (b.key !== "volcano") names.push("bg_" + b.key);
  let loaded = 0;
  const ready = new Promise((res) => {
    for (const n of names) {
      const im = new Image();
      im.onload = im.onerror = () => { if (++loaded === names.length) res(); };
      im.src = `assets/${n}.png`;
      IMG[n] = im;
    }
  });

  // petal colours per species (for particles)
  const PETAL = {
    lavender: ["#8a6fc4", "#b39ce3", "#644a99"], poppy: ["#d24b44", "#ef7c5f", "#1E3A2B"],
    daisy: ["#fffaf0", "#f4ecd9", "#f5d14f"], sunflower: ["#f5d14f", "#e2a92f", "#935f40"],
    cornflower: ["#4f86c9", "#7db2e6", "#365fa3"], edelweiss: ["#fffaf0", "#e2d5bd", "#9cb565"],
    cosmos: ["#f19cbd", "#d86b9a", "#f5d14f"], marigold: ["#f6ab55", "#e5812e", "#bf5a1d"],
  };
  const COL = {
    ink: "#1f1622", ink2: "#2e2030", cream: "#fffaf0", paper: "#f4ecd9", paper2: "#e2d5bd", gold: "#f5d14f", gold2: "#e2a92f",
    green: "#93c45a", green2: "#4a8442", red: "#ef7c5f", pink: "#f19cbd", sky: "#bde0f8", brown: "#673d27", lav: "#b39ce3", teal: "#78c9a8",
  };

  // ---------------------------------------------------------------- save
  const SAVE_KEY = "petal-peaks-v1";
  const save = Object.assign({ lang: null, unlocked: 1, stars: {}, zenBest: 0, music: true, sound: true, vib: true, tutDone: false,
    seeds: 0, tasksDay: "", tasks: [], bonusDay: "", bonusStreak: 0, rainB: 1, breathB: 0, style: "3d" }, (() => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  })());
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  const t = (k) => (I18N[save.lang || "en"][k] ?? k);
  const vib = (ms) => { if (save.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };

  // ---------------------------------------------------------------- seeds, daily tasks, daily bonus
  const TASKS = [
    { id: "bloom", need: [40, 60, 80], rew: 30 }, { id: "lines", need: [10, 15, 20], rew: 25 }, { id: "combo", need: [2, 3, 4], rew: 30 },
    { id: "levels", need: [2, 3], rew: 40 }, { id: "stars3", need: [1, 2], rew: 40 }, { id: "zen", need: [500, 800, 1200], rew: 30 },
    { id: "rain", need: [1, 2], rew: 25 }, { id: "compost", need: [3, 4], rew: 15 },
  ];
  const BONUS = [20, 30, 40, 50, 60, 80, 150];
  const PRICE = { rain: 40, breath: 30, moves: 50 };
  const dayStr = (d = new Date()) => d.toLocaleDateString("sv");
  const yesterday = () => dayStr(new Date(Date.now() - 86400000));
  function ensureDay() {
    const d = dayStr();
    if (save.tasksDay === d && save.tasks.length) return;
    let h = 0;
    for (const ch of d) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const r = L.rng(h), pool = TASKS.slice(), out = [];
    for (let i = 0; i < 3; i++) {
      const k = pool.splice(Math.floor(r() * pool.length), 1)[0];
      out.push({ id: k.id, need: k.need[Math.floor(r() * k.need.length)], rew: k.rew, prog: 0, claimed: false });
    }
    save.tasks = out; save.tasksDay = d; persist();
  }
  function task(id, n = 1) {
    if (st.demo) return;
    ensureDay();
    for (const k of save.tasks) if (k.id === id && k.prog < k.need) {
      k.prog = Math.min(k.need, k.prog + n);
      if (k.prog >= k.need) { toast(t("taskDone")); A.sfx.chime(); }
    }
    persist();
  }
  const tasksReady = () => { ensureDay(); return save.tasks.some((k) => k.prog >= k.need && !k.claimed); };
  const bonusReady = () => save.bonusDay !== dayStr();
  function bonusIndex() {            // which of the 7 days is next (or was claimed today)
    if (!bonusReady()) return (save.bonusStreak - 1) % 7;
    return save.bonusDay === yesterday() ? save.bonusStreak % 7 : 0;
  }
  function claimBonus() {
    if (!bonusReady()) return;
    const i = bonusIndex();
    save.bonusStreak = i + 1; save.bonusDay = dayStr();
    addSeeds(BONUS[i], W / 2, H / 2);
    if (i === 6) save.rainB++;
    persist(); A.sfx.win();
  }
  function addSeeds(n, x, y) {
    save.seeds += n; persist();
    if (x !== undefined) { float(x, y, "+" + n, COL.gold, 12); sparks(x, y, 14); }
  }
  function spend(n) {
    if (save.seeds < n) { toast(t("noSeeds")); A.sfx.bad(); return false; }
    save.seeds -= n; persist(); A.sfx.chime(); return true;
  }

  // ---------------------------------------------------------------- state
  const st = {
    mode: "lang", time: 0, idle: 0, buttons: [],
    page: 0, help: null, settings: false, paused: false, resetArm: 0,
    flies: [], parts: [], floats: [], fx: [], bees: [], drops: [], shake: 0,
    toast: null, demo: false, modal: null, campCache: {},
  };
  let G = null; // current game

  // ---------------------------------------------------------------- layout
  let TOP = 4, BX = 10, BY = 60, TY = 300, BB = 380;
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    H = Math.max(456, Math.min(640, Math.round(W * vh / vw)));
    const s = Math.min(vw / W, vh / H);
    const dpr = window.devicePixelRatio || 1;
    K = s * dpr; // fill the whole screen; sprites are drawn on whole logical pixels
    canvas.width = Math.round(W * K);
    canvas.height = Math.round(H * K);
    canvas.style.width = (canvas.width / dpr) + "px";
    canvas.style.height = (canvas.height / dpr) + "px";
    const safe = document.getElementById("safe-top");
    TOP = Math.max(4, Math.round((safe ? safe.getBoundingClientRect().height : 0) / s) + 4);
    const need = TOP + 52 + BOARD + 8 + 78 + 34;
    const extra = Math.max(0, H - need);
    BX = (W - BOARD) / 2;
    BY = TOP + 80 + Math.round(Math.max(0, extra - 28) * 0.45);
    TY = BY + BOARD + 6 + Math.round(extra * 0.2);
    BB = TY + 78;
  }
  window.addEventListener("resize", fit);

  // ---------------------------------------------------------------- drawing helpers
  const SOFT = () => true;
  function setFont(size) {
    ctx.font = SOFT() ? `600 ${Math.round(size * 1.12 * 2) / 2}px "Fredoka", sans-serif` : `400 ${Math.round(size * 1.45)}px "Jersey 10", monospace`;
  }
  function text(str, x, y, size = 8, color = COL.cream, align = "center", outline = COL.ink, base = "middle") {
    setFont(size);
    ctx.textAlign = align; ctx.textBaseline = base;
    if (outline && SOFT()) {
      ctx.strokeStyle = outline; ctx.lineJoin = "round"; ctx.lineWidth = Math.max(1.6, size / 4.5);
      ctx.strokeText(str, x, y + 0.5);
    } else if (outline) {
      ctx.fillStyle = outline;
      const o = Math.max(1, Math.round(size / 9)) * 0.75;
      for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, o], [-o, o], [o, -o], [0, o * 1.6]]) ctx.fillText(str, x + dx, y + dy);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }
  function wrap(str, maxW, size) {
    setFont(size);
    const words = String(str).split(" "), lines = [];
    let cur = "";
    for (const w of words) {
      const test = cur ? cur + " " + w : w;
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  const HI = /^(p_|m_|stone|weed|plastic|mushroom|camp_)/;
  // tiles are 64x64 with a 54-wide grass patch standing on the bottom edge; flowers rise above the cell
  function tile(name, x, y, size = CELL) {
    const k = size / 54;
    img(name, x - 5 * k, y - 9.5 * k, 64 * k, 64 * k);
  } // authored at 2x for extra detail
  function img(name, x, y, w, h) {
    if (name.startsWith("i_")) { drawIcon(name.slice(2), x, y + 1, w || 13); return; }
    if (name === "star_big" || name === "star_big_off") { star3(x + 16, y + 15, 15, name === "star_big"); return; }
    if (name.startsWith("m_")) { plantIcon(name.slice(2, -2), x, y, w || 16, h || 16); return; }
    if (SOFT() && soft3dImg(name, x, y, w, h)) return;
    const im = IMG[name];
    if (!im || !im.complete || !im.naturalWidth) return;
    if (!w) { const k = HI.test(name) ? 2 : 1; w = im.naturalWidth / k; h = im.naturalHeight / k; }
    ctx.drawImage(im, Math.round(x), Math.round(y), w, h);
  }
  // 9-slice: border b px of the source
  // 9-slice for rectangular sources. b = border, or [bx, by]. Wooden buttons stretch (their centres are flat colour),
  // panels and signs tile so wood grain and paper keep their pixel size.
  const NINE = { btn_green: [9, 9], btn_green_down: [8, 8], btn_gold: [8, 8], btn_brown: [7, 7], btn_pink: [8, 8], btn_red: [8, 8],
    btn_stone: [8, 8], btn_wood: [7, 7], btn_round: [10, 10], btn_plate: [6, 6], panel: [13, 13], ui_sign: [16, 18], ui_sign_small: [14, 14],
    ui_bar_empty: [6, 5], ui_bar_full: [6, 5] };
  function nine(name, x, y, w, h) {
    if (SOFT()) { nine3(name, x, y, w, h); return; }
    if (name === "panel") { x -= 7; y -= 7; w += 14; h += 14; }
    if (name === "panel_hud") name = "panel";
    const im = IMG[name];
    if (!im || !im.naturalWidth) return;
    const Sx = im.naturalWidth, Sy = im.naturalHeight;
    let [bx, by] = NINE[name] || [8, 8];
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    bx = Math.min(bx, Math.floor(w / 2)); by = Math.min(by, Math.floor(h / 2));
    const mx = Sx - 2 * bx, my = Sy - 2 * by, iw = w - 2 * bx, ih = h - 2 * by;
    const stretch = name.startsWith("btn_");
    const part = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      if (dw <= 0 || dh <= 0 || sw <= 0 || sh <= 0) return;
      if (stretch) { ctx.drawImage(im, sx, sy, sw, sh, dx, dy, dw, dh); return; }
      for (let yy = 0; yy < dh; yy += sh) for (let xx = 0; xx < dw; xx += sw) {
        const cw = Math.min(sw, dw - xx), chh = Math.min(sh, dh - yy);
        ctx.drawImage(im, sx, sy, cw, chh, dx + xx, dy + yy, cw, chh);
      }
    };
    part(0, 0, bx, by, x, y, bx, by);
    part(Sx - bx, 0, bx, by, x + w - bx, y, bx, by);
    part(0, Sy - by, bx, by, x, y + h - by, bx, by);
    part(Sx - bx, Sy - by, bx, by, x + w - bx, y + h - by, bx, by);
    part(bx, 0, mx, by, x + bx, y, iw, by);
    part(bx, Sy - by, mx, by, x + bx, y + h - by, iw, by);
    part(0, by, bx, my, x, y + by, bx, ih);
    part(Sx - bx, by, bx, my, x + w - bx, y + by, bx, ih);
    part(bx, by, mx, my, x + bx, y + by, iw, ih);
  }
  function imgH(name, x, y, h) {           // draw scaled to a given height
    if (SOFT() && HERO3[name]) { const im = P3(HERO3[name]); if (im) ctx.drawImage(im, x, y, im.naturalWidth / im.naturalHeight * h, h); return; }
    const im = IMG[name];
    if (!im || !im.naturalWidth) return;
    ctx.drawImage(im, Math.round(x), Math.round(y), Math.round(im.naturalWidth / im.naturalHeight * h), h);
  }
  const RECT3 = { "rgba(194,177,153,0.4)": "#FFFFFF", "rgba(194,177,153,0.45)": "#FFFFFF", "rgba(147,196,90,0.5)": "#DCEBCF", "rgba(147,196,90,0.45)": "#DCEBCF",
    "#bf5a1d": "#3E8F2C", "#c2b199": "#C5D3B4" };
  function rect(x, y, w, h, c) {
    if (SOFT()) {
      c = RECT3[c] || c;
      if (w >= 10 && h >= 10 && w < W) { fillRR(x, y, w, h, Math.min(9, h / 3), c); return; }
      if (w < 10 && h < 10 && RECT3.__dots !== 0) { fillRR(x, y, w, h, Math.min(w, h) / 2, c); return; }
      ctx.fillStyle = c; ctx.fillRect(x, y, w, h); return;
    }
    ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function button(x, y, w, h, label, on, opt = {}) {
    if (SOFT()) { button3(x, y, w, h, label, on, opt); return; }
    const skin = opt.skin || "btn_green";
    const pressed = st.press && st.press.x >= x && st.press.x <= x + w && st.press.y >= y && st.press.y <= y + h;
    nine(pressed && skin === "btn_green" ? "btn_green_down" : skin, x, y + (pressed ? 2 : 0), w, h - (pressed ? 2 : 0));
    if (opt.icon) {
      const iw = 13;
      if (label) {
        setFont(opt.size || 8);
        const tw = ctx.measureText(label).width;
        const sx = x + w / 2 - (tw + iw + 3) / 2;
        img(opt.icon, sx, y + h / 2 - 8 + (pressed ? 2 : 0));
        text(label, sx + iw + 3 + tw / 2, y + h / 2 - 1 + (pressed ? 2 : 0), opt.size || 8, opt.color || COL.cream);
      } else img(opt.icon, x + w / 2 - 6.5, y + h / 2 - 8 + (pressed ? 2 : 0));
    } else if (label) text(label, x + w / 2, y + h / 2 - 1 + (pressed ? 2 : 0), opt.size || 8, opt.color || COL.cream);
    st.buttons.push({ x, y, w, h, on, hold: opt.hold });
  }
  function iconButton(x, y, icon, on, skin = "btn_wood") {
    if (SOFT()) { button3(x, y, 22, 22, "", on, { icon, skin: icon === "i_close" ? "btn_pink" : skin }); return; }
    if (icon === "i_close") { img("ui_close", x + 1, y + 1, 18, 18); st.buttons.push({ x, y, w: 20, h: 20, on }); return; }
    button(x, y, 20, 20, "", on, { icon, skin });
  }

  // ---------------------------------------------------------------- background + ambience
  function drawBg(key, plain) {
    if (SOFT()) { playBg(st.mode === "play" && G && !G.zen ? G.n : 0); return; }
    // illustration is 252x552; cover the screen, anchored to the top (the dark foreground sits under the tray)
    const k = Math.max(1, H / 552);
    img("bg_" + key, (W - W * k) / 2, 0, W * k, 552 * k);
    if (plain) return;
    // drifting butterflies
    for (const f of st.flies) {
      const fr = Math.floor(st.time * 6 + f.ph) % 2;
      img(`fly_${f.c}_${fr}`, f.x, f.y + Math.sin(st.time * 2 + f.ph) * 4);
    }
  }
  function updateFlies(dt) {
    while (st.flies.length < 3) st.flies.push({ x: -12 - Math.random() * 60, y: 40 + Math.random() * (H - 120), vx: 8 + Math.random() * 10, ph: Math.random() * 10, c: ["orange", "blue", "pink"][Math.floor(Math.random() * 3)] });
    for (const f of st.flies) { f.x += f.vx * dt; f.y += Math.sin(st.time * 0.7 + f.ph) * 6 * dt; }
    st.flies = st.flies.filter((f) => f.x < W + 20);
  }

  // ---------------------------------------------------------------- particles
  function petals(cx, cy, sp, n = 6) {
    const cols = PETAL[sp] || PETAL.daisy;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 20 + Math.random() * 50;
      st.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, g: 70, life: 0.9 + Math.random() * 0.8, t: 0, c: cols[i % cols.length], s: Math.random() < 0.5 ? 2 : 3, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
    }
  }
  function sparks(cx, cy, n = 8, c = COL.gold) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 15 + Math.random() * 40;
      st.parts.push({ x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0, life: 0.5 + Math.random() * 0.4, t: 0, c, s: 1, spark: true });
    }
  }
  function float(x, y, str, color = COL.gold, size = 9) { st.floats.push({ x, y, str, color, size, t: 0 }); }
  function toast(str, dur = 2.2) { st.toast = { str, t: 0, dur }; }
  function updateParts(dt) {
    for (const p of st.parts) { p.t += dt; p.vy += p.g * dt; p.vx *= 0.98; p.x += p.vx * dt; p.y += p.vy * dt; if (p.rot !== undefined) p.rot += p.vr * dt; }
    st.parts = st.parts.filter((p) => p.t < p.life);
    for (const f of st.floats) { f.t += dt; f.y -= 18 * dt; }
    st.floats = st.floats.filter((f) => f.t < 1.3);
    for (const f of st.fx) f.t += dt;
    st.fx = st.fx.filter((f) => f.t < 0.55);
    if (st.toast) { st.toast.t += dt; if (st.toast.t > st.toast.dur) st.toast = null; }
    st.shake = Math.max(0, st.shake - dt * 8);
  }
  function drawParts() {
    for (const p of st.parts) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, a * 1.5);
      ctx.fillStyle = p.c;
      if (SOFT()) {
        ctx.beginPath();
        if (p.spark) ctx.arc(p.x, p.y, a > 0.5 ? 1.1 : 0.7, 0, 7);
        else ctx.ellipse(p.x, p.y, Math.abs(Math.cos(p.rot)) * p.s * 0.6 + 0.5, p.s * 0.45, p.rot, 0, 7);
        ctx.fill();
      } else if (p.spark) { const s = a > 0.5 ? 2 : 1; ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
      else {
        const w = Math.abs(Math.cos(p.rot)) * p.s + 1;
        ctx.fillRect(Math.round(p.x - w / 2), Math.round(p.y), Math.round(w), p.s - 1 || 1);
      }
    }
    ctx.globalAlpha = 1;
    for (const f of st.floats) {
      ctx.globalAlpha = Math.min(1, (1.3 - f.t) * 2);
      text(f.str, f.x, f.y, f.size, f.color);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- game setup
  const idx = (x, y) => y * 9 + x;
  function stageOf(c) { return c.age >= 7 ? 2 : c.age >= 3 ? 1 : 0; }

  function newGame(levelN, opts = {}) {
    const zen = !!opts.zen;
    const lv = zen ? { n: 0, biome: 0, moves: Infinity, goals: [], obstacles: [], weedEvery: 0, species: L.BIOMES[0].species.slice(), zen: true }
      : L.make(levelN);
    if (opts.demo) { lv.species = L.BIOMES[0].species.slice(); }
    G = {
      lv, zen, n: levelN, board: new Array(81).fill(null), tray: [null, null, null],
      score: 0, moves: lv.moves, prog: lv.goals.map(() => 0), streak: 0, combo: 0,
      breathUsed: false, compost: 3, history: null, placed: 0, over: null, overT: 0, rng: L.rng((levelN || 1) * 31 + (zen ? Date.now() : 0)),
      drag: null, tut: lv.tutorial && !save.tutDone ? 0 : -1, tutT: 0, winT: 0, bonusLeft: 0, stars: 0, breath: null, demoT: 0,
      bornAt: new Array(81).fill(-10), pulse: 0,
    };
    for (const o of lv.obstacles) if (o.x !== undefined) G.board[idx(o.x, o.y)] = { k: o.k === "stone" && levelN > 30 && G.rng() < 0.3 ? "stone2" : o.k };
    deal();
    st.mode = "play";
    st.paused = false;
    st.parts = []; st.floats = []; st.fx = []; st.bees = []; st.drops = [];
  }

  function randomPiece() {
    const tot = L.PIECES.reduce((s, p) => s + p.w, 0);
    let r = G.rng() * tot;
    let p = L.PIECES[0];
    for (const q of L.PIECES) { r -= q.w; if (r <= 0) { p = q; break; } }
    let sp = G.lv.species[Math.floor(G.rng() * G.lv.species.length)];
    // nudge toward species the goals still need, so goals feel reachable
    const want = G.lv.goals.filter((g, i) => g.type === "bloom" && G.prog[i] < g.need).map((g) => g.sp);
    if (want.length && G.rng() < 0.3) sp = want[Math.floor(G.rng() * want.length)];
    return { p, sp };
  }
  function fitsAnywhere(piece, board = G.board) {
    for (let y = 0; y <= 9 - piece.p.ht; y++) for (let x = 0; x <= 9 - piece.p.wd; x++) if (canPlace(piece, x, y, board)) return true;
    return false;
  }
  function deal() {
    for (let i = 0; i < 3; i++) {
      let pc = randomPiece();
      // early in a level, prefer pieces that fit (gentle, not guaranteed)
      for (let k = 0; k < 6 && !fitsAnywhere(pc); k++) pc = randomPiece();
      G.tray[i] = pc;
    }
  }
  function canPlace(piece, x, y, board = G.board) {
    for (const [cx, cy] of piece.p.cells) {
      const X = x + cx, Y = y + cy;
      if (X < 0 || Y < 0 || X > 8 || Y > 8 || board[idx(X, Y)]) return false;
    }
    return true;
  }
  // which cells would clear if the board looked like `b`
  function findClears(b) {
    const out = new Set();
    let lines = 0;
    for (let y = 0; y < 9; y++) { let f = true; for (let x = 0; x < 9; x++) if (!b[idx(x, y)]) { f = false; break; } if (f) { lines++; for (let x = 0; x < 9; x++) out.add(idx(x, y)); } }
    for (let x = 0; x < 9; x++) { let f = true; for (let y = 0; y < 9; y++) if (!b[idx(x, y)]) { f = false; break; } if (f) { lines++; for (let y = 0; y < 9; y++) out.add(idx(x, y)); } }
    for (let by = 0; by < 3; by++) for (let bx = 0; bx < 3; bx++) {
      let f = true;
      for (let y = 0; y < 3 && f; y++) for (let x = 0; x < 3; x++) if (!b[idx(bx * 3 + x, by * 3 + y)]) { f = false; break; }
      if (f) { lines++; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) out.add(idx(bx * 3 + x, by * 3 + y)); }
    }
    return { cells: out, lines };
  }
  function snapshot() {
    return JSON.stringify({ board: G.board, tray: G.tray.map((p) => p && { i: L.PIECES.indexOf(p.p), sp: p.sp }), score: G.score, moves: G.moves, prog: G.prog, streak: G.streak, compost: G.compost, placed: G.placed });
  }
  function restore(s) {
    const o = JSON.parse(s);
    G.board = o.board; G.tray = o.tray.map((p) => p && { p: L.PIECES[p.i], sp: p.sp });
    G.score = o.score; G.moves = o.moves === null ? Infinity : o.moves; G.prog = o.prog; G.streak = o.streak; G.compost = o.compost; G.placed = o.placed;
  }

  const cellX = (x) => BX + x * CELL;
  const cellY = (y) => BY + y * CELL;

  function place(slot, x, y) {
    const pc = G.tray[slot];
    G.history = snapshot();
    for (const [cx, cy] of pc.p.cells) {
      G.board[idx(x + cx, y + cy)] = { k: "plant", sp: pc.sp, age: 0 };
      G.bornAt[idx(x + cx, y + cy)] = st.time + (cx + cy) * 0.03;
    }
    G.tray[slot] = null;
    G.placed++;
    if (G.moves !== Infinity) G.moves--;
    A.sfx.place(); vib(8);
    // everything else grows a little
    for (let i = 0; i < 81; i++) {
      const c = G.board[i];
      if (c && c.k === "plant" && !(G.bornAt[i] > st.time - 0.01)) c.age++;
    }
    G.score += pc.p.cells.length;
    syncScoreGoals();
    resolve();
    // weeds spread
    if (G.lv.weedEvery && G.placed % G.lv.weedEvery === 0) spreadWeeds();
    if (G.tray.every((p) => !p)) deal();
    if (G.tut === 0) { G.tut = 1; G.tutT = 0; }
    checkEnd();
  }

  function resolve() {
    const { cells, lines } = findClears(G.board);
    if (!lines) { G.streak = 0; return; }
    G.streak++;
    let pts = 0, i = 0;
    const order = [...cells].sort((a, b) => (a % 9 + Math.floor(a / 9)) - (b % 9 + Math.floor(b / 9)));
    for (const k of order) {
      const c = G.board[k];
      const x = k % 9, y = Math.floor(k / 9);
      const px = cellX(x) + 13, py = cellY(y) + 13;
      if (c.k === "plant") {
        const sg = stageOf(c);
        pts += [10, 20, 35][sg];
        G.lv.goals.forEach((g, gi) => { if (g.type === "bloom" && g.sp === c.sp) G.prog[gi]++; });
        st.fx.push({ x: cellX(x), y: cellY(y), sp: c.sp, stage: Math.max(1, sg), t: -i * 0.025 });
        setTimeout(() => petals(px, py, c.sp, 4 + sg * 2), i * 25 + 180);
      } else {
        pts += 15;
        const type = c.k === "stone2" ? "stone" : c.k;
        if (c.k === "stone2") { G.board[k] = { k: "stone" }; sparks(px, py, 6, "#cdd1d8"); A.sfx.bloom(i); i++; continue; }
        G.lv.goals.forEach((g, gi) => { if (g.type === type) G.prog[gi]++; });
        if (c.k === "mush") { if (G.moves !== Infinity) G.moves += 2; float(px, py - 6, t("mushroom"), COL.pink, 8); }
        sparks(px, py, 8, c.k === "weed" ? "#9cb565" : c.k === "plastic" ? "#78c9a8" : "#cdd1d8");
      }
      A.sfx.bloom(i);
      G.board[k] = null;
      i++;
    }
    task("bloom", [...cells].length);
    task("lines", lines);
    if (lines > 1) task("combo");
    const mult = lines + (lines > 1 ? lines - 1 : 0);
    const gained = pts * mult + (G.streak > 1 ? 10 * G.streak : 0);
    G.score += gained;
    if (G.zen) task("zen", gained);
    syncScoreGoals();
    // centre of the cleared cells for the score popup
    let sx = 0, sy = 0;
    for (const k of cells) { sx += cellX(k % 9) + 12; sy += cellY(Math.floor(k / 9)) + 12; }
    sx /= cells.size; sy /= cells.size;
    float(sx, sy, "+" + gained, COL.gold, lines > 1 ? 12 : 10);
    if (lines > 1) { float(sx, sy - 14, `${t("combo")} ×${mult}`, COL.pink, 10); A.sfx.combo(Math.min(3, lines)); st.shake = Math.min(1, 0.3 * lines); vib([10, 30, 10]); }
    else vib(15);
    // bees come to pollinate
    const nb = Math.min(3, lines);
    for (let b = 0; b < nb; b++) spawnBee(sx, sy);
    if (nb) A.sfx.bee();
    // rain on every third bloom in a row
    if (G.streak > 0 && G.streak % 3 === 0) rain();
    if (G.tut === 1) { G.tut = 2; G.tutT = 0; }
  }

  function spawnBee(sx, sy) {
    const plants = [];
    for (let i = 0; i < 81; i++) if (G.board[i] && G.board[i].k === "plant" && stageOf(G.board[i]) < 2) plants.push(i);
    const target = plants.length ? plants[Math.floor(Math.random() * plants.length)] : -1;
    st.bees.push({ x: sx, y: sy, target, t: 0, dur: 0.9 + Math.random() * 0.5, ph: Math.random() * 6, done: false, leave: false });
  }
  function rain() {
    A.sfx.rain();
    task("rain");
    st.drops = [];
    for (let i = 0; i < 70; i++) st.drops.push({ x: Math.random() * (W + 40) - 20, y: -Math.random() * H, v: 180 + Math.random() * 90, t: 0 });
    st.rainT = 2.4;
    for (const c of G.board) if (c && c.k === "plant") c.age = c.age >= 3 ? Math.max(c.age, 7) : 3;
    toast(`${t("rain")} ${t("rainSub")}`);
  }
  function spreadWeeds() {
    const weeds = [];
    for (let i = 0; i < 81; i++) if (G.board[i] && G.board[i].k === "weed") weeds.push(i);
    if (!weeds.length || weeds.length > 14) return;
    const w = weeds[Math.floor(G.rng() * weeds.length)];
    const x = w % 9, y = Math.floor(w / 9);
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]).filter(([a, b]) => a >= 0 && b >= 0 && a < 9 && b < 9 && !G.board[idx(a, b)]);
    if (!opts.length) return;
    const [a, b] = opts[Math.floor(G.rng() * opts.length)];
    G.board[idx(a, b)] = { k: "weed" };
    G.bornAt[idx(a, b)] = st.time;
    sparks(cellX(a) + 12, cellY(b) + 12, 5, "#577240");
  }

  function syncScoreGoals() { G.lv.goals.forEach((g, i) => { if (g.type === "score") G.prog[i] = G.score; }); }
  function goalsDone() { return G.lv.goals.length > 0 && G.lv.goals.every((g, i) => G.prog[i] >= g.need); }
  function checkEnd() {
    if (G.zen) {
      if (!G.tray.some((p) => p && fitsAnywhere(p))) { G.over = "zen"; G.overT = 0; endZen(); }
      return;
    }
    if (goalsDone()) { G.over = "win"; G.overT = 0; G.bonusLeft = G.moves; A.sfx.win(); vib([20, 40, 20]); return; }
    if (G.moves <= 0) { G.over = "moves"; G.overT = 0; A.sfx.lose(); return; }
    if (!G.tray.some((p) => p && fitsAnywhere(p))) { G.over = "full"; G.overT = 0; A.sfx.lose(); }
  }
  function endZen() {
    if (st.demo) return;
    G.newBest = G.score > save.zenBest;
    if (G.newBest) { save.zenBest = G.score; persist(); }
    A.sfx.lose();
  }
  function finishWin() {
    // stars by moves left (as a share of the limit)
    const share = G.bonusStart / G.lv.moves;
    G.stars = share >= 0.45 ? 3 : share >= 0.25 ? 2 : 1;
    const n = G.n;
    G.advanced = n === save.unlocked;
    save.stars[n] = Math.max(save.stars[n] || 0, G.stars);
    save.unlocked = Math.max(save.unlocked, n + 1);
    if (G.lv.tutorial) save.tutDone = true;
    G.seedsWon = G.stars * 5 + (G.lv.summit ? 20 : 0);
    save.seeds += G.seedsWon;
    task("levels");
    if (G.stars === 3) task("stars3");
    persist();
  }

  // undo the last move (deep breath)
  function deepBreath() {
    if (!G || G.zen && !G.history) { toast(t("breatheNone")); return; }
    if (!G.history) { toast(t("breatheNone")); return; }
    if (G.breathUsed) {
      if (save.breathB > 0 && !st.demo) { save.breathB--; persist(); } else { toast(t("breatheUsed")); return; }
    }
    restore(G.history);
    G.history = null;
    G.breathUsed = true;
    G.over = null;
    A.sfx.chime();
    sparks(W / 2, BY + 120, 20, COL.sky);
  }

  // ---------------------------------------------------------------- demo AI
  function bestMove() {
    let best = null;
    G.tray.forEach((pc, slot) => {
      if (!pc) return;
      for (let y = 0; y <= 9 - pc.p.ht; y++) for (let x = 0; x <= 9 - pc.p.wd; x++) {
        if (!canPlace(pc, x, y)) continue;
        const b = G.board.slice();
        for (const [cx, cy] of pc.p.cells) b[idx(x + cx, y + cy)] = { k: "plant" };
        const { cells, lines } = findClears(b);
        for (const k of cells) b[k] = null;
        // fewer isolated holes is better
        let holes = 0, edge = 0;
        for (let i = 0; i < 81; i++) {
          if (b[i]) continue;
          const X = i % 9, Y = Math.floor(i / 9);
          let n = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = X + dx, c = Y + dy; if (a < 0 || c < 0 || a > 8 || c > 8 || b[idx(a, c)]) n++; }
          if (n >= 3) holes++;
        }
        for (const [cx, cy] of pc.p.cells) { if (x + cx === 0 || x + cx === 8) edge++; if (y + cy === 0 || y + cy === 8) edge++; }
        const s = lines * 100 + cells.size - holes * 9 + edge * 0.6 + pc.p.cells.length * 0.5 + Math.random() * 0.5;
        if (!best || s > best.s) best = { s, slot, x, y };
      }
    });
    return best;
  }
  function startDemo() {
    st.help = null; st.settings = false;
    st.demo = true;
    newGame(1, { zen: true, demo: true });
    G.tut = -1;
  }
  function stopDemo() { st.demo = false; G = null; st.mode = "title"; st.idle = 0; }
  function updateDemo(dt) {
    if (!G) return;
    if (G.over) { G.overT += dt; if (G.overT > 2) startDemo(); return; }
    G.demoT += dt;
    if (!G.drag && G.demoT > 0.5) {
      const m = bestMove();
      if (!m) return;
      const sx = slotX(m.slot), sy = TY + 39;
      G.drag = { slot: m.slot, demo: m, x: sx, y: sy, sx, sy, t: 0, ox: 0, oy: 0, type: "demo" };
    }
    if (G.drag && G.drag.type === "demo") {
      const d = G.drag;
      d.t += dt;
      const pc = G.tray[d.slot];
      const tx = cellX(d.demo.x) + pc.p.wd * CELL / 2, ty = cellY(d.demo.y) + pc.p.ht * CELL / 2;
      const k = Math.min(1, d.t / 0.7), e = k * k * (3 - 2 * k);
      d.x = d.sx + (tx - d.sx) * e; d.y = d.sy + (ty - d.sy) * e;
      if (k >= 1 && d.t > 0.85) { G.drag = null; place(d.slot, d.demo.x, d.demo.y); G.demoT = 0; }
    }
  }

  // ---------------------------------------------------------------- input
  function toLogical(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  const slotX = (s) => 6 + s * 80 + 40;
  function hitButton(p) {
    for (const b of st.buttons.slice().reverse()) if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    return null;
  }
  canvas.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    A.unlock();
    A.setMusic(save.music); A.setSound(save.sound);
    const p = toLogical(e);
    st.idle = 0;
    st.press = p;
    if (st.demo) { stopDemo(); return; }
    if (G && G.breath) { G.breath = null; return; }          // a tap during the breath cancels it
    if (st.mode === "play" && G && G.over === "win" && G.moves > 0) { G.skip = true; return; }
    const b = hitButton(p);
    if (b) {
      if (b.hold) { b.hold(true); st.holding = b; return; }
      b.on && b.on(p); A.sfx.tap(); return;
    }
    if (st.help || st.settings || st.modal) return;
    if (st.mode === "play" && G && !G.over && !st.paused) {
      // pick up a piece from the tray
      if (p.y > TY - 4 && p.y < TY + 82) {
        const slot = Math.max(0, Math.min(2, Math.floor((p.x - 6) / 80)));
        const pc = G.tray[slot];
        if (pc) {
          const touch = e.pointerType !== "mouse";
          G.drag = { slot, x: p.x, y: p.y, ox: 0, oy: touch ? -46 : -6, type: "user", sx: p.x, sy: p.y, t: 0 };
          A.sfx.pick(); vib(5);
          canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
        }
      }
    }
    if (st.mode === "title" && !b) { /* buttons only */ }
  });
  canvas.addEventListener("pointermove", (e) => {
    const p = toLogical(e);
    if (G && G.drag && G.drag.type === "user") { G.drag.x = p.x; G.drag.y = p.y; }
    if (st.press) st.press = p;
  });
  function endPointer(e) {
    const p = toLogical(e);
    st.press = null;
    if (st.holding) { st.holding.hold(false); st.holding = null; }
    if (!G || !G.drag || G.drag.type !== "user") return;
    const d = G.drag;
    G.drag = null;
    const target = dropTarget(d);
    if (target && target.compost) {
      if (G.compost > 0) {
        G.compost--;
        task("compost");
        let pc = randomPiece();
        for (let k = 0; k < 6 && !fitsAnywhere(pc); k++) pc = randomPiece();
        G.tray[d.slot] = pc;
        A.sfx.compost(); vib(10);
        sparks(compostRect().x + 14, compostRect().y + 10, 8, "#9cb565");
        checkEnd();
      } else { toast(t("compostEmpty")); A.sfx.bad(); }
      return;
    }
    if (target && target.ok) place(d.slot, target.x, target.y);
    else if (Math.hypot(p.x - d.sx, p.y - d.sy) > 12) A.sfx.bad();
  }
  canvas.addEventListener("pointerup", endPointer);
  canvas.addEventListener("pointercancel", endPointer);

  function compostRect() { return { x: 6, y: BB + 4, w: 74, h: 24 }; }
  // where would the dragged piece land?
  function dropTarget(d) {
    const pc = G.tray[d.slot];
    if (!pc) return null;
    const cx = d.x + d.ox, cy = d.y + d.oy;
    const cr = compostRect();
    if (d.type === "user" && cx > cr.x - 6 && cx < cr.x + cr.w + 6 && cy > cr.y - 18 && cy < cr.y + cr.h + 10) return { compost: true };
    const left = cx - pc.p.wd * CELL / 2, top = cy - pc.p.ht * CELL / 2;
    const x = Math.round((left - BX) / CELL), y = Math.round((top - BY) / CELL);
    if (x < -1 || y < -1 || x > 9 || y > 9) return null;
    return { x, y, ok: canPlace(pc, x, y) };
  }

  window.addEventListener("keydown", (e) => {
    A.unlock();
    if (e.code === "KeyH" || (e.code === "Escape" && st.help)) { if (st.help) closeHelp(); else openHelp(); }
    else if (e.code === "Escape" && st.mode === "play") st.paused = !st.paused;
    else if (e.code === "KeyU" && st.mode === "play") deepBreath();
  });

  // ---------------------------------------------------------------- help / settings
  function openHelp() { st.help = { page: 0, t: 0 }; st.settings = false; if (st.mode === "play") st.paused = true; }
  function closeHelp() { st.help = null; if (st.mode === "play" && G && !G.over) st.paused = false; }
  function topButtons(x = W - 26, y = TOP + 2, withPause = false) {
    iconButton(x, y, "i_gear", () => { st.settings = !st.settings; st.help = null; st.resetArm = 0; if (st.mode === "play") st.paused = st.settings; });
    // help: wood button with a "?" label
    button(x - 23, y, 20, 20, "?", () => openHelp(), { skin: "btn_wood", size: 10 });
  }

  // ---------------------------------------------------------------- screens
  function drawLang() {
    drawBg("meadow");
    rect(0, 0, W, H, "rgba(31,22,34,0.35)");
    logo(W / 2, H * 0.3);
    text(t("chooseLang"), W / 2, H * 0.52, 8, COL.cream);
    button(W / 2 - 92, H * 0.56, 86, 26, "SRPSKI", () => { save.lang = "sr"; persist(); st.mode = "title"; }, { skin: "btn_pink", size: 9 });
    button(W / 2 + 6, H * 0.56, 86, 26, "ENGLISH", () => { save.lang = "en"; persist(); st.mode = "title"; }, { skin: "btn_green", size: 9 });
  }

  function logo(cx, cy) {
    if (SOFT()) { text("Hike &", cx, cy - 12, 26, "#F6FAF1", "center", C3.ink); text("Bloom", cx, cy + 16, 29, "#9BD978", "center", C3.ink); return; }
    const bob = Math.sin(st.time * 1.4) * 2;
    // flowers framing the title
    const fl = ["cosmos", "lavender", "poppy", "sunflower", "daisy", "cornflower"];
    fl.forEach((sp, i) => {
      const a = (i / fl.length) * Math.PI * 2 + st.time * 0.15;
      const x = cx + Math.cos(a) * 92, y = cy + 6 + Math.sin(a) * 30;
      ctx.globalAlpha = 0.95;
      img(`m_${sp}_1`, x - 8, y - 8);
    });
    ctx.globalAlpha = 1;
    text("HIKE &", cx, cy - 12 + bob, 30, COL.paper, "center", COL.ink);
    text("BLOOM", cx, cy + 18 + bob, 30, COL.green, "center", COL.ink);
    text(t("tagline"), cx, cy + 44, 8, COL.cream);
  }

  function seedPill(x, y) {
    nine("btn_plate", x, y, 62, 20);
    img("i_seed", x + 5, y + 2);
    text(String(save.seeds), x + 38, y + 9, 9, COL.gold);
  }
  function badge(x, y) {
    const r = 3 + Math.sin(st.time * 6) * 0.6;
    ctx.fillStyle = COL.ink; ctx.beginPath(); ctx.arc(x, y, r + 1.2, 0, 7); ctx.fill();
    ctx.fillStyle = "#ef5a4a"; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  function navBar() {
    const items = [
      ["i_map", t("trail"), () => { enterJourney(false); }, false],
      ["i_tasks", t("tasks"), () => { st.modal = "tasks"; }, tasksReady()],
      ["i_gift", t("bonus"), () => { st.modal = "bonus"; }, bonusReady()],
      ["i_shop", t("shop"), () => { st.modal = "shop"; }, false],
    ];
    rect(0, H - 46, W, 46, "rgba(14,20,22,0.55)");
    items.forEach(([icon, label, on, dot], i) => {
      const x = 4 + i * 62, y = H - 42;
      button(x, y, 58, 38, "", on, { skin: "btn_wood" });
      img(icon, x + 22.5, y + 5);
      text(label, x + 29, y + 26, 6.5, COL.cream);
      if (dot) badge(x + 52, y + 4);
    });
  }
  function drawTitle() {
    if (SOFT()) { drawTitle3d(st.dt || 0.016); return; }
    drawBg("meadow");
    rect(0, 0, W, H, "rgba(20,16,26,0.16)");
    seedPill(6, TOP + 2);
    topButtons();
    logo(W / 2, TOP + 78);
    const by = Math.round(H * 0.42);
    const n = save.unlocked;
    button(W / 2 - 78, by, 156, 36, `${t("play")} · ${t("level")} ${n}`, () => newGame(n), { skin: "btn_green", size: 12, icon: "i_play" });
    text(I18N[save.lang].biomes[Math.floor((n - 1) / 10) % 6], W / 2, by + 45, 8, COL.cream);
    button(W / 2 - 55, by + 58, 110, 26, t("zen"), () => newGame(0, { zen: true }), { skin: "btn_pink", size: 11, icon: "i_leaf" });
    text(`${t("zenSub")} · ${t("best")} ${save.zenBest}`, W / 2, by + 93, 7, COL.cream);
    // our heroine strolls along the bottom
    const hx = ((st.time * 16) % (W + 90)) - 60;
    imgH("hero_walk_" + (Math.floor(st.time * 5) % 4), hx, H - 46 - 86 + (Math.floor(st.time * 5) % 2), 84);
    navBar();
    if (!st.bonusShown && bonusReady() && !st.modal && !st.help && !st.settings) { st.bonusShown = true; st.modal = "bonus"; }
  }

  // ---------- home overlays: daily tasks, daily bonus, shop
  function modalFrame(title, ph) {
    ctx.fillStyle = "rgba(14,12,20,0.6)";
    ctx.fillRect(0, 0, W, H);
    const py = Math.round((H - ph) / 2);
    nine("panel", 10, py, W - 20, ph);
    text(title, W / 2, py + 19, 13, "#1E3A2B", "center", null);
    iconButton(W - 36, py + 7, "i_close", () => { st.modal = null; });
    img("i_seed", 20, py + 9);
    text(String(save.seeds), 36, py + 16, 9, "#B9781C", "left", null);
    return py;
  }
  function drawModal() {
    if (st.modal === "tasks") {
      ensureDay();
      const py = modalFrame(t("dailyTasks"), 214);
      save.tasks.forEach((k, i) => {
        const y = py + 36 + i * 52;
        rect(18, y, W - 36, 46, "rgba(194,177,153,0.4)");
        text(t("task_" + k.id).replace("{n}", k.need), 24, y + 11, 8, COL.brown, "left", null);
        nine("ui_bar_empty", 22, y + 20, 134, 14);
        const fw = Math.round(134 * k.prog / k.need);
        if (fw >= 16) nine("ui_bar_full", 22, y + 20, fw, 14);
        text(`${Math.min(k.prog, k.need)}/${k.need}`, 89, y + 27, 7, C3.ink, "center", null);
        const done = k.prog >= k.need;
        if (k.claimed) { img("i_check", 198, y + 16); }
        else button(166, y + 12, 62, 24, String(k.rew), () => {
          if (!done) return;
          k.claimed = true; addSeeds(k.rew, 196, y + 20);
        }, { skin: done ? "btn_green" : "btn_stone", size: 9, icon: "i_seed" });
      });
      text(t("newTasks"), W / 2, py + 200, 7, "#4E6656", "center", null);
    } else if (st.modal === "bonus") {
      const py = modalFrame(t("dailyBonus"), 222);
      const cur = bonusIndex(), ready = bonusReady();
      for (let i = 0; i < 7; i++) {
        const big = i === 6;
        const col = i % 4, row = Math.floor(i / 4);
        const x = 18 + col * 54, y = py + 36 + row * 62, w = big ? 104 : 50;
        const got = ready ? i < cur : i <= cur;
        if (i === cur && ready) nine("btn_plate", x, y, w, 56); else rect(x, y, w, 56, got ? "rgba(147,196,90,0.5)" : "rgba(194,177,153,0.45)");
        const today = i === cur && ready;
        text(`${t("day")} ${i + 1}`, x + w / 2, y + 9, 7, today ? C3.acc : COL.brown, "center", null);
        img("i_seed", x + w / 2 - (big ? 20 : 6.5), y + 18);
        if (big) img("i_rain", x + w / 2 + 6, y + 18);
        text(String(BONUS[i]) + (big ? " +1" : ""), x + w / 2, y + 43, 9, today ? C3.acc : "#4E6656", "center", null);
        if (got) img("i_check", x + w - 15, y + 2);
      }
      if (ready) button(W / 2 - 60, py + 166, 120, 28, t("claim"), () => claimBonus(), { skin: "btn_green", size: 11, icon: "i_gift" });
      else wrap(t("comeBack"), 200, 8).forEach((l, i) => text(l, W / 2, py + 176 + i * 11, 8, "#4E6656", "center", null));
    } else if (st.modal === "shop") {
      const py = modalFrame(t("shop"), 170);
      const rows = [
        ["i_rain", t("rainBooster"), t("rainBoosterSub"), "rainB", PRICE.rain],
        ["i_breath", t("breathBooster"), t("breathBoosterSub"), "breathB", PRICE.breath],
      ];
      rows.forEach(([icon, name, sub, key, price], i) => {
        const y = py + 38 + i * 60;
        rect(18, y, W - 36, 54, "rgba(194,177,153,0.4)");
        nine("btn_wood", 24, y + 8, 24, 24);
        img(icon, 29.5, y + 12);
        text(name, 54, y + 12, 9, COL.brown, "left", null);
        text(sub, 54, y + 25, 6.5, "#4E6656", "left", null);
        text(`${t("owned")}: ${save[key]}`, 54, y + 40, 7, "#2A6A1E", "left", null);
        button(166, y + 26, 62, 22, String(price), () => { if (spend(price)) { save[key]++; persist(); sparks(196, y + 36, 10); } },
          { skin: save.seeds >= price ? "btn_gold" : "btn_stone", size: 9, icon: "i_seed" });
      });
    }
  }

  // ---------- trail map
  function nodePos(i) {
    // i 0..9 bottom to top, zigzag
    const top = TOP + 74, bottom = H - 60;
    const y = bottom - (i / 9) * (bottom - top);
    const x = W / 2 + Math.sin(i * 1.15 + 0.4) * 72;
    return { x, y };
  }
  function drawMap() {
    const page = st.page;
    const biome = page % 6, lap = Math.floor(page / 6);
    drawBg(L.BIOMES[biome].key);
    rect(0, 0, W, H, "rgba(31,22,34,0.12)");
    // trail
    for (let i = 0; i < 9; i++) {
      const a = nodePos(i), b = nodePos(i + 1);
      const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6);
      for (let s = 1; s < steps; s++) {
        const k = s / steps;
        const x = a.x + (b.x - a.x) * k + Math.sin(k * Math.PI) * 10 * (i % 2 ? 1 : -1), y = a.y + (b.y - a.y) * k;
        const lv = page * 10 + i + 1;
        rect(x - 1, y - 1, 3, 2, lv < save.unlocked ? "#cf9d6c" : "rgba(244,236,217,0.55)");
        rect(x - 1, y + 1, 3, 1, "rgba(31,22,34,0.4)");
      }
    }
    // nodes
    for (let i = 0; i < 10; i++) {
      const n = page * 10 + i + 1;
      const { x, y } = nodePos(i);
      const done = n < save.unlocked, cur = n === save.unlocked, locked = n > save.unlocked;
      if (i === 9) img("flag", x - 8, y - 28);
      else img(locked ? "sign_locked" : done ? "sign_done" : cur ? "sign_current" : "sign_open", x - 10, y - 20 + (cur ? Math.round(Math.sin(st.time * 4)) : 0));
      if (!locked && i < 9) text(String(n), x - 1, y - 14, 7, done ? COL.cream : COL.ink, "center", done ? COL.ink : null);
      if (i === 9) text(`${t("summit")} ${n}`, x + 4, y + 6, 7, COL.cream);
      const s = save.stars[n] || 0;
      if (done) for (let k = 0; k < 3; k++) img(k < s ? "i_star" : "i_star_off", x - 19 + k * 12, y + 1, 13, 13);
      if (!locked) st.buttons.push({ x: x - 16, y: y - 26, w: 32, h: 40, on: () => newGame(n) });
    }
    // hiker at the current node
    const cur = save.unlocked - 1 - page * 10;
    if (cur >= 0 && cur < 10) {
      const { x, y } = nodePos(cur);
      imgH("hero_front", x + 10, y - 34, 38);
    }
    // header
    nine("ui_sign", 30, TOP - 2, W - 60, 40);
    text(I18N[save.lang].biomes[biome] + (lap ? ` · ${lap + 1}.` : ""), W / 2, TOP + 18, 11, COL.cream);
    text(`${t("level")} ${page * 10 + 1}–${page * 10 + 10}`, W / 2, TOP + 30, 7, "#f4ecd9", "center", COL.ink);
    iconButton(6, TOP + 8, "i_home", () => { st.mode = "title"; });
    iconButton(W - 26, TOP + 8, "i_gear", () => { st.settings = true; });
    // page arrows
    if (page > 0) button(6, H / 2 - 12, 22, 24, "‹", () => { st.page--; }, { skin: "btn_wood", size: 14 });
    if ((page + 1) * 10 < save.unlocked) button(W - 28, H / 2 - 12, 22, 24, "›", () => { st.page++; }, { skin: "btn_wood", size: 14 });
    button(W / 2 - 40, H - 30, 80, 22, t("help"), () => openHelp(), { skin: "btn_wood", size: 7 });
  }

  // ---------- summit camp
  const CAMP_TINT = ["rgba(255,236,200,0.06)", "rgba(255,140,130,0.22)", "rgba(120,170,235,0.22)", "rgba(70,150,110,0.24)", "rgba(255,120,70,0.26)", "rgba(240,150,175,0.18)"];
  function campLayer(biome) {       // camp objects composed once per area and tinted with its light
    if (st.campCache[biome]) return st.campCache[biome];
    const c = document.createElement("canvas");
    c.width = 504; c.height = 320;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    const put = (name, x, y) => { const im = IMG["camp_" + name]; if (im.naturalWidth) g.drawImage(im, x * 2, y * 2); };
    put("lights", 92, 4); put("hammock", 2, 34); put("van", 168, 30); put("tent", 74, 52); put("sign", 146, 34);
    put("mat", 14, 122); put("fire", 132, 112); put("mugs", 190, 132);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = CAMP_TINT[biome]; g.fillRect(0, 0, 504, 320);
    st.campCache[biome] = c;
    return c;
  }
  function drawCamp() {
    const biome = (Math.floor((G.n - 1) / 10)) % 6;
    drawBg(L.BIOMES[biome].key);
    rect(0, 0, W, H, "rgba(20,14,30,0.25)");
    const cy = Math.round(H * 0.36);
    ctx.fillStyle = "rgba(10,14,12,0.42)";
    ctx.beginPath(); ctx.ellipse(W / 2, cy + 128, 124, 34, 0, 0, 7); ctx.fill();
    ctx.drawImage(campLayer(biome), 0, cy, 252, 160);
    imgH("hero_yoga", 26, cy + 76 - (Math.floor(st.time / 2) % 2), 62);
    if (Math.random() < 0.35) st.parts.push({ x: 152 + Math.random() * 6, y: cy + 118, vx: (Math.random() - 0.5) * 6, vy: -20 - Math.random() * 20, g: 0, life: 1.2, t: 0, c: Math.random() < 0.5 ? COL.gold : "#f6ab55", s: 1, spark: true });
    text(t("camp"), W / 2, cy - 34, 16, COL.gold);
    text(`${t("summit")} ${G.n} · ${I18N[save.lang].biomes[biome]}`, W / 2, cy - 15, 8, COL.cream);
    wrap(t("campSub"), 210, 8).forEach((l, i) => text(l, W / 2, cy + 178 + i * 11, 8, COL.paper));
    button(W / 2 - 60, cy + 206, 120, 28, t("newTrail"), () => { enterJourney(false); }, { skin: "btn_green", size: 10, icon: "i_map" });
  }

  // ---------------------------------------------------------------- play screen
  function drawHud() {
    if (SOFT()) { drawHud3d(); return; }
    // top panel
    nine("panel_hud", -2, TOP - 8, W + 4, 60);
    const lv = G.lv;
    if (G.zen) {
      text(t("zen"), 16, TOP + 12, 10, COL.brown, "left", null);
      text(`${t("best")} ${Math.max(save.zenBest, G.score)}`, 16, TOP + 30, 7, "#4E6656", "left", null);
    } else {
      text(`${t("level")} ${G.n}`, 16, TOP + 12, 9, COL.brown, "left", null);
    }
    text(String(G.score), W / 2 - 22, TOP + 12, 11, "#B9781C", "center", null);
    // moves
    if (!G.zen) {
      const low = G.moves <= 3;
      nine("btn_plate", W - 106, TOP + 4, 46, 19);
      img("i_moves", W - 102, TOP + 6);
      text(String(G.moves), W - 76, TOP + 13, 10, low ? (Math.floor(st.time * 4) % 2 ? COL.red : COL.cream) : COL.cream);
    }
    // goals
    if (!G.zen) {
      let gx = 14;
      lv.goals.forEach((g, i) => {
        const done = G.prog[i] >= g.need;
        const w = 50;
        rect(gx, TOP + 23, w, 16, done ? "rgba(147,196,90,0.45)" : "rgba(194,177,153,0.45)");
        if (g.type === "bloom") img(`m_${g.sp}_1`, gx + 1, TOP + 22, 17, 17);
        else if (g.type === "score") img("i_star", gx + 2, TOP + 25);
        else img(g.type === "stone" ? "stone" : g.type, gx + 1, TOP + 22, 17, 17);
        const left = Math.max(0, g.need - G.prog[i]);
        if (done) img("i_check", gx + 26, TOP + 25);
        else text(g.type === "score" ? String(left) : String(left), gx + 34, TOP + 31, g.type === "score" && left > 999 ? 7 : 9, COL.brown, "center", null);
        gx += w + 4;
      });
    } else {
      text(`${t("streak")} ${G.streak}`, W - 52, TOP + 31, 8, "#4E6656", "center", null);
    }
    // buttons on the right of the top line
    iconButton(W - 34, TOP + 3, "i_pause", () => { st.paused = true; st.settings = true; });
    button(W - 57, TOP + 3, 20, 20, "?", () => openHelp(), { skin: "btn_wood", size: 10 });
  }

  function drawBoard() {
    if (SOFT()) return drawBoard3d();
    const ox = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0, oy = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0;
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    // shadow + frame
    // see-through bed: the landscape shows through, with a soft tint and a light grid
    const bx = Math.round(BX), by = Math.round(BY);
    rect(bx - 2, by - 2, BOARD + 4, BOARD + 4, "rgba(255,250,240,0.55)");
    rect(bx - 1, by - 1, BOARD + 2, BOARD + 2, "rgba(16,28,22,0.34)");
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if ((x + y) % 2 === 0) rect(bx + x * CELL * 3, by + y * CELL * 3, CELL * 3, CELL * 3, "rgba(255,250,240,0.06)");
    for (let i = 1; i < 9; i++) {
      const a = i % 3 === 0 ? 0.42 : 0.16;
      rect(bx + i * CELL, by, 1, BOARD, `rgba(255,250,240,${a})`);
      rect(bx, by + i * CELL, BOARD, 1, `rgba(255,250,240,${a})`);
    }
    // preview of what the drag would do
    let ghost = null, clears = null;
    if (G.drag) {
      const tgt = dropTarget(G.drag);
      const pc = G.tray[G.drag.slot];
      if (tgt && !tgt.compost && pc) {
        ghost = { tgt, pc };
        if (tgt.ok) {
          const b = G.board.slice();
          for (const [cx, cy] of pc.p.cells) b[idx(tgt.x + cx, tgt.y + cy)] = { k: "plant" };
          clears = findClears(b).cells;
        }
      }
    }
    // contents
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const c = G.board[idx(x, y)];
      if (!c) continue;
      const age = st.time - G.bornAt[idx(x, y)];
      const drop = age < 0 ? -1 : age < 0.18 ? -(1 - age / 0.18) * 8 : age < 0.28 ? Math.sin((age - 0.18) / 0.1 * Math.PI) * 1.5 : 0;
      if (age < 0) continue;
      const X = cellX(x), Y = cellY(y) + Math.round(drop);
      if (c.k === "plant") {
        tile(`p_${c.sp}_${stageOf(c)}`, X, Y);
        if (stageOf(c) === 0) { rect(X + 11, Y + 2, 5, 5, COL.ink); rect(X + 12, Y + 3, 3, 3, PETAL[c.sp][0]); }   // buds look alike: mark the species
        // subtle sway on lush plants
      } else if (c.k === "stone") tile("stone", X, Y);
      else if (c.k === "stone2") tile("stone_cracked", X, Y);
      else if (c.k === "weed") tile("weed_" + (Math.floor(st.time * 1.2 + x) % 2), X, Y);
      else if (c.k === "plastic") tile("plastic", X, Y);
      else if (c.k === "mush") tile("mushroom", X, Y);
    }
    // clear preview: golden glow
    if (clears && clears.size) {
      const a = 0.35 + Math.sin(st.time * 10) * 0.12;
      ctx.fillStyle = `rgba(245,209,79,${a})`;
      for (const k of clears) ctx.fillRect(cellX(k % 9), cellY(Math.floor(k / 9)), CELL, CELL);
    }
    if (ghost) {
      const { tgt, pc } = ghost;
      ctx.globalAlpha = tgt.ok ? 0.55 : 0.0;
      for (const [cx, cy] of pc.p.cells) {
        const X = tgt.x + cx, Y = tgt.y + cy;
        if (X >= 0 && Y >= 0 && X < 9 && Y < 9) tile(`p_${pc.sp}_1`, cellX(X), cellY(Y));
      }
      ctx.globalAlpha = 1;
    }
    // bloom pops
    for (const f of st.fx) {
      if (f.t < 0) { tile(`p_${f.sp}_${f.stage}`, f.x, f.y); continue; }
      const k = f.t / 0.55;
      const s = 1 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      const sz = CELL * s;
      tile(`p_${f.sp}_${f.stage}`, f.x + 13.5 - sz / 2, f.y + 13.5 - sz / 2, sz);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }


  // ---------------------------------------------------------------- soft 3D style (vector, drawn at full screen resolution)
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function grad(y0, y1, a, b) { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, a); g.addColorStop(1, b); return g; }
  const EARTH = {   // grass cap, its darker rim, soil side, soil shade
    plant: ["#8fd16a", "#5fa846", "#9a6638", "#6e4526"],
    weed: ["#7f9c47", "#56702f", "#8a5c33", "#5f3e22"],
    mush: ["#8fd16a", "#5fa846", "#9a6638", "#6e4526"],
    plastic: ["#c7c08a", "#9c9563", "#9a6638", "#6e4526"],
    stone: ["#b9b4aa", "#8b867d", "#7d786f", "#57534d"],
    stone2: ["#aaa499", "#7d786f", "#6f6a62", "#4b4843"],
  };
  // an earth clod: grass on top, soil showing on the front face
  function clod(X, Y, s, kind, alpha = 1) {
    const [top, rim, soil, shade] = EARTH[kind] || EARTH.plant;
    const d = Math.max(2.5, s * 0.24), r = s * 0.2, x = X + s * 0.05, w = s * 0.9, y = Y + s * 0.03, h = s * 0.94;
    ctx.globalAlpha = alpha * 0.35; rr(x + 1, y + 2, w, h, r); ctx.fillStyle = "#0d1410"; ctx.fill();   // contact shadow
    ctx.globalAlpha = alpha;
    rr(x, y, w, h, r); ctx.fillStyle = grad(y + h - d * 2, y + h, soil, shade); ctx.fill();                // soil block
    if (kind !== "stone" && kind !== "stone2") {                                                         // soil grains
      ctx.fillStyle = shade;
      for (let i = 0; i < 4; i++) { const gx = x + w * (0.18 + i * 0.2), gy = y + h - d * (0.35 + (i % 2) * 0.3); ctx.fillRect(gx, gy, s * 0.05, s * 0.05); }
    }
    rr(x, y, w, h - d, r); ctx.fillStyle = grad(y, y + h - d, top, rim); ctx.fill();                       // grass cap
    if (kind !== "stone" && kind !== "stone2") {                                                         // grass fringe over the soil
      ctx.fillStyle = rim; ctx.beginPath();
      for (let i = 0; i <= 6; i++) { const fx = x + r * 0.6 + (w - r * 1.2) * i / 6; ctx.moveTo(fx - s * 0.05, y + h - d - 0.5); ctx.lineTo(fx, y + h - d + s * 0.07); ctx.lineTo(fx + s * 0.05, y + h - d - 0.5); }
      ctx.fill();
    }
    ctx.globalAlpha = alpha * 0.45; rr(x + w * 0.1, y + s * 0.06, w * 0.5, s * 0.12, s * 0.06); ctx.fillStyle = "#fffaf0"; ctx.fill(); // shine
    ctx.globalAlpha = alpha;
    return { cx: x + w / 2, cy: y + (h - d) / 2 };
  }
  function ellipse(x, y, rx, ry, rot, c) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, 7); ctx.fillStyle = c; ctx.fill(); }
  function leaf(x, y, l, a, c) { ellipse(x + Math.cos(a) * l * 0.5, y + Math.sin(a) * l * 0.5, l * 0.5, l * 0.22, a, c); }
  const PETALS = { daisy: 8, edelweiss: 6, cosmos: 8, sunflower: 12, lavender: 5, poppy: 5, cornflower: 7, marigold: 9 };
  function flower3d(cx, cy, s, sp, stage, t = 0) {
    const [c0, c1, c2] = PETAL[sp] || PETAL.daisy;
    const sway = Math.sin(st.time * 2 + cx * 0.3) * 0.08;
    if (stage === 0) {                    // sprout with a bud of its colour
      leaf(cx, cy + s * 0.12, s * 0.34, -2.4 + sway, "#2d6a2a"); leaf(cx, cy + s * 0.12, s * 0.34, -0.7 + sway, "#357a30");
      ellipse(cx, cy - s * 0.04, s * 0.1, s * 0.12, 0, c0); ellipse(cx - s * 0.03, cy - s * 0.08, s * 0.03, s * 0.04, 0, "rgba(255,250,240,0.6)");
      return;
    }
    const R = s * (stage === 2 ? 0.36 : 0.28);
    if (stage === 2) { leaf(cx, cy + R * 0.4, R * 1.3, 2.6 + sway, "#3f8a3a"); leaf(cx, cy + R * 0.4, R * 1.3, 0.5 + sway, "#4f9e41"); }
    const n = PETALS[sp] || 6, rot = sway + (sp.length % 3) * 0.3;
    ctx.globalAlpha *= 1; 
    for (let i = 0; i < n; i++) {        // petal shadows then petals
      const a = rot + i * Math.PI * 2 / n;
      ellipse(cx + Math.cos(a) * R * 0.55, cy + 0.8 + Math.sin(a) * R * 0.55, R * 0.48, R * (n > 8 ? 0.2 : 0.3), a, "rgba(0,0,0,0.18)");
    }
    for (let i = 0; i < n; i++) {
      const a = rot + i * Math.PI * 2 / n;
      const px = cx + Math.cos(a) * R * 0.55, py = cy + Math.sin(a) * R * 0.55;
      ellipse(px, py, R * 0.48, R * (n > 8 ? 0.2 : 0.3), a, i % 2 ? c1 : c0);
    }
    const core = sp === "daisy" || sp === "edelweiss" || sp === "cosmos" ? "#f2c34a" : sp === "sunflower" ? "#6b4226" : sp === "poppy" ? "#2a1d22" : c2;
    ellipse(cx, cy, R * 0.3, R * 0.3, 0, core);
    ellipse(cx - R * 0.09, cy - R * 0.1, R * 0.11, R * 0.09, 0, "rgba(255,250,240,0.55)");
  }
  function cell3d(c, X, Y, s, alpha = 1) {
    const kind = c.k === "plant" ? "plant" : c.k;
    const { cx, cy } = clod(X, Y, s, kind, alpha);
    if (c.k === "plant") flower3d(cx, cy, s, c.sp, stageOf(c));
    else if (c.k === "stone2") {
      ctx.strokeStyle = "#3f3c38"; ctx.lineWidth = Math.max(0.7, s * 0.04); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx - s * 0.22, cy - s * 0.2); ctx.lineTo(cx - s * 0.02, cy - s * 0.02); ctx.lineTo(cx - s * 0.1, cy + s * 0.12); ctx.moveTo(cx - s * 0.02, cy - s * 0.02); ctx.lineTo(cx + s * 0.2, cy + s * 0.04); ctx.stroke();
    } else if (c.k === "stone") {
      ellipse(cx + s * 0.12, cy + s * 0.08, s * 0.08, s * 0.05, 0, "rgba(0,0,0,0.12)"); ellipse(cx - s * 0.15, cy - s * 0.1, s * 0.06, s * 0.04, 0, "rgba(0,0,0,0.1)");
    } else if (c.k === "weed") {
      const sw = Math.sin(st.time * 1.5 + X) * 0.12;
      for (const [a, l, col] of [[-2.0, 0.42, "#3d5a1f"], [-1.57, 0.5, "#4a6b26"], [-1.1, 0.42, "#3d5a1f"], [-2.6, 0.3, "#55772c"], [-0.5, 0.3, "#55772c"]]) {
        ctx.beginPath(); const ax = cx, ay = cy + s * 0.18, aa = a + sw;
        ctx.moveTo(ax - s * 0.05, ay); ctx.lineTo(ax + Math.cos(aa) * s * l, ay + Math.sin(aa) * s * l); ctx.lineTo(ax + s * 0.05, ay); ctx.fillStyle = col; ctx.fill();
      }
    } else if (c.k === "plastic") {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.6);
      rr(-s * 0.25, -s * 0.11, s * 0.4, s * 0.22, s * 0.08); ctx.fillStyle = "rgba(150,205,235,0.85)"; ctx.fill();
      rr(s * 0.13, -s * 0.06, s * 0.1, s * 0.12, s * 0.02); ctx.fill();
      rr(s * 0.22, -s * 0.06, s * 0.06, s * 0.12, s * 0.02); ctx.fillStyle = "#3f7fc0"; ctx.fill();
      rr(-s * 0.2, -s * 0.07, s * 0.28, s * 0.04, s * 0.02); ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fill();
      ctx.restore();
    } else if (c.k === "mush") {
      rr(cx - s * 0.06, cy - s * 0.02, s * 0.12, s * 0.2, s * 0.04); ctx.fillStyle = "#f4ecd9"; ctx.fill();
      ctx.beginPath(); ctx.ellipse(cx, cy, s * 0.24, s * 0.18, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = "#d9493c"; ctx.fill();
      ellipse(cx - s * 0.1, cy - s * 0.08, s * 0.035, s * 0.03, 0, "#fffaf0"); ellipse(cx + s * 0.07, cy - s * 0.11, s * 0.03, s * 0.025, 0, "#fffaf0"); ellipse(cx + s * 0.02, cy - s * 0.04, s * 0.025, s * 0.02, 0, "#fffaf0");
    }
    ctx.globalAlpha = 1;
  }
  function drawBoard3d() {
    const ox = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0, oy = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0;
    ctx.save(); ctx.translate(ox, oy);
    const bx = BX, by = BY;
    // see-through bed with soft rounded cells
    rr(bx - 4, by - 4, BOARD + 8, BOARD + 8, 10); ctx.fillStyle = "rgba(16,28,22,0.32)"; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,250,240,0.55)"; ctx.stroke();
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const dark = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0;
      rr(cellX(x) + 1.5, cellY(y) + 1.5, CELL - 3, CELL - 3, 5);
      ctx.fillStyle = dark ? "rgba(255,250,240,0.16)" : "rgba(255,250,240,0.09)"; ctx.fill();
    }
    let ghost = null, clears = null;
    if (G.drag) {
      const tgt = dropTarget(G.drag), pc = G.tray[G.drag.slot];
      if (tgt && !tgt.compost && pc) {
        ghost = { tgt, pc };
        if (tgt.ok) {
          const b = G.board.slice();
          for (const [cx, cy] of pc.p.cells) b[idx(tgt.x + cx, tgt.y + cy)] = { k: "plant" };
          clears = findClears(b).cells;
        }
      }
    }
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const c = G.board[idx(x, y)];
      if (!c) continue;
      const age = st.time - G.bornAt[idx(x, y)];
      if (age < 0) continue;
      const drop = age < 0.18 ? -(1 - age / 0.18) * 9 : age < 0.3 ? Math.sin((age - 0.18) / 0.12 * Math.PI) * 1.6 : 0;
      cell3d(c, cellX(x), cellY(y) + drop, CELL);
    }
    if (clears && clears.size) {
      const a = 0.28 + Math.sin(st.time * 10) * 0.12;
      for (const k of clears) { rr(cellX(k % 9) + 1, cellY(Math.floor(k / 9)) + 1, CELL - 2, CELL - 2, 6); ctx.fillStyle = `rgba(255,250,225,${a})`; ctx.fill(); }
    }
    if (ghost && ghost.tgt.ok) for (const [cx, cy] of ghost.pc.p.cells) {
      const X = ghost.tgt.x + cx, Y = ghost.tgt.y + cy;
      if (X >= 0 && Y >= 0 && X < 9 && Y < 9) cell3d({ k: "plant", sp: ghost.pc.sp, age: 3 }, cellX(X), cellY(Y), CELL, 0.45);
    }
    for (const f of st.fx) {
      const c = { k: "plant", sp: f.sp, age: f.stage === 2 ? 7 : 3 };
      if (f.t < 0) { cell3d(c, f.x, f.y, CELL); continue; }
      const k = f.t / 0.55, sc = 1 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35, sz = CELL * sc;
      cell3d(c, f.x + CELL / 2 - sz / 2, f.y + CELL / 2 - sz / 2, sz, Math.max(0, 1 - k * k));
    }
    ctx.restore();
  }

  function drawPiece(pc, cx, cy, size, imgPrefix) {
    const w = pc.p.wd * size, h = pc.p.ht * size;
    const cells = pc.p.cells.slice().sort((a, b) => a[1] - b[1]);
    if (SOFT()) { for (const [x, y] of cells) cell3d({ k: "plant", sp: pc.sp, age: 3 }, cx - w / 2 + x * size, cy - h / 2 + y * size, size); return; }
    for (const [x, y] of cells) tile(imgPrefix(pc), cx - w / 2 + x * size, cy - h / 2 + y * size, size);
  }
  function drawTray() {
    // soft panel behind the tray
    if (SOFT()) { rr(4, TY - 2, W - 8, 80, 10); ctx.fillStyle = "rgba(20,30,24,0.42)"; ctx.fill(); }
    else { ctx.fillStyle = "rgba(31,22,34,0.5)"; ctx.fillRect(4, TY - 2, W - 8, 80); }
    for (let s = 0; s < 3; s++) {
      const pc = G.tray[s];
      const cx = slotX(s), cy = TY + 39;
      if (SOFT()) { rr(cx - 37, TY + 2, 74, 72, 8); ctx.fillStyle = "rgba(255,250,240,0.13)"; ctx.fill(); }
      else rect(cx - 37, TY + 2, 74, 72, "rgba(244,236,217,0.24)");
      if (!pc || (G.drag && G.drag.slot === s)) continue;
      const fits = fitsAnywhere(pc);
      ctx.globalAlpha = fits ? 1 : 0.4;
      drawPiece(pc, cx, cy, MINI + 2, (p) => `p_${p.sp}_1`);
      ctx.globalAlpha = 1;
    }
    // bottom bar: compost + deep breath
    const cr = compostRect();
    const hot = G.drag && G.drag.type === "user" && dropTarget(G.drag)?.compost;
    nine(hot ? "btn_gold" : "btn_wood", cr.x, cr.y, cr.w, cr.h);
    img("i_compost", cr.x + 6, cr.y + 4);
    for (let i = 0; i < 3; i++) img(i < G.compost ? "i_leaf" : "i_star_off", cr.x + 22 + i * 15, cr.y + 4, 13, 13);
    // rain booster
    button(cr.x + cr.w + 4, cr.y, 46, 24, String(save.rainB), () => {
      if (st.demo || G.over) return;
      if (save.rainB > 0) { save.rainB--; persist(); rain(); } else toast(t("noRain"));
    }, { skin: save.rainB > 0 ? "btn_green" : "btn_stone", size: 9, icon: "i_rain" });
    // breath button (hold)
    const bx = W - 104, by = cr.y;
    const used = (G.breathUsed && !save.breathB) || !G.history;
    button(bx, by, 94, 24, t("breathe"), () => {
      if (G.breathUsed && !save.breathB) toast(t("breatheUsed")); else if (!G.history) toast(t("breatheNone")); else startBreath();
    }, { skin: used ? "btn_stone" : "btn_pink", size: 7, icon: "i_breath" });
    // the dragged piece follows the finger at full size
    if (G.drag) {
      const pc = G.tray[G.drag.slot];
      if (pc) {
        const x = G.drag.x + G.drag.ox, y = G.drag.y + G.drag.oy;
        ctx.globalAlpha = 0.95;
        drawPiece(pc, x, y, CELL, (p) => `p_${p.sp}_1`);
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBees(dt) {
    for (const b of st.bees) {
      b.t += dt;
      let tx, ty;
      if (b.target >= 0 && !b.leave) { tx = cellX(b.target % 9) + 12; ty = cellY(Math.floor(b.target / 9)) + 6; }
      else { tx = b.x < W / 2 ? -20 : W + 20; ty = b.y - 30; }
      const k = Math.min(1, dt * 3.2);
      b.x += (tx - b.x) * k + Math.sin(st.time * 9 + b.ph) * 0.6;
      b.y += (ty - b.y) * k + Math.cos(st.time * 7 + b.ph) * 0.6;
      if (!b.leave && b.t > b.dur) {
        const c = G && G.board[b.target];
        if (c && c.k === "plant") { c.age += 3; sparks(tx, ty + 6, 6, COL.gold); }
        b.leave = true; b.t = 0;
      }
      if (SOFT()) bee3(b.x, b.y, b.ph); else img("bee_" + (Math.floor(st.time * 14 + b.ph) % 2), b.x - 5, b.y - 4);
    }
    st.bees = st.bees.filter((b) => !(b.leave && b.t > 1.4));
  }
  function drawRain(dt) {
    if (!st.rainT || st.rainT <= 0) return;
    st.rainT -= dt;
    ctx.fillStyle = "rgba(61,90,150,0.12)";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#bde0f8";
    for (const d of st.drops) {
      d.y += d.v * dt; d.x -= d.v * 0.15 * dt;
      if (d.y > H) { d.y = -10; d.x = Math.random() * (W + 40); }
      if (SOFT()) { ctx.fillRect(d.x, d.y, 0.6, 5); } else ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
    }
  }

  function drawPlay(dt) {
    drawBg(L.BIOMES[G.zen ? 0 : G.lv.biome].key);
    drawRain(dt);
    drawHud();
    drawBoard();
    drawTray();
    drawBees(dt);
    drawParts();
    drawTutorial(dt);
    if (st.toast) {
      const a = Math.min(1, (st.toast.dur - st.toast.t) * 3);
      ctx.globalAlpha = a;
      const lines = wrap(st.toast.str, 200, 8);
      nine("panel", W / 2 - 110, BY + 96, 220, 18 + lines.length * 10);
      lines.forEach((l, i) => text(l, W / 2, BY + 108 + i * 10, 8, COL.brown, "center", null));
      ctx.globalAlpha = 1;
    }
    if (G.breath) drawBreath(dt);
    if (st.demo) {
      text(t("demo"), W / 2, BB + 38 > H - 6 ? H - 8 : BB + 38, 8, COL.gold);
    }
    if (G.over) drawOver(dt);
  }

  // Deep breath: a short guided breath with the heroine. Three counts in, three counts out, then the last move is undone.
  const BREATH_IN = 3, BREATH_OUT = 3;
  function startBreath() { G.breath = { t: 0 }; A.sfx.breathe(true); }
  function drawBreath(dt) {
    G.breath.t += dt;
    const T = G.breath.t, D = BREATH_IN + BREATH_OUT;
    const inhale = T < BREATH_IN;
    const ph = inhale ? T / BREATH_IN : 1 - (T - BREATH_IN) / BREATH_OUT;      // 0 empty .. 1 full
    const k = ph * ph * (3 - 2 * ph);
    const fade = Math.min(1, T * 3, (D - T) * 3 + 0.2);
    ctx.fillStyle = `rgba(16,26,48,${0.72 * fade})`;
    ctx.fillRect(0, 0, W, H);
    const cx = W / 2, cy = Math.round(H * 0.45);
    // soft rings that swell with the breath
    for (let i = 3; i >= 0; i--) {
      const r = 34 + k * 46 + i * 9;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(189,224,248,${(0.08 + (3 - i) * 0.05) * fade})`; ctx.fill();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 34 + k * 46, 0, Math.PI * 2);
    ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(236,246,255,${0.9 * fade})`; ctx.stroke();
    // petals drift in while breathing in, out while breathing out
    for (let i = 0; i < 14; i++) {
      const a = i * 0.45 + T * 0.25, r = 34 + k * 46 + 10 + (inhale ? 1 - (T * 0.6 + i * 0.13) % 1 : (T * 0.6 + i * 0.13) % 1) * 46;
      ctx.fillStyle = ["#f19cbd", "#f5d14f", "#b39ce3", "#fffaf0"][i % 4];
      ctx.globalAlpha = 0.8 * fade;
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.6, 1, a, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = fade;
    // the heroine in her yoga pose: she rises and widens a little as her chest fills
    // the heroine sits and breathes: chest relaxed, then lifted as it fills
    const im = SOFT() ? P3(k > 0.45 ? "h_in" : "h_out") : (k > 0.45 ? IMG.hero_breathe_1 : IMG.hero_breathe_0);
    if (im && im.naturalWidth) {
      const hb = SOFT() ? 92 : 84;
      const h = hb * (1 + k * 0.03), w = im.naturalWidth / im.naturalHeight * hb * (1 + k * 0.02);
      ctx.drawImage(im, Math.round(cx - w / 2), Math.round(cy + 40 - h - k * 2), Math.round(w), Math.round(h));
    }
    ctx.globalAlpha = 1;
    const left = Math.max(1, Math.ceil(inhale ? BREATH_IN - T : D - T));
    text(inhale ? t("breatheIn") : t("breatheOut"), cx, cy - 104, 14, COL.cream);
    text(String(left), cx, cy + 66, 22, COL.gold);
    text(t("breatheCancel"), cx, H - 30, 7, "rgba(255,250,240,0.7)", "center", null);
    if (!inhale && T - dt < BREATH_IN) A.sfx.breathe(false);
    if (Math.ceil(T) !== Math.ceil(T - dt) && T < D) A.sfx.tap();
    if (T >= D) { G.breath = null; deepBreath(); }
  }

  function drawTutorial(dt) {
    if (!G || G.tut < 0 || st.demo) return;
    G.tutT += dt;
    let msg = null;
    if (G.tut === 0) msg = t("tut1");
    else if (G.tut === 1) msg = t("tut2");
    else if (G.tut === 2) { msg = t("tut3"); if (G.tutT > 3.5) { G.tut = 3; G.tutT = 0; } }
    else if (G.tut === 3) { msg = t("tut4"); if (G.tutT > 4) { G.tut = -1; } }
    if (!msg) return;
    const lines = wrap(msg, 190, 8);
    const y = G.tut === 0 ? TY - 30 : BY - 2 + BOARD - 30;
    nine("panel", W / 2 - 105, y - 4, 210, 12 + lines.length * 10);
    lines.forEach((l, i) => text(l, W / 2, y + 6 + i * 10, 8, COL.brown, "center", null));
    // animated hand hint from tray to board
    if (G.tut === 0 && !G.drag) {
      const k = (st.time % 2) / 2, e = k < 0.7 ? (k / 0.7) : 1;
      const sx = slotX(0), sy = TY + 40, tx = W / 2, ty = BY + 120;
      const x = sx + (tx - sx) * e, y2 = sy + (ty - sy) * e;
      ctx.globalAlpha = k < 0.85 ? 1 : (1 - (k - 0.85) / 0.15);
      ctx.fillStyle = COL.cream;
      ctx.beginPath(); ctx.arc(x, y2, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // ---------- win / lose overlays
  function drawOver(dt) {
    G.overT += dt;
    if (st.demo) return;
    if (G.over === "win") {
      // count left-over moves into bonus points first
      if (G.bonusStart === undefined) G.bonusStart = G.moves;
      if (G.overT > 0.8 && G.moves > 0 && G.tick === undefined) G.tick = 0;
      if (G.tick !== undefined && G.moves > 0) {
        G.tick += dt;
        if (G.tick > Math.min(0.09, 1.4 / Math.max(1, G.bonusStart)) || G.skip) {
          G.tick = 0; G.moves--; G.score += 50;
          A.sfx.bloom(0);
          const x = 20 + Math.random() * (W - 40), y = BY + 20 + Math.random() * 200;
          petals(x, y, G.lv.species[Math.floor(Math.random() * G.lv.species.length)], 6);
        }
        return;
      }
      if (G.overT < 1) return;
      if (!G.finished) { G.finished = true; finishWin(); G.starT = 0; }
      G.starT += dt;
      overlayPanel(t("win"), t("winSub"), 156);
      const cy = H / 2 - 30;
      for (let i = 0; i < 3; i++) {
        const on = i < G.stars && G.starT > 0.3 + i * 0.35;
        if (on && !G["s" + i]) { G["s" + i] = true; A.sfx.star(i); sparks(W / 2 - 36 + i * 36, cy + 11, 12); }
        img(on ? "star_big" : "star_big_off", W / 2 - 47 + i * 36, cy);
      }
      text(`${t("score")} ${G.score}`, W / 2 - 30, cy + 38, 10, COL.brown, "center", null);
      img("i_seed", W / 2 + 22, cy + 31);
      text("+" + (G.seedsWon || 0), W / 2 + 50, cy + 38, 10, "#B9781C", "center", null);
      const summit = G.lv.summit;
      button(W / 2 - 100, cy + 56, 96, 26, t("map"), () => { enterJourney(false); }, { skin: "btn_wood", size: 9, icon: "i_map" });
      button(W / 2 + 4, cy + 56, 96, 26, t("next"), () => {
        if (G.advanced) enterJourney(true); else newGame(Math.min(save.unlocked, G.n + 1));
      }, { skin: "btn_green", size: 9, icon: "i_play" });
      return;
    }
    if (G.overT < 0.7) return;
    if (G.over === "zen") {
      overlayPanel(t("zenOver"), G.newBest ? t("newBest") : `${t("best")} ${save.zenBest}`, 150);
      const cy = H / 2 - 30;
      text(`${t("score")} ${G.score}`, W / 2, cy + 14, 14, COL.brown, "center", null);
      button(W / 2 - 100, cy + 50, 96, 26, t("home"), () => { st.mode = "title"; G = null; }, { skin: "btn_wood", size: 9, icon: "i_home" });
      button(W / 2 + 4, cy + 50, 96, 26, t("retry"), () => newGame(0, { zen: true }), { skin: "btn_green", size: 9, icon: "i_retry" });
      return;
    }
    const canBreathe = !G.breathUsed && G.history && G.over === "full";
    overlayPanel(G.over === "moves" ? t("loseMoves") : t("lose"), t("loseSub"), canBreathe ? 172 : G.over === "moves" ? 158 : 128);
    const cy = H / 2 - 30;
    let y = cy + 6;
    if (!G.breathUsed && G.history && G.over === "full") {
      button(W / 2 - 70, y, 140, 26, t("breathe"), () => startBreath(), { skin: "btn_pink", size: 8, icon: "i_breath" });
      text(t("breatheHold"), W / 2, y + 34, 7, "#4E6656", "center", null);
      y += 44;
    }
    if (G.over === "moves") {
      button(W / 2 - 70, y, 140, 26, `${t("moreMoves")} · ${PRICE.moves}`, () => {
        if (spend(PRICE.moves)) { G.moves += 5; G.over = null; }
      }, { skin: save.seeds >= PRICE.moves ? "btn_gold" : "btn_stone", size: 9, icon: "i_seed" });
      y += 30;
    }
    button(W / 2 - 100, y + 6, 96, 26, t("map"), () => { enterJourney(false); }, { skin: "btn_wood", size: 9, icon: "i_map" });
    button(W / 2 + 4, y + 6, 96, 26, t("retry"), () => newGame(G.n), { skin: "btn_green", size: 9, icon: "i_retry" });
  }
  function overlayPanel(title, sub, ph = 150) {
    ctx.fillStyle = "rgba(31,22,34,0.45)";
    ctx.fillRect(0, 0, W, H);
    nine("panel", 16, H / 2 - 92, W - 32, ph);
    // the heroine reacts on top of the card
    if (SOFT()) {
      if (G.over === "win") drawHero("h_jump", W / 2, H / 2 - 90, 92, false);
      else drawHero("h_tired", W / 2, H / 2 - 90, 80, false);
    } else if (G.over === "win") imgH("hero_jump", W / 2 - 32, H / 2 - 92 - 74 - Math.abs(Math.sin(st.time * 5)) * 10, 78);
    else imgH("hero_tired", W / 2 - 40, H / 2 - 92 - 50, 56);
    text(title, W / 2, H / 2 - 72, 15, "#1E3A2B", "center", null);
    text(sub, W / 2, H / 2 - 54, 8, "#4E6656", "center", null);
  }

  // ---------- pause / settings
  function drawSettings() {
    ctx.fillStyle = "rgba(31,22,34,0.5)";
    ctx.fillRect(0, 0, W, H);
    const inPlay = st.mode === "play" && G && !G.over && !st.demo;
    const ph = inPlay ? 252 : 196;
    const py = H / 2 - ph / 2;
    nine("panel", 20, py, W - 40, ph);
    text(inPlay ? t("paused") : t("settings"), W / 2, py + 18, 13, COL.brown, "center", null);
    iconButton(W - 46, py + 6, "i_close", () => { st.settings = false; st.paused = false; });
    let y = py + 36;
    const row = (label, val, on) => {
      text(label, 36, y + 10, 8, COL.brown, "left", null);
      button(W - 100, y, 64, 20, val ? t("on") : t("off"), on, { skin: val ? "btn_green" : "btn_stone", size: 8 });
      y += 26;
    };
    row(t("music"), save.music, () => { save.music = !save.music; A.setMusic(save.music); persist(); });
    row(t("sound"), save.sound, () => { save.sound = !save.sound; A.setSound(save.sound); persist(); });
    row(t("vibration"), save.vib, () => { save.vib = !save.vib; persist(); vib(20); });
    text(t("language"), 36, y + 10, 8, COL.brown, "left", null);
    button(W - 100, y, 64, 20, save.lang === "sr" ? "SRPSKI" : "ENGLISH", () => { save.lang = save.lang === "sr" ? "en" : "sr"; persist(); }, { skin: "btn_wood", size: 7 });
    y += 26;
    y += 4;
    if (inPlay) {
      button(36, y, W - 72, 24, t("resume"), () => { st.settings = false; st.paused = false; }, { skin: "btn_green", size: 9, icon: "i_play" });
      y += 28;
      button(36, y, (W - 76) / 2, 24, t("retry"), () => { st.settings = false; newGame(G.n, { zen: G.zen }); }, { skin: "btn_wood", size: 8, icon: "i_retry" });
      button(40 + (W - 76) / 2, y, (W - 76) / 2, 24, G.zen ? t("home") : t("map"), () => {
        st.settings = false; st.paused = false;
        if (G.zen) { st.mode = "title"; G = null; } else { enterJourney(false); }
      }, { skin: "btn_wood", size: 8, icon: G.zen ? "i_home" : "i_map" });
      y += 30;
    }
    const armed = st.resetArm > st.time;
    button(36, y, W - 72, 20, armed ? t("resetSure") : t("reset"), () => {
      if (armed) { const lang = save.lang; Object.assign(save, { unlocked: 1, stars: {}, zenBest: 0, tutDone: false, lang }); persist(); st.resetArm = 0; st.settings = false; st.mode = "title"; G = null; }
      else st.resetArm = st.time + 3;
    }, { skin: "btn_red", size: 7 });
  }

  // ---------- help with animated mini videos
  function drawHelp(dt) {
    st.help.t += dt;
    ctx.fillStyle = "rgba(31,22,34,0.55)";
    ctx.fillRect(0, 0, W, H);
    const pages = I18N[save.lang].helpPages;
    const pg = pages[st.help.page];
    const px = 8, pw = W - 16;
    // measure the text first so the card hugs its content
    const sections = [pg.what, pg.how, pg.watch].map((x) => wrap(x, pw - 36, 7));
    const textH = sections.reduce((a, l) => a + 14 + l.length * 9, 0);
    const ph = Math.min(H - 16, 42 + 112 + 12 + textH + 44), py = Math.round((H - ph) / 2);
    nine("panel", px, py, pw, ph);
    text(`${t("help")} · ${st.help.page + 1}/${pages.length}`, W / 2, py + 14, 7, "#4E6656", "center", null);
    text(pg.title, W / 2, py + 28, 13, "#1E3A2B", "center", null);
    iconButton(px + pw - 26, py + 6, "i_close", closeHelp);
    // video
    const vx = px + 14, vy = py + 42, vw = pw - 28, vh = 112;
    ctx.save();
    ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    helpVideo(st.help.page, vx, vy, vw, vh, st.help.t);
    ctx.restore();
    ctx.strokeStyle = "#673d27"; ctx.lineWidth = 1; ctx.strokeRect(vx + 0.5, vy + 0.5, vw - 1, vh - 1);
    // text sections
    let y = vy + vh + 12;
    const labels = save.lang === "sr" ? ["ŠTA", "KAKO", "PAZI"] : ["WHAT", "HOW", "WATCH"];
    const cols = ["#2A6A1E", "#bf5a1d", "#1E3A2B"];
    sections.forEach((lines, i) => {
      text(labels[i], px + 16, y, 7, cols[i], "left", null);
      y += 10;
      lines.forEach((l) => { text(l, px + 16, y, 7, "#4a2b1e", "left", null); y += 9; });
      y += 4;
    });
    // nav
    const by = py + ph - 30;
    if (st.help.page > 0) button(px + 12, by, 34, 22, "‹", () => { st.help.page--; st.help.t = 0; }, { skin: "btn_wood", size: 12 });
    if (st.help.page < pages.length - 1) button(px + pw - 46, by, 34, 22, "›", () => { st.help.page++; st.help.t = 0; }, { skin: "btn_wood", size: 12 });
    if (st.mode === "title" || st.mode === "map") button(W / 2 - 34, by, 68, 22, t("playDemo"), () => startDemo(), { skin: "btn_pink", size: 8 });
    else button(W / 2 - 34, by, 68, 22, t("close"), closeHelp, { skin: "btn_green", size: 8 });
    // page dots
    for (let i = 0; i < pages.length; i++) rect(W / 2 - pages.length * 4 + i * 8, by - 8, 4, 3, i === st.help.page ? "#bf5a1d" : "#c2b199");
  }

  // mini board for the help videos: n×m cells at size s
  function miniCell(x, y, s, v) {
    if (SOFT()) { fillRR(x + 0.6, y + 0.6, s - 1.2, s - 1.2, s * 0.22, v ? "rgba(255,250,240,0.2)" : "rgba(255,250,240,0.12)"); return; } rect(x, y, s, s, v ? "#4a8442" : "#5a9a48"); rect(x, y, s, 1, "rgba(255,250,240,0.18)"); rect(x, y, 1, s, "rgba(255,250,240,0.18)"); }
  function helpVideo(page, x, y, w, h, T) {
    if (SOFT()) fillRR(x, y, w, h, 8, "#2f5a3c"); else rect(x, y, w, h, "#264a30");
    const s = page === 0 ? 16 : 22;
    const gx = x + Math.round((w - (page === 0 ? 6 : 9) * s) / 2), gy = y + 8;
    const grid = (cols, rows) => { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) miniCell(gx + i * s, gy + j * s, s, (Math.floor(i / 3) + Math.floor(j / 3)) % 2); };
    const tile = (name, i, j, sz = s, ox = 0, oy = 0) => img(name, gx + i * s + ox, gy + j * s + oy, sz, sz);
    const loop = (d) => T % d;
    if (page === 0) {
      grid(6, 6);
      const k = loop(3) / 3;
      const e = Math.min(1, k / 0.6);
      const ee = e * e * (3 - 2 * e);
      const sx = x + w - 40, sy = y + h - 26, tx = gx + 2 * s, ty = gy + 3 * s;
      const px = sx + (tx - sx) * ee, py = sy + (ty - sy) * ee;
      // L piece
      for (const [a, b] of [[0, 0], [0, 1], [1, 1]]) img(k < 0.62 ? "p_cosmos_0" : "p_cosmos_0", px + a * s, py + b * s, s, s);
      if (k < 0.62) { ctx.fillStyle = COL.cream; ctx.beginPath(); ctx.arc(px + 10, py + 22, 5, 0, 7); ctx.fill(); }
      text("→", x + w - 70, y + h - 20, 12, COL.gold);
      img("m_daisy_1", x + w - 30, y + 10); img("m_poppy_1", x + w - 30, y + 28);
    } else if (page === 1) {
      grid(9, 4);
      const k = loop(3.2) / 3.2;
      for (let i = 0; i < 9; i++) {
        if (i === 5 && k < 0.35) continue;
        if (k > 0.55) continue;
        tile(`p_${["daisy", "poppy", "cosmos"][i % 3]}_1`, i, 2);
      }
      if (k >= 0.35 && k < 0.55) { ctx.fillStyle = "rgba(245,209,79,0.45)"; ctx.fillRect(gx, gy + 2 * s, 9 * s, s); }
      if (k > 0.55 && k < 0.6 && !st.help.burst) { st.help.burst = true; for (let i = 0; i < 9; i++) petals(gx + i * s + 8, gy + 2 * s + 8, ["daisy", "poppy", "cosmos"][i % 3], 4); A.sfx.chime(); }
      if (k < 0.5) st.help.burst = false;
      tile("p_lavender_1", 1, 1); tile("p_lavender_1", 6, 3);
    } else if (page === 2) {
      grid(9, 4);
      const k = Math.floor(loop(3.6) / 1.2);
      ["lavender", "poppy", "sunflower", "cornflower", "marigold"].forEach((sp, i) => {
        img(`p_${sp}_${k}`, gx + 8 + i * 30, gy + 20, 24, 24);
      });
      text(["1", "2", "3"][k] + "/3", x + w / 2, y + h - 14, 9, COL.gold);
      text(["10", "20", "35"][k], x + w - 24, y + h - 14, 9, COL.cream);
    } else if (page === 3) {
      nine("panel", x + 10, y + 14, w - 20, 40);
      const k = Math.floor(loop(4) * 3);
      img("m_lavender_1", x + 22, y + 27);
      text(String(Math.max(0, 8 - k)), x + 52, y + 34, 10, COL.brown, "center", null);
      img("stone", x + 70, y + 24, 18, 18);
      text(String(Math.max(0, 3 - Math.floor(k / 3))), x + 98, y + 34, 10, COL.brown, "center", null);
      nine("btn_plate", x + w - 66, y + 24, 46, 20);
      img("i_moves", x + w - 62, y + 26);
      text(String(14 - k), x + w - 36, y + 34, 10, COL.cream);
      for (let i = 0; i < 3; i++) img(i < 1 + Math.floor(loop(4) / 1.4) ? "star_big" : "star_big_off", x + w / 2 - 40 + i * 28, y + 66);
    } else if (page === 4) {
      grid(9, 4);
      tile("stone", 1, 1); tile("plastic", 4, 2); tile("mushroom", 7, 1);
      const k = Math.floor(loop(4) / 1);
      tile("weed_" + (Math.floor(T * 2) % 2), 3, 0);
      if (k >= 1) tile("weed_" + (Math.floor(T * 2 + 1) % 2), 4, 0);
      if (k >= 2) tile("weed_" + (Math.floor(T * 2) % 2), 4, 1);
      if (k >= 3) tile("weed_" + (Math.floor(T * 2 + 1) % 2), 5, 1);
      text("+2", gx + 7 * s + 8, gy + s - 4 - (T * 10) % 10, 8, COL.pink);
    } else if (page === 5) {
      grid(9, 4);
      const k = loop(4) / 4;
      for (let i = 0; i < 9; i++) for (let j = 1; j < 4; j += 2) tile(`p_${["cosmos", "daisy", "marigold"][(i + j) % 3]}_${k > 0.45 ? 2 : 0}`, i, j);
      if (k > 0.2 && k < 0.6) {
        ctx.fillStyle = "#bde0f8";
        for (let i = 0; i < 30; i++) { const dx = (i * 37) % w, dy = ((i * 53) + T * 160) % h; ctx.fillRect(x + dx, y + dy, 1, 4); }
        text(t("rain"), x + w / 2, y + 14, 12, COL.sky);
      }
      const bx = x + 20 + ((T * 50) % (w - 40)), byy = y + 50 + Math.sin(T * 6) * 8;
      img("bee_" + (Math.floor(T * 14) % 2), bx, byy);
    } else if (page === 6) {
      const k = loop(5) / 5;
      // compost
      nine("btn_wood", x + 12, y + h - 36, 78, 24);
      img("i_compost", x + 18, y + h - 32);
      for (let i = 0; i < 3; i++) img(i < (k < 0.4 ? 3 : 2) ? "i_leaf" : "i_star_off", x + 36 + i * 15, y + h - 32, 13, 13);
      if (k < 0.4) {
        const e = k / 0.4;
        for (const [a, b] of [[0, 0], [1, 0], [2, 0]]) img("m_poppy_1", x + 30 + a * 14, y + 14 + e * (h - 56) + b * 14);
      }
      // breath circle
      const bk = (T % 2.4) / 2.4;
      const r = 10 + (bk < 0.5 ? bk * 2 : 2 - bk * 2) * 22;
      ctx.beginPath(); ctx.arc(x + w - 56, y + h / 2, r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(189,224,248,0.4)"; ctx.fill(); ctx.strokeStyle = "#bde0f8"; ctx.lineWidth = 2; ctx.stroke();
      img("i_breath", x + w - 62, y + h / 2 - 7);
    } else if (page === 7) {
      for (let i = 0; i < 3; i++) { img("i_seed", x + 40 + i * 60, y + 30 - ((T * 20 + i * 9) % 18)); text("+" + [15, 30, 150][i], x + 46 + i * 60, y + 56, 9, COL.gold); }
      img("i_tasks", x + 40, y + 78); img("i_gift", x + 100, y + 78); img("i_shop", x + 160, y + 78);
    } else if (page === 8) {
      if (SOFT()) {            // a little loop of the journey: she walks the valley trail
        const M = mountainOf(0), im = sceneImg(M, 1);
        ctx.save(); rrc(ctx, x, y, w, h, 8); ctx.clip();
        if (im) {
          const sc = w / im.naturalWidth, oy = y - im.naturalHeight * sc * 0.45;
          ctx.drawImage(im, x, oy, w, im.naturalHeight * sc);
          const u = 0.15 + (T * 0.09) % 0.6, pp = trailAt(M, 1, u);
          const hx = x + pp.x * w, hy = oy + pp.y * im.naturalHeight * sc, hh = heroH(M, 1, pp.y) * im.naturalHeight * sc;
          drawHero("h_back_" + (Math.floor(T * 3.6) % 2), hx, hy, hh, false);
        }
        ctx.restore();
        return;
      }
      ctx.drawImage(IMG.bg_alpine, 0, 300, 504, Math.round(504 * h / w), x, y, w, h);
      for (let i = 0; i < 4; i++) img(i < 2 ? "sign_done" : i === 2 ? "sign_current" : "sign_locked", x + 16 + i * 44, y + h - 30 - i * 18);
      img("flag", x + w - 34, y + 8);
      const hx = x + 16 + ((T * 20) % 130), hy = y + h - 40 - ((T * 20) % 130) * 0.4;
      imgH("hero_walk_" + (Math.floor(T * 5) % 4), hx + 10, hy - 18, 32);
    }
  }

  // ---------------------------------------------------------------- loop
  // pixel-art names still used by older screens, drawn with the 3D art instead
  const HERO3 = { hero_front: "h_front", hero_yoga: "h_out", hero_jump: "h_jump", hero_tired: "h_tired", hero_breathe_0: "h_out", hero_breathe_1: "h_in",
    hero_walk_0: "h_walk_0", hero_walk_1: "h_walk_1", hero_walk_2: "h_walk_2", hero_walk_3: "h_walk_3" };
  const OBST3 = { stone: "stone", stone_cracked: "stone2", plastic: "plastic", mushroom: "mush", weed_0: "weed", weed_1: "weed" };
  function soft3dImg(name, x, y, w, h) {
    let m;
    if ((m = /^p_(\w+)_(\d)$/.exec(name))) { cell3d({ k: "plant", sp: m[1], age: [0, 3, 7][+m[2]] }, x, y, w || 16); return true; }
    if (OBST3[name]) { cell3d({ k: OBST3[name] }, x, y, w || 16); return true; }
    if (HERO3[name]) { spriteIn(HERO3[name], x, y, w || 40, h || 60); return true; }
    if (name.startsWith("bee_")) { bee3(x + 5, y + 4, 0); return true; }
    if (name === "flag") { spriteIn("flag_" + (Math.floor(st.time * 6) % 4), x, y, w || 16, h || 24); return true; }
    if (name.startsWith("fly_") || name.startsWith("bg_")) return true;
    return false;
  }

  // ================================================================ soft 3D layer
  // Everything below draws the "animated film" look: textured earth clods with generated plants, vector UI,
  // and the journey up each mountain through its six scenes.
  const C3 = {
    ink: "#1E3A2B", muted: "#4E6656", surf: "#EEF3E6", white: "#FFFFFF", edge: "#C5D3B4", acc: "#3E8F2C", acce: "#2A6A1E",
    amber: "#F2B64B", amberE: "#B9781C", red: "#C2412F", redE: "#8E2C1F", stone: "#DCE3D3", stoneE: "#B9C6AD", sky: "#2F6FA8",
  };
  const TR = window.TRAILS;
  COL.brown = C3.ink; COL.gold = "#F2B64B";
  const CUM = TR.perScene.reduce((a, n) => (a.push(a[a.length - 1] + n), a), [0]);   // [0,3,7,11,14,17,20]
  const IMG3 = {};
  function im3(file) {             // lazy loader for assets/3d
    let im = IMG3[file];
    if (!im) { im = new Image(); im.src = `assets/3d/${file}`; IMG3[file] = im; }
    return im.complete && im.naturalWidth ? im : null;
  }
  const P3 = (n) => im3(n + ".png");
  // warm up the files every screen needs
  ["tex_grass.jpg", "tex_soil.jpg"].forEach(im3);
  for (const sp of L.SPECIES) for (let s = 0; s < 3; s++) P3(`p3_${sp}_${s}`);
  ["stone", "stone2", "weed", "plastic", "mush"].forEach((n) => P3("o3_" + n));
  ["front", "back", "sideL", "sideR", "q_front", "wave", "sit", "tired", "jump", "win", "in", "out", "look", "drink"].forEach((n) => P3("h_" + n));
  for (let i = 0; i < 4; i++) { P3("h_back_" + i); P3("h_qback_" + i); P3("h_walk_" + i); P3("flag_" + i); }

  function rrc(c, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fillRR(x, y, w, h, r, col) { rrc(ctx, x, y, w, h, r); ctx.fillStyle = col; ctx.fill(); }

  // ---------- icons (Tabler outline paths, 24px grid)
  const ICON_D = {
    pause: "M6 5h4v14h-4z M14 5h4v14h-4z",
    play: "M7 4v16l13-8z",
    sound: "M15 8a5 5 0 0 1 0 8 M17.7 5a9 9 0 0 1 0 14 M6 15h-2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5a.8.8 0 0 1 1.5.5v14a.8.8 0 0 1-1.5.5l-3.5-4.5",
    mute: "M6 15h-2a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5a.8.8 0 0 1 1.5.5v14a.8.8 0 0 1-1.5.5l-3.5-4.5 M16 10l4 4m0-4l-4 4",
    music: "M3 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M13 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0 M9 17V4h10v13 M9 8h10",
    gear: "M14 6a2 2 0 1 0-4 0a2 2 0 1 0 4 0 M4 6h6 M14 6h6 M10 12a2 2 0 1 0-4 0a2 2 0 1 0 4 0 M4 12h2 M10 12h10 M19 18a2 2 0 1 0-4 0a2 2 0 1 0 4 0 M4 18h11 M19 18h1",
    home: "M5 12H3l9-9 9 9h-2 M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7 M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6",
    retry: "M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4 M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4",
    map: "M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7 M9 4v13 M15 7v13",
    close: "M18 6L6 18 M6 6l12 12",
    breath: "M5 8h8.5a2.5 2.5 0 1 0-2.34-3.24 M3 12h15.5a2.5 2.5 0 1 1-2.34 3.24 M4 16h5.5a2.5 2.5 0 1 1-2.34 3.24",
    compost: "M12 17l-2 2l2 2 M10 19h9a2 2 0 0 0 1.75-2.75l-.55-1 M8.536 11l-.732-2.732L5.072 9 M7.804 8.268l-4.5 7.794a2 2 0 0 0 1.506 2.89l1.141.024 M15.464 11l2.732.732L18.928 9 M18.196 11.732l-4.5-7.794a2 2 0 0 0-3.256-.14l-.591.976",
    rain: "M7 18a4.6 4.4 0 0 1 0-9 5 4.5 0 0 1 11 2h1a3.5 3.5 0 0 1 0 7 M11 13v2m0 3v2m4-5v2m0 3v2",
    lock: "M5 13a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z M11 16a1 1 0 1 0 2 0a1 1 0 1 0-2 0 M8 11V7a4 4 0 1 1 8 0v4",
    leaf: "M5 21c.5-4.5 2.5-8 7-10 M9 18c6.218 0 10.5-3.288 11-12V4h-4.014c-9 0-11.986 4-12 9 0 1 0 3 2 5h3z",
    check: "M5 12l5 5L20 7",
    flower: "M12 3a3 3 0 0 1 3 3c0 .6-.2 1.2-.5 1.7A3 3 0 1 1 15 13.5a3 3 0 1 1-6 0A3 3 0 1 1 9.5 7.7 3 3 0 0 1 12 3z M12 10a1 1 0 1 0 0 2a1 1 0 1 0 0-2 M12 16v5",
    moves: "M13 4a1 1 0 1 0 0-2a1 1 0 1 0 0 2 M7 21l3-4 M16 21l-2-4-3-3 1-6 M6 12l2-3 4-1 3 3 3 1",
    lang: "M4 5h7 M9 3v2c0 4.418-2.239 8-5 8 M5 9c0 2.144 2.952 3.908 6.7 4 M12 20l4-9 4 9 M19.1 18h-6.2",
    seed: "M12 10a6 6 0 0 0-6-6H3v2a6 6 0 0 0 6 6h3 M12 14a6 6 0 0 1 6-6h3v1a6 6 0 0 1-6 6h-3 M12 20V10",
    gift: "M3 9a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M12 8v13 M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7 M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5",
    tasks: "M3.5 5.5l1.5 1.5 2.5-2.5 M3.5 11.5l1.5 1.5 2.5-2.5 M3.5 17.5l1.5 1.5 2.5-2.5 M11 6h9 M11 12h9 M11 18h9",
    shop: "M6.331 8h11.339a2 2 0 0 1 1.977 2.304l-1.255 8.152a3 3 0 0 1-2.966 2.544H8.574a3 3 0 0 1-2.965-2.544l-1.255-8.152A2 2 0 0 1 6.331 8z M9 11V6a3 3 0 0 1 6 0v5",
    help: "M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M12 17v.01 M12 13.5a1.5 1.5 0 0 1 1-1.5 2.6 2.6 0 1 0-3-4",
    flag: "M5 5a5 5 0 0 1 7 0 5 5 0 0 0 7 0v9a5 5 0 0 1-7 0 5 5 0 0 0-7 0V5z M5 21v-7",
    mountain: "M3 20h18L14 8l-3 5-2-3z M14 8l1.5-2.5L17 8",
  };
  const STAR_D = "M12 17.75l-6.172 3.245 1.179-6.873-5-4.867 6.9-1l3.086-6.253 3.086 6.253 6.9 1-5 4.867 1.179 6.873z";
  const PATHS = {};
  let ICON_COL = C3.ink;
  function drawIcon(n, x, y, size = 13, col = ICON_COL) {
    if (n === "star" || n === "star_off") { star3(x + size / 2, y + size / 2, size * 0.55, n === "star"); return; }
    const d = ICON_D[n];
    if (!d) return;
    const p = PATHS[n] || (PATHS[n] = new Path2D(d));
    ctx.save(); ctx.translate(x, y); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.strokeStyle = col; ctx.stroke(p);
    ctx.restore();
  }
  function star3(cx, cy, r, on) {
    const p = PATHS._star || (PATHS._star = new Path2D(STAR_D));
    ctx.save(); ctx.translate(cx - r, cy - r); ctx.scale(r / 12, r / 12);
    ctx.fillStyle = on ? "#F2B64B" : "rgba(30,58,43,0.18)"; ctx.fill(p);
    ctx.lineWidth = 1.4; ctx.lineJoin = "round"; ctx.strokeStyle = on ? "#B9781C" : "rgba(30,58,43,0.25)"; ctx.stroke(p);
    ctx.restore();
  }

  // ---------- buttons and panels
  const SKIN3 = {
    btn_green: [C3.acc, C3.acce, C3.white], btn_green_down: [C3.acc, C3.acce, C3.white], btn_red: [C3.red, C3.redE, C3.white],
    btn_gold: [C3.amber, C3.amberE, "#3A2A10"], btn_stone: [C3.stone, C3.stoneE, C3.muted], btn_pink: [C3.white, C3.edge, C3.ink],
  };
  function button3(x, y, w, h, label, on, opt) {
    const skin = opt.skin || "btn_green";
    const [fill, edge, ink] = SKIN3[skin] || [C3.surf, C3.edge, C3.ink];
    const pressed = st.press && st.press.x >= x && st.press.x <= x + w && st.press.y >= y && st.press.y <= y + h;
    const d = Math.max(2, Math.min(4, h * 0.11)), r = Math.min(9, h * 0.36), py = pressed ? d * 0.7 : 0;
    fillRR(x, y + d, w, h - d, r, edge);
    fillRR(x, y + py, w, h - d, r, fill);
    const cy = y + py + (h - d) / 2, size = opt.size || 8;
    ICON_COL = ink;
    if (opt.icon) {
      const iw = Math.min(14, h - d - 6);
      if (label) {
        setFont(size);
        const tw = ctx.measureText(label).width;
        const sx = x + w / 2 - (tw + iw + 4) / 2;
        drawIcon(opt.icon.slice(2), sx, cy - iw / 2, iw, ink);
        text(label, sx + iw + 4 + tw / 2, cy, size, ink, "center", null);
      } else drawIcon(opt.icon.slice(2), x + w / 2 - iw / 2, cy - iw / 2, iw, ink);
    } else if (label) text(label, x + w / 2, cy, size, ink, "center", null);
    ICON_COL = C3.ink;
    st.buttons.push({ x, y, w, h, on, hold: opt.hold });
  }
  function panel3(x, y, w, h) {
    ctx.save();
    ctx.shadowColor = "rgba(10,25,15,0.35)"; ctx.shadowBlur = 14; ctx.shadowOffsetY = 5;
    fillRR(x, y + 3, w, h, 14, C3.edge);
    ctx.restore();
    fillRR(x, y, w, h, 14, C3.surf);
  }
  function nine3(name, x, y, w, h) {
    if (name === "panel" || name === "panel_hud") panel3(x, y, w, h);
    else if (name === "ui_bar_empty") fillRR(x, y + 3, w, h - 6, (h - 6) / 2, "#D3DDC7");
    else if (name === "ui_bar_full") fillRR(x, y + 3, w, h - 6, (h - 6) / 2, C3.acc);
    else if (name === "ui_sign" || name === "ui_sign_small") fillRR(x, y, w, h, h / 2, "rgba(30,58,43,0.82)");
    else if (name === "btn_plate") fillRR(x, y, w, h, Math.min(h / 2, 9), C3.surf);
    else { const [f, e] = SKIN3[name] || [C3.surf, C3.edge]; fillRR(x, y + 2, w, h - 2, 8, e); fillRR(x, y, w, h - 2, 8, f); }
  }
  function pill(x, y, w, h, col = "rgba(30,58,43,0.82)") { fillRR(x, y, w, h, h / 2, col); }

  // ---------- earth clods
  const CLOD = {};
  function clodCanvas(px, variant, kind) {
    const key = px + "_" + variant + "_" + kind;
    if (CLOD[key]) return CLOD[key];
    const g = im3("tex_grass.jpg"), so = im3("tex_soil.jpg");
    if (!g || !so) return null;
    const c = document.createElement("canvas"); c.width = px; c.height = px;
    const x = c.getContext("2d");
    const x0 = px * 0.03, w = px * 0.94, y0 = px * 0.03, h = px * 0.94, top = px * 0.69, r = px * 0.17;
    const ox = (variant * 61) % 120, oy = (variant * 37) % 120;
    x.save(); rrc(x, x0, y0, w, h, r); x.clip();
    // soil front
    x.drawImage(so, ox, oy, 136, 50, x0, top - px * 0.04, w, y0 + h - top + px * 0.04);
    const sg = x.createLinearGradient(0, top, 0, y0 + h);
    sg.addColorStop(0, "rgba(20,10,5,0.05)"); sg.addColorStop(1, "rgba(20,10,5,0.45)");
    x.fillStyle = sg; x.fillRect(x0, top, w, y0 + h - top);
    // grass top
    x.drawImage(g, ox, oy, 136, 100, x0, y0, w, top - y0);
    const gg = x.createLinearGradient(0, y0, 0, top);
    gg.addColorStop(0, "rgba(255,255,220,0.22)"); gg.addColorStop(0.7, "rgba(0,0,0,0)"); gg.addColorStop(1, "rgba(20,50,10,0.28)");
    x.fillStyle = gg; x.fillRect(x0, y0, w, top - y0);
    if (kind === "weed") { x.fillStyle = "rgba(70,60,20,0.35)"; x.fillRect(x0, y0, w, top - y0); }
    if (kind === "stone") { x.fillStyle = "rgba(120,110,90,0.25)"; x.fillRect(x0, y0, w, top - y0); }
    // grass lip hanging over the soil
    x.fillStyle = "#4e8a2e";
    x.beginPath();
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const fx = x0 + (w * i) / n, d = px * (0.03 + ((i * 7 + variant) % 3) * 0.018);
      x.moveTo(fx - w / n * 0.55, top - 1); x.lineTo(fx, top + d); x.lineTo(fx + w / n * 0.55, top - 1);
    }
    x.fill();
    x.fillStyle = "rgba(255,255,255,0.16)"; x.fillRect(x0, y0, w, px * 0.025);
    x.restore();
    CLOD[key] = c;
    return c;
  }
  const PLANT_H = [0.62, 1.0, 1.08];
  function cell3d(c, X, Y, s, alpha = 1) {
    const kind = c.k === "plant" ? "plant" : c.k === "stone2" ? "stone" : c.k;
    const variant = (Math.round(X * 3 + Y * 7) >>> 0) % 4;
    const px = Math.max(8, Math.round(s * K));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(10,20,10,0.28)";
    rrc(ctx, X + s * 0.06, Y + s * 0.12, s * 0.94, s * 0.92, s * 0.18); ctx.fill();
    const cl = clodCanvas(px, variant, kind);
    if (cl) ctx.drawImage(cl, X, Y, s, s);
    else { fillRR(X + 1, Y + 1, s - 2, s - 2, s * 0.18, "#6e9a46"); }
    const cx = X + s / 2, base = Y + s * 0.5;
    let sp = null, h = 0, wmax = s * 1.1, sway = 0;
    if (c.k === "plant") { const sg = stageOf(c); sp = P3(`p3_${c.sp}_${sg}`); h = s * PLANT_H[sg]; sway = Math.sin(st.time * 1.8 + X * 0.21 + Y * 0.13) * 0.035; }
    else if (c.k === "stone") { sp = P3("o3_stone"); h = s * 0.66; wmax = s * 0.86; }
    else if (c.k === "stone2") { sp = P3("o3_stone2"); h = s * 0.6; wmax = s * 0.9; }
    else if (c.k === "weed") { sp = P3("o3_weed"); h = s * 0.74; wmax = s * 0.92; sway = Math.sin(st.time * 1.3 + X) * 0.03; }
    else if (c.k === "plastic") { sp = P3("o3_plastic"); h = s * 0.72; wmax = s * 0.8; }
    else if (c.k === "mush") { sp = P3("o3_mush"); h = s * 0.7; wmax = s * 0.8; }
    if (sp) {
      let w = sp.naturalWidth / sp.naturalHeight * h;
      if (w > wmax) { h *= wmax / w; w = wmax; }
      const by = c.k === "plant" ? base + s * 0.08 : base + s * 0.14;
      ctx.save(); ctx.translate(cx, by); if (sway) ctx.rotate(sway);
      ctx.drawImage(sp, -w / 2, -h, w, h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function plantIcon(sp, x, y, w, h) {
    const im = P3(`p3_${sp}_1`);
    if (!im) return;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    ctx.drawImage(im, x + (w - im.naturalWidth * k) / 2, y + (h - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
  }
  function spriteIn(name, x, y, w, h) {
    const im = P3(name);
    if (!im) return;
    const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    ctx.drawImage(im, x + (w - im.naturalWidth * k) / 2, y + (h - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k);
  }

  // ---------- mountains, scenes and the place on the trail
  function mountainOf(m) {
    const base = TR.mountains[m % TR.mountains.length], lap = Math.floor(m / TR.mountains.length);
    return { m, base, lap, mirror: lap % 2 === 1, tod: lap % 4 };
  }
  function mountainName(m) {
    const M = mountainOf(m), nm = M.base[save.lang === "en" ? "en" : "sr"];
    if (!M.lap) return nm;
    const when = I18N[save.lang || "en"].tod[M.tod];
    return M.lap < 4 ? `${nm} ${when}` : `${nm} ${when} · ${Math.floor(M.lap / 4) + 1}`;
  }
  function stopOf(k) {             // k levels done on a mountain -> scene and place along its trail
    if (k >= 20) return { s: 5, u: 1 };
    let s = 0;
    while (k >= CUM[s + 1]) s++;
    return { s, u: 0.26 + 0.74 * (k - CUM[s]) / TR.perScene[s] };
  }
  function sceneOfLevel(n) { const k = (n - 1) % 20; let s = 0; while (k >= CUM[s + 1]) s++; return { m: Math.floor((n - 1) / 20), s }; }
  function sceneImg(M, s) { return im3(`scenes/${M.base.key}_${s + 1}.jpg`); }
  // preload the scenes around the player's place
  function warmScenes() {
    const n = save.unlocked, { m, s } = sceneOfLevel(n), M = mountainOf(m);
    for (let i = Math.max(0, s - 1); i <= Math.min(5, s + 1); i++) sceneImg(M, i);
  }
  function curve(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let tt = 0; tt < 1; tt += 0.1) {
        const t2 = tt * tt, t3 = t2 * tt;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(pts[pts.length - 1]);
    const len = [0];
    for (let i = 1; i < out.length; i++) len.push(len[i - 1] + Math.hypot(out[i][0] - out[i - 1][0], (out[i][1] - out[i - 1][1]) * 1.79));
    return { out, len, total: len[len.length - 1] };
  }
  const CURVES = {};
  function trailAt(M, s, u) {
    const key = M.base.key + s;
    const c = CURVES[key] || (CURVES[key] = curve(M.base.scenes[s]));
    const L = Math.max(0, Math.min(1, u)) * c.total;
    let i = 1;
    while (i < c.len.length - 1 && c.len[i] < L) i++;
    const k = (L - c.len[i - 1]) / Math.max(1e-6, c.len[i] - c.len[i - 1]);
    let x = c.out[i - 1][0] + (c.out[i][0] - c.out[i - 1][0]) * k, y = c.out[i - 1][1] + (c.out[i][1] - c.out[i - 1][1]) * k;
    const dx = (c.out[i][0] - c.out[i - 1][0]) * (M.mirror ? -1 : 1), dy = c.out[i][1] - c.out[i - 1][1];
    if (M.mirror) x = 1 - x;
    return { x, y, dx, dy };
  }
  const H0 = 0.17, H1 = [0.055, 0.085, 0.1, 0.085, 0.07, 0.1];
  function heroH(M, s, y) {
    const pts = M.base.scenes[s], y0 = pts[0][1], y1 = pts[pts.length - 1][1];
    const k = Math.max(0, Math.min(1, (y0 - y) / Math.max(0.05, y0 - y1)));
    return H0 * Math.pow(H1[s] / H0, k);
  }
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  function camOf(img, p, u, focusY = 0.6) {
    // zoom in a little as she walks deeper into the picture and keep her at focusY of the screen
    const z = 1.18 + 0.35 * ease(Math.min(1, u));
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const sc = Math.max(W / iw, H / ih) * z, vw = W / sc, vh = H / sc;
    let cx = iw * (0.5 + (p.x - 0.5) * 0.7), cy = p.y * ih - (focusY - 0.5) * vh;
    cx = Math.min(iw - vw / 2, Math.max(vw / 2, cx)); cy = Math.min(ih - vh / 2, Math.max(vh / 2, cy));
    return { sc, ox: W / 2 - cx * sc, oy: H / 2 - cy * sc };
  }
  // time of day for later laps: dawn, dusk, night
  function todTint(tod, alpha = 1) {
    if (!tod) return;
    ctx.save(); ctx.globalAlpha = alpha;
    if (tod === 1) { ctx.globalCompositeOperation = "soft-light"; ctx.fillStyle = "rgba(255,170,130,0.55)"; ctx.fillRect(0, 0, W, H); }
    if (tod === 2) {
      ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(190,140,190,0.6)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "screen"; const g = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      g.addColorStop(0, "rgba(255,140,80,0.35)"); g.addColorStop(1, "rgba(255,140,80,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (tod === 3) {
      ctx.globalCompositeOperation = "multiply"; ctx.fillStyle = "rgba(55,75,140,0.95)"; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
      for (let i = 0; i < 46; i++) {
        const x = (i * 97.31 % 1) * W, y = (i * 53.7 % 1) * H * 0.4, a = 0.4 + 0.6 * Math.abs(Math.sin(st.time * 1.3 + i));
        ctx.fillStyle = `rgba(255,255,240,${a * 0.8})`; ctx.fillRect(x, y, 0.8, 0.8);
      }
      for (let i = 0; i < 14; i++) {          // fireflies
        const x = W * (0.1 + 0.8 * ((i * 0.618) % 1)) + Math.sin(st.time * 0.7 + i) * 10, y = H * (0.45 + 0.45 * ((i * 0.37) % 1)) + Math.cos(st.time * 0.9 + i * 2) * 8;
        const a = 0.5 + 0.5 * Math.sin(st.time * 3 + i * 1.7);
        ctx.fillStyle = `rgba(220,255,140,${a * 0.9})`; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill();
        ctx.fillStyle = `rgba(220,255,140,${a * 0.2})`; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  }
  function drawSceneImg(img, cam, mirror, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, mirror ? W - cam.ox - img.naturalWidth * cam.sc : cam.ox, cam.oy, img.naturalWidth * cam.sc, img.naturalHeight * cam.sc);
    ctx.restore();
  }
  // play background: the scene of this level, blurred and dimmed, rendered once
  const BGC = {};
  function playBg(n) {
    const { m, s } = n ? sceneOfLevel(n) : sceneOfLevel(save.unlocked);
    const M = mountainOf(m), img = sceneImg(M, n ? s : 2);
    const key = M.base.key + s + M.mirror + M.tod + "_" + canvas.width;
    if (!BGC[key] && img) {
      const c = document.createElement("canvas"); c.width = canvas.width; c.height = canvas.height;
      const x = c.getContext("2d");
      const sc = Math.max(c.width / img.naturalWidth, c.height / img.naturalHeight);
      x.filter = `blur(${Math.round(3 * K)}px)`;
      if (M.mirror) { x.translate(c.width, 0); x.scale(-1, 1); }
      x.drawImage(img, (c.width - img.naturalWidth * sc) / 2, 0, img.naturalWidth * sc, img.naturalHeight * sc);
      x.setTransform(1, 0, 0, 1, 0, 0); x.filter = "none";
      x.fillStyle = "rgba(12,28,18,0.22)"; x.fillRect(0, 0, c.width, c.height);
      BGC[key] = c;
    }
    if (BGC[key]) { ctx.drawImage(BGC[key], 0, 0, W, H); todTint(M.tod, 0.85); }
    else { ctx.fillStyle = "#3d5a3a"; ctx.fillRect(0, 0, W, H); }
  }

  // ---------- the heroine on the trail
  // walking: only the frames that face the same way, so she doesn't twist between back and profile.
  // straight away from the camera: two true back views; along a slanted stretch: two back three-quarter views.
  // the choice holds until the trail clearly turns (hysteresis), so she doesn't flicker between them.
  function heroFrame(J, walking, dx, dy) {
    if (walking) {
      const side = Math.abs(dx) * 1.79 / Math.max(1e-6, Math.abs(dy) + Math.abs(dx) * 1.79);
      if (J.gait !== "q" && side > 0.62) J.gait = "q";
      else if (J.gait !== "b" && side < 0.42) J.gait = "b";
      if (!J.gait) J.gait = side > 0.52 ? "q" : "b";
      if (Math.abs(dx) > 1e-4) { const f = dx > 0; if (J.face === undefined || (f !== J.face && side > 0.35)) J.face = f; }
      const step = Math.floor(st.time * 3.6) % 2;
      return J.gait === "q" ? { n: "h_qback_" + step, flip: !!J.face } : { n: "h_back_" + step, flip: false };
    }
    const idle = st.time - J.stopT;
    if (J.summit) return { n: idle < 1.6 ? "h_win" : (Math.floor(idle * 1.4) % 3 === 0 ? "h_jump" : "h_win"), flip: false };
    if (!J.turns) return { n: "h_back", flip: false };
    const seq = ["h_back", "h_sideL", "h_q_front", "h_front"];
    if (idle < 0.3) return { n: "h_back", flip: false };
    const i = Math.min(3, Math.floor((idle - 0.3) / 0.13));
    if (i < 3) return { n: seq[i], flip: false };
    if (J.camp) return { n: Math.floor(idle / 1.6) % 2 ? "h_wave" : "h_front", flip: false };
    return { n: "h_front", flip: false };
  }
  const BODYX = {};
  function bodyCenter(im, name) {          // horizontal centre of the hips/legs, so arms and hair don't shift her
    if (BODYX[name] !== undefined) return BODYX[name];
    try {
      const c = document.createElement("canvas"); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext("2d"); x.drawImage(im, 0, 0);
      const y0 = Math.round(c.height * 0.5), y1 = Math.round(c.height * 0.62);
      const d = x.getImageData(0, y0, c.width, y1 - y0).data;
      let sum = 0, n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] > 128) { sum += ((i - 3) / 4) % c.width; n++; }
      BODYX[name] = n ? sum / n / c.width : 0.5;
    } catch (e) { BODYX[name] = 0.5; }
    return BODYX[name];
  }
  function drawHero(name, x, y, h, flip, bob = 0) {
    const im = P3(name);
    if (!im) return;
    const k = name === "h_win" || name === "h_jump" ? 1.05 : name === "h_wave" ? 0.94 : 1;
    const hh = h * k * (im.naturalHeight / 560), w = im.naturalWidth * hh / im.naturalHeight;
    const bx = bodyCenter(im, name) * w;
    ctx.fillStyle = "rgba(15,25,10,0.3)"; ctx.beginPath(); ctx.ellipse(x, y, h * 0.16, h * 0.04, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y - bob);
    if (flip) ctx.scale(-1, 1);
    const jump = name === "h_jump" ? Math.abs(Math.sin(st.time * 5)) * h * 0.08 : 0;
    ctx.drawImage(im, -bx, -hh - jump, w, hh);
    ctx.restore();
  }
  function confetti(t) {
    for (let i = 0; i < 70; i++) {
      const sx = (i * 97.3 % 1) * W, sp = 40 + (i * 37 % 40), y = ((t * sp + i * 41) % (H + 40)) - 20, x = sx + Math.sin(t * 2 + i) * 10;
      ctx.fillStyle = ["#F2B64B", "#8FD16A", "#F6FAF1", "#E5812E", "#7DB2E6"][i % 5];
      ctx.save(); ctx.translate(x, y); ctx.rotate(t * 3 + i); ctx.fillRect(-2, -1, 4, 2); ctx.restore();
    }
  }

  // ---------- journey screen
  function journeyView() {
    const done = save.unlocked - 1;
    let m = Math.floor(done / 20), k = done % 20;
    if (done > 0 && k === 0 && (save.summitSeen || 0) < m) { m -= 1; k = 20; }
    return { m, k };
  }
  function enterJourney(animate) {
    const { m, k } = journeyView();
    const to = stopOf(k), from = animate && k > 0 ? stopOf(k - 1) : to;
    st.jr = { m, k, s: from.s, u: from.u, to, walk: animate && k > 0, fade: 0, prev: null, stopT: st.time, turns: k % 2 === 0, camp: false, summit: false, t0: st.time };
    st.mode = "journey";
    for (let i = 0; i < 6; i++) sceneImg(mountainOf(m), i);
    if (!st.jr.walk) arrive();
  }
  function arrive() {
    const J = st.jr;
    J.walk = false; J.stopT = st.time;
    J.camp = J.s === TR.camp && J.u > 0.05 && J.u < 0.99 || J.s === TR.camp && J.k === CUM[TR.camp];
    J.summit = J.k >= 20;
    J.turns = J.camp || J.summit || J.k % 2 === 0;
    if (J.summit && !J.cheered) { J.cheered = true; A.sfx.chime(); }
  }
  function drawJourneyScene(J, dt, focusY = 0.6, ui = true) {
    const M = mountainOf(J.m);
    // advance the walk
    let walking = false;
    if (J.walk && J.fade <= 0) {
      const target = J.to.s > J.s ? 1 : J.to.u;
      const speed = 0.12;
      J.u = Math.min(target, J.u + dt * speed);
      walking = J.u < target;
      if (!walking) {
        if (J.to.s > J.s) { J.prev = { s: J.s, u: J.u }; J.s += 1; J.gait = undefined; J.face = undefined; J.u = J.to.s === J.s ? J.to.u : 0.26; J.fade = 1; }
        else arrive();
      }
    }
    const img = sceneImg(M, J.s);
    if (!img) { ctx.fillStyle = "#2c4a34"; ctx.fillRect(0, 0, W, H); return; }
    const p = trailAt(M, J.s, J.u), cam = camOf(img, p, J.u, focusY);
    drawSceneImg(img, cam, M.mirror);
    todTint(M.tod);
    const hx = cam.ox + p.x * img.naturalWidth * cam.sc, hy = cam.oy + p.y * img.naturalHeight * cam.sc;
    const hh = heroH(M, J.s, p.y) * img.naturalHeight * cam.sc;
    if (J.summit) {                          // flag planted beside her
      const f = P3("flag_" + (Math.floor(st.time * 6) % 4));
      if (f) { const fh = hh * 0.9, fw = f.naturalWidth * fh / f.naturalHeight; ctx.drawImage(f, hx + hh * 0.18, hy - fh, fw, fh); }
    }
    const fr = heroFrame(J, walking && J.fade <= 0, p.dx, p.dy);
    drawHero(fr.n, hx, hy, hh, fr.flip, walking ? Math.abs(Math.sin(st.time * 3.6 * Math.PI)) * hh * 0.01 : 0);
    if (J.fade > 0) {                         // the previous scene zooms on and dissolves into this one
      J.fade = Math.max(0, J.fade - dt / 1.1);
      const pimg = sceneImg(M, J.prev.s);
      if (pimg) {
        const pp = trailAt(M, J.prev.s, 1), pc = camOf(pimg, pp, 1, focusY);
        ctx.save(); const z = 1 + (1 - J.fade) * 0.3; ctx.translate(W / 2, H * 0.45); ctx.scale(z, z); ctx.translate(-W / 2, -H * 0.45);
        drawSceneImg(pimg, pc, M.mirror, J.fade); ctx.restore();
      }
      if (J.fade <= 0) { if (J.s === J.to.s && J.u >= J.to.u - 1e-4) arrive(); }
    }
    if (J.summit) confetti(st.time - J.stopT);
  }
  function drawJourney(dt) {
    const J = st.jr;
    drawJourneyScene(J, dt);
    // top bar
    button3(10, TOP + 4, 26, 26, "", () => { st.mode = "title"; }, { skin: "btn_wood", icon: "i_home" });
    const nm = mountainName(J.m);
    setFont(9); const tw = ctx.measureText(nm).width;
    pill(W / 2 - tw / 2 - 12, TOP + 6, tw + 24, 22, "rgba(30,58,43,0.85)");
    text(nm, W / 2, TOP + 17, 9, C3.surf, "center", null);
    seedPill3(W - 64, TOP + 7);
    // bottom card
    const y0 = H - 92;
    panel3(10, y0, W - 20, 82);
    const sn = I18N[save.lang || "en"].scenes;
    const s = J.s;
    text(J.summit ? sn[5] : sn[s], 22, y0 + 15, 10, C3.ink, "left", null);
    text(J.summit ? "20 / 20" : `${Math.min(20, J.k)} / 20`, W - 22, y0 + 15, 8, C3.muted, "right", null);
    for (let i = 0; i < 6; i++) {
      const dx = 22 + i * ((W - 44 - 10) / 5), on = i < s || J.summit, cur = i === s && !J.summit;
      ctx.fillStyle = on ? C3.acc : cur ? C3.white : "rgba(30,58,43,0.16)";
      ctx.beginPath(); ctx.arc(dx + 5, y0 + 31, cur ? 4.5 : 3.5, 0, 7); ctx.fill();
      if (cur) { ctx.lineWidth = 2; ctx.strokeStyle = C3.acc; ctx.stroke(); }
      if (i < 5) { ctx.fillStyle = on ? C3.acc : "rgba(30,58,43,0.16)"; ctx.fillRect(dx + 11, y0 + 30.2, (W - 44 - 10) / 5 - 12, 1.6); }
    }
    if (J.walk || J.fade > 0) {
      text(t("onTheWay"), W / 2, y0 + 58, 9, C3.muted, "center", null);
      st.buttons.push({ x: 0, y: 0, w: W, h: H, on: () => { J.walk = false; J.fade = 0; J.s = J.to.s; J.u = J.to.u; arrive(); } });
    } else if (J.summit) {
      button3(22, y0 + 42, W - 44, 30, t("newTrail"), () => { save.summitSeen = J.m + 1; persist(); enterJourney(false); }, { skin: "btn_green", size: 11, icon: "i_mountain" });
    } else {
      const n = save.unlocked;
      button3(22, y0 + 42, W - 44, 30, `${t("play")} · ${t("level")} ${n}`, () => newGame(n), { skin: "btn_green", size: 11, icon: "i_play" });
    }
  }
  function seedPill3(x, y) {
    pill(x, y, 56, 20, C3.surf);
    drawIcon("seed", x + 5, y + 3.5, 13, C3.amberE);
    text(String(save.seeds), x + 34, y + 10, 9, C3.ink, "center", null);
  }

  // ---------- title
  function drawTitle3d(dt) {
    if (!st.jr || st.jr.m !== journeyView().m || st.jr.k !== journeyView().k) { const keep = st.mode; enterJourney(false); st.mode = keep; }
    drawJourneyScene(st.jr, dt, 0.5);
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.35);
    g.addColorStop(0, "rgba(12,28,18,0.5)"); g.addColorStop(1, "rgba(12,28,18,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.35);
    seedPill3(10, TOP + 6);
    button3(W - 36, TOP + 4, 26, 26, "", () => { st.settings = !st.settings; st.help = null; st.resetArm = 0; }, { skin: "btn_wood", icon: "i_gear" });
    button3(W - 66, TOP + 4, 26, 26, "", () => openHelp(), { skin: "btn_wood", icon: "i_help" });
    const bob = Math.sin(st.time * 1.2) * 1.2;
    text("Hike &", 16, TOP + 52 + bob, 24, "#F6FAF1", "left", C3.ink);
    text("Bloom", 16, TOP + 78 + bob, 27, "#9BD978", "left", C3.ink);
    // bottom sheet
    const y0 = H - 168;
    panel3(8, y0, W - 16, 176);
    const n = save.unlocked, { m, k } = journeyView();
    text(`${t("level")} ${k >= 20 ? n - 1 : n}`, 20, y0 + 17, 14, C3.ink, "left", null);
    text(`${mountainName(m)} · ${Math.min(20, k)}/20`, 20, y0 + 33, 8, C3.muted, "left", null);
    button3(W - 82, y0 + 9, 66, 24, t("trail"), () => enterJourney(false), { skin: "btn_wood", size: 8, icon: "i_map" });
    button3(16, y0 + 44, W - 104, 38, k >= 20 ? t("newTrail") : t("play"), () => {
      if (k >= 20) enterJourney(false); else newGame(n);
    }, { skin: "btn_green", size: 14, icon: "i_play" });
    button3(W - 82, y0 + 44, 66, 38, t("zen"), () => newGame(0, { zen: true }), { skin: "btn_pink", size: 10, icon: "i_leaf" });
    const tiles = [
      ["tasks", t("tasks"), () => { st.modal = "tasks"; }, tasksReady()],
      ["gift", t("bonus"), () => { st.modal = "bonus"; }, bonusReady()],
      ["shop", t("shop"), () => { st.modal = "shop"; }, false],
    ];
    const tw = (W - 32 - 12) / 3;
    tiles.forEach(([ic, label, on, dot], i) => {
      const x = 16 + i * (tw + 6), y = y0 + 92;
      button3(x, y, tw, 40, "", on, { skin: "btn_pink" });
      drawIcon(ic, x + tw / 2 - 7, y + 5, 14, ic === "gift" ? C3.amberE : C3.acc);
      text(label, x + tw / 2, y + 28, 7.5, C3.ink, "center", null);
      if (dot) { ctx.fillStyle = C3.red; ctx.beginPath(); ctx.arc(x + tw - 7, y + 7, 3.4, 0, 7); ctx.fill(); }
    });
    if (!st.bonusShown && bonusReady() && !st.modal && !st.help && !st.settings) { st.bonusShown = true; st.modal = "bonus"; }
  }

  // ---------- play HUD
  function drawHud3d() {
    const lv = G.lv;
    button3(8, TOP + 3, 26, 26, "", () => { st.paused = true; st.settings = true; }, { skin: "btn_wood", icon: "i_pause" });
    button3(W - 34, TOP + 3, 26, 26, "", () => openHelp(), { skin: "btn_wood", icon: "i_help" });
    const gx0 = 40, gw = W - 80;
    fillRR(gx0, TOP + 3, gw, 24, 12, C3.surf);
    if (G.zen) {
      text(`${t("zen")} · ${t("best")} ${Math.max(save.zenBest, G.score)}`, W / 2, TOP + 15, 8, C3.ink, "center", null);
    } else {
      const n = lv.goals.length, cw = gw / n;
      lv.goals.forEach((g, i) => {
        const cx = gx0 + cw * i + cw / 2, done = G.prog[i] >= g.need, left = Math.max(0, g.need - G.prog[i]);
        const iconX = cx - 15;
        if (g.type === "bloom") plantIcon(g.sp, iconX - 2, TOP + 4, 18, 22);
        else if (g.type === "score") star3(iconX + 7, TOP + 15, 7, true);
        else spriteIn("o3_" + (g.type === "stone" ? "stone" : g.type), iconX - 2, TOP + 6, 18, 18);
        if (done) { fillRR(cx + 2, TOP + 9, 12, 12, 6, C3.acc); drawIcon("check", cx + 3.5, TOP + 10.5, 9, C3.white); }
        else text(String(left), cx + 9, TOP + 15.5, left > 999 ? 7 : 9, C3.ink, "center", null);
      });
    }
    // second row: level, moves, score
    const y = TOP + 36;
    const lvTxt = G.zen ? t("zen") : `${t("level")} ${G.n}`;
    setFont(8); const lw = ctx.measureText(lvTxt).width + 16;
    pill(12, y + 8, lw, 18); text(lvTxt, 12 + lw / 2, y + 17, 8, C3.surf, "center", null);
    const sc = String(G.score); setFont(8); const sw = ctx.measureText(sc).width + 16;
    pill(W - 12 - sw, y + 8, sw, 18); text(sc, W - 12 - sw / 2, y + 17, 8, C3.surf, "center", null);
    if (!G.zen) {
      const low = G.moves <= 3 && Math.floor(st.time * 4) % 2;
      ctx.fillStyle = C3.surf; ctx.beginPath(); ctx.arc(W / 2, y + 17, 20, 0, 7); ctx.fill();
      ctx.fillStyle = C3.acce; ctx.beginPath(); ctx.arc(W / 2, y + 19, 17, 0, 7); ctx.fill();
      ctx.fillStyle = low ? C3.red : C3.acc; ctx.beginPath(); ctx.arc(W / 2, y + 17, 17, 0, 7); ctx.fill();
      text(String(G.moves), W / 2, y + 14, 14, C3.white, "center", null);
      text(t("moves").toLowerCase(), W / 2, y + 26, 5.5, "#E6F4DF", "center", null);
    } else {
      text(`${t("streak")} ${G.streak}`, W / 2, y + 17, 8, C3.surf, "center", C3.ink);
    }
  }

  // ---------- bees (vector)
  function bee3(x, y, ph) {
    const fl = Math.sin(st.time * 40 + ph) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(255,255,255,${0.55 + fl * 0.3})`;
    ctx.beginPath(); ctx.ellipse(x - 1, y - 3, 2.2, 1.4 + fl, -0.5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 1.5, y - 3, 2.2, 1.4 + fl, 0.5, 0, 7); ctx.fill();
    ctx.fillStyle = "#F2B64B"; ctx.beginPath(); ctx.ellipse(x, y, 3.4, 2.4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2a2018"; ctx.fillRect(x - 1, y - 2.3, 1, 4.6); ctx.fillRect(x + 1.2, y - 2.1, 0.9, 4.2);
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st.time += dt; st.dt = dt;
    st.idle += dt;
    st.buttons = [];
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    updateFlies(dt);
    updateParts(dt);
    if (st.mode === "lang") drawLang();
    else if (st.mode === "title") {
      drawTitle();
      drawParts();
      if (st.modal) { st.buttons = []; drawModal(); drawParts(); }
      if (st.idle > 25 && !st.help && !st.settings && !st.modal) startDemo();
    } else if (st.mode === "journey") { drawJourney(dt); if (st.modal) { st.buttons = []; drawModal(); } }
    else if (st.mode === "map") enterJourney(false);
    else if (st.mode === "camp") { drawCamp(); drawParts(); }
    else if (st.mode === "play" && G) {
      if (st.demo) updateDemo(dt);
      drawPlay(dt);
    }
    if (st.help) { st.buttons = []; drawHelp(dt); drawParts(); }
    if (st.settings) { st.buttons = []; drawSettings(); }
    requestAnimationFrame(frame);
  }

  fit();
  ready.then(() => document.fonts && Promise.all([document.fonts.load('400 14px "Jersey 10"'), document.fonts.load('400 14px "Jersey 10"', "šđčćž"), document.fonts.load('600 14px "Fredoka"'), document.fonts.load('600 14px "Fredoka"', "šđčćž")])).catch(() => {}).then(() => {
    st.mode = save.lang ? "title" : "lang";
    requestAnimationFrame(frame);
  });

  // test hooks (used by automated checks)
  window.__pp = { st, get G() { return G; }, save, enterJourney, newGame, place, bestMove, startDemo, geo: () => ({ TOP, BX, BY, TY, BB, H }) };
})();
