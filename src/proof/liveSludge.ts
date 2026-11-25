// Proof: live sludge over a still Cycles plate (docs/art/FIGURES.md, "Live sludge proof").
// tools/art/diorama/live_plate.py writes the plate, the ooze's mask, a basis of the ooze re-rendered with its normal
// tilted 33 ways, and the bubble schedule. Here the ooze sheets move with sludgeBubbles.ts, and each pixel takes
// its colour from the four basis renders nearest its live normal: the lanterns, reflections and glow stay Cycles'.
// The basis leaves the clear coat off; its mirror image of the room is drawn here from Cycles' image of each pool as a
// flat mirror, bent by the live normal (reflection probes fill in where that image has no answer).
// Open live-sludge.html?dir=<folder under public/>; window.renderAt(seconds) draws one moment.
import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { neighbours, creases, type Neighbours } from "../diorama/sludgeCreases";
import { surfaceHeight, tearAt, dropsInAir, swell, type BubbleEvent, type Splat } from "../diorama/sludgeBubbles";
import { glintList, type Lamp } from "../diorama/sludgeGlints";

type Sheet = { name: string; matrix: number[][]; verts: number; tris: number; events: BubbleEvent[]; splat: Splat[] };
type Live = {
  res: [number, number]; camera: { matrix: number[][]; projection: number[][] };
  region: { x: number; y: number; w: number; h: number }; tilts: number[]; turns: number;
  basis: { tilt: number; turn: number }[]; loop_s: number; S: number; swell: number; sheets: Sheet[];
  coat: [number, number, number];
  probe: { size: number; faces: number[][]; centres: number[][]; box: [number[], number[]] };
  pings: { sheet: number; at: number[]; size: number; power: number; color: number[] }[];
  /** the room's lights the coat mirrors, drawn like the pings (live_plate.py lights()) */
  lights?: Lamp[];
  view: { transform: string; exposure: number };
  mirror?: { z: number[]; pos_off: number };
  /** the base layer's shine when drawn live (the basis leaves it out): roughness, IOR, specular level */
  base_spec?: [number, number, number] | null;
};

const rows = (m: number[][]) => new THREE.Matrix4().set(...(m.flat() as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]));

const loadImage = (url: string) => new Promise<HTMLImageElement>((ok, bad) => {
  const im = new Image(); im.onload = () => ok(im); im.onerror = () => bad(new Error(url)); im.src = url;
});

function pixels(im: HTMLImageElement) {
  const c = document.createElement("canvas"); c.width = im.width; c.height = im.height;
  const g = c.getContext("2d", { willReadFrequently: true })!; g.drawImage(im, 0, 0);
  return g.getImageData(0, 0, im.width, im.height).data;
}

/** Texture rows top first, so a pixel (px, py) from the top left samples at (px / w, py / h). */
function topFirst(t: THREE.Texture) {
  t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.minFilter = t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}

/** the most glowing discs (pings and room lights) the coat draws */
const NGLINT = 32;
const LOOK = /* glsl */ `
#define NGLINT ${NGLINT}
uniform highp sampler2DArray basis;
uniform highp sampler2DArray torn;  // the same basis with the skin torn open (tear colour, shine kept)
uniform sampler2D mask;
uniform vec4 region;   // the basis crop: x, y from the top left, w, h (pixels)
uniform vec2 res;
uniform mat4 vp;
uniform int turns;
uniform float tiltStep;  // degrees between tilt rings
uniform float rings;
vec2 pix(vec3 w) {
  vec4 c = vp * vec4(w, 1.0);
  vec2 n = c.xy / c.w;
  return vec2((n.x * 0.5 + 0.5) * res.x, (0.5 - 0.5 * n.y) * res.y);
}
vec3 layer(highp sampler2DArray b, int i, int j, vec2 uv) {
  int k = i == 0 ? 0 : 1 + (i - 1) * turns + j;
  return texture(b, vec3(uv, float(k))).rgb;
}
// the Cycles colour of the ooze at world point rest (where it lies still) when its normal is n, not nr, from basis b
vec3 lookIn(highp sampler2DArray b, vec3 rest, vec3 n, vec3 nr) {
  vec2 uv = (pix(rest) - region.xy) / region.zw;
  float c = clamp(dot(n, nr), -1.0, 1.0);
  float th = degrees(acos(c));
  vec3 d = n - nr * c;
  float ph = dot(d, d) < 1e-12 ? 0.0 : degrees(atan(d.y, d.x));  // untilted: any turn
  if (ph < 0.0) ph += 360.0;
  float fi = clamp(th / tiltStep, 0.0, rings);
  int i0 = int(floor(fi)); int i1 = min(i0 + 1, int(rings));
  float ft = fi - float(i0);
  float g = ph / (360.0 / float(turns));
  int j0 = int(floor(g)) % turns; int j1 = (j0 + 1) % turns;
  float fg = g - floor(g);
  vec3 lo = mix(layer(b, i0, j0, uv), layer(b, i0, j1, uv), fg);
  vec3 hi = mix(layer(b, i1, j0, uv), layer(b, i1, j1, uv), fg);
  return mix(lo, hi, ft);
}
// the ooze's colour: tear opens the skin to the dark below (the shine stays, as in Cycles); shade (0..1) dims only
// the light the skin itself gives back (towards the torn look: shine only), for the creases at a bubble's foot that Cycles shadows
// Standard view: display = sRGB(linear * 2^exposure); dec/enc go between the two
vec3 dec(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 enc(vec3 c) { c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
uniform highp sampler2DArray probe;  // five faces a sheet: the room as the coat mirrors it (linear)
uniform vec3 faceF[5]; uniform vec3 faceU[5];
uniform vec3 camPos; uniform vec3 coat; uniform float expo;
uniform vec3 centres[8]; uniform vec3 boxLo; uniform vec3 boxHi;
uniform vec4 pingAt[NGLINT]; uniform vec4 pingCol[NGLINT]; uniform int nPing;
// what the ray from p along d meets, as seen from the probe's centre: where it leaves the room's box (box projection)
vec3 roomDir(int base, vec3 p, vec3 d) {
  vec3 a = (boxHi - p) / d, b = (boxLo - p) / d;
  vec3 far = max(a, b);
  float t = max(min(min(far.x, far.y), far.z), 0.0);
  return normalize(p + t * d - centres[base / 5]);
}
vec3 room(int base, vec3 d) {
  int k = 0; float best = -2.0;
  for (int i = 0; i < 5; i++) { float c = dot(d, faceF[i]); if (c > best) { best = c; k = i; } }
  vec3 f = faceF[k], u = faceU[k], r = cross(f, u);
  float w = max(dot(d, f), 1e-3);
  vec2 uv = clamp(vec2(dot(d, r), dot(d, u)) / w, -1.0, 1.0) * 0.5 + 0.5;
  return texture(probe, vec3(uv, float(base + k))).rgb;
}
// each sheet's flat mirror, over the basis crop (rows bottom first): what it shows, and where each mirrored ray lands
uniform highp sampler2DArray mirror; uniform highp sampler2DArray mpos;
uniform float mirZ[8]; uniform float posOff; uniform float useMirror;
uniform float pixAngle;  // radians a screen pixel spans (at the middle)
uniform float gloss;
uniform float coatDim;   // 1: the coat dims the ooze below it, as Cycles' does
uniform float glintWide; uniform float glintHalo;  // the highlights' soft halo: its width (radians) and share
uniform int nPingOnly;     // the first glints are pings (just over the ooze, never hidden)
uniform vec3 baseSpec;   // the base layer's shine drawn live: roughness, IOR, specular level (0: in the basis)
uniform float baseGain; uniform float baseRoom; uniform float baseHalo; uniform float baseWide; uniform vec3 baseTint;
uniform float roomGain;  // how strongly the coat shows the room, fitted to Cycles (its coat barely mirrors the room)
// where in the mirror images the room point q shows: q mirrored in the sheet's still height, seen by the camera
vec2 mirUv(vec3 q, float z0) {
  vec2 u = (pix(vec3(q.xy, 2.0 * z0 - q.z)) - region.xy) / region.zw;
  return vec2(u.x, 1.0 - u.y);
}
float inCrop(vec2 u) { return step(0.0, u.x) * step(u.x, 1.0) * step(0.0, u.y) * step(u.y, 1.0); }
// how far along the ray from p along d the room is, from the mirror's hit positions; w: how much to trust it
float mirrorT(int k, vec3 p, vec3 d, out float w) {
  vec3 a = (boxHi - p) / d, b = (boxLo - p) / d;
  vec3 far = max(a, b);
  float t = max(min(min(far.x, far.y), far.z), 0.01);  // first guess: the room's box
  w = 0.0;
  if (d.z <= 0.0) return t;
  vec3 hit = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec2 u = mirUv(p + t * d, mirZ[k]);
    if (inCrop(u) < 0.5) return t;
    hit = texture(mpos, vec3(u, float(k))).xyz;
    if (hit.x <= 0.0) return t;  // the ray left the room
    hit -= posOff;
    t = max(dot(hit - p, d), 0.01);
  }
  // trusted while the point found lies on the ray (it can fail at the edge of a stone that hides another)
  float err = length(hit - (p + t * d)) / t;
  w = 1.0 - smoothstep(0.05, 0.25, err);
  return t;
}
// the clear coat's mirror image of the room at world point p with normal n (linear, before exposure)
// the share of light the coat reflects at p (Fresnel by its IOR, times its weight): what it mirrors, and what it
// takes from the ooze below (Cycles' coat dims the base layer by the same share)
float coatShare(vec3 p, vec3 n) {
  vec3 v = normalize(camPos - p);
  float nv = max(dot(n, v), 0.0), f0 = pow((coat.z - 1.0) / (coat.z + 1.0), 2.0);
  return coat.x * (f0 + (1.0 - f0) * pow(1.0 - nv, 5.0));
}
// a shiny layer's mirror image of the room at p (linear, before exposure and Fresnel): the room (probe, and the flat
// mirror's exact image where trusted, mirW), scaled by gRoom, and the glowing discs (pings, lamps, bulbs), all spread by
// the layer's roughness. halo: the bulbs' soft ring (the coat only; a rough layer is all ring).
vec3 shine(int base, vec3 p, vec3 n, float rough, float gRoom, float mirW, float halo, float wide, int from) {
  vec3 v = normalize(camPos - p);
  vec3 rd = reflect(-v, n);
  float spread = length(fwidth(rd));
  // the room's mirror image averaged over the directions this pixel's ooze turns through (and the layer's
  // roughness): a bulb thinner than a pixel comes out a soft streak, not a hard white fleck
  vec3 ta = normalize(cross(rd, abs(rd.z) < 0.9 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0))), tb = cross(rd, ta);
  float lobe = 2.0 * rough * rough;  // GGX alpha = roughness squared, about twice that off the mirror direction
  float wd = 0.5 * spread + lobe + gloss;
  vec3 c = vec3(0.0);
  int k = base / 5;
  if (gRoom > 0.0) {
    vec3 m = vec3(0.0);
    float w; float t = mirrorT(k, p, rd, w);
    w *= mirW;
    // the mirror image's blur: the room patch the cone of width wd covers at distance t, in pixels of the mirror
    // image (seen from the camera's mirror image, |camera - p| + t away), as a mip level
    float lod = log2(max(t * wd / ((length(camPos - p) + t) * pixAngle), 1.0));
    for (int i = 0; i < 9; i++) {
      vec2 o = vec2(float(i % 3) - 1.0, float(i / 3) - 1.0) * wd;
      vec3 di = normalize(rd + o.x * ta + o.y * tb);
      c += room(base, roomDir(base, p, di));
      vec2 u = mirUv(p + t * di, mirZ[k]);
      m += textureLod(mirror, vec3(clamp(u, 0.0, 1.0), float(k)), lod).rgb;
    }
    c = gRoom * mix(c, m, w) / 9.0;
  }
  for (int i = 0; i < NGLINT; i++) {
    if (i < from || i >= nPing || int(pingCol[i].w) != k) continue;
    vec3 q = pingAt[i].xyz - p;
    float t = dot(q, rd);
    if (t <= 0.0) continue;
    // widened by how far the mirror direction turns across this pixel (specular antialiasing), so a glint thinner
    // than a pixel spreads into a soft streak, as Cycles' many samples a pixel average it; the disc's total is kept
    float dist = length(q - t * rd), r = pingAt[i].w, s = t * (lobe + spread);
    float w2 = r * r + s * s, h2 = w2 + t * t * wide * wide;
    float hf = halo * step(r, 0.2);  // bulbs only: a broad light (the moon, the fills) has no core to ring
    float g = (1.0 - hf) * (r * r / w2) * exp(-dist * dist / w2) + hf * (r * r / h2) * exp(-dist * dist / h2);
    if (g < 1e-4) continue;
    // hidden where the mirror image shows something nearer than the light along the way to it
    float vis = 1.0;
    if (useMirror > 0.5 && i >= nPingOnly) {
      vec3 dl = normalize(q); float wv; float th = mirrorT(k, p, dl, wv);
      vis = mix(1.0, smoothstep(0.85, 0.95, th / length(q)), wv);
    }
    c += pingCol[i].rgb * g * vis;
  }
  return c;
}
// the base layer's Fresnel share (Principled: F0 = ((ior - 1) / (ior + 1))^2 times twice the specular level)
float baseShare(vec3 p, vec3 n) {
  vec3 v = normalize(camPos - p);
  float nv = max(dot(n, v), 0.0), f0 = pow((baseSpec.y - 1.0) / (baseSpec.y + 1.0), 2.0) * 2.0 * baseSpec.z;
  return f0 + (max(f0, 0.0) > 0.0 ? (1.0 - f0) * pow(1.0 - nv, 5.0) : 0.0);
}
vec3 coatAt(int base, vec3 p, vec3 n) {
  vec3 c = coatShare(p, n) * shine(base, p, n, coat.y, roomGain, useMirror, glintHalo, glintWide, 0);
  // the base's own shine, under the coat, when the basis leaves it out: the room's lamps only (Cycles' base layer
  // shows no ping), each spread into the broad soft glow a rough (0.16) layer gives a bulb, as in the plate
  if (baseSpec.z > 0.0) c += (1.0 - coatShare(p, n)) * baseShare(p, n) * baseGain * baseTint
    * shine(base, p, n, baseSpec.x, baseRoom, 0.0, baseHalo, baseWide, nPingOnly);
  return c;
}
vec3 look(vec3 rest, vec3 n, vec3 nr, float tear, float shade, vec3 p, int base) {
  vec3 full = dec(lookIn(basis, rest, n, nr)), open = dec(lookIn(torn, rest, n, nr));
  vec3 skin = mix(open, full, shade * (1.0 - tear));  // blended as light
  float dim = coatDim > 0.5 ? 1.0 - coatShare(p, n) : 1.0;
  return enc(skin * dim + coatAt(base, p, n) * exp2(expo));  // shown as display colour
}
float seen(vec3 rest) { return texture(mask, pix(rest) / res).a; }
`;

export async function start(dir: string) {
  const info: Live = await (await fetch(dir + "live.json")).json();
  if (new URLSearchParams(location.search).has("flat")) {  // a check: the ooze lying still, as basis_00 shows it
    info.swell = 0; for (const sh of info.sheets) { sh.events = []; sh.splat = []; }
  }
  const [W, H] = info.res, R = info.region;
  const canvas = document.createElement("canvas");
  document.body.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1); renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;  // the images are already display colour: pass them through
  renderer.toneMapping = THREE.NoToneMapping;

  const [plateIm, maskIm] = await Promise.all([loadImage(dir + "plate.png"), loadImage(dir + "mask.png")]);
  const basisIms = await Promise.all(info.basis.map((_, k) => loadImage(dir + `basis_${String(k).padStart(2, "0")}.png`)));
  const n = basisIms.length, layer = R.w * R.h * 4, data = new Uint8Array(layer * n);
  basisIms.forEach((im, k) => data.set(pixels(im), k * layer));
  const basis = topFirst(new THREE.DataArrayTexture(data, R.w, R.h, n));
  // the reflection probes, five faces a sheet, as one half-float array (rows bottom first, as EXRLoader gives them)
  const P = info.probe.size, nf = info.probe.faces.length, exr = new EXRLoader();
  const faces = await Promise.all(info.sheets.flatMap((_, k) => info.probe.faces.map((_f, fi) =>
    exr.loadAsync(dir + `probe_${k}_${fi}.exr`))));
  const pdata = new Uint16Array(P * P * 4 * faces.length);
  faces.forEach((t, i) => pdata.set(t.image.data as unknown as Uint16Array, i * P * P * 4));
  const probe = new THREE.DataArrayTexture(pdata, P, P, faces.length);
  probe.type = THREE.HalfFloatType; probe.colorSpace = THREE.NoColorSpace;
  probe.minFilter = probe.magFilter = THREE.LinearFilter; probe.generateMipmaps = false; probe.needsUpdate = true;
  // the flat mirrors: half-float colour (linear filtered), 32-bit hit positions (read exactly)
  const nS = info.sheets.length, MW = R.w, MH = R.h;
  const mcol = new Uint16Array(MW * MH * 4 * nS), mpos = new Float32Array(MW * MH * 4 * nS);
  const useMirror = !!info.mirror && !new URLSearchParams(location.search).has("nomirror");
  if (useMirror) {
    const ex32 = new EXRLoader().setDataType(THREE.FloatType);
    await Promise.all(info.sheets.map(async (_, k) => {
      const [c, q] = await Promise.all([exr.loadAsync(dir + `mirror_${k}.exr`), ex32.loadAsync(dir + `mpos_${k}.exr`)]);
      if (c.image.width !== MW || c.image.height !== MH) throw new Error(`mirror_${k}.exr is not the basis crop`);
      mcol.set(c.image.data as unknown as Uint16Array, k * MW * MH * 4);
      mpos.set(q.image.data as unknown as Float32Array, k * MW * MH * 4);
    }));
  }
  const mirrorTex = new THREE.DataArrayTexture(mcol, MW, MH, nS);
  mirrorTex.type = THREE.HalfFloatType; mirrorTex.colorSpace = THREE.NoColorSpace;
  mirrorTex.minFilter = THREE.LinearMipmapLinearFilter; mirrorTex.magFilter = THREE.LinearFilter;
  mirrorTex.generateMipmaps = true; mirrorTex.needsUpdate = true;
  const mposTex = new THREE.DataArrayTexture(mpos, MW, MH, nS);
  mposTex.type = THREE.FloatType; mposTex.colorSpace = THREE.NoColorSpace;
  mposTex.minFilter = mposTex.magFilter = THREE.NearestFilter; mposTex.generateMipmaps = false; mposTex.needsUpdate = true;
  const camPos = new THREE.Vector3().setFromMatrixPosition(rows(info.camera.matrix));
  // pings and the room's lamps, as one list of glowing discs (sludgeGlints.ts)
  const q = new URLSearchParams(location.search);
  const { list: glints, nPings } = glintList(info.pings, info.lights ?? [], info.probe.box, {
    gain: Number(q.get("lights") ?? 1), skip: (q.get("skip") ?? "").split(","), max: NGLINT });
  const tornIms = await Promise.all(info.basis.map((_, k) => loadImage(dir + `tear_${String(k).padStart(2, "0")}.png`)));
  const tdata = new Uint8Array(layer * n);
  tornIms.forEach((im, k) => tdata.set(pixels(im), k * layer));
  const torn = topFirst(new THREE.DataArrayTexture(tdata, R.w, R.h, n));
  const mask = topFirst(new THREE.DataTexture(new Uint8Array(pixels(maskIm)), W, H));
  const plate = new THREE.Texture(plateIm); plate.colorSpace = THREE.NoColorSpace; plate.needsUpdate = true;

  const cam = new THREE.Camera();
  cam.matrix.copy(rows(info.camera.matrix)); cam.matrixAutoUpdate = false; cam.matrixWorldNeedsUpdate = true;
  cam.projectionMatrix.copy(rows(info.camera.projection)); cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  cam.updateMatrixWorld(true);
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);

  const shared = {
    basis: { value: basis }, torn: { value: torn }, probe: { value: probe },
    faceF: { value: info.probe.faces.map(f => new THREE.Vector3(f[0], f[1], f[2])) },
    faceU: { value: info.probe.faces.map(f => new THREE.Vector3(f[3], f[4], f[5])) },
    camPos: { value: camPos },
    pixAngle: { value: 2 / (info.camera.projection[1][1] * H) },
    coatDim: { value: q.has("dim") ? 1 : 0 },  // fitted: off (the basis already holds the dimmed base)
    glintWide: { value: Number(q.get("wide") ?? 0.03) }, glintHalo: { value: Number(q.get("halo") ?? 0.5) },
    nPingOnly: { value: nPings },
    baseSpec: { value: new THREE.Vector3(...(info.base_spec ?? [0.5, 1.5, 0])) },
    baseGain: { value: Number(q.get("bgain") ?? 1) }, baseRoom: { value: Number(q.get("broom") ?? 1) },
    baseHalo: { value: Number(q.get("bhalo") ?? 0.7) }, baseWide: { value: Number(q.get("bwide") ?? 0.15) },
    baseTint: { value: new THREE.Vector3(...(q.get("btint") ?? "1,1,1").split(",").map(Number)) },
    roomGain: { value: Number(q.get("room") ?? 0) },  // fitted: Cycles' coat shows the room at ~0.1 of physics
    gloss: { value: Number(new URLSearchParams(location.search).get("gloss") ?? "0") },
    mirror: { value: mirrorTex }, mpos: { value: mposTex }, useMirror: { value: useMirror ? 1 : 0 },
    mirZ: { value: Array.from({ length: 8 }, (_, k) => info.mirror?.z[k] ?? 0) }, posOff: { value: info.mirror?.pos_off ?? 0 },
    centres: { value: Array.from({ length: 8 }, (_, k) => new THREE.Vector3(...(info.probe.centres[k] ?? [0, 0, 0]))) },
    boxLo: { value: new THREE.Vector3(...info.probe.box[0]) }, boxHi: { value: new THREE.Vector3(...info.probe.box[1]) },
    // a ping's radiance: power / (pi area), as Cycles' area light; w = the sheet it lights
    pingAt: { value: Array.from({ length: NGLINT }, (_, i) => { const g = glints[i];
      return g ? new THREE.Vector4(g.at[0], g.at[1], g.at[2], g.r) : new THREE.Vector4(); }) },
    pingCol: { value: Array.from({ length: NGLINT }, (_, i) => { const g = glints[i];
      return g ? new THREE.Vector4(g.color[0] * g.L, g.color[1] * g.L, g.color[2] * g.L, g.sheet) : new THREE.Vector4(); }) },
    nPing: { value: glints.length }, coat: { value: new THREE.Vector3(...info.coat) }, expo: { value: info.view.exposure },
    mask: { value: mask }, region: { value: new THREE.Vector4(R.x, R.y, R.w, R.h) },
    res: { value: new THREE.Vector2(W, H) }, vp: { value: vp }, turns: { value: info.turns },
    tiltStep: { value: info.tilts[0] }, rings: { value: info.tilts.length },
  };
  const scene = new THREE.Scene();

  // the plate, behind everything
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { plate: { value: plate } }, depthTest: false, depthWrite: false,
    vertexShader: "out vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: "uniform sampler2D plate; in vec2 vUv; out vec4 o; void main() { o = texture(plate, vUv); }",
    glslVersion: THREE.GLSL3,
  }));
  plateMesh.frustumCulled = false; plateMesh.renderOrder = -10; scene.add(plateMesh);

  // one material a sheet, sharing every uniform but which probe faces it mirrors
  const sheetMat = (k: number) => new THREE.ShaderMaterial({
    uniforms: { ...shared, base: { value: k * nf } }, transparent: true, glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in vec3 restPos; in vec3 restNormal; in float tearv; in float crease;
      out vec3 vN; out vec3 vRN; out vec3 vRest; out float vTear; out float vShade; out vec3 vWorld;
      void main() {
        vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        vRest = (modelMatrix * vec4(restPos, 1.0)).xyz;
        vN = mat3(modelMatrix) * normal; vRN = mat3(modelMatrix) * restNormal; vTear = tearv; vShade = 1.0 - crease;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: LOOK + /* glsl */ `
      uniform int base;
      in vec3 vN; in vec3 vRN; in vec3 vRest; in float vTear; in float vShade; in vec3 vWorld; out vec4 o;
      void main() {
        o = vec4(look(vRest, normalize(vN), normalize(vRN), vTear, vShade, vWorld, base), seen(vRest));
      }`,
  });

  type Live1 = { sheet: Sheet; geo: THREE.BufferGeometry; rest: Float32Array; mesh: THREE.Mesh; nb: Neighbours };
  const lives: Live1[] = [];
  for (let k = 0; k < info.sheets.length; k++) {
    const sh = info.sheets[k];
    const buf = await (await fetch(dir + `sheet_${k}.bin`)).arrayBuffer();
    const rest = new Float32Array(buf, 0, sh.verts * 3).slice();
    const idx = new Uint32Array(buf, sh.verts * 12, sh.tris * 3).slice();
    const geo = new THREE.BufferGeometry();
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setAttribute("position", new THREE.BufferAttribute(rest.slice(), 3));
    geo.computeVertexNormals();
    geo.setAttribute("restNormal", new THREE.BufferAttribute((geo.getAttribute("normal").array as Float32Array).slice(), 3));
    geo.setAttribute("restPos", new THREE.BufferAttribute(rest, 3));
    geo.setAttribute("tearv", new THREE.BufferAttribute(new Float32Array(sh.verts), 1));
    geo.setAttribute("crease", new THREE.BufferAttribute(new Float32Array(sh.verts), 1));
    const mesh = new THREE.Mesh(geo, sheetMat(k));
    mesh.matrix.copy(rows(sh.matrix)); mesh.matrixAutoUpdate = false; mesh.frustumCulled = false;
    scene.add(mesh);
    lives.push({ sheet: sh, geo, rest, mesh, nb: neighbours(sh.verts, idx) });
  }

  // the blobs in the air: small balls of the same ooze, lit by the basis with their own round normals
  const MAXD = 64;
  const dropGeo = new THREE.SphereGeometry(1, 16, 10);
  const dropRest = new THREE.InstancedBufferAttribute(new Float32Array(MAXD * 3), 3);
  dropGeo.setAttribute("dropRest", dropRest);
  const dropBase = new THREE.InstancedBufferAttribute(new Float32Array(MAXD), 1);
  dropGeo.setAttribute("dropBase", dropBase);
  const drops = new THREE.InstancedMesh(dropGeo, new THREE.ShaderMaterial({
    uniforms: shared, glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in vec3 dropRest; in float dropBase; out vec3 vN; out vec3 vRest; out vec3 vWorld; flat out int vBase;
      void main() {
        vWorld = (instanceMatrix * vec4(position, 1.0)).xyz; vBase = int(dropBase + 0.5);
        vRest = dropRest; vN = normalize(mat3(instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: LOOK + /* glsl */ `
      in vec3 vN; in vec3 vRest; in vec3 vWorld; flat in int vBase; out vec4 o;
      void main() { o = vec4(look(vRest, normalize(vN), vec3(0.0, 0.0, 1.0), 0.0, 1.0, vWorld, vBase), 1.0); }`,
  }), MAXD);
  drops.frustumCulled = false; drops.renderOrder = 1; scene.add(drops);

  const m4 = new THREE.Matrix4(), v3 = new THREE.Vector3();
  const CREASE = Number(new URLSearchParams(location.search).get("crease") ?? "25");
  function update(time: number) {
    const L = info.loop_s;
    let nd = 0;
    for (const [k, { sheet, geo, rest, mesh, nb }] of lives.entries()) {
      const pos = geo.getAttribute("position") as THREE.BufferAttribute, tr = geo.getAttribute("tearv") as THREE.BufferAttribute;
      const p = pos.array as Float32Array, t = tr.array as Float32Array;
      for (let i = 0; i < sheet.verts; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1];
        p[i * 3 + 2] = rest[i * 3 + 2] + swell(info.swell, info.S, x, y, time, L, k)
          + surfaceHeight(0, sheet.events, sheet.splat, x, y, time, L);
        t[i] = tearAt(sheet.events, x, y, time, L);
      }
      const cr = geo.getAttribute("crease") as THREE.BufferAttribute;
      creases(nb, p, rest, cr.array as Float32Array, CREASE / info.S);
      pos.needsUpdate = true; tr.needsUpdate = true; cr.needsUpdate = true;
      geo.computeVertexNormals();
      for (const [x, y, z, r] of dropsInAir(sheet.events, time, L)) {
        if (nd >= MAXD) break;
        const base = surfaceHeight(0, sheet.events, sheet.splat, x, y, time, L);
        v3.set(x, y, base + z + 0.6 * r).applyMatrix4(mesh.matrix);
        m4.makeScale(r, r, 1.15 * r).setPosition(v3);
        drops.setMatrixAt(nd, m4);
        v3.set(x, y, 0).applyMatrix4(mesh.matrix);
        dropRest.setXYZ(nd, v3.x, v3.y, v3.z); dropBase.setX(nd, k * nf);
        nd++;
      }
    }
    drops.count = nd; drops.instanceMatrix.needsUpdate = true; dropRest.needsUpdate = true; dropBase.needsUpdate = true;
    return nd;
  }

  const renderAt = (time: number) => {
    const nd = update(time);
    renderer.render(scene, cam);
    return nd;
  };
  return { renderAt, canvas, info };
}

const dir = new URLSearchParams(location.search).get("dir") ?? "live-proof/";
const w = window as unknown as { renderAt?: (t: number) => number; liveReady?: boolean; liveError?: string };
start(dir.endsWith("/") ? dir : dir + "/").then(({ renderAt, info }) => {
  w.renderAt = renderAt;
  w.liveReady = true;
  if (!new URLSearchParams(location.search).has("still")) {
    const t0 = performance.now();
    const tick = () => { renderAt(((performance.now() - t0) / 1000) % info.loop_s); requestAnimationFrame(tick); };
    tick();
  }
}).catch(e => { w.liveError = String(e); console.error(e); });
