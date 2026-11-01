import type { ReactNode } from "react";
import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, rect, type Tone } from "./inkKit";

/** The kings redrawn in the "armour does the talking" style (docs/art-style.md),
 * drawn only with the shape kit. Same groups as the old king rig, so rig.css
 * drives them unchanged; the crown is its own `.crown` group inside the head,
 * which the checkmate finale throws off. Kings have the widest crown and the
 * broadest build, but the crown tips stop near y 15: on a phone's 4×4 board
 * anything higher pokes above the board's frame from the top row. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 6} 108 Q${x - 6} 99 ${x} 99 Q${x + 6.5} 99 ${x + 6.5} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.6)} tone={tone} line="inner" shade={false} />;
const Sleeve = ({ d, tone }: { d: string; tone: Tone }) => <Pole d={d} tone={tone} width={6.4} />;

/** The back arm raises whole in the cheer; the front hand grips the sword, so it carries no arm class. */
const BackArm = ({ d, x, y, sleeve, hand }: { d: string; x: number; y: number; sleeve: Tone; hand: Tone }) =>
  <g className="arm arm-back"><Sleeve d={d} tone={sleeve} /><Mitt x={x} y={y} tone={hand} /></g>;

/** Two eye marks, KO crosses, and an effort squint drawn over a cover tone. */
function Face({ eyes, xs, y, cover }: { eyes: ReactNode; xs: number[]; y: number; cover: string }) {
  return <>
    <g className="face">
      <g className="eyes">{eyes}</g>
      <g className="ko-eyes">{xs.map(x => <Ink key={x} d={`M${x - 2.8} ${y - 2.8} L${x + 2.8} ${y + 2.8} M${x + 2.8} ${y - 2.8} L${x - 2.8} ${y + 2.8}`} />)}</g>
    </g>
    <g className="mouth-yell">
      {xs.map(x => <Flat key={x} d={rect(x - 4, y - 3.6, 8, 7.2, 2)} fill={cover} />)}
      <Ink d={`M${xs[0] - 3} ${y - 2.4} L${xs[0] + 1.8} ${y} L${xs[0] - 3} ${y + 2.4} M${xs[1] + 3} ${y - 2.4} L${xs[1] - 1.8} ${y} L${xs[1] + 3} ${y + 2.4}`} />
    </g>
  </>;
}

const REBEL_HAND: [number, number] = [71, 90];

function rebelKing(): Figure {
  const [hx, hy] = REBEL_HAND;
  return {
    back: <g className="cape">
      <Part d="M30 66 Q22 84 21 106 L27 103.5 L31 107.5 Q50 110 69 107.5 L73.5 103 L79 106 Q78 84 70 66 Z" tone={T.crimson} />
      <g transform="rotate(-10 27 94)"><Part d={rect(22.5, 89, 9, 9, 1.4)} tone={T.leather} line="inner" shade={false} /></g>
    </g>,
    body: <>
      <Boot x={42} tone={T.leatherDark} /><Boot x={58} tone={T.leatherDark} />
      <Part d="M37 70 Q35 88 36 104 Q50 107 64 104 Q65 88 63 70 Z" tone={T.patchBlue} />
      <Pole d="M37 96 Q50 99 63 96" tone={T.leatherDark} width={4} />
      <Part d={rect(46.5, 94.5, 7, 6, 1)} tone={T.gold} line="inner" shade={false} />
      <Part d="M29 70 Q25.5 88 26.5 105 L39.5 104 Q38 86 42 72 Z" tone={T.crimson} />
      <Part d="M71 70 Q74.5 88 73.5 105 L60.5 104 Q62 86 58 72 Z" tone={T.crimson} />
      <Part d="M20.5 79 Q19.5 67 30 62 Q42 58 50 59 Q58 58 70 62 Q80.5 67 79.5 79 L75 76 L71 82 L66 77.5 L50 79 L34 77.5 L29 82 L25 76 Z" tone={T.fur} />
    </>,
    armBack: <BackArm d="M36 74 Q29 80 30 88" x={30.5} y={91} sleeve={T.crimson} hand={T.skin} />,
    prop: <g className="prop">
      <Pole d={`M${hx - 1.2} ${hy + 8} L${hx + 1.5} ${hy - 18}`} tone={T.leather} width={4} />
      <Part d="M68.2 78.8 L70.3 38 L75 29.5 L78.9 38 L78.44 47 L75.4 49.5 L78.19 52 L77.73 61 L75.2 63.2 L77.47 66 L76.8 79.2 Z" tone={T.steel} highlight="M70.6 72 L72 42" />
      <Part d="M64 69.5 L79.5 65.5 L80 72 L64.5 76 Z" tone={T.gold} line="inner" shade={false} />
      <Part d={circle(hx - 1.6, hy + 9.5, 3.4)} tone={T.gold} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d={`M63 80 Q67 83 ${hx - 1.5} ${hy - 2}`} tone={T.patchBlue} /><Mitt x={hx} y={hy} tone={T.skin} /></>,
    head: <>
      <Part d="M34 34 L29.5 41 L31.5 46 L27 52 L31.5 57 L30.5 63 L35 67.5 L35.5 74 L39.5 77.5 L43.5 83 L47 79 L50 85.5 L53 79 L56.5 83 L60.5 77.5 L64.5 74 L65 67.5 L69.5 63 L68.5 57 L72.5 52 L68.5 46 L70.5 41 L66 34 Z" tone={T.beard} />
      <Part d="M38.5 33 L61.5 33 L61.5 46 Q50 48.5 38.5 46 Z" tone={T.skin} line="inner" shade={false} />
      <Face xs={[44.6, 55.4]} y={42} cover={T.skin.fill} eyes={[44.6, 55.4].map(x => <g key={x} className="pupil"><Dot cx={x} cy={42} r={2.6} /></g>)} />
      <Part d="M35 49.5 Q42 43.5 50 46.5 Q58 43.5 65 49.5 Q58 54.5 50 51 Q42 54.5 35 49.5 Z" tone={T.beard} line="inner" shade={false} />
      <g className="crown"><g transform="rotate(-4 50 30)">
        <Part d="M31.5 37 L30 19 L40.5 26.5 L50 17 L59.5 26.5 L70 19 L68.5 37 Z" tone={T.gold} highlight="M34 32.5 L33.6 25.5" />
        <Part d={rect(31.2, 30, 37.6, 7, 1)} tone={T.goldDeep} line="inner" shade={false} />
        <Part d="M50 28 L53.6 32 L50 36 L46.4 32 Z" tone={T.bandana} line="inner" shade={false} />
        {[39, 61].map(x => <Part key={x} d={circle(x, 33.5, 2.3)} tone={T.neckerchief} line="none" shade={false} />)}
      </g></g>
    </>,
    mouths: null,
    propOrigin: `${hx}px ${hy}px`, shield: [32, 86], mouth: [50, 62, 5],
  };
}

const PATROL_HAND: [number, number] = [71, 88];

function patrolKing(c: Palette, hue: PatrolHue): Figure {
  const robe: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  const [hx, hy] = PATROL_HAND, slits = [44.2, 55.8];
  return {
    body: <>
      <Boot x={42} tone={T.leatherDark} /><Boot x={58} tone={T.leatherDark} />
      <Part d={rect(42, 52, 16, 20, 3)} tone={T.mail} line="inner" shade={false} />
      <Part d="M35 70 Q28 88 27 104 Q50 109 73 104 Q72 88 65 70 Z" tone={robe} highlight="M32.5 98 Q32.5 90 35 84" />
      <Pole d="M30 101.5 Q50 106 70 101.5" tone={T.gold} width={3.4} />
      <Pole d="M50 82 L50 103" tone={T.gold} width={4.4} />
      <Part d="M26 84 Q25 70 38 65.5 Q50 62 62 65.5 Q75 70 74 84 Q68 87 62 82 Q56 86 50 82 Q44 86 38 82 Q32 87 26 84 Z" tone={T.gold} highlight="M30 77 Q31.5 71 36.5 68" />
    </>,
    armBack: <BackArm d="M35 80 Q30 85 31 91" x={31.5} y={93} sleeve={robe} hand={T.skin} />,
    prop: <g className="prop">
      <Pole d={`M${hx - 1.2} ${hy + 8} L${hx + 1} ${hy - 6}`} tone={T.leather} width={4} />
      <Part d="M68.2 79.7 L70.7 38 L75.5 30 L79.3 38 L76.8 80.3 Z" tone={T.steel} highlight="M70.6 73 L72.2 43" />
      <Pole d="M62.5 82 Q61.5 78.5 64.5 79 L77 76 Q78.5 72.5 76.5 72.5" tone={T.gold} width={3.6} />
      <Part d={circle(hx - 1.7, hy + 10, 3.4)} tone={T.gold} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d={`M63 80 Q67 84 ${hx - 2} ${hy - 1}`} tone={robe} /><Mitt x={hx} y={hy} tone={T.skin} /></>,
    head: <>
      <Part d="M35 33 Q28 40 30.5 47 Q26 53 29.5 59.5 Q33.5 64 38.5 61 L61.5 61 Q66.5 64 70.5 59.5 Q74 53 69.5 47 Q72 40 65 33 Z" tone={T.moustache} />
      <Part d="M37 34 L63 34 Q64.5 50 61.5 57 Q57 67 50 67.5 Q43 67 38.5 57 Q35.5 50 37 34 Z" tone={T.mask} highlight="M40 54 Q38.8 48 39.4 42" />
      <Face xs={slits} y={46} cover={T.mask.fill} eyes={slits.map(x => <g key={x} className="pupil"><Ink d={`M${x - 4} 47 Q${x} 43.4 ${x + 4} 47`} /></g>)} />
      <Part d="M50 51.5 Q44 49 39.5 52.5 Q36 56 33 52.5 Q33.5 59.5 40 58.5 Q46 57.5 50 55 Q54 57.5 60 58.5 Q66.5 59.5 67 52.5 Q64 56 60.5 52.5 Q56 49 50 51.5 Z" tone={T.moustache} line="inner" shade={false} />
      <Part d="M46.5 60 L53.5 60 L50 67.5 Z" tone={T.moustache} line="inner" shade={false} />
      <g className="crown">
        <Part d="M31.5 38.5 L30.5 24 L40.5 30 L50 21.5 L59.5 30 L69.5 24 L68.5 38.5 Z" tone={T.gold} highlight="M34 34.5 L33.7 29" />
        {[[30.5, 22.5], [50, 19.5], [69.5, 22.5]].map(([x, y]) => <Part key={x} d={circle(x, y, 3.2)} tone={T.gold} line="inner" shade={false} />)}
        <Part d="M50 29.5 L54 34.5 L50 39.5 L46 34.5 Z" tone={T.neckerchief} line="inner" shade={false} />
      </g>
    </>,
    mouths: null,
    propOrigin: `${hx}px ${hy}px`, shield: [32, 86], mouth: [50, 62, 5],
  };
}

export function armourKing(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelKing() : patrolKing(c, hue);
}
