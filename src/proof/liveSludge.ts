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
import { FACE_FLOOR_GLSL } from "../diorama/sludgeFacing";
import { GRADE_GLSL, STAGE_GRADE, type Grade } from "../diorama/stageGrade";
import { surfaceHeight, tearAt, dropsInAir, swell, type BubbleEvent, type Splat } from "../diorama/sludgeBubbles";
import { glintList, type Lamp } from "../diorama/sludgeGlints";
import { packFrame, SLUDGE_PACK_GLSL, ITEM, MAX_ITEMS } from "../diorama/sludgePack";
import { PERM, PERLIN_SCALE } from "../diorama/sludgeBubbles";
import { frameStats } from "./frameStats";

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
  /** the stage's colour grade the baked images carry (stageGrade.ts) */
  grade?: Grade;
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
const LOOK = GRADE_GLSL + /* glsl */ `
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
uniform float aaSpread;
uniform float glintSoft;
uniform int useGrade;  // 1: the coat's light goes in before the stage's grade, as in Cycles  // how far a glint widens by the pixel's own turn of the mirror direction (1: all of it)
uniform float coatDim;   // 1: the coat dims the ooze below it, as Cycles' does
uniform float glintWide; uniform float glintHalo;  // the highlights' soft halo: its width (radians) and share
uniform int nPingOnly;     // the first glints are pings (just over the ooze, never hidden)
uniform vec3 baseSpec;   // the base layer's shine drawn live: roughness, IOR, specular level (0: in the basis)
uniform float baseGain; uniform float baseRoom; uniform float baseHalo; uniform float baseWide; uniform vec3 baseTint;
uniform float rimGain; uniform float rimPow;  // the room's extra share at grazing: gain * (1 - n.v)^pow
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
    int sh = int(pingCol[i].w);  // -1: a lamp every sheet mirrors
    if (i < from || i >= nPing || (sh != k && sh != -1)) continue;
    vec3 q = pingAt[i].xyz - p;
    float t = dot(q, rd);
    if (t <= 0.0) continue;
    // widened by how far the mirror direction turns across this pixel (specular antialiasing), so a glint thinner
    // than a pixel spreads into a soft streak, as Cycles' many samples a pixel average it; the disc's total is kept
    float dist = length(q - t * rd), r = pingAt[i].w, s = t * (glintSoft * lobe + aaSpread * spread);
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
  // the room shows in the coat at grazing edges (a dome's far side), where Cycles' coat mirrors it near fully,
  // though the fitted roomGain keeps it out of the face-on ooze
  float nv = max(dot(n, normalize(camPos - p)), 0.0);
  float gRoom = roomGain + rimGain * pow(1.0 - nv, rimPow);
  vec3 c = coatShare(p, n) * shine(base, p, n, coat.y, gRoom, useMirror, glintHalo, glintWide, 0);
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
  if (useGrade == 0) return enc(skin * dim + coatAt(base, p, n) * exp2(expo));  // shown as display colour
  // the baked colour is graded (stageGrade.ts): ungrade it, add the coat's light, grade the sum
  float e = exp2(expo);
  return enc(gradeFwd(gradeInv(skin / e) * dim + coatAt(base, p, n)) * e);
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
  const grade: Grade = info.grade ?? STAGE_GRADE;  // live.json's, else the stage's as the sludge renders use it
  const { list: glints, nPings, dropped } = glintList(info.pings, info.lights ?? [], info.probe.box, {
    // Cycles' coat shows the bulbs and the lantern, not the broad moon, pool and warm fill lights (their blue/white haze
    // cost the fit 6 points, round 8); the bulbs show without a soft ring (halo 0) and glints a quarter-pixel wide (aa)
    gain: Number(q.get("lights") ?? 1), skip: (q.get("skip") ?? "moon,pool,warmfill").split(","), max: NGLINT });
  if (dropped) console.warn(`live sludge: ${dropped} glints over the ${NGLINT} the shader holds were left out`);
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
    glintWide: { value: Number(q.get("wide") ?? 0.03) }, glintHalo: { value: Number(q.get("halo") ?? 0) },
    nPingOnly: { value: nPings },
    baseSpec: { value: new THREE.Vector3(...(info.base_spec ?? [0.5, 1.5, 0])) },
    baseGain: { value: Number(q.get("bgain") ?? 1) }, baseRoom: { value: Number(q.get("broom") ?? 1) },
    baseHalo: { value: Number(q.get("bhalo") ?? 0.7) }, baseWide: { value: Number(q.get("bwide") ?? 0.15) },
    baseTint: { value: new THREE.Vector3(...(q.get("btint") ?? "1,1,1").split(",").map(Number)) },
    roomGain: { value: Number(q.get("room") ?? 0) },
    rimGain: { value: Number(q.get("rim") ?? 0) }, rimPow: { value: Number(q.get("rimpow") ?? 4) },  // fitted: Cycles' coat shows the room at ~0.1 of physics
    gloss: { value: Number(new URLSearchParams(location.search).get("gloss") ?? "0") },
    aaSpread: { value: Number(new URLSearchParams(location.search).get("aa") ?? "0.25") },
    glintSoft: { value: Number(q.get("soft") ?? 1) },  // widens each glint past the coat's own roughness, total kept
    useGrade: { value: Number(q.get("grade") ?? 1) },
    gSlope: { value: new THREE.Vector3(...grade.slope) }, gOffset: { value: new THREE.Vector3(...grade.offset) },
    gPower: { value: new THREE.Vector3(...grade.power) }, gSat: { value: grade.sat },
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

  // the bubbling on the GPU (default; ?cpu shapes the mesh on the CPU as before): a packed texture a sheet, refilled
  // each frame by packFrame, and Perlin's table for the swell
  const gpu = !q.has("cpu");
  const CREASE = Number(q.get("crease") ?? "25");
  const permTex = new THREE.DataTexture(PERM, PERM.length, 1, THREE.RedIntegerFormat, THREE.UnsignedByteType);
  permTex.internalFormat = "R8UI"; permTex.needsUpdate = true;
  const gpuShared = {
    gpuShape: { value: gpu ? 1 : 0 }, permTex: { value: permTex }, swellAmp: { value: info.swell }, sheetS: { value: info.S },
    swellPh: { value: new THREE.Vector2() }, creaseK: { value: CREASE / info.S },
  };
  const packs = info.sheets.map(() => {
    const data = new Float32Array(ITEM * MAX_ITEMS);
    const tex = new THREE.DataTexture(data, 4, MAX_ITEMS, THREE.RGBAFormat, THREE.FloatType);
    tex.minFilter = tex.magFilter = THREE.NearestFilter; tex.needsUpdate = true;
    return { data, tex, uniforms: { packTex: { value: tex }, nBub: { value: 0 }, nTear: { value: 0 }, nLump: { value: 0 },
      nSplat: { value: 0 }, edge: { value: 1 } } };
  });

  // one material a sheet, sharing every uniform but which probe faces it mirrors
  const sheetMat = (k: number) => new THREE.ShaderMaterial({
    uniforms: { ...shared, ...gpuShared, ...packs[k].uniforms, sheetK: { value: k }, base: { value: k * nf }, debugView: { value: Number(new URLSearchParams(location.search).get("view") ?? 0) },
      minFace: { value: Number(new URLSearchParams(location.search).get("face") ?? 0.4) } }, transparent: true, glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
      in vec3 restPos; in vec3 restNormal; in float tearv; in float crease;
      out vec3 vN; out vec3 vRN; out vec3 vRest; out float vTear; out float vShade; out vec3 vWorld;
      ${SLUDGE_PACK_GLSL}
      uniform int gpuShape; uniform float sheetK; uniform float swellAmp; uniform float sheetS; uniform vec2 swellPh;
      uniform float edge; uniform float creaseK;
      // the ooze's rise here: the slow swell (sludgeBubbles.ts swell) plus every packed bubble, lump and splatter
      float rise(vec2 xy) {
        float k = sheetK;
        vec3 q = vec3(xy * 2.2 / sheetS + swellPh + vec2(17.3 * k + 0.5, 9.1 * k + 0.5), 0.37 + 5.7 * k);
        return swellAmp * ${PERLIN_SCALE.toFixed(4)} * perlin3(q) + sludgeHeight(xy);
      }
      void main() {
        vec3 p = position, nl = normal; float tear = tearv, cr = crease;
        if (gpuShape == 1) {
          // shaped here from the packed bubbles (sludgePack.ts): height at the vertex, its slope from a ring of six
          // taps one mesh edge out, and the crease as the CPU's two-ring average (weights 7, 4 a tap, 3 a tap / 49)
          vec2 xy = restPos.xy; float d0 = rise(xy), r1 = 0.0, r2 = 0.0; vec2 g = vec2(0.0);
          for (int i = 0; i < 6; i++) {
            float a = 1.04719755 * float(i);
            vec2 u = vec2(cos(a), sin(a)); float di = rise(xy + edge * u);
            r1 += di; g += (di - d0) * u;
            vec2 u2 = vec2(cos(a + 0.52359878), sin(a + 0.52359878)); r2 += rise(xy + 1.83 * edge * u2);
          }
          g /= 3.0 * edge;
          p = restPos + vec3(0.0, 0.0, d0);
          float c = max(restNormal.z, 0.2);
          nl = normalize(vec3(restNormal.x / c - g.x, restNormal.y / c - g.y, 1.0));
          tear = sludgeTear(xy);
          cr = clamp(((7.0 * d0 + 4.0 * r1 + 3.0 * r2) / 49.0 - d0) * creaseK, 0.0, 0.6);
        }
        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        vRest = (modelMatrix * vec4(restPos, 1.0)).xyz;
        vN = mat3(modelMatrix) * nl; vRN = mat3(modelMatrix) * restNormal; vTear = tear; vShade = 1.0 - cr;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: LOOK + FACE_FLOOR_GLSL + /* glsl */ `
      uniform int base; uniform int debugView; uniform float minFace;
      in vec3 vN; in vec3 vRN; in vec3 vRest; in float vTear; in float vShade; in vec3 vWorld; out vec4 o;
      void main() {
        // a dome's far side, seen edge-on, keeps its shading normal facing the camera (sludgeFacing.ts)
        vec3 n = faceFloor(normalize(vN), normalize(camPos - vWorld), minFace);
        o = vec4(look(vRest, n, normalize(vRN), vTear, vShade, vWorld, base), seen(vRest));
        // a check (?view=1 tilt from rest / 60 deg, 2 tear, 3 shade, 4 facing the camera): the term as grey
        if (debugView == 1) o.rgb = vec3(degrees(acos(clamp(dot(normalize(vN), normalize(vRN)), -1.0, 1.0))) / 60.0);
        if (debugView == 2) o.rgb = vec3(vTear);
        if (debugView == 3) o.rgb = vec3(vShade);
        if (debugView == 4) o.rgb = vec3(max(dot(normalize(vN), normalize(camPos - vWorld)), 0.0));
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
    const nb = neighbours(sh.verts, idx);
    let el = 0;
    for (let i = 0; i < sh.verts; i++) for (let j = nb.start[i]; j < nb.start[i + 1]; j++)
      el += Math.hypot(rest[i * 3] - rest[nb.list[j] * 3], rest[i * 3 + 1] - rest[nb.list[j] * 3 + 1]);
    packs[k].uniforms.edge.value = el / Math.max(nb.list.length, 1);
    lives.push({ sheet: sh, geo, rest, mesh, nb });
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
  let packWarned = false;
  function update(time: number) {
    const L = info.loop_s;
    let nd = 0;
    const tw = 2 * Math.PI * time / L;
    gpuShared.swellPh.value.set(0.4 * Math.cos(tw), 0.4 * Math.sin(tw));
    for (const [k, { sheet, geo, rest, mesh, nb }] of lives.entries()) {
      if (gpu) {
        const pk = packs[k], r = packFrame(sheet.events, sheet.splat, time, L, pk.data);
        pk.uniforms.nBub.value = r.nBub; pk.uniforms.nTear.value = r.nTear;
        pk.uniforms.nLump.value = r.nLump; pk.uniforms.nSplat.value = r.nSplat; pk.tex.needsUpdate = true;
        if (r.dropped && !packWarned) { packWarned = true; console.warn(`sludge pack full: ${r.dropped} items dropped`); }
      } else {
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
      }
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
  // timing, split in two: the CPU's mesh update, and the GPU's draw (made to finish by reading one pixel back)
  const gl = renderer.getContext(), px = new Uint8Array(4);
  const profile = (frames: number) => {
    const cpu: number[] = [], gpu: number[] = [];
    for (let i = 0; i < frames; i++) {
      const t = (i / frames) * info.loop_s;
      const a = performance.now(); update(t); const b = performance.now();
      renderer.render(scene, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); const c = performance.now();
      cpu.push(b - a); gpu.push(c - b);
    }
    const med = (x: number[]) => x.sort((p, q) => p - q)[x.length >> 1];
    const verts = info.sheets.reduce((n, sh) => n + sh.verts, 0), events = info.sheets.reduce((n, sh) => n + sh.events.length, 0);
    return { cpu: med(cpu), gpu: med(gpu), verts, events, px: renderer.domElement.width * renderer.domElement.height };
  };
  return { renderAt, profile, canvas, info };
}

const dir = new URLSearchParams(location.search).get("dir") ?? "live-proof/";
const w = window as unknown as { renderAt?: (t: number) => number; liveProfile?: (n: number) => object; liveReady?: boolean; liveError?: string };
start(dir.endsWith("/") ? dir : dir + "/").then(({ renderAt, profile, info }) => {
  w.renderAt = renderAt; w.liveProfile = profile;
  w.liveReady = true;
  if (new URLSearchParams(location.search).has("bench")) runBench(renderAt, profile, info.loop_s);
  else if (!new URLSearchParams(location.search).has("still")) {
    const t0 = performance.now();
    const tick = () => { renderAt(((performance.now() - t0) / 1000) % info.loop_s); requestAnimationFrame(tick); };
    tick();
  }
}).catch(e => { w.liveError = String(e); console.error(e); });

// ?bench: the phone test. Plays 10 s for real and times each frame, then splits one frame into the CPU's update and the
// GPU's draw, shows the numbers over the picture and posts them to /__bench (tools/art/diorama/phone_bench.mjs).
async function runBench(renderAt: (t: number) => number, profile: (n: number) => object, loop: number) {
  const box = document.createElement("pre");
  box.style.cssText = "position:fixed;left:0;top:0;margin:0;padding:12px;font:20px/1.35 monospace;color:#fff;background:#000a;z-index:9";
  document.body.append(box);
  box.textContent = "Timing for 10 s. Keep the screen on.";
  const gaps: number[] = [];
  await new Promise<void>(done => {
    const t0 = performance.now(); let last = t0;
    const tick = (now: number) => {
      renderAt(((now - t0) / 1000) % loop);
      if (now > t0 + 1000) gaps.push(now - last);  // the first second warms shaders up
      last = now;
      if (now - t0 < 11000) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  box.textContent = "Splitting CPU and GPU...";
  await new Promise(r => setTimeout(r, 50));
  profile(6);
  const split = profile(30) as { cpu: number; gpu: number; px: number };
  const st = frameStats(gaps);
  const gl = (document.querySelector("canvas") as HTMLCanvasElement).getContext("webgl2");
  const dbg = gl?.getExtension("WEBGL_debug_renderer_info");
  const result = { ...st, cpuMs: split.cpu, gpuMs: split.gpu, px: split.px, ua: navigator.userAgent,
    gpuName: dbg ? gl!.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : "?", dpr: devicePixelRatio, path: location.search };
  box.textContent = `${st.fps.toFixed(0)} fps (median frame ${st.median.toFixed(1)} ms, slowest 5% ${st.p95.toFixed(1)} ms)\n`
    + `CPU ${split.cpu.toFixed(1)} ms, GPU ${split.gpu.toFixed(1)} ms a frame\n`;
  try {
    await fetch("/__bench", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(result) });
    box.textContent += "Sent to the Mac. Done.";
  } catch { box.textContent += "Couldn't send: screenshot this."; }
}
