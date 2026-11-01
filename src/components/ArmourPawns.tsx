import type { Figure, Palette, PatrolHue } from "./PieceRig";

/** The pawns redrawn in the "armour does the talking" style (docs/art-style.md,
 * section 9): crest silhouette, dot eyes, one oversized prop, thick ink, flat
 * fill plus one hard shadow. Same groups and pivots as the old rigs, so the
 * keyframes in rig.css drive them unchanged. */
export const NEW_INK = "#1f1a19";
const o = { stroke: NEW_INK, strokeWidth: 4.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const f = { stroke: NEW_INK, strokeWidth: 2.6, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const SKIN = "#f0be9a", SKIN_SH = "#d99a74", HIGHLIGHT = "#fffaf0";
const COPPER = "#a57a52", COPPER_SH = "#7e5b3c", GREEN = "#869043", GREEN_SH = "#646d2f";
const RED = "#cd2a25", RED_SH = "#94201c", PATCH = "#507b92", LEATHER_DK = "#5f3f2c";
const WOOD = "#a57952", RUST = "#8a9094";
const BLUE = "#4b76cf", BLUE_SH = "#314e8f", GOLD = "#f0bf44", STEEL = "#a9c1d6", STEEL_SH = "#68788f";
const MOUSTACHE = "#744924", GLOVE = "#865637", MAIL = "#4b5263";

/** A pole drawn as an ink stroke under a thinner colour stroke. */
const Pole = ({ d, ink, fill, color }: { d: string; ink: number; fill: number; color: string }) =>
  <><path d={d} stroke={NEW_INK} strokeWidth={ink} strokeLinecap="round" strokeLinejoin="round" fill="none" /><path d={d} stroke={color} strokeWidth={fill} strokeLinecap="round" strokeLinejoin="round" fill="none" /></>;
const Sleeve = ({ d, fill, front }: { d: string; fill: string; front?: boolean }) =>
  <g className={`arm ${front ? "arm-front" : "arm-back"}`}><Pole d={d} ink={11} fill={6.2} color={fill} /></g>;
const Mitt = ({ x, y, fill }: { x: number; y: number; fill: string }) => <circle cx={x} cy={y} r="5.2" fill={fill} {...f} strokeWidth="3" />;
const Boot = ({ x }: { x: number }) => <path d={`M${x - 7} 108 Q${x - 7} 98.5 ${x} 98.5 Q${x + 8} 98.5 ${x + 8} 108 Z`} fill={LEATHER_DK} {...f} strokeWidth="3.2" />;

/** Two dot eyes, the KO crosses for death, and an effort squint that shows where the old rigs yell. */
function DotEyes({ y, gap, r }: { y: number; gap: number; r: number }) {
  return <g className="face">
    <g className="eyes">{[-gap, gap].map(x => <g key={x} className="pupil"><circle cx={50 + x} cy={y} r={r} fill={NEW_INK} /></g>)}</g>
    <g className="ko-eyes" stroke={NEW_INK} strokeWidth="2.6" strokeLinecap="round">{[-gap, gap].map(x => <path key={x} d={`M${47 + x} ${y - 3} L${53 + x} ${y + 3} M${53 + x} ${y - 3} L${47 + x} ${y + 3}`} />)}</g>
  </g>;
}
function Squint({ y, gap }: { y: number; gap: number }) {
  return <g className="mouth-yell">
    {[-gap, gap].map(x => <circle key={x} cx={50 + x} cy={y} r="3.6" fill={SKIN} />)}
    <path d={`M${46 - gap} ${y - 3} L${51 - gap} ${y} L${46 - gap} ${y + 3} M${54 + gap} ${y - 3} L${49 + gap} ${y} L${54 + gap} ${y + 3}`} fill="none" stroke={NEW_INK} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </g>;
}

function rebelPawn(): Figure {
  return {
    body: <>
      <Boot x={43} /><Boot x={57} />
      <path d="M35 101 L42.5 105.5 L50 101 L57.5 105.5 L65 101 Q67 84 61 76 Q50 71 39 76 Q33 84 35 101 Z" fill={GREEN} {...o} />
      <path d="M35 101 Q33.5 86 39 77 Q39.5 91 43 104.5 Z" fill={GREEN_SH} />
      <rect x="51" y="85" width="11" height="10" rx="1.5" fill={PATCH} {...f} transform="rotate(-10 56 90)" />
      <path d="M39 75 L27 70 L30 80 Z M39 76 L29 85 L38 84 Z" fill={RED} {...f} />
      <path d="M36.5 73.5 Q50 80 63.5 73.5 L52.5 91 Q50 93.5 47.5 91 Z" fill={RED} {...f} strokeWidth="3" />
      <path d="M38 75 Q44 78 47.5 79 L48.5 90.5 Q47 90.5 46.5 89 Z" fill={RED_SH} />
    </>,
    armBack: <><Sleeve d="M41 80 Q36 85 36 91" fill={GREEN} /><Mitt x={36} y={92} fill={SKIN} /></>,
    prop: <g className="prop">
      <Pole d="M61 106 L71 46" ink={6.8} fill={3.2} color={WOOD} />
      <g transform="rotate(9.5 71 46)">
        <Pole d="M60 24 L60 38 Q60 47 71 47 Q82 47 82 38 L82 24 M71 47 L71 22" ink={5.8} fill={2.6} color={RUST} />
        <rect x="67.5" y="45" width="7" height="7" rx="1.5" fill={RUST} {...f} />
      </g>
    </g>,
    armFront: <><Sleeve d="M59 80 Q64 83 66 86" fill={GREEN} front /><Mitt x={66.5} y={87} fill={SKIN} /></>,
    head: <>
      <circle cx="50" cy="65" r="13.5" fill={SKIN} {...o} strokeWidth="3.6" />
      <path d="M37 64 Q38 72 43.5 76.5 Q40.5 70 41 63 Z" fill={SKIN_SH} />
      <DotEyes y={67} gap={5.2} r={2.6} />
      <Squint y={67} gap={5.2} />
      <g transform="rotate(-5 50 54)">
        <Pole d="M28.5 49 Q21 48.5 21.5 55 Q22.5 60.5 28.5 58.5 M71.5 49 Q79 48.5 78.5 55 Q77.5 60.5 71.5 58.5" ink={6.4} fill={2.8} color={COPPER} />
        <path d="M26 59 Q25.5 55.5 29 55 L32 40 Q32.5 35.5 37 35.5 L39.5 35.5 L43 39.5 L46 35.5 L63 35.5 Q67.5 35.5 68 40 L71 55 Q74.5 55.5 74 59 Q50 62.5 26 59 Z" fill={COPPER} {...o} />
        <path d="M26 59 Q25.5 55.5 29 55 L32 40 Q32.5 35.5 37 35.5 L39.5 35.5 Q36.5 46 37.5 60.5 Q31 60 26 59 Z" fill={COPPER_SH} />
        <path d="M58 39.5 Q63 40.5 64 47" fill="none" stroke={HIGHLIGHT} strokeWidth="2.8" strokeLinecap="round" />
      </g>
    </>,
    mouths: null,
    propOrigin: "66px 87px", shield: [38, 90], mouth: [50, 70, 5],
  };
}

function patrolPawn(c: Palette, hue: PatrolHue): Figure {
  const [tunic, tunicSh] = hue === "blue" ? [BLUE, BLUE_SH] : [c.main, c.mainSh];
  return {
    body: <>
      <Boot x={42} /><Boot x={58} />
      <path d="M33 102 Q31 84 38 75 Q50 70 62 75 Q69 84 67 102 Q50 107 33 102 Z" fill={tunic} {...o} />
      <path d="M33 102 Q31.5 86 38 76 Q39 91 42 104.5 Q37 104 33 102 Z" fill={tunicSh} />
      <path d="M35 99 Q50 104 65 99" fill="none" stroke={GOLD} strokeWidth="3.4" strokeLinecap="round" />
      <path d="M38 75.5 Q50 81 62 75.5" fill="none" stroke={NEW_INK} strokeWidth="7.5" strokeLinecap="round" />
      <path d="M38 75.5 Q50 81 62 75.5" fill="none" stroke={GOLD} strokeWidth="3.6" strokeLinecap="round" />
    </>,
    armBack: <><Sleeve d="M39 80 Q34 86 35 92" fill={MAIL} /><path d="M27 83 Q26 70 38 70 Q46 72 45 83 Q36 88 27 83 Z" fill={tunic} {...f} strokeWidth="3.4" /><path d="M28.5 82 Q36 86.5 43.5 82" fill="none" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" /><Mitt x={35} y={93} fill={GLOVE} /></>,
    prop: <g className="prop">
      <Pole d="M62 106 L73.5 18" ink={6.2} fill={3} color={WOOD} />
      <g transform="rotate(7 73.5 18)">
        <path d="M73.5 -1 Q80.5 8 76 18 L71 18 Q66.5 8 73.5 -1 Z" fill={STEEL} {...f} strokeWidth="3" />
        <path d="M73.5 -1 Q68 8 71 18 L73.5 18 Z" fill={STEEL_SH} />
        <rect x="70" y="17" width="7" height="5" rx="1.5" fill={GOLD} {...f} />
      </g>
    </g>,
    armFront: <><Sleeve d="M60 80 Q65 83 67 86" fill={MAIL} front /><path d="M55 83 Q54 70 63 70 Q74 70 73 83 Q64 88 55 83 Z" fill={tunic} {...f} strokeWidth="3.4" /><path d="M56.5 82 Q64 86.5 71.5 82" fill="none" stroke={GOLD} strokeWidth="3.2" strokeLinecap="round" /><Mitt x={67.5} y={87} fill={GLOVE} /></>,
    head: <>
      <circle cx="50" cy="66" r="14" fill={SKIN} {...o} strokeWidth="3.6" />
      <path d="M37 66 Q38 75 45 79 Q41 72 41.5 64 Z" fill={SKIN_SH} />
      <path d="M42.5 62.3 L47.5 63.8 M57.5 62.3 L52.5 63.8" stroke={NEW_INK} strokeWidth="2.8" strokeLinecap="round" />
      <DotEyes y={66.8} gap={4.8} r={2.3} />
      <Squint y={66.8} gap={4.8} />
      <path d="M50 72 Q44.5 70 40 72.5 Q35 75 31.5 71 Q31 79 40 79 Q46.5 79 50 75.5 Q53.5 79 60 79 Q69 79 68.5 71 Q65 75 60 72.5 Q55.5 70 50 72 Z" fill={MOUSTACHE} {...f} strokeWidth="2.6" />
      <ellipse cx="50.5" cy="71" rx="3.2" ry="2.8" fill={SKIN} {...f} strokeWidth="2.2" />
      <path d="M40 37 Q39 20 50 18 Q61 20 60 37 Z" fill={STEEL} {...o} />
      <path d="M40 37 Q39 20 50 18 Q45 25 46 37 Z" fill={STEEL_SH} />
      <path d="M28 54 Q27 34 50 34 Q73 34 72 54 Z" fill={STEEL} {...o} />
      <path d="M28 54 Q27.5 36 43 34.5 Q35 43 37 54 Z" fill={STEEL_SH} />
      <path d="M22 40 Q28 51 40 52 L60 52 Q72 51 78 40 Q82 54 70 58.5 Q50 63 30 58.5 Q18 54 22 40 Z" fill={STEEL} {...o} />
      <path d="M23.5 50 Q34 59 50 59.5 Q66 59 76.5 50 Q74 57 68 58.5 Q50 62 32 58.5 Q26 56.5 23.5 50 Z" fill={STEEL_SH} />
      <path d="M58 38 Q64 39.5 66 46" fill="none" stroke={HIGHLIGHT} strokeWidth="2.8" strokeLinecap="round" />
    </>,
    mouths: null,
    propOrigin: "67px 87px", shield: [36, 90], mouth: [50, 70, 5],
  };
}

export function armourPawn(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelPawn() : patrolPawn(c, hue);
}
