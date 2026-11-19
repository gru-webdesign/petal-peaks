"""Shared cut-out for the soft 3D art: key out the flat sheet background (sampled), despill, split into parts."""
import numpy as np
from PIL import Image
from scipy import ndimage


def key(path, purple_frame=False, near=70, fringe=110, despill=True):
    a = np.array(Image.open(path).convert("RGB")).astype(float)
    H, W = a.shape[:2]
    # background colour = median of the sheet's magenta-looking pixels
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    magish = ((r + b) / 2 - g > 90) & (np.minimum(r, b) > 110)
    bg = np.median(a[magish], axis=0)
    d = np.sqrt(((a - bg) ** 2).sum(-1))
    m = np.clip((near - d) / (near / 2), 0, 1)                       # 1 = background
    m = np.maximum(m, magish & (d < fringe))                   # anti-aliased magenta fringes
    if purple_frame:                                        # dark purple border around a sheet screenshot
        m = np.maximum(m, (b > r * 0.75) & (g < r * 0.55) & (r < 150) & (r > 40))
    alpha = 1 - m
    spill = np.clip(np.minimum(r, b) - g - 10, 0, None) * np.clip(1 - alpha + 0.35, 0, 1)
    if despill:
        a[..., 0] -= spill * 0.75
        a[..., 2] -= spill * 0.75
    return np.dstack([np.clip(a, 0, 255), alpha * 255]).astype(np.uint8)


def parts(rgba, min_area=8000, gap=0):
    """Connected parts as (box, mask) sorted into rows, then left to right."""
    solid = rgba[..., 3] > 128
    grow = ndimage.binary_dilation(solid, iterations=gap) if gap else solid
    lab, n = ndimage.label(grow)
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(np.ones(solid.shape), lab, range(1, n + 1))
    out = []
    for i, o in enumerate(objs):
        h, w = o[0].stop - o[0].start, o[1].stop - o[1].start
        if w > 5 * h or sizes[i] < min_area or sizes[i] / (h * w) < 0.12 or h < 40 or w < 25:
            continue
        out.append(((o[1].start, o[0].start, o[1].stop, o[0].stop), lab == i + 1))
    out.sort(key=lambda p: (p[0][1] + p[0][3]) / 2)
    rows, cur = [], []
    for p in out:
        cy = (p[0][1] + p[0][3]) / 2
        if cur and cy > max(q[0][3] for q in cur):
            rows.append(sorted(cur, key=lambda q: q[0][0])); cur = []
        cur.append(p)
    if cur: rows.append(sorted(cur, key=lambda q: q[0][0]))
    return rows


def crop(rgba, part, pad=4, fill=False, erode=2):
    (x0, y0, x1, y1), mask = part
    a = rgba.copy()
    solid = mask & (a[..., 3] > 128)
    if fill:                       # petals the same colour as the background: everything inside the outline is opaque
        solid = ndimage.binary_fill_holes(ndimage.binary_closing(solid, iterations=fill if fill > 1 else 8))
        a[..., 3] = np.where(solid, 255, a[..., 3])
    if erode:                      # drop the tinted halo at the very edge
        core = ndimage.binary_erosion(solid, iterations=erode)
        a[..., 3] = np.where(core, a[..., 3], (a[..., 3] * 0.25).astype(np.uint8))
        a[..., 3] = np.where(ndimage.binary_erosion(solid, iterations=1), a[..., 3], 0)
    a[..., 3] = np.where(mask, a[..., 3], 0)
    H, W = a.shape[:2]
    return Image.fromarray(a[max(0, y0 - pad):min(H, y1 + pad), max(0, x0 - pad):min(W, x1 + pad)], "RGBA")


def fit(im, h=None, w=None):
    k = min(h / im.height if h else 9, w / im.width if w else 9)
    return im.resize((max(1, round(im.width * k)), max(1, round(im.height * k))), Image.LANCZOS)
