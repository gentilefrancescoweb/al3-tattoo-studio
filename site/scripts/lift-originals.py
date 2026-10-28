"""Sgt. Zippo's own drawings (folder ../assets/da zippo, supplied by the owner in round 8) as the site's first designs.

    python -I scripts/lift-originals.py

For each drawing (sorted by file name → z01, z02, …; the AL3 badge is skipped) writes
  public/ink/<id>.webp (≤ 560 px) + public/ink/h/<id>.webp (≤ 384 px)   the floating sticker
  public/works/<id>.webp (≤ 1080 px) + public/works/<id>_s.webp (480 w) the drawing itself, for the archive
and src/designs.js (ids, titles, aspect). Then rebuilds src/ink-aspect.js.

Three kinds of drawing, set per file in KIND:
  paper  on white / cream paper: the same die-cut sticker as the AI redraws (lift-redraws.py), paper → bone;
  card   a framed flash card: the card itself, cropped from its margin, with rounded corners;
  dark   on black: cut out around the design, its colours kept.
"""
import os, sys, json, importlib.util, subprocess
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE); ROOT = os.path.dirname(SITE)
SRC = os.path.join(ROOT, "assets", "da zippo")
spec = importlib.util.spec_from_file_location("lift_redraws", os.path.join(HERE, "lift-redraws.py"))
lr = importlib.util.module_from_spec(spec); spec.loader.exec_module(lr)

# by position in the sorted folder (1-based), checked by eye against the drawings
SKIP = {21}  # the AL3 badge: the studio's mark, not a design
KIND = {1: "card", 2: "card", 5: "card", 6: "card", 7: "card", 20: "dark"}
TITLE = {
    1: "Fiore rosso tra le foglie", 2: "Rose · turchese", 3: "Oni con katana", 4: "Samurai", 5: "Rose · rosso",
    6: "Caricatura", 7: "Pesce combattente", 8: "Rose e filigrana rossa", 9: "Tigre", 10: "Gru e ornamenti",
    11: "Ornamentale", 12: "Teschio ornamentale", 13: "Gufo e luna", 14: "Ornamentale · linea", 15: "Loto",
    16: "Lanterna", 17: "Mon cher", 18: "Gatto samurai", 19: "Mano e mela", 20: "Rosa e spine", 22: "Rosa rossa",
}


def card(bgr):
    """the card: everything that differs from the outer margin, cropped, rounded corners"""
    h, w = bgr.shape[:2]
    U = max(h, w) / 100
    r = max(2, int(1.2 * U))
    ring = np.concatenate([bgr[:r].reshape(-1, 3), bgr[-r:].reshape(-1, 3), bgr[:, :r].reshape(-1, 3), bgr[:, -r:].reshape(-1, 3)]).astype(np.float32)
    g0, spread = np.median(ring, 0), ring.std(0).mean()
    if spread > 30:  # full bleed: the whole image is the card
        x0, y0, x1, y1 = 0, 0, w, h
    else:
        d = np.linalg.norm(bgr.astype(np.float32) - g0, axis=2)
        m = (d > 30).astype(np.uint8)
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((int(U) | 1, int(U) | 1), np.uint8))
        n, cc, st, _ = cv2.connectedComponentsWithStats(m, 8)
        i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        x0, y0, bw, bh = st[i, :4]
        x1, y1 = x0 + bw, y0 + bh
    im = bgr[y0:y1, x0:x1]
    ch, cw = im.shape[:2]
    rad = int(min(ch, cw) * 0.035)
    a = np.zeros((ch * 4, cw * 4), np.uint8)
    R = rad * 4
    cv2.rectangle(a, (R, 0), (cw * 4 - R, ch * 4), 255, -1); cv2.rectangle(a, (0, R), (cw * 4, ch * 4 - R), 255, -1)
    for cx, cy in ((R, R), (cw * 4 - R, R), (R, ch * 4 - R), (cw * 4 - R, ch * 4 - R)):
        cv2.circle(a, (cx, cy), R, 255, -1)
    a = cv2.resize(a, (cw, ch), interpolation=cv2.INTER_AREA)
    return np.dstack([im, a]), im


def dark(bgr):
    """on black: the design's own pixels inside a die-cut silhouette; the rim stays black"""
    h0, w0 = bgr.shape[:2]
    s = lr.WORK / max(h0, w0)
    if s < 1:
        bgr = cv2.resize(bgr, (round(w0 * s), round(h0 * s)), interpolation=cv2.INTER_AREA)
    h, w = bgr.shape[:2]
    U = max(h, w) / 100
    core = (bgr.max(axis=2) > 40).astype(np.uint8) * 255
    core = cv2.morphologyEx(core, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    sil = cv2.dilate(core, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(1.6 * U) | 1, int(1.6 * U) | 1)))
    sil = cv2.morphologyEx(sil, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (int(2.6 * U) | 1, int(2.6 * U) | 1)))
    sil = lr.fill_holes(sil)
    a = cv2.GaussianBlur(sil.astype(np.float32) / 255, (0, 0), 0.4 * U)
    ys, xs = np.where(a > 0.04)
    pad = int(1.5 * U)
    x0, x1, y0, y1 = max(0, xs.min() - pad), min(w, xs.max() + pad), max(0, ys.min() - pad), min(h, ys.max() + pad)
    return np.dstack([bgr, (a * 255).astype(np.uint8)])[y0:y1, x0:x1]


def save_photo(im, path, long_side=None, width=None):
    h, w = im.shape[:2]
    s = (long_side / max(h, w)) if long_side else (width / w)
    if s < 1:
        im = cv2.resize(im, (round(w * s), round(h * s)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(path, im, [cv2.IMWRITE_WEBP_QUALITY, 84])


if __name__ == "__main__":
    files = sorted(f for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp")))
    ink = os.path.join(SITE, "public", "ink"); works = os.path.join(SITE, "public", "works")
    os.makedirs(os.path.join(ink, "h"), exist_ok=True)
    out = []
    for k, f in enumerate(files, 1):
        wid = f"z{k:02d}"
        bgr = cv2.imread(os.path.join(SRC, f), cv2.IMREAD_COLOR)
        if k in SKIP:  # the badge: no sticker, not in the designs; its tiles serve the Stili lettering chapter (round 8)
            save_photo(bgr, os.path.join(works, wid + ".webp"), long_side=1080)
            save_photo(bgr, os.path.join(works, wid + "_s.webp"), width=480)
            continue
        kind = KIND.get(k, "paper")
        if kind == "card":
            st, photo = card(bgr)
        elif kind == "dark":
            st, photo = dark(bgr), bgr
        else:
            st, photo = lr.lift(bgr), bgr
        st = lr.padded(st)
        cv2.imwrite(os.path.join(ink, wid + ".webp"), lr.fit(st, 560), [cv2.IMWRITE_WEBP_QUALITY, 88])
        cv2.imwrite(os.path.join(ink, "h", wid + ".webp"), lr.fit(st, 384), [cv2.IMWRITE_WEBP_QUALITY, 86])
        save_photo(photo, os.path.join(works, wid + ".webp"), long_side=1080)
        save_photo(photo, os.path.join(works, wid + "_s.webp"), width=480)
        out.append({"id": wid, "t": TITLE.get(k, "Disegno originale"), "kind": kind})
        print(wid, kind, f)
    open(os.path.join(SITE, "src", "designs.js"), "w", encoding="utf8").write(
        "// GENERATED by scripts/lift-originals.py: Sgt. Zippo's own drawings (assets/da zippo), first everywhere designs show\n"
        "export const DESIGNS = " + json.dumps(out, ensure_ascii=False) + ";\n")
    subprocess.run([sys.executable, "-I", os.path.join(HERE, "ink-aspect.py")], check=True)
