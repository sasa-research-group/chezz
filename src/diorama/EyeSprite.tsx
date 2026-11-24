// The eye square's prop as Cycles drew it (eye.ts has the timing, build_eye_cycles.py --bake the frames): drawn on
// a quad like the figures (KingSprite's sheetMeshes and placing), on its square, never moving. It dozes on the
// doze loop with its glow breathing, wakes on the wake sheet for the heading of the piece it sees, steps between
// headings on the still sheet (eye8) and nods off on the wake played backwards. All its sheets load before it
// shows, so it never flashes a frame of the wrong state. Its shadow comes from an unseen stand-in of the same size.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { BASE, sheetMeshes } from "./KingSprite";
import type { KingSheet } from "./KingSprite";
import { gameSpeed } from "./motion";
import { EYE_FIGURE, eyeFrame, eyeGlow, eyeStart, eyeTick, stareHeading } from "./eye";
import type { EyeAnim } from "./eye";

type Loop = KingSheet & { frames: number; fps: number; have: number[] };
const json = new Map<string, { p: Promise<unknown>; v: unknown }>();
/** Suspends until the JSON at `url` is in. */
function useJson<T>(url: string): T {
  let e = json.get(url);
  if (!e) {
    const en: { p: Promise<unknown>; v: unknown } = { p: fetch(url).then(r => r.json()), v: undefined };
    en.p.then(v => { en.v = v; }, () => {});
    json.set(url, e = en);
  }
  if (e.v === undefined) throw e.p;
  return e.v as T;
}
const WAKES = [0, 2, 4, 6];

/** `at`: the square (board coords) and `pos` its centre on the stage; `stare`: the square of the piece it sees. */
export function EyeSprite({ at, pos, stare, S }: { at: { x: number; y: number }; pos: [number, number]; stare: { x: number; y: number } | null | undefined; S: number }) {
  const f = EYE_FIGURE;
  const still = useJson<KingSheet>(`${BASE}${f}8.json`), wake = useJson<Loop>(`${BASE}${f}-wake.json`), doze = useJson<Loop>(`${BASE}${f}-doze.json`);
  const urls = [`${f}8.webp`, `${f}8-glow.png`, `${f}-doze0.webp`, `${f}-doze0-glow.webp`, ...WAKES.flatMap(k => [`${f}-wake${k}.webp`, `${f}-wake${k}-glow.webp`])];
  const tx = useLoader(THREE.TextureLoader, urls.map(u => BASE + u));
  const m = useMemo(() => {
    tx.forEach((t, i) => {
      t.colorSpace = i % 2 ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      if (!(i % 2)) t.generateMipmaps = true;
      t.needsUpdate = true;
    });
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(still.right), v(still.up), v(still.fwd).negate()));
    return {
      basis, fwd: v(still.fwd),
      still: sheetMeshes(still, tx[0], tx[1]), doze: sheetMeshes(doze, tx[2], tx[3]), wake: sheetMeshes(wake, tx[4], tx[5]),
      wakeTex: new Map(WAKES.map((k, j) => [k, [tx[4 + 2 * j], tx[5 + 2 * j]] as const])),
    };
  }, [tx, still, wake, doze]);
  useEffect(() => () => { for (const s of [m.still, m.doze, m.wake]) { s.geometry.dispose(); s.material.dispose(); s.onCards.dispose(); } }, [m]);

  const want = stareHeading(at, stare);
  const anim = useRef<EyeAnim>(eyeStart(want)), clock = useRef(0);
  const groups = { still: useRef<THREE.Group>(null), doze: useRef<THREE.Group>(null), wake: useRef<THREE.Group>(null) };
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []);
  const kGlow = m.still.material.uniforms.kGlow.value as number;
  useFrame(({ camera }, dt) => {
    dt = Math.min(dt, 0.1) * gameSpeed();
    clock.current += dt;
    anim.current = eyeTick(anim.current, want, dt, wake.frames);
    let fr = eyeFrame(anim.current, doze, wake.frames);
    // a heading with no wake baked (it only sees along its row and column): its still frame
    if (fr.sheet === "wake" && !m.wakeTex.has(fr.k)) fr = { sheet: "still", k: fr.k, i: fr.k };
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(pos[0], pos[1], 0);
    for (const key of ["still", "doze", "wake"] as const) {
      const g = groups[key].current;
      if (!g) continue;
      g.visible = fr.sheet === key;
      if (!g.visible) continue;
      const sh = key === "still" ? still : key === "doze" ? doze : wake, me = m[key], u = me.material.uniforms;
      if (key === "wake") {
        const t = m.wakeTex.get(fr.k)!;
        if (u.map.value !== t[0]) { u.map.value = t[0]; u.glow.value = t[1]; }
      }
      u.kGlow.value = kGlow * eyeGlow(anim.current, clock.current);
      const [ttx, tty] = sh.tiles;
      (u.tile.value as THREE.Vector2).set(fr.i % ttx, tty - 1 - Math.floor(fr.i / ttx));
      // as KingSprite's place(): the quad slid along the camera ray so it keeps the bake's gap in front of the
      // square, scaled to subtend what it would there
      const dF = F.clone().sub(cam).dot(m.fwd), dq = dF - (sh.d0 - sh.dq);
      g.position.copy(cam.clone().addScaledVector(F.clone().sub(cam), dq / dF).sub(new THREE.Vector3(pos[0], pos[1], 0)));
      g.quaternion.copy(m.basis);
      const sc = dq * sh.d0 / (sh.dq * dF);
      g.scale.set(sc, sc, sc);
    }
  });
  const quad = (key: "still" | "doze" | "wake") => {
    const me = m[key];
    return <group key={key} ref={groups[key]} visible={false}>
      <mesh geometry={me.geometry} material={me.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={me.geometry} material={me.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>;
  };
  // The stand-in that casts its shadow (build_eye_cycles.py: a 0.6 S plinth, the ball's centre 0.59 S up, 0.2 S
  // across); it draws nothing itself.
  const k = S / 2.04;
  return <>
    {quad("still")}{quad("doze")}{quad("wake")}
    <group scale={k}>
      <mesh castShadow position={[0, 0, 0.42]}><boxGeometry args={[1.1, 1.1, 0.84]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>
      <mesh castShadow position={[0, 0, 1.2]}><sphereGeometry args={[0.4, 16, 12]} /><meshBasicMaterial colorWrite={false} depthWrite={false} /></mesh>
    </group>
  </>;
}
