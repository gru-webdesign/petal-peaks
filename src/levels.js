// Petal Peaks — pieces, biomes and the endless level generator.
// window.Levels = { PIECES, BIOMES, SPECIES, make(n), rng(seed) }
(() => {
  "use strict";

  // seeded RNG (mulberry32)
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // pieces as cell lists [x, y]; weight = how often they show up
  const P = (w, ...rows) => {
    const cells = [];
    rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === "#") cells.push([x, y]); }));
    return { w, cells, wd: Math.max(...rows.map((r) => r.length)), ht: rows.length };
  };
  const PIECES = [
    P(5, "#"),
    P(6, "##"), P(6, "#", "#"),
    P(6, "###"), P(6, "#", "#", "#"),
    P(4, "####"), P(4, "#", "#", "#", "#"),
    P(2, "#####"), P(2, "#", "#", "#", "#", "#"),
    P(6, "##", "##"),
    P(3, "###", "###", "###"),
    P(4, "##", "#."), P(4, "##", ".#"), P(4, "#.", "##"), P(4, ".#", "##"),
    P(3, "###", "#.."), P(3, "###", "..#"), P(3, "#..", "###"), P(3, "..#", "###"),
    P(3, "##", "#.", "#."), P(3, "##", ".#", ".#"), P(3, "#.", "#.", "##"), P(3, ".#", ".#", "##"),
    P(3, "###", ".#."), P(3, ".#.", "###"), P(3, "#.", "##", "#."), P(3, ".#", "##", ".#"),
    P(2, "##.", ".##"), P(2, ".##", "##."), P(2, "#.", "##", ".#"), P(2, ".#", "##", "#."),
    P(2, "###", "#..", "#.."), P(2, "###", "..#", "..#"), P(2, "#..", "#..", "###"), P(2, "..#", "..#", "###"),
    P(2, "#.#", "###"), P(2, "###", "#.#"),
    P(1, ".#.", "###", ".#."),
  ];

  const SPECIES = ["lavender", "poppy", "daisy", "sunflower", "cornflower", "edelweiss", "cosmos", "marigold"];

  const BIOMES = [
    { key: "meadow",   species: ["daisy", "poppy", "cornflower", "cosmos"],      sky: "#8db6df", ink: "#264a30" },
    { key: "lavender", species: ["lavender", "sunflower", "poppy", "daisy"],     sky: "#f2a46a", ink: "#47306e" },
    { key: "alpine",   species: ["edelweiss", "cornflower", "daisy", "lavender"], sky: "#5d86c2", ink: "#2c2d3a" },
    { key: "forest",   species: ["cosmos", "daisy", "cornflower", "marigold"],   sky: "#78c9a8", ink: "#13363a" },
    { key: "canyon",   species: ["marigold", "sunflower", "cosmos", "poppy"],    sky: "#dc7568", ink: "#5a240f" },
    { key: "terraces", species: ["cosmos", "lavender", "marigold", "cornflower"], sky: "#f19cbd", ink: "#4f1a3a" },
  ];

  // Level n (1-based). Ten markers per biome, the tenth is the summit.
  function make(n) {
    const r = rng(n * 7919 + 17);
    const lap = Math.floor((n - 1) / 60);          // every 60 levels the whole trail repeats, harder
    const biome = Math.floor((n - 1) / 10) % BIOMES.length;
    const idx = (n - 1) % 10;                      // 0..9
    const summit = idx === 9;
    const B = BIOMES[biome];
    const diff = Math.min(1, (n - 1) / 80) + lap * 0.1; // 0 .. ~1.2
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const goals = [];
    const obstacles = [];   // { k, x, y }

    if (n === 1) {
      goals.push({ type: "bloom", sp: B.species[0], need: 6 });
      return { n, biome, idx, summit, moves: 18, goals, obstacles, weedEvery: 0, species: B.species.slice(0, 3), tutorial: true };
    }
    if (n === 2) {
      goals.push({ type: "bloom", sp: B.species[1], need: 8 });
      goals.push({ type: "score", need: 300 });
      return { n, biome, idx, summit, moves: 20, goals, obstacles, weedEvery: 0, species: B.species.slice(0, 3) };
    }

    // which obstacle types are unlocked by now
    const kinds = ["stone"];
    if (n >= 6) kinds.push("plastic");
    if (n >= 9) kinds.push("weed");
    const species = B.species.slice(0, n < 12 ? 3 : 4);

    // main bloom goal(s)
    const nGoals = summit ? 3 : (r() < 0.45 + diff * 0.3 ? 2 : 1);
    const used = new Set();
    let moves = 0;
    const sp1 = pick(species);
    used.add(sp1);
    const need1 = Math.round(8 + diff * 14 + r() * 5 + (summit ? 6 : 0));
    goals.push({ type: "bloom", sp: sp1, need: need1 });
    const per = species.length >= 4 ? 1.55 : 1.3;
    moves += need1 * per;

    const usedTypes = new Set();
    for (let g = 1; g < nGoals; g++) {
      let roll = r();
      const freeKinds = kinds.filter((k) => !usedTypes.has(k));
      if (roll < 0.35 && !freeKinds.length) roll = 0.5;
      if (roll >= 0.7 && usedTypes.has("score")) roll = 0.5;
      if (roll < 0.35) {
        const k = pick(freeKinds);
        usedTypes.add(k);
        const count = Math.round((k === "stone" ? 3 : 2) + diff * 4 + r() * 2);
        goals.push({ type: k, need: count });
        for (let i = 0; i < count; i++) obstacles.push({ k });
        moves += count * 2.4;
      } else if (roll < 0.7) {
        let sp2 = pick(species);
        if (used.has(sp2)) sp2 = species.find((s) => !used.has(s)) || sp2;
        used.add(sp2);
        const need2 = Math.round(6 + diff * 10 + r() * 4);
        goals.push({ type: "bloom", sp: sp2, need: need2 });
        moves += need2 * per * 0.6;
      } else {
        usedTypes.add("score");
        const need = Math.round((500 + diff * 1400 + r() * 300) / 50) * 50;
        goals.push({ type: "score", need });
        moves += need / 150;
      }
    }
    // a few extra obstacles even without a goal, to shape the board
    const extra = Math.floor(r() * (1 + diff * 3));
    for (let i = 0; i < extra; i++) obstacles.push({ k: "stone" });
    if (r() < 0.5) obstacles.push({ k: "mush" });

    moves = Math.round(moves * (1.08 - diff * 0.12) + 6);
    const weedEvery = kinds.includes("weed") && obstacles.some((o) => o.k === "weed") ? Math.max(3, 5 - Math.floor(diff * 2)) : 0;
    placeObstacles(obstacles, r);
    return { n, biome, idx, summit, moves, goals, obstacles, weedEvery, species };
  }

  // spread obstacles over the board, never two in the same row+column pair too densely
  function placeObstacles(list, r) {
    const taken = new Set();
    for (const o of list) {
      for (let tries = 0; tries < 60; tries++) {
        const x = Math.floor(r() * 9), y = Math.floor(r() * 9);
        const key = y * 9 + x;
        if (taken.has(key)) continue;
        // keep at least 2 free squares in each row so lines stay completable
        let rowCount = 0;
        for (const t of taken) if (Math.floor(t / 9) === y) rowCount++;
        if (rowCount >= 3) continue;
        taken.add(key);
        o.x = x; o.y = y;
        break;
      }
    }
  }

  window.Levels = { PIECES, BIOMES, SPECIES, make, rng };
})();
