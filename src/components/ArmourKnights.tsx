import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Sleeve } from "./ArmourPawns";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, rect, type Tone } from "./inkKit";

/** The knights redrawn in the "armour does the talking" style (docs/art-style.md),
 * drawn only with the shape kit. Same group names as the old knight rig (each
 * passes its own prop pivot), so rig.css drives them unchanged, including the knight's flip hop, leap and
 * leap-back. Knights stand about as tall as the rooks (top near y 6–20) with a
 * medium build; the horse head is the chess crest and sits on the facing side,
 * clear of the helm. Everything stays inside x 18–82. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 6} 108 Q${x - 6} 99 ${x} 99 Q${x + 6.5} 99 ${x + 6.5} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.6)} tone={tone} line="inner" shade={false} />;

/** Two dot eyes over a cover tone, so the squint can hide them on its own colour. */
function Eyes({ xs, y, r, cover }: { xs: number[]; y: number; r: number; cover: string }) {
  return <>
    <g className="face">
      <g className="eyes">{xs.map(x => <g key={x} className="pupil"><Dot cx={x} cy={y} r={r} /></g>)}</g>
      <g className="ko-eyes">{xs.map(x => <Ink key={x} d={`M${x - 2.8} ${y - 2.8} L${x + 2.8} ${y + 2.8} M${x + 2.8} ${y - 2.8} L${x - 2.8} ${y + 2.8}`} />)}</g>
    </g>
    <g className="mouth-yell">
      {xs.map(x => <Flat key={x} d={circle(x, y, r + 1)} fill={cover} />)}
      <Ink d={`M${xs[0] - 3} ${y - 2.6} L${xs[0] + 1.6} ${y} L${xs[0] - 3} ${y + 2.6} M${xs[1] + 3} ${y - 2.6} L${xs[1] - 1.6} ${y} L${xs[1] + 3} ${y + 2.6}`} />
    </g>
  </>;
}

/** The rebel's carved wooden horse head and neck, its neck ending near (64, 88).
 * Shared with the empty knight skin, which sets it on a rocking horse. */
export function RebelHorseHead() {
  return <>
    <Part d="M64.5 42 L66 32.5 L70 41 Z" tone={T.leather} line="inner" shade={false} />
    <Part d="M59 88 Q57.5 78 58 70 Q57 60 58.5 52 Q59.5 46 62 43 L61.5 33.5 L67.5 40.5 Q73.5 41 77 45.5 L79 52 Q80 59 77.5 62 Q75 64.5 70.5 64 Q68 69 68.5 74 Q69.5 80 70 83 Q70 88 65.5 89 Z" tone={T.wood} highlight="M61.5 66 Q61 58 62.5 52" />
    <Flat d="M61 40 Q63 36 66.5 38.5 Q64.5 42 66.5 46 Q63.5 48 65 53 Q62 55.5 63.5 60.5 Q60.5 63 61.5 68 Q59 71 59.5 76 Q57.5 60 61 40 Z" fill={T.leatherDark.fill} />
    <Flat d="M71.5 43 L74.5 43.5 L76.5 63.5 L73 64 Z" fill={T.leatherDark.fill} />
    <Flat d="M67 55 L73 52.5 L73.5 55.5 L67.5 58 Z" fill={T.leatherDark.fill} />
    <Dot cx={68} cy={48.5} r={2.3} />
    <Dot cx={78} cy={57} r={1.4} />
  </>;
}

/** The wooden hobby horse: a carved head on a stick. The rebel holds it by the
 * neck at `HOBBY_HAND`; the stick runs down between his legs to the ground behind. */
const HOBBY_HAND = [64.5, 86] as const;
function HobbyHorse() {
  return <g className="prop">
    <Pole d="M24 106 L67 84" tone={T.wood} width={3.6} />
    <RebelHorseHead />
  </g>;
}

function rebelKnight(): Figure {
  return {
    body: <>
      <Part d={rect(33, 54, 16, 18, 3)} tone={T.skin} line="inner" shade={false} />
      <Boot x={37} tone={T.leatherDark} /><Boot x={53} tone={T.leatherDark} />
      <Part d="M29 101 Q26 84 32 72 Q44.5 66 57 72 Q63 84 60 101 Q44.5 106 29 101 Z" tone={T.leather} />
      <Part d="M48 70 Q52 70 54 71 L54 102.5 Q51 103 48 103 Z" tone={T.parchment} line="inner" shade={false} />
      <Pole d="M30 93.5 Q44.5 98 59.5 93.5" tone={T.leatherDark} width={3.4} />
      <Part d="M34 72 L22.5 67.5 L25 78 Z" tone={T.neckerchief} line="inner" shade={false} />
      <Part d="M30.5 66 Q44.5 72 57 66 L57.5 70.5 Q53 74 48.5 84 Q45 88 41.5 84 Q36.5 74 30 70.5 Z" tone={T.neckerchief} line="inner" />
    </>,
    armBack: <g className="arm arm-back">
      <Part d="M35 72 Q24 71 22.5 83 Q22 89.5 25.5 91.5 Q29.5 92.5 30.5 88.5 Q31.5 83 35.5 80 Z" tone={T.parchment} />
      <g transform="rotate(-12 26.5 82)"><Part d={rect(22.5, 78, 8, 8, 1.2)} tone={T.shirtGreen} line="inner" shade={false} /></g>
      <Mitt x={27} y={93} tone={T.skin} />
    </g>,
    prop: <HobbyHorse />,
    armFront: <>
      <Part d="M53 69 Q61.5 70 66.5 79.5 Q68.5 85 64.5 88 Q60 89 58 85 Q56 80.5 52 78.5 Z" tone={T.parchment} />
      <Mitt x={HOBBY_HAND[0]} y={HOBBY_HAND[1]} tone={T.skin} />
    </>,
    head: <>
      <Part d="M24.5 60 L26 22 Q39.5 18.5 53 22 L54.5 60 Q39.5 64 24.5 60 Z" tone={T.rustySteel} highlight="M30 50 L30.5 28" />
      <Part d="M35.5 21.5 Q40.5 23 44.5 21 Q44.5 27 38.5 28.5 Q34.5 27 35.5 21.5 Z" tone={T.rust} line="none" shade={false} />
      <Part d="M46 55 Q50 53 52.5 55.5 Q52 60 47.5 60.5 Q45 58.5 46 55 Z" tone={T.rust} line="none" shade={false} />
      <Ink d="M49 24 L46.5 29.5 L49 32" weight="inner" />
      <Part d="M31 32 L51 32 L51 42 L47 42 L47 54 L40 54 L40 42 L31 42 Z" tone={T.skin} line="inner" shade={false} />
      <Eyes xs={[36.2, 45.8]} y={37} r={2.6} cover={T.skin.fill} />
    </>,
    mouths: null,
    propOrigin: `${HOBBY_HAND[0]}px ${HOBBY_HAND[1]}px`, shield: [29, 88], mouth: [40, 52, 5],
  };
}

/** A rounded shoulder cap with a gold edge, its top at y. */
const Pauldron = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <>
  <Part d={`M${x - 9.5} ${y + 13} Q${x - 10.5} ${y} ${x} ${y} Q${x + 10.5} ${y} ${x + 9.5} ${y + 13} Q${x} ${y + 16.5} ${x - 9.5} ${y + 13} Z`} tone={tone} highlight={`M${x - 6} ${y + 9} Q${x - 5.5} ${y + 5} ${x - 2} ${y + 4}`} />
  <Pole d={`M${x - 8} ${y + 13.2} Q${x} ${y + 16.4} ${x + 8} ${y + 13.2}`} tone={T.gold} width={2.8} />
</>;

/** A chunky horse leg, front or hind pair drawn as one, with a dark hoof. */
const Leg = ({ x }: { x: number }) => <>
  <Part d={`M${x - 6} 94 L${x + 6} 94 L${x + 4.8} 103 L${x - 4.8} 103 Z`} tone={T.horse} shade={false} />
  <Part d={rect(x - 5.6, 101, 11.2, 7, 2)} tone={T.leatherDark} line="inner" shade={false} />
</>;

/** The patrol knight stands his lance upright in his back hand, low at the
 * horse's flank, so at rest it clears the plume and the horse head. His strike
 * (rig.css `rig-lance`) couches it level across his waist and out past the muzzle,
 * below the pauldron and helm that would otherwise hide it. */
const LANCE_HAND = [26.5, 90] as const;

function patrolKnight(c: Palette, hue: PatrolHue): Figure {
  const plate: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  const lance: Tone = hue === "blue" ? T.lance : plate;
  const [hx, hy] = LANCE_HAND;
  return {
    body: <>
      <Leg x={31} /><Leg x={62.5} />
      <Part d="M21 87 Q20 75 31 73.5 L61 72.5 Q71.5 73.5 72 84 Q72 97.5 63.5 98 L30 98.5 Q21 98 21 87 Z" tone={T.horse} />
      <Part d="M55 90 Q53 72 56 58 Q57.5 48 61 42 L59.5 30 L66 37.5 L69.5 30.5 L71.5 39.5 Q76 42.5 78 49 L79.5 59 Q80 66.5 74.5 67 Q70 67.5 67.5 65 Q65 67 65.5 71 Q66.5 80 72 86 Q64 93 55 90 Z" tone={T.horse} />
      <Flat d="M60.5 41.5 Q56.5 52 55.8 62 Q55.2 70 55.8 79 L59.3 79 Q58.8 69 59.6 60.5 Q60.6 51.5 63.8 43.5 Z" fill={T.leatherDark.fill} />
      <Part d="M64.5 42.5 Q68.5 39.5 72 41.5 L78 51.5 L78.5 58.5 L74 59 Q66 53 64.5 42.5 Z" tone={T.barding} line="inner" shade={false} highlight="M67 43.5 Q68.5 41.5 70.5 42" />
      <Dot cx={65.5} cy={50} r={2.5} />
      <Part d="M28 87 Q26 66 32 61 Q39 57.5 46 61 Q52 66 50.5 87 Q39 90 28 87 Z" tone={plate} highlight="M32 76 Q31.5 69 34 65" />
    </>,
    prop: <g className="prop">
      <Pole d={`M${hx + 0.6} ${hy + 11} L${hx - 2.5} 50`} tone={lance} width={6} />
      <Part d={`M${hx - 7} 51 L${hx - 2.5} 35 L${hx + 2} 51 Z`} tone={T.steel} line="inner" shade={false} />
      <Pole d={`M${hx - 4.7} 53 L${hx + 0.5} 53`} tone={T.gold} width={2.6} />
      <Part d={`M${hx - 7} ${hy - 3.5} L${hx + 7} ${hy - 3.5} L${hx + 2} ${hy - 13} L${hx - 3.5} ${hy - 13} Z`} tone={T.steel} line="inner" shade={false} highlight={`M${hx - 4.5} ${hy - 6} L${hx - 3} ${hy - 10}`} />
    </g>,
    armFront: <>
      <Mitt x={hx} y={hy} tone={T.steel} />
      <Sleeve d="M48 68 Q53 71 55 74" tone={T.mail} front /><Pauldron x={46} y={60} tone={plate} /><Mitt x={56} y={75} tone={T.steel} />
    </>,
    head: <g transform="translate(-3 2)">
      <Part d="M46.5 31 Q49.5 17 42.5 10 Q36 5 29.5 10.5 Q26 14 28 24 Q31.5 18.5 35.5 19.5 Q39 21 38.5 31 Z" tone={plate} highlight="M41 24 Q41.5 17 38 13" />
      <Part d="M30 58 Q28.5 30 42.5 28 Q56.5 30 55 58 Q42.5 62 30 58 Z" tone={T.barding} highlight="M34 47 Q33.5 39 37 34" />
      <Part d="M31 38.5 Q43 34.5 54.5 38.5 L55 49 Q43 52 30.5 49 Z" tone={T.helmSteel} line="inner" shade={false} />
      <Part d={circle(32.8, 44, 1.8)} tone={T.gold} line="none" shade={false} />
      <g className="face">
        <g className="eyes">{[39, 48].map(x => <g key={x} className="pupil"><Part d={rect(x - 3.5, 41, 7.5, 4.5, 1)} tone={T.void} line="none" shade={false} /></g>)}</g>
        <g className="ko-eyes"><Ink d="M36.5 40 L41.5 46 M41.5 40 L36.5 46 M45.5 40 L50.5 46 M50.5 40 L45.5 46" /></g>
      </g>
      <g className="mouth-yell"><Flat d={rect(35, 40.5, 17, 5.5)} fill={T.helmSteel.fill} /><Ink d="M35.5 41 L42.5 44 L35.5 46 M51.5 41 L44.5 44 L51.5 46" /></g>
      <Pole d="M31 57 Q43 61.5 54 57" tone={T.gold} width={2.8} />
    </g>,
    mouths: null,
    propOrigin: `${hx}px ${hy}px`, shield: [30, 84], mouth: [41, 54, 5],
  };
}

export function armourKnight(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelKnight() : patrolKnight(c, hue);
}
