import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, rect, type Tone } from "./inkKit";

/** The pawns redrawn in the "armour does the talking" style (docs/art-style.md,
 * section 9), drawn only with the shape kit in inkKit.tsx. Same groups and
 * pivots as the old rigs, so the keyframes in rig.css drive them unchanged.
 * Both share one build: head r 14 at y 65, body x 34–66, feet at 108, and the
 * whole figure stays inside x 18–82. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 5.5} 108 Q${x - 5.5} 99 ${x} 99 Q${x + 6} 99 ${x + 6} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.4)} tone={tone} line="inner" shade={false} />;
export const Sleeve = ({ d, tone, front }: { d: string; tone: Tone; front?: boolean }) =>
  <Pole className={`arm ${front ? "arm-front" : "arm-back"}`} d={d} tone={tone} width={6.4} />;

/** Two dot eyes, KO crosses for death, and an effort squint where the old rigs yell. */
function Eyes({ y, gap, r }: { y: number; gap: number; r: number }) {
  return <g className="face">
    <g className="eyes">{[-gap, gap].map(x => <g key={x} className="pupil"><Dot cx={50 + x} cy={y} r={r} /></g>)}</g>
    <g className="ko-eyes">{[-gap, gap].map(x => <Ink key={x} d={`M${47 + x} ${y - 3} L${53 + x} ${y + 3} M${53 + x} ${y - 3} L${47 + x} ${y + 3}`} />)}</g>
  </g>;
}
function Squint({ y, gap }: { y: number; gap: number }) {
  return <g className="mouth-yell">
    {[-gap, gap].map(x => <Flat key={x} d={circle(50 + x, y, 3.8)} fill={T.skin.fill} />)}
    <Ink d={`M${46 - gap} ${y - 3} L${51 - gap} ${y} L${46 - gap} ${y + 3} M${54 + gap} ${y - 3} L${49 + gap} ${y} L${54 + gap} ${y + 3}`} />
  </g>;
}

/** A straight bar from (x1, y1) to (x2, y2), w1 half-wide at the start and w2
 * at the end, which is rounded. */
function bar(x1: number, y1: number, x2: number, y2: number, w1: number, w2: number) {
  const len = Math.hypot(x2 - x1, y2 - y1), px = (y1 - y2) / len, py = (x2 - x1) / len;
  const at = (x: number, y: number, w: number) => `${(x + px * w).toFixed(2)} ${(y + py * w).toFixed(2)}`;
  return `M${at(x1, y1, w1)} L${at(x2, y2, w2)} A${w2} ${w2} 0 0 0 ${at(x2, y2, -w2)} L${at(x1, y1, -w1)} Z`;
}

/** The rebel pawn's dented copper saucepan, worn upside down with its long
 * handle out the back. Every rebel pawn skin wears this same component, so
 * restyling it restyles them all. Lip at y 50.5–56.5, top at y 34; the handle's
 * end stays inside x 18 when the rig is drawn facing right, and the rig's
 * mirror puts it behind the head either way. */
export function RebelPot() {
  return <g transform="rotate(-4 50 50)">
    <Part d={bar(41, 46, 26.5, 42.5, 4.2, 5)} tone={T.copper} highlight="M36 41.3 L29 39.8" />
    <Dot cx={26.5} cy={42.5} r={2} />
    <Part d="M38 52.5 L38 39.5 Q38 34 43.5 34 L62.5 34 Q68 34 68 39.5 L68 52.5 Z" tone={T.copper} highlight="M43 48 L43 39.5" />
    <Ink d="M59.5 38 Q63.5 41 62.5 46.5" weight="inner" />
    <Part d={rect(35.5, 50.5, 35, 6, 3)} tone={T.copperLight} shade={false} highlight="M39 52.5 L47 52.5" />
  </g>;
}

/** Where the rebel pawn's sleeves run and its hands sit. A skin that draws its
 * own arms keeps these, so the prop pivot and the shield still line up. */
export const PAWN_ARMS = {
  back: "M41 80 Q36 85 36 91", backHand: [36, 92],
  front: "M59 80 Q66 83.5 70.5 87", frontHand: [71.5, 88],
} as const;

/** The tones a skin may swap on a rebel body: cloth (shirt and sleeves), the
 * accent (neckerchief and cuff), the patch, boots and hands. */
export type BodyLook = { cloth: Tone; accent: Tone; patch: Tone; boot: Tone; hand: Tone };
const REBEL_PAWN_LOOK: BodyLook = { cloth: T.shirtGreen, accent: T.bandana, patch: T.patchBlue, boot: T.leatherDark, hand: T.skin };

function rebelPawn(look: Partial<BodyLook> = {}): Figure {
  const l = { ...REBEL_PAWN_LOOK, ...look };
  return {
    body: <>
      <Boot x={41.5} tone={l.boot} /><Boot x={58.5} tone={l.boot} />
      <Part d="M35 100 L42.5 103 L50 100 L57.5 103 L65 100 Q67 84 61 76 Q50 71 39 76 Q33 84 35 100 Z" tone={l.cloth} />
      <g transform="rotate(-10 56 91)"><Part d={rect(50.5, 86, 11, 10, 1.5)} tone={l.patch} line="inner" shade={false} /></g>
      <Part d="M39 75 L26.5 70 L29.5 80.5 Z M39 76 L28.5 86 L38.5 84.5 Z" tone={l.accent} line="inner" shade={false} />
      <Part d="M36.5 73.5 Q50 80 63.5 73.5 L52.5 91 Q50 93.5 47.5 91 Z" tone={l.accent} line="inner" />
    </>,
    armBack: <><Sleeve d={PAWN_ARMS.back} tone={l.cloth} /><Mitt x={PAWN_ARMS.backHand[0]} y={PAWN_ARMS.backHand[1]} tone={l.hand} /></>,
    prop: <g className="prop">
      <Pole d="M71 105 L72 44" tone={T.wood} width={3.4} />
      <Pole d="M66 20 L66 37 Q66 45 72 45 Q78 45 78 37 L78 20 M72 45 L72 17" tone={T.rustySteel} width={2.6} />
      <Part d={rect(68.5, 43.5, 7, 6.5, 1.5)} tone={T.rustySteel} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d={PAWN_ARMS.front} tone={l.cloth} front /><g transform="rotate(25 64.5 83.5)"><Part d={rect(61, 80, 7, 7, 1.2)} tone={l.accent} line="inner" shade={false} /></g><Mitt x={PAWN_ARMS.frontHand[0]} y={PAWN_ARMS.frontHand[1]} tone={l.hand} /></>,
    head: <>
      <Part d={circle(50, 65, 14)} tone={T.skin} />
      <Eyes y={67.5} gap={5.2} r={2.7} />
      <Squint y={67.5} gap={5.2} />
      <RebelPot />
    </>,
    mouths: null,
    propOrigin: "71.5px 88px", shield: [38, 90], mouth: [50, 70, 5],
  };
}

/** A solid rounded shoulder cap with a gold edge. */
const Pauldron = ({ x, tone }: { x: number; tone: Tone }) => <>
  <Part d={`M${x - 10.5} 88 Q${x - 11.5} 74 ${x} 74 Q${x + 11.5} 74 ${x + 10.5} 88 Q${x} 92 ${x - 10.5} 88 Z`} tone={tone} highlight={`M${x - 6.5} 83 Q${x - 6} 79 ${x - 2.5} 78`} />
  <Pole d={`M${x - 9} 88.2 Q${x} 91.6 ${x + 9} 88.2`} tone={T.gold} width={3} />
</>;

function patrolPawn(c: Palette, hue: PatrolHue): Figure {
  const tunic: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  return {
    body: <>
      <Boot x={41.5} tone={T.leatherDark} /><Boot x={58.5} tone={T.leatherDark} />
      <Part d="M34 102 Q32 84 38 75 Q50 70 62 75 Q68 84 66 101 Q50 104 34 101 Z" tone={tunic} />
      <Pole d="M36 97.5 Q50 101.5 64 97.5" tone={T.gold} width={3.4} />
      <Pole d="M39 76 Q50 81 61 76" tone={T.gold} width={3.4} />
      <Pauldron x={33} tone={tunic} />
    </>,
    armBack: <><Sleeve d="M36 82 Q33 88 34 93" tone={T.mail} /><Mitt x={34} y={94} tone={T.leather} /></>,
    prop: <g className="prop">
      <Pole d="M63 105 L72.5 17" tone={T.wood} width={3.2} />
      <g transform="rotate(6 72.5 17)">
        <Part d="M72.5 2 Q78.5 9.5 75.5 17.5 L69.5 17.5 Q66.5 9.5 72.5 2 Z" tone={T.steel} line="inner" highlight="M70.5 12 Q70 8.5 72 6" />
        <Part d={rect(69, 16.5, 7, 5, 1.5)} tone={T.gold} line="inner" shade={false} />
      </g>
    </g>,
    armFront: <><Sleeve d="M67 89 Q67.5 92 66.5 95" tone={T.mail} front /><Pauldron x={67} tone={tunic} /><Mitt x={66} y={96} tone={T.leather} /></>,
    head: <>
      <Part d={circle(50, 65.5, 14)} tone={T.skin} />
      <Ink d="M42.5 61.5 L47.5 63.2 M57.5 61.5 L52.5 63.2" />
      <Eyes y={66.5} gap={4.8} r={2.4} />
      <Squint y={66.5} gap={4.8} />
      <Part d="M45 38 Q45 25 50 22.5 Q55 25 55 38 Z" tone={T.steel} />
      <Part d="M31.5 55 Q30.5 35 50 34.5 Q69.5 35 68.5 55 Z" tone={T.steel} highlight="M38 45 Q39.5 40.5 43.5 38.5" />
      <Part d="M26.5 59.5 Q27 51.5 35 51.5 L65 51.5 Q73 51.5 73.5 59.5 Q72.5 62.5 68 61 Q50 57.5 32 61 Q27.5 62.5 26.5 59.5 Z" tone={T.steel} />
    </>,
    mouths: null,
    propOrigin: "66px 96px", shield: [36, 90], mouth: [50, 70, 5],
  };
}

export function armourPawn(rebel: boolean, c: Palette, hue: PatrolHue, look?: Partial<BodyLook>): Figure {
  return rebel ? rebelPawn(look) : patrolPawn(c, hue);
}
