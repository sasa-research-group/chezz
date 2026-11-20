// The 3D diorama board: the baked Cycles set (set.ts) with live pieces on it, graded like the stage
// renders (bloom, the compositor grade, Standard view, the concept LUT). Shared: the studio's Puzzles tab
// uses it now; the game can mount the same <Diorama> with its own squares and pieces later.
import { Suspense, use, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { BloomEffect, Effect, EffectComposer, EffectPass, LUT3DEffect, LUTCubeLoader, RenderPass } from "postprocessing";
import { GradeEffect } from "./grade";
import { King } from "./King";
import { CARD_STENCIL, KingSprite } from "./KingSprite";
import { yawOf } from "./facing";
import { hitTime } from "./motion";
import type { Facing } from "./facing";
import { cutSet, loadSet, playCamera, slide, sourceFor } from "./set";
import type { SetData } from "./set";

const BASE = "diorama/";
/** `?king=live` swaps the pre-rendered Cycles king for the live glTF one, to compare. */
const KING_LIVE = /[?&]king=live\b/.test(location.search);
/** Blender's axes (z up) to three's (y up): every child of <Blender> is placed in stage units. */
const Blender = ({ children }: { children: ReactNode }) => <group rotation={[-Math.PI / 2, 0, 0]}>{children}</group>;
const toThree = (v: THREE.Vector3) => new THREE.Vector3(v.x, v.z, -v.y);

const setVert = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const setFrag = /* glsl */ `
uniform sampler2D map; uniform sampler2D glow; uniform float invExpo; uniform float glowK; varying vec2 vUv;
void main(){
  vec4 c = texture2D(map, vUv);
  if (c.a < 0.5) discard;
  vec3 g = texture2D(glow, vUv).rgb;
  gl_FragColor = vec4(c.rgb * invExpo + g * g * glowK, 1.0);
}`;

/** The baked set, cut and slid for this board. */
function SetMesh({ data, w, h }: { data: SetData; w: number; h: number }) {
  const n = data.info.n;
  const [map, glow] = useLoader(THREE.TextureLoader, [`${BASE}set${n}.webp`, `${BASE}set${n}-glow.png`]);
  const gl = useThree(s => s.gl);
  const material = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = gl.capabilities.getMaxAnisotropy(); map.needsUpdate = true;
    glow.colorSpace = THREE.NoColorSpace;
    return new THREE.ShaderMaterial({
      vertexShader: setVert, fragmentShader: setFrag,
      uniforms: { map: { value: map }, glow: { value: glow }, invExpo: { value: Math.pow(2, -data.info.exposure) }, glowK: { value: data.info.glowK } },
    });
  }, [map, glow, gl, data]);
  const pieces = useMemo(() => cutSet(data, w, h), [data, w, h]);
  useEffect(() => () => pieces.forEach(p => p.geometry.dispose()), [pieces]);
  return <>{pieces.map((p, i) => <mesh key={i} geometry={p.geometry} material={material} position={[p.shift[0], p.shift[1], 0]} frustumCulled={false} />)}</>;
}

/** Live lights for the pieces, placed like the stage's (stage.py, units of the king's height H). Cycles watts
 * become candela: a point or spot of P W is P/4pi, an area light P/pi along its axis. */
function Lights({ data, w, h }: { data: SetData; w: number; h: number }) {
  const H = data.info.H;
  const spot = (ref: THREE.SpotLight | null, dir: [number, number, number]) => {
    if (!ref) return;
    ref.target.position.copy(ref.position).add(new THREE.Vector3(...dir));
    ref.target.updateMatrixWorld();
  };
  const bulbs = data.info.bulbs.map(b => slide(data.info, w, h, b)).filter(Boolean) as [number, number, number][];
  return <>
    <hemisphereLight args={[new THREE.Color(0.10, 0.13, 0.2), new THREE.Color(0.05, 0.05, 0.035), 0.35]} />
    <pointLight position={[-1.08 * H, -5.98 * H, 2.6 * H]} intensity={4046 / (4 * Math.PI)} color={new THREE.Color(0.9, 0.88, 0.82)} decay={2} />
    <spotLight ref={r => spot(r, [0.13, 0.63, -0.77])} position={[-0.96 * H, -6.34 * H, 7.2 * H]} intensity={1734 / Math.PI} angle={1.2} penumbra={1} color={new THREE.Color(0.55, 0.7, 1.0)} decay={2} />
    <spotLight ref={r => spot(r, [0, 0.53, -0.85])} position={[0.24 * H, -4.06 * H, 5.5 * H]} intensity={2601 / (4 * Math.PI)} angle={0.4} penumbra={0.6} color={new THREE.Color(0.6, 0.75, 1.0)} decay={2} />
    <spotLight ref={r => spot(r, [0, 0.82, -0.58])} position={[0, -6.34 * H, 4.5 * H]} intensity={3757 / (4 * Math.PI)} angle={0.96} penumbra={0.8} color={new THREE.Color(1.0, 0.7, 0.42)} decay={2} />
    <spotLight ref={r => spot(r, [-0.1, -0.56, -0.82])} position={[-1.2 * H, Math.min(1.92 * H, h * data.info.S / 2), 3.4 * H]} intensity={101 / Math.PI} angle={1.3} penumbra={1} color={new THREE.Color(0.4, 0.58, 1.0)} decay={2} />
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
    const v = playCamera(data.info, w, h, aspect);
    cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(v.hfov / 2) / aspect));
    cam.near = 0.5; cam.far = 400;
    cam.position.copy(toThree(v.pos));
    cam.up.set(0, 1, 0);
    cam.lookAt(toThree(v.target));
    cam.updateProjectionMatrix();
  }, [camera, size, data, w, h]);
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
  label: string;
};
export type DioramaPiece = { id: string; kind: string; side: "white" | "black"; x: number; y: number;
  /** The way its last move went (facing.ts); null or missing: toward the camera. */ facing?: Facing; sprite?: { href: string; x: number; y: number; w: number; h: number }; asleep?: boolean; statue?: boolean; picked?: boolean;
  /** Your king is taking a piece with this move: he plays his sword strike. */ strike?: boolean;
  /** A piece just taken: it stays up until the king's blow lands, then falls away from him (his move's way). */ falling?: Facing };

/** Flat tints and blocks for squares that are not plain floor yet (no 3D art for them so far). */
function SquareMarks({ sq, S, H }: { sq: DioramaSquare; S: number; H: number }) {
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
  const stone = <meshStandardMaterial color={new THREE.Color(0.16, 0.16, 0.15)} roughness={0.95} />;
  const out: ReactNode[] = [];
  switch (sq.kind) {
    case "hole": case "fallen": out.push(plane(0.97, new THREE.Color(0.002, 0.002, 0.003), 1, 0, "hole")); break;
    case "wall": case "eye":
      out.push(<mesh key="w" castShadow position={[0, 0, 0.3 * H]}><boxGeometry args={[0.94 * S, 0.94 * S, 0.6 * H]} />{stone}</mesh>);
      if (sq.kind === "eye") out.push(<mesh key="e" position={[0, -0.47 * S, 0.34 * H]}><sphereGeometry args={[0.14 * S, 20, 12]} /><meshBasicMaterial color={new THREE.Color(2.2, 0.25, 0.15)} /></mesh>);
      break;
    case "sludge": out.push(plane(0.96, new THREE.Color(0.12, 0.35, 0.05), 0.82, 0.2, "sl")); break;
    case "trapdoor": out.push(plane(0.8, new THREE.Color(0.11, 0.06, 0.03), 1, 0, "td"), ring(0.38, 0.42, new THREE.Color(0.25, 0.16, 0.08), 1, "tr")); break;
    case "snare": out.push(ring(0.24, 0.3, new THREE.Color(0.45, 0.28, 0.12), 1, "sn")); break;
    case "gate": for (let i = -2; i <= 2; i++) out.push(<mesh key={`b${i}`} position={[i * 0.19 * S, 0, 0.4 * H]}><boxGeometry args={[0.05 * S, 0.05 * S, 0.8 * H]} /><meshStandardMaterial color={new THREE.Color(0.3, 0.3, 0.32)} metalness={0.6} roughness={0.5} /></mesh>); break;
    case "gate-open": for (const s of [-1, 1]) out.push(<mesh key={`p${s}`} position={[s * 0.44 * S, 0, 0.4 * H]}><boxGeometry args={[0.06 * S, 0.06 * S, 0.8 * H]} /><meshStandardMaterial color={new THREE.Color(0.3, 0.3, 0.32)} metalness={0.6} roughness={0.5} /></mesh>); break;
    case "lever": out.push(
      <mesh key="lb" position={[0, 0, 0.04 * H]}><boxGeometry args={[0.3 * S, 0.18 * S, 0.08 * H]} /><meshStandardMaterial color={new THREE.Color(0.25, 0.2, 0.15)} /></mesh>,
      <mesh key="ls" position={[0.05 * S, 0, 0.25 * H]} rotation={[0, 0.5, 0]}><cylinderGeometry args={[0.02 * S, 0.02 * S, 0.45 * H]} /><meshStandardMaterial color={new THREE.Color(0.55, 0.4, 0.2)} /></mesh>); break;
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

const TIP = 0.3, SINK = 0.35;  // seconds: a taken piece tips over, then sinks through the floor
const NO_HIT = 4000;  // ms: a taken piece falls anyway if no blow is announced (the live 3D king, no strike sheet)
/** A taken piece: stands until the king's blow lands on its square (motion.ts), then tips over away from him
 * and sinks out of sight. */
function Falling({ at, away, children }: { at: [number, number]; away: Facing; children: ReactNode }) {
  const g = useRef<THREE.Group>(null), born = useMemo(() => performance.now(), []);
  // tip about the floor line across his blow: the axis is the blow's direction turned a quarter
  const axis = useMemo(() => { const [x, y] = away ?? [0, 1], l = Math.hypot(x, y) || 1; return new THREE.Vector3(-y / l, x / l, 0); }, [away]);
  useFrame(() => {
    const o = g.current;
    if (!o) return;
    const now = performance.now(), hit = hitTime(at[0], at[1], born - 50) ?? (now - born > NO_HIT ? born + NO_HIT : null);
    const t = hit === null ? -1 : (now - hit) / 1000;
    o.quaternion.setFromAxisAngle(axis, Math.PI / 2 * Math.min(1, Math.max(0, t / TIP)) ** 2);
    o.position.z = -Math.max(0, t - TIP) / SINK * 1.2;
    o.visible = t < TIP + SINK;
  });
  return <group ref={g}>{children}</group>;
}

/** The pre-rendered king: he runs from square to square (KingSprite), his blob and shadow go with him. */
function RunningKing({ pc, at, S, onClick }: { pc: DioramaPiece; at: [number, number]; S: number; onClick: () => void }) {
  const follow = useRef<THREE.Group>(null);
  const yaw = yawOf(pc.facing ?? null);
  return <>
    <KingSprite at={at} yaw={yaw} onClick={onClick} follow={follow} strike={pc.strike} />
    <group ref={follow}>
      <Blob x={0} y={0} r={0.2 * S} o={0.35} />
      <King position={[0, 0, 0]} yaw={yaw} shadowOnly />
    </group>
  </>;
}

function Scene({ data, w, h, squares, pieces, onSquare, fps }: { data: SetData; w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; fps?: (n: number) => void }) {
  const { S, H } = data.info;
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
  return <>
    <PlayCamera data={data} w={w} h={h} />
    <Blender>
      <SetMesh data={data} w={w} h={h} />
      <Lights data={data} w={w} h={h} />
      {squares.map(sq => {
        const [x, y] = at(sq.x, sq.y);
        return <group key={`${sq.x},${sq.y}`} position={[x, y, 0]}>
          <SquareMarks sq={sq} S={S} H={H} />
          <mesh position={[0, 0, 0.04]} onClick={click(sq.x, sq.y)} onPointerOver={() => setHover(true)} onPointerOut={() => setHover(false)} name={sq.label}>
            <planeGeometry args={[S, S]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
          </mesh>
        </group>;
      })}
      {pieces.map(pc => {
        const [x, y] = at(pc.x, pc.y);
        const isKing = pc.kind === "king" && pc.side === "white";
        if (isKing && !KING_LIVE) return <group key={pc.id} position={[x, y, 0]}><RunningKing pc={pc} at={[x, y]} S={S} onClick={() => onSquare(pc.x, pc.y)} /></group>;
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

function Loaded({ n, ...rest }: { n: number; w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; fps?: (n: number) => void }) {
  const data = use(loadSet(n, BASE));
  return <Scene data={data} {...rest} />;
}

/** The diorama for a `w` x `h` board (2-8 a side). Squares are puzzle coordinates: x left to right,
 * y = 0 the back row. Clicking a square or a piece calls onSquare. */
export function Diorama({ w, h, squares, pieces, onSquare, showFps }: { w: number; h: number; squares: DioramaSquare[]; pieces: DioramaPiece[]; onSquare: (x: number, y: number) => void; showFps?: boolean }) {
  const [fps, setFps] = useState(0);
  const n = sourceFor(w, h);
  return <div className="diorama">
    <Canvas flat shadows={{ type: THREE.VSMShadowMap }} dpr={[1, 2]} camera={{ fov: 30, position: [0, 10, 30] }} gl={{ antialias: false, stencil: true, powerPreference: "high-performance" }}
      onCreated={({ gl, scene, camera }) => {
        if (import.meta.env.DEV) (window as unknown as { __dio: unknown }).__dio = { gl, scene, camera }; gl.setClearColor(new THREE.Color(0.0008, 0.0012, 0.0024), 1); scene.background = new THREE.Color(0.0008, 0.0012, 0.0024); }}>
      <Suspense fallback={null}>
        <Loaded n={n} w={w} h={h} squares={squares} pieces={pieces} onSquare={onSquare} fps={showFps ? setFps : undefined} />
      </Suspense>
    </Canvas>
    {showFps && <span className="diorama-fps">{fps.toFixed(0)} fps</span>}
  </div>;
}
