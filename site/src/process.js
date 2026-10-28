// Act 2 — "Dalla linea all'ombra": his owl, from the design to the healed tattoo (owner, round 8: "use this image
// turning into this tattoo"). Two layers, both real: the arm (the healed photo, the same arm with no ink, the limb)
// and his design on a mesh that bends from the flat page onto the arm along a spline fitted between the two
// (scripts/owl-process.py). Scroll: the design draws itself on the page → it lifts onto the arm and only its lines
// stay, as a purple stencil → the needle traces them black → the photo's shading comes in darkest-first, the yellow
// last → the redness heals away. No film, no AI.
import * as THREE from "three";
import { OWL_GRID, OWL_WARP, OWL_DESIGN_ASPECT } from "./owl-warp.js";

const COMMON = /* glsl */ `
  uniform float uP;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p), u = f * f * (3. - 2. * f);
    return mix(mix(hash(i), hash(i + vec2(1., 0.)), u.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), u.x), u.y);
  }
  float fbm(vec2 p) { float v = 0., a = .5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= .5; } return v; }
  float win(float p, float a, float b) { return clamp((p - a) / (b - a), 0., 1.); }
  float lum(vec3 c) { return dot(c, vec3(.299, .587, .114)); }
  // a drawing front sweeping top → bottom with a ragged, hand-made edge (pos = plate uv, y down)
  float field(vec2 pos, float seed) { return pos.y * .78 + fbm(pos * 5. + seed) * .22; }
  float reveal(float f, float k) { float e = k * 1.06; return 1. - smoothstep(e - .035, e, f); }
  float front(float f, float k) { float e = k * 1.06; return smoothstep(e - .016, e - .003, f) * (1. - smoothstep(e - .003, e + .002, f)) * step(.001, k) * step(k, .999); }
`;

// the arm: paper → bare skin in a dim room → the photo's ink, darkest first → healed
const ARM = /* glsl */ `
  precision highp float;
  uniform sampler2D uPhoto, uSkin, uLimb;
  varying vec2 vUv;
  ${COMMON}
  void main() {
    vec2 uv = vUv;
    vec3 photo = texture2D(uPhoto, uv).rgb;
    float limb = texture2D(uLimb, uv).r;
    vec3 skin = texture2D(uSkin, uv).rgb * (1. + (noise(uv * vec2(640., 800.)) - .5) * .05 + (fbm(uv * 60.) - .5) * .05);
    vec3 room = vec3(lum(textureLod(uPhoto, uv, 5.).rgb)) * vec3(.3, .28, .29); // around the arm: the room, dim and unreadable
    vec3 paper = vec3(.94, .925, .9) - fbm(uv * 90.) * .045;

    float sB = win(uP, .21, .33), sD = win(uP, .58, .83), sE = win(uP, .86, .98);
    vec3 col = mix(paper, mix(room, skin, limb), sB);

    float ink = clamp((lum(skin) - lum(photo)) / .42, 0., 1.);
    float yel = smoothstep(.34, .55, (photo.r + photo.g) * .5 - photo.b) * step(photo.b, photo.g);
    float order = max(ink, yel * .3); // black first, then the greys, the yellow packed last
    float T = 1. - sD;
    float shade = smoothstep(T - .02, T + .14, order) * limb * step(.001, sD);
    col = mix(col, photo, shade);
    float fresh = sD * (1. - sE) * max(ink, yel) * limb; // fresh redness that fades as it heals
    col = mix(col, col * vec3(1.06, .84, .82) + vec3(.05, 0., 0.), fresh * .5);
    col = mix(col, photo, sE); // healed: the photo as he posted it, faded owl behind the arm included

    vec2 q = uv - .5;
    col *= 1. - dot(q, q) * .35;
    gl_FragColor = vec4(col, 1.);
  }
`;

const DESIGN_V = /* glsl */ `
  attribute vec2 aWarp;
  uniform float uK;
  varying vec2 vUv, vPos;
  void main() {
    vUv = uv;
    vec2 p = mix(position.xy, aWarp, uK); // plate uv, y down
    vPos = p;
    gl_Position = vec4(p.x * 2. - 1., 1. - p.y * 2., 0., 1.);
  }
`;

// the design: drawn on the page, then only its lines on the arm (stencil purple → needle black), fading as the photo's ink takes over
const DESIGN_F = /* glsl */ `
  precision highp float;
  uniform sampler2D uDesign, uLines, uLimb;
  varying vec2 vUv, vPos;
  ${COMMON}
  void main() {
    vec4 d = texture2D(uDesign, vUv);
    float ln = texture2D(uLines, vUv).r;
    float sA = win(uP, .015, .18), sB = win(uP, .21, .33), sC = win(uP, .38, .56), sD = win(uP, .58, .83);
    float fA = field(vPos, 0.), fC = field(vPos, 3.7);

    // 1 · the drawing: graphite lines first, the shading and colour following just behind
    float lineA = ln * reveal(fA, sA);
    float eF = sA * 1.24 - .16;
    float fillA = 1. - smoothstep(eF - .05, eF, fA);
    float fills = fillA * (1. - win(uP, .2, .27)); // 2 · lifted off the page, only the lines go onto the skin
    vec3 graphite = vec3(.2, .19, .2);
    vec3 stencil = vec3(.38, .27, .68);
    vec3 lineCol = mix(graphite, stencil, win(uP, .23, .33));
    lineCol = mix(lineCol, vec3(.07, .065, .07), reveal(fC, sC)); // 3 · the needle traces them black
    float a = max(lineA * mix(.9, .8, sB), d.a * fills);
    vec3 col = mix(lineCol, d.rgb, d.a * fills / max(a, 1e-3));

    float glow = front(fA, sA) * ln * (1. - sB) * .8 + front(fC, sC) * ln;
    col += vec3(1., .22, .27) * glow * .9;
    a = max(a, glow * .9);
    a *= mix(1., texture2D(uLimb, vPos).r, sB); // on the arm, never on the room
    a *= 1. - sD * sD * (3. - 2. * sD);          // 4 · the photo's own lines take over
    gl_FragColor = vec4(col * a, a);              // premultiplied
  }
`;

export function createProcess(canvas, { mobile, gate }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, premultipliedAlpha: true });
  renderer.setPixelRatio(Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1));
  renderer.autoClear = true;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const load = (src, { mips = false } = {}) => {
    const img = new Image();
    img.src = src;
    gate?.image(img);
    const tex = new THREE.Texture(img);
    tex.colorSpace = THREE.NoColorSpace;
    tex.generateMipmaps = mips;
    tex.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    tex.flipY = false; // uv y runs down, like the plate
    const ready = img.complete && img.naturalWidth ? Promise.resolve() : new Promise((r) => img.addEventListener("load", r, { once: true }));
    return { tex, ready: ready.then(() => { tex.needsUpdate = true; }) };
  };
  const photo = load("/process/owl.webp", { mips: true }); // mips: the blurred room around the arm
  const skin = load("/process/owl_skin.webp");
  const limb = load("/process/owl_limb.webp");
  const design = load("/process/owl_design.webp", { mips: true });
  const lines = load("/process/owl_lines.webp", { mips: true });

  const uP = { value: 0 };
  const arm = new THREE.ShaderMaterial({
    vertexShader: "varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1. - uv.y); gl_Position = vec4(position.xy, 0., 1.); }",
    fragmentShader: ARM,
    uniforms: { uP, uPhoto: { value: photo.tex }, uSkin: { value: skin.tex }, uLimb: { value: limb.tex } },
    depthTest: false, depthWrite: false,
  });
  const armMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), arm);
  armMesh.renderOrder = 0;
  scene.add(armMesh);

  // the design's mesh: flat on the page (centred, 96% of the plate's height) → where the spline lays it on the arm
  const [cols, rows] = OWL_GRID;
  const h = 0.96, w = h * OWL_DESIGN_ASPECT / (4 / 5), x0 = (1 - w) / 2, y0 = (1 - h) / 2;
  const n = (cols + 1) * (rows + 1);
  const flat = new Float32Array(n * 3), warp = new Float32Array(n * 2), uvs = new Float32Array(n * 2);
  for (let r = 0, i = 0; r <= rows; r++) for (let c = 0; c <= cols; c++, i++) {
    const u = c / cols, v = r / rows;
    flat[i * 3] = x0 + u * w; flat[i * 3 + 1] = y0 + v * h;
    warp[i * 2] = OWL_WARP[i * 2]; warp[i * 2 + 1] = OWL_WARP[i * 2 + 1];
    uvs[i * 2] = u; uvs[i * 2 + 1] = v;
  }
  const index = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const a = r * (cols + 1) + c, b = a + 1, d = a + cols + 1, e = d + 1;
    index.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(flat, 3));
  geo.setAttribute("aWarp", new THREE.BufferAttribute(warp, 2));
  geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(index);
  const uK = { value: 0 };
  const designMat = new THREE.ShaderMaterial({
    vertexShader: DESIGN_V, fragmentShader: DESIGN_F,
    uniforms: { uP, uK, uDesign: { value: design.tex }, uLines: { value: lines.tex }, uLimb: { value: limb.tex } },
    transparent: true, premultipliedAlpha: true, blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide,
  });
  const designMesh = new THREE.Mesh(geo, designMat);
  designMesh.renderOrder = 1;
  designMesh.frustumCulled = false;
  scene.add(designMesh);

  let ready = false;
  const draw = () => { if (ready) renderer.render(scene, camera); };
  Promise.all([photo, skin, limb, design, lines].map((t) => t.ready)).then(() => { ready = true; draw(); });
  const fit = () => { renderer.setSize(canvas.clientWidth || 1, canvas.clientHeight || 1, false); draw(); };
  fit();
  const ease = (t) => t * t * (3 - 2 * t);
  // paints are synchronous with the scroll update (never deferred to rAF)
  return {
    fit,
    set(p) {
      uP.value = p;
      uK.value = ease(Math.min(1, Math.max(0, (p - 0.2) / 0.13))); // the design bends onto the arm while the page turns into skin
      draw();
    },
  };
}
