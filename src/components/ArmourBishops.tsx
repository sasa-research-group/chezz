import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Sleeve } from "./ArmourPawns";
import { Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect, type Tone } from "./inkKit";

/** The bishops redrawn in the "armour does the talking" style (docs/art-style.md),
 * drawn only with the shape kit. Same groups as the old bishop rig, so rig.css
 * drives them unchanged. Bishops are tall and slim, like the old rig: the mitre
 * peaks near y 4, a cowl or cape about 40–46 wide covers the shoulders, the robe
 * flares to a hem about 40–43 wide, and the crook rises beside the mitre inside
 * x 18–82. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 5.5} 108 Q${x - 5.5} 99 ${x} 99 Q${x + 6} 99 ${x + 6} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.4)} tone={tone} line="inner" shade={false} />;

const HAND: [number, number] = [73, 80];

/** The rebel crook's hook, continuing the shaft from (77.5, 24). It curls back
 * toward the mitre, which leaves it no room to open wider inside x 82. */
const HOOK_CURL = "C77.5 15 75.8 5.7 71.8 5.7 C68.3 5.7 66 8.5 66 11.5 C66 14.5 67.8 16 69.8 16";

function rebelBishop(): Figure {
  return {
    body: <>
      <Boot x={42} tone={T.leatherDark} /><Boot x={58} tone={T.leatherDark} />
      <Part d="M36 78 Q31 91 30 104 L35 101 L40 105 L45 101 L50 105 L55 101 L60 105 L65 101 L70 104 Q69 91 64 78 Z" tone={T.robeGrey} />
      <g transform="rotate(-8 45 93)"><Part d={rect(39.5, 88, 11, 10, 1.5)} tone={T.patchYellow} line="inner" shade={false} /></g>
      <Part d="M30 83 Q30.5 72 40 68 Q50 65 60 68 Q69.5 72 70 83 L65.5 80.5 L61 86 L56 81.5 L50 87 L44 81.5 L39 86 L34.5 80.5 Z" tone={T.cowl} />
    </>,
    armBack: <><Sleeve d="M38 80 Q28 83 31 91" tone={T.robeGrey} /><Mitt x={34} y={92} tone={T.skin} /></>,
    prop: <g className="prop">
      <Pole d={`M70 106 Q73 92 72.5 80 Q72 66 75 52 Q77.5 38 77.5 24 ${HOOK_CURL} M75.8 47 L77.8 44.5`} tone={T.wood} width={3.6} />
    </g>,
    armFront: <><Sleeve d={`M62 79 Q67 80 ${HAND[0] - 2} ${HAND[1]}`} tone={T.robeGrey} front /><Mitt x={HAND[0]} y={HAND[1]} tone={T.skin} /></>,
    head: <g transform="rotate(-4 50 74)">
      <Part d="M35.5 70 Q34 52 39.5 42 Q44.5 35 50 35 Q55.5 35 60.5 42 Q66 52 64.5 70 Q50 74 35.5 70 Z" tone={T.hood} />
      <Part d={ellipse(50, 56, 9, 10.5)} tone={T.void} line="inner" shade={false} />
      <g className="face">
        <g className="eyes">{[-4.6, 4.6].map(x => <g key={x} className="pupil"><Part d={circle(50 + x, 55, 2.8)} tone={T.glow} line="none" shade={false} /></g>)}</g>
        <g className="ko-eyes">{[-4.6, 4.6].map(x => <Pole key={x} d={`M${47.5 + x} ${52.5} L${52.5 + x} ${57.5} M${52.5 + x} ${52.5} L${47.5 + x} ${57.5}`} tone={T.glow} width={1.8} />)}</g>
      </g>
      <g className="mouth-yell">
        {[-4.6, 4.6].map(x => <Flat key={x} d={circle(50 + x, 55, 4)} fill={T.void.fill} />)}
        <Pole d="M42.5 53 L46.5 55 L42.5 57 M57.5 53 L53.5 55 L57.5 57" tone={T.glow} width={1.8} />
      </g>
      <Part d="M35.5 40 L36 25 Q38.5 15 43.5 9.5 Q47 18 48 40 Z" tone={T.parchment} />
      <Part d="M34 43 L34.5 26 Q38 14 51 4 Q63 13 65.5 27 L66 43 Q50 46.5 34 43 Z" tone={T.parchment} highlight="M38.5 36 L38.5 28 Q40 22 43 18.5" />
      <Part d="M47.5 42 L48 16 L51 9 L54 16 L54.5 42 Z" tone={T.mitreBand} line="inner" shade={false} />
      <Part d="M33.5 36 Q50 40 66.5 36 L66 43 Q50 46.5 34 43 Z" tone={T.mitreBand} line="inner" shade={false} />
    </g>,
    mouths: null,
    propOrigin: `${HAND[0]}px ${HAND[1]}px`, shield: [34, 84], mouth: [50, 62, 5],
  };
}

function patrolBishop(c: Palette, hue: PatrolHue): Figure {
  const robe: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  const lenses = [44.2, 55.8], hand: [number, number] = [72, 89];
  return {
    body: <>
      <Boot x={42} tone={T.leatherDark} /><Boot x={58} tone={T.leatherDark} />
      <Part d="M36 78 Q30 91 28.5 104 Q50 108.5 71.5 104 Q70 91 64 78 Z" tone={robe} highlight="M35.5 98 Q35.5 91 37.5 86" />
      <Pole d="M31.5 100.5 Q50 104.5 68.5 100.5" tone={T.gold} width={3.4} />
      <Pole d="M50 82 L50 101" tone={T.gold} width={4} />
      <Part d="M27 85 Q27.5 72 40 68 Q50 65 60 68 Q72.5 72 73 85 Q50 79 27 85 Z" tone={robe} highlight="M32 79 Q34 73.5 39 71" />
      <Pole d="M29.5 83.5 Q50 78 70.5 83.5" tone={T.gold} width={5} />
      <Part d={circle(50, 74, 3.6)} tone={T.gold} line="inner" shade={false} />
    </>,
    armBack: <><Sleeve d="M35 83 Q31 87 32.5 92" tone={robe} /><Mitt x={33.5} y={94} tone={T.glove} /></>,
    prop: <g className="prop">
      <Pole d="M71 106 L76.5 24" tone={T.steel} width={3.6} />
      <Pole d="M76.5 25 C76.5 11 73 6.5 68.5 6.5 C64 6.5 61.5 9.5 61.5 13 C61.5 16.5 64 18 66.5 17" tone={T.gold} width={4.4} />
      <Part d={circle(68.5, 13.5, 3.4)} tone={T.gold} line="inner" shade={false} />
      <Part d={ellipse(76, 30, 4.4, 3.6)} tone={T.gold} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d={`M64.5 83 Q67 86.5 ${hand[0] - 4} ${hand[1]}`} tone={robe} front /><Pole d={`M${hand[0] - 7.5} ${hand[1] + 1} L${hand[0] - 3} ${hand[1] - 2.5}`} tone={T.gold} width={3} /><Part d={circle(hand[0], hand[1], 6)} tone={T.glove} line="inner" shade={false} /><Ink d={`M${hand[0] + 1.5} ${hand[1] - 3.5} Q${hand[0] + 3} ${hand[1]} ${hand[0] + 1.5} ${hand[1] + 3.5}`} weight="inner" /></>,
    head: <>
      <Part d="M33.5 70 L33.5 42 L66.5 42 L66.5 70 Q50 74 33.5 70 Z" tone={T.helmSteel} highlight="M37.5 63 L37.5 66" />
      <Pole d="M50 61 L50 70.5" tone={T.gold} width={3.4} />
      <Pole d={`${circle(lenses[0], 54, 4.6)} ${circle(lenses[1], 54, 4.6)}`} tone={T.gold} width={2.6} />
      <g className="face">
        <g className="eyes">{lenses.map(x => <g key={x} className="pupil">
          <Flat d={circle(x, 54, 3.3)} fill={T.void.fill} />
          <Part d={circle(x, 54, 3.3)} tone={T.lens} line="none" shade={false} highlight={`M${x - 2.2} 53 Q${x - 2} 51 ${x - 0.5} 50.5`} />
        </g>)}</g>
        <g className="ko-eyes">{lenses.map(x => <Ink key={x} d={`M${x - 2.6} 51.4 L${x + 2.6} 56.6 M${x + 2.6} 51.4 L${x - 2.6} 56.6`} />)}</g>
      </g>
      <g className="mouth-yell">
        {lenses.map(x => <Flat key={x} d={circle(x, 54, 3.3)} fill={T.lens.fill} />)}
        <Ink d={lenses.map(x => `M${x - 3.2} 54.5 L${x + 3.2} 54.5`).join(" ")} />
      </g>
      <Part d="M31.5 43.5 Q30 21 50 3 Q70 21 68.5 43.5 Q50 47.5 31.5 43.5 Z" tone={T.gold} highlight="M37.5 35 Q37.5 24 43 16" />
      <Part d="M47 42 L47.5 15 L50 10 L52.5 15 L53 42 Z" tone={T.goldDeep} line="inner" shade={false} />
      <Part d="M31 37.5 Q50 41.5 69 37.5 L68.5 43.5 Q50 47.5 31.5 43.5 Z" tone={T.goldDeep} line="inner" shade={false} />
    </>,
    mouths: null,
    propOrigin: `${hand[0]}px ${hand[1]}px`, shield: [34, 84], mouth: [50, 62, 5],
  };
}

export function armourBishop(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelBishop() : patrolBishop(c, hue);
}
