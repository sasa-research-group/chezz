// The white king as Cycles drew him: king A pre-rendered at 8 headings on the 5x5 centre square with the
// locked play camera (tools/art/diorama/bake_king_sprites.py, packed by king_atlas.py), felt fibres, the
// KING_RIM halo and the crown glow included. Drawn on a quad parallel to the image plane, a little in front
// of his nearest point, so the set and the other pieces still sort against him; on any square the quad is
// slid and scaled so his feet land on the square and he keeps the size he has there.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { breath } from "./King";

// dev: `?kingsheet=name` loads a trial sheet from diorama/_t/name/ instead
const BASE = import.meta.env.DEV && /kingsheet=([\w-]+)/.test(location.search) ? `diorama/_t/${RegExp.$1}/` : "diorama/";
export type KingSheet = {
  quad: { x0: number; x1: number; y0: number; y1: number };
  right: number[]; up: number[]; fwd: number[]; d0: number; dq: number;
  exposure: number; glowK: number; headings: number; tiles: [number, number];
};
const sheetP = fetch(`${BASE}king8.json`).then(r => r.json() as Promise<KingSheet>);
let sheet: KingSheet | null = null;
sheetP.then(s => { sheet = s; }, () => {});
/** Suspends until king8.json is in. */
function useSheet(): KingSheet {
  if (!sheet) throw sheetP;
  return sheet;
}

// Depth only is pulled depthBias toward the camera (the image stays put): the set plate has leaves floating in
// front of the back wall, and its depth mesh put them in front of his face on the back row.
const vert = /* glsl */ `uniform float depthBias; varying vec2 vUv;
void main(){
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec4 p = projectionMatrix * mv, pb = projectionMatrix * (mv + vec4(0.0, 0.0, depthBias, 0.0));
  gl_Position = vec4(p.xy, pb.z / pb.w * p.w, p.w);
}`;
const frag = /* glsl */ `
uniform sampler2D map; uniform sampler2D glow; uniform float invExpo; uniform float glowK; uniform vec2 tile; uniform vec2 tiles;
uniform float kExp; uniform float kSatHi; uniform float kSatLo; uniform float kCon; uniform float kGlow;
varying vec2 vUv;
void main(){
  vec2 uv = (tile + vUv) / tiles;
  vec4 c = texture2D(map, uv);
  if (c.a < 0.004) discard;
  vec3 g = texture2D(glow, uv).rgb;
  vec3 col = c.rgb * invExpo * kExp;
  // Richer colour at the same value: chroma scaled about luma, kSatHi where he is coloured and lit (collar,
  // shoulders, crown, skin), kSatLo where he is greyish (tunic) or dark (beard), then put back to the max
  // channel it had so he gets no brighter.
  float mx = max(col.r, max(col.g, col.b)), mn = min(col.r, min(col.g, col.b));
  float sat = mx > 0.0 ? (mx - mn) / mx : 0.0;
  float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
  float w = smoothstep(0.45, 0.75, sat) * smoothstep(0.15, 0.4, mx);  // coloured and lit: not the dark beard
  vec3 o = max(vec3(L) + (col - L) * mix(kSatLo, kSatHi, w), 0.0);
  float mo = max(o.r, max(o.g, o.b));
  if (mo > 0.0) o *= mx / mo;
  o = pow(max(o, 0.0) / 0.18, vec3(kCon)) * 0.18;  // contrast about mid grey (linear)
  gl_FragColor = vec4(o + g * g * glowK * kGlow, c.a);
}`;

// Against the set he is tested DEPTH_BIAS nearer than he is; that is more than one square, so where a card is
// drawn (cards write CARD_STENCIL) a second pass tests him at his true depth instead.
const DEPTH_BIAS = 2.0;  // stage units; 1.5 still let a few leaf specks through on a5/e5/c5
export const CARD_STENCIL = 1;
// Colour trims on the sheet, judged after bloom + grade + LUT against the r16 "A: as is" target (see the
// patch table in the commit). Dev: `?kexp= ?ksat= ?klow= ?kcon= ?kglow=` override them to tune live.
const TRIM = { kExp: 1, kSatHi: 2.2, kSatLo: 1.1, kCon: 1, kGlow: 1 };
const FLAG = { kExp: "kexp", kSatHi: "ksat", kSatLo: "klow", kCon: "kcon", kGlow: "kglow" } as const;
const trim = (k: keyof typeof TRIM) => {
  const v = import.meta.env.DEV ? new URLSearchParams(location.search).get(FLAG[k]) : null;
  return v === null ? TRIM[k] : +v;
};
const STEP = 0.2;  // a turn walks through the headings in between over this long
const tileOf = (yaw: number, n: number) => ((Math.round(yaw / (2 * Math.PI / n)) % n) + n) % n;

/** `at`: his square's centre in stage units (Blender axes); `yaw` as for <King>. Clicks where he is opaque. */
export function KingSprite({ at, yaw = 0, onClick }: { at: [number, number]; yaw?: number; onClick?: () => void }) {
  const s = useSheet();
  const [map, glow] = useLoader(THREE.TextureLoader, [`${BASE}king8.webp`, `${BASE}king8-glow.png`]);
  const mesh = useRef<THREE.Group>(null);
  const { geometry, material, onCards, basis, alpha } = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace; map.generateMipmaps = true; map.needsUpdate = true;
    glow.colorSpace = THREE.NoColorSpace;
    const { x0, x1, y0, y1 } = s.quad;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y1, 0], 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: {
        map: { value: map }, glow: { value: glow }, invExpo: { value: Math.pow(2, -s.exposure) }, glowK: { value: s.glowK },
        tile: { value: new THREE.Vector2() }, depthBias: { value: DEPTH_BIAS }, tiles: { value: new THREE.Vector2(...s.tiles) },
        ...Object.fromEntries((Object.keys(TRIM) as (keyof typeof TRIM)[]).map(k => [k, { value: trim(k) }])),
      },
      stencilWrite: true, stencilRef: CARD_STENCIL, stencilFunc: THREE.NotEqualStencilFunc,
    });
    const mc = m.clone();
    mc.uniforms = { ...m.uniforms, depthBias: { value: 0 } };
    mc.stencilFunc = THREE.EqualStencilFunc;
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const b = new THREE.Matrix4().makeBasis(v(s.right), v(s.up), v(s.fwd).negate());
    // His alpha, for clicks: only where he is drawn, so the square behind his head stays clickable.
    const img = map.image as HTMLImageElement, c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const cx = c.getContext("2d", { willReadFrequently: true })!; cx.drawImage(img, 0, 0);
    return { geometry: g, material: m, onCards: mc, basis: new THREE.Quaternion().setFromRotationMatrix(b), alpha: { d: cx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } };
  }, [map, glow, s]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); onCards.dispose(); }, [geometry, material, onCards]);

  // The heading on show steps one tile at a time toward the target, the whole turn in about STEP seconds.
  const turn = useRef({ shown: tileOf(yaw, s.headings), wait: 0, dt: 0 });
  const target = tileOf(yaw, s.headings);
  const n = s.headings;
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(...s.fwd), [s]);
  useFrame(({ camera, clock }, dt) => {
    const t = turn.current;
    if (t.shown !== target) {
      const d = ((target - t.shown + n + n / 2) % n) - n / 2 || n / 2;
      if (t.dt === 0) t.dt = STEP / Math.abs(d);
      t.wait += dt;
      while (t.wait >= t.dt && t.shown !== target) {
        t.wait -= t.dt;
        const dd = ((target - t.shown + n + n / 2) % n) - n / 2 || n / 2;
        t.shown = (t.shown + Math.sign(dd) + n) % n;
      }
    } else { t.wait = 0; t.dt = 0; }
    const [tx, ty] = s.tiles, k = t.shown;
    (material.uniforms.tile.value as THREE.Vector2).set(k % tx, ty - 1 - Math.floor(k / tx));
    // Slide the quad along the ray to his feet so it keeps the bake's gap in front of them, and scale it so
    // he subtends what he would standing here (camera in Blender axes: three (x, y, z) is Blender (x, -z, y)).
    const m = mesh.current;
    if (!m) return;
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(at[0], at[1], 0);
    const dF = F.clone().sub(cam).dot(fwd), dq = dF - (s.d0 - s.dq);
    const P0 = cam.clone().addScaledVector(F.clone().sub(cam), dq / dF).sub(F);
    const sc = dq * s.d0 / (s.dq * dF);
    m.position.copy(P0);
    m.quaternion.copy(basis);
    m.scale.set(sc, sc * breath(clock.elapsedTime), sc);
  });

  const raycast = useMemo(() => {
    const hits: THREE.Intersection[] = [];
    return function (this: THREE.Mesh, rc: THREE.Raycaster, out: THREE.Intersection[]) {
      hits.length = 0;
      THREE.Mesh.prototype.raycast.call(this, rc, hits);
      const [tx, ty] = s.tiles, k = turn.current.shown;
      for (const h of hits) {
        if (!h.uv) continue;
        const px = Math.floor(((k % tx) + h.uv.x) / tx * alpha.w), py = Math.floor((Math.floor(k / tx) + 1 - h.uv.y) / ty * alpha.h);
        if (alpha.d[(Math.min(alpha.h - 1, py) * alpha.w + Math.min(alpha.w - 1, px)) * 4 + 3] > 128) out.push(h);
      }
    };
  }, [s, alpha]);
  return <group ref={mesh}>
    <mesh geometry={geometry} material={material} renderOrder={10} frustumCulled={false} raycast={raycast}
      onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined} />
    <mesh geometry={geometry} material={onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
  </group>;
}
