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
import { cutSet, loadSet, playCamera, slide, sourceFor } from "./set";
import type { SetData } from "./set";

const BASE = "diorama/";
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
    const c = new EffectComposer(gl, { frameBufferType: THREE.HalfFloatType, multisampling: Math.min(4, gl.capabilities.maxSamples) });
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
/** A soft dark blob under a piece (the baked floor can't take live shadows). */
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
export type DioramaPiece = { id: string; kind: string; side: "white" | "black"; x: number; y: number; sprite?: { href: string; x: number; y: number; w: number; h: number }; asleep?: boolean; statue?: boolean; picked?: boolean };

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
      out.push(<mesh key="w" position={[0, 0, 0.3 * H]}><boxGeometry args={[0.94 * S, 0.94 * S, 0.6 * H]} />{stone}</mesh>);
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
  const k = 0.85 * S / 100, b = pc.sprite, w = b.w * k, h = b.h * k, mirror = pc.side === "black";
  const tint = pc.statue ? new THREE.Color(0.32, 0.32, 0.32) : pc.asleep ? new THREE.Color(0.28, 0.3, 0.42) : new THREE.Color(0.5, 0.47, 0.43);
  return <group position={[0, 0, 0]} onClick={e => { e.stopPropagation(); onClick(); }}>
    <mesh position={[(b.x + b.w / 2 - 50) * k * (mirror ? -1 : 1), 0, (108 - b.y - b.h / 2) * k]} rotation={[Math.PI / 2, 0, 0]} scale={[mirror ? -1 : 1, 1, 1]}>
      <planeGeometry args={[w, h]} />
      <meshBasicMaterial map={tex} color={tint} alphaTest={0.5} side={THREE.DoubleSide} />
    </mesh>
  </group>;
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
        return <group key={pc.id} position={[x, y, 0]}>
          <Blob x={0} y={0} r={0.36 * S} o={isKing ? 0.4 : 0.32} />
          {isKing ? <King position={[0, 0, 0]} onClick={() => onSquare(pc.x, pc.y)} />
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
    <Canvas flat dpr={[1, 2]} camera={{ fov: 30, position: [0, 10, 30] }} gl={{ antialias: false, powerPreference: "high-performance" }}
      onCreated={({ gl, scene, camera }) => {
        if (import.meta.env.DEV) (window as unknown as { __dio: unknown }).__dio = { gl, scene, camera }; gl.setClearColor(new THREE.Color(0.0008, 0.0012, 0.0024), 1); scene.background = new THREE.Color(0.0008, 0.0012, 0.0024); }}>
      <Suspense fallback={null}>
        <Loaded n={n} w={w} h={h} squares={squares} pieces={pieces} onSquare={onSquare} fps={showFps ? setFps : undefined} />
      </Suspense>
    </Canvas>
    {showFps && <span className="diorama-fps">{fps.toFixed(0)} fps</span>}
  </div>;
}
