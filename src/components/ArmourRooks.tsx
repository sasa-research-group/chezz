import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Sleeve } from "./ArmourPawns";
import { Flat, INK, Ink, Part, Pole, TONES as T, circle, rect, type Tone } from "./inkKit";

/** The rooks redrawn in the "armour does the talking" style (docs/art-style.md),
 * drawn only with the shape kit. Same groups and pivots as the old rook rig, so
 * rig.css drives them unchanged, including the `.door` that drops over the face
 * from y 22 when the rook defends. Rooks are the big pieces: helm top at y 12,
 * body about 44 wide, against the pawns' 32; the figure stays inside x 18–82. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 7} 108 Q${x - 7} 98 ${x} 98 Q${x + 7.5} 98 ${x + 7.5} 108 Z`} tone={tone} shade={false} />;
const Fist = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 6.2)} tone={tone} line="inner" shade={false} />;

/** Three merlons with two 8-wide, 8-deep crenels across w units from x at the
 * top y. Narrower crenels close up under the outline at 48px. */
function battlements(x: number, y: number, w: number) {
  const m = (w - 16) / 3, xs = [x, x + m, x + m + 8, x + 2 * m + 8, x + 2 * m + 16, x + w];
  return xs.map((at, i) => i === 0 || i === 5 ? `L${at} ${y}` : `L${at} ${i % 2 ? y : y + 8} L${at} ${i % 2 ? y + 8 : y}`).join(" ");
}

/** The stonemason's stone mallet: a chipped block at `head`, its shaft running
 * through the fist at `hand` and a little past it. */
function Mallet({ head: [hx, hy], hand: [fx, fy] }: { head: [number, number]; hand: [number, number] }) {
  const deg = Math.atan2(fy - hy, fx - hx) * 180 / Math.PI, len = Math.hypot(fx - hx, fy - hy) + 6;
  return <g transform={`translate(${hx} ${hy}) rotate(${deg.toFixed(1)})`}>
    <Pole d={`M0 0 L${len.toFixed(1)} 0`} tone={T.wood} width={4} />
    <Part d="M-7.5 -11 L7.5 -11 L7.5 11 L-2 11 L-7.5 5.5 Z" tone={T.darkStone} highlight="M-3 -7 L-3 2" />
  </g>;
}

/** A rebel's dot eyes glowing in a dark slot: light dots, light KO crosses, light squint chevrons. */
function SlotEyes({ y, gap }: { y: number; gap: number }) {
  return <>
    <g className="face">
      <g className="eyes">{[-gap, gap].map(x => <g key={x} className="pupil"><Part d={circle(50 + x, y, 2.5)} tone={T.parchment} line="none" shade={false} /></g>)}</g>
      <g className="ko-eyes">{[-gap, gap].map(x => <Pole key={x} d={`M${47.5 + x} ${y - 2.5} L${52.5 + x} ${y + 2.5} M${52.5 + x} ${y - 2.5} L${47.5 + x} ${y + 2.5}`} tone={T.parchment} width={1.8} />)}</g>
    </g>
    <g className="mouth-yell">
      {[-gap, gap].map(x => <Flat key={x} d={circle(50 + x, y, 3.4)} fill={INK} />)}
      <Pole d={`M${46.5 - gap} ${y - 2.5} L${51.5 - gap} ${y} L${46.5 - gap} ${y + 2.5} M${53.5 + gap} ${y - 2.5} L${48.5 + gap} ${y} L${53.5 + gap} ${y + 2.5}`} tone={T.parchment} width={1.8} />
    </g>
  </>;
}

function rebelRook(): Figure {
  return {
    body: <>
      <Boot x={40} tone={T.leatherDark} /><Boot x={60} tone={T.leatherDark} />
      <Part d="M29.5 101 L35.5 104.5 L41.5 100.5 L47.5 104.5 L53.5 100.5 L59.5 104.5 L65.5 100.5 L70.5 102 Q74.5 85 69 71.5 Q50 65 31 71.5 Q25.5 85 29.5 101 Z" tone={T.shirtGreen} />
      <g transform="rotate(-8 39.5 85)"><Part d={rect(33.5, 80, 12, 11, 1.5)} tone={T.leather} line="inner" shade={false} /></g>
      <g transform="rotate(6 60.5 96)"><Part d={rect(54.5, 91.5, 12, 9.5, 1.5)} tone={T.wood} line="inner" shade={false} /></g>
      <Part d="M31.5 67.5 Q50 75.5 68.5 67.5 L54 87.5 Q50 91 46 87.5 Z" tone={T.bandana} line="inner" />
    </>,
    armBack: <>
      <Part d="M38 73 Q23.5 71 21.5 84 Q20.5 92 25.5 94.5 Q31 96 32 90.5 Q33 84 38 81 Z" tone={T.skin} />
      <Fist x={26.5} y={95.5} tone={T.skin} />
    </>,
    prop: <g className="prop">
      <Mallet head={[67.5, 47]} hand={[74.5, 90]} />
    </g>,
    armFront: <>
      <Part d="M62 73 Q76 70.5 78.5 83 Q79.5 90.5 75 92.5 Q70 93.5 69 88.5 Q68 83 62 81 Z" tone={T.skin} />
      <Fist x={74.5} y={90} tone={T.skin} />
    </>,
    head: <>
      <Part d="M36 64.5 L37 30 L63 30 L64 64.5 Q50 68 36 64.5 Z" tone={T.stone} highlight="M40 54 L40 58" />
      <Part d={`M32 30 ${battlements(32, 12, 36)} L68 30 Q65 34 62.5 34 L37.5 34 Q35 34 32 30 Z`} tone={T.stone} highlight="M35 17 L35 25" />
      <Part d="M41.5 37 L58.5 37 L58.5 49 L41.5 49 Z" tone={T.void} line="inner" shade={false} />
      <SlotEyes y={43} gap={4.4} />
      <g className="door">
        <Part d={rect(37.5, 23, 25, 40, 2)} tone={T.wood} />
        <Ink d="M45.5 26 L45.5 60 M54.5 26 L54.5 60" weight="inner" />
        <Pole d="M39 31 L61 31 M39 54 L61 54" tone={T.rustySteel} width={2.6} />
      </g>
    </>,
    mouths: null,
    propOrigin: "74.5px 90px", shield: [27, 92], mouth: [50, 50, 5],
  };
}

/** A big domed shoulder plate with a gold rim. */
const Pauldron = ({ x, tone }: { x: number; tone: Tone }) => <>
  <Part d={`M${x - 12} 84 Q${x - 13} 63 ${x} 63 Q${x + 13} 63 ${x + 12} 84 Q${x} 88.5 ${x - 12} 84 Z`} tone={tone} highlight={`M${x - 7.5} 78 Q${x - 7} 72 ${x - 2.5} 70`} />
  <Pole d={`M${x - 10.5} 84.5 Q${x} 88 ${x + 10.5} 84.5`} tone={T.gold} width={3} />
</>;

function patrolRook(c: Palette, hue: PatrolHue): Figure {
  const plate: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  return {
    body: <>
      <Boot x={40} tone={T.steel} /><Boot x={60} tone={T.steel} />
      <Part d="M30 100.5 Q27 84 33 72 Q50 66 67 72 Q73 84 70 100.5 Q50 105.5 30 100.5 Z" tone={plate} highlight="M37 92 Q36 84 39 78" />
      <Pole d="M32 96.5 Q50 101 68 96.5" tone={T.gold} width={3.4} />
      <Pole d="M50 76 L50 94" tone={T.gold} width={2.6} />
      <Pauldron x={32} tone={plate} />
    </>,
    armBack: <><Sleeve d="M27 84 Q25 89 26 94" tone={T.mail} /><Fist x={26} y={95} tone={T.steel} /></>,
    prop: <g className="prop">
      <Pole d="M67.5 106 L74 6" tone={T.wood} width={3.4} />
      <Part d="M74 -1 Q77 3 76.5 7 L71.5 7 Q71 3 74 -1 Z" tone={T.steel} line="inner" shade={false} />
      <Part d="M75 5 Q80 5 81.5 1.5 Q85 14 81 26 Q79 22 75 21.5 Z" tone={T.steel} highlight="M78 9 L78 17" />
      <Part d="M73 8.5 L64.5 5.5 Q67 12 73 15.5 Z" tone={T.steel} line="inner" shade={false} />
      <Part d={rect(70, 22, 8, 5.5, 1.5)} tone={T.gold} line="inner" shade={false} />
    </g>,
    armFront: <><Sleeve d="M70 84 Q71.5 88.5 69.5 93" tone={T.mail} front /><Pauldron x={68} tone={plate} /><Fist x={69} y={94} tone={T.steel} /></>,
    head: <>
      <Part d={`M32 64 ${battlements(32, 12, 36)} L68 64 Q50 71 32 64 Z`} tone={T.helmSteel} highlight="M36 26 L36 40" />
      <Part d="M46.5 29 L53.5 29 L53.5 35 L63 35 L63 47.5 L53.5 47.5 L53.5 60 L46.5 60 L46.5 47.5 L37 47.5 L37 35 L46.5 35 Z" tone={T.gold} line="inner" />
      <g className="face">
        <g className="eyes">{[-1, 1].map(s => <g key={s} className="pupil"><Part d={rect(s < 0 ? 39.5 : 54, 38.5, 6.5, 5.5, 1)} tone={T.void} line="none" shade={false} /></g>)}</g>
        <g className="ko-eyes"><Ink d="M40.5 37.5 L45.5 44.5 M45.5 37.5 L40.5 44.5 M54.5 37.5 L59.5 44.5 M59.5 37.5 L54.5 44.5" /></g>
      </g>
      <g className="mouth-yell">
        <Flat d={rect(39, 38.5, 8, 5.5)} fill={T.gold.fill} /><Flat d={rect(53, 38.5, 8, 5.5)} fill={T.gold.fill} />
        <Ink d="M39.5 39 L46 43 M60.5 39 L54 43" />
      </g>
      <g className="door">
        <Part d={rect(35, 23, 30, 39, 2)} tone={T.mail} line="outer" />
        <Pole d="M42 25 L42 60 M50 25 L50 60 M58 25 L58 60 M37 35 L63 35 M37 49 L63 49" tone={T.steel} width={2.4} />
      </g>
    </>,
    mouths: null,
    propOrigin: "69px 94px", shield: [26, 92], mouth: [50, 50, 5],
  };
}

export function armourRook(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelRook() : patrolRook(c, hue);
}
