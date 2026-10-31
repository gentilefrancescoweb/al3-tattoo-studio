// Act 1b — La postazione: the owner's photo of the desk, its left (landscape) screen showing tattoo
// sketches (scripts/desk-screen.py). The photo already carries the owl sketch; on top of it a DOM copy
// of the screen, laid onto the panel with a CSS matrix3d, draws his designs one after another (red and
// blue pencil first, then the graphite line follows the pen down the design). Scroll pushes the camera
// into the screen, and the owl it ends on is the design the process act turns into the tattoo next.
import gsap from "gsap";
import { DESK } from "./desk-screen.js";

const smooth = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

// unit square → quad (TL, TR, BR, BL) as a CSS matrix3d for an element of w × h px
function quadMatrix(w, h, q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, hh = (dx1 * dy3 - dx3 * dy1) / den;
  const a = x1 - x0 + g * x1, b = x3 - x0 + hh * x3, d = y1 - y0 + g * y1, e = y3 - y0 + hh * y3;
  return `matrix3d(${a / w},${d / w},0,${g / w},${b / h},${e / h},0,${hh / h},0,0,1,0,${x0},${y0},0,1)`;
}

export function createDesk(section, { mobile, reduced, gate }) {
  const stage = section.querySelector(".desk-stage");
  const scene = section.querySelector("#desk-scene");
  const photo = section.querySelector("#desk-photo");
  const screen = section.querySelector("#desk-screen");
  const copy = section.querySelector(".desk-copy");
  const vig = section.querySelector(".desk-vig");
  gate?.image(photo);
  const [SW, SH] = DESK.sheet;
  // the screen's bounding box in photo px: the monitor is angled, so its left edge is the tall one
  const xs = DESK.quad.map((q) => q[0]), ys = DESK.quad.map((q) => q[1]);
  const screenW = Math.max(...xs) - Math.min(...xs), screenH = Math.max(...ys) - Math.min(...ys);
  const F = [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2]; // its centre
  const nav = document.getElementById("nav");
  // Zippo at the desk (photo px): on screens too narrow to hold him and the sketching screen together
  // (portrait, 9:16), the shot opens on him and pans left along his gaze to the screen (owner, round 8)
  const ZIPPO = [1230, 470];
  let geo = null, p = 0;

  // the live screen: canvas + one layer per design, built when the act comes near
  screen.style.width = `${SW}px`; screen.style.height = `${SH}px`;
  const sheets = [];
  let pen = null, built = false;
  function build() {
    if (built || reduced || mobile) return; // phones keep the photo's own owl sketch: the live screen (3D, masked, re-rastered
    // as the camera pushes in) stalled phone GPUs for up to 1.4 s (round 8 mobile pass)
    built = true;
    screen.innerHTML = `<img class="sk-canvas" src="/process/sk/canvas.webp" alt="" />`;
    DESK.sketches.forEach((id, k) => {
      const el = document.createElement("div");
      el.className = "sk";
      el.innerHTML = `<img class="sk-u" src="/process/sk/${id}-u.webp" alt="" /><img class="sk-i" src="/process/sk/${id}-i.webp" alt="" />`;
      el.style.opacity = k === 0 ? "1" : "0";
      el.style.setProperty("--e", k === 0 ? "1.1" : "-0.05"); // how far down the sheet the line is inked
      screen.appendChild(el);
      sheets.push(el);
    });
    pen = document.createElement("span");
    pen.className = "sk-pen";
    screen.appendChild(pen);
    // live once every sheet is decoded, so the photo's own owl stays on the panel until then (round 10: shown at once it was a
    // blank white panel, for over 9 s after a nav jump, while these images queued behind the hero's)
    Promise.allSettled([...screen.querySelectorAll("img")].map((i) => i.decode())).then(() => {
      screen.classList.add("live");
      cycle();
      settle(p > 0.72); // the scroll may have reached the end of the push-in meanwhile
      if (wanted && !hold) tl.play();
    });
  }

  // one design after another: pencil construction fades in, the line is drawn top to bottom, it holds
  let tl = null, hold = false, wanted = false;
  function cycle() {
    tl = gsap.timeline({ repeat: -1, delay: 2.4 });
    for (let n = 1; n <= sheets.length; n++) {
      const k = n % sheets.length, prev = sheets[(k + sheets.length - 1) % sheets.length], el = sheets[k];
      const [bx, by, bw, bh] = DESK.boxes[k], st = { d: 0 };
      tl.set(el, { opacity: 0, "--e": -0.05 })
        .set(el.querySelector(".sk-u"), { opacity: 0 })
        .to(prev, { opacity: 0, duration: 0.5, ease: "power1.in" })
        .to(el, { opacity: 1, duration: 0.3 }, "<0.3")
        .to(el.querySelector(".sk-u"), { opacity: 1, duration: 0.7, ease: "power1.out" })
        .to(st, {
          d: 1, duration: 3.6, ease: "none",
          onStart: () => gsap.set(pen, { opacity: 1 }),
          onUpdate: () => { // the pen sweeps across the design as the line front moves down it
            const e = by + st.d * bh;
            el.style.setProperty("--e", e.toFixed(4));
            const y = e - 0.012, x = bx + bw * (0.5 + 0.46 * Math.sin(st.d * 46));
            pen.style.transform = `translate(${(x * SW).toFixed(1)}px, ${(y * SH).toFixed(1)}px)`;
          },
          onComplete: () => gsap.to(pen, { opacity: 0, duration: 0.3 }),
        }, "-=0.2")
        .to({}, { duration: 2.6 });
    }
    tl.pause();
  }
  // at the end of the push-in the screen settles on the owl, finished, for the handover to the process act
  function settle(on) {
    if (!tl || on === hold) return;
    hold = on;
    if (on) {
      tl.pause();
      gsap.set(pen, { opacity: 0 });
      sheets.forEach((el, k) => {
        gsap.to(el, { opacity: k === 0 ? 1 : 0, duration: 0.45 }); // the cycle is paused: nothing to fight
        if (k === 0) { el.style.setProperty("--e", "1.1"); gsap.set(el.querySelector(".sk-u"), { opacity: 1 }); }
      });
    } else {
      tl.restart(true); // from the finished owl, as the cycle begins
    }
  }

  function fit() {
    const vw = stage.clientWidth, vh = stage.clientHeight;
    const s = Math.max(vw / DESK.w, vh / DESK.h);
    const W = DESK.w * s, H = DESK.h * s;
    const ox = Math.min(0, Math.max(vw - W, vw * 0.5 - F[0] * s));
    const oy = Math.min(0, Math.max(vh - H, vh * 0.5 - F[1] * s));
    scene.style.width = `${W}px`; scene.style.height = `${H}px`;
    scene.style.left = `${ox}px`; scene.style.top = `${oy}px`;
    scene.style.transformOrigin = `${F[0] * s}px ${F[1] * s}px`;
    screen.style.transform = quadMatrix(SW, SH, DESK.quad.map(([x, y]) => [x * s, y * s]));
    const top = nav ? nav.offsetHeight : 64; // the push-in ends on the screen, centred below the nav
    // (a phone is narrower than the landscape screen: there the camera pulls back a little to frame all of it)
    const zEnd = Math.max(mobile ? 0.8 : 1, Math.min(3, ((vh - top) * 0.9) / (screenH * s), (vw * 0.92) / (screenW * s)));
    // where the scene would sit to frame Zippo; a pan is needed when his face falls off the screen-framed view
    const oxZ = Math.min(0, Math.max(vw - W, vw * 0.5 - ZIPPO[0] * s));
    const pan = ox + 1300 * s > vw * 0.94 ? oxZ - ox : 0;
    geo = { vw, vh, s, ox, oy, zEnd, cy: (vh + top) / 2, pan };
    set(p);
  }

  function set(progress) {
    p = progress;
    if (!geo) return;
    // with a pan: on Zippo first, across to the screen by 38%, then the push-in; without: the push-in alone
    const panK = geo.pan ? 1 - smooth(p / 0.38) : 0;
    const e = reduced ? 0 : geo.pan ? smooth((p - 0.3) / 0.62) : smooth(p / 0.92);
    const z = lerp(1, geo.zEnd, e);
    const fx = geo.ox + F[0] * geo.s, fy = geo.oy + F[1] * geo.s; // the screen's centre in the stage
    const tx = (geo.vw * 0.5 - fx) * e + geo.pan * panK, ty = (geo.cy - fy) * e;
    scene.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) scale(${z.toFixed(4)})`;
    copy.style.opacity = (1 - smooth((p - 0.42) / 0.22)).toFixed(3);
    copy.style.transform = `translateY(${(-smooth((p - 0.42) / 0.22) * 24).toFixed(1)}px)`;
    vig.style.opacity = smooth((p - 0.25) / 0.6).toFixed(3);
    settle(p > 0.72);
  }

  return {
    fit,
    set,
    near() { build(); },
    toggle(on) { wanted = on; if (!tl || hold) return; on ? tl.play() : tl.pause(); },
  };
}
