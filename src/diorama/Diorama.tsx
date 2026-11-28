// The 3D diorama board: the baked Cycles set (set.ts) with live pieces on it, graded like the stage
// renders (bloom, the compositor grade, Standard view, the concept LUT). Shared: the studio's Puzzles tab
// uses it now; the game can mount the same <Diorama> with its own squares and pieces later.
import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BloomEffect, Effect, EffectComposer, EffectPass, LUT3DEffect, LUTCubeLoader, RenderPass } from "postprocessing";
import { GradeEffect } from "./grade";
import { King } from "./King";
import { CARD_STENCIL, KingSprite } from "./KingSprite";
import { spriteFigure } from "./figures";
import { liveLights } from "./liveLights";
export { SPRITE_FIGURES, spriteFigure } from "./figures";
import { yawOf } from "./facing";
import { useGLTF } from "@react-three/drei";
import { PILLAR_H, PILLAR_W, WALL_H, WALL_HALF_GLB, WALL_PIL_GLB, WALL_SEG_GLB, WALL_T, wallArms, wallPieces, type Arms } from "./walls";
import { gameSpeed, hitTime, moving, willClear } from "./motion";
import { EyeSprite } from "./EyeSprite";
import { TrapdoorSprite } from "./TrapdoorSprite";
import { trapSquare } from "./trapdoor";
import { GateSprite } from "./GateSprite";
import { LeverSprite } from "./LeverSprite";
import { leverSquare } from "./lever";
import { gateSquare, gateTurn as turnOfGate } from "./gate";
import { SnareSprite } from "./SnareSprite";
import { snareSquare } from "./snare";
import type { SnareHolds } from "./snare";
import { LIE, SINK, TIP, deathSettles, faceTaker, takenFall } from "./death";
import type { Facing } from "./facing";
import { bakeCamera, cutSet, loadSet, loadSetAt, slide, sourceFor, viewFor } from "./set";
import { PREVIEW_MAX, bakeDir, bakeFor, bakedSnare, bakedTrap, loadBakeIndex, needsBake, stopSet } from "./levelBake";
import type { BakeIndex, LevelBake, Layout } from "./levelBake";
import { PAN_MS, SWIPE_PX, ease, nearestStop, stageOf, stepStop, swipeDir, trapStop } from "./pan";
import type { Stop } from "./pan";
import type { SetData } from "./set";

const BASE = "diorama/";
/** `?king=live` swaps the pre-rendered Cycles king for the live glTF one, to compare. */
const KING_LIVE = /[?&]king=live\b/.test(location.search);
/** A piece drawn as a pre-rendered figure that runs from square to square (KingSprite); else a card or the live king. */
const runsAsSprite = (pc: DioramaPiece) => {
  const isKing = pc.kind === "king" && pc.side === "white";
  return !!spriteFigure(pc) && !(isKing && KING_LIVE) && (isKing || pc.falling === undefined);
};
/** Blender's axes (z up) to three's (y up): every child of <Blender> is placed in stage units. */
const Blender = ({ children }: { children: ReactNode }) => <group rotation={[-Math.PI / 2, 0, 0]}>{children}</group>;
const toThree = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y);

const setVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// keep < 1: a stop fading out as the camera pans to the next (pan.ts) drops that share of its pixels in an 8x8
// Bayer pattern, and the next stop's picture, drawn just behind, shows through
const setFrag = /* glsl */ `
uniform sampler2D map; uniform sampler2D glow; uniform float invExpo; uniform float glowK; uniform float keep; varying vec2 vUv;
float bayer2(vec2 a){ a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
float bayer8(vec2 a){ return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a); }
void main(){
  if (keep < 1.0 && bayer8(gl_FragCoord.xy) >= keep) discard;
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  vec3 g = texture2D(glow, vUv).rgb;
  gl_FragColor = vec4(c.rgb * invExpo + g * g * glowK, 1.0);
}`;

/** The baked set, cut and slid for this board. Panning (pan.ts): `fade` set, this stop is fading out (it keeps
 * 1 - fade of its pixels); `back`, it is the stop fading in, drawn a hair behind the one going; `onReady` once its
 * pictures are in. */
function SetMesh({ data, w, h, fade, back, onReady }: { data: SetData; w: number; h: number; fade?: RefObject<number>; back?: boolean; onReady?: () => void }) {
  const [map, glow] = useLoader(THREE.TextureLoader, [`${data.at}.webp`, `${data.at}-glow.png`]);
  const gl = useThree(s => s.gl);
  const material = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = gl.capabilities.getMaxAnisotropy(); map.needsUpdate = true;
    glow.colorSpace = THREE.NoColorSpace;
    return new THREE.ShaderMaterial({
      vertexShader: setVert, fragmentShader: setFrag,
      uniforms: { map: { value: map }, glow: { value: glow }, invExpo: { value: Math.pow(2, -data.info.exposure) }, glowK: { value: data.info.glowK }, keep: { value: 1 } },
    });
  }, [map, glow, gl, data]);
  useEffect(() => { material.polygonOffset = !!back; material.polygonOffsetFactor = 2; material.polygonOffsetUnits = 8; }, [material, back]);
  useEffect(() => () => material.dispose(), [material]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when its pictures are in
  useEffect(() => { onReady?.(); }, []);
  useFrame(() => { material.uniforms.keep.value = fade ? 1 - fade.current : 1; });
  const pieces = useMemo(() => cutSet(data, w, h), [data, w, h]);
  useEffect(() => () => pieces.forEach(p => p.geometry.dispose()), [pieces]);
  return <>{pieces.map((p, i) => <mesh key={i} geometry={p.geometry} material={material} position={[p.shift[0], p.shift[1], 0]} frustumCulled={false} />)}</>;
}

/** Live lights for the pieces: the bake's own lamps (liveLights.ts), so a board of any size or length is lit the
 * way its bake was. */
function Lights({ data, w, h }: { data: SetData; w: number; h: number }) {
  const H = data.info.H;
  const spot = (ref: THREE.SpotLight | null, dir: [number, number, number]) => {
    if (!ref) return;
    ref.target.position.copy(ref.position).add(new THREE.Vector3(...dir));
    ref.target.updateMatrixWorld();
  };
  const bulbs = data.info.bulbs.map(b => slide(data.info, w, h, b)).filter(Boolean) as [number, number, number][];
  const lamps = useMemo(() => liveLights(data.info, w, h), [data, w, h]);
  return <>
    <hemisphereLight args={[new THREE.Color(0.10, 0.13, 0.2), new THREE.Color(0.05, 0.05, 0.035), 0.35]} />
    {lamps.map((l, i) => l.kind === "point"
      ? <pointLight key={i} position={l.at} intensity={l.intensity} color={new THREE.Color(...l.color)} decay={2} />
      : <spotLight key={i} ref={r => spot(r, l.dir)} position={l.at} intensity={l.intensity} angle={l.angle} penumbra={l.penumbra} color={new THREE.Color(...l.color)} decay={2} />)}
    {bulbs.map((b, i) => <pointLight key={i} position={b} intensity={22 / (4 * Math.PI)} color={new THREE.Color(1.0, 0.62, 0.32)} decay={2} />)}
    <BulbHalos bulbs={bulbs} H={H} />
    <ShadowCatcher data={data} w={w} h={h} />
  </>;
}

/** One soft warm halo per fairy bulb, the same on every bulb: the baked glow depends on how much moss hangs
 * near a bulb, so a bulb in the open looked like a bare white dot next to its glowing neighbours. Depth-tested
 * against the set, so moss and trunks in front still cover it; additive and brighter than white at the
 * core, so the bloom picks it up like the baked glow. */
export const HALO = { size: 0.42, core: 1.6, pull: 0.2 } as const; // size and pull in units of H; core = brightness at the centre
let haloTex: THREE.Texture | null = null;
function haloTexture() {
  if (haloTex) return haloTex;
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d")!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,236,190,1)"); g.addColorStop(0.18, "rgba(255,190,105,0.7)"); g.addColorStop(0.5, "rgba(255,150,60,0.18)"); g.addColorStop(1, "rgba(255,130,40,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c); haloTex.colorSpace = THREE.SRGBColorSpace;
  return haloTex;
}
function BulbHalos({ bulbs, H }: { bulbs: [number, number, number][]; H: number }) {
  // pulled toward the camera so loose moss right around a bulb doesn't nibble its halo (three's y-up camera
  // position back into Blender axes: x, -z, y)
  const cam = useThree(s => s.camera.position);
  const at = useMemo(() => bulbs.map(b => {
    const v = new THREE.Vector3(...b), eye = new THREE.Vector3(cam.x, -cam.z, cam.y);
    return v.addScaledVector(eye.sub(v).normalize(), HALO.pull * H).toArray() as [number, number, number];
  }), [bulbs, H, cam.x, cam.y, cam.z]);
  const mat = useMemo(() => new THREE.SpriteMaterial({ map: haloTexture(), color: new THREE.Color(HALO.core, HALO.core, HALO.core), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }), []);
  useEffect(() => () => mat.dispose(), [mat]);
  return <>{at.map((b, i) => <sprite key={i} position={b} scale={[HALO.size * H, HALO.size * H, 1]} material={mat} name="bulb-halo" />)}</>;
}

/** Live shadows on the baked floor: a shadow-only light along the stage's key (stage.py's pool spot, high over
 * the front edge and tipped 32 degrees toward the back, so shadows fall short and behind the piece, a touch
 * right from the lantern on the left) and a ShadowMaterial plane over the board that shows nothing but the
 * shadow. The light adds no light (intensity 0): the bake already has it. VSM blurs it as soft as Cycles'. */
const KEY_DIR = new THREE.Vector3(0.04, 0.55, -0.83).normalize();
function ShadowCatcher({ data, w, h }: { data: SetData; w: number; h: number }) {
  const { S, H } = data.info, r = Math.max(w, h) * S * 0.75 + H, far = 4 * r;
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight(0xffffff, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    Object.assign(l.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 0.1, far });
    l.shadow.camera.updateProjectionMatrix();
    l.shadow.radius = 9; l.shadow.blurSamples = 16; l.shadow.bias = -0.0005;
    return l;
  }, [r, far]);
  useEffect(() => () => light.dispose(), [light]);
  return <>
    <primitive object={light} position={KEY_DIR.clone().multiplyScalar(-far / 2).toArray()} />
    <mesh position={[0, 0, 0.03]} receiveShadow renderOrder={1}>
      <planeGeometry args={[w * S + 0.2 * S, h * S + 0.2 * S]} />
      <shadowMaterial color={new THREE.Color(0.02, 0.014, 0.01)} opacity={0.8} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
    </mesh>
  </>;
}

/** Bloom on what is brighter than white (the bulbs), the stage grade, then the concept LUT. Takes over
 * rendering from R3F (priority 1). */
function Post() {
  const { gl, scene, camera, size } = useThree();
  const lut = useLoader(LUTCubeLoader, `${BASE}grade-concept.cube`);
  // Built and disposed in one effect: StrictMode runs effects twice, and a composer made in useMemo was
  // disposed by the first cleanup and then drawn black. `?dio=nobloom,nograde,nolut` drops stages to compare.
  const [composer, setComposer] = useState<EffectComposer | null>(null);
  useEffect(() => {
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, stencilBuffer: true, multisampling: Math.min(4, gl.capabilities.maxSamples) });
    c.addPass(new RenderPass(scene, camera));
    const dbg = new URLSearchParams(location.search).get("dio") ?? "";
    const bloom = new BloomEffect({ luminanceThreshold: 1.0, luminanceSmoothing: 0.4, intensity: 1.1, mipmapBlur: true, radius: 0.55 });
    bloom.mipmapBlurPass.levels = 6;
    const fx = [!dbg.includes("nobloom") && bloom, !dbg.includes("nograde") && new GradeEffect(), !dbg.includes("nolut") && new LUT3DEffect(lut, { tetrahedralInterpolation: true })].filter(Boolean) as Effect[];
    if (fx.length) c.addPass(new EffectPass(camera, ...fx));
    setComposer(c);
    return () => { setComposer(null); c.dispose(); };
  }, [gl, scene, camera, lut]);
  useEffect(() => { composer?.setSize(size.width, size.height); }, [composer, size]);
  useFrame((_, dt) => { if (composer) composer.render(dt); else gl.render(scene, camera); }, 1);
  return null;
}

/** Points the default camera down the locked play view for this board size. */
function PlayCamera({ data, w, h }: { data: SetData; w: number; h: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera, aspect = size.width / Math.max(1, size.height);
    const v = viewFor(data.info, w, h, aspect);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(v.hfov / 2) / aspect));
    cam.near = 0.5; cam.far = 400;
    cam.position.copy(toThree(v.pos));
    cam.up.set(0, 1, 0);
    cam.lookAt(toThree(v.target));
    cam.updateProjectionMatrix();
  }, [camera, size, data, w, h]);
  return null;
}

/** A level that pans (pan.ts): its stops, each one's set, and which stops baked each trapdoor. */
type Pan = { stops: Stop[]; datas: SetData[]; bake: LevelBake };
/** Which stop the camera is going to, and the one it is leaving (null at rest). */
type PanView = { to: number; from: number | null };

/** The camera on a level that pans: each stop's own bake camera (they differ by a slide only). Moving to a new stop,
 * it waits until that stop's pictures are in (`ready`), then slides there from wherever it is in PAN_MS, writing
 * how far it has got to `fade` for the stop fading out; `done` once it is there. */
function PanCamera({ pan, view, ready, fade, done }: { pan: Pan; view: PanView; ready: RefObject<Set<number>>; fade: RefObject<number>; done: () => void }) {
  const { camera, size } = useThree();
  const st = useRef<{ from: THREE.Vector3; at: THREE.Vector3; to: number; t0: number | null; done: boolean } | null>(null);
  useFrame(() => {
    const cam = camera as THREE.PerspectiveCamera, aspect = size.width / Math.max(1, size.height);
    const v = bakeCamera(pan.datas[view.to].info);
    const s = st.current ??= { from: v.pos.clone(), at: v.pos.clone(), to: view.to, t0: null, done: false };
    if (s.to !== view.to) Object.assign(s, { from: s.at.clone(), to: view.to, t0: null, done: false });
    if (s.t0 === null && ready.current.has(view.to)) s.t0 = performance.now();
    const e = s.t0 === null ? 0 : ease((performance.now() - s.t0) / PAN_MS);
    fade.current = e;
    s.at.copy(s.from).lerp(v.pos, e);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(v.hfov / 2) / aspect));
    cam.near = 0.5; cam.far = 400;
    cam.position.copy(toThree(s.at));
    cam.up.set(0, 1, 0);
    cam.lookAt(toThree(s.at.clone().add(v.target).sub(v.pos)));
    cam.updateProjectionMatrix();
    if (e >= 1 && view.from !== null && !s.done) { s.done = true; done(); }
  });
  return null;
}

const shadowTex = (() => {
  let t: THREE.Texture | null = null;
  return () => {
    if (t) return t;
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const g = c.getContext("2d")!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(0.55, "rgba(255,255,255,.55)"); r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    t = new THREE.CanvasTexture(c);
    return t;
  };
})();
/** A small soft dark patch right under a piece: contact shadow where the feet meet the floor. */
export const Blob = ({ x, y, r, o = 0.6 }: { x: number; y: number; r: number; o?: number }) =>
  <mesh position={[x, y, 0.035]} renderOrder={2}>
    <planeGeometry args={[r * 2, r * 1.6]} />
    <meshBasicMaterial color="black" alphaMap={shadowTex()} transparent opacity={o} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
  </mesh>;

export type DioramaSquare = {
  x: number; y: number;
  /** What sits on the square, drawn as placeholders until the dungeon art exists. */
  kind?: "hole" | "wall" | "eye" | "sludge" | "trapdoor" | "fallen" | "snare" | "gate" | "gate-open" | "lever" | "plate";
  goal?: "star" | "exit"; watched?: boolean; picked?: boolean; target?: "move" | "capture"; last?: boolean; flag?: boolean; wired?: boolean;
  /** An eye: the square of your piece it sees (it wakes and stares at it); null or missing, it dozes. */
  stare?: { x: number; y: number } | null;
  /** A lever: how many times it has been thrown (lever.ts leverThrows); odd, it rests thrown right. */
  throws?: number;
  label: string;
};
export type DioramaPiece = { id: string; kind: string; side: "white" | "black"; x: number; y: number;
  /** The way its last move went (facing.ts); null or missing: toward the camera. */ facing?: Facing; sprite?: { href: string; x: number; y: number; w: number; h: number }; asleep?: boolean; statue?: boolean; picked?: boolean;
  /** This figure is taking a piece with this move: it plays its attack (strike sheet). */ strike?: boolean;
  /** Your king stands in check: he plays the nervous loop. */ check?: boolean;
  /** Your king is checkmated: he plays his death once and holds its last frame. */ dead?: boolean;
  /** A piece just taken: it stays up until the king's blow lands, then falls away from him (his move's way). */ falling?: Facing;
  /** Taken by a piece with no attack to play: it falls (or dies) at once instead of waiting for a blow. */ hitNow?: boolean };

/** Flat tints and blocks for squares that are not plain floor yet (no 3D art for them so far). */
/** A wall: a thin ruined castle wall through the middle of the square, joined to the walls next to it (walls.ts),
 *  built from 3D pieces: a stretch that fills a square, its half, and a pillar. */
function Wall({ arms, seed, S, H }: { arms: Arms; seed: number; S: number; H: number }) {
  const seg = useGLTF(WALL_SEG_GLB), half = useGLTF(WALL_HALF_GLB), pil = useGLTF(WALL_PIL_GLB);
  const pieces = useMemo(() => wallPieces(arms, seed).map(p => {
    const o = { seg, half, pil }[p.kind].scene.clone(true);
    o.traverse(m => { if ((m as THREE.Mesh).isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    return { p, o };
  }), [arms, seed, seg, half, pil]);
  const h = WALL_H * H;
  return <>{pieces.map(({ p, o }, i) =>
    // the pieces are y-up unit boxes: stand them up in the z-up stage, then turn a front-to-back stretch
    <group key={i} position={[p.x * S, p.y * S, 0]} rotation={[0, 0, p.turn]}>
      <primitive object={o} rotation={[Math.PI / 2, 0, 0]}
        scale={p.kind === "pil" ? [PILLAR_W * S, PILLAR_H * h, PILLAR_W * S] : [(p.mirror ? -1 : 1) * (p.kind === "seg" ? 1 : 0.5) * S, h, WALL_T * S]} />
    </group>)}</>;
}
useGLTF.preload(WALL_SEG_GLB);
useGLTF.preload(WALL_HALF_GLB);
useGLTF.preload(WALL_PIL_GLB);

/** `trap`: a trapdoor's sheet (null: none, the flat stand-in) and, while the camera pans, the one it is leaving, shown
 * until the new one is in. `snare`: the same for a snare, and who stands on it. */
function SquareMarks({ sq, S, H, arms, pos, trap, snare, gateTurn, gate, lever }: { sq: DioramaSquare; S: number; H: number; arms?: Arms; gateTurn?: number; gate?: string | null; lever?: string | null; pos: [number, number]; trap?: { name: string | null; prev?: string | null }; snare?: { name: string | null; prev?: string | null; holds: SnareHolds } }) {
  const z = 0.05;
  const plane = (size: number, color: THREE.ColorRepresentation, opacity = 1, emissive = 0, key = "p") =>
    <mesh key={key} position={[0, 0, z]} renderOrder={1}>
      <planeGeometry args={[size * S, size * S]} />
      <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(1 + emissive)} transparent={opacity < 1} opacity={opacity} depthWrite={opacity >= 1} polygonOffset polygonOffsetFactor={-1} />
    </mesh>;
  const ring = (r0: number, r1: number, color: THREE.ColorRepresentation, k = 1, key = "r") =>
    <mesh key={key} position={[0, 0, z + 0.01]} renderOrder={1}>
      <ringGeometry args={[r0 * S, r1 * S, 40]} />
      <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(k)} transparent opacity={0.9} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
    </mesh>;
  const out: ReactNode[] = [];
  switch (sq.kind) {
    case "hole": out.push(plane(0.97, new THREE.Color(0.002, 0.002, 0.003), 1, 0, "hole")); break;
    case "wall": if (arms) out.push(<Wall key="w" arms={arms} seed={sq.x * 131 + sq.y * 7919} S={S} H={H} />); break;
    case "eye": out.push(<EyeSprite key="w" at={sq} pos={pos} stare={sq.stare} S={S} />); break;
    case "sludge": out.push(plane(0.96, new THREE.Color(0.12, 0.35, 0.05), 0.82, 0.2, "sl")); break;
    case "trapdoor": case "fallen": {
      // the level's own baked door, else the 5x5 set's sheet for this spot (the preview); a flat stand-in
      // anywhere else (its own Suspense: while a sheet loads, or if one is missing, only this square shows it)
      const name = trap?.name ?? null, prev = trap?.prev ?? null, open = sq.kind === "fallen";
      const flat = open ? plane(0.97, new THREE.Color(0.002, 0.002, 0.003), 1, 0, "hole")
        : <group key="tf">{plane(0.8, new THREE.Color(0.11, 0.06, 0.03), 1, 0, "td")}{ring(0.38, 0.42, new THREE.Color(0.25, 0.16, 0.08), 1, "tr")}</group>;
      const wait = prev && prev !== name ? <Suspense fallback={flat}><TrapdoorSprite name={prev} pos={pos} open={open} /></Suspense> : flat;
      out.push(name ? <Suspense key="td" fallback={wait}><TrapdoorSprite name={name} pos={pos} open={open} /></Suspense> : flat);
      break;
    }
    case "snare": {
      // as the trapdoor: the level's own bake, else the 5x5 set's sheet for this spot, else a flat ring
      const name = snare?.name ?? null, prev = snare?.prev ?? null, holds = snare?.holds ?? null;
      const flat = ring(0.24, 0.3, new THREE.Color(0.45, 0.28, 0.12), 1, "sn");
      const wait = prev && prev !== name ? <Suspense fallback={flat}><SnareSprite name={prev} pos={pos} holds={holds} /></Suspense> : flat;
      out.push(name ? <Suspense key="sn" fallback={wait}><SnareSprite name={name} pos={pos} holds={holds} /></Suspense> : flat);
      break;
    }
    case "gate": case "gate-open": {
      // its sheet (Scene's gateOf), else (and while it loads) the old bars, shut only
      const bars = <group key="gb" rotation={[0, 0, gateTurn ?? 0]}>{[-2, -1, 0, 1, 2].map(i => <mesh key={i} position={[i * 0.19 * S, 0, 0.4 * H]}><boxGeometry args={[0.05 * S, 0.05 * S, 0.8 * H]} /><meshStandardMaterial color={new THREE.Color(0.3, 0.3, 0.32)} metalness={0.6} roughness={0.5} /></mesh>)}</group>;
      const name = gate ?? null, shut = sq.kind === "gate" ? bars : null;
      out.push(name ? <Suspense key="gt" fallback={shut}><GateSprite name={name} pos={pos} open={sq.kind === "gate-open"} /></Suspense> : shut);
      break;
    }
    case "lever": {
      // its sheet (Scene's leverOf), else (and while it loads) the old block and stick
      const stub = <group key="lv">
        <mesh position={[0, 0, 0.04 * H]}><boxGeometry args={[0.3 * S, 0.18 * S, 0.08 * H]} /><meshStandardMaterial color={new THREE.Color(0.25, 0.2, 0.15)} /></mesh>
        <mesh position={[0.05 * S, 0, 0.25 * H]} rotation={[0, 0.5, 0]}><cylinderGeometry args={[0.02 * S, 0.02 * S, 0.45 * H]} /><meshStandardMaterial color={new THREE.Color(0.55, 0.4, 0.2)} /></mesh>
      </group>;
      out.push(lever ? <Suspense key="lv" fallback={stub}><LeverSprite name={lever} pos={pos} throws={sq.throws ?? 0} /></Suspense> : stub);
      break;
    }
    case "plate": out.push(<mesh key="pl" position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.32 * S, 0.34 * S, 0.06, 32]} /><meshStandardMaterial color={new THREE.Color(0.35, 0.3, 0.22)} metalness={0.3} /></mesh>); break;
  }
  if (sq.watched) out.push(plane(0.96, new THREE.Color(0.6, 0.05, 0.05), 0.22, 0, "wa"));
  if (sq.last) out.push(plane(0.96, new THREE.Color(0.9, 0.6, 0.15), 0.25, 0, "la"));
  if (sq.goal) out.push(ring(0.3, 0.38, new THREE.Color(1.0, 0.75, 0.25), 1.6, "go"));
  if (sq.wired) out.push(ring(0.42, 0.47, new THREE.Color(0.2, 0.8, 1.0), 1.2, "wi"));
  if (sq.flag) out.push(ring(0.44, 0.49, new THREE.Color(1.0, 0.1, 0.1), 1.3, "fl"));
  if (sq.picked) out.push(ring(0.36, 0.46, new THREE.Color(1.0, 0.9, 0.5), 1.8, "pk"));
  if (sq.target === "move") out.push(<mesh key="tg" position={[0, 0, z + 0.02]}><circleGeometry args={[0.1 * S, 24]} /><meshBasicMaterial color={new THREE.Color(1.6, 1.4, 0.8)} transparent opacity={0.85} depthWrite={false} /></mesh>);
  if (sq.target === "capture") out.push(ring(0.38, 0.46, new THREE.Color(1.0, 0.3, 0.2), 1.6, "cp"));
  return <>{out}</>;
}

/** An upright card with the piece's painted sprite, for every piece without a 3D model yet. */
function Card({ pc, S, onClick }: { pc: DioramaPiece & { sprite: NonNullable<DioramaPiece["sprite"]> }; S: number; onClick: () => void }) {
  const tex = useLoader(THREE.TextureLoader, pc.sprite.href);
  useMemo(() => { tex.colorSpace = THREE.SRGBColorSpace; }, [tex]);
  // Sprites are painted facing right; a card can't turn, so it mirrors after a move left or right.
  const k = 0.85 * S / 100, b = pc.sprite, w = b.w * k, h = b.h * k, mirror = pc.facing?.[0] ? pc.facing[0] < 0 : pc.side === "black";
  const tint = pc.statue ? new THREE.Color(0.32, 0.32, 0.32) : pc.asleep ? new THREE.Color(0.28, 0.3, 0.42) : new THREE.Color(0.5, 0.47, 0.43);
  return <group position={[0, 0, 0]} onClick={e => { e.stopPropagation(); onClick(); }}>
    <mesh castShadow position={[(b.x + b.w / 2 - 50) * k * (mirror ? -1 : 1), 0, (108 - b.y - b.h / 2) * k]} rotation={[Math.PI / 2, 0, 0]} scale={[mirror ? -1 : 1, 1, 1]}>
      <planeGeometry args={[w, h]} />
      {/* stencil CARD_STENCIL where drawn: the pre-rendered king sorts against cards by true depth (KingSprite) */}
      <meshBasicMaterial map={tex} color={tint} alphaTest={0.5} side={THREE.DoubleSide} shadowSide={THREE.DoubleSide}
        stencilWrite stencilRef={CARD_STENCIL} stencilZPass={THREE.ReplaceStencilOp} />
    </mesh>
  </group>;
}

const NO_HIT = 4000;  // ms: a taken piece falls anyway if no blow is announced (the live 3D king, no strike sheet)
/** When the blow lands on a taken piece at `at` (motion.ts), or after NO_HIT if none is announced. */
const takenHit = (at: [number, number], born: number, now = false) => {
  if (now) return born;
  return hitTime(at[0], at[1], born - 50) ?? (performance.now() - born > NO_HIT ? born + NO_HIT : null);
};
/** A taken piece: stands until the blow lands on its square, then tips over away from it and sinks out of
 * sight; a figure whose death sheet is in (`dying`, set by its KingSprite) plays its death instead of tipping,
 * lies still a moment, then sinks (death.ts takenFall). */
function Falling({ at, away, born: from, now, dying, children }: { at: [number, number]; away: Facing; born?: number; now?: boolean; dying?: RefObject<number | null>; children: ReactNode }) {
  const own = useMemo(() => performance.now(), []), born = from ?? own;
  const g = useRef<THREE.Group>(null), death = useRef<{ len: number | null; at: number } | null>(null);
  // tip about the floor line across his blow: the axis is the blow's direction turned a quarter
  const axis = useMemo(() => { const [x, y] = away ?? [0, 1], l = Math.hypot(x, y) || 1; return new THREE.Vector3(-y / l, x / l, 0); }, [away]);
  useFrame(() => {
    const o = g.current;
    if (!o) return;
    const ms = performance.now(), hit = takenHit(at, born, now);
    // whether the death plays is settled when the blow lands (its sheet in for the heading he faces, or not;
    // a figure just mounted gets SHEET_WAIT ms for it to come in); the dungeon's reply waits until he has gone
    if (!death.current && deathSettles(ms, hit, dying ? dying.current : undefined)) {
      const len = dying?.current ?? null;
      death.current = { len, at: ms };
      moving(((len === null ? TIP : len + LIE) + SINK) / gameSpeed());
      // its taker, waiting beside it, steps onto the square as it starts to sink
      willClear(at[0], at[1], ms + (len === null ? TIP : len + LIE) * 1000 / gameSpeed());
    }
    const t = death.current ? (ms - death.current.at) / 1000 * gameSpeed() : -1;
    const f = takenFall(t, death.current?.len ?? null);
    o.quaternion.setFromAxisAngle(axis, Math.PI / 2 * f.tip);
    o.position.z = -f.sink * 1.2;
    o.visible = f.visible;
  });
  return <group ref={g}>{children}</group>;
}

/** A pre-rendered figure (the king, the patrol guard): it runs from square to square (KingSprite), its blob goes
 * with it, and the king's shadow-only 3D model too. */
function RunningKing({ pc, figure, at, S, onClick, dieAt, dying }: { pc: DioramaPiece; figure: string; at: [number, number]; S: number; onClick: () => void; dieAt?: () => number | null; dying?: RefObject<number | null> }) {
  const follow = useRef<THREE.Group>(null);
  // taken: he turns to face his taker, so the death throws him back away from the blow
  const yaw = yawOf(pc.falling !== undefined ? faceTaker(pc.falling ?? [0, 1]) : pc.facing ?? null);
  return <>
    <KingSprite figure={figure} at={at} yaw={yaw} onClick={onClick} follow={follow} strike={pc.strike} check={pc.check} dead={pc.dead} dieAt={dieAt} deathLen={dying} />
    <group ref={follow}>
      <Blob x={0} y={0} r={0.2 * S} o={0.35} />
      {figure === "king" && <King position={[0, 0, 0]} yaw={yaw} shadowOnly />}
    </group>
  </>;
}

/** A taken sprite figure (the patrol guard): faces his taker, plays his death from the blow, then sinks out. */
function TakenFigure({ pc, figure, at, S, onClick }: { pc: DioramaPiece; figure: string; at: [number, number]; S: number; onClick: () => void }) {
  const born = useMemo(() => performance.now(), []), dying = useRef<number | null>(null);
  const [ax, ay] = at, now = !!pc.hitNow, dieAt = useCallback(() => takenHit([ax, ay], born, now), [ax, ay, born, now]);
  return <Falling at={at} away={pc.falling ?? null} born={born} now={now} dying={dying}>
    <RunningKing pc={pc} figure={figure} at={at} S={S} onClick={onClick} dieAt={dieAt} dying={dying} />
  </Falling>;
}

/** The stop to rest on: the one nearest the picked piece, else your king, else the middle of the board. */
function focusOf(pieces: DioramaPiece[], w: number, h: number): Stop {
  const p = pieces.find(q => q.picked) ?? pieces.find(q => q.kind === "king" && q.side === "white" && q.falling === undefined);
  return p ? stageOf(w, h, p.x, p.y) : [0, 0];
}

function Scene({ data, w, h, squares, pieces, onSquare: tapped, fps, bakeKey, pan }: { data: SetData; bakeKey?: string; pan?: Pan; w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; fps?: (n: number) => void }) {
  const { S, H } = data.info;
  // Panning: rest on the stop nearest the piece in play; a swipe moves one stop over until that piece moves again
  const focus = focusOf(pieces, w, h), fk = focus.join(",");
  const [view, setView] = useState<PanView>(() => ({ to: pan ? nearestStop(pan.stops, focus) : 0, from: null }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the piece in play moves (fk)
  useEffect(() => { if (pan) setView(v => { const k = nearestStop(pan.stops, focus, v.to); return k === v.to ? v : { to: k, from: v.to }; }); }, [fk, pan]);
  const ready = useRef(new Set<number>()), fade = useRef(0);
  const gl = useThree(s => s.gl);
  const drag = useRef<{ x: number; y: number; dx: number; dy: number } | null>(null);
  useEffect(() => {
    if (!pan) return;
    const el = gl.domElement, touch = el.style.touchAction;
    el.style.touchAction = "none";  // a swipe pans the board instead of scrolling the page
    const down = (e: PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; };
    const move = (e: PointerEvent) => { const d = drag.current; if (d) { d.dx = e.clientX - d.x; d.dy = e.clientY - d.y; } };
    const up = () => {
      const d = drag.current, dir = d && swipeDir(d.dx, d.dy);
      if (dir) setView(v => { const k = stepStop(pan.stops, v.to, dir); return k === v.to ? v : { to: k, from: v.to }; });
      setTimeout(() => { drag.current = null; }, 0);  // after the tap handlers have seen it was a swipe
    };
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { el.style.touchAction = touch; el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [gl, pan]);
  const onSquare = useCallback((x: number, y: number) => {
    const d = drag.current;
    if (!d || Math.hypot(d.dx, d.dy) < SWIPE_PX) tapped(x, y);
  }, [tapped]);
  const trapOf = (sq: DioramaSquare, pos: [number, number]) => {
    if (sq.kind !== "trapdoor" && sq.kind !== "fallen") return undefined;
    if (!bakeKey) return { name: trapSquare(pos, S) };
    if (!pan) return { name: bakedTrap(bakeKey, sq.x, sq.y) };
    const n = pan.bake.trapdoors.findIndex(([x, y]) => x === sq.x && y === sq.y);
    const from = (k: number) => { const s = trapStop(pan.bake.trapStops?.[n], pan.stops, k); return s === null ? null : bakedTrap(bakeKey, sq.x, sq.y, s); };
    return { name: from(view.to), prev: view.from === null ? null : from(view.from) };
  };
  // A lever: the 5x5 set's sheet for its spot; none yet on a level's own bake (the stand-in block and stick).
  const leverOf = (sq: DioramaSquare, pos: [number, number]) => sq.kind === "lever" && !bakeKey ? leverSquare(pos, S) : null;
  // A gate: the 5x5 set's sheet for its spot and the way it faces; none yet on a level's own bake (the bars stand in).
  const gateOf = (sq: DioramaSquare, pos: [number, number]) =>
    (sq.kind === "gate" || sq.kind === "gate-open") && !bakeKey ? gateSquare(pos, S, turnOfGate(squares, sq.x, sq.y)) : null;
  // A snare: its sheet as trapOf, and who stands on it (a piece just taken there is on its way off).
  const snareOf = (sq: DioramaSquare, pos: [number, number]) => {
    if (sq.kind !== "snare") return undefined;
    const pc = pieces.find(q => q.x === sq.x && q.y === sq.y && q.falling === undefined);
    const holds: SnareHolds = !pc ? null : runsAsSprite(pc) ? "figure" : "card";
    if (!bakeKey) return { name: snareSquare(pos, S), holds };
    if (!pan) return { name: bakedSnare(bakeKey, sq.x, sq.y), holds };
    const n = (pan.bake.snares ?? []).findIndex(([x, y]) => x === sq.x && y === sq.y);
    const from = (k: number) => { const s = trapStop(pan.bake.snareStops?.[n], pan.stops, k); return s === null ? null : bakedSnare(bakeKey, sq.x, sq.y, s); };
    return { name: from(view.to), prev: view.from === null ? null : from(view.from), holds };
  };
  const at = (x: number, y: number) => [(x - (w - 1) / 2) * S, ((h - 1) / 2 - y) * S] as const;
  const frames = useRef({ n: 0, t: 0 });
  useFrame((_, dt) => {
    if (!fps) return;
    const f = frames.current; f.n++; f.t += dt;
    if (f.t >= 1) { fps(f.n / f.t); f.n = 0; f.t = 0; }
  });
  const [hover, setHover] = useState(false);
  useEffect(() => { document.body.style.cursor = hover ? "pointer" : ""; return () => { document.body.style.cursor = ""; }; }, [hover]);
  const click = (x: number, y: number) => (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSquare(x, y); };
  const kinds = squares.map(q => `${q.x},${q.y}:${q.kind ?? ""}`).join(" ");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only the square kinds matter, not the marks on them
  const arms = useMemo(() => wallArms(squares, w, h), [kinds, w, h]);
  return <>
    {pan ? <PanCamera pan={pan} view={view} ready={ready} fade={fade} done={() => setView(v => ({ ...v, from: null }))} /> : <PlayCamera data={data} w={w} h={h} />}
    <Blender>
      {pan ? [view.to, view.from].filter((k): k is number => k !== null).map(k =>
        <Suspense key={k} fallback={null}>
          <SetMesh data={pan.datas[k]} w={w} h={h} back={k === view.to && view.from !== null} fade={k === view.from ? fade : undefined} onReady={() => ready.current.add(k)} />
        </Suspense>) : <SetMesh data={data} w={w} h={h} />}
      <Lights data={data} w={w} h={h} />
      {squares.map(sq => {
        const [x, y] = at(sq.x, sq.y);
        return <group key={`${sq.x},${sq.y}`} position={[x, y, 0]}>
          <SquareMarks sq={sq} S={S} H={H} pos={[x, y]} arms={arms.get(`${sq.x},${sq.y}`)} gateTurn={sq.kind === "gate" || sq.kind === "gate-open" ? turnOfGate(squares, sq.x, sq.y) : undefined} gate={gateOf(sq, [x, y])} lever={leverOf(sq, [x, y])} trap={trapOf(sq, [x, y])} snare={snareOf(sq, [x, y])} />
          <mesh position={[0, 0, 0.04]} onClick={click(sq.x, sq.y)} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} name={sq.label}>
            <planeGeometry args={[S, S]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        </group>;
      })}
      {pieces.map(pc => {
        const [x, y] = at(pc.x, pc.y);
        const isKing = pc.kind === "king" && pc.side === "white";
        const figure = spriteFigure(pc);
        if (figure && !isKing && pc.falling !== undefined) return <group key={pc.id} position={[x, y, 0]}><TakenFigure pc={pc} figure={figure} at={[x, y]} S={S} onClick={() => onSquare(pc.x, pc.y)} /></group>;
        if (figure && runsAsSprite(pc)) return <group key={pc.id} position={[x, y, 0]}><RunningKing pc={pc} figure={figure} at={[x, y]} S={S} onClick={() => onSquare(pc.x, pc.y)} /></group>;
        return <group key={pc.id} position={[x, y, 0]}>
          {pc.falling === undefined && <Blob x={0} y={0} r={0.2 * S} o={isKing && KING_LIVE ? 0.45 : 0.35} />}
          {isKing ? <King position={[0, 0, 0]} yaw={yawOf(pc.facing ?? null)} onClick={() => onSquare(pc.x, pc.y)} />
            : pc.sprite && pc.falling !== undefined ? <Falling at={[x, y]} away={pc.falling}><Card pc={pc as DioramaPiece & { sprite: NonNullable<DioramaPiece["sprite"]> }} S={S} onClick={() => onSquare(pc.x, pc.y)} /></Falling>
            : pc.sprite ? <Card pc={pc as DioramaPiece & { sprite: NonNullable<DioramaPiece["sprite"]> }} S={S} onClick={() => onSquare(pc.x, pc.y)} /> : null}
        </group>;
      })}
    </Blender>
    <Post />
  </>;
}

function Loaded({ n, layout, ...rest }: { n: number; layout?: Layout; w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; fps?: (n: number) => void }) {
  // a level with its own bake (levelBake.ts) shows that; any other the 3/5/8 set cut to size
  const baked = layout ? bakeFor(use(loadBakeIndex(BASE)), layout) : null;
  if (baked?.bake.stops?.length) {
    const datas = use(loadStops(baked.key, baked.bake.stops.length));
    return <PanScene baked={baked as { key: string; bake: LevelBake & { stops: [number, number][] } }} datas={datas} {...rest} />;
  }
  const data = use(baked ? loadSetAt(`${BASE}${bakeDir(baked.key)}set`) : loadSet(n, BASE));
  return <Scene data={data} bakeKey={baked?.key} {...rest} />;
}

const stopsP = new Map<string, Promise<SetData[]>>();
/** Every stop's json and depth grid (small; their pictures load as the camera gets to them). */
function loadStops(key: string, n: number) {
  let p = stopsP.get(key);
  if (!p) stopsP.set(key, p = Promise.all(Array.from({ length: n }, (_, k) => loadSetAt(`${BASE}${stopSet(key, k)}`))));
  return p;
}

function PanScene({ baked, datas, ...rest }: { baked: { key: string; bake: LevelBake & { stops: [number, number][] } }; datas: SetData[]; w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; fps?: (n: number) => void }) {
  const pan = useMemo(() => ({ stops: baked.bake.stops, datas, bake: baked.bake }), [baked, datas]);
  return <Scene data={datas[0]} bakeKey={baked.key} pan={pan} {...rest} />;
}

/** The diorama for a `w` x `h` board (2-24 a side; past 8 only a level bake draws it). Squares are puzzle coordinates: x left to right,
 * y = 0 the back row. Clicking a square or a piece calls onSquare. `layout` (levelBake.layoutOfPuzzle) picks
 * the level's own bake when there is one. */
export function Diorama({ w, h, squares, pieces, onSquare, showFps, layout }: { w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; showFps?: boolean; layout?: Layout }) {
  const [fps, setFps] = useState(0);
  const n = sourceFor(w, h);
  const [index, setIndex] = useState<BakeIndex | null>(null);
  const big = Math.max(w, h) > PREVIEW_MAX;
  useEffect(() => { if (big) loadBakeIndex(BASE).then(setIndex); }, [big]);
  if (big && needsBake(index, layout ?? { w, h, cells: [] }) !== false)
    return <div className="diorama diorama-unbaked">{index ? `This level is ${w}×${h}, past the 8-a-side preview. Bake it (tools/art/diorama/bake_level.py) to see it in 3D.` : null}</div>;
  return <div className="diorama">
    <Canvas flat shadows={{ type: THREE.VSMShadowMap }} dpr={[1, 2]} camera={{ fov: 30, position: [0, 10, 30] }} gl={{ antialias: false, stencil: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene, camera }) => {
        if (import.meta.env.DEV) (window as unknown as { __dio: unknown }).__dio = { gl, scene, camera }; gl.setClearColor(new THREE.Color(0.0008, 0.0012, 0.0024), 1); scene.background = new THREE.Color(0.0008, 0.0012, 0.0024); }}>
      <Suspense fallback={null}>
        <Loaded n={n} layout={layout} w={w} h={h} squares={squares} pieces={pieces} onSquare={onSquare} fps={showFps ? setFps : undefined} />
      </Suspense>
    </Canvas>
    {showFps && <span className="diorama-fps">{fps.toFixed(0)} fps</span>}
  </div>;
}
