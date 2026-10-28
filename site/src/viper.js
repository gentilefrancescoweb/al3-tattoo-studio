// The viper, drawn from scratch (owner, round 8: "not smooth at all, re-write it from scratch"). One
// continuous tapered silhouette per frame — no slices, no seams — shaded by nested smooth ribbons that
// lean toward the light, a Vipera zigzag down the back, a bold flash-tattoo outline, and a vector head in
// profile: hinged jaw, slit pupil under a heavy brow, fangs, a forked tongue that flicks. The head always
// points where the body is going; aimNeck() bends the neck so it can look at the cursor.
//
//   viperPath(ctrl, step)      Catmull-Rom through control points (head first), resampled every `step` px
//   aimNeck(pts, target, amt)  bend the first part of a path so the head turns toward `target`
//   drawViper(ctx, pts, o)     draw it; o = { W, reveal, stencil, eye, tongue, jaw, time, spark, layer, front, out, state,
//                                face, level, aim, aimAmt } — level: how far a rearing head is held level (0 = along the neck),
//                                aim/aimAmt: a point the head turns to look at

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;
const INK = "#0b0909", STENCIL = "rgba(150,118,255,.92)";
const LIGHT = [-0.45, -0.89]; // light from the top left, in screen space

/* ── path ─────────────────────────────────────────────────────────────── */
export function viperPath(ctrl, step = 4) {
  const n = ctrl.length;
  if (n < 2) return ctrl.map((p) => [p[0], p[1]]);
  const P = [[2 * ctrl[0][0] - ctrl[1][0], 2 * ctrl[0][1] - ctrl[1][1]], ...ctrl, [2 * ctrl[n - 1][0] - ctrl[n - 2][0], 2 * ctrl[n - 1][1] - ctrl[n - 2][1]]];
  const dense = [];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const m = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      dense.push([0, 1].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  dense.push([ctrl[n - 1][0], ctrl[n - 1][1]]);
  const out = [dense[0]];
  let need = step;
  for (let i = 1; i < dense.length; i++) {
    let [ax, ay] = dense[i - 1];
    const [bx, by] = dense[i];
    let seg = Math.hypot(bx - ax, by - ay);
    while (seg >= need) {
      const t = need / seg;
      ax += (bx - ax) * t; ay += (by - ay) * t;
      out.push([ax, ay]);
      seg -= need; need = step;
    }
    need -= seg;
  }
  const last = dense[dense.length - 1], tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.3) out.push(last);
  return out;
}

// bend the neck (the first `frac` of the points) so the head turns toward target, at most maxTurn radians
export function aimNeck(pts, target, amt = 1, { frac = 0.2, maxTurn = 1.25 } = {}) {
  if (!target || amt <= 0 || pts.length < 8) return pts;
  const k = Math.max(4, Math.round(pts.length * frac));
  const piv = pts[k], head = pts[0];
  const cur = Math.atan2(head[1] - piv[1], head[0] - piv[0]);
  let want = Math.atan2(target[1] - piv[1], target[0] - piv[0]) - cur;
  want = Math.atan2(Math.sin(want), Math.cos(want));
  const turn = Math.max(-maxTurn, Math.min(maxTurn, want)) * amt;
  return pts.map((p, i) => {
    if (i >= k) return p;
    const a = turn * smooth(1 - i / k), c = Math.cos(a), s = Math.sin(a);
    const dx = p[0] - piv[0], dy = p[1] - piv[1];
    return [piv[0] + dx * c - dy * s, piv[1] + dx * s + dy * c];
  });
}

/* ── body geometry ───────────────────────────────────────────────────── */
// half-width along the body, s = 0 at the neck, 1 at the tail tip
const profile = (s) => (s < 0.07 ? lerp(0.66, 0.86, s / 0.07) : s < 0.24 ? lerp(0.86, 1, smooth((s - 0.07) / 0.17)) : s < 0.56 ? 1 : lerp(1, 0.035, Math.pow(smooth((s - 0.56) / 0.44), 0.85)));

function frames(pts) {
  const n = pts.length, N = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
    let dx = a[0] - b[0], dy = a[1] - b[1]; // towards the head
    const l = Math.hypot(dx, dy) || 1;
    dx /= l; dy /= l;
    N[i] = [-dy, dx];
  }
  return N;
}
function through(ctx, arr) {
  for (let k = 1; k < arr.length - 1; k++) ctx.quadraticCurveTo(arr[k][0], arr[k][1], (arr[k][0] + arr[k + 1][0]) / 2, (arr[k][1] + arr[k + 1][1]) / 2);
  const l = arr[arr.length - 1];
  ctx.lineTo(l[0], l[1]);
}
// a closed smooth ribbon over points i0..i1 (tail end), half-width hw·scale, centre shifted toward the light
function ribbon(ctx, pts, N, hw, i0, i1, scale, lean) {
  const L = [], R = [];
  for (let i = i0; i <= i1; i++) {
    const [nx, ny] = N[i], w = hw[i];
    const sh = lean * w * (nx * LIGHT[0] + ny * LIGHT[1]);
    const cx = pts[i][0] + nx * sh, cy = pts[i][1] + ny * sh;
    L.push([cx + nx * w * scale, cy + ny * w * scale]);
    R.push([cx - nx * w * scale, cy - ny * w * scale]);
  }
  ctx.moveTo(L[0][0], L[0][1]);
  through(ctx, L);
  const t = pts[i1], tb = pts[Math.max(i0, i1 - 1)];
  ctx.lineTo(t[0] + (t[0] - tb[0]) * 0.6, t[1] + (t[1] - tb[1]) * 0.6); // the tail tip
  R.reverse();
  ctx.lineTo(R[0][0], R[0][1]);
  through(ctx, R);
  ctx.closePath();
}

// nested ribbons from the dark flanks to the bone ridge, fine enough that no step shows; inner ones lean to the light
const RAMP = [[0, [22, 18, 17]], [0.22, [50, 42, 38]], [0.5, [104, 94, 86]], [0.76, [168, 158, 147]], [1, [226, 218, 207]]];
const SHADES = Array.from({ length: 20 }, (_, k) => {
  const t = k / 19, sc = 1 - t * 0.93;
  let i = 0; while (i < RAMP.length - 2 && t > RAMP[i + 1][0]) i++;
  const [t0, c0] = RAMP[i], [t1, c1] = RAMP[i + 1], f = smooth((t - t0) / (t1 - t0));
  return [sc, `rgb(${c0.map((c, j) => Math.round(lerp(c, c1[j], f))).join(",")})`];
});

function drawBody(ctx, pts, N, hw, i0, W, time) {
  const i1 = pts.length - 1;
  if (i1 - i0 < 2) return;
  for (const [sc, col] of SHADES) {
    ctx.beginPath(); ribbon(ctx, pts, N, hw, i0, i1, sc, 0.42 * (1 - sc)); ctx.fillStyle = col; ctx.fill();
  }
  // the Vipera zigzag down the back, and the dark spots along the flanks
  ctx.save();
  ctx.beginPath(); ribbon(ctx, pts, N, hw, i0, i1, 1, 0); ctx.clip();
  const period = Math.max(4, Math.round((W * 0.95) / Math.max(1, Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]))));
  ctx.strokeStyle = "#0f0b0b"; ctx.fillStyle = "#120d0d";
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  let prev = null;
  const zEnd = Math.round(i1 * 0.9);
  for (let i = Math.max(i0, 2), k = 0; i <= zEnd; i += Math.max(1, Math.round(period / 2)), k++) {
    const s = i / i1, sign = (Math.floor(i / Math.max(1, Math.round(period / 2))) % 2) ? 1 : -1;
    const amp = 0.38 * hw[i] * sign;
    const p = [pts[i][0] + N[i][0] * amp, pts[i][1] + N[i][1] * amp];
    if (prev) {
      ctx.lineWidth = Math.max(1, W * 0.26 * profile(s));
      ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(p[0], p[1]); ctx.stroke();
      // flank spots between the zigzag's teeth
      const m = [(prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2], o = -0.8 * hw[i] * sign;
      ctx.beginPath(); ctx.ellipse(m[0] + N[i][0] * o, m[1] + N[i][1] * o, Math.max(0.6, W * 0.07 * profile(s)), Math.max(0.6, W * 0.11 * profile(s)), Math.atan2(N[i][1], N[i][0]), 0, Math.PI * 2); ctx.fill();
    }
    prev = p;
  }
  ctx.restore();
  // a soft sheen along the ridge and the flash outline
  ctx.beginPath(); ribbon(ctx, pts, N, hw, i0, i1, 0.07, 0.75); ctx.fillStyle = "rgba(255,248,238,.35)"; ctx.fill();
  ctx.beginPath(); ribbon(ctx, pts, N, hw, i0, i1, 1, 0);
  ctx.lineWidth = Math.max(1.4, W * 0.075); ctx.strokeStyle = INK; ctx.stroke();
}

/* ── head (profile): x forward, y down; units of u ─────────────────────── */
// a viper's head (round 8, "more realistic and angrier"): a broad triangle, deep at the back where the venom glands
// swell, a heavy brow plate sloping down over the eye (the scowl), a short snout with the small nose horn of the
// horned viper, and a mouth line that turns down at the back
const UPPER = [[-0.2, -0.2], [-0.1, -0.42], [0.1, -0.56], [0.36, -0.6], [0.58, -0.64], [0.72, -0.7], [0.86, -0.58], [1.02, -0.46],
  [1.16, -0.4], [1.26, -0.44], [1.32, -0.54], [1.38, -0.46], [1.42, -0.32], [1.4, -0.18]];
const LIP = [[1.4, -0.18], [1.24, -0.12], [1.02, -0.04], [0.78, 0.06], [0.52, 0.18], [0.3, 0.28]];
const LOWER = [[0.3, 0.28], [0.56, 0.2], [0.82, 0.08], [1.06, -0.02], [1.28, -0.1], [1.32, -0.04], [1.16, 0.08], [0.9, 0.24], [0.62, 0.42],
  [0.34, 0.56], [0.06, 0.6], [-0.14, 0.46], [-0.22, 0.2]];
const HINGE = [0.3, 0.28];
const lipY = (x) => 0.18 - (x - 0.52) * 0.417; // the mouth line between the hinge and the snout

function headFrame(o, d) {
  // which side of the head faces the viewer's "up": follow the direction, keep the last choice when vertical
  const st = o.state || (o.state = {});
  if (Math.abs(d[0]) > 0.3) st.side = Math.sign(d[0]);
  const side = st.side ?? o.face ?? -1;
  return [-d[1] * side, d[0] * side]; // "down" in head space
}
const NECK_AT = [0.02, 0.1]; // where the neck enters the head (head space): low at the back, under the venom glands

// the head's direction: along the neck, held level like a rearing viper's (o.level), turned toward o.aim
function headDir(o, dn, p) {
  let a = Math.atan2(dn[1], dn[0]);
  const wrap = (x) => Math.atan2(Math.sin(x), Math.cos(x));
  if (o.level) {
    const face = Math.abs(dn[0]) > 0.25 ? Math.sign(dn[0]) : (o.face ?? -1);
    a += wrap((face < 0 ? Math.PI : 0) - a) * o.level;
  }
  if (o.aim && o.aimAmt > 0) {
    const want = Math.atan2(o.aim[1] - p[1], o.aim[0] - p[0]);
    const lim = 1.9, base = Math.atan2(dn[1], dn[0]); // never twist past the neck
    let t = wrap(want - base); t = Math.max(-lim, Math.min(lim, t));
    a += wrap(base + t - a) * Math.min(1, o.aimAmt);
  }
  return [Math.cos(a), Math.sin(a)];
}

function drawHead(ctx, p, d, u, o, stencilOnly) {
  const down = headFrame(o, d);
  const X = (x, y) => [p[0] + d[0] * x * u + down[0] * y * u, p[1] + d[1] * x * u + down[1] * y * u];
  const jaw = clamp01(o.jaw || 0) * 0.95; // radians of the lower jaw
  const rot = ([x, y]) => {
    const dx = x - HINGE[0], dy = y - HINGE[1], c = Math.cos(jaw), s = Math.sin(jaw);
    return [HINGE[0] + dx * c - dy * s, HINGE[1] + dx * s + dy * c];
  };
  const lower = LOWER.map(rot);
  const shape = (pts) => { ctx.beginPath(); const q = pts.map(([x, y]) => X(x, y)); ctx.moveTo(q[0][0], q[0][1]); through(ctx, q); };
  const lw = Math.max(1.3, u * 0.07);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (stencilOnly) {
    ctx.strokeStyle = STENCIL; ctx.lineWidth = Math.max(1, u * 0.035);
    shape([...UPPER, ...LIP]); ctx.stroke(); shape(lower); ctx.stroke();
    return;
  }
  // mouth: the throat between the jaws when they open
  if (jaw > 0.02) {
    shape([...LIP, ...lower.slice(1, 4).reverse(), LIP[0]]); ctx.closePath();
    ctx.fillStyle = "#4d0a11"; ctx.fill();
  }
  // lower jaw
  shape([...lower, [-0.22, 0.06]]); ctx.closePath();
  let g = ctx.createLinearGradient(...X(0.5, 0.2), ...X(0.5, 0.6));
  g.addColorStop(0, "#ddd3c6"); g.addColorStop(1, "#7a6f67");
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // fangs fold down as the jaw opens
  if (jaw > 0.12) {
    const f = smooth((jaw - 0.12) / 0.5);
    for (const [fx, w] of [[1.22, 0.07], [1.04, 0.06]]) {
      const y = lipY(fx);
      shape([[fx - w, y], [fx - 0.06 * f, y + 0.5 * f], [fx + w, y]]); ctx.closePath();
      ctx.fillStyle = "#f3ede4"; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke();
    }
  }
  // upper head: dark keeled crown, pale lips, the viper's dark stripe from the eye to the jaw angle
  const HEAD = [...UPPER, ...LIP.slice(1), [0.08, 0.34], [-0.16, 0.26], [-0.24, 0.04]];
  shape(HEAD); ctx.closePath();
  g = ctx.createLinearGradient(...X(0.6, -0.66), ...X(0.6, 0.26));
  g.addColorStop(0, "#7d7168"); g.addColorStop(0.3, "#a3978c"); g.addColorStop(0.62, "#c9bfb3"); g.addColorStop(1, "#efe7db"); // reads on the dark page
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  shape([[0.68, -0.36], [0.42, -0.16], [0.14, 0.12], [-0.08, 0.22], [-0.18, 0.08], [0.04, -0.1], [0.42, -0.36]]); ctx.closePath();
  ctx.fillStyle = "rgba(12,9,9,.9)"; ctx.fill(); // the stripe behind the eye
  shape([[-0.04, -0.44], [0.26, -0.38], [0.46, -0.6], [0.26, -0.52], [0.12, -0.58]]); ctx.closePath(); ctx.fill(); // the dark V on the crown
  ctx.strokeStyle = "rgba(10,8,8,.45)"; ctx.lineWidth = Math.max(0.6, u * 0.02);
  for (let k = 0; k < 7; k++) { // keeled scales over the crown, slanting back
    const x = 0.02 + k * 0.13;
    ctx.beginPath(); ctx.moveTo(...X(x, -0.56 - k * 0.01)); ctx.lineTo(...X(x - 0.1, -0.42 - k * 0.008)); ctx.stroke();
  }
  ctx.strokeStyle = "rgba(20,15,14,.5)";
  for (let k = 0; k < 6; k++) { // labial scales along the lip
    const x = 0.5 + k * 0.14;
    ctx.beginPath(); ctx.moveTo(...X(x, lipY(x) - 0.01)); ctx.lineTo(...X(x + 0.03, lipY(x) - 0.12)); ctx.stroke();
  }
  ctx.restore();
  shape(HEAD); ctx.closePath();
  ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
  // the grim corner of the mouth, turning down past the hinge
  ctx.beginPath(); ctx.moveTo(...X(0.36, 0.25)); ctx.quadraticCurveTo(...X(0.2, 0.32), ...X(0.1, 0.46)); ctx.lineWidth = lw * 0.8; ctx.stroke();
  // nostril on the snout, heat pit below the eye line
  let [nx, ny] = X(1.35, -0.33);
  ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(nx, ny, u * 0.045, u * 0.03, Math.atan2(d[1], d[0]), 0, Math.PI * 2); ctx.fill();
  [nx, ny] = X(1.14, -0.25);
  ctx.beginPath(); ctx.arc(nx, ny, u * 0.032, 0, Math.PI * 2); ctx.fill();
  // eye: red-amber iris, vertical slit, glint; the brow plate cuts across its top
  const [ex, ey] = X(0.74, -0.4), er = u * 0.105, lit = clamp01(o.eye ?? 1);
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2);
  const ig = ctx.createRadialGradient(ex, ey, er * 0.1, ex, ey, er);
  ig.addColorStop(0, `rgb(${Math.round(lerp(70, 255, lit))},${Math.round(lerp(50, 150, lit))},${Math.round(lerp(30, 40, lit))})`);
  ig.addColorStop(1, `rgb(${Math.round(lerp(40, 190, lit))},${Math.round(lerp(28, 40, lit))},${Math.round(lerp(18, 24, lit))})`);
  ctx.fillStyle = ig; ctx.fill(); ctx.lineWidth = lw * 0.7; ctx.strokeStyle = INK; ctx.stroke();
  ctx.save(); ctx.translate(ex, ey); ctx.rotate(Math.atan2(down[1], down[0]));
  ctx.beginPath(); ctx.ellipse(0, 0, er * 0.85, er * 0.2, 0, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  ctx.restore();
  if (lit > 0.3) {
    ctx.fillStyle = `rgba(255,255,255,${(0.9 * lit).toFixed(2)})`;
    const [gx, gy] = X(0.71, -0.43);
    ctx.beginPath(); ctx.arc(gx, gy, er * 0.22, 0, Math.PI * 2); ctx.fill();
    if (lit > 0.6) { ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = `rgba(255,60,30,${(0.16 * lit).toFixed(2)})`; ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  shape([[0.48, -0.52], [0.64, -0.72], [0.86, -0.6], [1.0, -0.46], [0.82, -0.44], [0.62, -0.48]]); ctx.closePath(); // the brow plate, hooding the eye, sloping down to the snout
  ctx.fillStyle = "#2a2220"; ctx.fill(); ctx.lineWidth = lw * 0.6; ctx.stroke();
  // tongue: forked, out between the lips, flicking
  const tg = clamp01(o.tongue || 0);
  if (tg > 0.02) {
    const t = o.time || 0, len = (0.55 + 0.75 * tg) * u, wig = Math.sin(t * 38) * 0.18 * tg;
    const base = X(1.4, -0.15 + jaw * 0.12);
    const dir = [d[0] + down[0] * (0.15 + jaw * 0.3), d[1] + down[1] * (0.15 + jaw * 0.3)];
    const dl = Math.hypot(...dir); dir[0] /= dl; dir[1] /= dl;
    const perp = [-dir[1], dir[0]];
    const mid = [base[0] + dir[0] * len * 0.55 + perp[0] * wig * u, base[1] + dir[1] * len * 0.55 + perp[1] * wig * u];
    const tip = [base[0] + dir[0] * len, base[1] + dir[1] * len];
    ctx.strokeStyle = "#b3121f"; ctx.lineWidth = Math.max(1.2, u * 0.06);
    ctx.beginPath(); ctx.moveTo(base[0], base[1]); ctx.quadraticCurveTo(mid[0], mid[1], tip[0], tip[1]); ctx.stroke();
    ctx.lineWidth = Math.max(1, u * 0.045);
    for (const sgn of [-1, 1]) {
      const f = [tip[0] + dir[0] * u * 0.22 + perp[0] * sgn * u * (0.13 + wig * 0.4), tip[1] + dir[1] * u * 0.22 + perp[1] * sgn * u * (0.13 + wig * 0.4)];
      ctx.beginPath(); ctx.moveTo(tip[0], tip[1]); ctx.lineTo(f[0], f[1]); ctx.stroke();
    }
  }
  if (o.out) { o.out.eye = [ex, ey]; o.out.mouth = X(1.4, -0.15); o.out.head = [p[0], p[1]]; o.out.dir = d; }
}

/* ── the whole viper ─────────────────────────────────────────────────── */
export function drawViper(ctx, pts, o = {}) {
  const n = pts.length;
  if (n < 4) return;
  const W = o.W || 30, u = W * (o.headScale || 1.32); // the head is broader than the neck, as a viper's is
  const N = frames(pts);
  const hw = pts.map((_, i) => (W / 2) * profile(i / (n - 1)));
  const reveal = clamp01(o.reveal ?? 1), stencil = clamp01(o.stencil ?? 1);
  const iInk = Math.round((1 - reveal) * (n - 1)), iSt = Math.round((1 - stencil) * (n - 1));
  // the neck's direction, then the head's; the head is placed so the neck enters it low at the back
  const k = Math.min(n - 1, 5);
  let dn = [pts[0][0] - pts[k][0], pts[0][1] - pts[k][1]];
  const dl = Math.hypot(dn[0], dn[1]) || 1; dn = [dn[0] / dl, dn[1] / dl];
  const d = headDir(o, dn, pts[0]);
  const down = headFrame(o, d);
  const headPos = [pts[0][0] - (d[0] * NECK_AT[0] + down[0] * NECK_AT[1]) * u, pts[0][1] - (d[1] * NECK_AT[0] + down[1] * NECK_AT[1]) * u];

  const paint = () => {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    if (stencil > 0 && iSt < n - 2 && iSt < iInk) { // purple stencil runs ahead of the ink
      ctx.beginPath(); ribbon(ctx, pts, N, hw, iSt, n - 1, 1, 0);
      ctx.strokeStyle = STENCIL; ctx.lineWidth = Math.max(1, W * 0.035); ctx.stroke();
      if (stencil > 0.985 && reveal < 0.985) drawHead(ctx, headPos, d, u, o, true);
    }
    drawBody(ctx, pts, N, hw, iInk, W, o.time || 0);
    if (reveal > 0.985) drawHead(ctx, headPos, d, u, o, false);
    if (o.spark && reveal > 0.003 && reveal < 0.997) { // the needle at the ink front
      const p = pts[iInk];
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], W * 0.9);
      g.addColorStop(0, "rgba(255,255,255,.95)"); g.addColorStop(0.25, "rgba(255,90,110,.55)"); g.addColorStop(1, "rgba(211,23,43,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p[0], p[1], W * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  };

  if (o.layer === "front" && o.front) {
    // only the stretches that pass in front (of the title's letters): clip to generous ribbons around them
    ctx.save(); ctx.beginPath();
    const big = hw.map((w) => Math.max(w, W * 0.5) * 1.6);
    let run = -1;
    for (let i = 0; i <= n; i++) {
      const on = i < n && o.front(i);
      if (on && run < 0) run = i;
      if (!on && run >= 0) { if (i - 1 - run >= 1) ribbon(ctx, pts, N, big, run, i - 1, 1, 0); run = -1; }
    }
    if (o.front(0)) { ctx.moveTo(headPos[0] + u * 1.9, headPos[1]); ctx.arc(headPos[0], headPos[1], u * 1.9, 0, Math.PI * 2); }
    ctx.clip(); paint(); ctx.restore();
  } else paint();
}
