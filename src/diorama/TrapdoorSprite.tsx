// The trapdoor square as Cycles drew it (trapdoor.ts has the timing, build_trapdoor_cycles.py --bake the frames):
// one sheet per square of the set, drawn on a quad like the eye (EyeSprite, KingSprite's sheetMeshes and placing),
// but without the copy that sorts against figure cards by depth: a floor never covers a figure, so it skips card
// pixels altogether (the stencil). Each square's bake was made from that square's own centre, so the quad lands at
// scale 1. Shut, it shows the first frame; when `open` turns on it plays the drop once and holds the last frame.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { BASE, sheetMeshes } from "./KingSprite";
import type { KingSheet } from "./KingSprite";
import { gameSpeed } from "./motion";
import { trapFrame, trapStart, trapTick } from "./trapdoor";
import type { TrapAnim } from "./trapdoor";

type Drop = KingSheet & { frames: number; fps: number };
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

/** `name`: trapSquare()'s sheet name; `pos`: the square's centre on the stage; `open`: the door has fallen. */
export function TrapdoorSprite({ name, pos, open }: { name: string; pos: [number, number]; open: boolean }) {
  const sh = useJson<Drop>(`${BASE}${name}-drop.json`);
  const tx = useLoader(THREE.TextureLoader, [`${BASE}${name}-drop0.webp`, `${BASE}${name}-drop0-glow.webp`]);
  const m = useMemo(() => {
    tx[0].colorSpace = THREE.SRGBColorSpace; tx[0].generateMipmaps = true; tx[0].needsUpdate = true;
    tx[1].colorSpace = THREE.NoColorSpace; tx[1].needsUpdate = true;
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(sh.right), v(sh.up), v(sh.fwd).negate()));
    return { basis, fwd: v(sh.fwd), me: sheetMeshes(sh, tx[0], tx[1]) };
  }, [tx, sh]);
  useEffect(() => () => { m.me.geometry.dispose(); m.me.material.dispose(); m.me.onCards.dispose(); }, [m]);

  const anim = useRef<TrapAnim>(trapStart(open));
  const g = useRef<THREE.Group>(null);
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    anim.current = trapTick(anim.current, open, Math.min(dt, 0.1) * gameSpeed());
    const i = trapFrame(anim.current, sh.frames), [ttx, tty] = sh.tiles;
    (m.me.material.uniforms.tile.value as THREE.Vector2).set(i % ttx, tty - 1 - Math.floor(i / ttx));
    const gr = g.current;
    if (!gr) return;
    // as EyeSprite: slid along the camera ray to keep the bake's gap in front of the square
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(pos[0], pos[1], 0);
    const dF = F.clone().sub(cam).dot(m.fwd), dq = dF - (sh.d0 - sh.dq);
    gr.position.copy(cam.clone().addScaledVector(F.clone().sub(cam), dq / dF).sub(new THREE.Vector3(pos[0], pos[1], 0)));
    gr.quaternion.copy(m.basis);
    const sc = dq * sh.d0 / (sh.dq * dF);
    gr.scale.set(sc, sc, sc);
  });
  return <group ref={g}>
    <mesh geometry={m.me.geometry} material={m.me.material} renderOrder={1} frustumCulled={false} raycast={() => {}} />
  </group>;
}
