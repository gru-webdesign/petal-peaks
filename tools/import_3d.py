"""Import the soft 3D art sheets into assets/ (heroine, plants, obstacles, flag, textures, trail scenes)."""
import os, sys
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(__file__))
from cut3d import key, parts, crop, fit

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "art", "src")
OUT = os.path.join(ROOT, "assets", "3d")
HERO = 560            # standing heroine height in pixels
SPECIES = [("flowers_poppy_sunflower", "poppy", "sunflower"), ("flowers_lavender_daisy", "lavender", "daisy"),
           ("flowers_cornflower_edelweiss", "cornflower", "edelweiss"), ("flowers_cosmos_marigold", "cosmos", "marigold")]
MOUNTAINS = ["trail1", "trail2", "trail3", "trail4", "trail5", "trail6"]


def save(im, name):
    im.save(os.path.join(OUT, name + ".png"), optimize=True)


def brownify(im):
    """Red/burgundy hair and boots of the alternative sheets pulled to the chocolate brown of the main sheet."""
    a = np.asarray(im).astype(float)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > g * 1.45) & (r > b * 1.25) & (a[..., 3] > 0)
    skin = (r > 170) & (g > 110)                     # keep the face and hands
    m = red & ~skin
    lum = (0.5 * r + 0.35 * g + 0.15 * b)
    a[..., 0] = np.where(m, lum * 0.95, r)
    a[..., 1] = np.where(m, lum * 0.66, g)
    a[..., 2] = np.where(m, lum * 0.52, b)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA")


def hero():
    t = key(os.path.join(SRC, "hero_turnaround.jpg")); rows = parts(t)
    ref = crop(t, rows[0][0]).height                      # front view sets the scale
    k = HERO / ref
    sc = lambda im: im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    r0 = rows[0]                                          # front, back, side R, side L, 3/4
    for p, n in zip(r0, ["front", "back", "sideR", "sideL", "q_front"]): save(sc(crop(t, p)), "h_" + n)
    r1 = rows[1]                                          # walk side, wave, point, sit
    save(sc(crop(t, r1[1])), "h_wave"); save(sc(crop(t, r1[-1])), "h_sit")
    w = key(os.path.join(SRC, "hero_walk_moods.jpg")); rows = parts(w)
    kw = HERO / crop(w, rows[1][0]).height                # tired stands full height
    sw = lambda im: im.resize((round(im.width * kw), round(im.height * kw)), Image.LANCZOS)
    for i, p in enumerate(rows[0][:4]): save(sw(crop(w, p)), f"h_walk_{i}")
    save(sw(crop(w, rows[1][0])), "h_tired"); save(sw(crop(w, rows[1][1])), "h_in"); save(sw(crop(w, rows[1][2])), "h_out")
    b = key(os.path.join(SRC, "hero_back.jpg")); rows = parts(b)
    kb = HERO / crop(b, rows[0][0]).height
    sb = lambda im: im.resize((round(im.width * kb), round(im.height * kb)), Image.LANCZOS)
    for i, p in enumerate(rows[0][:4]): save(sb(crop(b, p)), f"h_back_{i}")
    for i, p in enumerate(rows[1][:4]): save(sb(crop(b, p)), f"h_qback_{i}")
    save(fit(crop(b, rows[2][-1]), h=HERO * 1.05), "h_win")
    j = key(os.path.join(SRC, "hero_jump.jpg")); save(fit(crop(j, parts(j)[0][0]), h=HERO * 1.05), "h_jump")
    c = key(os.path.join(SRC, "hero_camp_red.jpg"), purple_frame=True); rows = parts(c)
    flat = [p for r in rows for p in r]
    flat.sort(key=lambda p: (p[0][1] > c.shape[0] * 0.45, p[0][0]))
    save(fit(brownify(crop(c, flat[2])), h=HERO), "h_drink")
    save(fit(brownify(crop(c, flat[3])), h=HERO), "h_look")


def plants():
    for sheet, a_sp, b_sp in SPECIES:
        s = key(os.path.join(SRC, sheet + ".jpg"), **({"near": 38, "fringe": 50, "despill": False} if "cosmos" in sheet else {})); rows = parts(s)
        for sp, row in zip((a_sp, b_sp), rows[-2:]):
            for st, p in enumerate(row[-3:]):
                save(fit(crop(s, p, fill=(14 if sp == "cosmos" else 0)), h=[150, 230, 230][st], w=230), f"p3_{sp}_{st}")
    # cosmos petals are the colour of that sheet's background, so until it is regenerated on green
    # the cosmos is the daisy with pink petals
    for st in range(3):
        im = Image.open(os.path.join(OUT, f"p3_daisy_{st}.png")); a = np.asarray(im).astype(float)
        r, g, b = a[..., 0], a[..., 1], a[..., 2]
        white = (r > 175) & (g > 160) & (b > 150)
        a[..., 0] = np.where(white, r * 0.97, r); a[..., 1] = np.where(white, g * 0.55, g); a[..., 2] = np.where(white, b * 0.78, b)
        Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGBA").save(os.path.join(OUT, f"p3_cosmos_{st}.png"))
    o = key(os.path.join(SRC, "obstacles3d.jpg")); rows = parts(o, gap=4)
    names = [["stone", "stone2", "weed"], ["plastic", "mush"]]
    for row, ns in zip(rows, names):
        for p, n in zip(row, ns):
            save(fit(crop(o, p), w=200, h=200), "o3_" + n)
    f = key(os.path.join(SRC, "flag3d.jpg")); flat = [p for r in parts(f) for p in r][:4]
    for i, p in enumerate(flat): save(fit(crop(f, p), h=180), f"flag_{i}")


def textures():
    im = Image.open(os.path.join(SRC, "tex_grass_soil.jpg")).convert("RGB")
    W, H = im.size
    g = im.crop((int(W * 0.03), int(H * 0.06), int(W * 0.47), int(H * 0.94)))
    s = im.crop((int(W * 0.53), int(H * 0.06), int(W * 0.97), int(H * 0.94)))
    g.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, "tex_grass.jpg"), quality=88)
    s.resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, "tex_soil.jpg"), quality=88)


def scenes():
    os.makedirs(os.path.join(OUT, "scenes"), exist_ok=True)
    for m in MOUNTAINS:
        files = sorted(f for f in os.listdir(SRC) if f.startswith(m + "_"))
        for f in files:
            i = int(f.split("_")[1])
            Image.open(os.path.join(SRC, f)).convert("RGB").resize((810, 1450), Image.LANCZOS).save(
                os.path.join(OUT, "scenes", f"{m}_{i}.jpg"), quality=80)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    hero(); plants(); textures(); scenes()
    print("3d imported")
