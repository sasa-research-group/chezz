// A figure as Cycles drew him (the white king; the patrol guard uses the same machinery, `figure="guard"`): king A pre-rendered at 8 headings on the 5x5 centre square with the
// locked play camera (tools/art/diorama/bake_king_sprites.py, packed by king_atlas.py), felt fibres, the
// KING_RIM halo and the crown glow included. Drawn on a quad parallel to the image plane, a little in front
// of his nearest point, so the set and the other pieces still sort against him; on any square the quad is
// slid and scaled so his feet land on the square and he keeps the size he has there.
// `figure` is the file prefix (default "king"): <figure>8.json/.webp/-glow.png, <figure>-walk.json, <figure>-strike* ...;
// the sheet and texture caches are keyed by it, so each figure loads (and suspends) on its own.
// A move is a turn to face the new square, a steady walk there (sword held in the guard) on the gait loop sheets
// (king-walk*.webp, loaded after he first stands; a heading without a sheet slides his still frame), and a stop
// into the still idle. He moves at the loop's own ground speed (cycle x cps), with the frame taken from the
// distance covered, so his feet stay planted: the gait sets the move's length, not the other way round.
// A capture (`strike`) walks to a stand-off point short of the enemy and plays the jump attack (king-strike*.webp,
// strike.ts): the leap lands him GAP of a square short of the enemy, the blow falls on the hit frame (motion.ts
// willHit), he holds there while it dies ("hold"), and steps onto the square once it sinks away (willClear).
// Without a strike sheet he walks to the same spot, the blow lands as he arrives, and he holds the same way.
// Standing in check (`check`), he plays the nervous loop on the spot (king-check*.webp, check.ts) instead of
// his still frame.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { breath } from "./King";
import { clearTime, gameSpeed, moving, standing, willHit } from "./motion";
import { GAP, HOLD_MAX, strikeFrame, strikePlan, strikeTravel } from "./strike";
import type { StrikeInfo } from "./strike";
import { loopFrame, showsCheck } from "./check";
import type { LoopInfo } from "./check";
import { deathFrame, showsDeath } from "./death";

// dev: `?kingsheet=name` loads a trial sheet from diorama/_t/name/ instead
export const BASE = import.meta.env.DEV && /kingsheet=([\w-]+)/.test(location.search) ? `diorama/_t/${RegExp.$1}/` : "diorama/";
export type KingSheet = {
  quad: { x0: number; x1: number; y0: number; y1: number };
  right: number[]; up: number[]; fwd: number[]; d0: number; dq: number;
  exposure: number; glowK: number; headings: number; tiles: [number, number]; S: number;
};
const stills = new Map<string, { p: Promise<KingSheet>; sheet: KingSheet | null }>();
/** Suspends until <figure>8.json is in. */
function useSheet(figure: string): KingSheet {
  let e = stills.get(figure);
  if (!e) {
    const en: { p: Promise<KingSheet>; sheet: KingSheet | null } = { p: fetch(`${BASE}${figure}8.json`).then(r => r.json() as Promise<KingSheet>), sheet: null };
    en.p.then(s => { en.sheet = s; }, () => {});
    stills.set(figure, e = en);
  }
  if (!e.sheet) throw e.p;
  return e.sheet;
}
/** A gait loop: `frames` per heading on a tiles[0] x tiles[1] sheet each, for the headings in `have`; one loop
 * covers `cycle` stage units with the feet planted, and plays `cps` times a second. */
type RunSheet = KingSheet & { frames: number; cps: number; cycle: number; have: number[] };
// `?kingcps=1.8` changes the cadence (loops a second)
const Q = new URLSearchParams(location.search);
const GAIT = "walk";
const CPS = +(Q.get("kingcps") ?? 0) || 0;
/** The jump attack: `frames` per heading at `fps`, the blow on frame `hit`, the leap `travel` stage units long. */
type StrikeSheet = KingSheet & StrikeInfo & { have: number[] };
/** The nervous loop in check: `frames` per heading at `fps`, played round and round. */
type CheckSheet = KingSheet & LoopInfo & { have: number[] };
const sheets = new Map<string, Promise<unknown>>();
const sheetOf = <T,>(figure: string, name: string) => {
  const key = `${figure}-${name}`;
  return (sheets.get(key) ?? sheets.set(key, fetch(`${BASE}${key}.json`)
    .then(r => (r.ok ? r.json() : null)).catch(() => null)).get(key)!) as Promise<T | null>;
};
const runSheet = (figure: string) => sheetOf<RunSheet>(figure, GAIT).then(r => (r && CPS ? { ...r, cps: CPS } : r));
const tex = new Map<string, Promise<[THREE.Texture, THREE.Texture]>>();
const loadSheet = (figure: string, name: string, k: number) => {
  const key = `${figure}-${name}${k}`;
  if (!tex.has(key)) {
    const L = new THREE.TextureLoader();
    tex.set(key, Promise.all([L.loadAsync(`${BASE}${key}.webp`), L.loadAsync(`${BASE}${key}-glow.webp`)]).then(([m, g]) => {
      m.colorSpace = THREE.SRGBColorSpace; m.generateMipmaps = true; g.colorSpace = THREE.NoColorSpace;
      return [m, g] as [THREE.Texture, THREE.Texture];
    }));
  }
  return tex.get(key)!;
};

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
const STEP = 0.2;  // a turn on the spot walks through the headings in between over this long
const TURN = 0.15;  // before a move: the turn to face the new square
const RAMP = 0.15;  // seconds to reach (and leave) his steady pace
const PACE = 1.4;  // stage units a second when no gait sheet is in (his still frame slides at about the walk's pace)
// dev: `?kingslow=4` plays his moves 4x slower, to look at the run
const SLOW = import.meta.env.DEV ? +(new URLSearchParams(location.search).get("kingslow") ?? 1) || 1 : 1;
const tileOf = (yaw: number, n: number) => ((Math.round(yaw / (2 * Math.PI / n)) % n) + n) % n;

/** The quad, its two materials (over the set, and at true depth over cards) for one sheet. */
export function sheetMeshes(s: KingSheet, map: THREE.Texture | null, glow: THREE.Texture | null) {
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
  return { geometry: g, material: m, onCards: mc };
}

/** `figure`: the file prefix ("king", "guard"). `at`: his square's centre in stage units (Blender axes); `yaw` as for <King>. Clicks where he is opaque.
 * When `at` changes he turns, runs there and stops; `follow` (his blob and shadow, placed at `at`) is moved
 * along with him. */
/** `dieAt`: a taken figure: when (performance.now() time) the blow lands, or null while none is announced; its death
 * plays from then. `deathLen`: gets the death's length in seconds while the sheet for the heading he faces is in, else
 * null, so whoever takes him off the board knows whether it plays (Diorama's Falling). */
export function KingSprite({ figure = "king", at, yaw = 0, onClick, follow, strike = false, check = false, dead = false, dieAt, deathLen }: { figure?: string; at: [number, number]; yaw?: number; onClick?: () => void; follow?: RefObject<THREE.Group | null>; strike?: boolean; check?: boolean; dead?: boolean; dieAt?: () => number | null; deathLen?: RefObject<number | null> }) {
  const s = useSheet(figure);
  const [map, glow] = useLoader(THREE.TextureLoader, [`${BASE}${figure}8.webp`, `${BASE}${figure}8-glow.png`]);
  const mesh = useRef<THREE.Group>(null), runMesh = useRef<THREE.Group>(null), hitMesh = useRef<THREE.Group>(null), chkMesh = useRef<THREE.Group>(null), dthMesh = useRef<THREE.Group>(null);
  const { geometry, material, onCards, basis, alpha } = useMemo(() => {
    map.colorSpace = THREE.SRGBColorSpace; map.generateMipmaps = true; map.needsUpdate = true;
    glow.colorSpace = THREE.NoColorSpace;
    const v = (a: number[]) => new THREE.Vector3(a[0], a[1], a[2]);
    const b = new THREE.Matrix4().makeBasis(v(s.right), v(s.up), v(s.fwd).negate());
    // His alpha, for clicks: only where he is drawn, so the square behind his head stays clickable.
    const img = map.image as HTMLImageElement, c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const cx = c.getContext("2d", { willReadFrequently: true })!; cx.drawImage(img, 0, 0);
    return { ...sheetMeshes(s, map, glow), basis: new THREE.Quaternion().setFromRotationMatrix(b), alpha: { d: cx.getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height } };
  }, [map, glow, s]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); onCards.dispose(); }, [geometry, material, onCards]);

  // The run sheets come in after he first stands, one per heading baked so far; then the strike sheets, then check.
  const run = useRef<Loaded<RunSheet> | null>(null), hit = useRef<Loaded<StrikeSheet> | null>(null), chk = useRef<Loaded<CheckSheet> | null>(null), dth = useRef<Loaded<CheckSheet> | null>(null);
  const [, ping] = useStateTick();
  // a taken figure (just mounted for its death) loads its sheets at once: the death may be due right away
  const taken = !!dieAt;
  useEffect(() => {
    let live = true;
    const into = <T extends KingSheet & { have: number[] },>(ref: { current: Loaded<T> | null }, name: string, sh: T | null) => {
      if (!sh || !live) return;
      ref.current = { s: sh, meshes: sheetMeshes(sh, null, null), tex: new Map() };
      ping();
      return Promise.all(sh.have.map(k => loadSheet(figure, name, k).then(tx => { if (live && ref.current) ref.current.tex.set(k, tx); }, () => {})));
    };
    const t = setTimeout(() => runSheet(figure).then(rs => into(run, GAIT, rs)).then(() => sheetOf<StrikeSheet>(figure, "strike")).then(ss => into(hit, "strike", ss))
      .then(() => sheetOf<CheckSheet>(figure, "check")).then(cs => into(chk, "check", cs))
      .then(() => sheetOf<CheckSheet>(figure, "death")).then(ds => into(dth, "death", ds)), taken ? 0 : 800);
    return () => {
      live = false; clearTimeout(t);
      for (const ref of [run, hit, chk, dth] as { current: Loaded<KingSheet> | null }[]) {
        const r = ref.current; if (r) { r.meshes.geometry.dispose(); r.meshes.material.dispose(); r.meshes.onCards.dispose(); } ref.current = null;
      }
    };
  }, [ping, figure, taken]);

  // The heading on show steps one tile at a time toward the target, the whole turn in about STEP seconds.
  const n = s.headings;
  const turn = useRef({ shown: tileOf(yaw, n), wait: 0, dt: 0, to: tileOf(yaw, n) });
  // When he went into check (clock seconds, game speed applied), so the loop starts on its first frame.
  const nerve = useRef({ t: 0, on: false });
  // When he was mated, so the death plays once from its first frame; it stays on its last.
  const dying = useRef({ t: 0, on: false });
  // The move: from where he was to `at`; "turn" to face it, "run", then standing again.
  // A capture runs only to `stop` (short of `to` by the leap), then "strike" plays the attack there.
  // `cap`: this move takes a piece, so it ends in "hold" beside it until the square clears (from `born` on).
  const mv = useRef({ pos: [at[0], at[1]], from: [at[0], at[1]], to: [at[0], at[1]], stop: [at[0], at[1]], phase: "idle" as "idle" | "turn" | "run" | "strike" | "hold", t: 0, dur: 0, k: 0, f: 0, v: 1, D: 0, strike: false, cap: false, leap: 0, born: 0 });
  /** Where the leap sets him down: `leap` past the stand-off point, toward the enemy. */
  const landing = (M: typeof mv.current) => {
    const dx = M.to[0] - M.stop[0], dy = M.to[1] - M.stop[1], l = Math.hypot(dx, dy), e = l > 1e-6 ? Math.min(1, M.leap / l) : 0;
    return [M.stop[0] + dx * e, M.stop[1] + dy * e];
  };
  const cam = useMemo(() => new THREE.Vector3(), []), F = useMemo(() => new THREE.Vector3(), []), fwd = useMemo(() => new THREE.Vector3(...s.fwd), [s]);
  // Slide the quad along the ray to his feet so it keeps the bake's gap in front of them, and scale it so
  // he subtends what he would standing there (camera in Blender axes: three (x, y, z) is Blender (x, -z, y)).
  const place = (g: THREE.Group, sh: KingSheet, breathe: number) => {
    const p = mv.current.pos;
    F.set(p[0], p[1], 0);
    const dF = F.clone().sub(cam).dot(fwd), dq = dF - (sh.d0 - sh.dq);
    const P0 = cam.clone().addScaledVector(F.clone().sub(cam), dq / dF).sub(new THREE.Vector3(at[0], at[1], 0));
    const sc = dq * sh.d0 / (sh.dq * dF);
    g.position.copy(P0);
    g.quaternion.copy(basis);
    g.scale.set(sc, sc * breathe, sc);
  };
  useFrame(({ camera, clock }, dt) => {
    const M = mv.current, t = turn.current;
    dt = Math.min(dt, 0.1) * gameSpeed() / SLOW;
    if (M.to[0] !== at[0] || M.to[1] !== at[1]) {
      // A new square (or a take-back mid-run): run from wherever he is now.
      M.from = [...M.pos]; M.to = [at[0], at[1]];
      const dx = M.to[0] - M.from[0], dy = M.to[1] - M.from[1], d = Math.hypot(dx, dy) / s.S;
      if (d > 1e-3) {
        M.k = tileOf(Math.atan2(dx, -dy), n); M.v = run.current ? run.current.s.cycle * run.current.s.cps : PACE; M.t = 0; M.f = 0;
        // A capture plays the strike when its heading is in; otherwise he walks onto the square and the blow
        // lands as he arrives.
        const h = hit.current, st = strike && h?.tex.has(M.k) ? { ...h.s, travel: h.s.travel * s.S / h.s.S } : null;
        const gap = strike ? Math.min(GAP, d) * s.S : 0;
        const plan = st ? strikePlan(d * s.S, st, gap) : null;
        M.strike = !!plan; M.cap = strike; M.leap = st ? st.travel : 0; M.born = performance.now();
        M.D = plan ? plan.walk : d * s.S - gap;
        const e = M.D / (d * s.S);
        M.stop = [M.from[0] + dx * e, M.from[1] + dy * e];
        M.dur = M.D > 1e-3 ? M.D / M.v + RAMP : 0;
        M.phase = M.k === t.shown ? "run" : "turn";
        const go = (M.phase === "turn" ? TURN : 0) + M.dur, k = SLOW / gameSpeed();
        moving((go + (plan ? plan.length : 0)) * k);
        if (strike) willHit(M.to[0], M.to[1], (go + (plan ? plan.hitAt : 0)) * k);
      }
    }
    if (M.phase === "turn") {
      M.t += dt;
      if (M.t >= TURN) { M.phase = "run"; M.t = 0; t.shown = M.k; }
    } else if (M.phase === "run") {
      M.t += dt;
      // Steady pace, eased in and out over RAMP; the frame follows the ground covered, so no skating.
      const T = M.dur, tt = Math.min(M.t, T), R = Math.min(RAMP, T / 2);
      const x = tt < R ? M.v * tt * tt / (2 * R) : tt > T - R ? M.D - M.v * (T - tt) ** 2 / (2 * R) : M.v * (tt - R / 2);
      const e = M.D > 1e-3 ? Math.min(1, x / M.D) : 1;
      M.pos = [M.from[0] + (M.stop[0] - M.from[0]) * e, M.from[1] + (M.stop[1] - M.from[1]) * e];
      if (run.current) M.f = (x / run.current.s.cycle) * run.current.s.frames;
      if (M.t >= T) {
        M.pos = [...M.stop]; M.t = 0;
        M.phase = M.strike ? "strike" : M.cap ? "hold" : "idle";
        if (M.phase === "idle") M.pos = [...M.to];
      }
    } else if (M.phase === "strike") {
      // The attack is baked with him starting on the square's centre: the sprite stays at the stand-off point
      // while the leap inside the frames carries him onto the enemy's square.
      M.t += dt;
      const h = hit.current!.s;
      M.f = strikeFrame(M.t, h);
      if (M.t >= h.frames / h.fps) { M.phase = "hold"; M.pos = landing(M); M.t = 0; }
    } else if (M.phase === "hold") {
      // Beside the piece he took while it dies; once it sinks away (or after HOLD_MAX) he steps onto its square.
      M.t += dt;
      const c = clearTime(M.to[0], M.to[1], M.born);
      if ((c !== null && performance.now() >= c) || M.t >= HOLD_MAX) {
        M.from = [...M.pos]; M.stop = [...M.to];
        M.D = Math.hypot(M.to[0] - M.pos[0], M.to[1] - M.pos[1]);
        M.dur = M.D > 1e-3 ? M.D / M.v + RAMP : 0;
        M.t = 0; M.f = 0; M.strike = false; M.cap = false; M.phase = "run";
        moving(M.dur * SLOW / gameSpeed());
      }
    }
    const want = M.phase === "idle" ? tileOf(yaw, n) : M.k;
    if (t.to !== want) { t.to = want; t.dt = 0; t.wait = 0; }
    if (t.shown !== want) {
      const span = M.phase === "idle" ? STEP : TURN;
      const d = ((want - t.shown + n + n / 2) % n) - n / 2 || n / 2;
      if (t.dt === 0) t.dt = span / Math.abs(d);
      t.wait += dt;
      while (t.wait >= t.dt && t.shown !== want) {
        t.wait -= t.dt;
        const dd = ((want - t.shown + n + n / 2) % n) - n / 2 || n / 2;
        t.shown = (t.shown + Math.sign(dd) + n) % n;
      }
    } else { t.wait = 0; t.dt = 0; }
    cam.set(camera.position.x, -camera.position.z, camera.position.y);
    // Striking: his blob and shadow follow the leap from the stand-off point onto the square.
    const sh = M.phase === "strike" && hit.current ? hit.current : null, ht = sh?.tex.get(M.k);
    const lf = sh ? strikeTravel(M.f, sh.s) : 0;
    const land = sh ? landing(M) : M.pos;
    follow?.current?.position.set(M.pos[0] + (land[0] - M.pos[0]) * lf - at[0], M.pos[1] + (land[1] - M.pos[1]) * lf - at[1], 0);
    // Running on a heading with its sheet in: the run frames; striking: the strike frames; else his still frame.
    const r = run.current, rt = M.phase === "run" && r ? r.tex.get(M.k) : undefined;
    // Standing in check on a heading with its sheet in: the nervous loop, from its first frame.
    const c = chk.current, N = nerve.current;
    // Mated: the death, once, on the heading he faces; it wins over the nervous loop.
    const d = dth.current, D = dying.current;
    const hitAt = dieAt?.() ?? null, due = dead || (hitAt !== null && performance.now() >= hitAt);
    if (deathLen) deathLen.current = d && d.tex.has(t.shown) ? d.s.frames / d.s.fps : null;
    const dtex = d && showsDeath(due, M.phase === "idle", d.tex.has(t.shown)) ? d.tex.get(t.shown) : undefined;
    if (dtex && !D.on) D.t = 0;
    D.on = !!dtex;
    if (dtex) D.t += dt;
    const ct = !dtex && c && showsCheck(check, M.phase === "idle", t.shown !== want, c.tex.has(t.shown)) ? c.tex.get(t.shown) : undefined;
    if (ct && !N.on) N.t = 0;
    N.on = !!ct;
    if (ct) N.t += dt;
    const g = mesh.current, rg = runMesh.current, hg = hitMesh.current, cg = chkMesh.current, dg = dthMesh.current;
    if (g) g.visible = !rt && !ht && !ct && !dtex;
    if (rg) rg.visible = !!rt;
    if (hg) hg.visible = !!ht;
    if (cg) cg.visible = !!ct;
    if (dg) dg.visible = !!dtex;
    if (ht && sh && hg) {
      const u = sh.meshes.material.uniforms;
      if (u.map.value !== ht[0]) { u.map.value = ht[0]; u.glow.value = ht[1]; }
      const [tx, ty] = sh.s.tiles, i = M.f;
      (u.tile.value as THREE.Vector2).set(i % tx, ty - 1 - Math.floor(i / tx));
      place(hg, sh.s, 1);
    } else if (rt && r && rg) {
      const u = r.meshes.material.uniforms;
      if (u.map.value !== rt[0]) { u.map.value = rt[0]; u.glow.value = rt[1]; }
      const [tx, ty] = r.s.tiles, i = Math.floor(M.f) % r.s.frames;
      (u.tile.value as THREE.Vector2).set(i % tx, ty - 1 - Math.floor(i / tx));
      place(rg, r.s, 1);
    } else if (dtex && d && dg) {
      const u = d.meshes.material.uniforms;
      if (u.map.value !== dtex[0]) { u.map.value = dtex[0]; u.glow.value = dtex[1]; }
      const [tx, ty] = d.s.tiles, i = deathFrame(D.t, d.s);
      (u.tile.value as THREE.Vector2).set(i % tx, ty - 1 - Math.floor(i / tx));
      place(dg, d.s, 1);
    } else if (ct && c && cg) {
      const u = c.meshes.material.uniforms;
      if (u.map.value !== ct[0]) { u.map.value = ct[0]; u.glow.value = ct[1]; }
      const [tx, ty] = c.s.tiles, i = loopFrame(N.t, c.s);
      (u.tile.value as THREE.Vector2).set(i % tx, ty - 1 - Math.floor(i / tx));
      place(cg, c.s, 1);
    } else if (g) {
      const [tx, ty] = s.tiles, k = t.shown;
      (material.uniforms.tile.value as THREE.Vector2).set(k % tx, ty - 1 - Math.floor(k / tx));
      place(g, s, breath(clock.elapsedTime));
    }
    // Standing on his square (and not struck down there): a snare under him shuts and sorts its front roots over him.
    if (M.phase === "idle" && !(hitAt !== null && performance.now() >= hitAt)) {
      const st = dtex && d ? d.s : ct && c ? c.s : s;
      standing(at[0], at[1], st.d0 - st.dq);
    }
  });

  const raycast = useMemo(() => {
    const hits: THREE.Intersection[] = [];
    return function (this: THREE.Mesh, rc: THREE.Raycaster, out: THREE.Intersection[]) {
      if (mv.current.phase !== "idle") return;
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
  const rm = run.current?.meshes, hm = hit.current?.meshes, cm = chk.current?.meshes, dm = dth.current?.meshes;
  return <>
    <group ref={mesh}>
      <mesh geometry={geometry} material={material} renderOrder={10} frustumCulled={false} raycast={raycast}
        onClick={onClick ? e => { e.stopPropagation(); onClick(); } : undefined} />
      <mesh geometry={geometry} material={onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>
    {rm && <group ref={runMesh} visible={false}>
      <mesh geometry={rm.geometry} material={rm.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={rm.geometry} material={rm.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>}
    {hm && <group ref={hitMesh} visible={false}>
      <mesh geometry={hm.geometry} material={hm.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={hm.geometry} material={hm.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>}
    {dm && <group ref={dthMesh} visible={false}>
      <mesh geometry={dm.geometry} material={dm.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={dm.geometry} material={dm.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>}
    {cm && <group ref={chkMesh} visible={false}>
      <mesh geometry={cm.geometry} material={cm.material} renderOrder={10} frustumCulled={false} raycast={() => {}} />
      <mesh geometry={cm.geometry} material={cm.onCards} renderOrder={10} frustumCulled={false} raycast={() => {}} />
    </group>}
  </>;
}

/** A frame sheet that came in: its info, its quad meshes, and its textures per heading as they load. */
type Loaded<T extends KingSheet> = { s: T; meshes: ReturnType<typeof sheetMeshes>; tex: Map<number, [THREE.Texture, THREE.Texture]> };

/** A re-render on demand. */
function useStateTick(): [number, () => void] {
  const [n, set] = useState(0);
  return [n, useCallback(() => set(x => x + 1), [])];
}

export { KingSprite as FigureSprite };
