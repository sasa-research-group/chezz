import type { CSSProperties, ReactNode } from "react";

/** A cast of misfits. Each chess piece is a distinct character whose costume
 * echoes its chess shape; rebels (white) are patched exiles, the patrol
 * (black) are prim royal guards. Layered groups (.flip > .hop > .squash >
 * body/arms/prop/head) are animated by CSS in src/rig.css. */
export type RigKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type RigSide = "white" | "black";
export type RigAction = "idle" | "move" | "attack" | "defend" | "hit" | "death";
export type PatrolHue = "blue" | "red";

const INK = "#382f2e", GOLD = "#e7ba58", GOLD_SH = "#c0913c", STEEL = "#cfd6d8", STEEL_SH = "#9aa6aa";
const SKIN = "#f2c49c", SKIN_SH = "#d79c76", BLUSH = "#e6927b", WOOD = "#a77a4f", WOOD_SH = "#80583a";
type Palette = { main: string; mainSh: string; acc: string; accSh: string; cloth: string; clothSh: string };
const REBEL: Palette = { main: "#2f7d6d", mainSh: "#24625a", acc: "#e8c98a", accSh: "#c9a467", cloth: "#b98757", clothSh: "#8f6440" };
const PATROL: Record<PatrolHue, Palette> = {
  blue: { main: "#4a68b0", mainSh: "#334d8a", acc: GOLD, accSh: GOLD_SH, cloth: "#f2ede0", clothSh: "#d6cdb8" },
  red: { main: "#c35d55", mainSh: "#9c4640", acc: GOLD, accSh: GOLD_SH, cloth: "#f2ede0", clothSh: "#d6cdb8" },
};
const o = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const f = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

type EyeStyle = "beady" | "wide" | "lidded" | "sharp" | "small";
/** Eyes, brows and the KO X-eyes, centred on (cx, cy). */
function Eyes({ cx, cy, gap, style, brow }: { cx: number; cy: number; gap: number; style: EyeStyle; brow: string }) {
  const r = style === "wide" ? [3.4, 4.6] : style === "beady" || style === "small" || style === "lidded" ? [1.9, 2.4] : [2.4, 3.4];
  return <g className="face" transform={`translate(${cx} ${cy})`}>
    <g className="eyes">
      {[-gap, gap].map((x, i) => <g key={i} transform={`translate(${x} 0)`}>
        {style === "wide" && <ellipse rx="5" ry="6" fill="#fffaf0" {...f} strokeWidth="1.6" />}
        <ellipse rx={r[0]} ry={r[1]} fill={INK} /><circle cx={r[0] * .35} cy={-r[1] * .4} r={Math.max(.7, r[0] * .32)} fill="#fffaf0" />
        {style === "lidded" && <path d={`M${-r[0] - 1} -1.2 Q0 -2.6 ${r[0] + 1} -1.2`} fill={SKIN} stroke={INK} strokeWidth="1.4" strokeLinecap="round" />}
        {style === "sharp" && <path d={i ? "M-1 -4 L4 -6" : "M1 -4 L-4 -6"} stroke={INK} strokeWidth="1.4" strokeLinecap="round" />}
      </g>)}
    </g>
    <g stroke={INK} strokeWidth="2.4" strokeLinecap="round" fill="none"><path d={brow} transform={`translate(${-gap} 0)`} /><path d={brow} transform={`translate(${gap} 0) scale(-1 1)`} /></g>
    <g className="ko-eyes" stroke={INK} strokeWidth="2.2" strokeLinecap="round">{[-gap, gap].map((x, i) => <path key={i} d={`M${x - 2.6} -2.6 L${x + 2.6} 2.6 M${x + 2.6} -2.6 L${x - 2.6} 2.6`} />)}</g>
  </g>;
}
const Arm = ({ d, fill, front }: { d: string; fill: string; front?: boolean }) =>
  <g className={`arm ${front ? "arm-front" : "arm-back"}`}><path d={d} stroke={INK} strokeWidth="9" strokeLinecap="round" fill="none" /><path d={d} stroke={fill} strokeWidth="5" strokeLinecap="round" fill="none" /></g>;
const Hand = ({ x, y }: { x: number; y: number }) => <circle cx={x} cy={y} r="3.6" fill={SKIN} {...f} />;
const Boots = ({ xs, y = 104, fill = WOOD_SH }: { xs: number[]; y?: number; fill?: string }) =>
  <>{xs.map(x => <path key={x} d={`M${x - 6} ${y + 4} Q${x - 6} ${y - 3} ${x} ${y - 3} Q${x + 7} ${y - 3} ${x + 7} ${y + 4} Z`} fill={fill} {...f} />)}</>;
const Patch = ({ x, y, fill }: { x: number; y: number; fill: string }) =>
  <g transform={`rotate(-8 ${x} ${y})`}><rect x={x - 4.5} y={y - 4.5} width="9" height="9" rx="1.2" fill={fill} {...f} strokeWidth="1.6" /><path d={`M${x - 3} ${y - 6} L${x - 3} ${y - 3.5} M${x + 3} ${y + 3.5} L${x + 3} ${y + 6}`} stroke={INK} strokeWidth="1.2" /></g>;

type Figure = { back?: ReactNode; body: ReactNode; armBack?: ReactNode; prop?: ReactNode; armFront: ReactNode; head: ReactNode; propOrigin: string; shield: [number, number] };

function king(rebel: boolean, c: Palette): Figure {
  return {
    back: <path className="cape" d={rebel ? "M30 66 Q16 92 8 108 L46 108 L44 70 Z" : "M32 66 Q22 92 18 108 L48 108 L46 70 Z"} fill={rebel ? "#8c3b3b" : c.mainSh} {...o} />,
    body: <>
      <Boots xs={[42, 59]} fill={rebel ? WOOD_SH : INK} />
      <path d="M30 104 Q24 82 34 68 Q50 60 66 68 Q78 82 70 104 Q50 110 30 104 Z" fill={rebel ? "#8c3b3b" : c.main} {...o} />
      <path d="M30 104 Q24 82 34 68 Q38 86 40 106 Z" fill={rebel ? "#6e2c2c" : c.mainSh} />
      <ellipse cx="50" cy="88" rx="13" ry="11" fill={rebel ? "#a84a4a" : c.mainSh} opacity=".55" />
      <path d="M34 70 Q50 78 66 70" fill="none" stroke="#fffaf0" strokeWidth="7" strokeLinecap="round" /><path d="M34 70 Q50 78 66 70" fill="none" stroke={INK} strokeWidth="1.5" strokeDasharray="1 5" strokeLinecap="round" />
      <path d="M31 101 Q50 108 69 101" fill="none" stroke="#fffaf0" strokeWidth="5" strokeLinecap="round" />
      {rebel ? <Patch x={62} y={90} fill={c.acc} /> : <path d="M47 77 L53 77 L53 104 L47 104 Z" fill={GOLD} {...f} />}
    </>,
    armBack: <Arm d="M36 74 Q28 84 30 92" fill={rebel ? "#8c3b3b" : c.main} />,
    prop: rebel
      ? <g className="prop"><path d="M74 90 L82 58 L87 60 L80 92 Z" fill={STEEL} {...f} /><path d="M83 66 L86 67 L84 71" fill={STEEL} stroke={INK} strokeWidth="1.2" /><path d="M70 88 L84 93" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M70 88 L84 93" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" /></g>
      : <g className="prop"><path d="M76 92 L82 56" stroke={INK} strokeWidth="4" strokeLinecap="round" /><path d="M76 92 L82 56" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" /><circle cx="82.5" cy="53" r="5" fill="#c8504a" {...f} /></g>,
    armFront: <><Arm d="M64 74 Q72 82 76 90" fill={rebel ? "#8c3b3b" : c.main} front /><Hand x={76} y={90} /></>,
    head: <>
      <circle cx="50" cy="46" r="15" fill={SKIN} {...o} />
      <path d="M36 50 Q37 60 44 62 Q38 56 38 46 Z" fill={SKIN_SH} />
      {rebel
        ? <path d="M35 49 Q36 66 50 70 Q64 66 65 49 Q60 58 50 57 Q40 58 35 49 Z" fill="#c9c3b8" {...f} />
        : <path d="M40 57 Q44 52 50 55 Q56 52 60 57 Q65 54 68 50 M40 57 Q35 54 32 50" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      <ellipse cx="51" cy="51" rx="4.6" ry="3.8" fill={rebel ? "#df8a72" : SKIN_SH} {...f} />
      <Eyes cx={50} cy={44} gap={6} style="beady" brow={rebel ? "M-4 -6 L3 -4" : "M-4 -4 L3 -6"} />
      <g transform={rebel ? "rotate(-16 50 34)" : ""}>
        <path d="M36 37 L33 22 L42 29 L50 18 L58 29 L67 22 L64 37 Z" fill={GOLD} {...o} />
        <path d="M36 37 L64 37" stroke={GOLD_SH} strokeWidth="3" /><circle cx="50" cy="31" r="2.4" fill="#c8504a" stroke={INK} strokeWidth="1.2" />
        <path d={rebel ? "M50 18 L54 9 M50 12 L58 14" : "M50 18 L50 8 M45 12 L55 12"} stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
      </g>
    </>,
    propOrigin: "76px 90px", shield: [30, 90],
  };
}

function queen(rebel: boolean, c: Palette): Figure {
  return {
    back: rebel ? <path className="cape" d="M42 28 Q30 40 32 62 Q28 70 32 76" fill="none" stroke="#b5532f" strokeWidth="6" strokeLinecap="round" /> : undefined,
    body: <>
      <path d="M44 62 L56 62 Q70 86 72 106 Q50 112 28 106 Q30 86 44 62 Z" fill={rebel ? c.main : c.main} {...o} />
      <path d="M44 62 Q34 84 30 106 L40 107 Q40 84 46 64 Z" fill={c.mainSh} />
      <path d="M41 46 Q50 42 59 46 L57 64 Q50 67 43 64 Z" fill={rebel ? STEEL : c.acc} {...o} />
      <path d="M43 54 L57 54" stroke={rebel ? STEEL_SH : GOLD_SH} strokeWidth="2" />
      {rebel ? <Patch x={58} y={92} fill={c.acc} /> : <path d="M36 98 Q50 92 64 98" fill="none" stroke={GOLD} strokeWidth="3" />}
    </>,
    armBack: <><Arm d="M43 50 Q36 58 36 68" fill={SKIN} /></>,
    prop: rebel
      ? <g className="prop"><path d="M70 66 L80 50" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M70 66 L80 50" stroke={WOOD} strokeWidth="2.4" strokeLinecap="round" /><ellipse cx="85" cy="42" rx="9" ry="8" fill="#5b5550" {...o} /><ellipse cx="85" cy="42" rx="5" ry="4.2" fill="#77706a" /></g>
      : <g className="prop"><path d="M70 66 L80 40" stroke={INK} strokeWidth="4" strokeLinecap="round" /><path d="M70 66 L80 40" stroke={GOLD} strokeWidth="1.6" /><path d="M80 32 L84 38 L80 44 L76 38 Z" fill="#7fc3d6" {...f} /></g>,
    armFront: <><Arm d="M57 50 Q66 56 70 66" fill={SKIN} front /><Hand x={70} y={66} /></>,
    head: <>
      <path d="M46 36 L46 44 L54 44 L54 36" fill={SKIN} {...f} />
      <ellipse cx="50" cy="28" rx="10" ry="12" fill={SKIN} {...o} />
      {rebel
        ? <path d="M40 26 Q40 14 50 14 Q60 14 60 26 Q56 18 50 19 Q44 18 40 26 Z" fill="#b5532f" {...f} />
        : <path d="M39 26 Q36 2 50 0 Q64 2 61 26 Q56 14 50 15 Q44 14 39 26 Z" fill="#ece6da" {...f} />}
      <Eyes cx={50} cy={28} gap={4.5} style="sharp" brow="M-3 -5 L3 -6" />
      <path d="M47 35 L53 34.5" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      {rebel && <path d="M55 30 L59 34" stroke="#b5532f" strokeWidth="1.6" strokeLinecap="round" />}
      <g transform={rebel ? "rotate(-8 50 16)" : "translate(0 -10)"}>
        <path d="M40 18 Q50 13 60 18 L60 14 Q50 9 40 14 Z" fill={GOLD} {...f} />
        {[40, 45, 50, 55, 60].map((x, i) => <circle key={x} cx={x} cy={i === 2 ? 7 : i % 2 ? 9 : 11} r="2.6" fill={GOLD} {...f} strokeWidth="1.6" />)}
      </g>
    </>,
    propOrigin: "70px 66px", shield: [36, 70],
  };
}

function rook(rebel: boolean, c: Palette): Figure {
  return {
    body: <>
      <Boots xs={[38, 62]} fill={rebel ? WOOD_SH : INK} />
      <path d="M22 66 Q22 52 36 50 L64 50 Q78 52 78 66 L76 98 Q50 106 24 98 Z" fill={rebel ? c.cloth : STEEL} {...o} />
      <path d="M22 66 Q22 52 36 50 L34 100 Q28 99 24 98 Z" fill={rebel ? c.clothSh : STEEL_SH} />
      {rebel
        ? <><path d="M34 66 L66 66 L64 100 Q50 103 36 100 Z" fill={WOOD} {...f} /><path d="M40 66 L36 54 M60 66 L64 54" stroke={INK} strokeWidth="2" /><Patch x={30} y={84} fill={c.main} /></>
        : <><path d="M30 64 L70 64 M28 78 L72 78 M28 92 L72 92" stroke={STEEL_SH} strokeWidth="2.4" /><path d="M44 52 L56 52 L56 100 L44 100 Z" fill={c.main} {...f} /></>}
    </>,
    armBack: <><Arm d="M26 58 Q14 74 18 92" fill={rebel ? SKIN : STEEL} /><circle cx="18" cy="94" r="6" fill={rebel ? SKIN : STEEL} {...f} /></>,
    prop: rebel
      ? <g className="prop"><path d="M80 96 L86 48" stroke={INK} strokeWidth="6" strokeLinecap="round" /><path d="M80 96 L86 48" stroke={WOOD} strokeWidth="3" strokeLinecap="round" /><rect x="74" y="34" width="24" height="16" rx="3" fill={WOOD_SH} {...o} transform="rotate(8 86 42)" /></g>
      : <g className="prop"><path d="M80 98 L86 22" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M80 98 L86 22" stroke={WOOD} strokeWidth="2" strokeLinecap="round" /><path d="M86 22 Q100 26 98 40 L87 38 Z M86 22 L84 12 L89 20" fill={STEEL} {...f} /></g>,
    armFront: <><Arm d="M74 58 Q86 70 82 88" fill={rebel ? SKIN : STEEL} front /><circle cx="82" cy="90" r="6.5" fill={rebel ? SKIN : STEEL} {...f} /></>,
    head: <>
      <path d="M38 50 Q38 40 50 40 Q62 40 62 50 Q50 56 38 50 Z" fill={SKIN} {...o} />
      {rebel && <g fill={INK}>{[[43, 49], [47, 51], [53, 51], [57, 49]].map(([x, y]) => <circle key={x} cx={x} cy={y} r=".9" />)}</g>}
      {!rebel && <path d="M42 50 Q50 46 58 50" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />}
      <path d="M34 42 L34 20 L41 20 L41 26 L47 26 L47 20 L53 20 L53 26 L59 26 L59 20 L66 20 L66 42 Z" fill={rebel ? "#b3aa9d" : STEEL} {...o} />
      <path d="M34 42 L34 20 L39 20 L39 42 Z" fill={rebel ? "#958c80" : STEEL_SH} />
      {rebel && <path d="M44 30 L50 30 L50 34 M56 32 L60 32" stroke={INK} strokeWidth="1.4" />}
      <rect x="38" y="33" width="24" height="8" rx="2" fill={SKIN_SH} stroke={INK} strokeWidth="2" />
      <Eyes cx={50} cy={37} gap={5} style="small" brow="M-3 -3 L3 -2" />
      <g className="door"><rect x="36" y="22" width="28" height="20" rx="2" fill={WOOD} {...f} /><path d="M36 29 L64 29 M36 36 L64 36 M46 22 L46 29 M54 29 L54 36 M44 36 L44 42" stroke={INK} strokeWidth="1.6" /></g>
    </>,
    propOrigin: "82px 90px", shield: [20, 86],
  };
}

function bishop(rebel: boolean, c: Palette): Figure {
  return {
    body: <>
      <path d="M40 54 L60 54 Q66 80 68 106 Q50 111 32 106 Q34 80 40 54 Z" fill={rebel ? c.acc : c.main} {...o} />
      <path d="M40 54 Q36 80 33 106 L42 107 Q42 80 44 56 Z" fill={rebel ? c.accSh : c.mainSh} />
      <path d="M38 74 Q50 78 62 74" fill="none" stroke={rebel ? WOOD : GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M50 77 L48 90" stroke={rebel ? WOOD : GOLD} strokeWidth="2.4" strokeLinecap="round" />
      {rebel ? <Patch x={58} y={96} fill={c.main} /> : <path d="M50 58 L50 70 M45 63 L55 63" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />}
    </>,
    armBack: <><Arm d="M42 60 Q34 68 36 76" fill={rebel ? c.acc : c.main} /><rect x="28" y="72" width="13" height="10" rx="1.5" fill={rebel ? "#7a4f3a" : "#5a2f3a"} {...f} transform="rotate(-12 34 77)" /></>,
    prop: <g className="prop"><path d="M72 104 L76 30 Q77 18 87 20 Q95 23 91 32" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M72 104 L76 30 Q77 19 87 21 Q94 24 91 31" fill="none" stroke={rebel ? WOOD : GOLD} strokeWidth="2.2" strokeLinecap="round" /></g>,
    armFront: <><Arm d="M58 60 Q68 66 73 74" fill={rebel ? c.acc : c.main} front /><Hand x={74} y={74} /></>,
    head: <>
      <path d="M40 32 Q39 56 50 58 Q61 56 60 32 Z" fill={SKIN} {...o} />
      <path d="M41 34 Q41 50 47 57 Q44 48 44 34 Z" fill={SKIN_SH} />
      <path d="M50 41 L56 50 L50 50" fill={SKIN} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <Eyes cx={50} cy={40} gap={5} style="lidded" brow={rebel ? "M-3 -4 Q0 -6 3 -4" : "M-3 -3 L3 -5"} />
      {!rebel && <g fill="none" stroke={INK} strokeWidth="1.2"><circle cx="45" cy="40" r="3.6" /><circle cx="55" cy="40" r="3.6" /><path d="M48.6 40 L51.4 40" /></g>}
      <path d={rebel ? "M45 53 Q50 56 55 52" : "M45 54 L55 54"} stroke={INK} strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M50 0 Q63 13 60 32 L40 32 Q37 13 50 0 Z" fill={rebel ? "#f4efe2" : c.cloth} {...o} />
      <path d="M44 12 L54 24" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M40 32 L60 32" stroke={rebel ? c.main : GOLD} strokeWidth="3.4" />
    </>,
    propOrigin: "74px 74px", shield: [34, 82],
  };
}

function knight(rebel: boolean, c: Palette): Figure {
  const horse = rebel ? "#e8d3a6" : STEEL, horseSh = rebel ? "#c9b07e" : STEEL_SH;
  return {
    body: <>
      <path d="M26 108 L66 52" stroke={INK} strokeWidth="6" strokeLinecap="round" /><path d="M26 108 L66 52" stroke={WOOD} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M58 64 L56 46 Q56 30 70 27 L74 19 L78 28 Q90 33 92 46 L94 54 Q93 60 85 58 L76 57 L75 66 Q66 70 58 64 Z" fill={horse} {...o} />
      <path d="M58 64 L56 46 Q57 34 66 29 Q61 44 64 66 Z" fill={horseSh} />
      <path d="M60 34 L54 32 L58 40 L51 42 L57 48 L52 52 L58 55" fill={rebel ? "#b5532f" : c.main} {...f} />
      <circle cx="78" cy="38" r="2.2" fill={INK} /><ellipse cx="89" cy="52" rx="1.3" ry="1.8" fill={INK} />
      {!rebel && <path d="M74 19 Q72 6 82 4 Q76 10 78 20" fill={c.main} {...f} />}
      <Boots xs={[38, 50]} fill={rebel ? WOOD_SH : INK} />
      <path d="M36 102 L40 86 M52 102 L50 86" stroke={INK} strokeWidth="7" strokeLinecap="round" /><path d="M36 102 L40 86 M52 102 L50 86" stroke={rebel ? WOOD : STEEL} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M34 88 Q32 70 38 62 Q46 58 54 62 Q58 72 56 88 Q45 92 34 88 Z" fill={rebel ? c.main : c.main} {...o} />
      <path d="M34 88 Q32 72 38 63 Q38 76 41 90 Z" fill={c.mainSh} />
      {rebel ? <Patch x={50} y={80} fill={c.acc} /> : <path d="M38 70 L54 70" stroke={GOLD} strokeWidth="3" />}
    </>,
    armBack: <Arm d="M38 66 Q32 74 34 80" fill={rebel ? c.main : STEEL} />,
    prop: <g className="prop"><path d="M58 76 L92 70" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M58 76 L92 70" stroke={rebel ? WOOD : STEEL} strokeWidth="2.4" strokeLinecap="round" /><path d="M92 70 L99 69 L92 66 Z" fill={rebel ? WOOD_SH : STEEL} {...f} /></g>,
    armFront: <><Arm d="M52 66 Q58 70 60 76" fill={rebel ? c.main : STEEL} front /><Hand x={60} y={76} /></>,
    head: <>
      <circle cx="38" cy="48" r="12" fill={SKIN} {...o} />
      {rebel && <g fill={BLUSH}>{[[32, 52], [34, 54], [42, 53]].map(([x, y]) => <circle key={x} cx={x} cy={y} r=".9" />)}</g>}
      <path d={rebel ? "M34 55 Q38 59 43 55 L41 58 L39 58 L38 56 Z" : "M34 55 L42 55"} fill="#fffaf0" stroke={INK} strokeWidth="1.8" strokeLinejoin="round" />
      <Eyes cx={38} cy={47} gap={4.2} style="wide" brow="M-3 -8 Q0 -10 3 -8" />
      {rebel
        ? <path d="M24 42 Q24 26 38 26 Q52 26 52 42 L48 40 L48 36 L28 36 L28 40 Z" fill="#8f969a" {...o} />
        : <><path d="M25 46 Q24 28 38 28 Q52 28 51 46 Z" fill={STEEL} {...o} /><path d="M27 44 L49 44" stroke={INK} strokeWidth="2" /><path d="M38 28 Q42 12 52 14 Q44 18 42 28" fill={c.main} {...f} /></>}
    </>,
    propOrigin: "60px 76px", shield: [30, 76],
  };
}

function pawn(rebel: boolean, c: Palette): Figure {
  return {
    body: <>
      <Boots xs={[43, 57]} fill={rebel ? WOOD_SH : INK} />
      <path d="M36 104 Q34 84 40 76 Q50 72 60 76 Q66 84 64 104 Q50 108 36 104 Z" fill={rebel ? c.cloth : c.main} {...o} />
      <path d="M36 104 Q34 86 40 77 Q40 92 43 106 Z" fill={rebel ? c.clothSh : c.mainSh} />
      {rebel ? <><path d="M38 90 L62 90" stroke={WOOD_SH} strokeWidth="2.4" /><Patch x={56} y={98} fill={c.main} /></> : <path d="M47 78 L53 78 L53 104 L47 104 Z" fill={c.cloth} {...f} />}
    </>,
    armBack: <Arm d="M41 80 Q36 86 38 92" fill={rebel ? c.cloth : c.main} />,
    prop: rebel
      ? <g className="prop"><path d="M60 100 L70 52" stroke={INK} strokeWidth="5" strokeLinecap="round" /><path d="M60 100 L70 52" stroke={WOOD} strokeWidth="2.2" strokeLinecap="round" /><path d="M64 52 L66 40 M70 52 L71 39 M76 54 L77 42 M64 52 Q70 56 76 54" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" /></g>
      : <g className="prop"><path d="M62 104 L72 14" stroke={INK} strokeWidth="4.5" strokeLinecap="round" /><path d="M62 104 L72 14" stroke={WOOD} strokeWidth="2" strokeLinecap="round" /><path d="M72 14 L68 22 L76 23 Z M72 14 L73 2" fill={STEEL} {...f} /></g>,
    armFront: <><Arm d="M59 80 Q64 84 66 86" fill={rebel ? c.cloth : c.main} front /><Hand x={66} y={86} /></>,
    head: <>
      <circle cx="50" cy="62" r="13" fill={SKIN} {...o} />
      {rebel && <g fill={BLUSH}>{[[42, 66], [44, 68], [56, 67], [58, 65]].map(([x, y]) => <circle key={x} cx={x} cy={y} r=".9" />)}</g>}
      <path d={rebel ? "M47 70 Q50 68 53 70" : "M44 69 Q47 66 50 69 Q53 66 56 69"} fill="none" stroke={INK} strokeWidth={rebel ? 1.8 : 2.6} strokeLinecap="round" />
      <Eyes cx={50} cy={63} gap={4.6} style={rebel ? "wide" : "small"} brow={rebel ? "M-3 -7 L3 -9" : "M-3 -4 L3 -3"} />
      {rebel
        ? <><path d="M35 56 Q36 42 50 42 Q64 42 65 56 Z" fill="#7d7a76" {...o} /><path d="M64 50 Q72 50 72 46" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" /></>
        : <><path d="M34 56 Q35 44 50 44 Q65 44 66 56 Z" fill={STEEL} {...o} /><path d="M38 44 Q50 30 62 44" fill={STEEL} {...f} /><path d="M32 56 L68 56" stroke={INK} strokeWidth="3" strokeLinecap="round" /></>}
    </>,
    propOrigin: "66px 86px", shield: [38, 90],
  };
}

const FIGURES = { king, queen, rook, bishop, knight, pawn };

function Shield({ rebel, c, at: [x, y] }: { rebel: boolean; c: Palette; at: [number, number] }) {
  return <g className="shield" style={{ transformOrigin: `${x}px ${y}px` }}>{rebel
    ? <><circle cx={x} cy={y} r="11" fill={WOOD} {...o} /><path d={`M${x - 10} ${y} L${x + 10} ${y} M${x} ${y - 10} L${x} ${y + 10}`} stroke={WOOD_SH} strokeWidth="2" /><circle cx={x} cy={y} r="3.4" fill={STEEL} {...f} /></>
    : <><path d={`M${x - 10} ${y - 11} L${x + 10} ${y - 11} L${x + 9} ${y + 3} Q${x} ${y + 13} ${x - 9} ${y + 3} Z`} fill={c.main} {...o} /><path d={`M${x} ${y - 10} L${x} ${y + 9} M${x - 8} ${y - 3} L${x + 8} ${y - 3}`} stroke={GOLD} strokeWidth="2.6" /></>}</g>;
}

export function PieceRig({ kind, side, action = "idle", defending = false, facing = 1, hue = "blue", seed = 0, wounded = false }: {
  kind: RigKind; side: RigSide; action?: RigAction; defending?: boolean; facing?: 1 | -1; hue?: PatrolHue; seed?: number; wounded?: boolean;
}) {
  const rebel = side === "white", c = rebel ? REBEL : PATROL[hue], fig = FIGURES[kind](rebel, c);
  const style = { "--seed": `${(seed % 7) * -0.37}s`, "--face": facing, "--prop-origin": fig.propOrigin } as CSSProperties;
  return <svg className={`rig rig-${kind} ${rebel ? "rebel" : "patrol"} act-${action} ${defending ? "is-defending" : ""} ${wounded ? "is-wounded" : ""}`} viewBox="0 0 100 120" style={style} aria-hidden="true">
    {rebel ? <ellipse className="rig-shadow" cx="50" cy="108" rx="28" ry="6" fill={INK} opacity=".22" />
      : <path className="rig-shadow" d="M22 108 L50 102 L78 108 L50 114 Z" fill={INK} opacity=".22" />}
    <g className="fx-dust" fill="#efe3c6" stroke={INK} strokeWidth="1.5"><circle cx="28" cy="106" r="4" /><circle cx="72" cy="107" r="3.5" /><circle cx="50" cy="111" r="3" /></g>
    <g className="flip"><g className="hop"><g className="squash">
      {fig.back}
      {fig.armBack}
      {fig.body}
      {fig.prop}
      {fig.armFront}
      <g className="head-tilt"><g className="head">{fig.head}</g></g>
      {wounded && <g className="bandage"><rect x="56" y={kind === "pawn" ? 48 : 30} width="12" height="5" rx="1" fill="#fffaf0" {...f} strokeWidth="1.6" transform={`rotate(25 62 ${kind === "pawn" ? 50 : 32})`} /><path d="M30 100 L36 96" stroke={INK} strokeWidth="1.6" /></g>}
      <Shield rebel={rebel} c={c} at={fig.shield} />
      <path className="fx-smear" d="M64 30 Q100 56 80 102" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" opacity=".55" />
    </g></g></g>
    <g className="fx-stars" fill={GOLD} stroke={INK} strokeWidth="1.5">{[[86, 36], [94, 56], [78, 24]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} />)}</g>
    <g className="fx-smoke" fill="#cfc6b8" stroke={INK} strokeWidth="1.5">{[[38, 84], [56, 76], [66, 92], [44, 98], [52, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)}</g>
  </svg>;
}
