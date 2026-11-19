"""Find the hiking trail in every scene: dirt-coloured region reaching the bottom, its skeleton, the longest
route from the bottom, simplified to points (fractions of the image) with the trail width at each."""
import os, json, sys
import numpy as np
from PIL import Image
from scipy import ndimage
from skimage.morphology import skeletonize
from collections import deque

DIR = "assets/3d/scenes"
W, H = 270, 483

def mask(im):
    hsv = np.asarray(im.convert("HSV")).astype(float) / 255
    h, s, v = hsv[..., 0] * 360, hsv[..., 1], hsv[..., 2]
    m = (h > 12) & (h < 44) & (s > 0.18) & (s < 0.68) & (v > 0.32)
    m = ndimage.binary_opening(m, iterations=1)
    m = ndimage.binary_closing(m, iterations=2)
    return m

def trace(path, override=None):
    im = Image.open(path).convert("RGB").resize((W, H))
    m = mask(im)
    lab, n = ndimage.label(m)
    # component with most pixels in the bottom-centre band
    band = lab[int(H * 0.88):, int(W * 0.2):int(W * 0.8)]
    ids, cnt = np.unique(band[band > 0], return_counts=True)
    if not len(ids): return None
    comp = lab == ids[np.argmax(cnt)]
    comp = ndimage.binary_fill_holes(comp)
    dist = ndimage.distance_transform_edt(comp)
    sk = skeletonize(comp)
    pts = np.argwhere(sk)
    if not len(pts): return None
    start = tuple(pts[np.argmax(pts[:, 0] - abs(pts[:, 1] - W / 2) * 0.3)])
    # BFS over skeleton; pick the farthest point that is highest up
    prev = {start: None}; dq = deque([start]); order = []
    while dq:
        p = dq.popleft(); order.append(p)
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                q = (p[0] + dy, p[1] + dx)
                if (dy or dx) and 0 <= q[0] < H and 0 <= q[1] < W and sk[q] and q not in prev:
                    prev[q] = p; dq.append(q)
    end = min(order, key=lambda p: p[0])
    route = []
    p = end
    while p: route.append(p); p = prev[p]
    route.reverse()
    # resample to ~16 points by arc length
    route = np.array(route, float)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(route, axis=0).T))]
    n = 16
    out = []
    for t in np.linspace(0, seg[-1], n):
        i = min(np.searchsorted(seg, t), len(route) - 1)
        y, x = route[i]
        out.append([round(x / W, 3), round(y / H, 3), round(float(dist[int(y), int(x)]) * 2 / W, 3)])
    return out

if __name__ == "__main__":
    res = {}
    for f in sorted(os.listdir(DIR)):
        res[f[:-4]] = trace(os.path.join(DIR, f))
    json.dump(res, open("/tmp/trails_auto.json", "w"))
    print(len(res))
