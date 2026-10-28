"""Sgt. Zippo's rose (his symbol, owner's file, round 9) as the back of the hero badge.

The owner: "when double clicking on the Al3 studio logo, there is a flip animation that brings this attached image
instead which is the symbol of Sgt. Zippo. Make it look on a round background and with the same effects as the al3
studio logo". So the rose gets the AL3 badge's anatomy, on the AL3 layers' exact geometry (box 2x theirs, the disc's
centre at 50% / 48.33%, radius 43.73%), which lets the spark, the shine and the buzz work unchanged:
  1. the disc: an ink field with the AL3 ring (thin white line, white ring, dark-red rim) and his red thorn wreath,
     scaled so 97% of the thorns sit inside the ring; the farthest tips cross it, as the AL3's 3 breaks past its ring;
  2. the rose: cut out of the black (petals and shading, the outlines inside them, its own outer outline) to float
     in front of the wreath, as the AL3 lettering floats over its disc; and larger than the wreath's scale, about its
     own centre, so its farthest petals and blades break past the rim (owner, round 9: "make the rose bigger so that
     some of its edges fit outside of the circle like the AL3 tattoo studio"; the AL3's 3 reaches 1.21x the rim).
Nothing is redrawn: every pixel of the rose and the thorns is his file's, scaled.

    python site/scripts/zippo-badge.py [assets/brand/zippo-rose-source.webp]
"""
import os, sys
import numpy as np, cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(SITE), "assets", "brand", "zippo-rose-source.webp")
INK = np.array((11, 10, 11), np.float32)          # RGB
RIM = np.array((140, 22, 25), np.float32)         # the AL3 disc's dark-red rim
WHITE = np.array((250, 247, 244), np.float32)
BOX = 1196                                        # 2x the AL3 layers (598): crisp at 500 CSS px on a DPR 2 screen
CX, CY = BOX * 0.5, BOX * 0.48328                 # the AL3 disc's centre in its box
# the AL3 ring, as fractions of the box (measured on al3-disc.webp, centre 299 / 289, radius 261.5 of 598)
R_DISC, R_RING_OUT, R_RING_IN = 0.4373 * BOX, 0.4323 * BOX, 0.3888 * BOX
R_LINE_A, R_LINE_B = 0.3700 * BOX, 0.3755 * BOX

im = cv2.cvtColor(cv2.imread(SRC), cv2.COLOR_BGR2RGB).astype(np.float32)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
sat = im.max(2) - im.min(2)
lum = 0.299 * r + 0.587 * g + 0.114 * b

# the thorns: red against the black. The file's compression bleeds a faint red into the black around them, which
# turns pink over the white ring: the alpha ramps over a narrow band of redness, so edges stay smooth but the haze goes
redness = np.clip((r - np.maximum(g, b) - 30) / 110, 0, 1)
thorn_a = redness * redness * (3 - 2 * redness)
ys, xs = np.nonzero(thorn_a > 0.5)
scx, scy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
dist = np.hypot(xs - scx, ys - scy)
S = R_RING_IN / np.percentile(dist, 97)           # 97% of the wreath inside the ring

# the rose: unsaturated and lighter than the black, the biggest pieces near the middle
light = ((sat < 45) & (lum > 22)).astype(np.uint8)
light = cv2.morphologyEx(light, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
n, cc, st, cen = cv2.connectedComponentsWithStats(light, 8)
keep = np.zeros_like(light)
for i in range(1, n):
    if st[i, cv2.CC_STAT_AREA] >= 400 and np.hypot(cen[i][0] - scx, cen[i][1] - scy) < 520:
        keep[cc == i] = 1
# its outer black outline (~7 px in the file) and the outlines inside the petals: close, fill the holes, grow
rose = cv2.morphologyEx(keep, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15)))
flood = rose.copy() * 255
mask = np.zeros((H + 2, W + 2), np.uint8)
cv2.floodFill(flood, mask, (0, 0), 128)
rose = ((flood != 128)).astype(np.uint8)          # everything the outside cannot reach is rose
rose = cv2.dilate(rose, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
rose_a = cv2.GaussianBlur(rose.astype(np.float32), (0, 0), 1.2) * (1 - thorn_a)  # a thorn the outline grew over stays on the disc

# into the badge's box: scale S about the wreath's centre, which lands on the disc's centre
M = np.float32([[S, 0, CX - S * scx], [0, S, CY - S * scy]])
warp = lambda a, m=M: cv2.warpAffine(a, m, (BOX, BOX), flags=cv2.INTER_AREA if m[0, 0] < 1 else cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
im_b = warp(im)
thorn_b = warp(thorn_a)
rose_b = np.clip(warp(rose_a), 0, 1)              # where the rose hid the thorns in his file (the disc leaves them out)

# the rose, larger: about its own centre (which stays where the wreath's scale puts it) until its farthest tip
# reaches REACH x the rim, but never past the box (MARGIN px), so the layer is never clipped
REACH, MARGIN = 1.12, 10
ys_r, xs_r = np.nonzero(rose)
rcx, rcy = (xs_r.min() + xs_r.max()) / 2, (ys_r.min() + ys_r.max()) / 2
px_, py_ = CX + S * (rcx - scx), CY + S * (rcy - scy)
sx_, sy_ = xs_r[::7] - rcx, ys_r[::7] - rcy
def placed(k):
    x, y = px_ + S * k * sx_, py_ + S * k * sy_
    return np.hypot(x - CX, y - CY).max() / R_DISC, x.min(), x.max(), y.min(), y.max()
lo, hi = 1.0, 2.5
for _ in range(40):
    k = (lo + hi) / 2
    reach, x0, x1, y0, y1 = placed(k)
    fits = x0 >= MARGIN and y0 >= MARGIN and x1 <= BOX - MARGIN and y1 <= BOX - MARGIN
    lo, hi = (k, hi) if reach < REACH and fits else (lo, k)
GROW = lo
M_rose = np.float32([[S * GROW, 0, px_ - S * GROW * rcx], [0, S * GROW, py_ - S * GROW * rcy]])
rose_im = warp(im, M_rose)
rose_big = np.clip(warp(rose_a, M_rose), 0, 1)

yy, xx = np.mgrid[0:BOX, 0:BOX].astype(np.float32)
rad = np.hypot(xx + 0.5 - CX, yy + 0.5 - CY)
band = lambda r0, r1: np.clip(rad - r0 + 0.5, 0, 1) * np.clip(r1 - rad + 0.5, 0, 1)

# 1. the disc: ink, the thin white line, the white ring, the dark-red rim; the thorns over all of it, nothing under the rose
disc = np.broadcast_to(INK, (BOX, BOX, 3)).copy()
for col, (r0, r1) in ((WHITE, (R_LINE_A, R_LINE_B)), (WHITE, (R_RING_IN, R_RING_OUT)), (RIM, (R_RING_OUT, R_DISC))):
    a = band(r0, r1)[..., None]
    disc = disc * (1 - a) + col * a
ta = (thorn_b * (1 - rose_b))[..., None]
t = thorn_b[..., None]
thorn_rgb = np.clip((im_b - (1 - t) * 7) / np.maximum(t, 0.05), 0, 255)  # un-premultiply from the file's black (#070707)
disc = disc * (1 - ta) + thorn_rgb * ta
circle = np.clip(R_DISC + 0.5 - rad, 0, 1)
disc_a = np.maximum(circle, thorn_b)              # a thorn tip past the rim stays (as the AL3's 3 does)
# 2. the rose, floating
rose_rgb = rose_im

out = os.path.join(SITE, "public", "brand")
os.makedirs(out, exist_ok=True)
for name, rgb, a in (("zippo-disc.webp", disc, disc_a), ("zippo-rose.webp", rose_rgb, rose_big)):
    Image.fromarray(np.dstack([np.clip(rgb, 0, 255), np.clip(a, 0, 1) * 255]).astype(np.uint8), "RGBA").save(os.path.join(out, name), quality=92, method=6)
print({"scale": round(float(S), 4), "wreath centre": (round(float(scx)), round(float(scy))), "box": BOX,
       "rose grow": round(float(GROW), 3), "rose reach": round(float(placed(GROW)[0]), 3),
       "rose past the rim %": round(float(((rose_big > 0.5) & (rad > R_DISC)).sum() / max(1, (rose_big > 0.5).sum()) * 100), 1),
       "thorn tips past the rim": int(((thorn_b > 0.5) & (rad > R_DISC)).sum())})
