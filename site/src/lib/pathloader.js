// Path loader — a loading screen where a light travels along an SVG path (a
// skyline, a logo outline, a route, a signature…) as the site's media streams
// in, byte-accurately. The page is gated: nothing scrolls until 100%, which is
// what makes every later scrub smooth — the whole film is already in memory.
//
// Markup contract (see starter/index.html):
//   <div id="loader" class="loader">
//     <p id="loader-line"></p>                    optional rotating sentence
//     <svg viewBox="0 0 1000 150">
//       <defs><path id="loader-path" pathLength="100" d="…"/></defs>
//       <use href="#loader-path" class="path-base"/>
//       <use href="#loader-path" class="path-glow" id="loader-glow"/>
//       <use href="#loader-path" class="path-lit"  id="loader-lit"/>
//       <circle id="loader-led-halo" r="10"/><circle id="loader-led" r="3.5"/>
//     </svg>
//     <span id="loader-pct">0%</span>
//   </div>
//
// pathLength="100" normalises the dash maths: stroke-dashoffset 100 → 0 reveals
// the lit path from start to end regardless of the path's real length.

export function runPathLoader(getTarget, isSettled, opts = {}) {
  const {
    lines = [],            // sentences rotated while loading (brand mantras, promises…)
    lineEvery = 2800,      // ms per sentence
    ease = 0.12,           // how fast the shown value chases the real progress
    minMs = 900,           // keep the loader on screen at least this long (warm cache)
  } = opts;
  const $ = (id) => document.getElementById(id);
  const lit = $("loader-lit"), glow = $("loader-glow"), led = $("loader-led"),
        halo = $("loader-led-halo"), pctEl = $("loader-pct"), path = $("loader-path");
  const pathLen = path.getTotalLength();
  const t0 = performance.now();
  let shown = 0;

  const lineEl = $("loader-line");
  let lineTimer = null;
  if (lineEl && lines.length) {
    let li = 0;
    lineEl.textContent = lines[0];
    lineEl.style.opacity = "1";
    lineTimer = setInterval(() => {
      lineEl.style.opacity = "0";
      setTimeout(() => {
        li = (li + 1) % lines.length;
        lineEl.textContent = lines[li];
        lineEl.style.opacity = "1";
      }, 380);
    }, lineEvery);
  }

  return new Promise((resolve) => {
    const tick = () => {
      const target = Math.max(0, Math.min(1, getTarget()));
      shown += (target - shown) * ease;
      if (isSettled() && shown > 0.992 && performance.now() - t0 > minMs) shown = 1;
      const off = 100 - shown * 100;
      lit.style.strokeDashoffset = off;
      if (glow) glow.style.strokeDashoffset = off;
      const p = path.getPointAtLength(Math.min(1, shown) * pathLen);
      led.setAttribute("cx", p.x); led.setAttribute("cy", p.y);
      if (halo) { halo.setAttribute("cx", p.x); halo.setAttribute("cy", p.y); }
      if (pctEl) pctEl.textContent = `${Math.min(100, Math.round(shown * 100))}%`;
      if (shown >= 1) {
        if (lineTimer) clearInterval(lineTimer);
        $("loader").classList.add("done");
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Byte-tracked fetch for the loader gate. Streams `url`, mirrors progress into
// entry { got, total, est } and resolves with the Blob (null on failure — the
// entry is closed out either way so the bar can still reach 100%).
export async function fetchTracked(url, entry) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    entry.total = +res.headers.get("Content-Length") || entry.est;
    let blob;
    if (res.body) {
      const reader = res.body.getReader();
      const chunks = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        entry.got += value.length;
      }
      blob = new Blob(chunks);
    } else {
      blob = await res.blob();
    }
    entry.total = blob.size || entry.total;
    entry.got = entry.total;
    return blob;
  } catch {
    entry.got = entry.total = entry.total || entry.est;
    return null;
  }
}

// Progress aggregator used by both pages: images are count-weighted (one image
// ≈ imgBytes of bar), streams are byte-weighted, and the result is monotonic so
// a late-arriving Content-Length never walks the bar backwards.
export function makeGate(imgBytes = 150_000) {
  let imgDone = 0, imgTotal = 0, maxTarget = 0, settled = false;
  const streams = [];
  const jobs = [];
  const gate = {
    streams,
    image(img) {
      imgTotal++;
      jobs.push((img.complete ? Promise.resolve() : new Promise((r) => { img.onload = r; img.onerror = r; }))
        .then(() => { imgDone++; }));
    },
    stream(est) { const s = { got: 0, total: 0, est }; streams.push(s); return s; },
    job(promise) { jobs.push(promise); },
    target() {
      let got = imgDone * imgBytes, total = imgTotal * imgBytes;
      for (const s of streams) { got += s.got; total += s.total || s.est; }
      maxTarget = Math.max(maxTarget, total ? got / total : 1);
      return maxTarget;
    },
    settled: () => settled,
    start() { Promise.all(jobs).then(() => { settled = true; }); },
  };
  return gate;
}
