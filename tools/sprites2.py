"""High-detail sprites (authored at 2x the game's logical pixel): flower tiles on grass,
obstacles, the heroine. Drawn with shaded primitives on pix.Canvas."""
import math
import random

from pix import C, Canvas

T2, M2 = 54, 28


def cl(v, lo, hi):
    return max(lo, min(hi, v))


def blob(cv, cx, cy, rx, ry, ramp, lo, hi, light=(-0.55, -0.7)):
    for y in range(int(cy - ry - 1), int(cy + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            nx, ny = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = nx * nx + ny * ny
            if d > 1:
                continue
            l = nx * light[0] + ny * light[1] + math.sqrt(1 - d) * 0.55
            t = (l + 0.55) / 1.5
            cv.px(x, y, C(ramp, cl(lo + int(round(t * (hi - lo))), lo, hi)))


def petal(cv, cx, cy, ang, L, Wd, ramp, lo=1, tip="round", start=0.0, hi=None):
    hi = lo + 3 if hi is None else hi
    ca, sa = math.cos(ang), math.sin(ang)
    R = int(L + Wd + 2)
    for y in range(int(cy - R), int(cy + R + 1)):
        for x in range(int(cx - R), int(cx + R + 1)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            u = dx * ca + dy * sa
            v = -dx * sa + dy * ca
            if u < start or u > L:
                continue
            t = u / L
            if tip == "round":
                prof = min(1.0, (t * 2.2) ** 0.7) * min(1.0, ((1 - t) * 3.2) ** 0.5)
            else:
                prof = (4 * t * (1 - t)) ** 0.7
            w = Wd * prof
            if abs(v) > w:
                continue
            tone = lo + 1
            lit = (dx + dy) < 0
            if lit:
                tone += 1
            if t > 0.6 and lit and abs(v) < w - 1:
                tone += 1
            if t < 0.28 or abs(v) > w - 0.9:
                tone -= 1
            cv.px(x, y, C(ramp, cl(tone, lo, hi)))


def leafp(cv, cx, cy, ang, L, Wd, ramp="grass", lo=1):
    petal(cv, cx, cy, ang, L, Wd, ramp, lo, tip="point", hi=lo + 3)
    for i in range(1, int(L) - 1):
        cv.px(cx + math.cos(ang) * i, cy + math.sin(ang) * i, C(ramp, lo))


def bush(cv, cx, cy, rx, ry, n, rng, ramp="grass", lo=1):
    leaves = []
    for i in range(n):
        a = rng.uniform(0, math.tau)
        rad = rng.random() ** 0.5
        x, y = cx + math.cos(a) * rx * rad, cy + math.sin(a) * ry * rad
        ang = math.atan2(y - (cy + ry * 1.4), x - cx) + rng.uniform(-0.3, 0.3)
        leaves.append((y, x, ang, rng.uniform(6, 9), rng.uniform(2.3, 3.2)))
    for (y, x, ang, L, Wd) in sorted(leaves):
        leafp(cv, x, y, ang, L, Wd, ramp, lo + (1 if (x < cx and y < cy) else 0))


def stemline(cv, x0, y0, x1, y1, ramp="grass"):
    n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
    for i in range(n + 1):
        t = i / n
        x = x0 + (x1 - x0) * t + math.sin(t * math.pi) * (1.5 if x1 >= x0 else -1.5)
        y = y0 + (y1 - y0) * t
        cv.px(x, y, C(ramp, 3))
        cv.px(x + 1, y, C(ramp, 1))


# ------------------------------------------------------------------ flower heads
def head(cv, name, cx, cy, R):
    tau = math.tau
    if name == "daisy":
        for i in range(12):
            petal(cv, cx, cy, i / 12 * tau + 0.1, R, max(1.6, R * 0.2), "cream", 1, hi=4, start=R * 0.15)
        blob(cv, cx, cy, R * 0.36, R * 0.36, "gold", 2, 5)
        cv.px(cx + 1, cy + 1, C("orange", 2))
    elif name == "poppy":
        for i in (1, 3, 0, 2, 4):
            petal(cv, cx, cy, i / 5 * tau - 1.2, R, R * 0.62, "red", 1 if i % 2 else 2, hi=5)
        blob(cv, cx, cy, R * 0.26, R * 0.26, "ink", 0, 2)
        for i in range(7):
            a = i / 7 * tau
            cv.px(cx + math.cos(a) * R * 0.38, cy + math.sin(a) * R * 0.38, C("gold", 4))
    elif name == "sunflower":
        for i in range(13):
            petal(cv, cx, cy, i / 13 * tau, R, max(1.6, R * 0.2), "gold", 1, tip="point", hi=4, start=R * 0.3)
        for i in range(13):
            petal(cv, cx, cy, (i + 0.5) / 13 * tau, R * 0.86, max(1.5, R * 0.19), "gold", 2, tip="point", hi=5, start=R * 0.3)
        blob(cv, cx, cy, R * 0.5, R * 0.5, "soil", 0, 3)
        for i in range(int(R * 1.4)):
            a, r = i * 2.4, R * 0.42 * math.sqrt(i / (R * 1.4))
            cv.px(cx + math.cos(a) * r, cy + math.sin(a) * r, C("soil", 4 if i % 2 else 0))
    elif name == "cornflower":
        for i in range(9):
            a = i / 9 * tau + 0.2
            for da in (-0.2, 0.2):
                petal(cv, cx, cy, a + da, R, max(1.5, R * 0.17), "blue", 2, tip="point", hi=5, start=R * 0.2)
        for i in range(7):
            petal(cv, cx, cy, i / 7 * tau, R * 0.5, max(1.4, R * 0.16), "lav", 2, tip="point", hi=5)
        blob(cv, cx, cy, R * 0.2, R * 0.2, "lav", 0, 2)
    elif name == "edelweiss":
        rng = random.Random(7)
        for i in range(9):
            petal(cv, cx, cy, i / 9 * tau + rng.uniform(-0.12, 0.12), R * rng.uniform(0.72, 1.0), max(1.7, R * 0.24), "cream", 1, tip="point", hi=4, start=R * 0.12)
        for i in range(5):
            a = i / 5 * tau
            blob(cv, cx + math.cos(a) * R * 0.2, cy + math.sin(a) * R * 0.2, max(1.3, R * 0.15), max(1.3, R * 0.15), "gold", 2, 5)
        blob(cv, cx, cy, max(1.3, R * 0.15), max(1.3, R * 0.15), "moss", 3, 4)
    elif name == "cosmos":
        for i in range(8):
            petal(cv, cx, cy, i / 8 * tau + 0.2, R, R * 0.36, "pink", 2 if i % 2 else 1, hi=5, start=R * 0.1)
        blob(cv, cx, cy, R * 0.3, R * 0.3, "gold", 2, 5)
    elif name == "marigold":
        for n, L, lo in ((12, R, 1), (9, R * 0.7, 2), (6, R * 0.42, 3)):
            for i in range(n):
                petal(cv, cx, cy, i / n * tau + L, L, R * 0.3, "orange", lo, hi=min(5, lo + 3), start=L * 0.3)
        blob(cv, cx, cy, R * 0.18, R * 0.18, "orange", 4, 5)
    elif name == "lavender":
        spike(cv, cx, cy + R, int(R * 2), 0)


def spike(cv, x, ybase, h, lean):
    for i in range(h):
        cv.px(x + lean * i / h, ybase - i, C("moss", 3))
    for i in range(int(h * 0.3), h, 2):
        xx = x + lean * i / h
        r = 1.9 if i < h - 3 else 1.4
        blob(cv, xx - 1.4, ybase - i, r, r, "lav", 1, 4)
        blob(cv, xx + 1.6, ybase - i - 1, r, r, "lav", 2, 5)
    cv.px(x + lean, ybase - h, C("lav", 5))


def budp(cv, name, x, y, f=1.0):
    ramp = {"daisy": "cream", "poppy": "red", "sunflower": "gold", "cornflower": "blue", "edelweiss": "cream", "cosmos": "pink", "marigold": "orange", "lavender": "lav"}[name]
    petal(cv, x, y + 2, -math.pi / 2, 8 * f, 3 * f, ramp, 2, hi=5)
    leafp(cv, x - 1, y + 3, -math.pi / 2 - 0.5, 5 * f, 1.8, "grass", 2)
    leafp(cv, x + 1, y + 3, -math.pi / 2 + 0.5, 5 * f, 1.8, "grass", 1)


# ------------------------------------------------------------------ grass patch (base of every placed piece)
def patch(cv, s, seed=1):
    rng = random.Random(seed * 13 + s)
    r = s * 0.2
    side = max(2, s // 12)
    for y in range(s):
        for x in range(s):
            cx, cy = min(x, s - 1 - x), min(y, s - 1 - y)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            if x < 1 or y < 1 or x > s - 2 or y > s - 2:
                continue
            if y >= s - 1 - side:
                c = C("grass", 0) if y >= s - 3 else C("grass", 1)
            else:
                c = C("grass", 4)
                if y < 3 or x < 3:
                    c = C("grass", 5)
                elif x > s - 4:
                    c = C("grass", 3)
            cv.px(x, y, c)
    # blades
    for _ in range(s * s // 16):
        x, y = rng.randint(3, s - 4), rng.randint(4, s - side - 3)
        h = rng.randint(2, 4)
        col = C("grass", rng.choice((3, 3, 5, 6)))
        for k in range(h):
            cv.px(x, y - k, col)
        cv.px(x + 1, y, C("grass", 3))
    # fringe over the top edge
    for x in range(3, s - 3):
        if rng.random() < 0.45:
            cv.px(x, 0, C("grass", rng.choice((4, 5))))
    for _ in range(3):
        x, y = rng.randint(5, s - 6), rng.randint(s // 2, s - side - 4)
        cv.px(x, y, C("cream", 4))
        cv.px(x + 1, y, C("gold", 4))


def plant_tile(name, stage, s=T2):
    f = s / 48
    cv = Canvas(s, s)
    patch(cv, s, seed=hash(name) % 7)
    pl = Canvas(s, s)
    rng = random.Random(hash(name) % 100 + stage)
    cx = s / 2
    by = s * 0.68
    if name == "lavender":
        bush(pl, cx, by, (10 + stage * 3) * f, 5 * f, 7 + stage * 3, rng, "moss", 1)
        sp = [[(0, 12), (-6, 9), (6, 9)], [(0, 26), (-8, 20), (8, 21), (-3, 17)], [(0, 28), (-9, 22), (9, 23), (-15, 16), (15, 17), (-4, 20), (5, 19)]][stage]
        for ox, h in sorted(sp, key=lambda q: q[1]):
            spike(pl, cx + ox * f, by + 1, int(h * f), ox * 0.25)
    elif stage == 0:
        bush(pl, cx, by, 11 * f, 5.5 * f, 9, rng)
        stemline(pl, cx - 3, by, cx - 5 * f, by - 11 * f)
        stemline(pl, cx + 3, by, cx + 6 * f, by - 7 * f)
        budp(pl, name, cx - 5 * f, by - 14 * f, f)
        budp(pl, name, cx + 6 * f, by - 10 * f, f * 0.85)
    elif stage == 1:
        bush(pl, cx, by, 13 * f, 6.5 * f, 13, rng)
        stemline(pl, cx, by, cx, by - 14 * f)
        stemline(pl, cx + 4, by, cx + 11 * f, by - 6 * f)
        budp(pl, name, cx + 12 * f, by - 9 * f, f * 0.8)
        head(pl, name, cx - 1, by - 17 * f, 10.5 * f)
    else:
        bush(pl, cx, by + 1, 18 * f, 7 * f, 20, rng)
        for ox, oy, R in ((-12, -9, 7), (12, -8, 7), (0, -19, 9.5)):
            stemline(pl, cx + ox * 0.4, by, cx + ox * f, by + oy * f + 4)
            head(pl, name, cx + ox * f, by + oy * f, R * f)
        for ox, oy in ((-19, -1), (19, 0), (-6, 2), (7, 3)):
            head(pl, name, cx + ox * f, by + oy * f, 3.2 * f)
    pl.outline()
    cv.blit(pl, 0, 0)
    return cv


def mini_tile(name):
    s = M2
    cv = Canvas(s, s)
    patch(cv, s, seed=3)
    pl = Canvas(s, s)
    rng = random.Random(5)
    if name == "lavender":
        bush(pl, 14, 20, 6, 3, 4, rng, "moss", 1)
        for ox, h in ((-5, 11), (5, 12), (0, 16)):
            spike(pl, 14 + ox, 21, h, ox * 0.2)
    else:
        bush(pl, 14, 20, 7, 3.5, 5, rng)
        head(pl, name, 13.5, 12.5, 8.5)
    pl.outline()
    cv.blit(pl, 0, 0)
    return cv


# ------------------------------------------------------------------ obstacles (transparent, sit straight on the meadow)
def grass_base(cv, s, rng, w=0.8):
    for i in range(int(s * w)):
        x = s * (1 - w) / 2 + i
        h = rng.randint(2, 5)
        for k in range(h):
            cv.px(x, s - 3 - k, C("grass", rng.choice((2, 3, 4))))


def stone_tile(cracked=False, s=T2):
    f = s / 48
    cv = Canvas(s, s)
    st = Canvas(s, s)
    rng = random.Random(4)
    blob(st, 25 * f, 29 * f, 18 * f, 13 * f, "stone", 1, 5)
    blob(st, 15 * f, 25 * f, 10 * f, 9 * f, "stone", 1, 5)
    blob(st, 32 * f, 22 * f, 11 * f, 10 * f, "stone", 2, 6)
    # facets: flat planes cut into the lumps
    for (x0, y0, x1, y1) in ((20, 16, 30, 34), (9, 24, 22, 30), (30, 24, 42, 30)):
        st.line(x0 * f, y0 * f, x1 * f, y1 * f, C("stone", 1))
    for _ in range(int(60 * f)):
        x, y = rng.randint(6, s - 7), rng.randint(int(12 * f), int(24 * f))
        if st.filled(x, y) and rng.random() < 0.7:
            st.px(x, y, C("moss", rng.choice((3, 4))))
            st.px(x + 1, y, C("moss", 3))
    for _ in range(10):
        x, y = rng.randint(8, s - 9), rng.randint(int(20 * f), int(38 * f))
        if st.filled(x, y):
            st.px(x, y, C("gold", 3))
    if cracked:
        pts = [(24, 12), (27, 20), (23, 27), (28, 34), (25, 41)]
        for a, b in zip(pts, pts[1:]):
            st.line(a[0] * f, a[1] * f, b[0] * f, b[1] * f, C("stone", 0))
            st.line(a[0] * f + 1, a[1] * f, b[0] * f + 1, b[1] * f, C("stone", 1))
        st.line(27 * f, 20 * f, 36 * f, 24 * f, C("stone", 0))
        st.line(23 * f, 27 * f, 14 * f, 31 * f, C("stone", 0))
    st.outline()
    cv.ellipse(s / 2, s - 6, s * 0.42, 4, C("grass", 1))
    cv.blit(st, 0, 0)
    grass_base(cv, s, rng)
    return cv


def mushroom_tile(s=T2):
    f = s / 48
    cv = Canvas(s, s)
    m = Canvas(s, s)
    rng = random.Random(2)
    for (cx, cy, r, st) in ((19, 24, 13, 15), (35, 31, 8, 9), (9, 36, 5, 5)):
        cx, cy, r, st = cx * f, cy * f, r * f, st * f
        blob(m, cx, cy + st * 0.55, r * 0.28, st * 0.6, "cream", 1, 4)
        for y in range(int(cy - r * 0.75), int(cy + 2)):
            for x in range(int(cx - r), int(cx + r + 1)):
                nx, ny = (x + 0.5 - cx) / r, (y + 0.5 - cy) / (r * 0.75)
                if nx * nx + ny * ny > 1 or ny > 0.15:
                    continue
                l = -nx * 0.55 - ny * 0.8
                m.px(x, y, C("red", cl(1 + int(l * 3.2 + 1.2), 1, 5)))
        for x in range(int(cx - r * 0.9), int(cx + r * 0.9) + 1):
            m.px(x, cy + 1, C("cream", 2))
            m.px(x, cy + 2, C("cream", 1) if (x % 2) else C("cream", 3))
        for _ in range(int(r * 0.8)):
            a, d = rng.uniform(math.pi, math.tau), rng.uniform(0.2, 0.85)
            sx, sy = cx + math.cos(a) * r * d, cy + math.sin(a) * r * 0.7 * d
            m.rect(sx, sy, 2 if r > 6 else 1, 2 if r > 6 else 1, C("cream", 4))
    m.outline()
    cv.ellipse(s / 2, s - 6, s * 0.4, 4, C("grass", 1))
    cv.blit(m, 0, 0)
    grass_base(cv, s, rng)
    return cv


def weed_tile(frame=0, s=T2):
    f = s / 48
    cv = Canvas(s, s)
    w = Canvas(s, s)
    rng = random.Random(9)
    cx, by = s / 2, s * 0.8
    sw = 1.5 if frame else -1.5
    for i, a in enumerate((-2.9, -0.25, -2.5, -0.65, -2.1, -1.05, -1.57, 3.3, -0.05)):
        L = (17 if i < 6 else 13) * f
        leafp(w, cx, by, a, L, 3.4 * f, "moss", 0 if i % 2 else 1)
        for k in (0.45, 0.7, 0.95):
            tx, ty = cx + math.cos(a) * L * k, by + math.sin(a) * L * k
            w.px(tx + math.cos(a + 1.57) * 3.5 * f * (1 - k + 0.3), ty + math.sin(a + 1.57) * 3.5 * f * (1 - k + 0.3), C("cream", 3))
            w.px(tx - math.cos(a + 1.57) * 3.5 * f * (1 - k + 0.3), ty - math.sin(a + 1.57) * 3.5 * f * (1 - k + 0.3), C("cream", 2))
    for hx_, hy, d in ((cx - 8 * f, 12 * f, sw), (cx + 9 * f, 17 * f, -sw)):
        stemline(w, cx, by - 4, hx_ + d, hy + 6, "moss")
        blob(w, hx_ + d, hy + 4, 4.5 * f, 4 * f, "moss", 1, 4)
        for k in range(-3, 4):
            petal(w, hx_ + d, hy + 1, -math.pi / 2 + k * 0.28, 7 * f, 1.3, "pink", 2, tip="point", hi=5)
    w.outline()
    cv.ellipse(cx, s - 6, s * 0.36, 3.5, C("soil", 1))
    cv.blit(w, 0, 0)
    return cv


def plastic_tile(s=T2):
    f = s / 48
    cv = Canvas(s, s)
    b = Canvas(s, s)
    x0, y0, x1, y1 = 10 * f, 36 * f, 37 * f, 16 * f
    L = math.hypot(x1 - x0, y1 - y0)
    ux, uy = (x1 - x0) / L, (y1 - y0) / L
    for y in range(s):
        for x in range(s):
            dx, dy = x + 0.5 - x0, y + 0.5 - y0
            t = (dx * ux + dy * uy) / L
            v = -dx * uy + dy * ux
            if t < -0.08 or t > 1.12:
                continue
            rad = 7.5 * f
            if t < 0:
                rad *= math.sqrt(max(0, 1 - (t / 0.08) ** 2))
            if t > 0.8:
                rad = (3.2 if t > 0.86 else 7.5 - (t - 0.8) / 0.06 * 4.3) * f
            if abs(v) > rad:
                continue
            k = v / rad
            if t > 1.0:
                col = C("blue", 3 if k < 0 else 2)
            elif 0.34 < t < 0.62:
                col = C("red", 4 if k < -0.3 else 3 if k < 0.4 else 2)
                if 0.45 < t < 0.51:
                    col = C("cream", 4 if k < 0.4 else 2)
            else:
                col = C("teal", 5 if -0.7 < k < -0.4 else 4 if k < 0 else 3 if k < 0.6 else 2)
                if int(t * 40) % 7 == 0 and t < 0.8:
                    col = C("teal", 2)
            b.px(x, y, col)
    b.outline()
    cv.ellipse(s / 2, s - 7, s * 0.4, 4, C("grass", 1))
    cv.blit(b, 0, 0)
    grass_base(cv, s, random.Random(6), 0.7)
    return cv


# ------------------------------------------------------------------ the heroine
def curl(cv, x, y, r, i, tip=False):
    cv.disc(x, y, r, C("hair", 1))
    cv.px(x + r * 0.5, y + r * 0.5, C("hair", 0))
    hi = 4 if tip else 3
    for a in (3.4, 3.9, 4.4, 4.9):
        cv.px(x + math.cos(a) * (r - 1), y + math.sin(a) * (r - 1), C("hair", hi if i % 2 == 0 else hi - 1))
    if i % 3 == 0:
        cv.px(x - r * 0.4, y - r * 0.5, C("hair", 5 if tip else 4))


def limb(cv, x0, y0, x1, y1, r, ramp, tone):
    n = int(math.hypot(x1 - x0, y1 - y0) * 2) + 1
    for i in range(n + 1):
        t = i / n
        cv.disc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, C(ramp, tone))


def hiker(frame):
    """Side view, walking right. 36x46 (drawn at half size in game)."""
    cv = Canvas(36, 46)
    bob = 1 if frame % 2 else 0
    hipx, hipy = 18, 31 - bob
    poses = [((0.5, 0.15), (-0.45, -0.75)), ((0.05, 0.0), (0.45, -0.95)), ((-0.45, -0.75), (0.5, 0.15)), ((0.45, -0.95), (0.05, 0.0))]
    near, far = poses[frame % 4]

    def leg(p, tone, boot):
        th, sh = p
        kx, ky = hipx + math.sin(th) * 6, hipy + math.cos(th) * 6
        ax, ay = kx + math.sin(sh) * 6.5, ky + math.cos(sh) * 6.5
        limb(cv, hipx, hipy, kx, ky, 1.9, "black", tone)
        limb(cv, kx, ky, ax, ay, 1.6, "black", tone)
        cv.rect(ax - 2, ay, 6, 3, C("wood", boot))
        cv.rect(ax - 2, ay + 2, 7, 1, C("wood", 0))
        cv.px(ax + 3, ay, C("wood", boot + 1))
    leg(far, 1, 2)
    sy = 19 - bob
    # far arm
    aswing = 0.5 if frame % 4 == 0 else (-0.5 if frame % 4 == 2 else 0)
    limb(cv, 19, sy + 2, 19 - math.sin(aswing) * 6, sy + 8, 1.4, "black", 1)
    # small daypack
    for y in range(sy + 1, sy + 11):
        for x in range(9, 15):
            if (x == 9 and y in (sy + 1, sy + 10)):
                continue
            cv.px(x, y, C("gold", 3 if x < 11 and y < sy + 8 else 2 if y < sy + 9 else 1))
    cv.rect(10, sy + 6, 4, 1, C("gold", 1))
    leg(near, 2, 3)
    # torso: black top with peplum
    for y in range(sy, sy + 13):
        t = (y - sy) / 12
        x0 = 14 + (1 if t < 0.15 else 0) + (1 if 0.5 < t < 0.75 else 0)
        x1 = 22 + (1 if 0.15 < t < 0.5 else 0)
        if t > 0.75:
            x0, x1 = 13, 24
        for x in range(x0, x1 + 1):
            tone = 2
            if x >= x1 - 1:
                tone = 3
            if x <= x0 + 1:
                tone = 1
            if t > 0.9:
                tone = 1
            cv.px(x, y, C("black", tone))
    cv.px(21, sy + 3, C("black", 4))
    cv.px(22, sy + 4, C("black", 4))
    # neck + head
    hx, hy = 20, 11 - bob
    cv.rect(18, hy + 5, 3, 4, C("skin", 2))
    blob(cv, hx, hy, 5.6, 6.2, "skin", 2, 4, light=(0.5, -0.6))
    cv.px(26, hy + 1, C("skin", 3))
    cv.px(26, hy + 2, C("skin", 2))
    cv.rect(23, hy - 1, 1, 2, C("black", 0))            # eye
    cv.px(24, hy - 1, C("cream", 4))
    cv.rect(22, hy - 3, 3, 1, C("hair", 1))             # brow
    cv.px(24, hy + 4, C("red", 2))                      # smile
    cv.px(23, hy + 4, C("red", 2))
    cv.px(22, hy + 3, C("red", 4))
    cv.px(22, hy + 2, C("orange", 4))                   # cheek
    # near arm (3/4 sleeve, hand)
    ex, ey = 17 + math.sin(aswing) * 5, sy + 7
    hx2, hy2 = ex + math.sin(aswing * 1.4 + 0.3) * 5, ey + 5
    limb(cv, 17, sy + 2, ex, ey, 1.7, "black", 2)
    limb(cv, ex, ey, (ex + hx2) / 2, (ey + hy2) / 2, 1.4, "black", 3)
    limb(cv, (ex + hx2) / 2, (ey + hy2) / 2, hx2, hy2, 1.2, "skin", 3)
    # hair: voluminous dark curls, half-up into a long ponytail with lighter ends
    sw = [0, 1, 0, -1][frame % 4]
    crown = [(-1, -6.5), (2, -7), (4.6, -5.6), (-4, -5.6), (-6, -3), (-6.6, 0.5), (-6, 4), (6, -3.6)]
    side = [(-2.2, 1.5), (-3, 4.5), (-2.6, 7.5), (-3.2, 10.5), (-2.4, 13)]
    tail = [(-9, -4), (-10.6, -1), (-11.2, 2.4), (-11.6, 6), (-11.2, 9.6), (-11.8, 13), (-11.2, 16.4), (-11.8, 19.6), (-10.8, 22.4)]
    for i, (dx, dy) in enumerate(tail):
        k = i / len(tail)
        curl(cv, hx + dx - sw * k * 2.2, hy + dy, 2.9 if i < 7 else 2.4, i, tip=i >= 4)
    for i, (dx, dy) in enumerate(crown):
        curl(cv, hx + dx, hy + dy, 2.8, i)
    for i, (dx, dy) in enumerate(side):
        curl(cv, hx + dx, hy + dy, 2.3, i + 1, tip=i >= 3)
    cv.rect(hx - 8, hy - 5, 2, 3, C("red", 3))          # hair tie
    cv.outline(C("ink", 0))
    return cv


def yogi(frame):
    """Front view, tree pose with hands joined overhead. 32x56."""
    cv = Canvas(32, 56)
    up = frame
    cx = 16
    # hair behind
    hy = 15 - up
    tail = [(6.5, -1), (7.5, 2.5), (8, 6), (7.6, 9.5), (8.2, 13), (7.6, 16.5), (8, 19.5)]
    for i, (dx, dy) in enumerate(tail):
        curl(cv, cx + dx, hy + dy, 2.8, i, tip=i >= 3)
    for i, (dx, dy) in enumerate([(-6, -1), (-6.6, 2.5), (-6, 6), (-5.4, 9)]):
        curl(cv, cx + dx, hy + dy, 2.5, i, tip=i >= 2)
    # legs
    limb(cv, cx - 1, 34, cx - 1, 50, 2.1, "black", 2)
    limb(cv, cx + 2, 35, cx + 9, 41, 2.0, "black", 2)
    limb(cv, cx + 9, 41, cx + 2, 45, 1.8, "black", 1)
    cv.rect(cx - 4, 52, 7, 3, C("skin", 3))
    cv.rect(cx - 4, 54, 7, 1, C("skin", 1))
    cv.rect(cx, 44, 4, 3, C("skin", 2))
    # torso
    for y in range(21 - up, 36):
        t = (y - (21 - up)) / (15 + up)
        w = 5 if t < 0.25 else 4 if t < 0.7 else 6
        for x in range(cx - w, cx + w):
            cv.px(x, y, C("black", 1 if x >= cx + w - 2 else 3 if x == cx - w + 1 else 2))
    # arms up
    for sgn in (-1, 1):
        sx, sy = cx + sgn * 4.5, 22 - up
        ex, ey = cx + sgn * 9, 13 - up
        limb(cv, sx, sy, ex, ey, 1.7, "black", 2)
        limb(cv, ex, ey, cx + sgn * 5, 7 - up, 1.4, "black", 3)
        limb(cv, cx + sgn * 5, 7 - up, cx + sgn * 0.8, 2 - up + 1, 1.2, "skin", 3)
    cv.rect(cx - 1, 1 - up + 1, 2, 3, C("skin", 4))
    # head
    cv.rect(cx - 1, hy + 5, 3, 3, C("skin", 2))
    blob(cv, cx, hy, 5.4, 5.8, "skin", 2, 4)
    for sgn in (-1, 1):
        cv.rect(cx + sgn * 2.5 - (1 if sgn < 0 else 0), hy, 2, 1, C("black", 0))   # closed eyes
        cv.px(cx + sgn * 3.5, hy + 2, C("orange", 4))
    cv.rect(cx - 1, hy + 3, 3, 1, C("red", 2))
    for i, (dx, dy) in enumerate([(-4.4, -4), (-1.6, -5.6), (1.6, -5.8), (4.4, -4.2), (-5.6, -1.2), (5.6, -1.4)]):
        curl(cv, cx + dx, hy + dy, 2.6, i)
    cv.rect(cx + 5, hy - 5, 2, 2, C("red", 3))
    cv.outline(C("ink", 0))
    return cv
