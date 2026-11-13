"""Tiny pixel-art toolkit used by make_art.py.

Everything is drawn on an RGBA numpy canvas, one array cell = one pixel.
Colours come from a fixed palette of ramps (dark -> light), so shading
always steps along a ramp and never invents new colours.
"""
import math
import random

import numpy as np
from PIL import Image

# ---------------------------------------------------------------- palette
# Each ramp goes from darkest to lightest. Warm 70s nature palette.
RAMPS = {
    "ink":   ["#1f1622", "#2e2030", "#43303f"],
    "soil":  ["#3b2420", "#56342a", "#744734", "#935f40", "#b47c52", "#cf9d6c"],
    "grass": ["#1d3326", "#264a30", "#33653a", "#4a8442", "#6aa64a", "#93c45a", "#c2e07a"],
    "moss":  ["#2a3a24", "#3d5430", "#577240", "#76924f", "#9cb565"],
    "wood":  ["#2f1c16", "#4a2b1e", "#673d27", "#875432", "#a86e40", "#c79157", "#e2b77c"],
    "stone": ["#2c2d3a", "#43465a", "#5f6377", "#808597", "#a5aab7", "#cdd1d8", "#eef0f2"],
    "lav":   ["#2e1f4a", "#47306e", "#644a99", "#8a6fc4", "#b39ce3", "#d8cbf5"],
    "red":   ["#47141f", "#74202c", "#a5303a", "#d24b44", "#ef7c5f", "#f8b08e"],
    "gold":  ["#5c3510", "#8c5616", "#bd7e1e", "#e2a92f", "#f5d14f", "#fbec9c"],
    "cream": ["#9c8a76", "#c2b199", "#e2d5bd", "#f4ecd9", "#fffaf0"],
    "blue":  ["#1b2a4e", "#253f74", "#365fa3", "#4f86c9", "#7db2e6", "#bde0f8"],
    "pink":  ["#4f1a3a", "#7c2b58", "#ad4378", "#d86b9a", "#f19cbd", "#fbd2e1"],
    "orange": ["#5a240f", "#8a3a15", "#bf5a1d", "#e5812e", "#f6ab55", "#fdd59b"],
    "teal":  ["#13363a", "#1e5452", "#2c7a6c", "#47a289", "#78c9a8", "#b5ead0"],
    "sky":   ["#2a3463", "#3d5a96", "#5d86c2", "#8db6df", "#c3dcef", "#ebf4f8"],
    "dusk":  ["#3a2350", "#6b3463", "#a64a6b", "#dc7568", "#f2a46a", "#f9d08a"],
    "snow":  ["#7d8aa8", "#a6b3cc", "#ccd6e6", "#eef3fa", "#ffffff"],
}


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def C(ramp, i):
    """Colour i of a ramp as an RGBA tuple (i is clamped)."""
    r = RAMPS[ramp]
    i = max(0, min(len(r) - 1, i))
    return hexrgb(r[i]) + (255,)


# map every palette colour to the one step darker on its ramp (for selective outlines)
DARKER = {}
for _name, _ramp in RAMPS.items():
    for _i, _h in enumerate(_ramp):
        DARKER[hexrgb(_h)] = hexrgb(_ramp[max(0, _i - 1)])
INK = hexrgb(RAMPS["ink"][0])


class Canvas:
    def __init__(self, w, h, bg=None):
        self.w, self.h = w, h
        self.a = np.zeros((h, w, 4), dtype=np.uint8)
        if bg:
            self.a[:, :] = bg

    # ---- primitives
    def px(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h and c is not None:
            self.a[y, x] = c

    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h:
            return tuple(self.a[y, x])
        return (0, 0, 0, 0)

    def filled(self, x, y):
        return 0 <= x < self.w and 0 <= y < self.h and self.a[y, x, 3] > 0

    def rect(self, x, y, w, h, c):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                self.px(xx, yy, c)

    def hline(self, x0, x1, y, c):
        for x in range(int(x0), int(x1) + 1):
            self.px(x, y, c)

    def vline(self, x, y0, y1, c):
        for y in range(int(y0), int(y1) + 1):
            self.px(x, y, c)

    def line(self, x0, y0, x1, y1, c):
        x0, y0, x1, y1 = int(round(x0)), int(round(y0)), int(round(x1)), int(round(y1))
        dx, dy = abs(x1 - x0), -abs(y1 - y0)
        sx, sy = (1 if x0 < x1 else -1), (1 if y0 < y1 else -1)
        err = dx + dy
        while True:
            self.px(x0, y0, c)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy
                x0 += sx
            if e2 <= dx:
                err += dx
                y0 += sy

    def ellipse(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry - 1), int(cy + ry + 2)):
            for x in range(int(cx - rx - 1), int(cx + rx + 2)):
                if ((x + 0.5 - cx) / max(rx, 0.01)) ** 2 + ((y + 0.5 - cy) / max(ry, 0.01)) ** 2 <= 1.0:
                    self.px(x, y, c)

    def disc(self, cx, cy, r, c):
        self.ellipse(cx, cy, r, r, c)

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            yc = y + 0.5
            xs = []
            n = len(pts)
            for i in range(n):
                x0, y0 = pts[i]
                x1, y1 = pts[(i + 1) % n]
                if (y0 <= yc < y1) or (y1 <= yc < y0):
                    xs.append(x0 + (yc - y0) * (x1 - x0) / (y1 - y0))
            xs.sort()
            for i in range(0, len(xs) - 1, 2):
                for x in range(int(math.ceil(xs[i] - 0.5)), int(math.floor(xs[i + 1] - 0.5)) + 1):
                    self.px(x, y, c)

    def blit(self, other, x, y):
        for yy in range(other.h):
            for xx in range(other.w):
                p = other.a[yy, xx]
                if p[3] > 0:
                    self.px(x + xx, y + yy, tuple(p))

    # ---- effects
    def outline(self, color=None, selective=True, diagonal=False):
        """Add a 1px outline around filled pixels. Selective: darker shade of the neighbour."""
        src = self.a.copy()
        h, w = self.h, self.w
        nb = [(-1, 0), (1, 0), (0, -1), (0, 1)]
        if diagonal:
            nb += [(-1, -1), (1, -1), (-1, 1), (1, 1)]
        for y in range(h):
            for x in range(w):
                if src[y, x, 3]:
                    continue
                for dx, dy in nb:
                    xx, yy = x + dx, y + dy
                    if 0 <= xx < w and 0 <= yy < h and src[yy, xx, 3]:
                        if color is not None:
                            self.a[y, x] = color
                        elif selective:
                            d = tuple(src[yy, xx, :3])
                            d = DARKER.get(DARKER.get(d, d), d)
                            # selective outline: dark ramp end, but never lighter than ink-ish
                            self.a[y, x] = darkest_of(d) + (255,)
                        break

    def save(self, path, scale=1):
        im = Image.fromarray(self.a, "RGBA")
        if scale != 1:
            im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        im.save(path)

    def image(self):
        return Image.fromarray(self.a, "RGBA")


def darkest_of(rgb):
    for ramp in RAMPS.values():
        hs = [hexrgb(h) for h in ramp]
        if rgb in hs:
            return hs[0] if ramp is not RAMPS["ink"] else hs[0]
    return INK


# ordered dithering (Bayer 4x4) for smooth pixel gradients
BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]


def dither_pick(x, y, t):
    """t in [0,1): True if the lighter colour should be used at (x,y)."""
    return t * 16 > BAYER[y % 4][x % 4] + 0.5


def ramp_gradient(cv, x, y, w, h, colors, vertical=True):
    """Fill a rect with a dithered gradient through the given colours (list of RGBA)."""
    n = len(colors) - 1
    for yy in range(h):
        for xx in range(w):
            t = (yy / max(h - 1, 1)) if vertical else (xx / max(w - 1, 1))
            f = t * n
            i = min(int(f), n - 1)
            frac = f - i
            c = colors[i + 1] if dither_pick(x + xx, y + yy, frac) else colors[i]
            cv.px(x + xx, y + yy, c)


class Rng(random.Random):
    pass


def value_noise_1d(seed, n, octaves=4, base=32):
    r = random.Random(seed)
    out = np.zeros(n)
    amp, freq, tot = 1.0, base, 0
    for _ in range(octaves):
        pts = [r.random() for _ in range(n // int(freq) + 3)]
        for i in range(n):
            f = i / freq
            k = int(f)
            t = f - k
            t = t * t * (3 - 2 * t)
            out[i] += amp * (pts[k] * (1 - t) + pts[k + 1] * t)
        tot += amp
        amp *= 0.5
        freq = max(2, freq / 2)
    return out / tot
