"""Petal Peaks: all game art, drawn in code as pixel art.

Run:  python3 tools/make_art.py      ->  assets/*.png  (+ art/preview/*.png at 6x)
"""
import math
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pix import C, Canvas, RAMPS, hexrgb, ramp_gradient, dither_pick, value_noise_1d  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets")
PREV = os.path.join(ROOT, "art", "preview")
os.makedirs(OUT, exist_ok=True)
os.makedirs(PREV, exist_ok=True)

T = 24          # board tile size
M = 14          # tray (mini) tile size

# --------------------------------------------------------------------------- species
# name, petal ramp, accent ramp (centre), leaf ramp
SPECIES = [
    ("lavender",  "lav",    "lav",    "moss"),
    ("poppy",     "red",    "ink",    "grass"),
    ("daisy",     "cream",  "gold",   "grass"),
    ("sunflower", "gold",   "soil",   "grass"),
    ("cornflower", "blue",  "lav",    "grass"),
    ("edelweiss", "cream",  "gold",   "moss"),
    ("cosmos",    "pink",   "gold",   "grass"),
    ("marigold",  "orange", "red",    "grass"),
]


def block(cv, x, y, s, wet=False):
    """A raised block of garden soil (s x s) with a mossy rim, lit from top-left."""
    side = max(2, s // 8)          # visible front face height
    top = s - side
    r = 3 if s >= 20 else 2
    # silhouette
    for yy in range(s):
        for xx in range(s):
            # rounded corners
            cx = min(xx, s - 1 - xx)
            cy = min(yy, s - 1 - yy)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            if yy >= top - 1:
                c = C("soil", 1) if yy >= top else C("soil", 2)
                if yy == s - 1:
                    c = C("soil", 0)
            else:
                c = C("soil", 3)
            cv.px(x + xx, y + yy, c)
    # top face lighting: left/top edges light, right edge darker
    for yy in range(1, top - 1):
        if cv.filled(x + 1, y + yy):
            cv.px(x + 1, y + yy, C("soil", 4))
        cv.px(x + s - 2, y + yy, C("soil", 2))
    for xx in range(r, s - r):
        cv.px(x + xx, y + 1, C("soil", 4))
        cv.px(x + xx, y, C("soil", 4) if xx < s // 2 else C("soil", 3))
    # crumbly texture (deterministic)
    rnd = random.Random(s * 7 + 3)
    for _ in range(s * s // 14):
        xx = rnd.randint(3, s - 4)
        yy = rnd.randint(3, top - 3)
        cv.px(x + xx, y + yy, C("soil", 2) if rnd.random() < 0.6 else C("soil", 4))
    # little pebbles
    if s >= 20:
        for (xx, yy) in [(5, top - 5), (s - 6, 6)]:
            cv.px(x + xx, y + yy, C("stone", 4))
            cv.px(x + xx + 1, y + yy, C("stone", 3))
            cv.px(x + xx, y + yy + 1, C("stone", 2))
    # front face shading strokes
    for xx in range(2, s - 2, 3):
        cv.px(x + xx, y + top + (side // 2), C("soil", 0))
    if wet:
        for xx in range(3, s - 3):
            if (xx * 7) % 5 == 0:
                cv.px(x + xx, y + 3, C("blue", 4))


def moss_ring(cv, cx, cy, w):
    """Tuft of moss / grass at the base of the plant."""
    for i in range(-w, w + 1):
        h = 1 + (1 if abs(i) < w - 1 else 0)
        for k in range(h):
            cv.px(cx + i, cy - k, C("grass", 3 + (1 if k == h - 1 and i < 0 else 0)))
    cv.px(cx - w - 1, cy, C("grass", 2))
    cv.px(cx + w + 1, cy, C("grass", 2))
    for i in range(-w + 1, w, 2):
        cv.px(cx + i, cy - 2, C("grass", 5))


def leaf(cv, x, y, dx, dy, length, ramp="grass", lit=True):
    """A pointed leaf from (x,y) in direction (dx,dy)."""
    n = math.hypot(dx, dy) or 1
    ux, uy = dx / n, dy / n
    px_, py_ = -uy, ux
    for i in range(length):
        t = i / max(length - 1, 1)
        wid = math.sin(t * math.pi) * (length / 4.0)
        for k in range(-int(round(wid)), int(round(wid)) + 1):
            xx = x + ux * i + px_ * k
            yy = y + uy * i + py_ * k
            shade = 4 if (k <= 0) == lit else 3
            if abs(k) == int(round(wid)) and wid >= 1:
                shade -= 1
            cv.px(xx, yy, C(ramp, shade))
        cv.px(x + ux * i, y + uy * i, C(ramp, 2 if i < length - 1 else 4))  # vein


def stem(cv, x, y0, y1, ramp="grass"):
    for y in range(int(y1), int(y0) + 1):
        cv.px(x, y, C(ramp, 3))
        cv.px(x + 1, y, C(ramp, 2))


# ----- blooms: drawn centred at (cx, cy), size class big (board) or small (tray)
def bloom(cv, name, cx, cy, big=True):
    sp = dict((s[0], s) for s in SPECIES)[name]
    pet, acc = sp[1], sp[2]
    if name == "lavender":
        # three spikes of tiny florets, the middle one tallest
        spikes = [(0, 10, 0), (-3, 7, -1), (3, 7, 1)] if big else [(0, 6, 0), (-2, 4, -1), (2, 4, 1)]
        for ox, h, lean in spikes:
            for i in range(h):
                yy = cy + 3 - i
                xx = cx + ox + (lean if i > h * 0.6 else 0)
                cv.px(xx, yy + 1, C("moss", 2))
                if i >= 2:
                    cv.px(xx, yy, C(pet, 3 if i % 2 else 2))
                    cv.px(xx - 1, yy, C(pet, 4) if i % 2 == 0 else C(pet, 2))
                    if i % 2 == 1 and i < h - 1:
                        cv.px(xx + 1, yy, C(pet, 1))
            cv.px(cx + ox + lean, cy + 3 - h, C(pet, 5))
        return
    if name == "cornflower":
        R, n = (6, 9) if big else (4, 7)
        for i in range(n):
            ang = i / n * math.tau - math.pi / 2
            for d in range(2, R + 1):
                for k in (-1, 0, 1) if d > 2 else (0,):
                    xx = cx + math.cos(ang) * d + math.cos(ang + math.pi / 2) * k * (d / R)
                    yy = cy + math.sin(ang) * d + math.sin(ang + math.pi / 2) * k * (d / R)
                    lit = math.sin(ang) < 0 or math.cos(ang) < -0.5
                    cv.px(xx, yy, C(pet, (4 if lit else 3) - (1 if d == R and k == 0 else 0)))
            # fringed tip: two prongs
            for k in (-1, 1):
                a2 = ang + k * 0.28
                cv.px(cx + math.cos(a2) * (R + 1), cy + math.sin(a2) * (R + 1), C(pet, 2 if math.sin(ang) > 0 else 4))
        cv.disc(cx, cy, 2.2 if big else 1.4, C(acc, 1))
        cv.px(cx - 1, cy - 1, C(acc, 3))
        cv.px(cx, cy, C(acc, 2))
        cv.px(cx + 1, cy - 1, C("blue", 5))
        return
    if name == "sunflower":
        R = 6 if big else 4
        for a in range(16):
            ang = a / 16 * math.tau
            for d in range(R - 2, R + 1):
                xx = cx + math.cos(ang) * d
                yy = cy + math.sin(ang) * d
                cv.px(xx, yy, C(pet, 4 if math.sin(ang) < 0 else (3 if d < R else 2)))
        cv.disc(cx, cy, R - 2.6, C(acc, 1))
        for yy in range(-3, 4):
            for xx in range(-3, 4):
                if (xx + yy) % 2 == 0 and xx * xx + yy * yy <= (R - 3) ** 2:
                    cv.px(cx + xx, cy + yy, C(acc, 2))
        cv.px(cx - 1, cy - 2, C(acc, 3))
        return
    if name == "edelweiss":
        R = 6 if big else 4
        for a in range(5 if not big else 7):
            ang = a / (7 if big else 5) * math.tau - math.pi / 2
            for d in range(1, R + 1):
                xx = cx + math.cos(ang) * d
                yy = cy + math.sin(ang) * d
                cv.px(xx, yy, C(pet, 3 if d < R else 2))
                cv.px(xx + math.cos(ang + 1.6) * 0.8, yy + math.sin(ang + 1.6) * 0.8, C(pet, 2))
            cv.px(cx + math.cos(ang) * R, cy + math.sin(ang) * R, C("moss", 3))
        for dx, dy in [(0, 0), (-1, 0), (1, 0), (0, -1), (0, 1)]:
            cv.px(cx + dx, cy + dy, C(acc, 4 if (dx + dy) % 2 == 0 else 3))
        cv.px(cx, cy, C("cream", 4))
        return
    if name == "lavender":
        return
    # generic round flowers: poppy, daisy, cosmos, marigold
    if name == "daisy":
        R, n, wpet = (6, 12, 1) if big else (4, 8, 1)
    elif name == "poppy":
        R, n, wpet = (5, 5, 3) if big else (4, 4, 2)
    elif name == "cosmos":
        R, n, wpet = (6, 8, 2) if big else (4, 6, 1)
    else:  # marigold: ruffled pompom
        R, n, wpet = (5, 0, 0) if big else (4, 0, 0)
    if name == "marigold":
        cv.disc(cx, cy, R + 0.4, C(pet, 2))
        cv.disc(cx - 0.5, cy - 0.5, R - 0.8, C(pet, 3))
        for yy in range(-R, R + 1):
            for xx in range(-R, R + 1):
                d = math.hypot(xx, yy)
                if d <= R and (int(d * 1.6) % 2 == 0) and (xx * 3 + yy) % 4 == 0:
                    cv.px(cx + xx, cy + yy, C(pet, 4 if yy < 0 else 1))
        for a in range(10):
            ang = a / 10 * math.tau
            cv.px(cx + math.cos(ang) * (R + 0.6), cy + math.sin(ang) * (R + 0.6), C(pet, 3))
        cv.px(cx, cy, C(acc, 2))
        cv.px(cx - 2, cy - 2, C(pet, 5))
        return
    for i in range(n):
        ang = i / n * math.tau - math.pi / 2 + (0.3 if name == "poppy" else 0)
        for d in range(1, R + 1):
            for k in range(-wpet // 2 - (1 if name == "poppy" and d > 2 else 0), wpet // 2 + 1 + (1 if name == "poppy" and d > 2 else 0)):
                xx = cx + math.cos(ang) * d + math.cos(ang + math.pi / 2) * k * 0.9
                yy = cy + math.sin(ang) * d + math.sin(ang + math.pi / 2) * k * 0.9
                lit = math.sin(ang) < -0.2 or (math.cos(ang) < -0.4)
                shade = 4 if lit else 3
                if d == R:
                    shade -= 1
                if name == "daisy" and d == R:
                    shade = 3
                cv.px(xx, yy, C(pet, shade))
    if name == "poppy":
        cv.disc(cx, cy, 1.6, C("ink", 0))
        cv.px(cx, cy, C("moss", 3))
        for a in range(6):
            ang = a / 6 * math.tau
            cv.px(cx + math.cos(ang) * 2.4, cy + math.sin(ang) * 2.4, C("red", 1))
        cv.px(cx - 3, cy - 3, C(pet, 5))
    else:
        cv.disc(cx, cy, 1.8 if big else 1.2, C(acc, 3))
        cv.px(cx - 1, cy - 1, C(acc, 4))
        cv.px(cx + 1, cy + 1, C(acc, 2))
        if big:
            cv.px(cx, cy + 1, C(acc, 2))


def bud(cv, name, cx, cy, big=True):
    sp = dict((s[0], s) for s in SPECIES)[name]
    pet = sp[1]
    if name == "lavender":
        for i in range(5 if big else 3):
            cv.px(cx, cy - i, C(pet, 2 if i % 2 else 3))
            if i % 2 == 0:
                cv.px(cx - 1, cy - i, C(pet, 1))
        return
    # teardrop bud wrapped in sepals
    cv.ellipse(cx, cy - 1, 1.6 if big else 1.2, 2.4 if big else 1.8, C(pet, 3))
    cv.px(cx - 1, cy - 2, C(pet, 4))
    cv.px(cx, cy - 3, C(pet, 4) if big else C(pet, 3))
    cv.px(cx - 1, cy + 1, C("grass", 4))
    cv.px(cx + 1, cy + 1, C("grass", 3))
    cv.px(cx, cy + 1, C("grass", 2))


def plant_tile(name, stage, size=T, wet=False):
    """stage 0 bud, 1 bloom, 2 lush (bloom + companions)."""
    cv = Canvas(size, size)
    block(cv, 0, 0, size, wet)
    big = size >= 20
    leaf_r = dict((s[0], s) for s in SPECIES)[name][3]
    base_y = size - (size // 8) - (3 if big else 2)
    cx = size // 2 - 1 + (0 if big else 1)
    pl = Canvas(size, size)
    if stage == 2 and big:
        # companions first so the main flower sits on top
        for ox, oy in ((-6, 3), (6, 4)):
            stem(pl, cx + ox, base_y, base_y - 5, leaf_r)
            bloom(pl, name, cx + ox, base_y - 6 + (2 if name in ("lavender",) else 0), False)
    sh = (9 if stage else 6) if big else (5 if stage else 3)
    top = base_y - sh
    stem(pl, cx, base_y, top, leaf_r)
    L = 6 if big else 3
    leaf(pl, cx, base_y - 1, -4, -1, L, leaf_r)
    leaf(pl, cx + 1, base_y - 2, 4, -2, L, leaf_r, lit=False)
    if big and stage:
        leaf(pl, cx, base_y - 5, -3, -2, 4, leaf_r)
    if stage == 0:
        bud(pl, name, cx, top, big)
    else:
        fy = top - (0 if name in ("lavender",) else 2)
        if name == "lavender":
            fy = top + 1
        if not big:
            fy = top + (2 if name == "lavender" else -1)
        bloom(pl, name, cx, fy, big)
    pl.outline()
    # keep everything inside the tile's top
    moss_ring(cv, cx, base_y + 1, 3 if big else 2)
    cv.blit(pl, 0, 0)
    return cv


# --------------------------------------------------------------------------- obstacles
def stone_tile(size=T, cracked=False):
    cv = Canvas(size, size)
    s = size
    pts = [(2, s * 0.45), (s * 0.25, 3), (s * 0.7, 2), (s - 3, s * 0.35), (s - 2, s - 5), (s * 0.6, s - 2), (3, s - 3)]
    cv.poly(pts, C("stone", 3))
    # facets
    cv.poly([(4, s * 0.45), (s * 0.27, 5), (s * 0.55, 4), (s * 0.45, s * 0.45)], C("stone", 4))
    cv.poly([(s * 0.55, 4), (s * 0.7, 3), (s - 4, s * 0.36), (s * 0.45, s * 0.45)], C("stone", 3))
    cv.poly([(s * 0.45, s * 0.45), (s - 4, s * 0.36), (s - 3, s - 6), (s * 0.6, s - 3)], C("stone", 2))
    cv.poly([(4, s * 0.47), (s * 0.45, s * 0.47), (s * 0.58, s - 3), (4, s - 4)], C("stone", 3))
    cv.line(s * 0.28, 6, s * 0.5, 5, C("stone", 5))
    cv.px(s * 0.3, 7, C("stone", 6))
    # moss patches and lichen
    for (x, y) in [(5, s - 6), (6, s - 6), (7, s - 5), (5, s - 5), (s - 6, s * 0.4), (s - 5, s * 0.42)]:
        cv.px(x, y, C("moss", 3))
    cv.px(6, s - 7, C("moss", 4))
    cv.px(s * 0.55, s * 0.3, C("gold", 4))
    cv.px(s * 0.56, s * 0.3, C("gold", 3))
    if cracked:
        cv.line(s * 0.4, s * 0.2, s * 0.5, s * 0.55, C("stone", 0))
        cv.line(s * 0.5, s * 0.55, s * 0.42, s * 0.8, C("stone", 0))
        cv.line(s * 0.5, s * 0.55, s * 0.68, s * 0.65, C("stone", 1))
    cv.outline()
    return cv


def weed_tile(size=T, frame=0):
    """Spiky thistle weed that spreads if you ignore it."""
    cv = Canvas(size, size)
    pl = Canvas(size, size)
    s = size
    cx, by = s // 2, s - 5
    sway = -1 if frame else 1
    for i, (dx, dy, l) in enumerate([(-6, -1, 8), (6, -2, 8), (-5, -4, 8), (5, -5, 8), (-2, -7, 7), (2, -7, 7), (-7, 2, 6), (7, 1, 6)]):
        leaf(pl, cx, by, dx, dy, l, "moss", lit=i % 2 == 0)
        n = math.hypot(dx, dy)
        tx, ty = cx + dx / n * (l - 1), by + dy / n * (l - 1)
        pl.px(tx + (1 if dx > 0 else -1), ty - 1, C("cream", 3))   # spine tip
    for hx, hy, sw in ((cx - 4, 4, sway), (cx + 4, 6, -sway)):
        stem(pl, hx - (1 if hx < cx else 0), by - 2, hy + 3, "moss")
        pl.ellipse(hx + sw * 0.5, hy + 3, 2.4, 1.8, C("moss", 3))
        pl.px(hx - 1 + sw * 0.5, hy + 2, C("moss", 4))
        for k in range(-2, 3):
            pl.px(hx + k + sw * 0.5, hy + 1, C("pink", 3 if k % 2 else 4))
            if abs(k) < 2:
                pl.px(hx + k + sw * 0.5, hy, C("pink", 2 if k else 4))
        pl.px(hx + sw * 0.5, hy - 1, C("pink", 4))
    pl.outline()
    cv.ellipse(cx, by + 1, 8, 2.5, C("soil", 1))
    cv.ellipse(cx - 1, by, 6, 1.6, C("soil", 2))
    cv.blit(pl, 0, 0)
    return cv


def plastic_tile(size=T):
    """A discarded plastic bottle lying in the grass."""
    cv = Canvas(size, size)
    s = size
    b = Canvas(s, s)
    # body (rotated diagonally)
    for i in range(14):
        x = 4 + i
        y = s - 8 - i * 0.55
        for k in range(-3, 4):
            c = C("teal", 4 if k < -1 else (3 if k < 2 else 2))
            if k == -2 and i % 4 == 1:
                c = C("teal", 5)
            b.px(x + k * 0.3, y + k, c)
    # label
    for i in range(4, 9):
        x = 4 + i
        y = s - 8 - i * 0.55
        for k in range(-3, 4):
            b.px(x + k * 0.3, y + k, C("red", 3 if k < 0 else 2) if i != 6 else C("cream", 3))
    # neck + cap
    for i in range(14, 17):
        x = 4 + i
        y = s - 8 - i * 0.55
        for k in range(-1, 2):
            b.px(x + k * 0.3, y + k, C("teal", 4 if k < 0 else 3))
    for k in range(-1, 2):
        b.px(21 + k * 0.3, s - 8 - 17 * 0.55 + k, C("blue", 2))
        b.px(22 + k * 0.3, s - 8 - 18 * 0.55 + k, C("blue", 3))
    b.outline()
    # shadow
    cv.ellipse(s / 2 + 1, s - 6, 9, 2, C("grass", 1))
    cv.blit(b, 0, 0)
    return cv


def mushroom_tile(size=T):
    cv = Canvas(size, size)
    m = Canvas(size, size)
    s = size
    for (cx, cy, r, st) in [(9, 13, 6, 6), (17, 16, 4, 4)]:
        m.rect(cx - 1, cy, 3, st, C("cream", 3))
        m.vline(cx - 1, cy, cy + st - 1, C("cream", 4))
        m.vline(cx + 1, cy, cy + st - 1, C("cream", 1))
        for yy in range(-r // 2 - 1, 1):
            w = math.sqrt(max(r * r - (yy * 2) ** 2, 0))
            for xx in range(-int(w), int(w) + 1):
                m.px(cx + xx, cy + yy, C("red", 3 if xx < 0 and yy < -1 else 2))
        m.hline(cx - r + 1, cx + r - 1, cy + 1, C("cream", 2))
        for (dx, dy) in [(-2, -2), (2, -1), (0, -r // 2 - 1), (-r + 2, 0), (r - 2, -1)]:
            m.px(cx + dx, cy + dy, C("cream", 4))
    m.outline()
    cv.ellipse(13, s - 3, 9, 2, C("grass", 2))
    cv.blit(m, 0, 0)
    return cv


# --------------------------------------------------------------------------- board cells
def cell_tile(variant, size=T):
    """Empty board cell: lawn bed. variant 0/1 alternate the 3x3 boxes."""
    cv = Canvas(size, size)
    base = 3 if variant == 0 else 2
    rnd = random.Random(variant * 31 + size)
    cv.rect(0, 0, size, size, C("grass", base))
    # inner frame: subtle bevel
    cv.hline(0, size - 1, 0, C("grass", base + 1))
    cv.vline(0, 0, size - 1, C("grass", base + 1))
    cv.hline(0, size - 1, size - 1, C("grass", base - 1))
    cv.vline(size - 1, 0, size - 1, C("grass", base - 1))
    # grass blades
    for _ in range(size * 2):
        x = rnd.randint(1, size - 2)
        y = rnd.randint(2, size - 2)
        c = C("grass", base + (1 if rnd.random() < 0.6 else -1))
        cv.px(x, y, c)
        if rnd.random() < 0.4:
            cv.px(x, y - 1, C("grass", base + 1))
    # clover / tiny flowers
    for _ in range(2 if variant == 0 else 1):
        x, y = rnd.randint(4, size - 5), rnd.randint(4, size - 5)
        if rnd.random() < 0.5:
            cv.px(x, y, C("cream", 4))
            cv.px(x - 1, y, C("cream", 3))
            cv.px(x + 1, y, C("cream", 3))
            cv.px(x, y - 1, C("cream", 3))
            cv.px(x, y + 1, C("gold", 3))
        else:
            for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
                cv.px(x + dx, y + dy, C("grass", base + 2))
            cv.px(x, y, C("grass", base + 3))
    return cv


def frame_9slice():
    """Wooden planter frame, 9-slice source 48x48 with 10px borders."""
    S, B = 48, 10
    cv = Canvas(S, S)
    # planks
    for y in range(S):
        for x in range(S):
            inside = B <= x < S - B and B <= y < S - B
            if inside:
                continue
            horiz = (y < B or y >= S - B)
            g = (x if horiz else y)
            grain = (g * 3 + (y if horiz else x) * 7) % 11
            shade = 4 if grain < 6 else 3
            if (y if horiz else x) in (1, 2):
                shade = 5
            if (y if horiz else x) in (B - 2, S - B + 1):
                shade = 2
            cv.px(x, y, C("wood", shade))
    # plank seams and edges
    for t in range(S):
        cv.px(t, 0, C("wood", 1))
        cv.px(t, S - 1, C("wood", 0))
        cv.px(0, t, C("wood", 1))
        cv.px(S - 1, t, C("wood", 0))
    for t in range(B, S - B + 1):
        cv.px(t, B - 1, C("wood", 1))
        cv.px(t, S - B, C("wood", 5))
        cv.px(B - 1, t, C("wood", 1))
        cv.px(S - B, t, C("wood", 5))
    # mitred corners
    for i in range(B):
        cv.px(i, i, C("wood", 2))
        cv.px(S - 1 - i, i, C("wood", 2))
        cv.px(i, S - 1 - i, C("wood", 2))
        cv.px(S - 1 - i, S - 1 - i, C("wood", 1))
    # nails
    for (x, y) in [(4, 4), (S - 5, 4), (4, S - 5), (S - 5, S - 5)]:
        cv.px(x, y, C("stone", 5))
        cv.px(x + 1, y + 1, C("stone", 1))
        cv.px(x + 1, y, C("stone", 3))
        cv.px(x, y + 1, C("stone", 2))
    # moss creeping on the bottom plank and corners
    for x in range(2, 14):
        if x % 3 != 1:
            cv.px(x, S - 2 - (x % 2), C("moss", 3 + (x % 2)))
    for x in range(S - 16, S - 3):
        if x % 4 != 0:
            cv.px(x, S - 2, C("moss", 3))
    for y in range(2, 9):
        cv.px(1 + (y % 2), y, C("moss", 3))
    return cv


def write(name, cv, scale=1):
    cv.save(os.path.join(OUT, name + ".png"), scale)


def preview(name, cvs, scale=6, cols=None, bg=(40, 32, 44, 255), pad=2):
    cols = cols or len(cvs)
    rows = (len(cvs) + cols - 1) // cols
    w = max(c.w for c in cvs)
    h = max(c.h for c in cvs)
    sheet = Canvas(cols * (w + pad) + pad, rows * (h + pad) + pad, bg)
    for i, c in enumerate(cvs):
        sheet.blit(c, pad + (i % cols) * (w + pad), pad + (i // cols) * (h + pad))
    sheet.save(os.path.join(PREV, name + ".png"), scale)


def build_tiles():
    sheet = []
    for name, *_ in SPECIES:
        for st in range(3):
            t = plant_tile(name, st)
            write(f"p_{name}_{st}", t)
            sheet.append(t)
    preview("plants", sheet, cols=6)
    minis = []
    for name, *_ in SPECIES:
        for st in (1,):
            t = plant_tile(name, st, M)
            write(f"m_{name}_{st}", t)
            minis.append(t)
    preview("minis", minis, cols=8, scale=8)
    obs = [stone_tile(), stone_tile(cracked=True), weed_tile(frame=0), weed_tile(frame=1), plastic_tile(), mushroom_tile(), cell_tile(0), cell_tile(1)]
    for n, c in zip(["stone", "stone_cracked", "weed_0", "weed_1", "plastic", "mushroom", "cell_0", "cell_1"], obs):
        write(n, c)
    write("frame", frame_9slice())
    preview("obstacles", obs + [frame_9slice()], cols=9)




# =========================================================================== backgrounds
BW, BH = 252, 560

BIOMES = [
    # name, sky ramp colours top->bottom, sun, far mtn, near mtn, hill ramp, tree kind, flowers
    dict(key="meadow", sky=[("sky", 2), ("sky", 3), ("sky", 4), ("sky", 5)], sun=("gold", 5), sunpos=(190, 70),
         far=("blue", 3), farsnow=True, mid=("teal", 2), hills=["grass", 4, 3], trees="pine", flowers=["cream", "gold", "pink"]),
    dict(key="lavender", sky=[("dusk", 2), ("dusk", 3), ("dusk", 4), ("dusk", 5)], sun=("gold", 5), sunpos=(70, 120),
         far=("dusk", 2), farsnow=False, mid=("lav", 2), hills=["grass", 3, 2], trees="cypress", flowers=["lav", "lav", "gold"], rows="lav"),
    dict(key="alpine", sky=[("sky", 1), ("sky", 2), ("sky", 3), ("sky", 4)], sun=("cream", 4), sunpos=(60, 60),
         far=("stone", 3), farsnow=True, mid=("stone", 2), hills=["moss", 3, 2], trees="pine", flowers=["cream", "cream", "blue"], peaks=True),
    dict(key="forest", sky=[("teal", 3), ("teal", 4), ("teal", 5), ("cream", 4)], sun=("cream", 4), sunpos=(150, 90),
         far=("teal", 3), farsnow=False, mid=("teal", 2), hills=["grass", 3, 2], trees="fir", flowers=["cream", "pink", "gold"], mist=True),
    dict(key="canyon", sky=[("dusk", 1), ("dusk", 2), ("dusk", 3), ("orange", 4)], sun=("gold", 5), sunpos=(126, 140),
         far=("dusk", 2), farsnow=False, mid=("orange", 2), hills=["soil", 4, 3], trees="cactus", flowers=["pink", "gold", "orange"], mesa=True),
    dict(key="terraces", sky=[("pink", 3), ("pink", 4), ("pink", 5), ("gold", 5)], sun=("cream", 4), sunpos=(200, 100),
         far=("teal", 3), farsnow=False, mid=("teal", 2), hills=["grass", 5, 4], trees="palm", flowers=["pink", "cream", "red"], terrace=True),
]


def ridge(seed, base, amp, rough=4, freq=48):
    return [base - v * amp for v in value_noise_1d(seed, BW + 4, octaves=rough, base=freq)]


def draw_cloud(cv, x, y, w, rng, lit=("cream", 4), mid=("cream", 3), dark=("sky", 4)):
    puffs = []
    n = max(3, w // 9)
    for i in range(n):
        px_ = x + i * w / n + rng.uniform(-2, 2)
        r = rng.uniform(4, 8) * (1 - abs(i - n / 2) / n)
        puffs.append((px_, y - r * 0.6, r + 2))
    for (px_, py_, r) in puffs:
        cv.ellipse(px_, py_ + 1, r, r * 0.75, C(*dark))
    for (px_, py_, r) in puffs:
        cv.ellipse(px_, py_, r, r * 0.7, C(*mid))
    for (px_, py_, r) in puffs:
        cv.ellipse(px_ - 1, py_ - 1.5, r * 0.75, r * 0.5, C(*lit))
    cv.rect(x - 2, y, w + 4, 2, C(*dark))


def pine(cv, x, y, h, ramp, lvl):
    """Layered pine silhouette with light on the left."""
    tiers = max(3, h // 5)
    for t in range(tiers):
        ty = y - h + t * h / tiers
        w = 1.5 + (t + 1) * h / tiers * 0.45
        for yy in range(int(h / tiers) + 2):
            ww = w * (yy + 1) / (h / tiers + 2)
            for xx in range(-int(ww), int(ww) + 1):
                cv.px(x + xx, ty + yy, C(ramp, lvl + (1 if xx < -ww / 3 else (0 if xx < ww / 3 else -1))))
    cv.vline(x, y - 1, y + 1, C("wood", 1))


def fir(cv, x, y, h, ramp, lvl):
    cv.rect(x - 1, y - h, 3, h + 2, C("wood", 1))
    cv.vline(x - 1, y - h, y, C("wood", 2))
    for t in range(6):
        ty = y - h + t * h / 7
        w = 3 + t * 2
        for yy in range(5):
            for xx in range(-w + yy, w - yy + 1):
                if (xx + yy * 3) % 5 != 0:
                    cv.px(x + xx, ty + yy - 2, C(ramp, lvl + (1 if xx < 0 else 0)))


def cypress(cv, x, y, h, ramp, lvl):
    for yy in range(h):
        t = yy / h
        w = math.sin(t * math.pi) ** 0.7 * h * 0.16 + 0.5
        for xx in range(-int(w), int(w) + 1):
            cv.px(x + xx, y - h + yy, C(ramp, lvl + (1 if xx < 0 else 0) - (1 if (yy + xx) % 4 == 0 and xx > 0 else 0)))


def cactus(cv, x, y, h, ramp, lvl):
    cv.rect(x - 2, y - h, 5, h, C(ramp, lvl))
    cv.vline(x - 1, y - h, y, C(ramp, lvl + 1))
    cv.vline(x + 2, y - h + 1, y, C(ramp, lvl - 1))
    cv.px(x, y - h - 1, C(ramp, lvl))
    for side, ah in ((-1, h * 0.55), (1, h * 0.4)):
        ax = x + side * 5
        cv.rect(min(ax, x + side * 2), y - ah, 4, 3, C(ramp, lvl))
        cv.rect(ax - 1, y - ah - h * 0.3, 3, h * 0.3 + 2, C(ramp, lvl))
        cv.vline(ax - 1, y - ah - h * 0.3, y - ah, C(ramp, lvl + 1))
    cv.px(x, y - h - 2, C("pink", 4))


def palm(cv, x, y, h, ramp, lvl, rng):
    lean = rng.choice((-1, 1)) * rng.uniform(0.15, 0.3)
    top = (x + lean * h, y - h)
    for i in range(h):
        xx = x + lean * i * (i / h)
        cv.px(xx, y - i, C("wood", 2 if i % 3 else 3))
        cv.px(xx + 1, y - i, C("wood", 1))
    tx, ty = x + lean * h, y - h
    for ang in (-2.8, -2.2, -1.6, -1.0, -0.4, 0.3, 2.6):
        for d in range(int(h * 0.45)):
            fx = tx + math.cos(ang) * d
            fy = ty + math.sin(ang) * d * 0.6 + (d * d) / (h * 0.9)
            cv.px(fx, fy, C(ramp, lvl + 1 if d < 4 else lvl))
            cv.px(fx, fy + 1, C(ramp, lvl - 1))


def smooth_slope(rid, x, k=4):
    a = rid[max(0, x - k)]
    b = rid[min(len(rid) - 1, x + k)]
    return (b - a) / (2 * k)


def peaks_ridge(seed, base, n, hmin, hmax, slope=(0.6, 1.4), rough=2.0):
    """Ridge from overlapping triangular peaks + a little noise. Returns heights and the side of each column."""
    rng = random.Random(seed)
    pk = []
    for i in range(n):
        x = (i + rng.uniform(0.1, 0.9)) * BW / n
        pk.append((x, base - rng.uniform(hmin, hmax), rng.uniform(*slope), rng.uniform(*slope)))
    noise = value_noise_1d(seed + 9, BW + 8, octaves=3, base=10)
    hs, side, tops = [], [], []
    for x in range(BW + 8):
        best, sd, tp = base + 40, 0, base
        for (px_, py_, sl, sr) in pk:
            y = py_ + (px_ - x) * sl if x < px_ else py_ + (x - px_) * sr
            if y < best:
                best, sd, tp = y, (1 if x < px_ else -1), py_
        hs.append(best + (noise[x] - 0.5) * rough * 2)
        side.append(sd)
        tops.append(tp)
    return hs, side, tops


def mountain_layer(cv, rid, side, tops, bottom, ramp, lvl, snow=False, haze=None, seed=0):
    rng = random.Random(seed)
    for x in range(BW):
        top = int(rid[x])
        sd = side[x]
        shade = lvl + (1 if sd > 0 else -1)
        snow_depth = int((bottom - tops[x]) * 0.18) + (x * 7 % 4)
        for y in range(top, bottom):
            c = C(ramp, shade)
            # gullies: darker streaks running down the faces
            if sd > 0 and (x * 5 + (y - top) // 3) % 17 == 0 and y - top > 4:
                c = C(ramp, shade - 1)
            if sd < 0 and (x * 3 + (y - top) // 4) % 13 == 0 and y - top > 4:
                c = C(ramp, max(0, shade - 1))
            if snow and (y - tops[x]) < snow_depth and tops[x] < bottom - 60:
                c = C("snow", 3 if sd > 0 else 1)
                if (y - tops[x]) > snow_depth - 3 and (x + y) % 2:
                    c = C(ramp, shade)
            if haze is not None and y > bottom - 30 and dither_pick(x, y, (y - (bottom - 30)) / 34):
                c = haze
            cv.px(x, y, c)
        hl = C("snow", 4) if snow and tops[x] < bottom - 60 and top - tops[x] < 4 else C(ramp, min(shade + 1, len(RAMPS[ramp]) - 1))
        cv.px(x, top, hl)


def background(b, seed):
    rng = random.Random(seed)
    cv = Canvas(BW, BH)
    sky_cols = [C(r, i) for r, i in b["sky"]]
    ramp_gradient(cv, 0, 0, BW, 300, sky_cols)
    cv.rect(0, 300, BW, BH - 300, sky_cols[-1])
    # sun with dithered halo
    sx, sy = b["sunpos"]
    for rr in (34, 24):
        for yy in range(-rr, rr + 1):
            for xx in range(-rr, rr + 1):
                d = math.hypot(xx, yy)
                if d <= rr and dither_pick(sx + xx, sy + yy, 0.55 if rr == 34 else 0.85) and d > 14:
                    base = cv.get(sx + xx, sy + yy)
                    if base[3]:
                        cv.px(sx + xx, sy + yy, sky_cols[min(len(sky_cols) - 1, 3)])
    cv.disc(sx, sy, 13, C(*b["sun"]))
    cv.disc(sx - 2, sy - 2, 9, C(b["sun"][0], min(b["sun"][1] + 1, len(RAMPS[b["sun"][0]]) - 1)))
    # clouds
    for i in range(5):
        draw_cloud(cv, rng.randint(-20, BW - 20), rng.randint(30, 200), rng.randint(30, 70), rng)
    # far mountains
    far_r, far_i = b["far"]
    if b.get("mesa"):
        tops = []
        x = -10
        while x < BW:
            w = rng.randint(40, 80)
            h = rng.randint(200, 250)
            tops.append((x, w, h))
            x += w + rng.randint(-10, 20)
        for (x, w, h) in tops:
            cv.poly([(x - 8, 330), (x, h), (x + w, h), (x + w + 8, 330)], C(far_r, far_i))
            cv.hline(x, x + w, h, C(far_r, far_i + 2))
            for yy in range(h + 6, 330, 9):
                cv.hline(x - (yy - h) * 8 / (330 - h), x + w + (yy - h) * 8 / (330 - h), yy, C(far_r, far_i + 1))
    else:
        hs, sd, tp = peaks_ridge(seed + 1, 340, 6 if not b.get("peaks") else 6, 90 if not b.get("peaks") else 120, 140 if not b.get("peaks") else 170)
        mountain_layer(cv, hs, sd, tp, 340, far_r, far_i, snow=b["farsnow"], haze=sky_cols[-1], seed=seed)
    # mid mountains / forest layer
    mid_r, mid_i = b["mid"]
    hs2, sd2, tp2 = peaks_ridge(seed + 2, 382, 6, 60, 95, slope=(0.45, 0.8), rough=1.5)
    rid2 = hs2
    mountain_layer(cv, hs2, sd2, tp2, 382, mid_r, mid_i, seed=seed + 5)
    if b.get("mist"):
        for y in range(280, 330):
            for x in range(BW):
                if dither_pick(x, y, 1 - abs(y - 305) / 25):
                    cv.px(x, y, C("teal", 5))
    # tree line on the mid layer
    for x in range(0, BW, 7):
        tx = x + rng.randint(-2, 2)
        ty = int(rid2[max(0, min(BW - 1, tx))]) + 4
        h = rng.randint(10, 18)
        kind = b["trees"]
        if kind in ("pine", "fir"):
            pine(cv, tx, ty, h, "grass" if b["key"] != "alpine" else "teal", 1)
        elif kind == "cypress" and rng.random() < 0.5:
            cypress(cv, tx, ty, h + 6, "moss", 1)
        elif kind == "palm" and rng.random() < 0.35:
            palm(cv, tx, ty, h + 4, "grass", 2, rng)
    # terraces or hills
    hr, h1, h2 = b["hills"]
    if b.get("terrace"):
        y = 340
        k = 0
        while y < BH:
            rid3 = ridge(seed + 10 + k, y, 14, rough=3, freq=70)
            for x in range(BW):
                top = int(rid3[x])
                for yy in range(top, top + 20):
                    cv.px(x, yy, C("teal", 4) if yy < top + 3 else C(hr, h1 - (k % 2)))
                cv.px(x, top, C("cream", 4) if x % 9 < 4 else C("teal", 5))
                cv.px(x, top + 3, C("soil", 2))
            y += 22
            k += 1
    else:
        for k, base in enumerate((350, 390, 440)):
            rid3 = ridge(seed + 20 + k, base, 30 - k * 6, rough=3, freq=60)
            for x in range(BW):
                top = int(rid3[x])
                slope = rid3[x + 1] - rid3[x]
                for y in range(top, BH):
                    c = C(hr, (h1 if k % 2 == 0 else h2) + (1 if slope < -0.1 and y < top + 6 else 0))
                    cv.px(x, y, c)
                if b.get("rows"):
                    for y in range(top + 6, BH, 7):
                        if (x + y // 7 * 3) % 6 < 4:
                            cv.px(x, y, C(b["rows"], 3))
                            cv.px(x, y - 1, C(b["rows"], 4) if x % 3 == 0 else C(b["rows"], 2))
            # trees on hills
            for i in range(3):
                tx = rng.randint(5, BW - 5)
                ty = int(rid3[tx]) + 3
                kind = b["trees"]
                if kind == "pine":
                    pine(cv, tx, ty, 20 + k * 6, "grass", 1)
                elif kind == "fir":
                    fir(cv, tx, ty, 28 + k * 8, "grass", 1)
                elif kind == "cypress":
                    cypress(cv, tx, ty, 24 + k * 6, "moss", 1)
                elif kind == "cactus":
                    cactus(cv, tx, ty, 10 + k * 4, "moss", 2)
    # foreground flowers and grass
    fl = b["flowers"]
    for i in range(400):
        x = rng.randint(0, BW - 1)
        y = rng.randint(420, BH - 1)
        c = cv.get(x, y)
        if c[3] and c[:3] != (0, 0, 0):
            if rng.random() < 0.5:
                cv.px(x, y, C(fl[i % len(fl)], 4))
                cv.px(x, y + 1, C("grass", 2))
            else:
                cv.px(x, y, C(hr, min(h1 + 2, len(RAMPS[hr]) - 1)))
    return cv


def build_backgrounds():
    prev = []
    for i, b in enumerate(BIOMES):
        cv = background(b, 100 + i * 17)
        write("bg_" + b["key"], cv)
        prev.append(cv)
    preview("backgrounds", prev, scale=2, cols=6)



# =========================================================================== UI
def panel_9slice():
    """Cream paper card with embroidered dashed border. 30x30, 10px borders."""
    S = 30
    cv = Canvas(S, S)
    r = 4
    for y in range(S):
        for x in range(S):
            cx = min(x, S - 1 - x)
            cy = min(y, S - 1 - y)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            cv.px(x, y, C("cream", 3))
    # bottom shadow edge and top light
    for x in range(S):
        for y in range(S - 3, S):
            if cv.filled(x, y):
                cv.px(x, y, C("cream", 1) if y == S - 1 else C("cream", 2))
    for x in range(r, S - r):
        cv.px(x, 1, C("cream", 4))
    # paper fibres
    rnd = random.Random(5)
    for _ in range(40):
        x, y = rnd.randint(3, S - 4), rnd.randint(3, S - 5)
        cv.px(x, y, C("cream", 2) if rnd.random() < 0.5 else C("cream", 4))
    # stitched border
    for t in range(5, S - 5):
        if t % 3 != 0:
            cv.px(t, 4, C("orange", 3))
            cv.px(t, S - 6, C("orange", 3))
            cv.px(4, t, C("orange", 3))
            cv.px(S - 5, t, C("orange", 3))
    cv.outline(C("ink", 1))
    return cv


def button_9slice(ramp, base):
    """Rounded pill button with a 3px pressed depth. 20x20, 7px borders."""
    S = 20
    cv = Canvas(S, S)
    r = 5
    for y in range(S):
        for x in range(S):
            cx = min(x, S - 1 - x)
            cy = min(y, S - 1 - y)
            if cx < r and cy < r and (r - cx - 0.5) ** 2 + (r - cy - 0.5) ** 2 > r * r:
                continue
            if y >= S - 4:
                c = C(ramp, base - 2)
            elif y <= 2:
                c = C(ramp, base + 1)
            else:
                c = C(ramp, base)
            cv.px(x, y, c)
    for x in range(r, S - r):
        cv.px(x, 1, C(ramp, base + 2))
    cv.px(3, 3, C(ramp, base + 2))
    cv.px(2, 4, C(ramp, base + 1))
    cv.outline(C("ink", 0))
    return cv


ICON = 13


def icon(name):
    cv = Canvas(ICON, ICON)
    W_ = C("cream", 4)
    D_ = C("cream", 2)
    if name == "pause":
        cv.rect(3, 2, 3, 9, W_)
        cv.rect(8, 2, 3, 9, W_)
    elif name == "play":
        cv.poly([(3, 1.5), (11.5, 6.5), (3, 11.5)], W_)
    elif name in ("sound", "mute"):
        cv.rect(1, 4, 3, 5, W_)
        cv.poly([(4, 4), (8, 0.5), (8, 12.5), (4, 9)], W_)
        if name == "sound":
            cv.vline(10, 4, 8, D_)
            cv.px(11, 3, D_)
            cv.px(11, 9, D_)
            cv.vline(12, 4, 8, D_)
        else:
            cv.line(9, 4, 12, 8, C("red", 4))
            cv.line(12, 4, 9, 8, C("red", 4))
    elif name == "music":
        cv.rect(4, 1, 7, 2, W_)
        cv.vline(4, 1, 9, W_)
        cv.vline(10, 1, 8, W_)
        cv.ellipse(3, 10, 2, 1.6, W_)
        cv.ellipse(9, 9, 2, 1.6, W_)
    elif name == "gear":
        cv.disc(6.5, 6.5, 4.6, W_)
        for a in range(8):
            ang = a / 8 * math.tau
            cv.rect(6 + math.cos(ang) * 5 - 0.5, 6 + math.sin(ang) * 5 - 0.5, 2, 2, W_)
        cv.disc(6.5, 6.5, 1.8, (0, 0, 0, 0))
    elif name == "home":
        cv.poly([(6.5, 0.5), (12.5, 6.5), (0.5, 6.5)], W_)
        cv.rect(2, 6, 9, 6, W_)
        cv.rect(5, 8, 3, 4, (0, 0, 0, 0))
    elif name == "retry":
        for a in range(0, 300, 12):
            ang = math.radians(a - 60)
            cv.px(6.5 + math.cos(ang) * 4.5, 6.5 + math.sin(ang) * 4.5, W_)
            cv.px(6.5 + math.cos(ang) * 3.6, 6.5 + math.sin(ang) * 3.6, W_)
        cv.poly([(8, 0), (12, 3), (8, 5)], W_)
    elif name == "map":
        cv.poly([(0.5, 2), (4.5, 0.5), (8.5, 2), (12.5, 0.5), (12.5, 11), (8.5, 12.5), (4.5, 11), (0.5, 12.5)], W_)
        cv.vline(4, 1, 11, D_)
        cv.vline(8, 2, 12, D_)
        cv.px(10, 5, C("red", 3))
        cv.px(6, 7, C("red", 3))
        cv.px(2, 9, C("red", 3))
    elif name == "close":
        cv.line(2, 2, 10, 10, W_)
        cv.line(3, 2, 11, 10, W_)
        cv.line(10, 2, 2, 10, W_)
        cv.line(11, 2, 3, 10, W_)
    elif name == "breath":
        # wind swirl
        for a in range(0, 330, 10):
            ang = math.radians(a)
            r = 1 + a / 330 * 4.5
            cv.px(6 + math.cos(ang) * r, 5 + math.sin(ang) * r, W_)
        cv.hline(1, 10, 11, W_)
        cv.hline(4, 12, 9, D_)
    elif name == "compost":
        cv.poly([(1.5, 3), (11.5, 3), (10, 12.5), (3, 12.5)], C("wood", 4))
        for y in (5, 8, 11):
            cv.hline(3, 10, y, C("wood", 2))
        cv.rect(1, 2, 11, 2, C("wood", 5))
        leaf(cv, 5, 2, 3, -2, 4, "grass")
    elif name == "rain":
        cv.ellipse(6, 4, 5, 3, W_)
        cv.ellipse(4, 3, 3, 2.5, W_)
        for x in (3, 6, 9):
            cv.vline(x, 8, 9, C("blue", 4))
            cv.px(x - 1, 11, C("blue", 4))
    elif name == "lock":
        cv.rect(2, 6, 9, 7, C("gold", 3))
        cv.hline(2, 10, 6, C("gold", 4))
        for a in range(0, 181, 15):
            ang = math.radians(180 + a)
            cv.px(6.5 + math.cos(ang) * 3, 6 + math.sin(ang) * 4, C("stone", 4))
        cv.px(6, 9, C("ink", 1))
        cv.px(6, 10, C("ink", 1))
    elif name == "star":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rr = 6.2 if i % 2 == 0 else 2.7
            pts.append((6.5 + math.cos(ang) * rr, 6.8 + math.sin(ang) * rr))
        cv.poly(pts, C("gold", 4))
        cv.px(5, 5, C("gold", 5))
        cv.px(4, 6, C("gold", 5))
    elif name == "star_off":
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rr = 6.2 if i % 2 == 0 else 2.7
            pts.append((6.5 + math.cos(ang) * rr, 6.8 + math.sin(ang) * rr))
        cv.poly(pts, C("stone", 2))
    elif name == "leaf":
        leaf(cv, 2, 11, 9, -9, 11, "grass")
    elif name == "check":
        cv.line(2, 7, 5, 10, W_)
        cv.line(2, 6, 5, 9, W_)
        cv.line(5, 10, 11, 3, W_)
        cv.line(5, 9, 11, 2, W_)
    elif name == "flower":
        for a in range(5):
            ang = a / 5 * math.tau - math.pi / 2
            cv.disc(6.5 + math.cos(ang) * 3.2, 6.5 + math.sin(ang) * 3.2, 2.2, C("pink", 4))
        cv.disc(6.5, 6.5, 1.8, C("gold", 4))
    elif name == "moves":
        # footprint: boot sole
        cv.ellipse(5, 4, 2.6, 3.4, W_)
        cv.ellipse(5.5, 10, 2, 2, W_)
        cv.ellipse(9.5, 6, 1.6, 2.2, D_)
    elif name == "lang":
        cv.disc(6.5, 6.5, 5.6, C("blue", 3))
        cv.ellipse(5, 5, 2.5, 2, C("grass", 4))
        cv.ellipse(8.5, 9, 2, 1.6, C("grass", 4))
        cv.px(4, 4, C("grass", 5))
    cv.outline(C("ink", 0))
    return cv


def star_big(on=True):
    cv = Canvas(22, 22)
    pts = []
    for i in range(10):
        ang = -math.pi / 2 + i * math.pi / 5
        rr = 10.5 if i % 2 == 0 else 4.6
        pts.append((11 + math.cos(ang) * rr, 11.6 + math.sin(ang) * rr))
    cv.poly(pts, C("gold", 3) if on else C("stone", 2))
    inner = [(11 + (x - 11) * 0.7, 11.6 + (y - 11.6) * 0.7 - 0.6) for x, y in pts]
    cv.poly(inner, C("gold", 4) if on else C("stone", 3))
    if on:
        cv.line(7, 9, 9, 7, C("gold", 5))
        cv.px(10, 6, C("cream", 4))
    cv.outline(C("ink", 0))
    return cv


def bee(frame):
    cv = Canvas(11, 9)
    # wings
    wy = 1 if frame == 0 else 2
    cv.ellipse(4, wy, 2, 1.6, C("sky", 5))
    cv.ellipse(7, wy, 2, 1.6, C("sky", 4))
    # body
    cv.ellipse(5.5, 5.5, 4, 2.6, C("gold", 4))
    for x in (4, 7):
        cv.vline(x, 3, 7, C("ink", 1))
    cv.px(9, 5, C("ink", 1))
    cv.px(1, 5, C("ink", 2))
    cv.px(3, 4, C("gold", 5))
    cv.outline(C("ink", 0))
    return cv


def butterfly(frame, ramp):
    cv = Canvas(11, 9)
    if frame == 0:
        cv.ellipse(3, 3, 2.6, 2.6, C(ramp, 3))
        cv.ellipse(8, 3, 2.6, 2.6, C(ramp, 3))
        cv.ellipse(3.5, 6.5, 2, 1.6, C(ramp, 2))
        cv.ellipse(7.5, 6.5, 2, 1.6, C(ramp, 2))
        cv.px(2, 2, C(ramp, 5))
        cv.px(7, 2, C(ramp, 5))
    else:
        cv.ellipse(4, 3, 1.4, 2.6, C(ramp, 3))
        cv.ellipse(7, 3, 1.4, 2.6, C(ramp, 3))
        cv.ellipse(4.5, 6.5, 1, 1.4, C(ramp, 2))
        cv.ellipse(6.5, 6.5, 1, 1.4, C(ramp, 2))
    cv.vline(5, 2, 7, C("ink", 1))
    cv.px(4, 1, C("ink", 1))
    cv.px(6, 1, C("ink", 1))
    cv.outline(C("ink", 0))
    return cv


SKIN, SKIN_D = ("orange", 5), ("orange", 4)


def curls(cv, pts, lit=3, r=1.7):
    """Voluminous curly hair: overlapping ringlets, dark brown with caramel highlights."""
    for i, (x, y) in enumerate(pts):
        cv.disc(x, y, r, C("soil", 0))
    for i, (x, y) in enumerate(pts):
        cv.disc(x - 0.3, y - 0.3, r - 0.6, C("soil", 1))
        cv.px(x - 1, y - 1, C("soil", lit) if i % 2 == 0 else C("gold", 1))
        cv.px(x, y, C("soil", 2))
        if i % 3 == 1:
            cv.px(x + 1, y - 1, C("soil", 3))


def hiker(frame):
    """Our heroine on the trail: long curly hair in a high ponytail, backpack, walking stick. 18x22, facing right."""
    cv = Canvas(18, 22)
    step = [0, 1, 0, -1][frame % 4]
    bob = 1 if frame % 2 else 0
    oy = 1 - bob
    # back leg + front leg (leggings) with boots
    bl, fl = (-1 if step > 0 else (1 if step < 0 else 0)), step
    cv.rect(7 + bl, 15 + oy, 2, 5 - oy, C("ink", 1))
    cv.rect(9 + fl, 15 + oy, 2, 5 - oy, C("ink", 2))
    cv.px(10 + fl, 16 + oy, C("stone", 1))
    cv.rect(6 + bl, 20, 3, 2, C("wood", 1))
    cv.rect(9 + fl, 20, 3, 2, C("wood", 2))
    cv.px(11 + fl, 20, C("wood", 3))
    # backpack (behind, on her left since she faces right)
    cv.rect(3, 8 + oy, 5, 8, C("orange", 3))
    cv.rect(3, 8 + oy, 5, 2, C("orange", 4))
    cv.rect(3, 15 + oy, 5, 1, C("orange", 1))
    cv.rect(2, 11 + oy, 1, 3, C("orange", 2))
    cv.rect(3, 6 + oy, 4, 2, C("teal", 3))           # rolled mat on top
    cv.px(3, 6 + oy, C("teal", 4))
    # torso: black long-sleeve top with a little peplum flare
    cv.rect(8, 9 + oy, 4, 5, C("ink", 2))
    cv.vline(8, 9 + oy, 13 + oy, C("stone", 1))
    cv.hline(7, 12, 14 + oy, C("ink", 2))
    cv.px(7, 15 + oy, C("ink", 1))
    cv.px(12, 15 + oy, C("ink", 1))
    cv.hline(8, 11, 15 + oy, C("ink", 2))
    cv.px(9, 10 + oy, C("stone", 2))
    # arm forward holding the stick
    ax = 12 + (1 if step >= 0 else 0)
    cv.rect(11, 10 + oy, 2, 1, C("ink", 2))           # sleeve
    cv.rect(ax, 11 + oy, 1, 1, C("ink", 2))
    cv.px(ax, 12 + oy, C(*SKIN))
    cv.line(ax + 1, 9 + oy, ax + 2 + (1 if step > 0 else 0), 21, C("wood", 3))
    cv.px(ax + 1, 9 + oy, C("wood", 4))
    # neck + head (side view)
    cv.rect(10, 7 + oy, 2, 2, C(*SKIN_D))
    cv.rect(9, 2 + oy, 5, 5, C(*SKIN))
    cv.px(14, 4 + oy, C(*SKIN))                        # nose
    cv.px(12, 4 + oy, C("ink", 1))                     # eye
    cv.px(13, 6 + oy, C("red", 4))                     # smile
    cv.px(11, 5 + oy, C("pink", 4))                    # cheek
    # hair: curly top, flowing over the forehead
    curls(cv, [(9, 2 + oy), (11, 1 + oy), (13, 1.5 + oy), (8, 4 + oy), (14, 2.5 + oy), (8.5, 6 + oy)])
    cv.px(14, 3 + oy, C("soil", 2))
    cv.rect(10, 3 + oy, 4, 3, C(*SKIN))                # keep the face clear
    cv.px(12, 4 + oy, C("ink", 1))
    cv.px(14, 4 + oy, C(*SKIN))
    cv.px(13, 6 + oy, C("red", 4))
    cv.px(11, 5 + oy, C("pink", 4))
    # long curly ponytail, swinging with the step
    sw = [0, 1, 0, -1][frame % 4]
    tail = [(6, 2 + oy), (5 - sw * 0.3, 4 + oy), (4.5 - sw * 0.6, 6 + oy), (4 - sw, 8 + oy), (3.5 - sw, 10 + oy), (3 - sw * 1.2, 12 + oy), (3.5 - sw * 1.4, 14 + oy)]
    curls(cv, tail, lit=4, r=1.9)
    cv.px(7, 2 + oy, C("gold", 3))                     # hair tie
    cv.outline(C("ink", 0))
    return cv


def yogi(frame):
    """The heroine in tree pose, hands above her head; frame 1 breathes (chest up). 16x26, facing us."""
    cv = Canvas(16, 26)
    up = frame
    cv.a = cv.a  # noqa
    # standing leg + bent leg (foot on the knee)
    cv.rect(7, 16, 2, 8, C("ink", 2))
    cv.vline(7, 16, 23, C("stone", 1))
    cv.line(8, 16, 12, 19, C("ink", 2))
    cv.line(12, 19, 9, 20, C("ink", 1))
    cv.rect(6, 24, 4, 2, C(*SKIN_D))
    # torso
    cv.rect(6, 10 - up, 4, 6 + up, C("ink", 2))
    cv.vline(6, 10 - up, 15, C("stone", 1))
    cv.hline(5, 10, 15, C("ink", 2))
    # hair behind the head, ponytail falling to one side
    curls(cv, [(6, 5.5 - up), (8, 5 - up), (10, 5.5 - up), (5.5, 7 - up), (10.5, 7 - up)])
    curls(cv, [(11.5, 8 - up), (12, 10 - up), (12.5, 12 - up), (12, 14 - up)], lit=4)
    # face in front of the hair
    cv.rect(6, 7 - up, 4, 3, C(*SKIN))
    cv.px(6, 8 - up, C("ink", 1))
    cv.px(9, 8 - up, C("ink", 1))
    cv.px(7, 9 - up, C("red", 4))
    cv.px(8, 9 - up, C("red", 4))
    cv.hline(6, 9, 6 - up, C("soil", 2))               # fringe
    # arms up in a diamond, palms together above the head
    cv.line(6, 11 - up, 3, 7 - up, C(*SKIN))
    cv.line(9, 11 - up, 12, 7 - up, C(*SKIN))
    cv.line(3, 7 - up, 7, 1 - up, C(*SKIN))
    cv.line(12, 7 - up, 8, 1 - up, C(*SKIN))
    cv.px(7, 1 - up, C(*SKIN_D))
    cv.px(8, 1 - up, C(*SKIN_D))
    cv.px(6, 3 - up, C("pink", 4))                     # scrunchie peeking out
    import numpy as _np
    cv.a = _np.roll(cv.a, 1, axis=0)

    cv.outline(C("ink", 0))
    return cv


def signpost(state):
    """Trail marker. state: 'open', 'done', 'locked', 'current'."""
    cv = Canvas(20, 22)
    if state == "locked":
        # stone cairn
        for (cx, cy, rx, ry, sh) in [(10, 18, 7, 3, 2), (10, 13, 5.5, 2.6, 3), (10, 9, 4, 2.2, 3), (10, 5.5, 2.6, 1.8, 4)]:
            cv.ellipse(cx, cy, rx, ry, C("stone", sh))
            cv.ellipse(cx - 1, cy - 1, rx * 0.6, ry * 0.5, C("stone", sh + 1))
        cv.outline(C("ink", 0))
        return cv
    # post
    cv.rect(9, 7, 3, 14, C("wood", 3))
    cv.vline(9, 7, 20, C("wood", 4))
    cv.vline(11, 7, 20, C("wood", 2))
    # board
    board = {"open": "wood", "current": "gold", "done": "grass"}[state]
    lv = {"open": 4, "current": 4, "done": 4}[state]
    cv.rect(2, 2, 16, 9, C(board, lv))
    cv.hline(2, 17, 2, C(board, lv + 1))
    cv.hline(2, 17, 10, C(board, lv - 2))
    cv.poly([(18, 2), (20, 6.5), (18, 11)], C(board, lv - 1))
    for x in range(3, 17, 4):
        cv.px(x, 6, C(board, lv - 1))
    cv.px(4, 4, C("stone", 5))
    cv.px(15, 4, C("stone", 5))
    # grass at the foot
    for x in range(6, 15):
        cv.px(x, 21, C("grass", 3 + (x % 2)))
        if x % 2:
            cv.px(x, 20, C("grass", 4))
    cv.outline(C("ink", 0))
    return cv


def summit_flag():
    cv = Canvas(24, 30)
    cv.vline(5, 2, 27, C("wood", 2))
    cv.vline(6, 2, 27, C("wood", 4))
    # prayer-flag style banner in 70s colours
    cols = ["red", "gold", "teal", "pink", "blue"]
    for i in range(16):
        x = 7 + i
        y0 = 3 + int(math.sin(i / 3) * 1.5)
        col = cols[min(i // 4, 4)]
        for y in range(y0, y0 + 8 - i // 4):
            cv.px(x, y, C(col, 3 if y > y0 + 1 else 4))
    # rock pile
    for (cx, cy, rx, ry) in [(6, 27, 6, 2.6), (12, 28, 5, 2.2), (3, 28, 3, 1.8)]:
        cv.ellipse(cx, cy, rx, ry, C("stone", 3))
        cv.ellipse(cx - 1, cy - 1, rx * 0.5, ry * 0.5, C("stone", 4))
    cv.outline(C("ink", 0))
    return cv


def campfire(frame):
    cv = Canvas(18, 18)
    # logs
    cv.line(2, 15, 15, 12, C("wood", 2))
    cv.line(2, 16, 15, 13, C("wood", 3))
    cv.line(3, 12, 15, 16, C("wood", 1))
    cv.line(3, 13, 15, 17, C("wood", 3))
    # flames
    sway = 1 if frame else -1
    cv.poly([(4, 14), (9 + sway, 2), (14, 14)], C("orange", 3))
    cv.poly([(6, 14), (9 - sway, 5), (12, 14)], C("gold", 4))
    cv.poly([(7.5, 14), (9, 9 + frame), (10.5, 14)], C("cream", 4))
    cv.px(5 + frame * 7, 3 + frame, C("gold", 5))
    cv.outline(C("ink", 0))
    return cv


def camp_scene():
    """Summit reward scene: tent, van, hammock, mugs, string lights, at golden hour. 220x120."""
    W_, H_ = 220, 120
    cv = Canvas(W_, H_)
    # ground
    ramp_gradient(cv, 0, 70, W_, 50, [C("grass", 4), C("grass", 3), C("grass", 2)])
    for x in range(W_):
        top = 70 + int(math.sin(x / 23) * 2 + math.sin(x / 7) * 0.8)
        for y in range(top, 72):
            cv.px(x, y, C("grass", 5))
    rnd = random.Random(3)
    for _ in range(140):
        x, y = rnd.randint(0, W_ - 1), rnd.randint(74, H_ - 1)
        cv.px(x, y, C(rnd.choice(["grass", "grass", "cream", "gold"]), 5 if rnd.random() < 0.8 else 4))
    # two trees with hammock
    for tx in (14, 62):
        cv.rect(tx - 2, 18, 5, 56, C("wood", 2))
        cv.vline(tx - 2, 18, 73, C("wood", 3))
        cv.vline(tx + 2, 18, 73, C("wood", 1))
        for k in range(5):
            cv.ellipse(tx + rnd.randint(-6, 6), 14 + k * 4, 12 - k, 7, C("grass", 2 + (k % 2)))
        cv.ellipse(tx - 4, 10, 8, 5, C("grass", 4))
    for x in range(16, 61):
        t = (x - 16) / 44
        y = 44 + math.sin(t * math.pi) * 12
        for k in range(3):
            cv.px(x, y + k, C("orange", 4 - k) if (x // 3) % 2 else C("pink", 4 - k))
    cv.line(13, 40, 16, 44, C("cream", 2))
    cv.line(63, 40, 60, 44, C("cream", 2))
    # tent
    cv.poly([(88, 74), (110, 36), (132, 74)], C("orange", 3))
    cv.poly([(110, 36), (132, 74), (122, 74)], C("orange", 2))
    cv.poly([(100, 74), (110, 54), (117, 74)], C("ink", 1))
    cv.poly([(104, 74), (110, 60), (113, 74)], C("gold", 4))   # lantern glow inside
    cv.line(110, 36, 110, 30, C("wood", 2))
    cv.line(88, 74, 82, 76, C("cream", 2))
    cv.line(132, 74, 138, 76, C("cream", 2))
    # string lights from tree to tent
    for x in range(62, 110):
        t = (x - 62) / 48
        y = 26 + t * 8 + math.sin(t * math.pi) * 6
        cv.px(x, y, C("ink", 2))
        if x % 6 == 0:
            cv.px(x, y + 1, C(["gold", "pink", "teal"][(x // 6) % 3], 5))
    # van
    vx, vy = 146, 44
    cv.rect(vx, vy + 4, 66, 22, C("teal", 3))
    cv.rect(vx + 4, vy, 50, 6, C("teal", 4))
    cv.rect(vx, vy + 14, 66, 6, C("cream", 4))
    cv.rect(vx + 58, vy + 4, 8, 10, C("sky", 4))
    cv.rect(vx + 8, vy + 6, 12, 7, C("sky", 4))
    cv.rect(vx + 24, vy + 6, 12, 7, C("sky", 4))
    cv.rect(vx + 40, vy + 6, 12, 7, C("sky", 4))
    for (x0, c) in ((vx + 10, "pink"), (vx + 30, "gold"), (vx + 48, "orange")):
        for a in range(5):
            ang = a / 5 * math.tau
            cv.disc(x0 + math.cos(ang) * 2, vy + 17 + math.sin(ang) * 2, 1.4, C(c, 4))
        cv.px(x0, vy + 17, C("gold", 5))
    cv.rect(vx, vy + 24, 66, 2, C("teal", 1))
    for wx in (vx + 12, vx + 52):
        cv.disc(wx, vy + 26, 5, C("ink", 1))
        cv.disc(wx, vy + 26, 2.4, C("stone", 4))
    cv.rect(vx + 2, vy - 3, 46, 3, C("wood", 3))   # roof rack with surfboard
    cv.rect(vx + 4, vy - 5, 40, 2, C("gold", 4))
    # campfire spot (animated fire is drawn by the game) and mugs
    for i in range(7):
        ang = i / 7 * math.tau
        cv.ellipse(124 + math.cos(ang) * 9, 96 + math.sin(ang) * 3.5, 2.2, 1.6, C("stone", 3))
    for (mx, c) in ((96, "red"), (148, "blue")):
        cv.rect(mx, 92, 5, 6, C(c, 3))
        cv.vline(mx, 92, 97, C(c, 4))
        cv.px(mx + 5, 94, C(c, 2))
        cv.px(mx + 5, 95, C(c, 2))
        cv.px(mx + 1, 90, C("cream", 3))
        cv.px(mx + 2, 89, C("cream", 2))
    # yoga mat
    cv.rect(60, 100, 26, 6, C("lav", 3))
    cv.hline(60, 85, 100, C("lav", 4))
    cv.ellipse(86, 103, 3, 3, C("lav", 2))
    cv.outline(C("ink", 0))
    return cv  # the heroine (yogi) is drawn on the mat by the game, so she can breathe


def app_icon(size=512):
    """App icon: big lush cosmos + lavender on a soil block, sunset mountain behind."""
    base = 32
    cv = Canvas(base, base)
    ramp_gradient(cv, 0, 0, base, base, [C("dusk", 3), C("dusk", 4), C("gold", 4)])
    cv.poly([(-2, 22), (9, 9), (17, 18), (24, 11), (34, 22), (34, 34), (-2, 34)], C("lav", 2))
    cv.poly([(9, 9), (5, 14), (9, 13), (12, 13)], C("snow", 3))
    cv.poly([(24, 11), (21, 15), (25, 14), (27, 14)], C("snow", 3))
    cv.rect(0, 24, base, 8, C("grass", 3))
    t = plant_tile("cosmos", 2, T)
    cv.blit(t, 4, 6)
    big = Image.fromarray(cv.a, "RGBA").resize((size, size), Image.NEAREST)
    return big


def build_ui():
    from PIL import Image as _I  # noqa
    write("panel", panel_9slice())
    for name, ramp, base in (("btn_green", "grass", 4), ("btn_wood", "wood", 4), ("btn_pink", "pink", 3), ("btn_gold", "gold", 3), ("btn_stone", "stone", 3)):
        write(name, button_9slice(ramp, base))
    names = ["pause", "play", "sound", "mute", "music", "gear", "home", "retry", "map", "close", "breath", "compost",
             "rain", "lock", "star", "star_off", "leaf", "check", "flower", "moves", "lang"]
    ics = []
    for n in names:
        c = icon(n)
        write("i_" + n, c)
        ics.append(c)
    write("star_big", star_big(True))
    write("star_big_off", star_big(False))
    for f in (0, 1):
        write(f"bee_{f}", bee(f))
        write(f"campfire_{f}", campfire(f))
        for r in ("orange", "blue", "pink"):
            write(f"fly_{r}_{f}", butterfly(f, r))
    for f in (0, 1):
        write(f"yogi_{f}", yogi(f))
    hk = []
    for f in range(4):
        h = hiker(f)
        write(f"hiker_{f}", h)
        hk.append(h)
    sp = []
    for st in ("open", "current", "done", "locked"):
        c = signpost(st)
        write("sign_" + st, c)
        sp.append(c)
    write("flag", summit_flag())
    cs = camp_scene()
    write("camp", cs)
    preview("hero", [hiker(f) for f in range(4)] + [yogi(0), yogi(1)], scale=10)
    preview("ui", ics + [star_big(), star_big(False), bee(0), bee(1), butterfly(0, "orange"), butterfly(1, "blue")] + hk + sp + [summit_flag(), campfire(0), panel_9slice(), button_9slice("grass", 4), button_9slice("wood", 4)], cols=12)
    preview("camp", [cs], scale=4)
    from PIL import Image as Im
    ic = app_icon(512)
    os.makedirs(os.path.join(ROOT, "icons"), exist_ok=True)
    os.makedirs(os.path.join(ROOT, "resources"), exist_ok=True)
    ic.save(os.path.join(ROOT, "icons", "icon-512.png"))
    ic.resize((192, 192), Im.NEAREST).save(os.path.join(ROOT, "icons", "icon-192.png"))
    ic.resize((180, 180), Im.NEAREST).save(os.path.join(ROOT, "icons", "apple-touch-icon.png"))
    m = Im.new("RGBA", (512, 512), hexrgb(RAMPS["dusk"][3]) + (255,))
    m.paste(ic.resize((384, 384), Im.NEAREST), (64, 64))
    m.save(os.path.join(ROOT, "icons", "icon-maskable-512.png"))
    ic.resize((1024, 1024), Im.NEAREST).save(os.path.join(ROOT, "resources", "icon-only.png"))
    ic.resize((1024, 1024), Im.NEAREST).save(os.path.join(ROOT, "resources", "icon-foreground.png"))
    Im.new("RGBA", (1024, 1024), hexrgb(RAMPS["dusk"][3]) + (255,)).save(os.path.join(ROOT, "resources", "icon-background.png"))
    sp_ = Im.new("RGBA", (2732, 2732), hexrgb(RAMPS["ink"][1]) + (255,))
    sp_.paste(ic.resize((640, 640), Im.NEAREST), (1046, 1046))
    sp_.save(os.path.join(ROOT, "resources", "splash.png"))
    sp_.save(os.path.join(ROOT, "resources", "splash-dark.png"))


if __name__ == "__main__":
    what = sys.argv[1:] or ["tiles", "ui", "bg"]
    if "tiles" in what:
        build_tiles()
    if "ui" in what:
        build_ui()
    if "bg" in what:
        build_backgrounds()
    print("ok")
