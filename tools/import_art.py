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
    GREY = np.array([203, 203, 205])
    key = lambda path: np.asarray(keyed(Image.open(os.path.join(SRC, path)), lambda a: np.abs(a - GREY).sum(-1) < 40, erode=2,
                                        strict=lambda a: np.abs(a - GREY).sum(-1) < 22)).copy()
    # walk cycle: six frames drawn close together, so each is cut along a boundary that shifts with height
    w = key("hero_walk.jpg")
    #         y < 700, 700..1150, y > 1150
    bounds = [(0, 0, 0), (522, 622, 622), (932, 948, 912), (1338, 1398, 1445), (1692, 1740, 1725), (2012, 2035, 1965), (2576, 2576, 2576)]
    Y = np.arange(w.shape[0])[:, None]
    X = np.arange(w.shape[1])[None, :]
    def edge(b):
        return np.where(Y < 700, b[0], np.where(Y < 1150, b[1], b[2]))
    frames = []
    for i in range(6):
        f = w.copy()
        f[..., 3] = np.where((X >= edge(bounds[i])) & (X < edge(bounds[i + 1])), f[..., 3], 0)
        from scipy import ndimage
        lab, n = ndimage.label(f[..., 3] > 0)
        if n > 1:                                   # keep the figure, drop slivers of its neighbours
            big = 1 + np.argmax(ndimage.sum(f[..., 3] > 0, lab, range(1, n + 1)))
            f[..., 3] = np.where(lab == big, f[..., 3], 0)
        ys, xs = np.nonzero(f[..., 3])
        body = xs[(ys > 450) & (ys < 700)]
        frames.append((f, int(body.mean()), ys.min(), ys.max()))
    top = min(fr[2] for fr in frames) - 6
    bot = max(fr[3] for fr in frames) + 2
    half = 330
    sc = 220 / (bot - top)
    frames = [frames[k] for k in (0, 1, 2, 1)]       # stride, passing, opposite stride, passing (frames 3 and 4 overlap too much to cut cleanly)
    for i, (f, cx, _, _) in enumerate(frames):
        x0 = cx - half
        crop = Image.fromarray(f).crop((x0, top, x0 + 2 * half, bot))
        out = crop.convert("RGBa").resize((round(2 * half * sc), 220), Image.BOX).convert("RGBA")
        bb = np.asarray(out).copy()
        bb[..., 3] = np.where(bb[..., 3] > 110, 255, 0)
        Image.fromarray(bb, "RGBA").save(os.path.join(OUT, f"hero_walk_{i}.png"))
    # seated meditation: relaxed and chest lifted (breathing)
    m = key("hero_meditate.jpg")
    for i, (x0, x1) in enumerate(((80, 668), (1830, 2480))):
        shrink(Image.fromarray(m[:, x0:x1]), 200).save(os.path.join(OUT, f"hero_breathe_{i}.png"))
    # reactions: jump for a win, sitting down tired for a loss
    r = key("hero_reactions.jpg")
    shrink(Image.fromarray(r[:, 280:1090]), 230).save(os.path.join(OUT, "hero_jump.png"))
    tired = r[:, 1360:2440].copy()
    tired[1085:, 2188 - 1360:, 3] = 0                # backpack on the ground
    tired[:1085, 2240 - 1360:, 3] = 0
    shrink(Image.fromarray(tired), 170).save(os.path.join(OUT, "hero_tired.png"))


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
FLOWERS = ["lavender", "marigold", "cosmos", "edelweiss", "cornflower", "sunflower", "poppy", "daisy"]
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
    k = keyed(Image.open(os.path.join(SRC, "obstacles.jpg")), MAG, erode=2, strict=MAG)
    for name, (x0, x1), sc in (("stone", (60, 580), 0.106), ("stone_cracked", (590, 1120), 0.106), ("weed_0", (1130, 1600), 0.1),
                               ("plastic", (1590, 2120), 0.1), ("mushroom", (2140, 2520), 0.13)):
        save_tile(seat(k.crop((x0, 0, x1, k.height)), sc), name)
    w = Image.open(os.path.join(OUT, "weed_0.png"))
    save_tile(w.transpose(Image.FLIP_LEFT_RIGHT), "weed_1")


UI_SCALE = 1 / 8.8               # one art pixel of the sheets becomes one logical pixel in the game
UI_BUTTONS = {
    "btn_gold": (50, 45, 535, 240), "btn_gold_down": (65, 285, 520, 465), "btn_stone": (60, 525, 520, 710),
    "btn_green": (600, 45, 985, 220), "btn_red": (600, 270, 985, 415), "btn_pink": (1020, 45, 1360, 220),
    "btn_wood": (610, 445, 890, 715), "btn_round": (1045, 450, 1315, 715),
}
UI_PANELS = {
    "panel": (45, 40, 620, 480), "ui_sign": (705, 45, 1320, 365), "ui_sign_small": (70, 475, 580, 720),
    "ui_bar_empty": (660, 410, 1360, 545), "ui_bar_full": (660, 575, 1175, 720), "ui_close": (1200, 565, 1365, 720),
}


def crisp(im):
    """Downscaled cut-out snapped to a small palette, so it reads as clean pixel art."""
    a = np.asarray(im).copy()
    opaque = a[..., 3] > 0
    rgb = Image.fromarray(a[..., :3]).quantize(colors=24, method=Image.MEDIANCUT, dither=Image.NONE).convert("RGB")
    out = np.dstack([np.asarray(rgb), np.where(opaque, 255, 0).astype(np.uint8)])
    return Image.fromarray(out, "RGBA")


def ui():
    for sheet, boxes in (("ui_buttons.jpg", UI_BUTTONS), ("ui_panels.jpg", UI_PANELS)):
        k = keyed(Image.open(os.path.join(SRC, sheet)), MAG, erode=1, strict=MAG)
        for name, box in boxes.items():
            crisp(shrink(k.crop(box), scale=UI_SCALE)).save(os.path.join(OUT, name + ".png"))


if __name__ == "__main__":
    ui()
    tiles()
    backgrounds()
    hero()
    camp()
    print("imported")
