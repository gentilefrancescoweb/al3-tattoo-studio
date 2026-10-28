#!/usr/bin/env bash
# Builds site/public media from the raw Instagram downloads (kept outside the project).
#   RAW=<folder with mix/ and raw/> bash scripts/prep-media.sh
# mix/mix_NN.jpg = one frame per shot of the "Mix" reel (720x1280), raw/*.jpg = post covers + profile images.
set -euo pipefail
RAW="${RAW:?set RAW to the download folder}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public"
mkdir -p "$OUT/works" "$OUT/studio" "$OUT/brand" "$OUT/process"

# works: every portfolio frame listed in src/data.js
for n in 01 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 28 29 30 31 32 33 34 35 36 37 39 40 42 43 44; do
  ffmpeg -v error -y -i "$RAW/mix/mix_$n.jpg" -vf "scale=720:1280" -c:v libwebp -quality 80 "$OUT/works/w$n.webp"
  ffmpeg -v error -y -i "$RAW/mix/mix_$n.jpg" -vf "scale=360:640:flags=lanczos" -c:v libwebp -quality 74 "$OUT/works/w${n}_s.webp"
done

# process act: his owl, design → tattoo (round 8): scripts/owl-process.py, from assets/process/owl-*.jpg

# studio: post covers (360x640)
cp_webp() { ffmpeg -v error -y -i "$RAW/raw/$1.jpg" -c:v libwebp -quality 86 "$OUT/studio/$2.webp"; }
cp_webp zip_post_13 vvv-red
cp_webp zip_post_14 vvv-virescit
cp_webp zip_post_15 vvv-blue
cp_webp zip_post_19 zippo-at-work
cp_webp al3_post_15 zippo-neon
cp_webp zip_post_12 bulldog
cp_webp zip_post_09 walkin-poster
cp_webp zip_post_17 tokyo
cp_webp zip_hl_07 jewel

# brand: profile pictures (150 px) — the mark is never redrawn
# the mark is no longer the 150 px profile picture: scripts/logo-cutout.py cuts it from the owner's file (round 7)
ffmpeg -v error -y -i "$RAW/raw/zip_profile_00.jpg" -c:v libwebp -quality 95 "$OUT/brand/rose.webp"
ffmpeg -v error -y -i "$RAW/raw/zip_hl_05.jpg" -c:v libwebp -quality 92 "$OUT/brand/zippo-portrait.webp"
python "$(dirname "$0")/owl-process.py"
echo "media ready in $OUT"
