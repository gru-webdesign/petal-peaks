// Petal Peaks — a cozy block puzzle on an endless mountain trail.
// Place pieces on a 9×9 garden bed; full rows, columns and 3×3 squares bloom.
(() => {
  "use strict";

  const L = window.Levels, I18N = window.I18N, A = window.Audio2;
  const W = 252;
  let H = 448;
  const CELL = 24, MINI = 14;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let K = 1; // backing pixels per logical pixel

  // ---------------------------------------------------------------- assets
  const IMG = {};
  const names = ["panel", "btn_green", "btn_wood", "btn_pink", "btn_gold", "btn_stone", "star_big", "star_big_off", "camp", "flag",
    "frame", "cell_0", "cell_1", "stone", "stone_cracked", "weed_0", "weed_1", "plastic", "mushroom",
    "bee_0", "bee_1", "campfire_0", "campfire_1", "sign_open", "sign_current", "sign_done", "sign_locked"];
  for (const i of ["pause", "play", "sound", "mute", "music", "gear", "home", "retry", "map", "close", "breath", "compost", "rain", "lock", "star", "star_off", "leaf", "check", "flower", "moves", "lang"]) names.push("i_" + i);
  for (let f = 0; f < 4; f++) names.push("hiker_" + f);
  names.push("yogi_0", "yogi_1");
  for (const c of ["orange", "blue", "pink"]) for (let f = 0; f < 2; f++) names.push(`fly_${c}_${f}`);
  for (const sp of L.SPECIES) { for (let s = 0; s < 3; s++) names.push(`p_${sp}_${s}`); names.push(`m_${sp}_1`); }
  for (const b of L.BIOMES) names.push("bg_" + b.key);
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
    lavender: ["#8a6fc4", "#b39ce3", "#644a99"], poppy: ["#d24b44", "#ef7c5f", "#a5303a"],
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
  const save = Object.assign({ lang: null, unlocked: 1, stars: {}, zenBest: 0, music: true, sound: true, vib: true, tutDone: false }, (() => {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; }
  })());
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
  const t = (k) => (I18N[save.lang || "en"][k] ?? k);
  const vib = (ms) => { if (save.vib && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} };

  // ---------------------------------------------------------------- state
  const st = {
    mode: "lang", time: 0, idle: 0, buttons: [],
    page: 0, help: null, settings: false, paused: false, resetArm: 0,
    flies: [], parts: [], floats: [], fx: [], bees: [], drops: [], shake: 0,
    toast: null, demo: false,
  };
  let G = null; // current game

  // ---------------------------------------------------------------- layout
  let TOP = 4, BX = 10, BY = 60, TY = 300, BB = 380;
  function fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    H = Math.max(448, Math.min(560, Math.round(W * vh / vw)));
    const s = Math.min(vw / W, vh / H);
    const dpr = window.devicePixelRatio || 1;
    K = s * dpr >= 2 ? Math.floor(s * dpr) : s * dpr;
    canvas.width = Math.round(W * K);
    canvas.height = Math.round(H * K);
    canvas.style.width = (canvas.width / dpr) + "px";
    canvas.style.height = (canvas.height / dpr) + "px";
    const safe = document.getElementById("safe-top");
    TOP = Math.max(4, Math.round((safe ? safe.getBoundingClientRect().height : 0) / s) + 4);
    const need = TOP + 52 + 232 + 8 + 78 + 34;
    const extra = Math.max(0, H - need);
    BX = 10;
    BY = TOP + 52 + Math.round(extra * 0.45);
    TY = BY + 232 + 6 + Math.round(extra * 0.2);
    BB = TY + 78;
  }
  window.addEventListener("resize", fit);

  // ---------------------------------------------------------------- drawing helpers
  function setFont(size) { ctx.font = `400 ${Math.round(size * 1.45)}px "Jersey 10", monospace`; }
  function text(str, x, y, size = 8, color = COL.cream, align = "center", outline = COL.ink, base = "middle") {
    setFont(size);
    ctx.textAlign = align; ctx.textBaseline = base;
    if (outline) {
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
  function img(name, x, y, w, h) {
    const im = IMG[name];
    if (!im || !im.complete || !im.naturalWidth) return;
    if (w) ctx.drawImage(im, Math.round(x), Math.round(y), w, h); else ctx.drawImage(im, Math.round(x), Math.round(y));
  }
  // 9-slice: border b px of the source
  function nine(name, x, y, w, h, b) {
    const im = IMG[name];
    if (!im || !im.naturalWidth) return;
    const S = im.naturalWidth, m = S - 2 * b;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    const iw = w - 2 * b, ih = h - 2 * b;
    // tiles the source piece (sx,sy,sw,sh) over (dx,dy,dw,dh) without stretching
    const tile = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      for (let yy = 0; yy < dh; yy += sh) for (let xx = 0; xx < dw; xx += sw) {
        const cw = Math.min(sw, dw - xx), chh = Math.min(sh, dh - yy);
        ctx.drawImage(im, sx, sy, cw, chh, dx + xx, dy + yy, cw, chh);
      }
    };
    ctx.drawImage(im, 0, 0, b, b, x, y, b, b);
    ctx.drawImage(im, S - b, 0, b, b, x + w - b, y, b, b);
    ctx.drawImage(im, 0, S - b, b, b, x, y + h - b, b, b);
    ctx.drawImage(im, S - b, S - b, b, b, x + w - b, y + h - b, b, b);
    if (iw > 0) { tile(b, 0, m, b, x + b, y, iw, b); tile(b, S - b, m, b, x + b, y + h - b, iw, b); }
    if (ih > 0) { tile(0, b, b, m, x, y + b, b, ih); tile(S - b, b, b, m, x + w - b, y + b, b, ih); }
    if (iw > 0 && ih > 0) tile(b, b, m, m, x + b, y + b, iw, ih);
  }
  function rect(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function button(x, y, w, h, label, on, opt = {}) {
    const skin = opt.skin || "btn_green";
    const pressed = st.press && st.press.x >= x && st.press.x <= x + w && st.press.y >= y && st.press.y <= y + h;
    nine(skin, x, y + (pressed ? 2 : 0), w, h - (pressed ? 2 : 0), 7);
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
  function iconButton(x, y, icon, on, skin = "btn_wood") { button(x, y, 20, 20, "", on, { icon, skin }); }

  // ---------------------------------------------------------------- background + ambience
  function drawBg(key) {
    img("bg_" + key, 0, H - 560);
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
      if (p.spark) { const s = a > 0.5 ? 2 : 1; ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s); }
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

  const cellX = (x) => BX + 8 + x * CELL;
  const cellY = (y) => BY + 8 + y * CELL;

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
      const px = cellX(x) + 12, py = cellY(y) + 12;
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
    const mult = lines + (lines > 1 ? lines - 1 : 0);
    const gained = pts * mult + (G.streak > 1 ? 10 * G.streak : 0);
    G.score += gained;
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
    save.stars[n] = Math.max(save.stars[n] || 0, G.stars);
    save.unlocked = Math.max(save.unlocked, n + 1);
    if (G.lv.tutorial) save.tutDone = true;
    persist();
  }

  // undo the last move (deep breath)
  function deepBreath() {
    if (!G || G.zen && !G.history) { toast(t("breatheNone")); return; }
    if (G.breathUsed) { toast(t("breatheUsed")); return; }
    if (!G.history) { toast(t("breatheNone")); return; }
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
    if (st.mode === "play" && G && G.over === "win" && G.moves > 0) { G.skip = true; return; }
    const b = hitButton(p);
    if (b) {
      if (b.hold) { b.hold(true); st.holding = b; return; }
      b.on && b.on(p); A.sfx.tap(); return;
    }
    if (st.help || st.settings) return;
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

  function compostRect() { return { x: 10, y: BB + 4, w: 78, h: 24 }; }
  // where would the dragged piece land?
  function dropTarget(d) {
    const pc = G.tray[d.slot];
    if (!pc) return null;
    const cx = d.x + d.ox, cy = d.y + d.oy;
    const cr = compostRect();
    if (d.type === "user" && cx > cr.x - 6 && cx < cr.x + cr.w + 6 && cy > cr.y - 18 && cy < cr.y + cr.h + 10) return { compost: true };
    const left = cx - pc.p.wd * CELL / 2, top = cy - pc.p.ht * CELL / 2;
    const x = Math.round((left - BX - 8) / CELL), y = Math.round((top - BY - 8) / CELL);
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
    const bob = Math.sin(st.time * 1.4) * 2;
    // flowers framing the title
    const fl = ["cosmos", "lavender", "poppy", "sunflower", "daisy", "cornflower"];
    fl.forEach((sp, i) => {
      const a = (i / fl.length) * Math.PI * 2 + st.time * 0.15;
      const x = cx + Math.cos(a) * 92, y = cy + 6 + Math.sin(a) * 30;
      ctx.globalAlpha = 0.95;
      img(`m_${sp}_1`, x - 7, y - 7);
    });
    ctx.globalAlpha = 1;
    text("PETAL", cx, cy - 12 + bob, 30, COL.pink, "center", COL.ink);
    text("PEAKS", cx, cy + 18 + bob, 30, COL.gold, "center", COL.ink);
    text(t("tagline"), cx, cy + 44, 8, COL.cream);
  }

  function drawTitle() {
    drawBg("meadow");
    rect(0, 0, W, H, "rgba(31,22,34,0.18)");
    topButtons();
    langToggle(8, TOP + 2);
    logo(W / 2, H * 0.27);
    const by = H * 0.52;
    const n = save.unlocked;
    button(W / 2 - 70, by, 140, 32, t("play"), () => { st.mode = "map"; st.page = Math.floor((save.unlocked - 1) / 10); }, { skin: "btn_green", size: 13, icon: "i_play" });
    text(`${t("level")} ${n} · ${I18N[save.lang].biomes[Math.floor((n - 1) / 10) % 6]}`, W / 2, by + 42, 8, COL.cream);
    button(W / 2 - 55, by + 56, 110, 26, t("zen"), () => newGame(0, { zen: true }), { skin: "btn_pink", size: 11, icon: "i_leaf" });
    text(`${t("zenSub")} · ${t("best")} ${save.zenBest}`, W / 2, by + 92, 7, COL.cream);
    // our heroine strolls across the meadow
    const hx = ((st.time * 14) % (W + 60)) - 30;
    img("hiker_" + (Math.floor(st.time * 5) % 4), hx, H - 76);
    // quote of the day
    const q = I18N[save.lang].quotes[Math.floor(Date.now() / 86400000) % 6];
    const lines = wrap(`“${q}”`, 200, 7);
    lines.forEach((l, i) => text(l, W / 2, H - 40 + i * 10, 7, COL.paper, "center", COL.ink2));
  }

  function langToggle(x, y) {
    button(x, y, 34, 20, save.lang === "sr" ? "SR" : "EN", () => { save.lang = save.lang === "sr" ? "en" : "sr"; persist(); }, { skin: "btn_wood", size: 8 });
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
      img("hiker_" + (Math.floor(st.time * 4) % 4), x + 10, y - 22);
    }
    // header
    nine("panel", 32, TOP + 2, W - 64, 34, 10);
    text(I18N[save.lang].biomes[biome] + (lap ? ` · ${lap + 1}.` : ""), W / 2, TOP + 15, 11, COL.brown, "center", null);
    text(`${t("level")} ${page * 10 + 1}–${page * 10 + 10}`, W / 2, TOP + 27, 7, "#875432", "center", null);
    iconButton(6, TOP + 8, "i_home", () => { st.mode = "title"; });
    iconButton(W - 26, TOP + 8, "i_gear", () => { st.settings = true; });
    // page arrows
    if (page > 0) button(6, H / 2 - 12, 22, 24, "‹", () => { st.page--; }, { skin: "btn_wood", size: 14 });
    if ((page + 1) * 10 < save.unlocked) button(W - 28, H / 2 - 12, 22, 24, "›", () => { st.page++; }, { skin: "btn_wood", size: 14 });
    button(W / 2 - 40, H - 30, 80, 22, t("help"), () => openHelp(), { skin: "btn_wood", size: 7 });
  }

  // ---------- summit camp
  function drawCamp() {
    const biome = (Math.floor((G.n - 1) / 10)) % 6;
    drawBg(L.BIOMES[biome].key);
    rect(0, 0, W, H, "rgba(58,35,80,0.35)");
    const cy = H / 2 - 40;
    img("camp", W / 2 - 110, cy);
    img("campfire_" + (Math.floor(st.time * 6) % 2), W / 2 + 5, cy + 78);
    img("yogi_" + (Math.floor(st.time / 2) % 2), W / 2 - 110 + 65, cy + 76);
    if (Math.random() < 0.3) st.parts.push({ x: W / 2 + 14, y: cy + 80, vx: (Math.random() - 0.5) * 6, vy: -20 - Math.random() * 20, g: 0, life: 1.2, t: 0, c: Math.random() < 0.5 ? COL.gold : "#f6ab55", s: 1, spark: true });
    text(t("camp"), W / 2, cy - 40, 16, COL.gold);
    text(`${t("summit")} ${G.n} · ${I18N[save.lang].biomes[biome]}`, W / 2, cy - 20, 8, COL.cream);
    wrap(t("campSub"), 210, 8).forEach((l, i) => text(l, W / 2, cy + 136 + i * 11, 8, COL.paper));
    button(W / 2 - 60, cy + 170, 120, 28, t("newTrail"), () => { st.mode = "map"; st.page = Math.floor((save.unlocked - 1) / 10); }, { skin: "btn_green", size: 10, icon: "i_map" });
  }

  // ---------------------------------------------------------------- play screen
  function drawHud() {
    // top panel
    nine("panel", 4, TOP, W - 8, 48, 10);
    const lv = G.lv;
    if (G.zen) {
      text(t("zen"), 16, TOP + 13, 10, COL.brown, "left", null);
      text(`${t("best")} ${Math.max(save.zenBest, G.score)}`, 16, TOP + 27, 7, "#875432", "left", null);
    } else {
      text(`${t("level")} ${G.n}`, 14, TOP + 12, 9, COL.brown, "left", null);
    }
    text(String(G.score), W / 2 + 6, TOP + 12, 11, "#bd7e1e", "center", null);
    // moves
    if (!G.zen) {
      const low = G.moves <= 3;
      nine("btn_stone", W - 76, TOP + 23, 46, 20, 7);
      img("i_moves", W - 72, TOP + 25);
      text(String(G.moves), W - 46, TOP + 32, 10, low ? (Math.floor(st.time * 4) % 2 ? COL.red : COL.cream) : COL.cream);
    }
    // goals
    if (!G.zen) {
      let gx = 12;
      lv.goals.forEach((g, i) => {
        const done = G.prog[i] >= g.need;
        const w = 50;
        rect(gx, TOP + 22, w, 20, done ? "rgba(147,196,90,0.45)" : "rgba(194,177,153,0.45)");
        if (g.type === "bloom") img(`m_${g.sp}_1`, gx + 2, TOP + 25);
        else if (g.type === "score") img("i_star", gx + 2, TOP + 26);
        else img(g.type === "stone" ? "stone" : g.type, gx + 1, TOP + 22, 18, 18);
        const left = Math.max(0, g.need - G.prog[i]);
        if (done) img("i_check", gx + 26, TOP + 26);
        else text(g.type === "score" ? String(left) : String(left), gx + 34, TOP + 32, g.type === "score" && left > 999 ? 7 : 9, COL.brown, "center", null);
        gx += w + 4;
      });
    } else {
      text(`${t("streak")} ${G.streak}`, W - 52, TOP + 32, 8, "#875432", "center", null);
    }
    // buttons on the right of the top line
    iconButton(W - 26, TOP + 2, "i_pause", () => { st.paused = true; st.settings = true; });
    button(W - 49, TOP + 2, 20, 20, "?", () => openHelp(), { skin: "btn_wood", size: 10 });
  }

  function drawBoard() {
    const ox = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0, oy = st.shake ? (Math.random() - 0.5) * st.shake * 3 : 0;
    ctx.save();
    ctx.translate(Math.round(ox), Math.round(oy));
    // shadow + frame
    rect(BX + 3, BY + 5, 232, 232, "rgba(31,22,34,0.35)");
    nine("frame", BX, BY, 232, 232, 10);
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      const v = (Math.floor(x / 3) + Math.floor(y / 3)) % 2;
      img("cell_" + v, cellX(x), cellY(y));
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
        img(`p_${c.sp}_${stageOf(c)}`, X, Y);
        // subtle sway on lush plants
      } else if (c.k === "stone") img("stone", X, Y);
      else if (c.k === "stone2") img("stone_cracked", X, Y);
      else if (c.k === "weed") img("weed_" + (Math.floor(st.time * 2 + x) % 2), X, Y);
      else if (c.k === "plastic") img("plastic", X, Y);
      else if (c.k === "mush") img("mushroom", X, Y);
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
        if (X >= 0 && Y >= 0 && X < 9 && Y < 9) img(`p_${pc.sp}_0`, cellX(X), cellY(Y));
      }
      ctx.globalAlpha = 1;
    }
    // bloom pops
    for (const f of st.fx) {
      if (f.t < 0) { img(`p_${f.sp}_${f.stage}`, f.x, f.y); continue; }
      const k = f.t / 0.55;
      const s = 1 + Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35;
      ctx.globalAlpha = Math.max(0, 1 - k * k);
      const sz = CELL * s;
      img(`p_${f.sp}_${f.stage}`, f.x + 12 - sz / 2, f.y + 12 - sz / 2, sz, sz);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawPiece(pc, cx, cy, size, imgPrefix) {
    const w = pc.p.wd * size, h = pc.p.ht * size;
    for (const [x, y] of pc.p.cells) img(imgPrefix(pc), cx - w / 2 + x * size, cy - h / 2 + y * size);
  }
  function drawTray() {
    // soft panel behind the tray
    ctx.fillStyle = "rgba(31,22,34,0.5)";
    ctx.fillRect(4, TY - 2, W - 8, 80);
    for (let s = 0; s < 3; s++) {
      const pc = G.tray[s];
      const cx = slotX(s), cy = TY + 39;
      rect(cx - 37, TY + 2, 74, 72, "rgba(244,236,217,0.08)");
      if (!pc || (G.drag && G.drag.slot === s)) continue;
      const fits = fitsAnywhere(pc);
      ctx.globalAlpha = fits ? 1 : 0.4;
      drawPiece(pc, cx, cy, MINI, (p) => `m_${p.sp}_1`);
      ctx.globalAlpha = 1;
    }
    // bottom bar: compost + deep breath
    const cr = compostRect();
    const hot = G.drag && G.drag.type === "user" && dropTarget(G.drag)?.compost;
    nine(hot ? "btn_gold" : "btn_wood", cr.x, cr.y, cr.w, cr.h, 7);
    img("i_compost", cr.x + 6, cr.y + 4);
    for (let i = 0; i < 3; i++) img(i < G.compost ? "i_leaf" : "i_star_off", cr.x + 24 + i * 15, cr.y + 4, 13, 13);
    // breath button (hold)
    const bx = W - 104, by = cr.y;
    const used = G.breathUsed || !G.history;
    button(bx, by, 94, 24, t("breathe"), null, {
      skin: used ? "btn_stone" : "btn_pink", size: 7, icon: "i_breath",
      hold: (down) => {
        if (down) { if (G.breathUsed) toast(t("breatheUsed")); else if (!G.history) toast(t("breatheNone")); else { G.breath = { t: 0 }; A.sfx.breathe(true); } }
        else if (G.breath) { G.breath = null; }
      },
    });
    // the dragged piece follows the finger at full size
    if (G.drag) {
      const pc = G.tray[G.drag.slot];
      if (pc) {
        const x = G.drag.x + G.drag.ox, y = G.drag.y + G.drag.oy;
        ctx.globalAlpha = 0.95;
        drawPiece(pc, x, y, CELL, (p) => `p_${p.sp}_0`);
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
      img("bee_" + (Math.floor(st.time * 14 + b.ph) % 2), b.x - 5, b.y - 4);
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
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 4);
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
      nine("panel", W / 2 - 110, BY + 96, 220, 18 + lines.length * 10, 10);
      lines.forEach((l, i) => text(l, W / 2, BY + 108 + i * 10, 8, COL.brown, "center", null));
      ctx.globalAlpha = 1;
    }
    if (G.breath) drawBreath(dt);
    if (st.demo) {
      text(t("demo"), W / 2, BB + 38 > H - 6 ? H - 8 : BB + 38, 8, COL.gold);
    }
    if (G.over) drawOver(dt);
  }

  function drawBreath(dt) {
    G.breath.t += dt;
    const T = G.breath.t, D = 2.4;
    const k = T < D / 2 ? T / (D / 2) : 1 - (T - D / 2) / (D / 2);
    ctx.fillStyle = "rgba(27,42,78,0.45)";
    ctx.fillRect(0, 0, W, H);
    const r = 18 + k * 40;
    ctx.beginPath(); ctx.arc(W / 2, BY + 116, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(189,224,248,0.35)"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#bde0f8"; ctx.stroke();
    text(T < D / 2 ? (save.lang === "sr" ? "udah…" : "breathe in…") : (save.lang === "sr" ? "izdah…" : "breathe out…"), W / 2, BY + 116, 9, COL.cream);
    if (T > D / 2 && T - dt <= D / 2) A.sfx.breathe(false);
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
    const y = G.tut === 0 ? TY - 30 : BY - 2 + 232 - 30;
    nine("panel", W / 2 - 105, y - 4, 210, 12 + lines.length * 10, 10);
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
      overlayPanel(t("win"), t("winSub"), 180);
      const cy = H / 2 - 30;
      for (let i = 0; i < 3; i++) {
        const on = i < G.stars && G.starT > 0.3 + i * 0.35;
        if (on && !G["s" + i]) { G["s" + i] = true; A.sfx.star(i); sparks(W / 2 - 36 + i * 36, cy + 11, 12); }
        img(on ? "star_big" : "star_big_off", W / 2 - 47 + i * 36, cy);
      }
      text(`${t("score")} ${G.score}`, W / 2, cy + 38, 10, COL.brown, "center", null);
      const summit = G.lv.summit;
      button(W / 2 - 100, cy + 56, 96, 26, t("map"), () => { st.mode = "map"; st.page = Math.floor((G.n - 1) / 10); }, { skin: "btn_wood", size: 9, icon: "i_map" });
      button(W / 2 + 4, cy + 56, 96, 26, t("next"), () => {
        if (summit) { st.mode = "camp"; A.sfx.chime(); } else newGame(G.n + 1);
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
    overlayPanel(G.over === "moves" ? t("loseMoves") : t("lose"), t("loseSub"), canBreathe ? 172 : 128);
    const cy = H / 2 - 30;
    let y = cy + 6;
    if (!G.breathUsed && G.history && G.over === "full") {
      button(W / 2 - 70, y, 140, 26, t("breathe"), null, {
        skin: "btn_pink", size: 8, icon: "i_breath",
        hold: (down) => { if (down) { G.breath = { t: 0 }; A.sfx.breathe(true); } else G.breath = null; },
      });
      text(t("breatheHold"), W / 2, y + 34, 7, "#875432", "center", null);
      y += 44;
    }
    button(W / 2 - 100, y + 6, 96, 26, t("map"), () => { st.mode = "map"; st.page = Math.floor((G.n - 1) / 10); }, { skin: "btn_wood", size: 9, icon: "i_map" });
    button(W / 2 + 4, y + 6, 96, 26, t("retry"), () => newGame(G.n), { skin: "btn_green", size: 9, icon: "i_retry" });
  }
  function overlayPanel(title, sub, ph = 150) {
    ctx.fillStyle = "rgba(31,22,34,0.45)";
    ctx.fillRect(0, 0, W, H);
    nine("panel", 16, H / 2 - 92, W - 32, ph, 10);
    text(title, W / 2, H / 2 - 72, 15, "#a5303a", "center", null);
    text(sub, W / 2, H / 2 - 54, 8, "#875432", "center", null);
  }

  // ---------- pause / settings
  function drawSettings() {
    ctx.fillStyle = "rgba(31,22,34,0.5)";
    ctx.fillRect(0, 0, W, H);
    const inPlay = st.mode === "play" && G && !G.over && !st.demo;
    const ph = inPlay ? 252 : 196;
    const py = H / 2 - ph / 2;
    nine("panel", 20, py, W - 40, ph, 10);
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
    y += 30;
    if (inPlay) {
      button(36, y, W - 72, 24, t("resume"), () => { st.settings = false; st.paused = false; }, { skin: "btn_green", size: 9, icon: "i_play" });
      y += 28;
      button(36, y, (W - 76) / 2, 24, t("retry"), () => { st.settings = false; newGame(G.n, { zen: G.zen }); }, { skin: "btn_wood", size: 8, icon: "i_retry" });
      button(40 + (W - 76) / 2, y, (W - 76) / 2, 24, G.zen ? t("home") : t("map"), () => {
        st.settings = false; st.paused = false;
        if (G.zen) { st.mode = "title"; G = null; } else { st.mode = "map"; st.page = Math.floor((G.n - 1) / 10); }
      }, { skin: "btn_wood", size: 8, icon: G.zen ? "i_home" : "i_map" });
      y += 30;
    }
    const armed = st.resetArm > st.time;
    button(36, y, W - 72, 20, armed ? t("resetSure") : t("reset"), () => {
      if (armed) { const lang = save.lang; Object.assign(save, { unlocked: 1, stars: {}, zenBest: 0, tutDone: false, lang }); persist(); st.resetArm = 0; st.settings = false; st.mode = "title"; G = null; }
      else st.resetArm = st.time + 3;
    }, { skin: "btn_stone", size: 7 });
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
    nine("panel", px, py, pw, ph, 10);
    text(`${t("help")} · ${st.help.page + 1}/${pages.length}`, W / 2, py + 14, 7, "#875432", "center", null);
    text(pg.title, W / 2, py + 28, 13, "#a5303a", "center", null);
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
    const cols = ["#2c7a6c", "#bf5a1d", "#a5303a"];
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
  function miniCell(x, y, s, v) { img("cell_" + v, x, y, s, s); }
  function helpVideo(page, x, y, w, h, T) {
    rect(x, y, w, h, "#264a30");
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
      nine("panel", x + 10, y + 14, w - 20, 40, 10);
      const k = Math.floor(loop(4) * 3);
      img("m_lavender_1", x + 22, y + 27);
      text(String(Math.max(0, 8 - k)), x + 52, y + 34, 10, COL.brown, "center", null);
      img("stone", x + 70, y + 24, 18, 18);
      text(String(Math.max(0, 3 - Math.floor(k / 3))), x + 98, y + 34, 10, COL.brown, "center", null);
      nine("btn_stone", x + w - 66, y + 24, 46, 20, 7);
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
      nine("btn_wood", x + 12, y + h - 36, 78, 24, 7);
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
      img("bg_alpine", x, y, w, 560 * (w / 252));
      for (let i = 0; i < 4; i++) img(i < 2 ? "sign_done" : i === 2 ? "sign_current" : "sign_locked", x + 16 + i * 44, y + h - 30 - i * 18);
      img("flag", x + w - 34, y + 8);
      const hx = x + 16 + ((T * 20) % 130), hy = y + h - 40 - ((T * 20) % 130) * 0.4;
      img("hiker_" + (Math.floor(T * 4) % 4), hx + 10, hy - 10);
    }
  }

  // ---------------------------------------------------------------- loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    st.time += dt;
    st.idle += dt;
    st.buttons = [];
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = false;
    updateFlies(dt);
    updateParts(dt);
    if (st.mode === "lang") drawLang();
    else if (st.mode === "title") {
      drawTitle();
      if (st.idle > 20 && !st.help && !st.settings) startDemo();
    } else if (st.mode === "map") drawMap();
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
  ready.then(() => document.fonts && Promise.all([document.fonts.load('400 14px "Jersey 10"'), document.fonts.load('400 14px "Jersey 10"', "šđčćž")])).catch(() => {}).then(() => {
    st.mode = save.lang ? "title" : "lang";
    requestAnimationFrame(frame);
  });

  // test hooks (used by automated checks)
  window.__pp = { st, get G() { return G; }, save, newGame, place, bestMove, startDemo, geo: () => ({ TOP, BX, BY, TY, BB, H }) };
})();
