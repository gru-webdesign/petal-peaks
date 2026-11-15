"""Turns the supplied illustrations in art/src/ into game assets.

  bg_*.jpg         -> assets/bg_<area>.png   504 px wide (2x), with the dark foreground extended downward
  hero_sheet.jpg   -> assets/hero_front.png, hero_walk_0..3.png, hero_yoga.png (grey background removed)
  camp_sprites.jpg -> assets/camp_<object>.png (magenta background removed)
"""
import os

import numpy as np
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "src")
OUT = os.path.join(ROOT, "assets")
AREAS = ["meadow", "lavender", "alpine", "forest", "canyon", "terraces"]
BG_W, BG_EXT = 504, 200          # asset width and how many rows of foreground are added below


def backgrounds():
    for key in AREAS:
        im = Image.open(os.path.join(SRC, f"bg_{key}.jpg")).convert("RGB")
        h = round(im.height * BG_W / im.width)
        im = im.resize((BG_W, h), Image.BOX)
        a = np.asarray(im).astype(float)
        # continue the dark foreground: repeat the last rows, fading toward their darkest tone
        tail = a[-6:].mean(axis=0)
        dark = np.percentile(a[-40:].reshape(-1, 3), 10, axis=0)
        ext = np.zeros((BG_EXT, BG_W, 3))
        for i in range(BG_EXT):
            t = min(1.0, i / 60)
            ext[i] = tail * (1 - t) + dark * t
        full = Image.fromarray(np.concatenate([a, ext]).astype(np.uint8))
        full = full.quantize(colors=64, method=Image.MEDIANCUT, dither=Image.NONE)
        full.save(os.path.join(OUT, f"bg_{key}.png"), optimize=True)


def keyed(im, key_fn, erode=1, strict=None):
    """RGBA copy of im with the background (reachable from the border) made transparent."""
    a = np.asarray(im.convert("RGB")).astype(int)
    bgm = key_fn(a)
    mask = Image.fromarray((bgm * 255).astype(np.uint8))
    # flood from the border so background-coloured pixels inside the subject survive
    seed = mask.copy()
    w, h = seed.size
    px = seed.load()
    for x in range(0, w, 7):
        for y in (0, h - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(seed, (x, y), 128)
    for y in range(0, h, 7):
        for x in (0, w - 1):
            if px[x, y] == 255:
                ImageDraw.floodfill(seed, (x, y), 128)
    out = np.asarray(seed) == 128
    if strict is not None:
        out |= strict(a)                         # enclosed background (between limbs, inside loops)
    for _ in range(erode):                       # eat the anti-aliased fringe
        g = out.copy()
        g[1:] |= out[:-1]; g[:-1] |= out[1:]; g[:, 1:] |= out[:, :-1]; g[:, :-1] |= out[:, 1:]
        out = g
    rgba = np.dstack([a.astype(np.uint8), np.where(out, 0, 255).astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def shrink(im, height=None, scale=None):
    box = im.getbbox()
    im = im.crop(box)
    if height:
        scale = height / im.height
    size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
    out = im.convert("RGBa").resize(size, Image.BOX).convert("RGBA")
    a = np.asarray(out).copy()
    a[..., 3] = np.where(a[..., 3] > 110, 255, 0)
    return Image.fromarray(a, "RGBA")


def hero():
    im = Image.open(os.path.join(SRC, "hero_sheet.jpg"))
    k = keyed(im, lambda a: (np.abs(a - np.array([203, 203, 205])).sum(-1) < 40), erode=2,
              strict=lambda a: np.abs(a - np.array([203, 203, 205])).sum(-1) < 22)
    a = np.asarray(k).copy()
    front = Image.fromarray(a[:, 120:700])
    side = a[:, 880:1560].copy()
    yoga = a[:, 1860:2480].copy()
    yoga[1080:, 2170 - 1860:, 3] = 0             # the backpack on the ground is not part of the pose
    shrink(front, 220).save(os.path.join(OUT, "hero_front.png"))
    shrink(Image.fromarray(yoga), 220).save(os.path.join(OUT, "hero_yoga.png"))
    # walk cycle from the single side view: the legs close and open below the hip line
    ys, xs = np.nonzero(side[..., 3])
    top, bot = ys.min(), ys.max()
    cut = 880
    hipx = int(xs[(ys > cut) & (ys < cut + 30)].mean())
    frames = []
    for squeeze, lift in ((1.0, 0), (0.55, 10), (1.0, 0), (0.75, 6)):
        f = np.zeros_like(side)
        f[:cut - lift] = side[lift:cut]
        for y in range(cut, bot + 1):
            t = (y - cut) / (bot - cut)
            s = 1 - (1 - squeeze) * t
            row = side[y]
            xsrc = np.clip(((np.arange(side.shape[1]) - hipx) / s + hipx).round().astype(int), 0, side.shape[1] - 1)
            inside = np.abs((np.arange(side.shape[1]) - hipx) / s + hipx - xsrc) < 1
            f[y - lift if y - lift >= cut - lift else y] = np.where(inside[:, None], row[xsrc], 0)
        frames.append(Image.fromarray(f))
    box = Image.fromarray(side).getbbox()
    box = (box[0] - 4, box[1] - 12, box[2] + 4, box[3])
    sc = 220 / (box[3] - box[1])
    for i, f in enumerate(frames):
        f = f.crop(box)
        out = f.convert("RGBa").resize((round(f.width * sc), 220), Image.BOX).convert("RGBA")
        b = np.asarray(out).copy()
        b[..., 3] = np.where(b[..., 3] > 110, 255, 0)
        Image.fromarray(b, "RGBA").save(os.path.join(OUT, f"hero_walk_{i}.png"))


CAMP = {
    "tent": (60, 90, 820, 680), "van": (900, 80, 1620, 680), "hammock": (1780, 90, 2460, 690),
    "fire": (180, 890, 600, 1250), "lights": (690, 730, 1270, 1030), "mat": (740, 1090, 1360, 1360),
    "mugs": (1530, 1100, 1920, 1300), "sign": (2060, 750, 2450, 1350),
}


def camp():
    im = Image.open(os.path.join(SRC, "camp_sprites.jpg"))
    mag = lambda a: (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 130)
    k = keyed(im, mag, erode=2, strict=mag)
    for name, box in CAMP.items():
        shrink(k.crop(box), scale=0.2).save(os.path.join(OUT, f"camp_{name}.png"))


TILE = 64                      # tile canvas (2x): the grass patch is 54 wide, flowers may rise above it
FLOWERS = ["marigold", "cosmos", "edelweiss", "cornflower", "sunflower", "poppy", "daisy"]
MAG = lambda a: (a[..., 0] > 170) & (a[..., 2] > 170) & (a[..., 1] < 130)


def seat(sprite, scale):
    """Scale a cut-out and stand it bottom-centre on a TILE x TILE canvas."""
    sp = shrink(sprite, scale=scale)
    out = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
    out.alpha_composite(sp, ((TILE - sp.width) // 2, TILE - sp.height - 1))
    return out


def save_tile(im, name):
    im.save(os.path.join(OUT, name + ".png"))


def tiles():
    for name in FLOWERS:
        im = Image.open(os.path.join(SRC, f"tile_{name}.jpg"))
        k = keyed(im, MAG, erode=2, strict=MAG)
        for st, (x0, x1) in enumerate(((0, 880), (880, 1700), (1700, 2576))):
            t = seat(k.crop((x0, 0, x1, k.height)), 54 / 755)
            save_tile(t, f"p_{name}_{st}")
            if st == 1:
                save_tile(t.resize((34, 34), Image.BOX), f"m_{name}_1")
    lavender()
    k = keyed(Image.open(os.path.join(SRC, "obstacles.jpg")), MAG, erode=2, strict=MAG)
    for name, (x0, x1), sc in (("stone", (60, 580), 0.106), ("stone_cracked", (590, 1120), 0.106), ("weed_0", (1130, 1600), 0.1),
                               ("plastic", (1590, 2120), 0.1), ("mushroom", (2140, 2520), 0.13)):
        save_tile(seat(k.crop((x0, 0, x1, k.height)), sc), name)
    w = Image.open(os.path.join(OUT, "weed_0.png"))
    save_tile(w.transpose(Image.FLIP_LEFT_RIGHT), "weed_1")


def lavender():
    """Stand-in until a lavender sheet exists: lavender spikes drawn on the supplied grass patch."""
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    from pix import Canvas
    import sprites2 as S
    for st in range(3):
        base = np.asarray(Image.open(os.path.join(OUT, f"p_marigold_{min(st, 1)}.png"))).copy()
        r, g, b = base[..., 0].astype(int), base[..., 1].astype(int), base[..., 2].astype(int)
        base[(r > 150) & (g < 150) & (r - b > 60), 3] = 0          # drop the orange buds and blooms
        img = Image.fromarray(base)
        cv = Canvas(TILE, TILE)
        spikes = [[(0, 12), (-6, 9), (6, 9)], [(0, 24), (-8, 19), (8, 20), (-3, 16)], [(0, 27), (-9, 22), (9, 23), (-15, 16), (15, 17), (-4, 19), (5, 18)]][st]
        for ox, h in sorted(spikes, key=lambda q: q[1]):
            S.spike(cv, 32 + ox, 40, h, ox * 0.25)
        cv.outline()
        img.alpha_composite(cv.image())
        save_tile(img, f"p_lavender_{st}")
        if st == 1:
            save_tile(img.resize((34, 34), Image.BOX), "m_lavender_1")


if __name__ == "__main__":
    tiles()
    backgrounds()
    hero()
    camp()
    print("imported")
