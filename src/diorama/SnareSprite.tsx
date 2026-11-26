// The snare square as Cycles drew it (snare.ts has the timing, build_snare_cycles.py --bake the frames), in two
// layers on quads placed like the trapdoor's (TrapdoorSprite, KingSprite's sheetMeshes):
// - spring: the whole square, a floor drawn before the figures (renderOrder 1), so a figure on it covers the roots
//   behind its legs;
// - front: only the roots nearer the camera than the figure's legs, drawn among the figures (renderOrder 10) and
//   sorted just in front of the one standing there, so they close over its ankles. Three sorts transparent quads by
//   their position, so this quad is slid along the camera ray to the depth it must sort at; sliding along the ray
//   with the matching scale leaves the picture exactly where it was.
// Both play the same frame: forward as a figure comes to rest on it, backward when the square empties.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { BASE, sheetMeshes } from "./KingSprite";
import type { KingSheet } from "./KingSprite";
import { gameSpeed, standGap } from "./motion";
import { frontGap, snareFrame, snareStart, snareTick, snareWant } from "./snare";
import type { SnareAnim, SnareHolds } from "./snare";
import { useJson } from "./TrapdoorSprite";

type Spring = KingSheet & { frames: number; fps: number };

function useLayer(name: string, layer: "spring" | "front") {
  const sh = useJson<Spring>(`${BASE}${name}-${layer}.json`);
  const tx = useLoader(THREE.TextureLoader, [`${BASE}${name}-${layer}0.webp`, `${BASE}${name}-${layer}0-glow.webp`]);
  const m = useMemo(() => {
    tx[0].colorSpace = THREE.SRGBColorSpace; tx[0].generateMipmaps = true; tx[0].needsUpdate = true;
    tx[1].colorSpace = THREE.NoColorSpace; tx[1].needsUpdate = true;
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const basis = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(v(sh.right), v(sh.up), v(sh.fwd).negate()));
    return { sh, basis, fwd: v(sh.fwd), me: sheetMeshes(sh, tx[0], tx[1]) };
  }, [tx, sh]);
  useEffect(() => () => { m.me.geometry.dispose(); m.me.material.dispose(); m.me.onCards.dispose(); }, [m]);
  return m;
}

/** `name`: snareSquare()'s sheet name (or a level's baked one); `pos`: the square's centre on the stage; `holds`: who
 * stands on it. */
export function SnareSprite({ name, pos, holds }: { name: string; pos: [number, number]; holds: SnareHolds }) {
  const back = useLayer(name, "spring"), front = useLayer(name, "front");
  const anim = useRef<SnareAnim>(snareStart(holds !== null));
  const gb = useRef<THREE.Group>(null), gf = useRef<THREE.Group>(null);
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []), P = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const fig = standGap(pos[0], pos[1]), frames = back.sh.frames;
    anim.current = snareTick(anim.current, snareWant(holds, fig !== null), Math.min(dt, 0.1) * gameSpeed(), frames);
    const i = snareFrame(anim.current, frames);
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(pos[0], pos[1], 0);
    for (const [L, g, gap] of [[back, gb.current, null], [front, gf.current, fig]] as const) {
      const [ttx, tty] = L.sh.tiles;
      (L.me.material.uniforms.tile.value as THREE.Vector2).set(i % ttx, tty - 1 - Math.floor(i / ttx));
      if (!g) continue;
      // q: the depth the quad sits (and sorts) at, along the ray to the square's centre; the back layer at the bake's own
      const own = L.sh.d0 - L.sh.dq, dF = P.copy(F).sub(cam).dot(L.fwd);
      const q = dF - (L === front ? frontGap(gap, own) : own);
      g.position.copy(cam).addScaledVector(P.copy(F).sub(cam), q / dF).sub(F);
      g.quaternion.copy(L.basis);
      const sc = q * L.sh.d0 / (L.sh.dq * dF);
      g.scale.set(sc, sc, sc);
    }
  });
  return <>
    <group ref={gb}>
      <mesh geometry={back.me.geometry} material={back.me.material} renderOrder={1} frustumCulled={false} raycast={() => {}} />
    </group>
    <group ref={gf}>
      <mesh geometry={front.me.geometry} material={front.me.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={front.me.geometry} material={front.me.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>
  </>;
}
