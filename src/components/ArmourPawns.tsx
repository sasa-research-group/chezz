import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect, type Tone } from "./inkKit";

/** The pawns redrawn in the "armour does the talking" style (docs/art-style.md,
 * section 9), drawn only with the shape kit in inkKit.tsx. Same groups and
 * pivots as the old rigs, so the keyframes in rig.css drive them unchanged.
 * Both share one build: head r 14 at y 65, body x 34–66, feet at 108, and the
 * whole figure stays inside x 18–82. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 5.5} 108 Q${x - 5.5} 99 ${x} 99 Q${x + 6} 99 ${x + 6} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.4)} tone={tone} line="inner" shade={false} />;
const Sleeve = ({ d, tone, front }: { d: string; tone: Tone; front?: boolean }) =>
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

function rebelPawn(): Figure {
  return {
    body: <>
      <Boot x={41.5} tone={T.leatherDark} /><Boot x={58.5} tone={T.leatherDark} />
      <Part d="M35 100 L42.5 103 L50 100 L57.5 103 L65 100 Q67 84 61 76 Q50 71 39 76 Q33 84 35 100 Z" tone={T.shirtGreen} />
      <g transform="rotate(-10 56 91)"><Part d={rect(50.5, 86, 11, 10, 1.5)} tone={T.patchBlue} line="inner" shade={false} /></g>
      <Part d="M39 75 L26.5 70 L29.5 80.5 Z M39 76 L28.5 86 L38.5 84.5 Z" tone={T.bandana} line="inner" shade={false} />
      <Part d="M36.5 73.5 Q50 80 63.5 73.5 L52.5 91 Q50 93.5 47.5 91 Z" tone={T.bandana} line="inner" />
    </>,
    armBack: <><Sleeve d="M41 80 Q36 85 36 91" tone={T.shirtGreen} /><Mitt x={36} y={92} tone={T.skin} /></>,
    prop: <g className="prop">
      <Pole d="M71 105 L72.5 44" tone={T.wood} width={3.4} />
      <Pole d="M66.5 20 L66.5 37 Q66.5 45 72.5 45 Q78.5 45 78.5 37 L78.5 20 M72.5 45 L72.5 17" tone={T.rustySteel} width={2.6} />
      <Part d={rect(69, 43.5, 7, 6.5, 1.5)} tone={T.rustySteel} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d="M59 80 Q66 83.5 70.5 87" tone={T.shirtGreen} front /><g transform="rotate(25 64.5 83.5)"><Part d={rect(61, 80, 7, 7, 1.2)} tone={T.bandana} line="inner" shade={false} /></g><Mitt x={71.5} y={88} tone={T.skin} /></>,
    head: <>
      <Part d={circle(50, 65, 14)} tone={T.skin} />
      <Eyes y={67.5} gap={5.2} r={2.7} />
      <Squint y={67.5} gap={5.2} />
      <g transform="rotate(-4 50 50)">
        {["M33 47 Q27.5 47 27.5 51 Q27.5 55 33 55", "M67 47 Q72.5 47 72.5 51 Q72.5 55 67 55"].map(d => <Pole key={d} d={d} tone={T.copper} width={2.4} />)}
        <Part d="M34 54 L33.5 35.5 Q33.5 28 41 28 L59 28 Q66.5 28 66.5 35.5 L66 54 Z" tone={T.copper} highlight="M38.5 48 L38.5 36" />
        <Ink d="M56 33 Q60 36.5 58.5 42" weight="inner" />
        <Part d={rect(31.5, 52, 37, 8, 4)} tone={T.copper} />
      </g>
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
        <Part d="M72.5 0 Q78.5 8.5 75.5 17.5 L69.5 17.5 Q66.5 8.5 72.5 0 Z" tone={T.steel} line="inner" highlight="M70.5 12 Q70 8 72 4.5" />
        <Part d={rect(69, 16.5, 7, 5, 1.5)} tone={T.gold} line="inner" shade={false} />
      </g>
    </g>,
    armFront: <><Sleeve d="M67 89 Q67.5 92 66.5 95" tone={T.mail} front /><Pauldron x={67} tone={tunic} /><Mitt x={66} y={96} tone={T.leather} /></>,
    head: <>
      <Part d={circle(50, 65.5, 14)} tone={T.skin} />
      <Ink d="M42.5 61.5 L47.5 63.2 M57.5 61.5 L52.5 63.2" />
      <Eyes y={66.5} gap={4.8} r={2.4} />
      <Squint y={66.5} gap={4.8} />
      <Part d="M50 72 Q44.5 70 40 72.5 Q35 75 31.5 71 Q31 79 40 79 Q46.5 79 50 75.5 Q53.5 79 60 79 Q69 79 68.5 71 Q65 75 60 72.5 Q55.5 70 50 72 Z" tone={T.moustache} line="inner" />
      <Part d={ellipse(50.5, 71, 3.2, 2.8)} tone={T.skin} line="inner" shade={false} />
      <Part d="M45 38 Q45 25 50 22.5 Q55 25 55 38 Z" tone={T.steel} />
      <Part d="M31.5 55 Q30.5 35 50 34.5 Q69.5 35 68.5 55 Z" tone={T.steel} highlight="M38 45 Q39.5 40.5 43.5 38.5" />
      <Part d="M26.5 59.5 Q27 51.5 35 51.5 L65 51.5 Q73 51.5 73.5 59.5 Q72.5 62.5 68 61 Q50 57.5 32 61 Q27.5 62.5 26.5 59.5 Z" tone={T.steel} />
    </>,
    mouths: null,
    propOrigin: "66px 96px", shield: [36, 90], mouth: [50, 70, 5],
  };
}

export function armourPawn(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelPawn() : patrolPawn(c, hue);
}
