"""Petal Peaks: all game art, drawn in code as pixel art.

Run:  python3 tools/make_art.py      ->  assets/*.png  (+ art/preview/*.png at 6x)
"""
import math
import os
import random
import sys
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
import numpy as np
import scene
import sprites2 as S2
from sprites2 import hiker, yogi
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
    """App icon: a lush cosmos tile in front of the meadow mountains."""
    bg = Image.fromarray(scene.render("meadow", 300)).crop((58, 168, 122, 232)).convert("RGBA")
    t = S2.plant_tile("cosmos", 2).image()
    bg.alpha_composite(t, (5, 8))
    return bg.resize((size, size), Image.NEAREST)


def build_tiles():
    sheet = []
    for name, *_ in SPECIES:
        for st in range(3):
            t = S2.plant_tile(name, st)
            write(f"p_{name}_{st}", t)
            sheet.append(t)
        write(f"m_{name}_1", S2.mini_tile(name))
    obs = {"stone": S2.stone_tile(), "stone_cracked": S2.stone_tile(True), "weed_0": S2.weed_tile(0), "weed_1": S2.weed_tile(1),
           "plastic": S2.plastic_tile(), "mushroom": S2.mushroom_tile()}
    for n, c in obs.items():
        write(n, c)
    preview("tiles", sheet + list(obs.values()), cols=9, scale=3, bg=(90, 140, 70, 255))


def build_backgrounds():
    for i, key in enumerate(scene.BIOMES):
        Image.fromarray(scene.render(key, 300 + i * 11)).save(os.path.join(OUT, f"bg_{key}.png"))


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
