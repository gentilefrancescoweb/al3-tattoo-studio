"""Turns the AI redraws of his tattoos (clean flash art on a white ground, BRIEF.md v6) into the
floating stickers: the same die-cut bone sticker as before, now from a clean drawing instead of a photo.

    python -I scripts/lift-redraws.py [redraw_dir]

redraw_dir (default ../assets/redraws): <id>.webp per design (aNNN feed, wNN reel frames), each a
Nano Banana 2.1 redraw of the original photo. Writes public/ink/<id>.webp (≤ 560 px) and
public/ink/h/<id>.webp (≤ 384 px), then rebuilds src/ink-aspect.js. Run it after build-catalogue.py,
which would otherwise put the old photo extractions back.

  1. ground: a smooth estimate of the paper colour (normalised convolution of the pixels close to the
     border colour), so a faint gradient or a tinted ground never reads as ink;
  2. ink: colour distance from that ground (Lab ΔE);
  3. silhouette: a die-cut margin hugging the ink, holes filled, specks dropped;
  4. colour: the drawing multiplied so its ground becomes bone (black stays black, colour keeps its hue);
     a design the redraw ran off the frame dissolves towards that edge.
"""
import sys, os, subprocess
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE)
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(SITE), "assets", "redraws")
BONE = np.array([225, 232, 238], np.float32)  # BGR of #eee8e1, as extract-ink.py
WORK = 1400


def smooth_fill(val, w, sigma, prior, eps=0.03):
    """normalised convolution that falls back to prior where no weighted pixel is near
    (inside a large dark fill the plain ratio is 0/0 and blows the drawing out to white)"""
    num = cv2.GaussianBlur(val * w, (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)
    return (num + eps * prior) / (den + eps)


def fill_holes(mask):
    pad = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    ff = pad.copy()
    cv2.floodFill(ff, np.zeros((pad.shape[0] + 2, pad.shape[1] + 2), np.uint8), (0, 0), 255)
    return (pad | cv2.bitwise_not(ff))[1:-1, 1:-1]


def lift(bgr):
    h0, w0 = bgr.shape[:2]
    s = WORK / max(h0, w0)
    if s < 1:
        bgr = cv2.resize(bgr, (round(w0 * s), round(h0 * s)), interpolation=cv2.INTER_AREA)
    h, w = bgr.shape[:2]
    U = max(h, w) / 100.0
    px = bgr.astype(np.float32)
    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)

    # 1. the paper: border colour, then every pixel near it, smoothed over large scales
    r = max(2, int(1.5 * U))
    ring = np.concatenate([lab[:r].reshape(-1, 3), lab[-r:].reshape(-1, 3), lab[:, :r].reshape(-1, 3), lab[:, -r:].reshape(-1, 3)])
    g0 = np.median(ring, axis=0)
    near = (np.linalg.norm(lab - g0, axis=2) < 14).astype(np.float32)
    g0_bgr = np.median(np.concatenate([px[:r].reshape(-1, 3), px[-r:].reshape(-1, 3), px[:, :r].reshape(-1, 3), px[:, -r:].reshape(-1, 3)]), axis=0)
    g_lab = np.dstack([smooth_fill(lab[..., i], near, 6 * U, g0[i]) for i in range(3)])
    g_bgr = np.dstack([smooth_fill(px[..., i], near, 6 * U, g0_bgr[i]) for i in range(3)])

    # 2. ink = distance from the paper (L in 0..255 units, a/b weighted up a little)
    d = lab - g_lab
    de = np.sqrt(d[..., 0] ** 2 + 1.6 * (d[..., 1] ** 2 + d[..., 2] ** 2))
    ink = np.clip((de - 7) / 40, 0, 1)

    # 3. die-cut silhouette
    core = (de > 16).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    n, cc, st, _ = cv2.connectedComponentsWithStats(core, 8)
    clean = np.zeros_like(core)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] >= 0.6 * U * U:
            clean[cc == i] = 255
    sil = cv2.dilate(clean, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.0 * U) | 1, int(2.0 * U) | 1)))
    sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.6 * U) | 1, int(2.6 * U) | 1)))
    sil = fill_holes(sil)
    n, cc, st, _ = cv2.connectedComponentsWithStats(sil, 8)
    if n > 1:
        big = st[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros_like(sil)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] >= 0.03 * big:
                keep[cc == i] = 255
        sil = keep
    silf = cv2.GaussianBlur(sil.astype(np.float32) / 255, (0, 0), 0.4 * U)
    ink *= np.clip(silf * 1.3, 0, 1)

    # 4. paper → bone by multiplication; alpha = sticker body or ink, whichever is stronger
    out = np.clip(px * (BONE / np.maximum(g_bgr, 1)), 0, 255)
    out = out * silf[..., None] + BONE * (1 - silf[..., None])  # the soft rim is bone, never paper grey
    a = np.maximum(silf * 0.94, ink)
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(np.float32)
    a *= np.clip(edge / (3 * U), 0, 1) ** 1.5

    ys, xs = np.where(a > 0.04)
    pad = int(1.5 * U)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
    return np.dstack([out, a[..., None] * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]


def padded(st, frac=0.08):
    """transparent margin so the shader's blurred glow never smears an edge pixel"""
    h, w = st.shape[:2]
    m = round(max(h, w) * frac)
    return cv2.copyMakeBorder(st, m, m, m, m, cv2.BORDER_CONSTANT, value=(0, 0, 0, 0))


def fit(im, long_side):
    h, w = im.shape[:2]
    s = long_side / max(h, w)
    return im if s >= 1 else cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)


if __name__ == "__main__":
    if not os.path.isdir(SRC):
        print("no redraws at", SRC, "- keeping the photo cut-outs")
        sys.exit(0)
    ink_dir = os.path.join(SITE, "public", "ink")
    os.makedirs(os.path.join(ink_dir, "h"), exist_ok=True)
    done = 0
    for f in sorted(os.listdir(SRC)):
        if not f.endswith(".webp"):
            continue
        st = padded(lift(cv2.imread(os.path.join(SRC, f), cv2.IMREAD_COLOR)))
        cv2.imwrite(os.path.join(ink_dir, f), fit(st, 560), [cv2.IMWRITE_WEBP_QUALITY, 86])
        cv2.imwrite(os.path.join(ink_dir, "h", f), fit(st, 384), [cv2.IMWRITE_WEBP_QUALITY, 84])
        done += 1
    print(done, "stickers from redraws")
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "ink-aspect.py")], check=True)
