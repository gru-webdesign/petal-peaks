"""Painted pixel-art landscapes for Petal Peaks (252x640, anchored to the bottom of the screen).

Each scene is built back to front from continuous fields (noise, slopes, depth) that are
posterised onto small hand-picked colour ramps, so shapes stay organic but colours stay clean.
"""
import math
import random

import numpy as np

W, H = 180, 457


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
    """Chunky, painterly scene: few big shapes, muted ramps, strong depth."""

    def __init__(self, P, seed):
        self.P, self.seed = P, seed
        self.X, self.Y = np.meshgrid(np.arange(W, dtype=float), np.arange(H, dtype=float))
        self.img = np.zeros((H, W, 3), np.uint8)
        self.rng = random.Random(seed)
        self.hor = P.get("hor", 250)

    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H:
            self.img[y, x] = c

    # ------------------------------------------------------------ sky + clouds
    def sky(self):
        P, X, Y = self.P, self.X, self.Y
        sky = pal(P["sky"])
        t = Y / (self.hor - 20) + (fbm(X, Y, self.seed, 120, 14, 2) - 0.5) * 0.16
        self.img[:] = sky[np.clip((t * len(sky)).astype(int), 0, len(sky) - 1)]
        if "sun" in P:
            sx, sy, r, cols = P["sun"]
            sx, sy, r = sx * W / 252, sy * W / 252, r * W / 252
            d = np.hypot(X - sx, Y - sy)
            for rr, c in ((r * 2.4, cols[2]), (r * 1.6, cols[1]), (r, cols[0])):
                self.img[d < rr] = hx(c)

    def cumulus(self, n, y0, y1, r0, r1):
        """Big billowing clouds built from overlapping discs, lit from the top-left."""
        if "cloud" not in self.P:
            return
        X, Y, rng = self.X, self.Y, self.rng
        cols = pal(self.P["cloud"])
        m = np.zeros(X.shape, bool)
        lit = np.zeros(X.shape, bool)
        deep = np.zeros(X.shape, bool)
        for _ in range(n):
            bx, by = rng.uniform(-10, W + 10), rng.uniform(y0, y1)
            for k in range(rng.randint(3, 6)):
                r = rng.uniform(r0, r1) * (1 - k * 0.1)
                cx, cy = bx + rng.uniform(-r1 * 1.6, r1 * 1.6), by - rng.uniform(0, r * 0.7)
                d = np.hypot(X - cx, (Y - cy) * 1.25)
                flat = Y < by + r0 * 0.5
                m |= (d < r) & flat
                lit |= (np.hypot(X - cx + r * 0.18, (Y - cy + r * 0.25) * 1.25) < r * 0.8) & flat
                deep |= (np.hypot(X - cx - r * 0.2, (Y - cy - r * 0.45) * 1.25) < r * 0.6) & flat
        tone = np.where(lit, 0, np.where(deep, 2, 1))
        self.img[m] = cols[tone][m]

    # ------------------------------------------------------------ mountains
    def ridge(self, seed2, base, amp, sc, ridged=True, octv=4, mesa=False):
        xs = np.arange(W + 80, dtype=float)
        out, a, tot, s = 0, 1.0, 0, sc
        for o in range(octv):
            v = samp(grid(seed2 + o * 7, 256, 2), xs / s, np.zeros_like(xs))
            if ridged:
                v = 1 - np.abs(2 * v - 1)
            out = out + a * v
            tot += a
            a *= 0.45
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
        slopes = [np.gradient(smooth(r, s)) for s in (2, 4, 7, 11)]
        warp = (fbm(X, Y, seed2 + 3, 22, 22, 2) - 0.5) * 12
        lvl = np.clip((D / 12).astype(int), 0, 3)
        xi = np.clip((X + D * 0.3 + warp).astype(int), 0, W + 79)
        S = np.zeros_like(X)
        for i, sl in enumerate(slopes):
            S = np.where(lvl == i, sl[xi], S)
        lit = S < 0.02
        u = np.where(lit, X + D * 0.9, X - D * 0.9)
        n = fbm(u, D, seed2 + 9, 9, 40, 2)
        cols = pal(cols)
        if strata:
            band = ((Y + (fbm(X, Y, seed2 + 5, 50, 8, 2) - 0.5) * 8) / 4).astype(int)
            k = (band * 7 + band // 3) % 4
            tone = np.where(lit, 4 + k, k)
        else:
            tone = np.where(lit, np.where(n > 0.6, 3, 2), np.where(n < 0.4, 0, 1))
            if snow:
                alt = np.clip((base - amp * 0.35 - rr[None, :]) / (amp * 0.5), 0, 1.2)
                sf = alt * 1.1 - D / snow + (n - 0.5) * 1.6
                tone = np.where(sf > 0.2, np.where(lit, 5, 4), tone)
        self.img[m] = cols[tone][m]

    def hills(self, seed2, base, amp, sc, cols, tips=2):
        """Distant forested ridge: a silhouette whose top edge is a row of tiny conifers."""
        X, Y = self.X, self.Y
        r = self.ridge(seed2, base, amp, sc, ridged=False, octv=3)[:W]
        rng = random.Random(seed2)
        saw = np.zeros(W)
        x = 0
        while x < W:
            h = rng.randint(tips, tips * 3)
            w = max(1, h // 2)
            for k in range(-w, w + 1):
                if 0 <= x + k < W:
                    saw[x + k] = max(saw[x + k], h * (1 - abs(k) / (w + 1)))
            x += rng.randint(2, 4)
        D = Y - (r - saw)[None, :]
        m = D >= 0
        n = fbm(X, Y, seed2 + 5, 30, 10, 2)
        tone = np.where(n > 0.58, 2, np.where(n < 0.42, 0, 1))
        self.img[m] = pal(cols)[tone][m]

    # ------------------------------------------------------------ trees
    def pine(self, cx, base, h, cols, detail=True):
        """Conifer made of drooping boughs; the upper side of the left boughs catches the light."""
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        hi = hx(cols[3]) if len(cols) > 3 else light
        rng = self.rng
        if h < 14 or not detail:
            for row in range(int(h)):
                t = row / h
                w = t * h * 0.2 * (0.55 + 0.45 * ((t * max(3, h // 4)) % 1)) + 0.3
                for x in range(int(round(cx - w)), int(round(cx + w)) + 1):
                    self.px(x, base - h + row, mid if (x < cx and detail) else dark)
            return
        top = base - h
        tw = max(1, int(h / 45))
        for y in range(int(base - h * 0.12), int(base) + 1):
            for x in range(-tw, tw + 1):
                self.px(cx + x, y, hx(cols[4]) if len(cols) > 4 and x < 0 else hx("#2a1c18"))
        for y in range(int(top), int(top + h * 0.06)):
            self.px(cx, y, dark)
        n = int(max(5, min(16, h / 6)))
        th = h * 0.9 / n
        for k in range(n):
            yk = top + h * 0.06 + (k + 0.55) * th
            span = (0.14 + 0.86 * ((k + 1) / n) ** 0.9) * h * 0.25 * rng.uniform(0.82, 1.15)
            for side in (-1, 1):
                sp = span * rng.uniform(0.8, 1.1)
                for d in range(int(sp) + 1):
                    f = d / max(sp, 1)
                    y = yk + (f ** 1.6) * th * 1.1 - th * 0.2
                    thick = max(1.0, th * 1.5 * (1 - f * 0.65))
                    hang = rng.randint(1, 3) if (d % 3 == 1 and h > 30) else 0   # needle clumps
                    lo = -hang
                    for j in range(lo, int(round(thick)) + 1):
                        c = dark
                        if d > 0 and j >= 0:
                            if side < 0:
                                if j >= thick - 1.6 and f > 0.25:
                                    c = hi
                                elif j >= thick * 0.5:
                                    c = light if (d + j) % 4 else mid
                                elif j >= thick * 0.25:
                                    c = mid
                            elif j >= thick - 1.5 and f < 0.7:
                                c = mid
                        self.px(cx + side * d, y - j + thick * 0.5, c)

    def cypress(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        for row in range(int(h)):
            t = row / h
            w = math.sin(min(1, t * 1.08) * math.pi) ** 0.6 * min(h * 0.13, 8) + 0.4
            for x in range(int(round(cx - w)), int(round(cx + w)) + 1):
                rel = (x - cx) / max(w, 1)
                self.px(x, base - h + row, light if rel < -0.35 else (dark if rel > 0.2 else mid))
        self.px(cx, base, hx("#2a1c18"))

    def cactus(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        bw = max(1, int(h / 8))

        def col(x0, y0, y1, w):
            for y in range(int(y0), int(y1) + 1):
                for x in range(-w, w + 1):
                    self.px(x0 + x, y, light if x < 0 else (dark if x == w and w > 0 else mid))
        col(cx, base - h, base, bw)
        for side, ah, tp in ((-1, 0.45, 0.8), (1, 0.6, 0.95)):
            ax = cx + side * (bw * 2 + 2)
            for x in range(int(min(cx, ax)), int(max(cx, ax)) + 1):
                self.px(x, base - h * ah, mid)
            col(ax, base - h * tp, base - h * ah, max(0, bw - 1))

    def palm(self, cx, base, h, cols):
        dark, mid, light = hx(cols[0]), hx(cols[1]), hx(cols[2])
        lean = self.rng.choice((-1, 1)) * self.rng.uniform(0.12, 0.28)
        for i in range(int(h)):
            x = cx + lean * h * (i / h) ** 2
            self.px(x, base - i, hx("#6b4a34") if i % 3 else hx("#8a6444"))
            if h > 40:
                self.px(x + 1, base - i, hx("#4a3226"))
        tx, ty = cx + lean * h, base - h
        for ang in (-2.9, -2.4, -1.9, -1.2, -0.7, -0.2, 0.25, 2.9):
            for d in range(int(h * 0.5)):
                fx = tx + math.cos(ang) * d
                fy = ty + math.sin(ang) * d * 0.55 + (d * d) / (h * 0.75)
                self.px(fx, fy, light if math.cos(ang) < 0 else mid)
                self.px(fx, fy + 1, mid if math.cos(ang) < 0 else dark)
                if d % 2 == 0 and d > 2:
                    self.px(fx, fy + 2, dark)

    def tree(self, kind, cx, base, h, cols, detail=True):
        if kind == "cypress":
            self.cypress(cx, base, h * 1.1, cols)
        elif kind == "cactus":
            self.cactus(cx, base, max(5, h * 0.45), cols)
        elif kind == "palm":
            self.palm(cx, base, h * 0.9, cols)
        else:
            self.pine(cx, base, h, cols, detail)

    # ------------------------------------------------------------ ground
    def ground(self):
        P, X, Y, hor = self.P, self.X, self.Y, self.hor
        g = Y >= hor
        p = np.clip((Y - hor) / (H - hor), 0, 1)
        self.p = p
        med = pal(P["meadow"])
        n = fbm(X, Y, self.seed + 50, 80, 7, 3)
        tone = np.clip(((n * 1.1 - 0.05 + 0.1 * (1 - p)) * len(med)).astype(int), 0, len(med) - 1)
        self.img[g] = med[tone][g]
        self.water = np.zeros(g.shape, bool)
        wc = pal(P["water"])
        if P.get("rows"):
            lav = pal(P["rows"])
            u = (X - W * 0.5) / np.maximum(Y - hor + 9, 1)
            s = (u * 5.5 + 0.5) % 1
            ln = fbm(X, Y, self.seed + 70, 7, 5, 2)
            rowm = (s < 0.62) & g & (Y > hor + 6)
            tone = np.where(s < 0.16, 3, np.where(ln > 0.55, 2, np.where(ln > 0.4, 1, 0)))
            tone = np.where(s > 0.5, 0, tone)
            self.img[rowm] = lav[tone][rowm]
        if P.get("terrace"):
            lev = 44 * np.log1p(np.maximum(Y - hor, 0) / 19) + 4 * np.sin(X / 34 + 1) + (fbm(X, Y, self.seed + 80, 80, 80, 2) - 0.5) * 16
            f = lev % 13
            wn = fbm(X, Y, self.seed + 81, 30, 2, 2)
            wt = np.where(wn > 0.62, 3, np.where(wn > 0.5, 2, np.where(wn > 0.38, 1, 0)))
            tm = g & (Y > hor + 4)
            wat = tm & (f >= 3) & (f < 8.5)
            self.img[wat] = wc[wt][wat]
            rim = tm & (f < 3)
            self.img[rim] = med[np.where(f < 1.2, 4, 3)][rim]
            ris = tm & (f >= 8.5)
            self.img[ris] = med[np.where(f > 11.5, 0, 1)][ris]
            self.water = wat
        if P.get("lake"):
            y0, lh = hor + 8, 44
            xs = np.arange(W, dtype=float)
            shore = y0 + lh + 5 * np.sin(xs / 22 + 1) + (fbm(xs, np.zeros(W), self.seed + 61, 20, 1, 2) - 0.5) * 10
            mid = wc[1].astype(float)
            allc = np.concatenate([wc, pal(P["far"]), pal(P["hill1"]), pal(P["hill2"])]).astype(float)
            for y in range(y0, y0 + lh + 12):
                src = max(0, int(y0 - 2 - (y - y0) * 1.5))
                row = np.roll(self.img[src], int(round(math.sin(y * 1.9) * 1.5)), axis=0).astype(float) * 0.6 + mid * 0.4
                d = ((row[:, None, :] - allc[None, :, :]) ** 2).sum(-1)
                row = allc[d.argmin(1)].astype(np.uint8)
                wn = fbm(xs, np.full(W, float(y)), self.seed + 62, 30, 1.5, 2)
                row[wn > 0.68] = wc[3]
                mk = y < shore
                self.img[y][mk] = row[mk]
                self.water[y][mk] = True
        if P.get("river") is not None:
            ph = P["river"]
            q = p ** 0.75
            cx = W * 0.5 + np.sin(q * 6.4 + ph) * W * (0.1 + 0.3 * p) + np.sin(q * 15 + ph * 2) * 5 * p
            hw = (0.8 + p ** 1.25 * 30) * (1 + 0.55 * np.sin(q * 11 + ph) ** 2)
            water = (np.abs(X - cx) < hw) & (Y >= hor + 2)
            sky_ref = fbm(X, Y, self.seed + 60, 46, 5, 2)
            wt = np.where(sky_ref > 0.63, 3, np.where(sky_ref > 0.47, 2, 1))
            k = 5
            far_edge = water & ~np.roll(water, k, axis=0)          # just below the far bank: dark reflection
            far_edge2 = water & ~np.roll(water, 2 * k, axis=0) & (fbm(X, Y, self.seed + 64, 12, 2, 2) > 0.5)
            wt = np.where(far_edge | far_edge2, 0, wt)
            self.img[water] = wc[wt][water]
            mud = ~water & np.roll(water, 1, axis=0) & g | (~water & np.roll(water, 2, axis=0) & g & (X.astype(int) % 3 > 0))
            self.img[mud] = hx(P.get("bank", "#4a3a30"))
            lip = ~water & np.roll(water, -1, axis=0) & g
            self.img[lip] = med[0]
            self.water = water | mud
        if P.get("patches"):
            fn = fbm(X, Y, self.seed + 71, 46, 5, 3)
            m2 = g & ~self.water & (fn > 0.62) & (Y > hor + 10)
            self.img[m2] = hx(P["patches"])
            dn = fbm(X, Y, self.seed + 72, 40, 6, 3)
            m3 = g & ~self.water & (dn > 0.66) & (Y > hor + 8)
            self.img[m3] = med[0]

    def free(self, x, y, r=3):
        x, y = int(x), int(y)
        if not (0 <= x < W and 0 <= y < H):
            return True
        return not self.water[y, max(0, x - r):x + r + 1].any()

    def rock(self, cx, cy, r):
        c = pal(self.P.get("rock", ["#4f4b58", "#7c7784", "#a39c98", "#cdbd9f"]))
        rng = self.rng
        k = [rng.uniform(0.75, 1.1) for _ in range(8)]
        for y in range(int(cy - r), int(cy + r * 0.7) + 1):
            for x in range(int(cx - r * 1.4), int(cx + r * 1.4) + 1):
                dx, dy = (x - cx) / (r * 1.3), (y - cy) / r
                a = math.atan2(dy, dx)
                if math.hypot(dx, dy * (1.4 if dy > 0 else 1)) > k[int((a + math.pi) / (2 * math.pi) * 8) % 8]:
                    continue
                l = -dx * 0.45 - dy * 0.85
                self.px(x, y, c[3 if l > 0.5 else 2 if l > 0.05 else 1 if l > -0.4 else 0])
        for x in range(int(cx - r * 1.3), int(cx + r * 1.3)):
            self.px(x, cy + r * 0.7 + 1, pal(self.P["meadow"])[0])

    def details(self):
        P, hor, rng = self.P, self.hor, self.rng
        med = pal(P["meadow"])
        fl = pal(P.get("flowers", ["#d9c94a"]))
        if not P.get("terrace"):
            for _ in range(260 if not P.get("rows") else 40):
                y = hor + 8 + int((H - hor - 10) * rng.random() ** 0.7)
                x = rng.randrange(W)
                if not self.free(x, y, 1):
                    continue
                pz = (y - hor) / (H - hor)
                col = med[rng.choice((0, 3, 4))] if rng.random() < 0.6 else fl[rng.randrange(len(fl))]
                for k in range(1 + int(pz * 3 * rng.random() + 0.4)):
                    self.px(x, y - k, col)
                if pz > 0.4 and rng.random() < 0.5:
                    self.px(x + 1, y - 1, col)
        for _ in range(P.get("rocks", 6)):
            y = hor + 16 + int((H - hor - 26) * rng.random())
            x = rng.randrange(W)
            pz = (y - hor) / (H - hor)
            self.rock(x, y, 2 + pz * 8 * rng.uniform(0.7, 1.2))

    def forest(self):
        P, hor, rng = self.P, self.hor, self.rng
        kind = P.get("tree", "pine")
        lay = [
            (-4, 4, 7, 13, P.get("nfar", 46), P["tfar"], False, 0),
            (5, 22, 14, 24, P.get("nmid", 16), P["tmid"], True, 0),
            (26, 70, 28, 46, P.get("nnear", 7), P["tnear"], True, 1),
        ]
        items = []
        for (o0, o1, h0, h1, n, cols, det, edge) in lay:
            for _ in range(n):
                x = rng.randrange(-4, W + 4)
                if edge:
                    x = rng.choice((rng.randrange(-4, 52), rng.randrange(W - 52, W + 4)))
                y = hor + rng.randint(o0, o1)
                if not self.free(x, y, 5):
                    continue
                if (P.get("rows") or P.get("terrace")) and y > hor + 8 and rng.random() < 0.8:
                    continue
                items.append((y, x, rng.randint(h0, h1), cols, det))
        for (y, x, h, cols, det) in sorted(items):
            self.tree(kind, x, y, h, cols, det)

    def framing(self):
        P, hor = self.P, self.hor
        cols = P["tframe"]
        kind = P.get("tree", "pine")
        if kind == "cactus":
            self.cactus(12, hor + 178, 50, cols)
            self.cactus(W - 16, hor + 150, 38, cols)
        elif kind == "palm":
            self.palm(16, hor + 110, 84, cols)
            self.palm(W - 18, hor + 90, 66, cols)
        elif kind == "cypress":
            self.cypress(5, hor + 180, 150, cols)
            self.cypress(W - 6, hor + 160, 120, cols)
        else:
            self.pine(6, hor + 182, 250, cols)
            self.pine(W - 4, hor + 160, 205, cols)
            self.pine(34, hor + 190, 118, cols)
            self.pine(W - 30, hor + 200, 84, cols)
        # dark foreground strip with grass silhouettes
        fg = hx(P.get("fg", cols[0]))
        rng = self.rng
        for x in range(W):
            hgt = 5 + int(4 * math.sin(x / 9.0) + 3 * math.sin(x / 3.7)) + rng.randint(0, 3)
            for k in range(max(1, hgt)):
                self.px(x, H - 1 - k, fg)
        for _ in range(8):
            bx, br = rng.randrange(W), rng.randint(5, 11)
            for y in range(-br, 1):
                for x in range(-br, br + 1):
                    if x * x + y * y * 2.2 < br * br:
                        self.px(bx + x, H - 4 + y, fg if (x + y) % 5 else hx(cols[1]))

    def rays(self):
        P = self.P
        if not P.get("rays"):
            return
        X, Y = self.X, self.Y
        m = (((X * 0.9 + Y * 0.42) % 70) < 18) & (Y < self.hor + 110)
        warm = hx(P["rays"]).astype(float)
        self.img[m] = (self.img[m].astype(float) * 0.76 + warm * 0.24).astype(np.uint8)
        for _ in range(18):
            x, y = self.rng.randrange(W), self.rng.randrange(self.hor - 40, H - 14)
            self.px(x, y, hx("#fff7b0"))
            self.px(x + 1, y, hx("#f3d860"))
            self.px(x, y + 1, hx("#f3d860"))

    def render(self):
        P, s = self.P, self.seed
        k = W / 252
        hor = self.hor
        self.sky()
        self.cumulus(P.get("ncloud", 6), hor - 125, hor - 55, 10, 24)
        self.mountains(s + 10, hor - 8, P.get("amp", 190) * k, 120, P["far"], snow=P.get("snow", 70) * k, strata=P.get("mesa"), mesa=P.get("mesa"))
        self.mountains(s + 20, hor + 2, P.get("amp2", 105) * k, 86, P["mid"], snow=P.get("snow2", 0) * k, strata=P.get("mesa"), mesa=P.get("mesa"))
        self.hills(s + 30, hor - 6, 26, 70, P["hill1"])
        self.hills(s + 40, hor + 3, 16, 55, P["hill2"], tips=3)
        self.ground()
        self.forest()
        self.details()
        self.framing()
        self.rays()
        return self.img


BIOMES = {
    "meadow": dict(
        sky=["#86a7cf", "#92b0d4", "#9fbad9", "#afc4dc", "#c3d0dc"],
        cloud=["#f6ecd6", "#ddd3c0", "#b9bcc6"],
        far=["#5d789f", "#6c88ad", "#8399b8", "#9aa9bf", "#b6bcc4", "#e4dfd2"],
        mid=["#465f85", "#526d93", "#617ba0", "#7389aa", "#9aa6b8", "#c6c8c8"],
        hill1=["#3b5a70", "#44667a", "#507284"], hill2=["#2d4a58", "#35555f", "#3f6266"],
        tfar=["#27434a", "#2f4f52", "#3a5c56"], tmid=["#1b3230", "#243f38", "#4a6332", "#737f33"],
        tnear=["#152827", "#1d352f", "#4f6a2e", "#8a9036"], tframe=["#101f20", "#172b28", "#465f2b", "#7d8a33", "#4a3024"],
        meadow=["#33502a", "#4c6c30", "#688637", "#86993f", "#a8aa48"], patches="#c2b84e",
        water=["#3a4f66", "#86a6d6", "#a3bde2", "#ece6d6"], river=0.6, bank="#4a3a30",
        flowers=["#d9c94a", "#e9dc7a"], fg="#12211e",
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
