// The side rail (owner, round 8: "use a viper coming down the side of the website as navigation side bar").
// A viper slithers down the left edge as the page scrolls: its tail stays at the top, its head marks where
// you are. The body follows one fixed wave down the rail, so it glides through the same curves as it grows.
// Each section has a scale on the rail (bone ahead, red once passed); on desktop each is a button with its
// name, and the head turns to look at a pointer that comes near.
import { viperPath, drawViper } from "./viper.js";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

export function createViperRail(root, { sections, mobile, reduced, fine, scrollTo }) {
  const cv = root.querySelector("canvas");
  const list = root.querySelector("ol");
  const ctx = cv.getContext("2d");
  const W = mobile ? 7 : 12;               // body width
  const CX = mobile ? 9 : 22;              // the rail's centre line
  const AMP = mobile ? 2.4 : 5.5, LAMBDA = mobile ? 120 : 170; // the wave the body runs along
  const MIN = mobile ? 34 : 64;            // the viper is never shorter than this (px of rail)
  let dpr = 1, w = 0, h = 0, top = 0, bottom = 0, marks = [], shown = 0, time = 0, last = performance.now();
  const state = {};
  const look = { x: 0, y: 0, amt: 0, last: -1e9 };

  // section buttons (desktop: hover shows the name; phones: ticks only, the edge stays free for the thumb)
  const items = sections.map((s) => {
    const li = document.createElement("li");
    li.className = "vrail-mark";
    li.innerHTML = `<button type="button" aria-label="Vai a: ${s.label}"><span class="vrail-dot"></span><span class="vrail-label">${s.label}</span></button>`;
    li.querySelector("button").addEventListener("click", () => scrollTo(s.el));
    list.appendChild(li);
    return li;
  });

  if (fine && !reduced) addEventListener("pointermove", (e) => {
    look.x = e.clientX; look.y = e.clientY; look.last = performance.now();
  }, { passive: true });

  let maxS = 1; // the page's scroll length, measured at layout (reading it every frame forced a layout per frame)
  const maxScroll = () => maxS;
  const yAt = (p) => top + MIN + clamp01(p) * (bottom - top - MIN);
  const xAt = (y, drift) => CX + AMP * Math.sin((y / LAMBDA) * Math.PI * 2 + drift);

  function layout() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = root.clientWidth; h = innerHeight;
    cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    const nav = document.getElementById("nav");
    top = (nav ? nav.offsetHeight : 64) + 10;
    bottom = h - (mobile ? 18 : 26);
    maxS = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    const ms = maxS;
    marks = sections.map((s) => {
      const docTop = s.el.getBoundingClientRect().top + scrollY;
      return { p: clamp01(docTop / ms), visible: !s.el.hidden && s.el.offsetHeight > 0 };
    });
    items.forEach((li, k) => {
      li.style.top = `${yAt(marks[k].p).toFixed(1)}px`;
      li.hidden = !marks[k].visible;
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const headY = yAt(shown), drift = reduced ? 0 : time * 0.6;
    // section scales on the rail, under the body
    marks.forEach((m, k) => {
      if (!m.visible) return;
      const y = yAt(m.p), passed = shown >= m.p - 0.002;
      const x = CX + (mobile ? 6 : 13);
      ctx.beginPath(); ctx.arc(x, y, mobile ? 2 : 3.2, 0, Math.PI * 2);
      ctx.fillStyle = passed ? "#e2283a" : "rgba(238,232,225,.5)";
      ctx.fill();
      if (items[k].classList.contains("on")) { ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(255,70,84,.85)"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke(); }
    });
    // the body, head first, down to its tail at the top of the rail
    const ctrl = [];
    for (let y = headY; y > top - 4; y -= 14) ctrl.push([xAt(y, drift), y]);
    ctrl.push([xAt(top - 6, drift), top - 6]);
    if (ctrl.length < 3) return;
    const pts = viperPath(ctrl, 3);
    const flick = time % 3.1;
    const near = look.amt > 0.01 ? [look.x, look.y] : null;
    drawViper(ctx, pts, {
      W, eye: 1, time, state, face: 1, headScale: 1.75, // a big triangular head on a thin rail body
      tongue: reduced ? 0 : flick < 0.42 ? Math.sin((flick / 0.42) * Math.PI * 2) ** 2 : 0,
      aim: near, aimAmt: look.amt,
    });
  }

  let active = -1, drawnShown = -1, drawnAt = 0;
  const IDLE_MS = mobile ? 50 : 0; // when nothing moves, phones redraw the idle wiggle at 20 fps
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    time += dt;
    const p = clamp01(scrollY / maxScroll());
    shown += (p - shown) * (reduced ? 1 : 0.2);
    // the head watches a pointer that comes near the rail, and lets go when it leaves
    const want = fine && !reduced && now - look.last < 2500 && look.x < 280 ? 1 : 0;
    look.amt += (want - look.amt) * 0.08;
    // the current section: the last one whose scale the head has passed
    let k = -1;
    marks.forEach((m, i) => { if (m.visible && p >= m.p - 0.002) k = i; });
    if (k !== active) {
      items.forEach((li, i) => li.classList.toggle("on", i === k));
      active = k;
    }
    const moving = Math.abs(shown - drawnShown) > 0.00002 || look.amt > 0.01;
    if (!moving && (reduced || now - drawnAt < IDLE_MS)) return;
    drawnShown = shown; drawnAt = now;
    draw();
  }

  layout();
  return { layout, frame };
}
