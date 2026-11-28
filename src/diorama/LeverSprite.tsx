// The lever square as Cycles drew it (lever.ts has the timing, build_lever_cycles.py --bake the frames): one layer,
// placed like the gate's back layer (SnareSprite's useLayer / placeLayer) and drawn before the figures (renderOrder 1):
// the handle rises from a slot in the middle of its square, and no figure stands on a lever square.
// It is thrown once the move that stopped on it has landed; its gates wait for the throw (leversBusy).
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gameSpeed, motionLeft } from "./motion";
import { placeLayer, useLayer } from "./SnareSprite";
import { leverFrame, leverMoving, leverStart, leverTick, setLeverMoving } from "./lever";
import type { LeverAnim } from "./lever";

/** `name`: leverSquare()'s sheet name; `pos`: the square's centre on the stage; `throws`: leverThrows() so far. */
export function LeverSprite({ name, pos, throws }: { name: string; pos: [number, number]; throws: number }) {
  const L = useLayer(name, "throw");
  const anim = useRef<LeverAnim>(leverStart(throws, performance.now()));
  const id = `${name}@${pos[0].toFixed(2)},${pos[1].toFixed(2)}`;
  useEffect(() => () => setLeverMoving(id, false), [id]);
  const g = useRef<THREE.Group>(null);
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []), P = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }, dt) => {
    anim.current = leverTick(anim.current, throws, performance.now(), motionLeft(), Math.min(dt, 0.1) * gameSpeed());
    setLeverMoving(id, leverMoving(anim.current));
    const i = Math.min(L.sh.frames - 1, leverFrame(anim.current));
    const [ttx, tty] = L.sh.tiles;
    (L.me.material.uniforms.tile.value as THREE.Vector2).set(i % ttx, tty - 1 - Math.floor(i / ttx));
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    F.set(pos[0], pos[1], 0);
    if (g.current) placeLayer(g.current, L, cam, F, P, null);
  });
  return <group ref={g}>
    <mesh geometry={L.me.geometry} material={L.me.material} renderOrder={1} frustumCulled={false} raycast={() => {}} />
  </group>;
}
