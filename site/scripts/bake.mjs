#!/usr/bin/env node
// Bake one film (mp4/mov) into a scroll-scrub frame strip: <name>.pack + <name>.json
//
//   node bake.mjs --src film.mp4 --name ch01 [--width 1280] [--fps 18] [--q 4] [--out public/frames]
//
// .pack  = concatenated JPEGs; .json = { frames, width, height, offsets[] } with a
// sentinel end offset, so frame i is bytes offsets[i]..offsets[i+1]. One request
// per film instead of 100+ image requests, and FrameStrip slices it with zero copies.
//
// Tuning that held up in production:
//   fps 18        ≈ 100 frames for a 5.5s loop — reads continuous when scrubbed
//   width 1280    desktop canvases cover-fit; 1600 only if the subject is small
//   q 4           ffmpeg -qscale:v (2 = best … 7 = smallest). Aim ≤ 12 MB per pack;
//                 a bright, detailed scene can hit 14 MB at q4 — raise q to 5-6.
// Requires ffmpeg on PATH or FFMPEG env var pointing at the binary.

import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > -1 ? process.argv[i + 1] : d; };
const SRC = arg("src"), NAME = arg("name");
if (!SRC || !NAME) { console.error("usage: bake.mjs --src film.mp4 --name key [--width 1280] [--fps 18] [--q 4] [--out dir]"); process.exit(1); }
const WIDTH = +arg("width", 1280), FPS = +arg("fps", 18), Q = +arg("q", 4), OUT = arg("out", ".");
const FF = process.env.FFMPEG || "ffmpeg";

const tmp = join(tmpdir(), `bake_${NAME}`);
rmSync(tmp, { recursive: true, force: true });
mkdirSync(tmp, { recursive: true });
mkdirSync(OUT, { recursive: true });

const r = spawnSync(FF, ["-y", "-i", SRC, "-vf", `fps=${FPS},scale=${WIDTH}:-2`, "-qscale:v", String(Q), join(tmp, "f_%04d.jpg")], { stdio: ["ignore", "ignore", "pipe"] });
if (r.status !== 0) { console.error(r.stderr?.toString().split("\n").slice(-6).join("\n")); process.exit(1); }

const frames = readdirSync(tmp).filter((f) => f.endsWith(".jpg")).sort();
if (!frames.length) { console.error("no frames extracted"); process.exit(1); }

// JPEG dimensions from the SOF marker of the first frame (no image library needed)
function jpegSize(buf) {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return { width: 0, height: 0 };
}

const chunks = [], offsets = [];
let pos = 0;
for (const f of frames) {
  const b = readFileSync(join(tmp, f));
  offsets.push(pos); chunks.push(b); pos += b.length;
}
offsets.push(pos);
const { width, height } = jpegSize(chunks[0]);
writeFileSync(join(OUT, `${NAME}.pack`), Buffer.concat(chunks));
writeFileSync(join(OUT, `${NAME}.json`), JSON.stringify({ frames: frames.length, width, height, offsets }));
const mb = (statSync(join(OUT, `${NAME}.pack`)).size / 1048576).toFixed(2);
console.log(`${NAME}: ${frames.length} frames ${width}x${height} -> ${mb} MB`);
if (mb > 14) console.warn(`  ${NAME} is heavy — rebake with --q ${Q + 1} or a smaller --width`);
rmSync(tmp, { recursive: true, force: true });
