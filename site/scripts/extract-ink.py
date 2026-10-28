"""Lift a tattoo off the skin: photo of a tattooed limb → RGBA "flying tattoo".

    python scripts/extract-ink.py <in_dir> <out_dir> [--sheet sheet.jpg] [--only a,b,c]

No AI, just image arithmetic (OpenCV + NumPy):
  1. skin: YCrCb skin colour, closed and hole-filled so the ink inside the limb counts as limb;
     the largest components are kept and eroded so limb edges, floor and clothes drop out;
  2. skin tone: a smooth estimate of the bare skin under the ink (normalised convolution of
     the skin-coloured, un-inked pixels), in Lab;
  3. ink: how much darker (L) or more coloured (a/b) each pixel is than that skin estimate;
     purple stencil lines are suppressed;
  4. output: the ink printed on a soft-edged bone silhouette of the design (no rectangle, no arm),
     cropped to the design, max 900 px, WebP with alpha. The alpha-only ink mask is written too.
"""
import sys, os, argparse
import numpy as np
import cv2

BONE = np.array([225, 232, 238], np.float32)  # BGR of #eee8e1


def smooth_fill(val, w, sigma):
    """Normalised convolution: average of val over pixels with weight w, everywhere."""
    num = cv2.GaussianBlur(val * w, (0, 0), sigma)
    den = cv2.GaussianBlur(w, (0, 0), sigma)
    return num / np.maximum(den, 1e-4)


def fill_holes(mask):
    """fill enclosed holes; the flood starts from a zero border so a mask touching a corner is safe"""
    pad = cv2.copyMakeBorder(mask, 1, 1, 1, 1, cv2.BORDER_CONSTANT, value=0)
    h, w = pad.shape
    ff = pad.copy()
    cv2.floodFill(ff, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 255)
    return (pad | cv2.bitwise_not(ff))[1:-1, 1:-1]


def extract(bgr):
    h0, w0 = bgr.shape[:2]
    s = 900 / max(h0, w0)
    if s < 1:
        bgr = cv2.resize(bgr, (round(w0 * s), round(h0 * s)), interpolation=cv2.INTER_AREA)
    h, w = bgr.shape[:2]
    U = max(h, w) / 100.0  # 1% of the long side

    ycc = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)
    Y, Cr, Cb = [ycc[..., i].astype(np.float32) for i in range(3)]
    skin_col = ((Cr > 136) & (Cr < 178) & (Cb > 80) & (Cb < 130) & (Y > 70)).astype(np.uint8) * 255
    skin_col = cv2.morphologyEx(skin_col, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5)))

    # the limb: skin colour closed over the ink, holes filled, biggest pieces kept
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(7 * U) | 1, int(7 * U) | 1))
    limb = cv2.morphologyEx(skin_col, cv2.MORPH_CLOSE, k)
    limb = fill_holes(limb)
    n, lab_cc, stats, _ = cv2.connectedComponentsWithStats(limb, 8)
    keep = np.zeros_like(limb)
    if n > 1:
        areas = stats[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        for i, a in enumerate(areas, 1):
            if a > 0.25 * big and a > 0.03 * h * w:
                keep[lab_cc == i] = 255
    limb = cv2.erode(keep, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.2 * U) | 1, int(2.2 * U) | 1)))

    lab = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)
    L, A, B = lab[..., 0] * (100 / 255), lab[..., 1] - 128, lab[..., 2] - 128

    # bare skin estimate under the ink: skin-coloured, not dark, smooth over large scales
    wsk = ((skin_col > 0) & (limb > 0)).astype(np.float32)
    sig = 4.5 * U
    Ls = smooth_fill(L, wsk, sig)
    As = smooth_fill(A, wsk, sig)
    Bs = smooth_fill(B, wsk, sig)

    dark = np.clip((Ls - L) / np.maximum(Ls, 1) / 0.78, 0, 1)
    chroma = np.sqrt((A - As) ** 2 + (B - Bs) ** 2)
    colour = np.clip((chroma - 16) / 26, 0, 1)
    purple = ((A > 6) & (B < -6)).astype(np.float32)  # stencil ink
    ink = np.maximum(np.clip((dark - 0.09) / 0.5, 0, 1) ** 0.85, colour)
    ink *= 1 - 0.85 * purple
    ink = cv2.medianBlur((ink * 255).astype(np.uint8), 3).astype(np.float32) / 255
    soft_limb = cv2.GaussianBlur(limb.astype(np.float32) / 255, (0, 0), 1.2 * U)
    ink *= soft_limb

    # the design's silhouette: a die-cut margin hugging the ink (a sticker, not the limb)
    core = (ink > 0.3).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    n, lab_cc, stats, _ = cv2.connectedComponentsWithStats(core, 8)
    clean = np.zeros_like(core)
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] >= 2.5 * U * U:
            clean[lab_cc == i] = 255
    sil = cv2.dilate(clean, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.4 * U) | 1, int(2.4 * U) | 1)))
    sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.2 * U) | 1, int(2.2 * U) | 1)))
    sil = fill_holes(sil)
    n, lab_cc, stats, _ = cv2.connectedComponentsWithStats(sil, 8)
    if n > 1:
        big = stats[1:, cv2.CC_STAT_AREA].max()
        keep = np.zeros_like(sil)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] >= 0.2 * big:
                keep[lab_cc == i] = 255
        sil = keep
    silf = cv2.GaussianBlur(sil.astype(np.float32) / 255, (0, 0), 0.45 * U)
    ink *= np.clip(silf * 1.3, 0, 1)  # nothing outside the cut

    # colour of the ink itself: unmix the skin out where the ink is strong, neutral elsewhere
    skin_bgr = cv2.cvtColor(np.dstack([Ls * 255 / 100, As + 128, Bs + 128]).clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2BGR).astype(np.float32)
    px = bgr.astype(np.float32)
    a3 = np.clip(ink, 0.25, 1)[..., None]
    ink_col = np.clip((px - (1 - a3) * skin_bgr) / a3, 0, 255)
    grey = ink_col.mean(axis=2, keepdims=True)
    keep_col = np.clip(colour * 1.4, 0, 1)[..., None]  # only real colour ink keeps its hue
    ink_col = grey * (1 - keep_col) + ink_col * keep_col
    ink_col = np.minimum(ink_col, 70 + 0 * ink_col) * (1 - keep_col) + ink_col * keep_col  # black/grey ink stays ink

    out_rgb = BONE * (1 - ink[..., None]) + ink_col * ink[..., None]
    out_a = np.maximum(silf * 0.94, ink)
    # a design the photo cut off dissolves towards the frame instead of ending on a straight edge
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy)).astype(np.float32)
    out_a *= np.clip(edge / (4 * U), 0, 1) ** 1.5

    ys, xs = np.where(out_a > 0.04)
    if len(xs) < 50:
        return None
    pad = int(2 * U)
    x0, x1 = max(0, xs.min() - pad), min(w, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(h, ys.max() + pad)
    rgba = np.dstack([out_rgb, out_a[..., None] * 255]).clip(0, 255).astype(np.uint8)[y0:y1, x0:x1]
    stats_ = {"cover": float((out_a > 0.5).mean()), "ink": float(ink.mean()), "bbox": (x1 - x0) / w * (y1 - y0) / h}
    return rgba, stats_


def preview(rgba, size=260):
    """bone-on-ink preview, like the hero will show it"""
    h, w = rgba.shape[:2]
    s = size / max(h, w)
    r = cv2.resize(rgba, (max(1, round(w * s)), max(1, round(h * s))), interpolation=cv2.INTER_AREA).astype(np.float32)
    canvas = np.full((size, size, 3), (11, 10, 11), np.float32)
    oy, ox = (size - r.shape[0]) // 2, (size - r.shape[1]) // 2
    a = r[..., 3:4] / 255
    canvas[oy:oy + r.shape[0], ox:ox + r.shape[1]] = canvas[oy:oy + r.shape[0], ox:ox + r.shape[1]] * (1 - a) + r[..., :3] * a
    return canvas.astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("out")
    ap.add_argument("--sheet")
    ap.add_argument("--only")
    ap.add_argument("--orig", action="store_true", help="put the source photo next to each result in the sheet")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    names = sorted(f for f in os.listdir(a.src) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    if a.only:
        want = set(a.only.split(","))
        names = [n for n in names if os.path.splitext(n)[0] in want]
    tiles = []
    for n in names:
        bgr = cv2.imread(os.path.join(a.src, n), cv2.IMREAD_COLOR)
        if bgr is None:
            continue
        r = extract(bgr)
        if r is None:
            print("skip", n)
            continue
        rgba, st = r
        stem = os.path.splitext(n)[0]
        cv2.imwrite(os.path.join(a.out, stem + ".webp"), rgba, [cv2.IMWRITE_WEBP_QUALITY, 86])
        print(f"{stem}\tcover={st['cover']:.3f}\tink={st['ink']:.3f}\tbbox={st['bbox']:.2f}")
        if a.sheet:
            t = preview(rgba)
            if a.orig:
                o = cv2.resize(bgr, (round(bgr.shape[1] * 260 / bgr.shape[0]), 260))
                o = o[:, :260] if o.shape[1] >= 260 else cv2.copyMakeBorder(o, 0, 0, 0, 260 - o.shape[1], cv2.BORDER_CONSTANT)
                t = np.hstack([o, t])
            cv2.putText(t, stem[-14:], (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (60, 60, 255), 1, cv2.LINE_AA)
            tiles.append(t)
    if a.sheet and tiles:
        cols = 6 if not a.orig else 4
        tw = tiles[0].shape[1]
        rows = [tiles[i:i + cols] for i in range(0, len(tiles), cols)]
        rows = [np.hstack(r + [np.zeros_like(tiles[0])] * (cols - len(r))) for r in rows]
        cv2.imwrite(a.sheet, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 85])


if __name__ == "__main__":
    main()
