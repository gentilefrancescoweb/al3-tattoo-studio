// The hero's AL3 badge, alive (owner, round 8: "more interactive, with a buzz effect"). Two layers cut from his file
// (scripts/logo-cutout.py): the lettering floats over the disc. The badge turns to face the pointer, a light follows
// it across the disc; hovering idles the machine (a faint shiver), pressing runs it (a tap, on a phone): the badge
// shudders, the colours split, ink spits off the rim, the machine buzzes and the phone vibrates where it can.
// A double click (a double tap) flips it to Sgt. Zippo's rose (round 9): the back face is the same badge, so all of
// the above works on either side; the flip itself is CSS (.flipped).
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createBadge(logo, { fine, reduced, machine, ink }) {
  const body = logo.querySelector(".al3");
  const floats = [...logo.querySelectorAll(".al3-letters")]; // the AL3 lettering and the rose: each floats over its disc
  let floatShown = "";
  const cursor = document.querySelector(".cursor");
  let live = false, shown = true, hover = false, held = false, burstUntil = 0, pointerIn = false;
  let px = 0, py = 0;                 // pointer from the badge's centre, in badge radii
  let rx = 0, ry = 0, mx = 0, my = 0;  // eased tilt (deg) and magnetic pull (px)
  let buzz = 0, lastSpit = 0, lastType = "mouse";
  const written = new Map(); // style writes only when a value changes: idle frames cost nothing
  const put = (el, k, v) => { const key = el === logo ? k : `${k}@l`; if (written.get(key) === v) return; written.set(key, v); k === "transform" ? (el.style.transform = v) : el.style.setProperty(k, v); };

  function locate(e) {
    const r = logo.getBoundingClientRect(), rad = r.width / 2 || 1;
    px = (e.clientX - (r.left + rad)) / rad;
    py = (e.clientY - (r.top + r.height / 2)) / rad;
    return Math.hypot(px, py) < 0.98; // the disc, not its square box
  }
  function setHover(on) {
    if (on === hover) return;
    hover = on;
    logo.classList.toggle("hover", on);
    cursor?.classList.toggle("hot", on);
  }
  function hold(on) {
    if (on === held) return;
    held = on;
    machine.hold(on || performance.now() < burstUntil);
  }

  addEventListener("pointermove", (e) => {
    lastType = e.pointerType;
    if (!live || !shown || e.pointerType === "touch") return;
    pointerIn = true;
    setHover(locate(e));
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => { pointerIn = false; setHover(false); });
  logo.addEventListener("pointerdown", (e) => {
    lastType = e.pointerType;
    if (!live || e.pointerType === "touch" || e.button !== 0 || !locate(e)) return;
    hold(true); // the mouse: as long as it is held
  });
  addEventListener("pointerup", () => hold(false));
  addEventListener("pointercancel", () => hold(false));
  addEventListener("blur", () => hold(false));
  const flip = () => {
    const on = logo.classList.toggle("flipped");
    logo.closest(".hero-copy")?.classList.toggle("zippo", on); // the line above the badge names whose side is showing
    const r = logo.getBoundingClientRect(); // a splash of ink as it turns
    if (!reduced) ink.splat(r.left + r.width / 2, r.top + r.height / 2, 0.4);
  };
  logo.addEventListener("dblclick", (e) => { // the mouse; on touch the two taps below do it
    if (!live || !shown || lastType === "touch" || !locate(e)) return;
    flip();
  });
  let lastTap = { t: 0, x: 0, y: 0 };
  logo.addEventListener("click", (e) => { // a tap: one burst (a click only counts on touch; a scroll-drag never clicks)
    if (!live || lastType !== "touch" || !locate(e)) return;
    const now = performance.now();
    if (now - lastTap.t < 340 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 40) { flip(); lastTap.t = 0; }
    else lastTap = { t: now, x: e.clientX, y: e.clientY };
    burstUntil = performance.now() + 700;
    machine.hold(true);
    setTimeout(() => { if (!held && performance.now() >= burstUntil - 20) machine.hold(false); }, 700);
    navigator.vibrate?.([45, 15, 45, 15, 45, 15, 45, 15, 45, 15, 45, 15, 45]);
  });

  function frame(now) {
    if (!live || !shown) return;
    const running = held || now < burstUntil;
    const target = running ? 1 : hover ? 0.2 : 0;
    buzz += (target - buzz) * (target > buzz ? 0.4 : 0.12);
    if (buzz < 0.002) buzz = 0;
    if (reduced) { put(logo, "--bz", "0"); return; }

    // turn to face the pointer (the side it is on recedes); phones sway on their own
    let tx = 0, ty = 0;
    if (fine && pointerIn) {
      const k = hover ? 16 : 7, d = Math.max(1, Math.hypot(px, py) / 1.4);
      tx = clamp(px / d, -1.4, 1.4) / 1.4 * k; ty = clamp(py / d, -1.4, 1.4) / 1.4 * k;
    } else if (!fine) {
      const t = now / 1000;
      tx = Math.sin(t * 0.55) * 7; ty = Math.cos(t * 0.42) * 4;
    }
    ry += (tx - ry) * 0.09; rx += (-ty - rx) * 0.09;
    const pull = hover ? 7 : 0;
    mx += (clamp(px, -1, 1) * pull - mx) * 0.1; my += (clamp(py, -1, 1) * pull - my) * 0.1;

    // the machine's shudder: a new random offset every frame, the letters a little more than the disc
    const a = buzz * 3.4, j = () => (Math.random() * 2 - 1);
    const bx = mx + j() * a, by = my + j() * a, br = j() * buzz * 1.3;
    if (body.style.transform !== (body._t = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate3d(${bx.toFixed(2)}px, ${by.toFixed(2)}px, 0) rotate(${br.toFixed(2)}deg)`)) body.style.transform = body._t;
    const ft = `translateZ(${(44 - buzz * 16).toFixed(1)}px) translate(${(j() * buzz * 1.8).toFixed(2)}px, ${(j() * buzz * 1.8).toFixed(2)}px)`;
    if (ft !== floatShown) { floatShown = ft; floats.forEach((el) => { el.style.transform = ft; }); }
    put(logo, "--bz", buzz.toFixed(3));
    put(logo, "--gx", `${(50 + clamp(px, -1.2, 1.2) * 34).toFixed(1)}%`);
    put(logo, "--gy", `${(50 + clamp(py, -1.2, 1.2) * 34).toFixed(1)}%`);
    put(logo, "--sx", `${(-ry * 0.9).toFixed(1)}px`);
    put(logo, "--sy", `${(10 + rx * 0.9).toFixed(1)}px`);

    // ink spits off the rim while it runs
    if (running && buzz > 0.5 && now - lastSpit > 85) {
      lastSpit = now;
      const r = logo.getBoundingClientRect(), ang = Math.random() * Math.PI * 2, rad = r.width * 0.47;
      ink.splat(r.left + r.width / 2 + Math.cos(ang) * rad, r.top + r.height / 2 + Math.sin(ang) * rad, 0.26);
    }
  }

  return {
    frame,
    start() { live = true; logo.classList.add("live"); },
    visible(on) { // the hero copy has faded: no hover, no clicks stolen from the tunnel behind it
      if (on === shown) return;
      shown = on;
      if (!on) { setHover(false); hold(false); }
    },
    level: () => buzz,
  };
}
