// FrameStrip — scroll-scrubbed film playback from a baked frame pack.
//
// A "strip" is two files produced by scripts/bake.mjs:
//   /frames/<name>.pack  concatenated JPEG frames (one HTTP request, cacheable)
//   /frames/<name>.json  { frames, width, height, offsets[] }  (offsets has frames+1 entries)
//
// Scroll progress (0..1) maps to an exact frame index which is drawn to a canvas
// SYNCHRONOUSLY when the frame is already decoded. Never defer the paint to
// requestAnimationFrame: rAF is paused in hidden tabs and in occluded preview
// panes, and a deferred first paint leaves a blank canvas until the user moves.
// Frames are decoded lazily with createImageBitmap on a Blob slice and kept in
// a small LRU so memory stays flat even for 100+ frame packs.

export class FrameStrip {
  constructor(name, base = "/frames/") {
    this.name = name;
    this.base = base;
    this.meta = null;
    this.blob = null;
    this.cache = new Map(); // frame index -> ImageBitmap
    this.cacheOrder = [];
    this.maxCache = 48;
    this.pending = new Map();
    this.lastDrawn = -1;
    this.lastP = 0;
    this.direction = 1;
    this.ready = false;
    this.onReady = null;
  }

  // onProgress(fraction, gotBytes, totalBytes) is called as the pack streams in,
  // so a loader can show byte-accurate progress. Falls back to a plain blob read
  // when the response has no readable body or no Content-Length.
  async load(onProgress) {
    const [metaRes, packRes] = await Promise.all([
      fetch(`${this.base}${this.name}.json`),
      fetch(`${this.base}${this.name}.pack`),
    ]);
    if (!metaRes.ok || !packRes.ok) throw new Error(`strip ${this.name} missing`);
    this.meta = await metaRes.json();
    const totalBytes = +packRes.headers.get("Content-Length") || 0;
    if (onProgress && totalBytes && packRes.body) {
      const reader = packRes.body.getReader();
      const chunks = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        got += value.length;
        onProgress(Math.min(1, got / totalBytes), got, totalBytes);
      }
      this.blob = new Blob(chunks, { type: "application/octet-stream" });
    } else {
      this.blob = await packRes.blob();
    }
    if (onProgress) onProgress(1, this.blob.size, this.blob.size);
    this.ready = true;
    if (this.onReady) this.onReady();
    return this;
  }

  frameCount() { return this.meta ? this.meta.frames : 0; }

  async decode(i) {
    if (this.cache.has(i)) return this.cache.get(i);
    if (this.pending.has(i)) return this.pending.get(i);
    const { offsets } = this.meta;
    const p = createImageBitmap(this.blob.slice(offsets[i], offsets[i + 1], "image/jpeg"))
      .then((bmp) => {
        this.cache.set(i, bmp);
        this.cacheOrder.push(i);
        while (this.cacheOrder.length > this.maxCache) {
          const old = this.cacheOrder.shift();
          if (old !== i && this.cache.has(old)) {
            this.cache.get(old).close();
            this.cache.delete(old);
          }
        }
        this.pending.delete(i);
        return bmp;
      })
      .catch(() => { this.pending.delete(i); return null; });
    this.pending.set(i, p);
    return p;
  }

  nearestCached(i) {
    if (this.cache.has(i)) return i;
    for (let d = 1; d < this.meta.frames; d++) {
      if (this.cache.has(i - d)) return i - d;
      if (this.cache.has(i + d)) return i + d;
    }
    return -1;
  }

  // decode ahead in the current scroll direction so the next frames are instant
  prefetch(i) {
    for (let k = 1; k <= 10; k++) {
      const j = i + k * this.direction;
      if (j >= 0 && j < this.meta.frames && !this.cache.has(j)) this.decode(j);
    }
  }

  // draw progress p (0..1) cover-fit. Synchronous if cached; otherwise paints the
  // nearest cached frame now and the exact one when its decode lands.
  draw(canvas, ctx, p) {
    if (!this.ready) return;
    this.lastP = p;
    const n = this.meta.frames;
    const i = Math.max(0, Math.min(n - 1, Math.round(p * (n - 1))));
    if (i !== this.lastDrawn) this.direction = i > this.lastDrawn ? 1 : -1;
    const paint = (bmp) => {
      if (!bmp) return;
      const cw = canvas.width, ch = canvas.height;
      const s = Math.max(cw / bmp.width, ch / bmp.height);
      const dw = bmp.width * s, dh = bmp.height * s;
      ctx.drawImage(bmp, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };
    if (this.cache.has(i)) {
      paint(this.cache.get(i));
      this.lastDrawn = i;
    } else {
      const near = this.nearestCached(i);
      if (near >= 0) paint(this.cache.get(near));
      this.decode(i).then((bmp) => {
        // repaint only if this frame is still the CURRENT target — compare
        // against live lastP, not the progress captured at request time
        const cur = Math.max(0, Math.min(n - 1, Math.round(this.lastP * (n - 1))));
        if (bmp && Math.abs(cur - i) <= 1) { paint(bmp); this.lastDrawn = i; }
      });
    }
    this.prefetch(i);
  }

  // decode the first frames so entering the act is instant
  async warm(count = 8) {
    const jobs = [];
    for (let i = 0; i < Math.min(count, this.meta.frames); i++) jobs.push(this.decode(i));
    await Promise.all(jobs);
  }
}
