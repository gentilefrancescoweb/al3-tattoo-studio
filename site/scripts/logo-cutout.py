"""Cuts the AL3 mark out of the studio's profile picture (supplied by the owner, round 7): the red disc with
its white ring and the graffiti "AL3", whose 3 swings out past the ring. The Instagram story ring and the
blurred glow behind the badge are dropped; nothing is redrawn.

    python -I scripts/logo-cutout.py [../assets/brand/al3-logo-source.webp]

Writes public/brand/al3.webp (full resolution of the cut, ~600 px, alpha: it is the hero's mark since round 8) and its two
layers al3-disc.webp / al3-letters.webp (same canvas, for the hero's tilt), public/favicon.ico (16/32/48), public/brand/icon-192.png,
public/brand/apple-touch-icon.png (180 px on the site's ink, iOS ignores alpha).

  1. the disc: a circle fitted to the outer edge of the white ring, plus its thin dark-red rim;
  2. the letters past the disc: their black outline, closed and hole-filled together with the disc,
     plus the thin white keyline that runs around the outline;
  3. a soft 1 px edge, cropped square around the mark.
"""
import sys, os, math
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(SITE), "assets", "brand", "al3-logo-source.webp")
INK = (11, 10, 11)

im = cv2.imread(SRC, cv2.IMREAD_COLOR)
H, W = im.shape[:2]
b, g, r = [im[..., i].astype(np.int32) for i in range(3)]
grey = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY).astype(np.int32)
sat = im.max(axis=2).astype(np.int32) - im.min(axis=2)

# 1. disc: walk outwards from a rough centre along many rays; the white ring ends where the dark-red rim starts
cx, cy = W / 2, H / 2
white = (r > 225) & (g > 225) & (b > 225)
ys, xs = np.where(white)
cx, cy = xs.mean(), ys.mean()
pts = []
for k in range(360):
    a = math.radians(k)
    last, run = None, 0  # outermost run of ≥ 12 white pixels: the thick ring, not the thin inner line
    for rr in np.arange(0.25 * W, 0.47 * W, 0.5):
        x, y = int(round(cx + rr * math.cos(a))), int(round(cy + rr * math.sin(a)))
        if not (0 <= x < W and 0 <= y < H):
            break
        run = run + 1 if white[y, x] else 0
        if run >= 24:
            last = (x, y)
        elif run and last is not None and math.hypot(x - last[0], y - last[1]) <= 1:
            last = (x, y)
    if last is not None:
        pts.append(last)
pts = np.array(pts, np.float64)
# least-squares circle (letters cover some rays: drop the inner outliers and refit)
for _ in range(3):
    A = np.c_[2 * pts[:, 0], 2 * pts[:, 1], np.ones(len(pts))]
    sol = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
    cx, cy = sol[0], sol[1]
    R = math.sqrt(sol[2] + cx * cx + cy * cy)
    d = np.hypot(pts[:, 0] - cx, pts[:, 1] - cy)
    pts = pts[np.abs(d - np.median(d)) < 4]
R_DISC = R + 3.2  # + the dark-red rim line
yy, xx = np.mgrid[0:H, 0:W]
rad = np.hypot(xx - cx, yy - cy)
disc = (rad <= R_DISC).astype(np.uint8) * 255

# 2. letters outside the disc: black outline (dark, unsaturated) and the white keyline next to it
black = ((grey < 70) & (sat < 40)).astype(np.uint8) * 255
black = cv2.morphologyEx(black, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
n, cc, st, _ = cv2.connectedComponentsWithStats(black, 8)
touch = np.zeros_like(black)
ring_zone = (rad <= R_DISC + 2)
for i in range(1, n):  # only outline pieces that belong to the badge (they touch the disc)
    if st[i, cv2.CC_STAT_AREA] > 30 and ring_zone[cc == i].any():
        touch[cc == i] = 255


def fill_holes(m):
    pad = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    ff = pad.copy()
    cv2.floodFill(ff, np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8), (0, 0), 255)
    return (pad | cv2.bitwise_not(ff))[1:-1, 1:-1]


body = cv2.morphologyEx(disc | touch, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))
body = fill_holes(body)
near = cv2.dilate(touch, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))) > 0
keyline = (near & (grey > 165) & (sat < 60) & (rad > R_DISC - 1)).astype(np.uint8) * 255
mask = fill_holes(body | keyline)
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
alpha = cv2.GaussianBlur(mask.astype(np.float32) / 255, (0, 0), 0.7)
alpha = np.clip((alpha - 0.5) * 1.6 + 0.5, 0, 1)

# 3. crop square around the mark, transparent margin of 2%
ys, xs = np.where(alpha > 0.02)
x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
side = int(max(x1 - x0, y1 - y0) * 1.04)
mx, my = (x0 + x1) // 2, (y0 + y1) // 2
rgba = np.dstack([im, (alpha * 255).astype(np.uint8)])
canvas = np.zeros((side, side, 4), np.uint8)
sx0, sy0 = mx - side // 2, my - side // 2
xa, ya = max(0, sx0), max(0, sy0)
xb, yb = min(W, sx0 + side), min(H, sy0 + side)
canvas[ya - sy0:yb - sy0, xa - sx0:xb - sx0] = rgba[ya:yb, xa:xb]

def crop(rgba):
    out = np.zeros((side, side, 4), np.uint8)
    out[ya - sy0:yb - sy0, xa - sx0:xb - sx0] = rgba[ya:yb, xa:xb]
    return out


# 4. two layers for the hero (round 8, owner: "more interactive"): the lettering lifts off the disc. Letters = the
#    unsaturated pixels (grey fill, black outline) over the red and, in the white ring, the non-white ones; plus every
#    part of the mark outside the disc. Under them the disc is rebuilt from its own radial profile (red, thin white
#    line, red, white ring, dark rim), measured on the angles the letters leave free. Nothing is redrawn by hand.
R_RED = R - 40  # the flat red ends ~40 px inside the ring's outer edge; between them only white lines and ring
letters = np.zeros((H, W), bool)
letters |= (rad < R_RED) & (sat < 70)
letters |= (rad >= R_RED) & (rad <= R_DISC) & (sat < 70) & (grey < 200)
letters |= (rad > R_DISC) & (alpha > 0.02)
letters = cv2.morphologyEx(letters.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
n, cc, st, _ = cv2.connectedComponentsWithStats(1 - letters, 4)
for i in range(1, n):  # specks of red caught inside the fill
    if st[i, cv2.CC_STAT_AREA] < 40:
        letters[cc == i] = 1
n, cc, st, _ = cv2.connectedComponentsWithStats(letters, 8)
for i in range(1, n):  # stray grey pixels on the disc
    if st[i, cv2.CC_STAT_AREA] < 30:
        letters[cc == i] = 0
free = (letters == 0) & (rad <= R_DISC + 1)
bins = np.clip((rad * 2).astype(int), 0, int(R_DISC * 2) + 4)
prof = np.zeros((bins.max() + 1, 3), np.float32)
for k in range(bins.max() + 1):
    sel = free & (bins == k)
    if sel.sum() >= 8:
        prof[k] = np.median(im[sel], axis=0)
    elif k:
        prof[k] = prof[k - 1]
flat = np.median(im[free & (rad < R_RED - 6)], axis=0)  # the flat red: also the centre, which the letters cover entirely
prof[: int((R_RED - 6) * 2)] = flat
under = prof[bins]
cover = cv2.GaussianBlur(cv2.dilate(letters, np.ones((7, 7), np.uint8)).astype(np.float32), (0, 0), 1.0)[..., None]
disc_rgb = im.astype(np.float32) * (1 - cover) + under * cover
disc_a = np.clip(R_DISC + 0.5 - rad, 0, 1)
let_a = cv2.GaussianBlur(letters.astype(np.float32), (0, 0), 0.6) * np.clip(alpha / 0.98, 0, 1)
DISC = crop(np.dstack([np.clip(disc_rgb, 0, 255).astype(np.uint8), (disc_a * 255).astype(np.uint8)]))
LET = crop(np.dstack([im, (np.clip(let_a, 0, 1) * 255).astype(np.uint8)]))

os.makedirs(os.path.join(SITE, "public", "brand"), exist_ok=True)
for name, layer in (("al3-disc.webp", DISC), ("al3-letters.webp", LET)):
    Image.fromarray(cv2.cvtColor(layer, cv2.COLOR_BGRA2RGBA)).save(os.path.join(SITE, "public", "brand", name), quality=94)
pil = Image.fromarray(cv2.cvtColor(canvas, cv2.COLOR_BGRA2RGBA))
pil.save(os.path.join(SITE, "public", "brand", "al3.webp"), quality=94)  # native size: the hero shows it large
pil.resize((192, 192), Image.LANCZOS).save(os.path.join(SITE, "public", "brand", "icon-192.png"))
pil.save(os.path.join(SITE, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
touch_icon = Image.new("RGBA", (180, 180), INK[::-1] + (255,))
touch_icon.alpha_composite(pil.resize((164, 164), Image.LANCZOS), (8, 8))
touch_icon.convert("RGB").save(os.path.join(SITE, "public", "brand", "apple-touch-icon.png"))
print({"centre": (round(cx, 1), round(cy, 1)), "R": round(R, 1), "crop": side})
