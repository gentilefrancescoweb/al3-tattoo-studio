// Act 1 — flying tattoos: his real designs, redrawn clean from the photos and cut out as stickers
// (scripts/lift-redraws.py; the footer discloses the redraws),
// drift past the camera in the dark like loose flash stickers, washed red from the left and
// blue from the right like the VVV neon, through ink smoke and floating ink droplets.
// Scroll flies the camera forward; the cursor tilts it. Planes recycle: each time one passes
// the camera it comes back far away wearing the next design in the pool, so a visit can see
// all of them without loading all of them.
import * as THREE from "three";

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
// The quad is PAD× larger than the sticker so the glow can spill past its edge.
const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uSide;   // -1 = left (red neon) … 1 = right (blue neon)
  uniform float uHover;
  uniform float uReady;
  uniform float uFog;
  uniform float uPad;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec2 uv = (vUv - .5) * uPad + .5;
    float inside = step(0., uv.x) * step(uv.x, 1.) * step(0., uv.y) * step(uv.y, 1.);
    vec4 s = texture2D(map, clamp(uv, 0., 1.)) * inside;
    float halo = textureLod(map, clamp(uv, 0., 1.), 4.).a * (.8 + .2 * inside);
    vec3 wash = mix(vec3(1., .12, .2), vec3(.25, .5, 1.), smoothstep(-.9, .9, uSide));
    float lum = dot(s.rgb, vec3(.299, .587, .114));
    vec3 col = s.rgb * (.95 + uHover * .1) + wash * lum * (.07 + .07 * abs(uSide)) * (1. - uHover);
    vec3 glow = wash * (.8 + uHover * .9);
    float ga = halo * (.75 + uHover * .4) * (1. - s.a) * smoothstep(1.2, 4., vDepth); // no halo smear up close
    vec3 outc = col + glow * ga; // premultiplied texture: col already carries s.a
    float a = s.a + ga;
    float fog = 1. - exp(-pow(vDepth * uFog, 2.));
    outc = mix(outc, vec3(.043, .039, .043) * a, fog);
    float near = smoothstep(.9, 2.6, vDepth) * uReady; // dissolve before a design fills the lens
    gl_FragColor = vec4(outc * near, a * near);
  }
`;

// ink smoke: domain-warped fbm, rendered at quarter resolution and stretched behind the scene
const SMOKE = /* glsl */ `
  uniform float uT;
  uniform float uScroll;
  uniform vec2 uAspect;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) { vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.02 + 3.1; a *= .5; } return v; }
  void main() {
    vec2 p = (vUv - .5) * uAspect * 2.4;
    float t = uT * .035 + uScroll * 3.78; // smoke drifts with the longer flight (x4.2 of the original)
    vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, -t * .8)));
    float f = fbm(p * 1.3 + q * 2.2 + vec2(t * .6, -t));
    float ink = smoothstep(.42, .95, f);
    vec3 red = vec3(.55, .04, .08), blue = vec3(.08, .2, .62);
    vec3 col = mix(red, blue, smoothstep(-.7, .7, (vUv.x - .5) * 2. + (q.x - .5)));
    col = mix(col, vec3(.55, .5, .47), smoothstep(.75, 1., f) * .35);  // pale wisps
    float edge = smoothstep(.0, .9, abs(vUv.x - .5) * 2.);             // denser towards the neon
    gl_FragColor = vec4(col * ink * (.12 + .3 * edge), 1.);
  }
`;

const PAD = 1.3;

export function createTunnel(canvas, { pool, mobile, reduced, gate, gateFirst = 24, onPick, onHover }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance", premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.setClearColor(0x0b0a0b, 1);
  renderer.autoClear = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);

  // ── smoke pass (quarter resolution) ──
  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quadGeo = new THREE.PlaneGeometry(2, 2);
  const smokeMat = new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: SMOKE, uniforms: { uT: { value: 0 }, uScroll: { value: 0 }, uAspect: { value: new THREE.Vector2(1, 1) } },
    depthTest: false, depthWrite: false,
  });
  const smokeScene = new THREE.Scene();
  smokeScene.add(new THREE.Mesh(quadGeo, smokeMat));
  const smokeRT = new THREE.WebGLRenderTarget(16, 16, { depthBuffer: false });
  const backMat = new THREE.ShaderMaterial({ // raw passthrough: no colour-space conversion on the way out
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: "uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(map, vUv).rgb, 1.); }",
    uniforms: { map: { value: smokeRT.texture } }, depthTest: false, depthWrite: false,
  });
  const backScene = new THREE.Scene();
  backScene.add(new THREE.Mesh(quadGeo, backMat));

  // ── textures: lazily loaded, least-recently-used evicted (GPU memory stays flat) ──
  const N = mobile ? 30 : 66;
  const MAX_TEX = N + (mobile ? 12 : 24);
  const cache = new Map();
  const uploads = []; // decoded, waiting for the GPU: a burst of arrivals never lands in one frame (round 8 mobile pass)
  const UPLOADS_PER_FRAME = mobile ? 1 : 2;
  let clock = 0;
  function texFor(src, gated) {
    let e = cache.get(src);
    if (!e) {
      const img = new Image();
      img.decoding = "async";
      img.src = src;
      if (gated) gate?.image(img);
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.NoColorSpace;
      tex.premultiplyAlpha = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter; // mips feed the glow
      tex.generateMipmaps = true;
      e = { tex, ready: false, img, aspect: 1, waiters: [], users: 0 };
      const queue = () => { e.aspect = img.naturalWidth / img.naturalHeight; uploads.push(e); };
      // decode() decodes off the main thread; uploading an undecoded image decodes it synchronously, mid-frame
      img.decode().then(queue, () => { if (img.complete && img.naturalWidth) queue(); else img.addEventListener("load", queue, { once: true }); });
      cache.set(src, e);
      if (cache.size > MAX_TEX) {
        let oldest = null;
        for (const [k, v] of cache) if (!v.users && (!oldest || v.used < oldest[1].used)) oldest = [k, v];
        if (oldest) { oldest[1].tex.dispose(); cache.delete(oldest[0]); }
      }
    }
    e.used = ++clock;
    return e;
  }

  const SPACING = mobile ? 1.3 : 0.72;
  const LEN = N * SPACING;
  const geo = new THREE.PlaneGeometry(1, 1);
  let next = 0;
  const rnd = (i, k) => { const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };

  function wear(m, idx, gated = false) {
    const item = pool[idx % pool.length];
    const prev = m.userData.entry;
    if (prev) prev.users--;
    const e = texFor(item.hsrc, gated);
    e.users++;
    m.userData.entry = e;
    m.userData.item = item;
    m.material.uniforms.map.value = e.tex;
    m.material.uniforms.uReady.value = 0;
    const apply = () => {
      if (m.userData.entry !== e) return;
      const a = e.aspect, S = m.userData.size;
      const w = a >= 1 ? S : S * a, h = a >= 1 ? S / a : S;
      m.userData.base = [w * PAD, h * PAD];
      m.material.uniforms.uReady.value = 1;
    };
    if (e.ready) apply(); else e.waiters.push(apply);
  }

  const planes = Array.from({ length: N }, (_, i) => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: { map: { value: null }, uSide: { value: 0 }, uHover: { value: 0 }, uReady: { value: 0 }, uFog: { value: mobile ? 0.055 : 0.05 }, uPad: { value: PAD } },
    });
    const mesh = new THREE.Mesh(geo, mat);
    const ring = rnd(i, 1);
    mesh.userData = {
      i, lap: 0, hover: 0, base: [1, 1],
      ang: i * 2.39996 + 0.6,                                  // golden angle: an even ring
      rad: ring < 0.18 ? 0.32 + ring : 0.62 + rnd(i, 5) * 0.75, // a few skim the axis and fly through the title
      size: (mobile ? 1.35 : 1.3) + rnd(i, 6) * 0.75,
      roll: (rnd(i, 2) - 0.5) * 0.7,
      ph: rnd(i, 3) * Math.PI * 2, sp: 0.35 + rnd(i, 4) * 0.4,
    };
    scene.add(mesh);
    wear(mesh, next++, i < gateFirst);
    return mesh;
  });

  // ── ink droplets: soft points drifting with the flight ──
  const PN = mobile ? 260 : 700;
  const pPos = new Float32Array(PN * 3), pSeed = new Float32Array(PN);
  for (let k = 0; k < PN; k++) {
    const a = rnd(k, 11) * Math.PI * 2, r = 0.4 + rnd(k, 12) * 3.2;
    pPos.set([Math.cos(a) * r * 1.6, Math.sin(a) * r, -rnd(k, 13) * 40], k * 3);
    pSeed[k] = rnd(k, 14);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute("seed", new THREE.BufferAttribute(pSeed, 1));
  const pMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uFly: { value: 0 }, uT: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: /* glsl */ `
      attribute float seed;
      uniform float uFly, uT, uPx;
      varying float vA; varying vec3 vC;
      void main() {
        vec3 p = position;
        p.z = mod(p.z + uFly * (.7 + seed * .6), 40.) - 40.;   // wraps: endless drift towards the camera
        p.x += sin(uT * .4 + seed * 40.) * .15; p.y += cos(uT * .3 + seed * 30.) * .15;
        vec4 mv = modelViewMatrix * vec4(p, 1.);
        gl_Position = projectionMatrix * mv;
        float d = -mv.z;
        gl_PointSize = (1.5 + seed * 4.) * uPx * (6. / max(d, .5));
        vA = smoothstep(40., 8., d) * smoothstep(.3, 2., d) * (.25 + seed * .5);
        vC = mix(vec3(1., .2, .27), vec3(.35, .6, 1.), smoothstep(-1.5, 1.5, p.x));
        vC = mix(vC, vec3(.93, .9, .86), step(.82, seed));
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying vec3 vC;
      void main() { float d = length(gl_PointCoord - .5); float a = smoothstep(.5, .1, d) * vA; gl_FragColor = vec4(vC * a, a); }`,
  });
  const points = new THREE.Points(pGeo, pMat);
  points.frustumCulled = false;
  scene.add(points);

  let w = 1, h = 1, rx = 3, ry = 2.4;
  const fit = () => {
    w = canvas.clientWidth || innerWidth; h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const a = w / h;
    rx = a > 1 ? 2.4 * Math.min(a, 1.9) : 1.85;
    ry = a > 1 ? 2.3 : 2.8;
    const pr = renderer.getPixelRatio();
    smokeRT.setSize(Math.max(8, Math.round((w * pr) / 4)), Math.max(8, Math.round((h * pr) / 4)));
    smokeMat.uniforms.uAspect.value.set(a, 1);
    pMat.uniforms.uPx.value = pr;
  };
  fit();

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  let mx = 0, my = 0, cmx = 0, cmy = 0, hovered = null;
  const fine = !mobile && matchMedia("(pointer: fine)").matches;
  const hitAt = (v) => { // the nearest design under a point of the canvas (ndc), close enough to be a real target
    ray.setFromCamera(v, camera);
    const hit = ray.intersectObjects(planes, false).find((h) => h.distance > 1.6 && h.distance < 14 && h.object.material.uniforms.uReady.value > 0);
    return hit ? hit.object : null;
  };
  const toNdc = (e, v) => { const r = canvas.getBoundingClientRect(); return v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
  if (fine) {
    addEventListener("pointermove", (e) => {
      mx = (e.clientX / innerWidth) * 2 - 1;
      my = (e.clientY / innerHeight) * 2 - 1;
      toNdc(e, ndc);
    });
  }
  // a click opens the design under the pointer; on touch screens a tap does the same (owner, round 8: "you cannot click
  // on the artwork gallery in the hero page" on mobile — the pick used to need a hover, which touch never has)
  const tap = new THREE.Vector2();
  canvas.addEventListener("click", (e) => {
    const m = fine ? hovered : hitAt(toNdc(e, tap));
    if (m) onPick?.(m.userData.item);
  });

  let travel = 0, scrollP = 0, active = true, lastT = performance.now(), time = 0;
  // reduced motion: a calm flight, not a frozen one (owner, round 8: "there are no animations on mobile in the hero page" —
  // phones with Reduce Motion or a battery saver on got a still tunnel): 40% of the drift, the sway at half pace
  const AUTO = reduced ? 0.22 : 0.55, PACE = reduced ? 0.5 : 1;

  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!active) return;
    for (let k = 0; k < UPLOADS_PER_FRAME && uploads.length; k++) {
      const e = uploads.shift();
      if (![...cache.values()].includes(e)) continue; // evicted meanwhile
      e.tex.needsUpdate = true;
      e.ready = true;
      e.waiters.forEach((f) => f()); e.waiters = [];
    }
    travel += AUTO * dt;
    time += dt * PACE;
    const fly = travel + scrollP * 84; // 84 units over the hero's scroll (20 → 28 → 42 → 84: longer tunnel, same speed)
    cmx += (mx - cmx) * 0.04; cmy += (my - cmy) * 0.04;
    camera.position.set(cmx * 0.45, -cmy * 0.3, 0);
    camera.lookAt(cmx * -0.6, cmy * 0.4, -10);

    for (const m of planes) {
      const u = m.userData;
      const raw = u.i * SPACING - fly;
      const lap = Math.floor(raw / LEN);
      if (lap !== u.lap) { u.lap = lap; wear(m, next++); } // passed the camera: back far away with a new design
      const depth = raw - lap * LEN - 1.2;
      const x = Math.cos(u.ang) * rx * u.rad, y = Math.sin(u.ang) * ry * u.rad + Math.sin(time * u.sp + u.ph) * 0.07;
      m.position.set(x, y, -depth);
      m.rotation.set(y * -0.06 + Math.sin(time * u.sp * 0.8 + u.ph) * 0.12, x * -0.12 + Math.sin(time * u.sp + u.ph * 2) * 0.35, u.roll);
      m.material.uniforms.uSide.value = Math.max(-1, Math.min(1, x / rx));
    }
    if (fine) {
      const nextH = hitAt(ndc);
      if (nextH !== hovered) { hovered = nextH; onHover?.(!!hovered); }
    }
    for (const m of planes) {
      const u = m.userData;
      u.hover += ((m === hovered ? 1 : 0) - u.hover) * 0.12;
      m.material.uniforms.uHover.value = u.hover;
      const s = 1 + u.hover * 0.1;
      m.scale.set(u.base[0] * s, u.base[1] * s, 1);
    }
    pMat.uniforms.uFly.value = fly;
    pMat.uniforms.uT.value = time;
    smokeMat.uniforms.uT.value = time;
    smokeMat.uniforms.uScroll.value = scrollP;

    renderer.setRenderTarget(smokeRT);
    renderer.render(smokeScene, ortho);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(backScene, ortho);
    renderer.render(scene, camera);
  }

  return {
    frame,
    fit,
    setScroll(p) { scrollP = p; },
    setActive(on) { active = on; if (on) lastT = performance.now(); },
  };
}
