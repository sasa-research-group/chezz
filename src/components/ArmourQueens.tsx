import type { Figure, Palette, PatrolHue } from "./PieceRig";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect, type Tone } from "./inkKit";

/** The queens redrawn in the "armour does the talking" style (docs/art-style.md),
 * drawn only with the shape kit. Same groups and pivots as the old queen rig
 * (the prop pivots at the front hand), so rig.css drives them unchanged,
 * including the promotion morph-in. Queens are the tall pieces, but a crest
 * above y 21 pokes out of a top-row square in battle: crown tips near y 20,
 * a gown flaring to about 44 wide at the hem; everything stays inside x 18–82.
 * The front hand holds the prop, so only the back arm carries an
 * `arm` class (the cheer swings it); the old rig's arm slap has no free arm to
 * move, and the strike is the prop's swing. */

const Boot = ({ x, tone }: { x: number; tone: Tone }) =>
  <Part d={`M${x - 5.5} 108 Q${x - 5.5} 100 ${x} 100 Q${x + 6} 100 ${x + 6} 108 Z`} tone={tone} shade={false} />;
const Mitt = ({ x, y, tone }: { x: number; y: number; tone: Tone }) => <Part d={circle(x, y, 5.6)} tone={tone} line="inner" shade={false} />;

/** Two dot eyes, KO crosses, and an effort squint drawn over a cover tone. */
function Eyes({ xs, y, r, cover }: { xs: [number, number]; y: number; r: number; cover: string }) {
  return <>
    <g className="face">
      <g className="eyes">{xs.map(x => <g key={x} className="pupil"><Dot cx={x} cy={y} r={r} /></g>)}</g>
      <g className="ko-eyes">{xs.map(x => <Ink key={x} d={`M${x - 2.8} ${y - 2.8} L${x + 2.8} ${y + 2.8} M${x + 2.8} ${y - 2.8} L${x - 2.8} ${y + 2.8}`} />)}</g>
    </g>
    <g className="mouth-yell">
      {xs.map(x => <Flat key={x} d={circle(x, y, r + 1.2)} fill={cover} />)}
      <Ink d={`M${xs[0] - 3} ${y - 2.6} L${xs[0] + 1.6} ${y} L${xs[0] - 3} ${y + 2.6} M${xs[1] + 3} ${y - 2.6} L${xs[1] - 1.6} ${y} L${xs[1] + 3} ${y + 2.6}`} />
    </g>
  </>;
}

/** The rebel queen's frying pan: a near-black iron pan held up by its handle,
 * the fist at `PAN_HAND`, the pan beside her helm. */
const PAN_HAND = [73, 70] as const;
const PAN_INSIDE: Tone = { fill: T.iron.shade, shade: T.iron.shade };
function FryingPan() {
  const [fx, fy] = PAN_HAND;
  return <g className="prop">
    <Pole d={`M68 47 L${fx + 0.8} ${fy + 7}`} tone={T.iron} width={4.6} />
    <Part d={circle(67, 35, 12.5)} tone={T.iron} highlight="M58 33 Q59 27 63.5 25" />
    <Part d={circle(67, 35, 8.3)} tone={PAN_INSIDE} line="none" shade={false} />
    <Part d="M68.5 37 Q72 36.5 72.5 40 Q70.5 42.5 68 40.5 Z" tone={T.rust} line="none" shade={false} />
  </g>;
}

/** A small crown with three fat points, base centred at (x, y). Unshaded and
 * traced with the inner line: a cel crescent and the outer stroke fill narrow
 * points with ink at 48px. */
const Crown = ({ x, y, h, gem }: { x: number; y: number; h: number; gem: Tone }) => <>
  <Part d={`M${x - 12} ${y} L${x - 13} ${y - h * .8} L${x - 6} ${y - h * .45} L${x} ${y - h} L${x + 6} ${y - h * .45} L${x + 13} ${y - h * .8} L${x + 12} ${y} Z`} tone={T.gold} line="inner" shade={false} highlight={`M${x - 9.5} ${y - 2.5} L${x - 9.8} ${y - 6}`} />
  <Part d={circle(x, y - 3.6, 2.5)} tone={gem} line="inner" shade={false} />
</>;

function rebelQueen(): Figure {
  return {
    body: <>
      <Boot x={42} tone={T.leatherDark} /><Boot x={58} tone={T.leatherDark} />
      <Part d="M32 103 Q30 86 36 73 Q50 66 64 73 Q70 86 68 103 Q50 107 32 103 Z" tone={T.smock} />
      <Part d="M37.5 86 L62.5 86 Q66 95 66.5 103 L61 101 L55.5 104.5 L50 101.5 L44.5 104.5 L39 101 L33.5 103 Q34 95 37.5 86 Z" tone={T.parchment} line="inner" />
      <Flat d="M38.5 73 L36.5 66 L40.5 65.5 L42.5 72.5 Z M61.5 73 L63.5 66 L59.5 65.5 L57.5 72.5 Z" fill={T.leatherDark.fill} />
      <Part d="M37.5 72 Q50 68.5 62.5 72 L61.5 87.5 Q50 91 38.5 87.5 Z" tone={T.rustySteel} line="inner" highlight="M42 76 L42 83" />
      <Part d="M53 78 Q57 76.5 58.5 80 Q57.5 84 53.5 83.5 Q51.5 81 53 78 Z" tone={T.rust} line="none" shade={false} />
    </>,
    armBack: <g className="arm arm-back">
      <Part d="M37 71.5 Q24 70.5 21.5 84 Q21 91 24.5 93 Q28.5 94 29.5 89 Q30.5 83.5 36 80.5 Z" tone={T.smock} />
      <Part d="M22 79 Q28 77 34.5 76.5 L32.5 87 Q27.5 86.8 21.3 88.5 Z" tone={T.armband} line="inner" shade={false} />
      <Mitt x={26} y={94} tone={T.rustySteel} />
    </g>,
    prop: <FryingPan />,
    armFront: <>
      <Part d="M59 70 Q66 64 72 64.5 Q78 66 77.5 71 Q76.5 75.5 71.5 75 Q66 75 61 78.5 Z" tone={T.smock} />
      <Mitt x={PAN_HAND[0]} y={PAN_HAND[1]} tone={T.rustySteel} />
    </>,
    head: <>
      <Part d={circle(46.5, 54.5, 12.5)} tone={T.skin} />
      <Ink d="M38.5 51 L44.5 53 M55 51 L49 53" />
      <Eyes xs={[42, 51.5]} y={55.5} r={2.5} cover={T.skin.fill} />
      <Ink d="M44.5 62 L49.5 61.6" />
      <Part d="M30 46 Q29.5 29 45 28 Q51 28.2 54 30.5 Q51.5 33.5 55.5 36 Q60 40 60 46 Z" tone={T.rustySteel} highlight="M35 40 Q35.5 35 39 32" />
      <Part d="M45.5 36 Q49 34.5 50.5 38 Q49 41 46 40.5 Z" tone={T.rust} line="none" shade={false} />
      <g transform="rotate(-6 45 32)"><Crown x={44} y={33.5} h={12} gem={T.bandana} /></g>
      <Part d="M24 53 Q25 44 33 43 L57 43 Q66 44 67 53 Q65 55.5 62 53.5 Q59 49.5 54 49 L36 49 Q31.5 49.5 28.5 53.5 Q25.5 55.5 24 53 Z" tone={T.rustySteel} />
    </>,
    mouths: null,
    propOrigin: `${PAN_HAND[0]}px ${PAN_HAND[1]}px`, shield: [31, 90], mouth: [46, 70, 5],
  };
}

/** The patrol queen holds her sceptre leaning out from her front hand, so the
 * orb clears the wig and gown in silhouette. */
const SCEPTRE_HAND = [72, 84] as const;
function Sceptre() {
  const [fx, fy] = SCEPTRE_HAND;
  return <g className="prop">
    <Pole d={`M74.5 54 L${fx - 0.5} ${fy + 9}`} tone={T.gold} width={3.4} />
    <Pole d="M74.5 45 L74.5 37.5 M71.5 40.5 L77.5 40.5" tone={T.gold} width={2.6} />
    <Part d={circle(74.5, 49.5, 4.8)} tone={T.royalBlue} highlight="M72 49 Q72.3 47 74 46.5" />
    <Part d={rect(71, 53, 7, 3.5, 1.5)} tone={T.gold} line="inner" shade={false} />
  </g>;
}

/** A puffed shoulder cap with one gold stripe. */
const Puff = ({ x, tone }: { x: number; tone: Tone }) => <>
  <Part d={circle(x, 73, 7)} tone={tone} />
  <Flat d={rect(x - 1.2, 67, 2.4, 12, 1)} fill={T.gold.fill} />
</>;

function patrolQueen(c: Palette, hue: PatrolHue): Figure {
  const gown: Tone = hue === "blue" ? T.royalBlue : { fill: c.main, shade: c.mainSh };
  return {
    body: <>
      <Boot x={42} tone={T.mail} /><Boot x={58} tone={T.mail} />
      <Part d="M37 71 L26.5 54 Q35 55 40.5 62 L59.5 62 Q65 55 73.5 54 L63 71 Z" tone={gown} />
      <Pole d="M26.5 54 Q35 55 40.5 62 M59.5 62 Q65 55 73.5 54" tone={T.gold} width={2.6} />
      <Part d="M37 70 Q50 65 63 70 Q67 84 72.5 103.5 Q50 109 27.5 103.5 Q33 84 37 70 Z" tone={gown} />
      <Pole d="M29 101 Q50 106.5 71 101" tone={T.gold} width={3.4} />
      <Part d="M42.5 69 L57.5 69 L52.5 92 Q50 95 47.5 92 Z" tone={T.gold} line="inner" />
      <Part d={circle(50, 77, 2.8)} tone={T.royalBlue} line="inner" shade={false} />
    </>,
    armBack: <g className="arm arm-back">
      <Part d="M38.5 72 Q28 72 26.5 84 Q26 91 29.5 93 Q33.5 94 34.5 89 Q35.5 84 39 81 Z" tone={gown} />
      <Puff x={35} tone={gown} />
      <Mitt x={31} y={94} tone={T.skin} />
    </g>,
    prop: <Sceptre />,
    armFront: <>
      <Part d="M60 70 Q69 69.5 73.5 78 Q76 83 73 86.5 Q69 88 67 84 Q64.5 79 60 78 Z" tone={gown} />
      <Puff x={65} tone={gown} />
      <Part d={circle(70.5, 82, 4)} tone={T.parchment} line="inner" shade={false} />
      <Mitt x={SCEPTRE_HAND[0]} y={SCEPTRE_HAND[1]} tone={T.skin} />
    </>,
    head: <>
      <Part d="M38.5 55 Q31 55.5 31.5 47.5 Q25.5 42.5 28 36 Q27 29 35 28 Q40 23.5 50 23.5 Q60 23.5 65 28 Q73 29 72 36 Q74.5 42.5 68.5 47.5 Q69 55.5 61.5 55 Z" tone={T.wig} />
      <Pole d="M29 37 Q39.5 45 50 40.5 Q60.5 45 71 37" tone={T.gold} width={2.6} />
      <Part d={circle(50, 40.5, 3.2)} tone={T.royalBlue} line="inner" shade={false} />
      <Crown x={50} y={30} h={11} gem={T.royalBlue} />
      <Part d={ellipse(50, 56, 10, 10.5)} tone={T.skin} line="inner" />
      <Part d="M38.5 52 Q38 42.5 50 42 Q62 42.5 61.5 52 Q57 47.5 53 48 L50 51.5 L47 48 Q43 47.5 38.5 52 Z" tone={T.helmSteel} line="inner" shade={false} highlight="M42 47.5 Q43.5 45 46.5 44.5" />
      <Ink d="M42.8 53.8 Q45.5 52 48 53.4 M52 53.4 Q54.5 52 57.2 53.8" />
      <Eyes xs={[45.5, 54.5]} y={56} r={2.3} cover={T.skin.fill} />
      <Part d="M46.5 61.5 Q48.5 59.8 50 60.8 Q51.5 59.8 53.5 61.5 Q50 64.8 46.5 61.5 Z" tone={T.lips} line="none" shade={false} />
    </>,
    mouths: null,
    propOrigin: `${SCEPTRE_HAND[0]}px ${SCEPTRE_HAND[1]}px`, shield: [31, 90], mouth: [50, 62, 5],
  };
}

export function armourQueen(rebel: boolean, c: Palette, hue: PatrolHue): Figure {
  return rebel ? rebelQueen() : patrolQueen(c, hue);
}
