"""Every work on skin in the studio's own post style (owner, round 8, with two of his posts as the standard):
the real subject — the limb with the tattoo — untouched in the middle, and behind it a faded close-up of
the same tattoo, bigger and turned to a different angle.

    <venv>/python scripts/work-style.py <raw_dir> [id,id,…]

Needs rembg (pip install "rembg[cpu]"; models u2net_human_seg + u2net) in that Python, plus OpenCV and Pillow. raw_dir holds the
downloads: full/f_NNN_<key>.jpg (feed) and mix/mix_NN.jpg (reel frames). Writes public/works/<id>.webp and
<id>_s.webp for every work on the site (aNNN: 1080 px long side + 480 w; wNN: 720×1280 + 360×640), and keeps
each limb mask in ../assets/masks/<id>.png (cached; a bad one can be fixed by hand and the script re-run).

  1. subject: the body (u2net_human_seg, which keeps the whole limb, skin and all) joined with the salient object
     (u2net, which never loses the tattoo's edge); closed, holes filled, crumbs dropped, a 1 px soft edge;
     when the cut fails (almost nothing kept) the photo is used as it is;
  2. focus: the centre of the ink inside the subject (its darkest third);
  3. background: the photo zoomed ×2.1 around that focus and turned ±10° (direction alternates by work),
     softened, mostly desaturated and veiled with a haze taken from its own colours;
  4. the subject over it with a faint shadow so the cut reads as intentional.
When the models keep only the ink (under 30 % of the frame, or listed in GROW after review), the cut grows
into the skin around it: pixels close to the skin tone just outside the ink, connected to it. Close-ups of skin
with no limb outline to follow (WINDOW, chosen by eye) and photos where nothing was found show the untouched
photo as a soft-edged panel over the same faded background instead.
"""
import sys, os, re, glob, zlib
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE); ROOT = os.path.dirname(SITE)
RAW = sys.argv[1]
ONLY = set(sys.argv[2].split(",")) if len(sys.argv) > 2 else None
OUT = os.path.join(SITE, "public", "works")
MASKS = os.path.join(ROOT, "assets", "masks")
os.makedirs(MASKS, exist_ok=True)
_sessions = None
GROW = {"a247", "a371", "a426", "a439", "a462"}  # ink-only cuts above the threshold, found by eye (round 8)
WINDOW = {"a074", "a080", "a174", "a175", "a226", "a231", "a237", "a295", "a339", "a370", "a500", "a569", "a629", "a656",
          "w07", "w12", "w17", "w18"}  # skin close-ups where a grown cut looks torn (round 8)


def works():
    """every work the site shows: feed ids from src/catalogue.js, reel frames from src/data.js"""
    cat = open(os.path.join(SITE, "src", "catalogue.js"), encoding="utf8").read()
    feed = re.findall(r'id: "(a\d{3})"', cat)
    data = open(os.path.join(SITE, "src", "data.js"), encoding="utf8").read()
    mix = sorted(set(re.findall(r'file: "(w\d\d)"', data)) | set(f"w{m}" for m in re.findall(r'id: "(\d\d)"', data.split("export const WORKS", 1)[1].split("];", 1)[0])))
    return feed, mix


def source(wid):
    if wid.startswith("w"):
        return os.path.join(RAW, "mix", f"mix_{wid[1:]}.jpg")
    hits = glob.glob(os.path.join(RAW, "full", f"f_{int(wid[1:]):03d}_*.jpg"))
    return sorted(hits)[0] if hits else None


def fill_holes(m):
    pad = cv2.copyMakeBorder(m, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    ff = pad.copy()
    cv2.floodFill(ff, np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8), (0, 0), 255)
    return (pad | cv2.bitwise_not(ff))[1:-1, 1:-1]


def limb_mask(wid, bgr):
    path = os.path.join(MASKS, wid + ".png")
    if os.path.exists(path):
        m = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        return cv2.resize(m, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_LINEAR)
    global _sessions
    from rembg import new_session, remove
    if _sessions is None:
        _sessions = [new_session("u2net_human_seg"), new_session("u2net")]
    pil = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
    small = pil.copy(); small.thumbnail((1024, 1024))
    m = np.maximum(*[np.asarray(remove(small, session=s_, only_mask=True)) for s_ in _sessions])
    m = cv2.resize(m, (bgr.shape[1], bgr.shape[0]), interpolation=cv2.INTER_LINEAR)
    cv2.imwrite(path, m)
    return m


def clean(m):
    h, w = m.shape
    U = max(h, w) / 100
    b = (m > 127).astype(np.uint8) * 255
    k = int(1.2 * U) | 1
    b = cv2.morphologyEx(b, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    b = fill_holes(b)
    n, cc, st, _ = cv2.connectedComponentsWithStats(b, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros_like(b)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] >= 0.06 * big:
                keep[cc == i] = 255
        b = keep
    b = cv2.morphologyEx(b, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    # round off the outline: a cut-out should read as clean, not as the segmentation's stair-steps
    b = (cv2.GaussianBlur(b.astype(np.float32), (0, 0), 1.3 * U) > 127).astype(np.float32)
    return cv2.GaussianBlur(b, (0, 0), 1.0)


def grow(a, bgr):
    """the models kept the tattoo but not the skin: take back the skin-toned pixels connected to it"""
    b = (a > 0.5).astype(np.uint8)
    h, w = b.shape
    U = max(h, w) / 100
    lab = cv2.cvtColor(cv2.GaussianBlur(bgr, (0, 0), 1.5), cv2.COLOR_BGR2LAB).astype(np.float32)
    ring = cv2.dilate(b, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(3 * U) | 1, int(3 * U) | 1))) & (1 - b)
    if ring.sum() < 50:
        return a
    tone = np.median(lab[ring > 0], axis=0)
    d = np.linalg.norm((lab - tone) * np.array([0.55, 1.0, 1.0], np.float32), axis=2)  # shading matters less than hue
    cand = ((d < 19) | (b > 0)).astype(np.uint8)
    cand = cv2.morphologyEx(cand, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(0.8 * U) | 1, int(0.8 * U) | 1)))
    n, cc = cv2.connectedComponents(cand, connectivity=8)
    seeds = np.unique(cc[(b > 0) & (cand > 0)])
    keep = (np.isin(cc, seeds[seeds > 0]) | (b > 0)).astype(np.uint8) * 255
    return clean(keep)


def window(h, w):
    """a rounded panel, 76 % × 90 % of the frame, feathered"""
    m = np.zeros((h, w), np.uint8)
    U = max(h, w) / 100
    r = int(min(w, h) * 0.06)
    x0, x1, y0, y1 = int(w * 0.12), int(w * 0.88), int(h * 0.05), int(h * 0.95)
    cv2.rectangle(m, (x0 + r, y0), (x1 - r, y1), 255, -1); cv2.rectangle(m, (x0, y0 + r), (x1, y1 - r), 255, -1)
    for cx, cy in ((x0 + r, y0 + r), (x1 - r, y0 + r), (x0 + r, y1 - r), (x1 - r, y1 - r)):
        cv2.circle(m, (cx, cy), r, 255, -1, cv2.LINE_AA)
    return cv2.GaussianBlur(m.astype(np.float32) / 255, (0, 0), 1.1 * U)


def style(wid, bgr):
    h, w = bgr.shape[:2]
    a = clean(limb_mask(wid, bgr))
    cover = float((a > 0.5).mean())
    if 0.08 <= cover < 0.3 or wid in GROW:
        a = grow(a, bgr)
        cover = float((a > 0.5).mean())
    if cover < 0.08 or wid in WINDOW:
        a = window(h, w)  # no limb to cut out: the photo itself, as a soft-edged panel
        cover = -cover
    # focus: centre of the ink inside the subject
    grey = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    inside = a > 0.5
    thr = np.percentile(grey[inside], 33)
    ys, xs = np.where(inside & (grey <= thr))
    if len(xs) < 50:
        ys, xs = np.where(inside)
    cx, cy = float(np.median(xs)), float(np.median(ys))
    # background: the same tattoo, bigger, turned, faded
    ang = 10.0 if zlib.crc32(wid.encode()) % 2 else -10.0
    M = cv2.getRotationMatrix2D((cx, cy), ang, 2.1)
    M[0, 2] += w / 2 - cx; M[1, 2] += h / 2 - cy
    bg = cv2.warpAffine(bgr, M, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT_101).astype(np.float32)
    U = max(h, w) / 100
    bg = cv2.GaussianBlur(bg, (0, 0), 0.32 * U)
    g3 = cv2.cvtColor(bg.astype(np.uint8), cv2.COLOR_BGR2GRAY).astype(np.float32)[..., None]
    bg = g3 + (bg - g3) * 0.3  # most of the colour out
    haze = np.clip(bg.reshape(-1, 3).mean(0) * 0.6 + np.array([150, 144, 146], np.float32) * 0.4 + 18, 0, 235)
    bg = bg * 0.56 + haze * 0.44
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    vig = 1 - 0.18 * (((xx / w - 0.5) ** 2 + (yy / h - 0.5) ** 2) * 2.0)
    bg *= vig[..., None]
    # a faint shadow around the subject, then the subject itself, untouched
    sh = cv2.GaussianBlur(a, (0, 0), 2.2 * U)
    bg *= (1 - 0.32 * sh * (1 - a))[..., None]
    out = bg * (1 - a[..., None]) + bgr.astype(np.float32) * a[..., None]
    return np.clip(out, 0, 255).astype(np.uint8), cover


def save(img, wid):
    p = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    if wid.startswith("w"):
        p.resize((720, 1280), Image.LANCZOS).save(os.path.join(OUT, wid + ".webp"), quality=80, method=6)
        p.resize((360, 640), Image.LANCZOS).save(os.path.join(OUT, wid + "_s.webp"), quality=74, method=6)
    else:
        big = p.copy(); big.thumbnail((1080, 1080), Image.LANCZOS)
        big.save(os.path.join(OUT, wid + ".webp"), quality=80, method=6)
        small = p.copy(); s = 480 / small.width
        small.resize((480, round(small.height * s)), Image.LANCZOS).save(os.path.join(OUT, wid + "_s.webp"), quality=72, method=6)


if __name__ == "__main__":
    feed, mix = works()
    todo = [w for w in feed + mix if ONLY is None or w in ONLY]
    log = []
    for i, wid in enumerate(todo):
        src = source(wid)
        if not src:
            print("missing", wid); continue
        bgr = cv2.imread(src, cv2.IMREAD_COLOR)
        img, cover = style(wid, bgr)
        save(img, wid)
        log.append(f"{wid}\t{cover:.2f}")
        if i % 20 == 0:
            print(i, "/", len(todo), wid, f"{cover:.2f}", flush=True)
    open(os.path.join(MASKS, "_cover.tsv"), "w").write("\n".join(log) + "\n")
    print("done", len(log))
