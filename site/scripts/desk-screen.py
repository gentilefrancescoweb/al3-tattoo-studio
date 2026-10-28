"""The desk photo (supplied by the owner, round 7) with tattoo sketches on its left, landscape screen
(the one that shows a game in the photo; the owner chose it, round 7b). Every other screen stays as shot.

    python -I scripts/desk-screen.py

Reads ../assets/process/desk-source.jpg and the redraws in ../assets/redraws. Writes
  public/process/desk.webp        the photo, its left screen showing the owl sketch (static fallback);
  public/process/sk/canvas.webp   Procreate as he uses it (Italian UI): top bar, brush sidebar, a portrait
                                  canvas on the dark workspace, the Livelli panel open (1280×720, 16:9);
  public/process/sk/<id>-u.webp   red/blue pencil construction for each design (alpha, half size);
  public/process/sk/<id>-i.webp   the graphite linework over it (alpha);
  src/desk-screen.js              the screen's corners in photo pixels and each design's box on the sheet,
                                  so the page can lay the live sketches over the photo (CSS matrix3d).

The screen is not segmented at run time: its four edges were measured once on the photo (the game's
picture against the near-black bezel, brightness profiles across each edge) and are fixed below. Nothing
stands in front of it. The first sketch is his owl, z13, the design the process act turns into the tattoo next.
"""
import os, json
import numpy as np
import cv2
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE); ROOT = os.path.dirname(SITE)
SRC = os.path.join(ROOT, "assets", "process", "desk-source.jpg")
REDRAWS = os.path.join(ROOT, "assets", "redraws")
OUT = os.path.join(SITE, "public", "process")
SKETCHES = ["z13", "z12", "z11", "z14", "z10"]  # his owl first (the process act tattoos it next), then his line drawings (round 8)
DRAWINGS = os.path.join(SITE, "public", "works")  # zNN: his drawings on white, written by lift-originals.py
SW, SH = 1280, 720
BAR = 44                              # Procreate's top bar
PAPER = (318, 62, 802, 706)           # the portrait canvas (3:4) on the workspace, x0, y0, x1, y1
LAYERS = (896, 54, 1262, 352)         # the open Livelli popover
FONT = "C:/Windows/Fonts/segoeui.ttf"; FONT_B = "C:/Windows/Fonts/segoeuib.ttf"  # nearest to SF Pro on Windows

# the left screen's edges on the 2000×1125 photo (where the picture meets the bezel)
LEFT = (-0.0143, 70.1)     # x = k*y + c
RIGHT = (-0.0145, 648.5)
TOPL = (0.0900, 363.5)     # y = k*x + c
BOTL = (-0.1350, 875.25)


def meet_v_h(v, h):  # x = a*y + b  ∩  y = c*x + d
    a, b = v; c, d = h
    x = (a * d + b) / (1 - a * c)
    return (x, c * x + d)


BLEED = 1.0  # px past each fitted edge, so no sliver of the game survives the antialiasing
LEFT, RIGHT = (LEFT[0], LEFT[1] - BLEED), (RIGHT[0], RIGHT[1] + BLEED)
TOPL, BOTL = (TOPL[0], TOPL[1] - BLEED), (BOTL[0], BOTL[1] + BLEED)
QUAD = [meet_v_h(LEFT, TOPL), meet_v_h(RIGHT, TOPL), meet_v_h(RIGHT, BOTL), meet_v_h(LEFT, BOTL)]


def paper_grain(h, w, seed, amp=4.0):
    rng = np.random.default_rng(seed)
    n = cv2.GaussianBlur(rng.normal(0, 1, (h, w)).astype(np.float32), (0, 0), 1.1)
    return n / (n.std() + 1e-6) * amp


def text(img, xy, txt, size, fill, bold=False, anchor="la"):
    from PIL import ImageDraw, ImageFont
    pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
    ImageDraw.Draw(pil).text(xy, txt, font=ImageFont.truetype(FONT_B if bold else FONT, size), fill=fill, anchor=anchor)
    return cv2.cvtColor(np.asarray(pil), cv2.COLOR_RGB2BGR)


def icons(img):
    """Procreate's top-bar tools as line icons: actions, adjustments, selection, transform | brush, smudge, eraser, layers, colour"""
    W_, aa, cy = (236, 236, 238), cv2.LINE_AA, BAR // 2
    # wrench
    x = 122
    cv2.line(img, (x - 7, cy + 7), (x + 3, cy - 3), W_, 2, aa); cv2.ellipse(img, (x + 5, cy - 5), (5, 5), 0, 60, 330, W_, 2, aa)
    # magic wand
    x = 160
    cv2.line(img, (x - 8, cy + 8), (x + 4, cy - 4), W_, 2, aa)
    for dx, dy in ((7, -9), (9, -2), (2, -10)):
        cv2.circle(img, (x + dx, cy + dy), 1, W_, -1, aa)
    # selection (S ribbon)
    x = 198
    cv2.ellipse(img, (x, cy - 4), (6, 4), 0, 0, 270, W_, 2, aa); cv2.ellipse(img, (x, cy + 4), (6, 4), 0, 180, 450, W_, 2, aa)
    # transform (arrow cursor)
    x = 234
    pts = np.int32([[x - 5, cy - 9], [x + 6, cy + 1], [x + 1, cy + 2], [x + 4, cy + 8], [x + 1, cy + 9], [x - 2, cy + 3], [x - 5, cy + 6]])
    cv2.polylines(img, [pts], True, W_, 2, aa)
    # right group
    x = SW - 230  # brush (active: Procreate tints the selected tool blue)
    blue = (255, 140, 40)
    cv2.line(img, (x - 7, cy + 8), (x + 6, cy - 6), blue, 3, aa); cv2.circle(img, (x - 7, cy + 8), 3, blue, -1, aa)
    x = SW - 190  # smudge
    cv2.ellipse(img, (x, cy), (4, 10), 35, 0, 360, W_, 2, aa)
    x = SW - 150  # eraser
    box = cv2.boxPoints(((x, cy), (9, 20), 40)).astype(np.int32)
    cv2.polylines(img, [box], True, W_, 2, aa)
    x = SW - 110  # layers
    cv2.rectangle(img, (x - 8, cy - 6), (x + 4, cy + 6), W_, 2, aa); cv2.rectangle(img, (x - 4, cy - 10), (x + 8, cy + 2), W_, 2, aa)
    x = SW - 62   # colour: the ink in use
    cv2.circle(img, (x, cy), 13, (34, 30, 33), -1, aa); cv2.circle(img, (x, cy), 14, (210, 210, 214), 2, aa)
    return img


def canvas_img():
    c = np.zeros((SH, SW, 3), np.float32)
    c[:] = (40, 38, 38)  # Procreate's dark workspace
    px0, py0, px1, py1 = PAPER
    # the canvas: warm paper with grain and a hairline shadow on the workspace
    shadow = np.zeros((SH, SW), np.float32)
    shadow[py0 + 4:py1 + 4, px0 + 2:px1 + 6] = 1
    shadow = cv2.GaussianBlur(shadow, (0, 0), 6)[..., None]
    c = c * (1 - 0.45 * shadow)
    c[py0:py1, px0:px1] = (230, 236, 241)
    c[py0:py1, px0:px1] += paper_grain(py1 - py0, px1 - px0, 7, 3.0)[..., None]
    c[:BAR] = (24, 23, 23)
    img = np.clip(c, 0, 255).astype(np.uint8)
    aa = cv2.LINE_AA
    # sidebar: brush size, the modify square, opacity, undo / redo
    sb = (14, 176, 50, 560)
    cv2.rectangle(img, (sb[0], sb[1]), (sb[2], sb[3]), (52, 50, 50), -1, aa)
    for (y0, y1, t) in ((sb[1] + 10, 352, 0.42), (392, sb[3] - 10, 0.78)):
        cv2.rectangle(img, (sb[0] + 7, y0), (sb[2] - 7, y1), (82, 80, 80), -1, aa)
        ty = int(y0 + (y1 - y0) * t)
        cv2.rectangle(img, (sb[0] + 4, ty - 9), (sb[2] - 4, ty + 9), (236, 236, 238), -1, aa)
    cv2.rectangle(img, (sb[0] + 8, 362), (sb[2] - 8, 382), (120, 118, 118), 2, aa)
    for k, y in enumerate((592, 632)):  # undo, redo
        cv2.ellipse(img, (32, y), (9, 8), 0, 200 if k == 0 else -20, 360 if k == 0 else 160, (220, 220, 222), 2, aa)
        tip = (23, y - 3) if k == 0 else (41, y - 3)
        cv2.line(img, tip, (tip[0] + (5 if k == 0 else -5), tip[1] - 4), (220, 220, 222), 2, aa)
    # Livelli popover: Linee (selected, blue), Bozza, Colore di sfondo
    lx0, ly0, lx1, ly1 = LAYERS
    cv2.rectangle(img, (lx0 + 3, ly0 + 5), (lx1 + 3, ly1 + 6), (14, 13, 13), -1, aa)
    cv2.rectangle(img, (lx0, ly0), (lx1, ly1), (48, 46, 46), -1, aa)
    tri = np.int32([[SW - 118, ly0 - 8], [SW - 128, ly0 + 1], [SW - 108, ly0 + 1]])
    cv2.fillPoly(img, [tri], (48, 46, 46), aa)
    rows = [("Linee", True, "lines"), ("Bozza", False, "sketch"), ("Colore di sfondo", False, "bg")]
    for k, (name, sel, kind) in enumerate(rows):
        ry = ly0 + 58 + k * 74
        if sel:
            cv2.rectangle(img, (lx0 + 10, ry), (lx1 - 10, ry + 66), (232, 120, 32), -1, aa)
        th = (lx0 + 22, ry + 9, lx0 + 22 + 48, ry + 9 + 48)
        cv2.rectangle(img, (th[0], th[1]), (th[2], th[3]), (238, 240, 242) if kind != "bg" else (230, 236, 241), -1, aa)
        if kind == "lines":
            for j in range(6):
                cv2.line(img, (th[0] + 10 + j * 5, th[1] + 8), (th[0] + 16 + j * 3, th[3] - 8), (40, 36, 42), 1, aa)
        elif kind == "sketch":
            cv2.ellipse(img, ((th[0] + th[2]) // 2, (th[1] + th[3]) // 2), (14, 18), 0, 0, 360, (90, 80, 210), 1, aa)
        cv2.rectangle(img, (lx1 - 44, ry + 23), (lx1 - 24, ry + 43), (236, 236, 238), 2, aa)  # visibility box
        cv2.line(img, (lx1 - 40, ry + 33), (lx1 - 35, ry + 38), (236, 236, 238), 2, aa)
        cv2.line(img, (lx1 - 35, ry + 38), (lx1 - 27, ry + 28), (236, 236, 238), 2, aa)
        img = text(img, (th[2] + 16, ry + 33), name, 17, (255, 255, 255), False, "lm")
        img = text(img, (lx1 - 66, ry + 33), "N", 16, (240, 240, 240) if sel else (170, 170, 172), True, "mm")
    img = text(img, (lx0 + 16, ly0 + 26), "Livelli", 20, (255, 255, 255), True, "lm")
    img = text(img, (lx1 - 22, ly0 + 26), "+", 26, (255, 255, 255), False, "mm")
    img = text(img, (18, BAR // 2 + 1), "Galleria", 17, (240, 240, 242), False, "lm")
    return icons(img)


def place(design):
    """fit the redraw inside the paper with a margin; return the grey design on white, sheet-sized"""
    g = cv2.cvtColor(design, cv2.COLOR_BGR2GRAY)
    ys, xs = np.where(g < 235)
    g = g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    px0, py0, px1, py1 = PAPER
    bw, bh = (px1 - px0) - 64, (py1 - py0) - 64
    s = min(bw / g.shape[1], bh / g.shape[0])
    g = cv2.resize(g, (max(1, round(g.shape[1] * s)), max(1, round(g.shape[0] * s))), interpolation=cv2.INTER_AREA)
    out = np.full((SH, SW), 255, np.uint8)
    y0 = py0 + ((py1 - py0) - g.shape[0]) // 2; x0 = px0 + ((px1 - px0) - g.shape[1]) // 2
    out[y0:y0 + g.shape[0], x0:x0 + g.shape[1]] = g
    return out, (x0, y0, g.shape[1], g.shape[0])


def sketch_layers(grey, box, seed):
    f = grey.astype(np.float32) / 255
    # graphite: pencil-dodge outlines + a light tone where the drawing is dark
    inv = 1 - f
    dodge = np.clip(f / np.maximum(1 - cv2.GaussianBlur(inv, (0, 0), 5) * 0.985, 1e-3), 0, 1)
    lines = 1 - dodge
    tone = inv * 0.42 * (0.75 + 0.25 * (paper_grain(SH, SW, seed, 1.0) > 0))
    a_ink = np.clip(lines * 1.6 + tone, 0, 1) ** 0.85
    a_ink[a_ink < 0.04] = 0
    ink = np.dstack([np.full((SH, SW), 41), np.full((SH, SW), 37), np.full((SH, SW), 43), a_ink * 255]).astype(np.uint8)
    # red pencil construction: the big shapes, loose and a little off the final line
    g2 = cv2.GaussianBlur((f * 255).astype(np.uint8), (0, 0), 3.2)
    edges = cv2.Canny(g2, 25, 70)
    M = np.float32([[1.012, 0, -4], [0, 1.012, -9]])
    edges = cv2.warpAffine(edges, M, (SW, SH))
    a_red = cv2.GaussianBlur(cv2.dilate(edges, np.ones((2, 2), np.uint8)).astype(np.float32) / 255, (0, 0), 0.8) * 0.55
    under = np.zeros((SH, SW, 4), np.float32)
    under[..., :3] = (62, 52, 206)
    under[..., 3] = a_red
    # blue guides: a centre line and two ellipses around the design, as a tattooer blocks it in
    x0, y0, w, h = box
    guide = np.zeros((SH, SW), np.uint8)
    cx, cy = x0 + w // 2, y0 + h // 2
    cv2.line(guide, (cx, max(PAPER[1] + 6, y0 - 22)), (cx, min(PAPER[3] - 6, y0 + h + 22)), 255, 2, cv2.LINE_AA)
    cv2.ellipse(guide, (cx, int(y0 + h * 0.36)), (int(w * 0.46), int(h * 0.3)), 0, 0, 360, 255, 2, cv2.LINE_AA)
    cv2.ellipse(guide, (cx, int(y0 + h * 0.68)), (int(w * 0.38), int(h * 0.26)), 0, 0, 360, 255, 2, cv2.LINE_AA)
    a_blue = guide.astype(np.float32) / 255 * 0.32
    blue = np.array([214, 140, 70], np.float32)
    keep = a_blue > under[..., 3]
    under[..., :3] = np.where(keep[..., None], blue, under[..., :3])
    under[..., 3] = np.maximum(under[..., 3], a_blue)
    under[..., 3] *= 255
    return under.astype(np.uint8), ink


def over(base, layer):
    a = layer[..., 3:4].astype(np.float32) / 255
    return base * (1 - a) + layer[..., :3].astype(np.float32) * a


if __name__ == "__main__":
    os.makedirs(os.path.join(OUT, "sk"), exist_ok=True)
    canvas = canvas_img()
    cv2.imwrite(os.path.join(OUT, "sk", "canvas.webp"), canvas, [cv2.IMWRITE_WEBP_QUALITY, 90])
    first, boxes = None, []
    for k, sid in enumerate(SKETCHES):
        grey, box = place(cv2.imread(os.path.join(DRAWINGS if sid.startswith("z") else REDRAWS, sid + ".webp"), cv2.IMREAD_COLOR))
        under, ink = sketch_layers(grey, box, 11 + k)
        boxes.append([round(box[0] / SW, 4), round(box[1] / SH, 4), round(box[2] / SW, 4), round(box[3] / SH, 4)])
        half = cv2.resize(under, (SW // 2, SH // 2), interpolation=cv2.INTER_AREA)  # soft pencil: half size is plenty
        for name, layer in ((f"{sid}-u.webp", half), (f"{sid}-i.webp", ink)):
            Image.fromarray(cv2.cvtColor(layer, cv2.COLOR_BGRA2RGBA)).save(
                os.path.join(OUT, "sk", name), quality=82, alpha_quality=80, method=6)
        if first is None:
            first = over(over(canvas.astype(np.float32), under), ink)

    # the static photo: grade the sheet like a lit screen in that room, warp it onto the panel
    photo = cv2.imread(SRC, cv2.IMREAD_COLOR).astype(np.float32)
    H, W = photo.shape[:2]
    yy, xx = np.mgrid[0:SH, 0:SW].astype(np.float32)
    vig = 1 - 0.07 * (((xx / SW - 0.5) ** 2 + (yy / SH - 0.5) ** 2) * 2.2)
    gloss = 1 + 0.035 * np.clip(1 - (xx / SW + yy / SH), 0, 1)
    sheet = first * np.array([1.0, 0.93, 0.955], np.float32) * (vig * gloss)[..., None]
    # shrink to about panel size first (area filter), then warp: no aliasing in the fine linework
    small = cv2.resize(sheet, (600, 338), interpolation=cv2.INTER_AREA)
    Hs = cv2.getPerspectiveTransform(np.float32([[0, 0], [600, 0], [600, 338], [0, 338]]), np.float32(QUAD))
    warped = cv2.warpPerspective(small, Hs, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    warped = cv2.GaussianBlur(warped, (0, 0), 0.55)
    warped += np.random.default_rng(3).normal(0, 2.6, warped.shape).astype(np.float32)
    # the panel, antialiased at 4×
    big = np.zeros((H * 4, W * 4), np.uint8)
    cv2.fillPoly(big, [np.int32(np.array(QUAD) * 4)], 255, cv2.LINE_AA)
    mask = cv2.resize(big, (W, H), interpolation=cv2.INTER_AREA).astype(np.float32)[..., None] / 255
    out = photo * (1 - mask) + warped * mask
    # the paper is brighter than the game it replaces: a faint white spill around the panel
    glow = cv2.GaussianBlur(warped * mask, (0, 0), 26)
    out = 255 - (255 - out) * (1 - glow / 255 * 0.08 * (1 - mask))
    cv2.imwrite(os.path.join(OUT, "desk.webp"), np.clip(out, 0, 255).astype(np.uint8), [cv2.IMWRITE_WEBP_QUALITY, 84])

    meta = {"w": W, "h": H, "quad": [[round(x, 1), round(y, 1)] for x, y in QUAD], "sheet": [SW, SH],
            "sketches": SKETCHES, "boxes": boxes}
    open(os.path.join(SITE, "src", "desk-screen.js"), "w", encoding="utf8").write(
        "// GENERATED by scripts/desk-screen.py: the left screen of /process/desk.webp (photo pixels) and each\n"
        "// design's box on the 1280×720 sheet (fractions)\nexport const DESK = " + json.dumps(meta) + ";\n")
    print(meta)
