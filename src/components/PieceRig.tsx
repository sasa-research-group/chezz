import type { CSSProperties } from "react";

/** "Rebel puppets": chess tokens that grew faces and stubby arms. Each head is
 * its chess crest. Layered SVG groups (.hop > .squash > body/arms/prop/head)
 * are animated by CSS in src/rig.css. See docs/art-direction-exile.md. */
export type RigKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type RigSide = "white" | "black";
export type RigAction = "idle" | "move" | "attack" | "defend" | "hit" | "death";
export type PatrolHue = "blue" | "red";

const INK = "#382f2e";
const GOLD = "#e7ba58";
const PALETTE = {
  white: { body: "#e8c98a", shade: "#c9a467", trim: "#2f7d6d", trimShade: "#24625a" },
  blue: { body: "#4a68b0", shade: "#334d8a", trim: "#e2b45d", trimShade: "#c0913c" },
  red: { body: "#c86d62", shade: "#a5524a", trim: "#e2b45d", trimShade: "#c0913c" },
};

/** Body width and head centre per piece. */
const SHAPE: Record<RigKind, { w: number; headY: number }> = {
  king: { w: 1, headY: 50 }, queen: { w: 1, headY: 52 }, rook: { w: 1.18, headY: 52 },
  bishop: { w: 0.96, headY: 54 }, knight: { w: 1, headY: 48 }, pawn: { w: 0.84, headY: 58 },
};

function Body({ w, c, rebel }: { w: number; c: typeof PALETTE.white; rebel: boolean }) {
  const x = (d: number) => 50 + d * w;
  const bell = `M${x(-25)} 106 Q${x(-26)} 92 ${x(-15)} 84 Q${x(-10)} 80 ${x(-10)} 75 L${x(10)} 75 Q${x(10)} 80 ${x(15)} 84 Q${x(26)} 92 ${x(25)} 106 Z`;
  const shade = `M${x(-25)} 106 Q${x(-26)} 92 ${x(-15)} 84 Q${x(-12)} 95 ${x(-6)} 106 Z`;
  return <g className="body">
    <path d={bell} fill={c.body} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
    <path d={shade} fill={c.shade} />
    {rebel
      ? <><path d={`M${x(-24)} 104 L${x(-20)} 99 L${x(-16)} 104 L${x(-12)} 99 L${x(-8)} 104`} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <rect x={x(6)} y="88" width="9" height="9" rx="1.5" fill={c.trim} stroke={INK} strokeWidth="2" transform={`rotate(8 ${x(10)} 92)`} />
        <path d={`M${x(-13)} 84 L${x(14)} 96`} stroke={c.trim} strokeWidth="5" strokeLinecap="round" /></>
      : <><rect x="46" y="77" width="8" height="28" fill={c.trim} stroke={INK} strokeWidth="2" />
        <path d={`M${x(-24)} 104 Q${x(-19)} 99 ${x(-14)} 104 Q${x(-9)} 99 ${x(-4)} 104 M${x(4)} 104 Q${x(9)} 99 ${x(14)} 104 Q${x(19)} 99 ${x(24)} 104`} fill="none" stroke={INK} strokeWidth="2" /></>}
    <ellipse cx="50" cy="75" rx={12 * w} ry="4" fill={c.trim} stroke={INK} strokeWidth="3" />
  </g>;
}

function Face({ cx, cy, scale = 1, kind }: { cx: number; cy: number; scale?: number; kind: RigKind }) {
  const s = scale, dx = 7 * s;
  const brow = kind === "queen" ? "M-4 -2 L3 -1" : kind === "bishop" ? "M-4 0 Q0 -3 4 -1" : kind === "rook" ? "M-4 -1 L4 -1" : kind === "pawn" ? "M-4 1 Q0 -3 4 1" : "M-4 1 L4 -2";
  return <g className="face" transform={`translate(${cx} ${cy})`}>
    <g className="eyes">
      {[-dx, dx].map((ex, i) => <g key={i} transform={`translate(${ex} 0)`}>
        <ellipse rx={2.7 * s} ry={4.2 * s} fill={INK} /><circle cx={0.9 * s} cy={-1.6 * s} r={0.9 * s} fill="#fff8e6" />
      </g>)}
    </g>
    <g className="brows" stroke={INK} strokeWidth="2" strokeLinecap="round" fill="none">
      <path d={brow} transform={`translate(${-dx} ${-7 * s})`} /><path d={brow} transform={`translate(${dx} ${-7 * s}) scale(-1 1)`} />
    </g>
    <g className="ko-eyes" stroke={INK} strokeWidth="2.2" strokeLinecap="round">
      {[-dx, dx].map((ex, i) => <path key={i} d={`M${ex - 3} -3 L${ex + 3} 3 M${ex + 3} -3 L${ex - 3} 3`} />)}
    </g>
    <path className="mouth" d={kind === "pawn" ? `M-3 ${7 * s} Q0 ${4 * s} 3 ${7 * s}` : kind === "queen" ? `M-4 ${7 * s} L4 ${6 * s}` : `M-4 ${6 * s} Q0 ${9 * s} 4 ${6 * s}`} stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
  </g>;
}

function Head({ kind, c, rebel }: { kind: RigKind; c: typeof PALETTE.white; rebel: boolean }) {
  const ink = { stroke: INK, strokeWidth: 4, strokeLinejoin: "round" as const };
  const fine = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const };
  // Rebels wear their crest at a slant; the patrol stands rigidly upright.
  const tilt = rebel ? -7 : 0;
  const plume = !rebel && <path d="M52 24 Q60 10 70 14 Q60 16 56 26 Z" fill="#c8504a" {...fine} />;
  let shape;
  switch (kind) {
    case "king": shape = <>
      <path d="M31 70 Q28 44 36 36 L64 36 Q72 44 69 70 Q50 78 31 70 Z" fill={c.body} {...ink} />
      <path d="M31 70 Q28 44 36 36 L42 36 Q35 52 38 72 Z" fill={c.shade} />
      <path d="M33 38 L30 22 L40 30 L50 18 L60 30 L70 22 L67 38 Z" fill={GOLD} {...ink} />
      <path d={rebel ? "M50 18 L53 8 M49 11 L57 13" : "M50 18 L50 7 M45 11 L55 11"} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      {rebel && <g fill={INK}><circle cx="41" cy="64" r=".9" /><circle cx="45" cy="66" r=".9" /><circle cx="55" cy="66" r=".9" /><circle cx="59" cy="64" r=".9" /></g>}
      <Face cx={50} cy={52} kind={kind} /></>; break;
    case "queen": shape = <>
      <path d="M34 72 Q30 46 38 34 L62 34 Q70 46 66 72 Q50 78 34 72 Z" fill={c.body} {...ink} />
      <path d="M34 72 Q30 46 38 34 L43 34 Q36 52 39 74 Z" fill={c.shade} />
      <path d="M36 36 Q50 30 64 36 L64 30 Q50 24 36 30 Z" fill={GOLD} {...fine} />
      {[36, 43, 50, 57, 64].map((x, i) => <circle key={x} cx={x} cy={i === 2 ? 21 : i % 2 ? 24 : 27} r="3.6" fill={GOLD} {...fine} />)}
      <Face cx={50} cy={54} kind={kind} /></>; break;
    case "rook": shape = <>
      <path d="M28 72 L29 34 L71 34 L72 72 Q50 78 28 72 Z" fill={c.body} {...ink} />
      <path d="M28 72 L29 34 L35 34 L35 74 Z" fill={c.shade} />
      <path d="M27 36 L27 22 L37 22 L37 28 L45 28 L45 22 L55 22 L55 28 L63 28 L63 22 L73 22 L73 36 Z" fill={c.body} {...ink} />
      <path d="M30 42 L70 42" stroke={INK} strokeWidth="2" />
      <Face cx={50} cy={55} kind={kind} />
      <g className="door"><rect x="33" y="44" width="34" height="26" rx="3" fill="#a77a4f" {...fine} /><path d="M33 52 L67 52 M33 61 L67 61 M45 44 L45 52 M56 52 L56 61 M44 61 L44 70" stroke={INK} strokeWidth="1.8" /></g></>; break;
    case "bishop": shape = <>
      <path d="M50 16 Q71 34 67 58 Q65 74 50 74 Q35 74 33 58 Q29 34 50 16 Z" fill={c.body} {...ink} />
      <path d="M50 16 Q32 32 35 58 Q36 70 44 73 Q36 56 42 30 Z" fill={c.shade} />
      <path d="M41 28 L55 44" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      <circle cx="50" cy="12" r="4.5" fill={c.trim} {...fine} />
      <Face cx={50} cy={57} kind={kind} /></>; break;
    case "knight": shape = <>
      <path d="M36 74 L33 48 Q33 26 50 21 L55 12 L60 21 Q76 26 79 42 L81 52 Q80 59 71 58 L60 57 L60 74 Q48 79 36 74 Z" fill={c.body} {...ink} />
      <path d="M36 74 L33 48 Q33 30 45 23 Q38 40 42 75 Z" fill={c.shade} />
      <path d="M38 30 L30 30 L35 38 L27 40 L34 47 L28 52 L35 55" fill={c.trim} {...fine} />
      <ellipse cx="74" cy="52" rx="1.6" ry="2.2" fill={INK} />
      <g className="face" transform="translate(60 36)"><g className="eyes"><ellipse rx="2.8" ry="4.4" fill={INK} /><circle cx=".9" cy="-1.7" r=".9" fill="#fff8e6" /></g>
        <g className="brows"><path d="M-4 -8 L4 -6" stroke={INK} strokeWidth="2" strokeLinecap="round" /></g>
        <g className="ko-eyes" stroke={INK} strokeWidth="2.2" strokeLinecap="round"><path d="M-3 -3 L3 3 M3 -3 L-3 3" /></g>
        <path className="mouth" d="M8 16 Q12 19 16 16" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" /></g></>; break;
    case "pawn": shape = <>
      <circle cx="50" cy="58" r="16" fill={c.body} {...ink} />
      <path d="M38 48 Q34 62 42 72 Q32 66 35 52 Z" fill={c.shade} />
      {!rebel && <path d="M33 54 Q34 38 50 38 Q66 38 67 54 Z" fill={c.trim} {...fine} />}
      <Face cx={50} cy={60} scale={0.85} kind={kind} /></>; break;
  }
  return <g className="head-tilt" transform={`rotate(${tilt} 50 72)`}><g className="head">{shape}{kind !== "king" && kind !== "pawn" && plume}{kind === "pawn" && !rebel && <path d="M50 38 Q56 26 64 28 Q56 30 54 39 Z" fill="#c8504a" stroke={INK} strokeWidth="2" />}</g></g>;
}

function Prop({ kind, c, rebel }: { kind: RigKind; c: typeof PALETTE.white; rebel: boolean }) {
  const s = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  switch (kind) {
    case "king": return <g className="prop"><path d="M76 89 L83 60 L87 61 L80 90 Z" fill="#d8dee0" {...s} /><path d="M72 88 L84 91" stroke={INK} strokeWidth="4" strokeLinecap="round" />{rebel && <path d="M84 66 L86 68" stroke={INK} strokeWidth="1.5" />}</g>;
    case "queen": return <g className="prop"><path d="M76 92 L84 60" stroke={INK} strokeWidth="3.5" strokeLinecap="round" /><circle cx="85" cy="57" r="5" fill={GOLD} {...s} /></g>;
    case "bishop": return <g className="prop"><path d="M76 94 L80 56 Q81 46 89 48 Q95 51 91 58" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" /><path d="M77 94 L81 56 Q82 47 89 49" fill="none" stroke={c.trim} strokeWidth="1.5" strokeLinecap="round" /></g>;
    case "pawn": return rebel
      ? <g className="prop"><path d="M74 94 L82 70" stroke="#a77a4f" strokeWidth="3.5" strokeLinecap="round" /><path d="M74 94 L82 70" stroke={INK} strokeWidth="1" opacity=".4" /><ellipse cx="83.5" cy="65" rx="4" ry="6.5" transform="rotate(18 83.5 65)" fill="#c99a63" {...s} /></g>
      : <g className="prop"><path d="M75 96 L84 40" stroke={INK} strokeWidth="3" strokeLinecap="round" /><path d="M84 40 L80 46 L86 46 L85 32 Z" fill="#d8dee0" {...s} /></g>;
    default: return null;
  }
}

function Shield({ rebel, c }: { rebel: boolean; c: typeof PALETTE.white }) {
  return <g className="shield">{rebel
    ? <><circle cx="27" cy="88" r="12" fill={c.trim} stroke={INK} strokeWidth="3.5" /><circle cx="27" cy="88" r="4" fill={GOLD} stroke={INK} strokeWidth="2" /></>
    : <><path d="M17 78 L37 78 L36 92 Q27 102 18 92 Z" fill={c.trim} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" /><path d="M27 79 L27 98" stroke={c.body} strokeWidth="3" /></>}</g>;
}

export function PieceRig({ kind, side, action = "idle", defending = false, facing = 1, hue = "blue", seed = 0, wounded = false }: {
  kind: RigKind; side: RigSide; action?: RigAction; defending?: boolean; facing?: 1 | -1; hue?: PatrolHue; seed?: number; wounded?: boolean;
}) {
  const rebel = side === "white", c = rebel ? PALETTE.white : PALETTE[hue], shape = SHAPE[kind];
  const style = { "--seed": `${(seed % 7) * -0.37}s`, "--face": facing } as CSSProperties;
  return <svg className={`rig rig-${kind} ${rebel ? "rebel" : "patrol"} act-${action} ${defending ? "is-defending" : ""} ${wounded ? "is-wounded" : ""}`} viewBox="0 0 100 120" style={style} aria-hidden="true">
    {rebel ? <ellipse className="rig-shadow" cx="50" cy="108" rx={27 * shape.w} ry="6" fill={INK} opacity=".22" />
      : <path className="rig-shadow" d={`M${50 - 28 * shape.w} 108 L50 102 L${50 + 28 * shape.w} 108 L50 114 Z`} fill={INK} opacity=".22" />}
    <g className="fx-dust" fill="#efe3c6" stroke={INK} strokeWidth="1.5"><circle cx="30" cy="106" r="4" /><circle cx="70" cy="107" r="3.5" /><circle cx="50" cy="110" r="3" /></g>
    <g className="flip"><g className="hop"><g className="squash">
      {kind === "king" && <path className="cape" d="M36 78 Q24 96 14 108 L44 106 Z" fill={rebel ? c.trim : "#7a3940"} stroke={INK} strokeWidth="3" strokeLinejoin="round" />}
      <Body w={shape.w} c={c} rebel={rebel} />
      <g className="arm arm-back"><path d={`M${50 - 12 * shape.w} 82 L${50 - 21 * shape.w} 92`} stroke={INK} strokeWidth="8" strokeLinecap="round" /><path d={`M${50 - 12 * shape.w} 82 L${50 - 21 * shape.w} 92`} stroke={c.body} strokeWidth="4" strokeLinecap="round" /></g>
      <Prop kind={kind} c={c} rebel={rebel} />
      <g className="arm arm-front"><path d={`M${50 + 12 * shape.w} 82 L${50 + 23 * shape.w} 90`} stroke={INK} strokeWidth="8" strokeLinecap="round" /><path d={`M${50 + 12 * shape.w} 82 L${50 + 23 * shape.w} 90`} stroke={c.body} strokeWidth="4" strokeLinecap="round" /></g>
      <Head kind={kind} c={c} rebel={rebel} />
      {wounded && <g className="bandage" transform={`translate(${kind === "pawn" ? 58 : 60} ${shape.headY - 14}) rotate(20)`}><rect x="-7" y="-2.5" width="14" height="5" rx="1" fill="#fff8e6" stroke={INK} strokeWidth="1.8" /><rect x="-2.5" y="-7" width="5" height="14" rx="1" fill="#fff8e6" stroke={INK} strokeWidth="1.8" /></g>}
      <Shield rebel={rebel} c={c} />
      <path className="fx-smear" d="M70 50 Q96 70 78 100" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" opacity=".55" />
    </g></g></g>
    <g className="fx-stars" fill={GOLD} stroke={INK} strokeWidth="1.5">{[[84, 40], [92, 58], [76, 30]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} />)}</g>
    <g className="fx-smoke" fill="#cfc6b8" stroke={INK} strokeWidth="1.5">{[[38, 84], [56, 76], [66, 92], [44, 98], [52, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)}</g>
  </svg>;
}
