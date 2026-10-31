// AL3 Tattoo Studio — wiring. Acts: 0 loader (the crack) → 1 tunnel hero →
// 2 process scrub (the owl) → 3 styles stage → 4 archive → walk-in → 5 studio.
//
// Engineering rules kept from the immersive-scroll-film-site skill:
//  - shared state is declared BEFORE any trigger wiring (onUpdate fires inside create())
//  - paints driven by scroll are synchronous; rAF only for time-based motion
//  - Lenis owns scroll: programmatic moves go through lenis.scrollTo (window.__lenis for QA)
//  - ScrollTrigger.refresh() only on WIDTH changes (phone URL bars fire height resizes)
//  - pinned triggers are created in DOCUMENT ORDER
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { makeGate } from "./lib/pathloader.js";
import { createTunnel } from "./hero.js";
import { createProcess } from "./process.js";
import { createDesk } from "./desk.js";
import { createViperRail } from "./vrail.js";
import { createInkLayer, createMachine, tattooTitle, stencilHeadings, buildDrips } from "./fx.js";
import { createBadge } from "./badge.js";
import { STUDIO, waLink, LOADER_LINES, STYLES, STYLE_LABEL, WORKS, PROCESS, WALKIN, SNAKES, SPACE, PRIVACY_UPDATED } from "./data.js";
import { FrameStrip } from "./lib/framestrip.js";
import { FEED, MIX_INK } from "./catalogue.js";
import { INK_ASPECT } from "./ink-aspect.js";
import { DESIGNS } from "./designs.js";

gsap.registerPlugin(ScrollTrigger);

/* ── shared state, declared first ─────────────────────────── */
const MOBILE = window.innerWidth < 760;
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const FINE = !MOBILE && matchMedia("(pointer: fine)").matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// pinned acts are CSS sticky (round 8 mobile pass): the section is one screen plus its scroll length, the stage sticks.
// The compositor holds a sticky stage exactly under the finger; a JS pin switches to fixed a frame late on phones (the jump)
const stickyLength = (el, screens) => { el.style.height = `${100 + screens}vh`; el.style.height = `${100 + screens}svh`; };
const navH = () => $("#nav").offsetHeight;
const gate = makeGate(120_000);
let tunnel = null, proc = null;
let lightboxOpen = () => {};
let processDrawing = false; // the owl is being tattooed right now (drives the machine's buzz)
let fxInk = null, fxMachine = null, badge = null;
const SNAKE_SET = new Set(SNAKES);
// his own drawings (assets/da zippo, round 8): first wherever designs show; in the archive under "Disegni"
const DRAWINGS = DESIGNS.map((d) => ({ id: d.id, file: d.id, style: "disegno", year: null, title: d.t, ink: true, design: true }));
// the whole archive: 2026 reel frames (titled) first, then the feed, newest first; the drawings at the end ("Tutti" skips them)
const ARCHIVE = [
  ...WORKS.map((w) => ({ id: w.id, file: `w${w.id}`, style: w.style, year: 2026, title: w.t, ink: MIX_INK.includes(w.id) })),
  ...FEED.map((f) => ({ id: f.id, file: f.id, style: f.style, year: f.year, title: null, ink: f.ink })),
  ...DRAWINGS,
];
const TATTOOS = ARCHIVE.filter((w) => !w.design);
// the AL3 badge from his folder: not one of the designs, only a card in the Stili lettering chapter
const BADGE_TILE = { id: "z21", file: "z21", style: "lettering", title: "AL3 Tattoo Studio, il marchio", design: true };
const label = (w) => w.title || `${STYLE_LABEL[w.style]} · ${w.year}`;
const altText = (w) => `${STYLE_LABEL[w.style]} — ${w.title || `lavoro del ${w.year}`}`;
// open a design from the hero or the wall: browse only the designs that fly there (owner, round 9: the arrows showed
// photos on skin), his drawings as full sheets, tattoos on their lifted design ("Sulla pelle" still shows one's photo)
const openDesign = (id, list) => {
  const l = list || POOL;
  lightboxOpen(l, l.findIndex((w) => w.id === id), true, true);
};
// hero pool: the strongest designs first (they are gated by the loader), then the rest shuffled
const LEAD = ["33", "a175", "14", "a298", "16", "a094", "a303", "17", "a020", "a432", "a355", "a097", "a427", "a184", "a077", "a663", "a392", "a009"];
const POOL = (() => {
  const inked = TATTOOS.filter((w) => w.ink);
  const lead = LEAD.map((id) => inked.find((w) => w.id === id)).filter(Boolean);
  const rest = inked.filter((w) => !lead.includes(w));
  let seed = 2024;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]]; }
  return [...DRAWINGS, ...lead, ...rest].map((w) => ({ ...w, src: `/ink/${w.file}.webp`, hsrc: `/ink/h/${w.file}.webp` }));
})();
let applyFilter = () => {};

document.body.classList.add("loading");
if (!REDUCED) document.body.classList.add("motion");
if (FINE) document.documentElement.classList.add("has-cursor");

/* ── Lenis + ScrollTrigger bridge ─────────────────────────── */
const lenis = new Lenis({ smoothWheel: !REDUCED, lerp: 0.1 });
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
lenis.stop();
window.__lenis = lenis;

/* ── Rome time: clock + live open/closed status ───────────── */
function romeNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    timeZone: STUDIO.zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday),
    min: +parts.hour * 60 + +parts.minute, hh: parts.hour, mm: parts.minute,
  };
}
const fmtT = ([h, m]) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
const toMin = ([h, m]) => h * 60 + m;
function studioStatus() {
  const n = romeNow();
  const sp = STUDIO.specials.find((s) => s.date === n.date);
  const open = sp ? sp.open : STUDIO.hours.days.includes(n.wd) ? STUDIO.hours.open : null;
  const close = sp ? sp.close : STUDIO.hours.close;
  if (open && n.min >= toMin(open) && n.min < toMin(close)) {
    return { open: true, text: `Aperto ora · fino alle ${fmtT(close)}${sp ? ` · ${sp.label}` : ""}` };
  }
  if (open && n.min < toMin(open)) return { open: false, text: `Chiuso · apre oggi alle ${fmtT(open)}` };
  const names = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
  for (let k = 1; k <= 7; k++) {
    const d = (n.wd + k) % 7;
    if (STUDIO.hours.days.includes(d)) return { open: false, text: `Chiuso · riapre ${k === 1 ? "domani" : names[d]} alle ${fmtT(STUDIO.hours.open)}` };
  }
  return { open: false, text: "Chiuso" };
}
function liveInfo() {
  const tick = () => {
    const s = studioStatus();
    $$("[data-status]").forEach((el) => { el.classList.toggle("open", s.open); el.lastElementChild.textContent = s.text; });
  };
  tick();
  setInterval(tick, 30_000);
}

/* ── Act 0: the crack loader ──────────────────────────────── */
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// midpoint displacement: a crack that wanders but always crosses the screen
function crackPoints(rnd, a, b, levels, disp, jx = 0.3) {
  let s = [a, b];
  for (let l = 0; l < levels; l++) {
    const o = [s[0]];
    for (let i = 0; i < s.length - 1; i++) {
      const p = s[i], q = s[i + 1];
      o.push([(p[0] + q[0]) / 2 + (rnd() - 0.5) * disp * jx, (p[1] + q[1]) / 2 + (rnd() - 0.5) * disp], q);
    }
    s = o; disp *= 0.56;
  }
  return s;
}
const toD = (pts) => "M" + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L");

function runLoader() {
  const loader = $("#loader");
  const rnd = mulberry32(2024); // GOOD HABITS · SINCE 2024
  const pts = crackPoints(rnd, [-20, 540], [1020, 455], 7, 150);
  const d = toD(pts);
  $("#crack-base").setAttribute("d", d);
  const lit = $("#crack-lit");
  lit.setAttribute("d", d);
  const branches = $("#crack-branches");
  for (let k = 0; k < 8; k++) {
    const i = Math.floor(pts.length * (0.1 + 0.8 * rnd()));
    const from = pts[i];
    const to = [from[0] + (rnd() - 0.5) * 160, from[1] + (rnd() < 0.5 ? -1 : 1) * (50 + rnd() * 130)];
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", toD(crackPoints(rnd, from, to, 4, 40, 0.5)));
    p.setAttribute("vector-effect", "non-scaling-stroke");
    branches.appendChild(p);
  }
  // the two halves of the screen, cut along the same crack
  const poly = (list) => list.map((p) => `${(p[0] / 10).toFixed(2)}% ${(p[1] / 10).toFixed(2)}%`).join(", ");
  $(".lp-top").style.clipPath = `polygon(0% 0%, 100% 0%, ${poly([...pts].reverse())})`;
  $(".lp-bot").style.clipPath = `polygon(${poly(pts)}, 100% 100%, 0% 100%)`;

  const lineEl = $("#loader-line");
  let li = 0;
  lineEl.textContent = LOADER_LINES[0];
  const lineTimer = setInterval(() => {
    lineEl.style.opacity = "0";
    setTimeout(() => { li = (li + 1) % LOADER_LINES.length; lineEl.textContent = LOADER_LINES[li]; lineEl.style.opacity = "1"; }, 380);
  }, 2600);

  const needle = $("#needle"), pct = $("#loader-pct");
  const len = lit.getTotalLength();
  const t0 = performance.now();
  let shown = 0;
  return new Promise((resolve) => {
    const tick = () => {
      const late = performance.now() - t0 > 14_000; // never hold a visitor hostage to one slow file
      const target = late ? 1 : gate.target();
      shown += (target - shown) * 0.09;
      if ((gate.settled() || late) && shown > 0.992 && performance.now() - t0 > 1400) shown = 1;
      lit.style.strokeDashoffset = (100 - shown * 100).toFixed(2);
      const p = lit.getPointAtLength(Math.min(1, shown) * len);
      needle.style.left = `${p.x / 10}%`;
      needle.style.top = `${p.y / 10}%`;
      pct.textContent = `${Math.min(100, Math.round(shown * 100))}%`;
      if (shown >= 1) {
        clearInterval(lineTimer);
        loader.classList.add("lit");
        setTimeout(() => { loader.classList.add("split"); resolve(); }, REDUCED ? 150 : 560);
        setTimeout(() => loader.classList.add("gone"), REDUCED ? 600 : 2000);
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/* ── Act 1: hero tunnel ───────────────────────────────────── */
function actHero() {
  tunnel = createTunnel($("#tunnel"), {
    pool: POOL, mobile: MOBILE, reduced: REDUCED, gate, gateFirst: MOBILE ? 14 : 24,
    onPick: (item) => openDesign(item.id),
    onHover: (on) => { $(".cursor").classList.toggle("hot", on); $("#tunnel").style.cursor = on ? "pointer" : ""; },
  });
  gsap.ticker.add(() => tunnel.frame(performance.now()));
  const copy = $("#hero-copy");
  ScrollTrigger.create({
    trigger: ".hero", start: "top top", end: "bottom bottom",
    onUpdate: (self) => {
      const p = self.progress;
      tunnel.setScroll(p);
      // fly through the title at its original pace, however long the tunnel has grown (it is gone well before the end)
      const q = Math.min(1, p * 4.2);
      copy.classList.toggle("past", q > 0.4); // faded: the badge stops catching the pointer, the tunnel gets it back
      badge?.visible(q < 0.5);
      copy.style.transform = `translate3d(0, ${(-q * 6).toFixed(2)}vh, 0) scale(${(1 + q * 0.55).toFixed(4)})`;
      copy.style.opacity = clamp01(1 - q * 1.9).toFixed(3);
    },
  });
  // render only while the hero is on screen
  ScrollTrigger.create({ trigger: ".hero", start: "top bottom", end: "bottom top", onToggle: (self) => tunnel.setActive(self.isActive) });
  $("#scroll-cue").addEventListener("click", () => lenis.scrollTo("#postazione", { duration: 1.8 }));
}

/* ── Act 2: the owl, from his design to the healed tattoo, by scroll ── */
let desk;
/* ── Act 1b: la postazione — sketches on the central screen, scroll pushes into it ── */
function actDesk() {
  const section = $("#postazione");
  desk = createDesk(section, { mobile: MOBILE, reduced: REDUCED, gate });
  desk.fit();
  ScrollTrigger.create({ trigger: section, start: "top 160%", end: "bottom -60%", onToggle: (s) => { if (s.isActive) desk.near(); desk.toggle(s.isActive); } });
  ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", scrub: 0.5, onUpdate: (s) => desk.set(s.progress), onRefresh: () => desk.fit() });
}

function actProcess() {
  proc = createProcess($("#process-canvas"), { mobile: MOBILE, gate });
  const tagsHost = $("#process-tags"), stepsHost = $("#process-steps"), bar = $("#process-bar");
  const tags = PROCESS.map((s) => {
    const el = document.createElement("div");
    const flip = s.dot[0] > 0.5; // labels on the right half grow leftwards, inside the plate
    el.className = "ptag" + (flip ? " flip" : "");
    if (flip) el.style.right = `${(1 - s.dot[0]) * 100}%`; else el.style.left = `${s.dot[0] * 100}%`;
    el.style.top = `${s.dot[1] * 100}%`;
    el.innerHTML = `<span class="dot"></span><span class="line"></span><span class="txt">${s.t}</span>`;
    tagsHost.appendChild(el);
    return el;
  });
  const steps = PROCESS.map((s) => {
    const el = document.createElement("div");
    el.className = "pstep";
    el.innerHTML = `<h3>${s.t}</h3><p>${s.line}</p>`;
    stepsHost.appendChild(el);
    return el;
  });
  const RAMP = 0.035;
  // the owl starts drawing while the plate scrolls in (round 9): the act no longer opens on a blank sheet.
  // The pin then runs from P0 to 1, so the plate, the tags and the step copy stay in step.
  const P0 = 0.09;
  let curP = 0;
  const plate = $("#process-plate");
  // the plate stays still while it is tattooed (owner, round 8: no tremor); only the buzz follows the scroll
  if (!REDUCED) gsap.ticker.add(() => {
    if (!fxMachine?.on) { processDrawing = false; return; } // the check reads layout: only when the buzz can be heard
    processDrawing = curP > 0.01 && curP < 0.86 && ScrollTrigger.isInViewport?.(plate) !== false && Math.abs(lenis.velocity || 0) > 0.05;
  });
  let curPin = 0;
  const paint = (pin) => {
    const p = P0 + pin * (1 - P0);
    curP = p; curPin = pin;
    proc.set(p);
    bar.style.transform = `scaleX(${pin.toFixed(3)})`;
    PROCESS.forEach((s, k) => {
      const inA = k === 0 ? 1 : (p - s.a) / RAMP;
      const outB = k === PROCESS.length - 1 ? 1 : (s.b - p) / RAMP;
      const o = clamp01(Math.min(inA, outB));
      steps[k].style.opacity = o.toFixed(3);
      steps[k].style.transform = `translateY(${((1 - o) * 14).toFixed(1)}px)`;
      steps[k].style.pointerEvents = o > 0.5 ? "auto" : "none";
      steps[k].style.visibility = o > 0.001 ? "visible" : "hidden"; // the stacked steps that are out are gone, not just transparent
      tags[k].style.opacity = o.toFixed(3);
      tags[k].querySelector(".line").style.transform = `scaleX(${o.toFixed(3)})`;
    });
  };
  paint(0);
  proc.set(0); // blank until the plate comes in; the pre-roll below draws the first lines
  ScrollTrigger.create({
    trigger: "#processo", start: "top bottom", end: "top top", scrub: 0.6,
    onUpdate: (self) => { if (curPin <= 0) proc.set(self.progress * P0); }, // the pin's own paint wins once it has started
  });
  stickyLength($("#processo"), MOBILE ? 420 : 520);
  ScrollTrigger.create({
    trigger: "#processo", start: "top top", end: "bottom bottom", scrub: 0.6,
    onUpdate: (self) => paint(self.progress),
    onRefresh: () => proc.fit(),
  });
}

/* ── Act 2b: The Studio Space — his walk through the studio, scrubbed by scroll (round 8, replaces the Vipera band) ── */
function actSpace() {
  const stage = $("#space-stage"), win = $("#space-window"), canvas = $("#space-film"), amb = $("#space-amb"), tag = $("#space-tag");
  $("#space-line").textContent = SPACE.line;
  const stopsHost = $("#space-stops");
  stopsHost.innerHTML = SPACE.stops.map((s) => `<li>${s.t}</li>`).join("");
  const stopEls = $$("li", stopsHost);
  $("#space-photos").innerHTML = SPACE.photos.map((p, i) =>
    `<figure class="space-photo p${i}" style="--rot:${p.rot}deg"><img src="/space/${p.file}${MOBILE ? "_s" : ""}.webp" alt="${p.alt}" loading="lazy" /></figure>`).join("");
  const photos = $$(".space-photo", stage).map((el, i) => ({ el, ...SPACE.photos[i] }));
  const actx = amb.getContext("2d");
  let cur = -1;
  const setStop = (f) => { // the stop the walk has reached
    let k = 0;
    SPACE.stops.forEach((s, i) => { if (f >= s.at) k = i; });
    if (k === cur) return;
    cur = k;
    stopEls.forEach((li, i) => li.classList.toggle("on", i === k));
    tag.textContent = SPACE.stops[k].t;
  };
  setStop(0);
  const poster = $(".space-poster", win);
  // the ambient copy: drawn small, softened and darkened in the canvas itself; the browser's upscale does the rest
  // (a CSS blur on a full-screen layer re-ran on every scroll frame)
  if ("filter" in actx) actx.filter = "blur(1.2px) saturate(0.8)";
  const ambFrom = (src) => {
    try { actx.drawImage(src, 0, 0, amb.width, amb.height); } catch (e) { return; /* not decoded yet */ }
    actx.save(); actx.filter = "none"; actx.fillStyle = "rgba(11, 10, 11, .4)"; actx.fillRect(0, 0, amb.width, amb.height); actx.restore();
  };
  if (poster.complete) ambFrom(poster); else poster.addEventListener("load", () => ambFrom(poster), { once: true });

  if (MOBILE) { // phones: no pin, no frame pack; the walk loops in the window while it is on screen, the stops follow it
    const video = document.createElement("video");
    Object.assign(video, { muted: true, loop: true, playsInline: true, preload: "none", poster: "/space/walk-poster.webp" });
    video.setAttribute("muted", ""); video.setAttribute("playsinline", ""); video.setAttribute("aria-hidden", "true");
    win.insertBefore(video, canvas);
    canvas.remove();
    if (REDUCED) video.controls = true; // no autoplay: the visitor starts it
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!video.src) video.src = "/space/walk_m.mp4";
        if (!REDUCED) video.play().catch(() => {});
      } else video.pause();
    }, { rootMargin: "120px 0px" }).observe(win);
    video.addEventListener("timeupdate", () => setStop(video.currentTime / (video.duration || 8.7)));
    return;
  }

  const ctx = canvas.getContext("2d");
  const strip = new FrameStrip("studio");
  let film = 0, loading = false;
  const paint = () => {
    if (!strip.ready) return;
    strip.draw(canvas, ctx, film);
    ambFrom(canvas);
  };
  const fit = () => {
    const r = win.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    paint();
  };
  const load = () => { // the 6 MB pack streams in when the area comes near, never behind the loader; the poster covers until then
    if (loading) return;
    loading = true;
    strip.load().then(() => strip.warm(12)).then(() => { fit(); win.classList.add("ready"); }).catch(() => { loading = false; });
  };
  const render = (p) => {
    film = clamp01((p - 0.03) / 0.9);
    paint();
    setStop(film);
    photos.forEach((ph) => {
      ph.el.style.setProperty("--in", clamp01((film - ph.at) / 0.1).toFixed(3));
      ph.el.style.setProperty("--dy", `${((0.5 - p) * ph.drift).toFixed(1)}px`);
    });
    win.style.setProperty("--z", (1.04 - p * 0.04).toFixed(4));
  };
  render(0);
  stickyLength($("#spazio"), 340);
  ScrollTrigger.create({
    trigger: "#spazio", start: "top top", end: "bottom bottom", scrub: 0.5,
    onUpdate: (self) => { load(); render(self.progress); }, // a jump straight into the walk loads it too
    onRefresh: () => fit(),
  });
  // created after the pin, so its end includes the pinned length; starts the download three screens ahead
  ScrollTrigger.create({ trigger: "#spazio", start: "top 300%", end: "bottom top", onToggle: (s) => { if (s.isActive) load(); } });
  addEventListener("resize", fit);
}

/* ── Act 3: styles — four layers crossfading in one pinned stage ── */
function actStyles() {
  const N = STYLES.length;
  const BLEND = 0.2;
  const glows = $("#ch-glows"), layers = $("#ch-layers"), copies = $("#ch-copies"), rail = $("#ch-rail");
  const layerEls = [], glowEls = [], copyEls = [], railEls = [];
  STYLES.forEach((s, i) => {
    const g = document.createElement("div");
    g.className = "ch-glow";
    g.style.background = `radial-gradient(60% 70% at 64% 50%, ${s.glow}33 0%, transparent 70%)`;
    glows.appendChild(g); glowEls.push(g);

    const l = document.createElement("div");
    l.className = "ch-layer" + (s.trio.length > 3 ? " four" : "") + (s.trio.length > 4 ? " five" : "");
    l.innerHTML = s.trio.map((id, j) => {
      const w = ARCHIVE.find((x) => x.id === id) || BADGE_TILE; // his drawings (zNN), or the badge from his folder
      return `<figure class="ch-card c${j}"><img src="/works/${w.file}${MOBILE && j ? "_s" : ""}.webp" alt="${altText(w)}" /></figure>`;
    }).join("");
    $$("img", l).forEach((img) => gate.image(img));
    layers.appendChild(l); layerEls.push(l);

    const c = document.createElement("div");
    c.className = "ch-copy";
    c.innerHTML = `<h3>${s.name}</h3><p class="kind">${s.kind}</p><p class="line">${s.line}</p>
      <button class="btn btn-ghost" type="button" data-style="${s.key}">Vedi i lavori</button>`;
    copies.appendChild(c); copyEls.push(c);

    const r = document.createElement("button");
    r.type = "button";
    r.innerHTML = `<span>${s.name}</span><i></i>`;
    r.setAttribute("aria-label", `Stile ${s.name}`);
    rail.appendChild(r); railEls.push(r);
  });
  $$(".ch-copy button", copies).forEach((b) => b.addEventListener("click", () => {
    applyFilter(b.dataset.style);
    lenis.scrollTo("#archivio", { offset: 0, duration: 1.6 });
  }));

  const cards = layerEls.map((l) => $$(".ch-card", l).map((el) => ({ el, img: $("img", el) })));
  const segment = (progress) => {
    const seg = Math.min(N - 0.0001, progress * N);
    const i = Math.floor(seg), local = seg - i;
    const pf = Math.min(1, local / (1 - BLEND));
    const a = i < N - 1 && local > 1 - BLEND ? (local - (1 - BLEND)) / BLEND : 0;
    return { i, pf, a, active: a >= 0.5 ? i + 1 : i };
  };
  // card j of a layer: local = progress inside the chapter, enter = −1 leaving up … +1 arriving from below
  const placeCards = (k, local, enter) => {
    const vh = innerHeight / 100;
    cards[k].forEach(({ el, img }, j) => {
      const drift = [(0.5 - local) * 6, (0.5 - local) * -16, (0.5 - local) * 20, (0.5 - local) * -24, (0.5 - local) * 14][j] * vh;
      const rot = [(local - 0.5) * -2, -4 + local * 3, 5 - local * 3, -6 + local * 4, 3 - local * 4][j];
      const sc = j === 0 ? 1 + local * 0.05 : 1;
      const ey = enter * [16, 28, 38, 46, 52][j] * vh;
      el.style.transform = `translate(-50%, -50%) translate3d(0, ${(drift + ey).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${sc.toFixed(4)})`;
      img.style.transform = `scale(${(1.14 - local * 0.1).toFixed(4)})`;
    });
  };
  let lastIdx = -1;
  const render = (progress) => {
    const { i, pf, a, active } = segment(progress);
    layerEls.forEach((l, k) => { l.style.opacity = k === i ? (1 - a).toFixed(3) : k === i + 1 ? a.toFixed(3) : "0"; });
    glowEls.forEach((g, k) => { g.style.opacity = k === i ? (1 - a).toFixed(3) : k === i + 1 ? a.toFixed(3) : "0"; });
    placeCards(i, pf, -a);
    if (a > 0) placeCards(i + 1, 0, 1 - a);
    const split = Math.sin(a * Math.PI) * 10; // his glitch posters: red/blue split while styles swap
    copyEls.forEach((c, k) => {
      // copy hands over at the midpoint (images keep the smooth crossfade): one title on screen at a time
      const o = k === i ? clamp01(1 - a * 2) : k === i + 1 ? clamp01(a * 2 - 1) : 0;
      c.style.opacity = o.toFixed(3);
      // outgoing copy lifts away, incoming rises in: the two titles never sit on top of each other
      c.style.translate = k === i ? `0 ${(-a * 46).toFixed(1)}px` : k === i + 1 ? `0 ${((1 - a) * 46).toFixed(1)}px` : "0 0";
      c.style.pointerEvents = (k === i && a < 0.5) || (k === i + 1 && a >= 0.5) ? "auto" : "none";
      $("h3", c).style.textShadow = split > 0.2 ? `${-split}px 0 rgba(211,23,43,.85), ${split}px 0 rgba(59,124,255,.85)` : ""; // "" = the CSS shadow
    });
    if (active !== lastIdx) {
      lastIdx = active;
      railEls.forEach((r, k) => { r.classList.toggle("active", k === active); r.setAttribute("aria-current", k === active ? "true" : "false"); });
    }
  };
  render(0);
  stickyLength($("#stili"), N * 150);
  const st = ScrollTrigger.create({
    trigger: "#stili", start: "top top", end: "bottom bottom",
    scrub: 0.5, onUpdate: (self) => render(self.progress),
  });
  railEls.forEach((r, i) => r.addEventListener("click", () => {
    lenis.scrollTo(st.start + ((i + 0.03) / N) * (st.end - st.start), { duration: 1.2 });
  }));
}

/* ── Act 3b: The Art Wall — his designs hung on the pegboard, scrolled sideways ── */
function actWall() {
  const track = $("#muro-track");
  // every design he has (owner, round 8): his own drawings first, then the tattoos in a different order from the hero
  const tat = POOL.filter((w) => !w.design);
  const cards = [...POOL.filter((w) => w.design), ...tat.slice(LEAD.length), ...tat.slice(0, LEAD.length)];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  track.innerHTML = cards.map((w) => `<button class="flash" type="button" style="aspect-ratio:${INK_ASPECT[w.file] || 0.8};--r:${((rnd() - 0.5) * 12).toFixed(1)}deg;--dy:${((rnd() - 0.5) * 5).toFixed(1)}vh" data-id="${w.id}" aria-label="${altText(w)}, solo il disegno">
      <img src="${w.hsrc}" alt="" loading="lazy" decoding="async" /></button>`).join("");
  $("#muro-n").textContent = cards.length;
  $$(".flash", track).forEach((b) => b.addEventListener("click", () => openDesign(b.dataset.id, cards))); // in the wall's order
  const dist = () => Math.max(0, track.scrollWidth - innerWidth);
  const PACE = 1.5; // the wall slides 1.5 px per px scrolled: all 109 designs pass without an endless pin
  const muro = $("#muro"); // sticky: one screen plus the slide, measured again before every refresh
  const size = () => { muro.style.height = `${innerHeight + Math.round(dist() / PACE)}px`; };
  size();
  ScrollTrigger.addEventListener("refreshInit", size);
  gsap.to(track, {
    x: () => -dist(), ease: "none",
    scrollTrigger: { trigger: "#muro", start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
  });
}

/* ── Act 4: archive (paged) + lightbox ───────────────────── */
function actArchive() {
  const grid = $("#grid"), filters = $("#filters"), countEl = $("#archive-count"), more = $("#more-btn");
  const PAGE = MOBILE ? 24 : 30;
  const items = ARCHIVE.map((w) => {
    const li = document.createElement("li");
    li.className = "out";
    li.innerHTML = `<button class="tile" type="button" aria-label="${altText(w)}, apri">
      <img src="/works/${w.file}_s.webp" alt="${altText(w)}" loading="lazy" decoding="async" />
      <span class="cap"><small>${STYLE_LABEL[w.style]}</small>${label(w)}</span></button>`;
    grid.appendChild(li);
    return { w, li };
  });
  const keys = [["tutti", "Tutti"], ["disegno", "Disegni"], ["serpenti", "Serpenti"], ...STYLES.map((s) => [s.key, s.name]), ["colore", "Colore"]];
  const btns = keys.map(([k, name]) => {
    const n = k === "tutti" ? TATTOOS.length : k === "serpenti" ? SNAKES.length : ARCHIVE.filter((w) => w.style === k).length;
    const b = document.createElement("button");
    b.type = "button";
    b.dataset.key = k;
    if (k === "serpenti") b.classList.add("f-snake");
    b.setAttribute("aria-pressed", k === "tutti" ? "true" : "false");
    b.innerHTML = `${name}<sup>${n}</sup>`;
    b.addEventListener("click", () => applyFilter(k));
    filters.appendChild(b);
    return b;
  });
  let current = "tutti", shown = PAGE;
  const matching = () => items.filter(({ w }) => (current === "tutti" ? !w.design : current === "serpenti" ? SNAKE_SET.has(w.id) : w.style === current));
  // show the first `shown` matching tiles; tiles that just appeared fade in
  const layout = () => {
    const match = matching();
    const on = new Set(match.slice(0, shown));
    const fresh = [];
    items.forEach((it) => {
      const vis = on.has(it);
      if (vis && it.li.classList.contains("out")) fresh.push(it.li);
      it.li.classList.toggle("out", !vis);
    });
    countEl.textContent = match.length;
    more.hidden = shown >= match.length;
    more.textContent = `Mostra altri ${Math.min(PAGE, match.length - shown)} · ${Math.min(shown, match.length)} di ${match.length}`;
    if (fresh.length) gsap.fromTo(fresh, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, stagger: 0.015, ease: "power2.out", overwrite: true });
    ScrollTrigger.refresh();
  };
  applyFilter = (k) => {
    current = k; shown = PAGE;
    btns.forEach((b) => b.setAttribute("aria-pressed", b.dataset.key === k ? "true" : "false"));
    items.forEach((it) => it.li.classList.add("out"));
    layout();
  };
  more.addEventListener("click", () => { shown += PAGE; layout(); });
  layout();
  // the first page starts loading two screens before the archive (round 9): a jump from the nav no longer lands on empty tiles
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    items.forEach(({ li }) => { if (!li.classList.contains("out")) $("img", li).loading = "eager"; });
  }, { rootMargin: "200% 0px" }).observe(grid);
  items.forEach(({ w, li }) => $("button", li).addEventListener("click", () => {
    const list = matching().map((v) => v.w);
    lightboxOpen(list, list.indexOf(w), false);
  }));

  // lightbox: the photo on skin or, when the design was lifted off the skin, the design alone
  const lb = $("#lightbox"), img = $("#lb-img"), cap = $("#lb-cap"), mode = $("#lb-mode"), fig = $(".lb-fig");
  let list = [], idx = 0, lastFocus = null, inkMode = false, designsOnly = false;
  const show = (i) => {
    if (i !== idx && designsOnly) inkMode = true; // stepping through designs lands on the next design, even after "Sulla pelle"
    idx = (i + list.length) % list.length;
    const w = list[idx];
    const ink = inkMode && w.ink && !w.design; // his drawings show the full sheet
    fig.classList.toggle("ink", ink);
    img.src = ink ? `/ink/${w.file}.webp` : `/works/${w.file}.webp`;
    img.alt = ink ? `${altText(w)}, solo il disegno` : altText(w);
    cap.innerHTML = `<b>${STYLE_LABEL[w.style]}</b>${[w.title, w.year].filter(Boolean).join(" · ")} · ${idx + 1}/${list.length}`;
    mode.hidden = !w.ink || !!w.design; // a drawing has no skin to switch to
    mode.textContent = ink ? "Sulla pelle" : "Solo il disegno";
    mode.setAttribute("aria-pressed", ink ? "true" : "false");
  };
  const close = () => { lb.hidden = true; lenis.start(); lastFocus?.focus?.(); };
  lightboxOpen = (l, i, ink = false, designs = false) => {
    if (!l.length || i < 0) return;
    list = l; inkMode = ink; designsOnly = designs; lastFocus = document.activeElement;
    idx = i; show(i); lb.hidden = false; lenis.stop(); $("#lb-close").focus();
  };
  mode.addEventListener("click", () => { inkMode = !inkMode; show(idx); });
  $("#lb-close").addEventListener("click", close);
  $("#lb-prev").addEventListener("click", () => show(idx - 1));
  $("#lb-next").addEventListener("click", () => show(idx + 1));
  lb.addEventListener("click", (e) => { if (e.target === lb || e.target === fig) close(); });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") show(idx - 1);
    if (e.key === "ArrowRight") show(idx + 1);
  });
  let tx = 0, ty = 0;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.4) show(idx + (dx < 0 ? 1 : -1));
  }, { passive: true });

  gsap.fromTo(".archive-head", { opacity: 0, y: 30 }, { opacity: 1, y: 0, scrollTrigger: { trigger: "#archivio", start: "top 75%", end: "top 35%", scrub: true } });
}

/* ── event: Halloween walk-in, hidden after the date ──────── */
function actWalkin() {
  if (romeNow().date >= WALKIN.until) return;
  $("#walkin").hidden = false;
  $("#walkin-chip").hidden = false;
  $("#menu-walkin").hidden = false;
  $("#walkin-date").textContent = WALKIN.date;
  $("#walkin-hours").textContent = WALKIN.hours;
  $("#walkin-text").textContent = WALKIN.text;
}

/* ── Act 5: studio — the VVV crack draws itself in gold ───── */
function actStudio() {
  const rnd = mulberry32(5);
  const pts = crackPoints(rnd, [-10, 120], [410, 470], 6, 120, 0.4);
  const path = $("#vvv-crack-path");
  path.setAttribute("d", toD(pts));
  path.setAttribute("pathLength", "100");
  gsap.fromTo(path, { strokeDashoffset: 100 }, { strokeDashoffset: 0, ease: "none", scrollTrigger: { trigger: "#vvv", start: "top 80%", end: "bottom 45%", scrub: true } });
  if (!REDUCED) {
    gsap.fromTo(".vvv-1", { y: 50 }, { y: -40, ease: "none", scrollTrigger: { trigger: "#vvv", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.fromTo(".vvv-3", { y: -30 }, { y: 60, ease: "none", scrollTrigger: { trigger: "#vvv", start: "top bottom", end: "bottom top", scrub: true } });
  }
  gsap.fromTo(".print-lead, .people-quote, .person", { opacity: 0, y: 40 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.8, ease: "power2.out", scrollTrigger: { trigger: ".people", start: "top 85%" } });
}

/* ── chrome: nav, viper rail, pulse economy, cursor, chroma, anchors ── */
function chrome() {
  $$(".wa-link").forEach((a) => { a.href = waLink(); });
  $$(".tel-link").forEach((a) => { a.href = `tel:${STUDIO.phoneTel}`; });
  const nav = $("#nav");
  ScrollTrigger.create({
    trigger: "#postazione", start: () => `top ${navH()}px`,
    onEnter: () => nav.classList.add("solid"), onLeaveBack: () => nav.classList.remove("solid"),
  });
  // the viper rail: comes down the left edge as you scroll; its scales are the sections
  const rail = createViperRail($("#vrail"), {
    sections: [["top", "Inizio"], ["postazione", "Processo"], ["spazio", "The Studio Space"], ["stili", "Stili"], ["muro", "The Art Wall"],
      ["archivio", "Archivio"], ["walkin", "Walk-in"], ["studio", "Studio"]].map(([id, label]) => ({ el: $(`#${id}`), label })),
    mobile: MOBILE, reduced: REDUCED, fine: FINE,
    scrollTo: (el) => lenis.scrollTo(el, { duration: 1.6 }),
  });
  ScrollTrigger.addEventListener("refresh", () => rail.layout());
  addEventListener("resize", () => rail.layout());
  gsap.ticker.add(() => rail.frame(performance.now()));

  // one breathing CTA at a time: the nav pill, unless the archive CTA is on screen
  const pill = $("#nav-pill"), cta = $("#cta-btn");
  pill.classList.add("pulsing");
  ScrollTrigger.create({
    trigger: ".archive-cta", start: "top 90%", end: "bottom 10%",
    onToggle: (s) => { cta.classList.toggle("pulsing", s.isActive); pill.classList.toggle("pulsing", !s.isActive); },
  });

  // scroll velocity → chromatic split on the hero badge. Only the badge reads --ca: it is set there, and only when it
  // changes (on :root, every frame, it restyled the whole page each frame: the worst of the mobile stutter, round 8)
  let sv = 0, caShown = "";
  const caEl = $(".ht-logo"), heroCopy = $("#hero-copy");
  gsap.ticker.add(() => {
    sv += (Math.abs(lenis.velocity || 0) - sv) * 0.1;
    if (heroCopy.classList.contains("past")) return;
    const ca = (1.4 + Math.min(10, sv * 0.35)).toFixed(1);
    if (ca !== caShown) { caShown = ca; caEl.style.setProperty("--ca", ca); }
  });

  // eased anchors through Lenis; from the menu the page is already covered, so it lands at once (a 1.6 s flight through
  // 30,000 px of acts on a phone would load and stutter through every one of them)
  $$('a[href^="#"]').forEach((a) => {
    const landNow = !!a.closest("#menu");
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (href === "#") return;
      const target = href === "#top" ? 0 : $(href);
      if (target !== null) { e.preventDefault(); lenis.scrollTo(target, landNow ? { immediate: true, force: true } : { duration: 1.6 }); }
    });
  });

  // the menu (phones and tablets): a link or a tap on its ground closes it
  const menu = $("#menu");
  $("#menu-open").addEventListener("click", () => { menu.showModal(); lenis.stop(); });
  $("#menu-close").addEventListener("click", () => menu.close());
  menu.addEventListener("click", (e) => { if (e.target === menu || e.target.closest("a")) menu.close(); });
  menu.addEventListener("close", () => lenis.start());

  // tattoo-machine cursor (fine pointers only): the needle tip sits on the pointer, the machine buzzes on a press
  if (FINE) {
    const dot = $(".cursor-machine"), ring = $(".cursor-ring"), cur = $(".cursor");
    const TIP = [8 * (58 / 62), 84 * (82 / 88)]; // the needle tip (viewBox 0,0) in the svg's px
    addEventListener("pointerdown", () => { cur.classList.remove("buzz"); void cur.offsetWidth; cur.classList.add("buzz"); });
    let x = innerWidth / 2, y = innerHeight / 2, rx = x, ry = y;
    addEventListener("pointermove", (e) => { x = e.clientX; y = e.clientY; cur.classList.add("on"); });
    document.documentElement.addEventListener("pointerleave", () => cur.classList.remove("on"));
    gsap.ticker.add(() => {
      rx += (x - rx) * 0.18; ry += (y - ry) * 0.18;
      dot.style.transform = `translate(${(x - TIP[0]).toFixed(1)}px, ${(y - TIP[1]).toFixed(1)}px)`;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    });
    document.addEventListener("pointerover", (e) => { if (e.target.closest("a, button, .tile, .flash")) cur.classList.add("hot"); });
    document.addEventListener("pointerout", (e) => { if (e.target.closest("a, button, .tile, .flash")) cur.classList.remove("hot"); });
  }
}

/* ── tattoo effects (created after every pin, so their triggers measure the final layout) ── */
function effects() {
  const ink = (fxInk = createInkLayer({ fine: FINE, reduced: REDUCED }));
  const machine = (fxMachine = createMachine());
  badge = createBadge($(".ht-logo"), { fine: FINE, reduced: REDUCED, machine, ink });
  gsap.ticker.add(() => badge.frame(performance.now()));
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("#lightbox")) return;
    ink.splat(e.clientX, e.clientY, e.target.closest("a, button") ? 0.6 : 1);
  }, { passive: true });
  const snd = $("#snd");
  snd.addEventListener("click", () => {
    const on = machine.toggle();
    snd.setAttribute("aria-pressed", on ? "true" : "false");
    snd.setAttribute("aria-label", `Suono della macchinetta: ${on ? "acceso" : "spento"}`);
    snd.title = on ? "Spegni la macchinetta" : "Accendi la macchinetta";
  });
  let act = 0;
  gsap.ticker.add(() => {
    ink.frame(performance.now());
    if (!machine.on) return;
    const target = Math.max(ink.speed() * 0.9, Math.min(1, Math.abs(lenis.velocity || 0) / 35), processDrawing ? 0.65 : 0, badge.level() * 0.9);
    act += (target - act) * (target > act ? 0.25 : 0.04);
    machine.setActivity(act);
  });
  $$(".drips").forEach((el) => buildDrips(el, { seed: +el.dataset.seed || 1, reduced: REDUCED || MOBILE })); // phones: poured, still
  stencilHeadings($$(".ink-head"), { reduced: REDUCED });
}

/* ── resize: refit canvases; refresh ONLY on width change ─── */
let lastW = innerWidth;
addEventListener("resize", () => {
  if ((innerWidth < 760) !== MOBILE) { location.reload(); return; } // phones load lighter textures
  tunnel?.fit();
  proc?.fit();
  desk?.fit();
  if (Math.abs(innerWidth - lastW) > 2) { lastW = innerWidth; ScrollTrigger.refresh(); }
});

/* ── footer: Partita IVA + the privacy notice (round 8). Written from what the site does, audited on the live site:
   one host (its own), no forms, no analytics, no storage. On Vercel a normal visit sets no cookie (live headers, 2026-10-31);
   the Vercel facts come from its privacy notice, vercel.com/legal/privacy-notice. ── */
function privacy() {
  const todo = (what) => `<mark class="todo">${what} da inserire</mark>`;
  const vat = STUDIO.vat ? `P.IVA ${STUDIO.vat}` : todo("P.IVA");
  const mail = STUDIO.privacyEmail ? `<a href="mailto:${STUDIO.privacyEmail}">${STUDIO.privacyEmail}</a>` : todo("email");
  $("#vat-line").innerHTML = vat;
  $("#privacy-body").innerHTML = `
    <p class="privacy-upd">Informativa breve ai sensi dell'art. 13 del Regolamento UE 2016/679 (GDPR) · aggiornata il ${PRIVACY_UPDATED}</p>
    <h3>Chi tratta i dati</h3>
    <p>${STUDIO.name} di ${STUDIO.artist}, ${STUDIO.address} · ${vat} · ${mail}</p>
    <h3>Cosa raccoglie questo sito</h3>
    <p>Niente moduli, niente registrazione, nessuno strumento di statistica o di profilazione: il sito non ti chiede dati personali e non ne salva nel tuo browser. Caratteri, immagini e video arrivano tutti dal sito stesso: durante la visita nessun dato viene inviato a Google o ad altri terzi.</p>
    <h3>Dati tecnici</h3>
    <p>Il sito è ospitato da Vercel Inc. (Stati Uniti). Per mostrarlo e proteggerlo, Vercel tratta i dati tecnici della connessione: l'indirizzo IP, la città e il paese che se ne ricavano e la configurazione del dispositivo. Vercel aderisce all'EU-U.S. Data Privacy Framework, che copre il trasferimento di questi dati negli Stati Uniti. Il sito non imposta cookie. Solo in caso di traffico anomalo, la protezione di Vercel può chiedere al browser una verifica automatica e salvare un cookie tecnico di sicurezza: è necessario, non richiede consenso e non serve a profilarti. Base giuridica: il legittimo interesse a far funzionare il sito in sicurezza (art. 6, par. 1, lett. f GDPR).</p>
    <h3>WhatsApp e Instagram</h3>
    <p>I pulsanti WhatsApp e i link a Instagram portano su servizi di Meta: da lì valgono le loro informative. I messaggi che ci mandi su WhatsApp servono a risponderti e a fissare gli appuntamenti.</p>
    <h3>I tuoi diritti</h3>
    <p>Puoi chiedere accesso, rettifica, cancellazione, limitazione od opposizione al trattamento (artt. 15–21 GDPR) scrivendo a ${mail}. Puoi anche proporre reclamo al Garante per la protezione dei dati personali (<a href="https://www.garanteprivacy.it" target="_blank" rel="noopener">garanteprivacy.it</a>).</p>`;
  const dlg = $("#privacy");
  let back = null;
  $("#privacy-open").addEventListener("click", (e) => { back = e.currentTarget; dlg.showModal(); lenis.stop(); });
  $("#privacy-close").addEventListener("click", () => dlg.close());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // a click on the backdrop
  dlg.addEventListener("close", () => { lenis.start(); back?.focus?.(); });
}

/* ── go — pinned triggers in DOCUMENT ORDER ───────────────── */
// lazy pictures fade in once loaded (round 9): no alt text and broken-image icon while they come in. The hiding
// rule needs .lazyfade, so without this script every picture shows as usual.
document.documentElement.classList.add("lazyfade");
document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") e.target.classList.add("in"); }, true);
$$('img[loading="lazy"]').forEach((img) => { if (img.complete && img.naturalWidth) img.classList.add("in"); });
liveInfo();
privacy();
actWalkin(); // before the pins: it changes the page height
actHero();
actDesk();
actProcess();
actSpace();
actStyles();
actWall();
actArchive();
actStudio();
chrome();
effects();
gate.job(document.fonts.ready);
gate.start();
runLoader().then(() => {
  tattooTitle($(".hero-title"), { reduced: REDUCED }).then(() => badge.start()); // the needle inks the badge, then it comes alive
  document.body.classList.remove("loading");
  lenis.start();
  ScrollTrigger.refresh(); // re-measure once fonts + the gate settle
  if (location.hash && location.hash.length > 1) {
    const target = $(location.hash);
    if (target) setTimeout(() => lenis.scrollTo(target, { immediate: true, force: true }), 120);
  }
});
