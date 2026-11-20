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

const vert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const frag = /* glsl */ `
uniform sampler2D map; uniform sampler2D glow; uniform float invExpo; uniform float glowK; uniform vec2 tile; uniform vec2 tiles;
varying vec2 vUv;
void main(){
  vec2 uv = (tile + vUv) / tiles;
  vec4 c = texture2D(map, uv);
  if (c.a < 0.004) discard;
  vec3 g = texture2D(glow, uv).rgb;
  gl_FragColor = vec4(c.rgb * invExpo + g * g * glowK, c.a);
}`;

const STEP = 0.2;  // a turn walks through the headings in between over this long
const tileOf = (yaw: number, n: number) => ((Math.round(yaw / (2 * Math.PI / n)) % n) + n) % n;

/** `at`: his square's centre in stage units (Blender axes); `yaw` as for <King>. Clicks where he is opaque. */
export function KingSprite({ at, yaw = 0, onClick }: { at: [number, number]; yaw?: number; onClick?: () => void }) {
  const s = useSheet();
  const [map, glow] = useLoader(THREE.TextureLoader, [`${BASE}king8.webp`, `${BASE}king8-glow.png`]);
  const mesh = useRef<THREE.Mesh>(null);
  const { geometry, material, basis, alpha } = useMemo(() => {
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
        tile: { value: new THREE.Vector2() }, tiles: { value: new THREE.Vector2(...s.tiles) },
      },
    });
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const b = new THREE.Matrix4().makeBasis(v(s.right), v(s.up), v(s.fwd).negate());
    // His alpha, for clicks: only where he is drawn, so the square behind his head stays clickable.
    const img = map.image as HTMLImageElement, c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const cx = c.getContext("2d", { willReadFrequently: true })!; cx.drawImage(img, 0, 0);
    return { geometry: g, material: m, basis: new THREE.Quaternion().setFromRotationMatrix(b), alpha: { d: cx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } };
  }, [map, glow, s]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);

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
  return <mesh ref={mesh} geometry={geometry} material={material} renderOrder={10} frustumCulled={false} raycast={raycast}
    onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined} />;
}
