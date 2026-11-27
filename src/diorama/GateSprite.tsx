// The gate square as Cycles drew it (gate.ts has the timing, build_gate_cycles.py --bake the frames), in two layers
// placed like the snare's (SnareSprite's useLayer / placeLayer):
// - swing: the gate and its floor, drawn before the figures (renderOrder 1), so a figure in the open doorway covers
//   the doors swung back behind it;
// - front: only the gate's parts nearer the camera than that figure (the arch's front), drawn among the figures
//   (renderOrder 10) and sorted just in front of the one standing there.
// Both play the same frame: forward as the gate opens, backward as it shuts.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameSpeed, standGap } from "./motion";
import { frontGap } from "./snare";
import { placeLayer, useLayer } from "./SnareSprite";
import { gateFrame, gateStart, gateTick } from "./gate";
import type { GateAnim } from "./gate";

/** `name`: gateSquare()'s sheet name; `pos`: the square's centre on the stage; `open`: whether the gate is open. */
export function GateSprite({ name, pos, open }: { name: string; pos: [number, number]; open: boolean }) {
  const back = useLayer(name, "swing"), front = useLayer(name, "front");
  const anim = useRef<GateAnim>(gateStart(open));
  const gb = useRef<THREE.Group>(null), gf = useRef<THREE.Group>(null);
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []), P = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    const frames = back.sh.frames;
    anim.current = gateTick(anim.current, open, Math.min(dt, 0.1) * gameSpeed(), frames);
    const i = gateFrame(anim.current, frames);
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(pos[0], pos[1], 0);
    for (const [L, g] of [[back, gb.current], [front, gf.current]] as const) {
      const [ttx, tty] = L.sh.tiles;
      (L.me.material.uniforms.tile.value as THREE.Vector2).set(i % ttx, tty - 1 - Math.floor(i / ttx));
      if (g) placeLayer(g, L, cam, F, P, L === front ? frontGap(standGap(pos[0], pos[1]), L.sh.d0 - L.sh.dq) : null);
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
