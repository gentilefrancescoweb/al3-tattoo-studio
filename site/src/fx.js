// Tattoo effects: ink splatter on click (the pointer itself is plain since round 8: no viper), the machine's
// buzz (synthesised, opt-in), the title tattooed in by a needle, headings that go from
// stencil to ink, and ink drips between sections. All procedural; nothing is downloaded.
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

/* ── ink layer: splatter on one fixed 2D canvas ───────────────────────────── */
export function createInkLayer({ fine, reduced }) {
  const cv = document.createElement("canvas");
  cv.className = "ink-fx";
  cv.setAttribute("aria-hidden", "true");
  document.body.appendChild(cv);
  cv.style.visibility = "hidden";
  const ctx = cv.getContext("2d");
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const fit = () => { cv.width = Math.round(innerWidth * DPR); cv.height = Math.round(innerHeight * DPR); };
  fit();
  addEventListener("resize", fit);

  const drops = [];   // flying droplets
  const blots = [];   // landed splats, fading
  let speed = 0, lastMove = null;

  if (fine && !reduced) { // cursor speed still revs the machine's buzz
    addEventListener("pointermove", (e) => {
      if (lastMove) speed = Math.min(1, Math.hypot(e.clientX - lastMove.x, e.clientY - lastMove.y) / 60);
      lastMove = { x: e.clientX, y: e.clientY };
    }, { passive: true });
  }

  const RED = [211, 23, 43], HOT = [255, 70, 84], BONE = [238, 232, 225];
  function splat(x, y, power = 1) {
    if (reduced) return;
    const n = Math.round(16 + power * 10);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (180 + Math.random() * 620) * power;
      drops.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 220 * power, r: 1.2 + Math.random() * 3.6, life: 0.25 + Math.random() * 0.55, age: 0, c: Math.random() < 0.82 ? RED : BONE });
    }
    blots.push(makeBlot(x, y, 7 + power * 9, RED, 2.2));
  }
  function makeBlot(x, y, r, c, life) {
    const spikes = Array.from({ length: 7 + Math.floor(Math.random() * 6) }, () => ({ a: Math.random() * Math.PI * 2, l: r * (0.6 + Math.random() * 1.1), w: r * (0.12 + Math.random() * 0.18) }));
    return { x, y, r, c, life, age: 0, spikes };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!drops.length && !blots.length) { // idle: cleared and hidden, so the compositor stops blending a full-screen layer
      if (cv.dataset.dirty) { ctx.clearRect(0, 0, cv.width, cv.height); delete cv.dataset.dirty; cv.style.visibility = "hidden"; }
      return;
    }
    if (!cv.dataset.dirty) cv.style.visibility = "";
    cv.dataset.dirty = "1";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    // landed blots fade like ink settling into skin
    for (let i = blots.length - 1; i >= 0; i--) {
      const b = blots[i];
      b.age += dt;
      const k = 1 - b.age / b.life;
      if (k <= 0) { blots.splice(i, 1); continue; }
      ctx.fillStyle = `rgba(${b.c[0]},${b.c[1]},${b.c[2]},${(k * 0.85).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 + (1 - k) * 0.25), 0, Math.PI * 2); ctx.fill();
      for (const s of b.spikes) {
        ctx.beginPath();
        ctx.ellipse(b.x + Math.cos(s.a) * s.l, b.y + Math.sin(s.a) * s.l, s.w * 1.6, s.w, s.a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // flying droplets
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i];
      d.age += dt;
      d.vy += 1500 * dt; d.vx *= 0.985; d.vy *= 0.985;
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.age >= d.life) { if (blots.length < 140) blots.push(makeBlot(d.x, d.y, d.r * 0.9, d.c, 1.4 + Math.random())); drops.splice(i, 1); continue; }
      ctx.fillStyle = `rgb(${d.c[0]},${d.c[1]},${d.c[2]})`;
      ctx.beginPath(); ctx.ellipse(d.x, d.y, d.r, d.r * 0.8, Math.atan2(d.vy, d.vx), 0, Math.PI * 2); ctx.fill();
    }
  }
  return { frame, splat, speed: () => speed };
}

/* ── the tattoo machine: a coil machine's buzz, synthesised (opt-in) ─────── */
export function createMachine() {
  let ac = null, master, osc, lfo, clatterGain, noiseBuf, act = 0, on = false, held = false;
  function build() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp).connect(ac.destination);
    // armature hum: a sawtooth through a soft clipper and a resonant band
    osc = ac.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 118;
    const shaper = ac.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = (i / 512) - 1; curve[i] = Math.tanh(x * 3); }
    shaper.curve = curve;
    const band = ac.createBiquadFilter(); band.type = "bandpass"; band.frequency.value = 820; band.Q.value = 0.9;
    const humGain = ac.createGain(); humGain.gain.value = 0.55;
    osc.connect(shaper).connect(band).connect(humGain).connect(master);
    // contact-screw clatter: noise gated at the armature rate
    const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
    const noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const hp = ac.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 2400;
    clatterGain = ac.createGain(); clatterGain.gain.value = 0.18;
    lfo = ac.createOscillator(); lfo.type = "square"; lfo.frequency.value = 118;
    const lfoDepth = ac.createGain(); lfoDepth.gain.value = 0.16;
    lfo.connect(lfoDepth).connect(clatterGain.gain);
    noise.connect(hp).connect(clatterGain).connect(master);
    osc.start(); lfo.start(); noise.start();
  }
  function apply() {
    if (!ac) return;
    const t = ac.currentTime;
    const g = held ? 0.15 : on ? 0.02 + act * 0.11 : 0; // held: the badge is pressed, it runs flat out
    master.gain.setTargetAtTime(g, t, on || held ? 0.05 : 0.04);
    const f = held ? 162 : 104 + act * 46; // the motor revs as you work it
    osc.frequency.setTargetAtTime(f, t, 0.12);
    lfo.frequency.setTargetAtTime(f, t, 0.12);
  }
  return {
    get on() { return on; },
    toggle() {
      if (!ac) build();
      on = !on;
      if (on && ac.state === "suspended") ac.resume();
      apply();
      return on;
    },
    hold(v) {
      if (v && !ac) build();
      if (!ac) return;
      if (v && ac.state === "suspended") ac.resume();
      held = !!v;
      apply();
    },
    setActivity(a) { const n = Math.max(0, Math.min(1, a)); if (Math.abs(n - act) > 0.02) { act = n; apply(); } },
  };
}

/* ── the title, tattooed in: stencil first, then the needle fills each line ── */
export function tattooTitle(title, { reduced }) {
  const lines = [...title.querySelectorAll(".ht-line")];
  if (reduced) { lines.forEach((l) => l.style.setProperty("--p", 1)); title.classList.add("inked"); return Promise.resolve(); }
  const tl = gsap.timeline();
  lines.forEach((line, i) => {
    const needle = line.querySelector(".ht-needle");
    const st = { p: 0 };
    tl.to(st, {
      p: 1, duration: i === 0 ? 0.75 : 1.25, ease: "power1.inOut",
      onStart: () => line.classList.add("writing"),
      onUpdate: () => {
        line.style.setProperty("--p", st.p.toFixed(4));
        needle.style.top = `${18 + Math.random() * 64}%`; // the needle bounces over the letter heights
      },
      onComplete: () => line.classList.remove("writing"),
    }, i === 0 ? 0 : ">-0.05");
  });
  tl.add(() => title.classList.add("inked"));
  return new Promise((r) => tl.eventCallback("onComplete", r));
}

/* ── headings: purple stencil letters, inked one by one when they come into view ── */
export function stencilHeadings(els, { reduced }) {
  els.forEach((el) => {
    // a <br> between the lines is a space in the spoken name ("Ogni segno nasce qui", not "segnonasce")
    el.setAttribute("aria-label", [...el.childNodes].map((n) => (n.nodeName === "BR" ? " " : n.textContent)).join("").replace(/\s+/g, " ").trim());
    const wrap = (node) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of c.textContent) {
            if (/\s/.test(ch)) { frag.appendChild(document.createTextNode(ch)); continue; }
            const s = document.createElement("span");
            s.className = "c"; s.textContent = ch; s.setAttribute("aria-hidden", "true");
            frag.appendChild(s);
          }
          c.replaceWith(frag);
        } else if (c.nodeType === 1 && c.tagName !== "BR") wrap(c);
      });
    };
    wrap(el);
    el.classList.add("stencil-h");
    const chars = [...el.querySelectorAll(".c")];
    const ink = () => {
      if (reduced) { chars.forEach((c) => c.classList.add("on", "cool")); return; }
      chars.forEach((c, i) => {
        setTimeout(() => {
          c.classList.add("on");
          setTimeout(() => c.classList.add("cool"), 650);
        }, i * 42 + Math.random() * 120);
      });
    };
    ScrollTrigger.create({ trigger: el, start: "top 82%", once: true, onEnter: ink });
  });
}

/* ── ink drips hanging into the next section, growing as it scrolls in ── */
// Liquid drips hanging into the next section (owner, round 8: the old pins looked fake). Plain shapes —
// a band along the edge, a stem + bulb per drip, the falling drops — are fused by an SVG "goo" filter
// (blur, then a hard alpha threshold) into one fluid surface, lit with a specular highlight and a soft
// shadow. Scroll pours the drips; while on screen a heavy bulb now and then swells, necks and lets go.
export function buildDrips(el, { seed = 1, reduced }) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const bone = el.classList.contains("drips-bone");
  const NS = "http://www.w3.org/2000/svg";
  const fid = `goo-${seed}`;
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "drip-svg");
  svg.setAttribute("aria-hidden", "true");
  el.appendChild(svg);
  const [c0, c1, light, spec] = bone ? ["#cfc6bb", "#efe9e1", "#ffffff", 0.75] : ["#4a050c", "#9d0d1b", "#ffd6da", 1.15];
  let W = 0, H = 0, drips = [], drops = [], prog = reduced ? 1 : 0, raf = 0, visible = false;

  function build() {
    W = el.clientWidth || innerWidth;
    H = Math.round(Math.min(340, innerHeight * (+el.dataset.len || 0.32))) + 40; // data-len: longest drip, fraction of the viewport
    svg.setAttribute("viewBox", `0 -14 ${W} ${H}`);
    svg.style.height = `${H}px`;
    svg.innerHTML = `<defs>
      <linearGradient id="${fid}-g" gradientUnits="userSpaceOnUse" x1="0" y1="-14" x2="0" y2="${H}"><stop offset="0" stop-color="${c0}"/><stop offset="1" stop-color="${c1}"/></linearGradient>
      <filter id="${fid}" x="-5%" y="-20%" width="110%" height="140%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5.5" result="b"/>
        <feColorMatrix in="b" values="1 0 0 0 0 0 1 0 0 0 0 0 1 0 0 0 0 0 28 -12" result="goo"/>
        <feGaussianBlur in="goo" stdDeviation="2.4" result="soft"/>
        <feSpecularLighting in="soft" surfaceScale="5" specularConstant="${spec}" specularExponent="34" lighting-color="${light}" result="sp"><feDistantLight azimuth="235" elevation="50"/></feSpecularLighting>
        <feComposite in="sp" in2="goo" operator="in" result="spIn"/>
        <feComposite in="goo" in2="spIn" operator="arithmetic" k2="1" k3="0.6" result="lit"/>
        <feGaussianBlur in="goo" stdDeviation="4" result="sh0"/><feOffset in="sh0" dy="5" result="sh1"/>
        <feColorMatrix in="sh1" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 .5 0" result="shadow"/>
        <feMerge><feMergeNode in="shadow"/><feMergeNode in="lit"/></feMerge>
      </filter></defs><g filter="url(#${fid})" fill="url(#${fid}-g)"></g>`;
    const g = svg.querySelector("g");
    const add = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); g.appendChild(n); return n; };
    add("rect", { x: -30, y: -40, width: W + 60, height: 46 }); // the band
    for (let x = -10; x < W + 20; x += 14 + rnd() * 26) add("circle", { cx: x, cy: 4 + rnd() * 5, r: 6 + rnd() * 9 }); // its lumpy edge
    const n = Math.max(9, Math.round(W / 82));
    drips = Array.from({ length: n }, (_, i) => {
      const w = 6 + rnd() * 11;
      const d = { x: ((i + 0.15 + rnd() * 0.7) / n) * W, w, L: 14 + Math.pow(rnd(), 1.7) * (H - 70), delay: rnd() * 0.3, swell: 0 };
      d.stem = add("rect", { x: d.x - w / 2, y: 0, width: w, height: 0, rx: w / 2 });
      d.bulb = add("circle", { cx: d.x, cy: 0, r: w * 0.62 });
      return d;
    });
    drops = [];
    paint();
  }
  const len = (d) => { const k = Math.max(0, Math.min(1, (prog - d.delay) / 0.7)); return d.L * k * k * (3 - 2 * k); };
  function paint() {
    for (const d of drips) {
      const l = len(d);
      d.stem.setAttribute("height", Math.max(0, l).toFixed(1));
      d.bulb.setAttribute("cy", l.toFixed(1));
      d.bulb.setAttribute("r", (d.w * (0.62 + 0.22 * d.swell)).toFixed(2));
    }
  }
  // a drop: the bulb swells, then a bead leaves it under gravity; the goo draws the neck and breaks it
  function spawn(now) {
    const ready = drips.filter((d) => len(d) > 28 && !d.busy);
    if (!ready.length) return;
    const d = ready[Math.floor(rnd() * ready.length)];
    d.busy = true;
    const r = d.w * 0.58;
    const node = document.createElementNS(NS, "circle");
    node.setAttribute("cx", d.x.toFixed(1)); node.setAttribute("r", r.toFixed(2)); node.setAttribute("cy", len(d).toFixed(1));
    svg.querySelector("g").appendChild(node);
    drops.push({ d, node, t0: now, y: len(d), v: 0 });
  }
  // frames run only while a drop is in the air (the filter is costly to repaint), then the next one is booked
  let timer = 0, last = 0;
  function book() { clearTimeout(timer); if (visible) timer = setTimeout(() => { spawn(performance.now()); if (!raf) raf = requestAnimationFrame(frame); }, 1400 + rnd() * 2600); }
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 1 / 60); last = now;
    for (let i = drops.length - 1; i >= 0; i--) {
      const o = drops[i], t = (now - o.t0) / 1000;
      if (t < 0.7) { o.d.swell = Math.sin((t / 0.7) * Math.PI * 0.5); o.y = len(o.d) + o.d.w * 0.25 * o.d.swell; }
      else { o.d.swell = Math.max(0, o.d.swell - dt * 5); o.v += 520 * dt; o.y += o.v * dt; }
      o.node.setAttribute("cy", o.y.toFixed(1));
      if (o.y > H + 20) { o.node.remove(); o.d.busy = false; o.d.swell = 0; drops.splice(i, 1); }
    }
    paint();
    if (drops.length && visible) raf = requestAnimationFrame(frame);
    else { last = 0; book(); }
  }
  build();
  let lastW = innerWidth;
  addEventListener("resize", () => { if (Math.abs(innerWidth - lastW) > 2) { lastW = innerWidth; build(); } });
  if (reduced) return;
  ScrollTrigger.create({
    trigger: el, start: "top 95%", end: "top 15%", scrub: 0.4,
    onUpdate: (self) => { prog = self.progress; if (!raf) paint(); },
  });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) book(); else clearTimeout(timer);
  }).observe(svg);
}
