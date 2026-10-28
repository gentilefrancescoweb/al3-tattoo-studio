"""The Studio Space's media (owner, round 8: "use the video and the pictures in the 'al3 studio' folder"):
his phone walk through the studio (8.7 s, 720×1280, one take) and three photos of it.

    python -I scripts/studio-space.py

Reads assets/al3 studio/. Writes
  public/frames/studio.pack + .json   the walk as a scroll-scrub frame strip (scripts/bake.mjs: 540 px wide, 16 fps,
                                      q5 ≈ 6.4 MB; the source is a WhatsApp video, 540 px holds all its detail)
  public/space/walk_m.mp4             phones: the same walk as a muted loop (540 px, crf 27, no audio)
  public/space/walk-poster.webp       its first frame, under the canvas until the strip has loaded
  public/space/{parete,vinili,serpente}.webp (+ _s)   the photos, 1080 / 640 px tall
"""
import os, subprocess, glob
from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__)); SITE = os.path.dirname(HERE); ROOT = os.path.dirname(SITE)
SRC = os.path.join(ROOT, "assets", "al3 studio")
OUT = os.path.join(SITE, "public", "space")
os.makedirs(OUT, exist_ok=True)
VIDEO = glob.glob(os.path.join(SRC, "*.mp4"))[0]
PHOTOS = {  # by file time: the red shelf wall, the vinyl wall with the tiger print, the framed gold snake
    "17.05.03": "parete", "17.05.31": "vinili", "17.09.34": "serpente",
}

subprocess.run(["node", os.path.join(HERE, "bake.mjs"), "--src", VIDEO, "--name", "studio", "--width", "540", "--fps", "16",
                "--q", "5", "--out", os.path.join(SITE, "public", "frames")], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", VIDEO, "-an", "-vf", "scale=540:-2,fps=30", "-c:v", "libx264", "-profile:v", "main",
                "-crf", "27", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", os.path.join(OUT, "walk_m.mp4")], check=True)
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", VIDEO, "-frames:v", "1", "-vf", "scale=540:-2", "-c:v", "libwebp", "-quality", "82",
                os.path.join(OUT, "walk-poster.webp")], check=True)

for f in sorted(os.listdir(SRC)):
    name = next((v for k, v in PHOTOS.items() if k in f), None)
    if not name:
        continue
    im = ImageOps.exif_transpose(Image.open(os.path.join(SRC, f))).convert("RGB")
    for h, suffix, q in ((1080, "", 84), (640, "_s", 80)):
        w = round(im.width * h / im.height)
        im.resize((w, h), Image.LANCZOS).save(os.path.join(OUT, f"{name}{suffix}.webp"), quality=q, method=6)
    print(name, im.size)
