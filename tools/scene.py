"""Painted pixel-art landscapes for Petal Peaks (252x640, anchored to the bottom of the screen).

Each scene is built back to front from continuous fields (noise, slopes, depth) that are
posterised onto small hand-picked colour ramps, so shapes stay organic but colours stay clean.
"""
import math
import random

import numpy as np

W, H = 252, 640


def hx(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.uint8)


def pal(cols):
    return np.array([hx(c) for c in cols], dtype=np.uint8)


def grid(seed, gw=64, gh=64):
    return np.random.RandomState(seed % (2 ** 31)).rand(gh, gw)


def samp(g, X, Y):
    gh, gw = g.shape
    x0 = np.floor(X).astype(int)
    y0 = np.floor(Y).astype(int)
    fx = X - x0
    fy = Y - y0
    fx = fx * fx * (3 - 2 * fx)
    fy = fy * fy * (3 - 2 * fy)
    x0 %= gw
    y0 %= gh
    x1 = (x0 + 1) % gw
    y1 = (y0 + 1) % gh
    return (g[y0, x0] * (1 - fx) + g[y0, x1] * fx) * (1 - fy) + (g[y1, x0] * (1 - fx) + g[y1, x1] * fx) * fy


def fbm(X, Y, seed, sx, sy, octv=4):
    out, amp, tot = 0, 1.0, 0
    for o in range(octv):
        out = out + amp * samp(grid(seed + o * 13), X / sx, Y / sy)
        tot += amp
        amp *= 0.5
        sx /= 2
        sy /= 2
    return out / tot


def smooth(a, s):
    k = np.exp(-0.5 * (np.arange(-3 * s, 3 * s + 1) / s) ** 2)
    k /= k.sum()
    return np.convolve(np.pad(a, (3 * s, 3 * s), mode="edge"), k, "valid")


class Scene:
    def __init__(self, P, seed):
        self.P, self.seed = P, seed
        self.X, self.Y = np.meshgrid(np.arange(W, dtype=float), np.arange(H, dtype=float))
        self.img = np.zeros((H, W, 3), np.uint8)
        self.rng = random.Random(seed)
        self.hor = P.get("hor", 345)

    # ------------------------------------------------------------ sky
    def sky(self):
        P, X, Y = self.P, self.X, self.Y
        sky = pal(P["sky"])
        t = Y / (self.hor - 10) + (fbm(X, Y, self.seed, 90, 16, 3) - 0.5) * 0.12
        self.img[:] = sky[np.clip((t * len(sky)).astype(int), 0, len(sky) - 1)]
        if "sun" in P:
            sx, sy, r, cols = P["sun"]
            d = np.hypot(X - sx, Y - sy)
            for rr, c in ((r * 2.4, cols[2]), (r * 1.6, cols[1]), (r, cols[0])):
                self.img[d < rr] = hx(c)

    def clouds(self, seed2, ybase, spread, thr, scale):
        if "cloud" not in self.P:
            return
        X, Y = self.X, self.Y
        cols = pal(self.P["cloud"])

        def field(yy):
            c = fbm(X, yy, seed2, scale, scale * 0.5, 4)
            up = np.clip(1 - (ybase - yy) / spread, 0, 1)
            down = np.clip(1 - (yy - ybase) / (spread * 0.3), 0, 1)
            return c * 0.62 + np.where(yy < ybase, up, down) * 0.5

        f = field(Y)
        m = f > thr
        s = f - field(Y - 6)
        tone = np.where(s > 0.012, 0, np.where(s < -0.03, 2, 1))
        tone = np.where((f - thr) < 0.035, np.minimum(tone, 1), tone)
        self.img[m] = cols[tone][m]

    # ------------------------------------------------------------ mountains
    def ridge(self, seed2, base, amp, sc, ridged=True, octv=5, mesa=False):
        xs = np.arange(W + 80, dtype=float)
        out, a, tot, s = 0, 1.0, 0, sc
        for o in range(octv):
            v = samp(grid(seed2 + o * 7, 256, 2), xs / s, np.zeros_like(xs))
            if ridged:
                v = 1 - np.abs(2 * v - 1)
            out = out + a * v
            tot += a
            a *= 0.5
            s /= 2
        v = out / tot
        if mesa:
            st = np.floor(v * 4 + 0.5) / 4
            v = st + (v - st) * 0.12
        return base - amp * v

    def mountains(self, seed2, base, amp, sc, cols, snow=0, strata=False, mesa=False):
        X, Y = self.X, self.Y
        r = self.ridge(seed2, base, amp, sc, ridged=not mesa, mesa=mesa)
        rr = r[:W]
        D = Y - rr[None, :]
        m = D >= 0
        slopes = [np.gradient(smooth(r, s)) for s in (2, 5, 9, 15)]
        warp = (fbm(X, Y, seed2 + 3, 26, 26, 3) - 0.5) * 16
        lvl = np.clip((D / 16).astype(int), 0, 3)
        xi = np.clip((X + D * 0.3 + warp).astype(int), 0, W + 79)
        S = np.zeros_like(X)
        for i, sl in enumerate(slopes):
            S = np.where(lvl == i, sl[xi], S)
        lit = S < 0.02
        u = np.where(lit, X + D * 0.9, X - D * 0.9)
        n = fbm(u, D, seed2 + 9, 9, 34, 3)
        cols = pal(cols)
        if strata:
            band = ((Y + (fbm(X, Y, seed2 + 5, 60, 8, 2) - 0.5) * 10) / 5).astype(int)
            k = (band * 7 + band // 3) % 4
            tone = np.where(lit, 4 + k, k)
        else:
            tone = np.where(lit, np.where(n > 0.6, 3, 2), np.where(n < 0.4, 0, 1))
            if snow:
                top = rr.min()
                alt = np.clip((base - amp * 0.35 - rr[None, :]) / (amp * 0.5), 0, 1.2)
                sf = alt * 1.1 - D / snow + (n - 0.5) * 1.5
                sn = sf > 0.2
                tone = np.where(sn, np.where(lit, 5, 4), tone)
        self.img[m] = cols[tone][m]
        return rr

    def hills(self, seed2, base, amp, sc, cols, tips=3):
        X, Y = self.X, self.Y
        r = self.ridge(seed2, base, amp, sc, ridged=False, octv=3)[:W]
        rng = random.Random(seed2)
        saw = np.array([(tips if i % 5 == 2 else (tips // 2 if i % 5 in (1, 3) else 0)) + rng.choice((0, 0, 1)) for i in range(W)])
        rr = r - saw
        D = Y - rr[None, :]
        m = D >= 0
        n = fbm(X, Y, seed2 + 5, 22, 9, 3)
        tone = np.where(n > 0.57, 2, np.where(n < 0.43, 0, 1))
        tone = np.where((D < 2) & (X % 5 < 2), 2, tone)
        self.img[m] = pal(cols)[tone][m]
        return r

    # ------------------------------------------------------------ trees
    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H:
            self.img[y, x] = c

    def pine(self, cx, base, h, cols, detail=True):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        hi = hx(cols[3]) if len(cols) > 3 else light
        rng = self.rng
        tiers = int(max(4, min(13, h / 9)))
        jit = [rng.uniform(0.82, 1.12) for _ in range(tiers + 2)]
        tw = max(1, int(h / 28))
        for yy in range(int(h * 0.12)):
            for xx in range(-tw, tw + 1):
                self.px(cx + xx, base - yy, hx("#2b1d18") if xx >= 0 else hx("#4a3226"))
        hh = int(h * 0.95)
        for row in range(hh):
            t = row / hh
            tp = (t * tiers) % 1
            w = (t ** 0.8) * h * 0.2 * (0.35 + 0.65 * tp ** 0.8) * jit[int(t * tiers)] + 0.5
            if h > 22:
                w += rng.uniform(-0.8, 0.8) + (1.5 if (row % 3 == 0 and h > 80) else 0)
            y = base - int(h * 0.08) - hh + row
            for x in range(int(math.floor(cx - w)), int(math.ceil(cx + w)) + 1):
                rel = (x - cx) / max(w, 1)
                if abs(rel) > 1:
                    continue
                if not detail:
                    c = mid if rel < 0.1 and tp > 0.3 else dark
                elif tp < 0.25 or rel > 0.4 or (h > 80 and (x * 5 + row * 3) % 11 < 3):
                    c = dark
                elif rel < -0.2 and tp > 0.55:
                    c = hi if (tp > 0.8 and rel < -0.5 and (x + row) % 2 == 0) else light
                else:
                    c = mid if (x * 3 + row) % 7 else dark
                self.px(x, y, c)
            if detail and tp > 0.9 and h > 30:
                self.px(cx - w - 1, y + 1, mid)
                self.px(cx + w + 1, y + 1, dark)

    def cypress(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        for row in range(h):
            t = row / h
            w = math.sin(min(1, t * 1.08) * math.pi) ** 0.6 * min(h * 0.13, 11) + 0.4
            for x in range(int(cx - w), int(cx + w) + 1):
                rel = (x - cx) / max(w, 1)
                c = light if rel < -0.3 and (x + row) % 3 else (dark if rel > 0.3 or (x + row * 2) % 5 == 0 else mid)
                self.px(x, base - h + row, c)
        self.px(cx, base, hx("#2b1d18"))
        self.px(cx, base + 1, hx("#2b1d18"))

    def cactus(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        bw = max(2, h // 7)

        def col(x0, y0, y1, w):
            for y in range(int(y0), int(y1) + 1):
                for x in range(-w, w + 1):
                    self.px(x0 + x, y, light if x < 0 and x > -w else (dark if x == w else mid))
            for x in range(-w + 1, w):
                self.px(x0 + x, y0 - 1, mid)
        col(cx, base - h, base, bw)
        for side, ah, top in ((-1, 0.45, 0.8), (1, 0.6, 0.95)):
            ax = cx + side * (bw * 2 + 2)
            for x in range(min(cx, ax), max(cx, ax) + 1):
                for k in range(max(1, bw - 1)):
                    self.px(x, base - h * ah + k, mid)
            col(ax, base - h * top, base - h * ah, max(1, bw - 1))

    def palm(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        lean = self.rng.choice((-1, 1)) * self.rng.uniform(0.12, 0.3)
        for i in range(h):
            x = cx + lean * h * (i / h) ** 2
            self.px(x, base - i, hx("#6b4a34") if i % 3 else hx("#8a6444"))
            if h > 30:
                self.px(x + 1, base - i, hx("#4a3226"))
            if h > 70:
                self.px(x - 1, base - i, hx("#8a6444") if i % 4 else hx("#6b4a34"))
                self.px(x + 2, base - i, hx("#3a261c"))
        tx, ty = cx + lean * h, base - h
        for ang in (-2.9, -2.4, -1.9, -1.2, -0.7, -0.2, 0.25, 2.9):
            L = int(h * 0.5)
            for d in range(L):
                fx = tx + math.cos(ang) * d
                fy = ty + math.sin(ang) * d * 0.55 + (d * d) / (h * 0.75)
                self.px(fx, fy, light if math.cos(ang) < 0 else mid)
                self.px(fx, fy + 1, mid if math.cos(ang) < 0 else dark)
                if d % 2 == 0 and d > 2:
                    self.px(fx, fy + 2, dark)

    def tree(self, kind, cx, base, h, cols, detail=True):
        if kind == "cypress":
            self.cypress(cx, base, int(h * 1.1), cols)
        elif kind == "cactus":
            self.cactus(cx, base, max(6, int(h * 0.45)), cols)
        elif kind == "palm":
            self.palm(cx, base, int(h * 0.9), cols)
        else:
            self.pine(cx, base, h, cols, detail)

    # ------------------------------------------------------------ ground
    def ground(self):
        P, X, Y, hor = self.P, self.X, self.Y, self.hor
        g = self.Y >= hor
        p = np.clip((Y - hor) / (H - hor), 0, 1)
        self.p = p
        med = pal(P["meadow"])
        n = fbm(X, Y, self.seed + 50, 70, 11, 4)
        tone = np.clip(((n * 0.9 + 0.05 + 0.12 * (1 - p)) * len(med)).astype(int), 0, len(med) - 1)
        self.img[g] = med[tone][g]
        self.water = np.zeros_like(g)
        wc = pal(P["water"])
        if P.get("rows"):
            lav = pal(P["rows"])
            u = (X - W * 0.5) / np.maximum(Y - hor + 12, 1)
            s = (u * 5.5 + 0.5) % 1
            ln = fbm(X, Y, self.seed + 70, 5, 4, 2)
            rowm = (s < 0.62) & g & (Y > hor + 8)
            tone = np.where(s < 0.16, 3, np.where(ln > 0.55, 2, np.where(ln > 0.4, 1, 0)))
            tone = np.where(s > 0.5, 0, tone)
            self.img[rowm] = lav[tone][rowm]
        if P.get("terrace"):
            lev = 62 * np.log1p(np.maximum(Y - hor, 0) / 26) + 5 * np.sin(X / 47 + 1) + (fbm(X, Y, self.seed + 80, 110, 110, 2) - 0.5) * 22
            f = (lev % 18)
            wn = fbm(X, Y, self.seed + 81, 30, 2, 2)
            wt = np.where(wn > 0.62, 3, np.where(wn > 0.5, 2, np.where(wn > 0.38, 1, 0)))
            tm = g & (Y > hor + 6)
            wat = tm & (f >= 4) & (f < 12)
            self.img[wat] = wc[wt][wat]
            rim = tm & (f < 4)
            self.img[rim] = med[np.where(f < 1.5, 4, 3)][rim]
            ris = tm & (f >= 12)
            self.img[ris] = med[np.where(f > 16, 0, 1)][ris]
            # rice shoots
            sh = wat & ((X.astype(int) * 3 + (lev // 18).astype(int)) % 7 == 0) & (Y.astype(int) % 4 == 1) & (p > 0.25)
            self.img[sh] = med[4]
            self.water = wat
        if P.get("lake"):
            y0, lh = hor + P["lake"][0], P["lake"][1]
            shore = y0 + lh + 7 * np.sin(np.arange(W) / 31 + 1) + (fbm(np.arange(W, dtype=float), np.zeros(W), self.seed + 61, 20, 1, 2) - 0.5) * 12
            mid = wc[1].astype(float)
            allc = np.concatenate([wc, pal(P["far"]), pal(P["hill1"]), pal(P["hill2"])]).astype(float)
            for y in range(y0, y0 + lh + 16):
                src = max(0, int(y0 - 2 - (y - y0) * 1.5))
                row = np.roll(self.img[src], int(round(math.sin(y * 1.9) * 2)), axis=0).astype(float) * 0.62 + mid * 0.38
                d = ((row[:, None, :] - allc[None, :, :]) ** 2).sum(-1)
                row = allc[d.argmin(1)].astype(np.uint8)
                mk = np.arange(W)[None, :][0] >= 0
                mk = y < shore
                wn = fbm(np.arange(W, dtype=float), np.full(W, float(y)), self.seed + 62, 28, 1.5, 2)
                row[wn > 0.66] = wc[3]
                row[(wn < 0.3)] = wc[0]
                self.img[y][mk] = row[mk]
                self.water[y][mk] = True
            edge = (Y >= shore[None, :]) & (Y < shore[None, :] + 2)
            self.img[edge] = med[0]
        if P.get("river") is not None:
            ph = P["river"]
            cx = W * 0.5 + np.sin(p * 4.4 + ph) * W * (0.08 + 0.3 * p) + p * 24
            hw = 1.2 + p ** 1.35 * 44
            wd = np.abs(X - cx) - hw
            water = (wd < 0) & (Y >= hor + 3)
            wn = fbm(X, Y, self.seed + 60, 44, 2.4, 3)
            wt = np.where(wn > 0.64, 3, np.where(wn > 0.5, 2, np.where(wn > 0.36, 1, 0)))
            wt = np.where((wd > -2 - p * 7) & (X < cx), 0, wt)
            self.img[water] = wc[wt][water]
            bank = (wd >= 0) & (wd < 1.2 + p * 2.5) & g
            self.img[bank] = hx(P.get("bank", "#3a3326"))
            sand = (wd >= 1.2 + p * 2.5) & (wd < 3 + p * 7) & g & (fbm(X, Y, self.seed + 63, 16, 5, 2) > 0.55)
            self.img[sand] = hx(P.get("sand", "#c9b88a"))
            self.water = water | bank
            self.cx, self.hw = cx, hw

    def free(self, x, y, r=4):
        x, y = int(x), int(y)
        if not (0 <= x < W and 0 <= y < H):
            return True
        return not self.water[y, max(0, x - r):x + r + 1].any()

    def rock(self, cx, cy, r):
        c = pal(self.P.get("rock", ["#55525a", "#86817a", "#aea591", "#cdc5ae"]))
        moss = pal(self.P["meadow"])
        rng = self.rng
        k = [rng.uniform(0.75, 1.1) for _ in range(8)]
        for y in range(int(cy - r), int(cy + r * 0.7) + 1):
            for x in range(int(cx - r * 1.3), int(cx + r * 1.3) + 1):
                dx, dy = (x - cx) / (r * 1.25), (y - cy) / r
                a = math.atan2(dy, dx)
                rad = k[int((a + math.pi) / (2 * math.pi) * 8) % 8]
                d = math.hypot(dx, dy * (1.3 if dy > 0 else 1))
                if d > rad:
                    continue
                l = -dx * 0.5 - dy * 0.8
                tone = 3 if l > 0.55 else 2 if l > 0.15 else 1 if l > -0.35 else 0
                col = c[tone]
                if dy < -0.45 and (x * 7 + y * 3) % 5 < 2 and r > 4:
                    col = moss[3]
                self.px(x, y, col)
        for x in range(int(cx - r * 1.2), int(cx + r * 1.2)):
            self.px(x, cy + r * 0.7 + 1, moss[0])

    def details(self):
        P, hor, rng = self.P, self.hor, self.rng
        med = pal(P["meadow"])
        fl = pal(P.get("flowers", ["#f4e04a", "#ffffff"]))
        skip = P.get("rows") or P.get("terrace")
        # grass tufts
        for _ in range(0 if P.get("terrace") else 900):
            y = hor + 6 + int((H - hor - 8) * rng.random() ** 0.8)
            x = rng.randrange(W)
            if not self.free(x, y, 1):
                continue
            if P.get("rows") and rng.random() < 0.8:
                continue
            pz = (y - hor) / (H - hor)
            hgt = 1 + int(pz * 4 * rng.random() + 0.5)
            col = med[rng.choice((3, 4, 4, 1))]
            for k in range(hgt):
                self.px(x, y - k, col)
            if hgt > 2:
                self.px(x + 1, y - hgt + 1, col)
                self.px(x - 1, y, med[0])
        # flower drifts
        for _ in range(0 if skip else 26):
            y = hor + 14 + int((H - hor - 20) * rng.random())
            x = rng.randrange(W)
            c = fl[rng.randrange(len(fl))]
            pz = (y - hor) / (H - hor)
            for _ in range(int(5 + pz * 16)):
                fx, fy = x + rng.gauss(0, 7 + pz * 10), y + rng.gauss(0, 2 + pz * 3)
                if self.free(fx, fy, 1) and fy > hor + 4:
                    self.px(fx, fy, c)
                    if pz > 0.5 and rng.random() < 0.5:
                        self.px(fx + 1, fy, c)
        # rocks
        for _ in range(P.get("rocks", 7)):
            y = hor + 20 + int((H - hor - 30) * rng.random())
            x = rng.randrange(W)
            pz = (y - hor) / (H - hor)
            r = 2 + pz * 9 * rng.uniform(0.6, 1.2)
            if self.free(x, y, int(r * 1.4)) or P.get("river") is not None and abs(x - self.cx[y, 0]) < self.hw[y, 0] + r * 2:
                self.rock(x, y, r)

    def forest(self):
        P, hor, rng = self.P, self.hor, self.rng
        kind = P.get("tree", "pine")
        lay = [
            (-8, 6, 9, 16, P.get("nfar", 60), P["tfar"], False, 0),
            (6, 34, 16, 28, P.get("nmid", 16), P["tmid"], True, 0),
            (40, 110, 34, 58, P.get("nnear", 8), P["tnear"], True, 1),
        ]
        items = []
        for (o0, o1, h0, h1, n, cols, det, edge) in lay:
            for _ in range(n):
                x = rng.randrange(-6, W + 6)
                if edge:
                    x = rng.choice((rng.randrange(-6, 70), rng.randrange(W - 70, W + 6)))
                y = hor + rng.randint(o0, o1) + int(6 * math.sin(x / 40))
                if not self.free(x, y, 6):
                    continue
                if (P.get("rows") or P.get("terrace")) and y > hor + 10 and rng.random() < 0.75:
                    continue
                items.append((y, x, rng.randint(h0, h1), cols, det))
        for (y, x, h, cols, det) in sorted(items):
            self.tree(kind, x, y, h, cols, det)

    def framing(self):
        P, hor = self.P, self.hor
        if P.get("frame", True) is False:
            return
        cols = P["tframe"]
        kind = P.get("tree", "pine")
        if kind in ("cactus",):
            self.cactus(14, hor + 250, 70, cols)
            self.cactus(W - 22, hor + 215, 54, cols)
            return
        if kind == "palm":
            self.palm(20, hor + 150, 110, cols)
            self.palm(W - 22, hor + 120, 90, cols)
            return
        if kind == "cypress":
            self.cypress(6, hor + 250, 210, cols)
            self.cypress(W - 8, hor + 225, 170, cols)
            return
        self.pine(-4, hor + 250, 330, cols)
        self.pine(W + 2, hor + 222, 280, cols)
        self.pine(30, hor + 268, 170, cols)
        self.pine(W - 30, hor + 286, 120, cols)

    def rays(self):
        P = self.P
        if not P.get("rays"):
            return
        X, Y = self.X, self.Y
        f = fbm(X, Y, self.seed + 90, 40, 40, 2)
        m = (((X * 0.9 + Y * 0.42 + f * 26) % 96) < 24) & (Y < self.hor + 150)
        warm = hx(P["rays"]).astype(float)
        self.img[m] = (self.img[m].astype(float) * 0.74 + warm * 0.26).astype(np.uint8)
        for _ in range(26):
            x, y = self.rng.randrange(W), self.rng.randrange(self.hor - 60, H - 10)
            self.px(x, y, hx("#fff7b0"))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                self.px(x + dx, y + dy, hx("#f3d860"))

    def render(self):
        P, s = self.P, self.seed
        self.sky()
        self.clouds(s + 1, self.hor - 120, 110, P.get("cthr", 0.72), 46)
        self.clouds(s + 2, 90, 70, 0.86, 30)
        hor = self.hor
        self.mountains(s + 10, hor - 10, P.get("amp", 190), 150, P["far"], snow=P.get("snow", 70), strata=P.get("mesa"), mesa=P.get("mesa"))
        self.mountains(s + 20, hor + 4, P.get("amp2", 105), 110, P["mid"], snow=P.get("snow2", 0), strata=P.get("mesa"), mesa=P.get("mesa"))
        self.hills(s + 30, hor - 6, 40, 90, P["hill1"])
        self.hills(s + 40, hor + 6, 26, 70, P["hill2"], tips=4)
        self.ground()
        self.forest()
        self.details()
        self.framing()
        self.rays()
        return self.img


BIOMES = {
    "meadow": dict(
        sky=["#7ea6d6", "#93b6de", "#a9c6e6", "#c1d6ea", "#dbe6ea"],
        cloud=["#f7f0e3", "#dcdad6", "#b7c3d6"],
        far=["#5b7fb4", "#6f93c4", "#8eaad0", "#a9bdd8", "#c4cfdc", "#eef0ee"],
        mid=["#44648f", "#5475a2", "#6687b2", "#7896bd", "#a9b9cf", "#d5dde6"],
        hill1=["#35576a", "#3f6577", "#4d7785"], hill2=["#2a4a4f", "#335a57", "#3f6b5c"],
        tfar=["#24403f", "#2e5046", "#3d6650"], tmid=["#1c342e", "#28493a", "#48733f", "#6f953f"],
        tnear=["#15261f", "#213f2f", "#4f7d38", "#86ad45"], tframe=["#0f1c18", "#182d24", "#34582f", "#5d8537"],
        meadow=["#3f6b2e", "#56843a", "#6f9d42", "#8db548", "#b4cb5c"],
        water=["#4f79b5", "#6f9bd0", "#93b9e2", "#dce9f2"], river=0.6,
        flowers=["#f4e04a", "#ffffff", "#e98bb0"],
    ),
    "lavender": dict(
        sky=["#5b4a8a", "#8a5a9a", "#c46a8e", "#ee8f7a", "#f9bf85", "#fde2a8"],
        sun=(74, 262, 13, ["#fff3c4", "#fdd98e", "#fbcb86"]),
        cloud=["#ffd9a6", "#f4a58a", "#b9709a"],
        far=["#6a4a8e", "#7d5a9e", "#9a74b2", "#b48cc0", "#d9a9c4", "#f6cdbf"], amp=150, snow=45,
        mid=["#4e3a78", "#5d4688", "#70569a", "#8468aa", "#a784b8", "#c8a0c4"],
        hill1=["#3c3a66", "#48466f", "#57547c"], hill2=["#2e3a4c", "#36474f", "#425a54"],
        tree="cypress", tfar=["#252f3c", "#2f3f42", "#3f564a"], tmid=["#1c2b2c", "#28413a", "#4b6e3e"],
        tnear=["#172424", "#223831", "#456a3a"], tframe=["#101a1c", "#182926", "#31502f"],
        meadow=["#34552f", "#48703a", "#5f8a40", "#7fa348", "#a9b95a"],
        rows=["#3f3277", "#6a54ae", "#8f79d0", "#c3b2f0"], water=["#4f79b5", "#6f9bd0", "#93b9e2", "#dce9f2"],
        nmid=10, nnear=6, rocks=3,
    ),
    "alpine": dict(
        sky=["#4e7fc4", "#6594d2", "#82abde", "#a4c3e8", "#c9dcf0"],
        cloud=["#ffffff", "#dfe7f0", "#b4c4dc"],
        far=["#5c6f8f", "#72849f", "#8e9cb0", "#a9b3c0", "#cfd9e6", "#ffffff"], amp=250, snow=120,
        mid=["#4a5c78", "#5b6e88", "#70829a", "#8695aa", "#b9c6d6", "#e6edf4"], amp2=140, snow2=45,
        hill1=["#3a5560", "#46656c", "#557a78"], hill2=["#2c4648", "#375752", "#45695a"],
        tfar=["#243c3c", "#2f4d45", "#3f6350"], tmid=["#1b322c", "#284838", "#47703e", "#6c9040"],
        tnear=["#14251e", "#203c2d", "#4a7837", "#7fa644"], tframe=["#0e1b17", "#172b22", "#32552e", "#587f36"],
        meadow=["#4a6e3a", "#5f8545", "#789b4e", "#95b15a", "#bcc878"],
        water=["#3f6fa8", "#5a8cc4", "#86b2de", "#e4f0f8"], lake=(14, 60),
        flowers=["#ffffff", "#f4e04a", "#7db2e6"], nmid=12, rocks=10,
    ),
    "forest": dict(
        sky=["#fbeaa6", "#f5d982", "#e3cb70", "#c3bd64", "#9fae5e"],
        far=["#6f9a5c", "#82ab62", "#9aba6a", "#b4c874", "#d9d98a", "#f3e9a4"], amp=140, snow=30,
        mid=["#4d7f52", "#5c8f58", "#70a05e", "#86b066", "#a9c474", "#c9d684"],
        hill1=["#356a4a", "#417a50", "#52905a"], hill2=["#27523c", "#316444", "#3f7a4e"],
        tfar=["#1f4a36", "#2a5c3e", "#3c7448"], tmid=["#173528", "#24503a", "#4f8a3e", "#8fbb48"],
        tnear=["#11281e", "#1c402e", "#488236", "#a3c44a"], tframe=["#0c1c15", "#142e21", "#2f5e2c", "#6d9a3a"],
        meadow=["#2f5e33", "#42783a", "#5a9340", "#7fb048", "#b9d058"],
        water=["#1f6f6f", "#2f9a8c", "#58c4a8", "#c9f0d0"], river=2.4, bank="#2a3a26", sand="#8fae5a",
        rays="#ffe89a", flowers=["#fff7b0", "#ffffff", "#f19cbd"], nfar=90, nmid=26, nnear=12,
    ),
    "canyon": dict(
        sky=["#3b2a5e", "#6a3a72", "#a84a6e", "#dd6e5e", "#f49a5c", "#fbc878"],
        sun=(168, 250, 14, ["#fff0b8", "#fdd486", "#f9be74"]),
        cloud=["#fbc08a", "#e88a72", "#a85a7a"], cthr=0.78,
        far=["#7a3a4a", "#8f4650", "#a55456", "#b9645c", "#c8643c", "#dd7e48", "#eb9a58", "#f4b470"], mesa=True, amp=170,
        mid=["#5e2c40", "#6f3646", "#82404c", "#964c52", "#a94e34", "#bf623c", "#d27a48", "#e0935a"], amp2=95,
        hill1=["#6b3a3c", "#7d4640", "#8f5446"], hill2=["#55303a", "#663a3c", "#774640"],
        tree="cactus", tfar=["#3a4a34", "#4a6040", "#64804c"], tmid=["#2d4a34", "#3f6a40", "#6a9a4c"],
        tnear=["#24402c", "#366238", "#62944a"], tframe=["#1a2e22", "#2a4a2e", "#4e7c3e"],
        meadow=["#8a5236", "#a66842", "#c0824e", "#d69c60", "#e8bb7c"],
        water=["#2c6f7a", "#3f97a0", "#6cc0bc", "#d6f0e0"], river=4.0, bank="#5a3226", sand="#f0d09a",
        rock=["#5e2c34", "#964c44", "#c8744c", "#ea9c64"], flowers=["#f19cbd", "#f4e04a"], nfar=24, nmid=10, nnear=6, rocks=12,
    ),
    "terraces": dict(
        sky=["#e77fa8", "#f09ab4", "#f6b6c2", "#fbd2cc", "#fde8d0"],
        cloud=["#ffffff", "#fbd9d6", "#e9a9c0"],
        far=["#4f8f8a", "#62a296", "#7ab4a2", "#96c6b0", "#bfdcc8", "#e6f2de"], amp=170, snow=30,
        mid=["#3b7a70", "#4a8c7c", "#5e9f88", "#76b294", "#9ccaaa", "#c2dfc0"],
        hill1=["#2f6a5a", "#3a7c62", "#4a906c"], hill2=["#245648", "#2e6850", "#3c7c5a"],
        tree="palm", tfar=["#1f4e3c", "#2a6046", "#3e7a50"], tmid=["#1e4634", "#2e6a42", "#6aa84a"],
        tnear=["#183a2a", "#285c38", "#62a044"], tframe=["#10281e", "#1c4228", "#488a3a"],
        meadow=["#3f7f3a", "#57993f", "#74b247", "#9aca55", "#c9e070"],
        water=["#d98aa6", "#f0aab8", "#fbd0cc", "#fff0e0"], terrace=True, nfar=30, nmid=10, nnear=6, rocks=0,
    ),
}


def render(key, seed):
    return Scene(BIOMES[key], seed).render()
