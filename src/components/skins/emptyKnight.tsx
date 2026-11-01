import { RebelHorseHead } from "../ArmourKnights";
import { Flat, Ink, Part, TONES as T, circle, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** The empty knight, a rebel knight skin (reference docs/art/odd-knight.webp):
 * a rusty suit of armour with nobody inside, riding a rocking horse. The
 * reference came out in patrol blue; this one is rebel rusty iron, and its one
 * accent is red: a rag tied round the helm and the rein. The horse is the
 * rebel's carved head (`RebelHorseHead`), enlarged, on a barrel and a rocker.
 * The joke is the emptiness: a dark void behind the bucket helm's T, a helm
 * floating clear of a hollow collar, and a gap at the wrist. */

const EYE_Y = 28, eyeXs = [37, 44];

/** The bucket helm with nothing in it. The pupils are void on the void, there
 * only so blink, hit and death keep their groups; the yell rattles the helm. */
function EmptyHelm() {
  return <g transform="translate(-3 -3) rotate(5 40 30)">
    <Part d="M25 47 L26.5 12 Q40 8.5 53.5 12 L55 47 Q40 51 25 47 Z" tone={T.rustySteel} highlight="M30.5 41 L31 26" />
    <Part d="M47.5 23.5 Q51 22.5 53 24.5 Q52.5 28.5 49 28.5 Q47 27 47.5 23.5 Z" tone={T.rust} line="none" shade={false} />
    <Part d="M26.5 17 L23.5 13.5 L23.5 21 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d="M26.5 19.5 L23.5 26 L27 26 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d="M26.2 13 Q40 9.5 53.8 13 L54.1 21.5 Q40 18 26 21.5 Z" tone={T.bandana} line="inner" />
    <Part d="M32 25.5 L49 25.5 L49 31.5 L44 31.5 L44 42 L37.5 42 L37.5 31.5 L32 31.5 Z" tone={T.void} line="inner" shade={false} />
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x} className="pupil"><Part d={circle(x, EYE_Y, 1.6)} tone={T.void} line="none" shade={false} /></g>)}</g>
      <g className="ko-eyes"><Part d="M35 31 Q32.5 26 37 24.5 Q38.5 20 43 22 Q47.5 20.5 47.5 25 Q50 29 46 31 Z" tone={T.stone} line="inner" shade={false} /></g>
    </g>
    <g className="mouth-yell"><Ink d="M31 6 L33.5 9.5 M40 4.5 L40 8.5 M49 6 L46.5 9.5" /></g>
  </g>;
}

/** A domed shoulder plate, its top at y. */
const Pauldron = ({ x, y }: { x: number; y: number }) =>
  <Part d={`M${x - 7} ${y + 10} Q${x - 7} ${y} ${x} ${y} Q${x + 7} ${y} ${x + 7} ${y + 10} Q${x} ${y + 12} ${x - 7} ${y + 10} Z`} tone={T.rustySteel} shade={false} highlight={`M${x - 5} ${y + 7} Q${x - 4.5} ${y + 4} ${x - 1.5} ${y + 3}`} />;

/** The rocking horse and the armour sitting on it, hollow at the collar. */
function RockingRide() {
  return <>
    {/* Scaled rather than redrawn so it stays the rebel's head; its lines come out 1.25× the kit's weights. */}
    <g transform="translate(-6 0) translate(60 88) scale(1.25) translate(-60 -88)"><RebelHorseHead /></g>
    <Part d="M21 93 Q50 105 79 93 L79.5 99.5 Q50 117.5 20.5 99.5 Z" tone={T.wood} />
    <Part d={ellipse(46, 89, 23, 8.5)} tone={T.wood} />
    <Part d="M22 65 Q22 56 31 56 Q40.5 50.5 50 56 Q59 56 59 65 Q59 78 52 85.5 L29 85.5 Q22 78 22 65 Z" tone={T.rustySteel} highlight="M27 75 Q26 68 28.5 62" />
    <Part d="M43 72 Q47.5 70.5 49.5 73.5 Q49 78 45 78.5 Q42 76.5 43 72 Z" tone={T.rust} line="none" shade={false} />
    <Part d={ellipse(40.5, 62.5, 10, 4.5)} tone={T.void} line="none" shade={false} />
    <Pauldron x={27.5} y={56} />
  </>;
}

/** A gauntlet, apart from its vambrace: the gap shows there is no wrist. */
const Gauntlet = ({ x, y }: { x: number; y: number }) => <Part d={rect(x - 5.5, y - 5.5, 11, 11, 4)} tone={T.rustySteel} line="inner" shade={false} />;

/** The front arm bent at the elbow, its vambrace open at the wrist, the gauntlet
 * on the red rein a gap away. */
function FrontArm() {
  return <>
    <Flat d="M74.5 48.5 L77.5 50 L73.5 68 L70.5 67.5 Z" fill={T.bandana.fill} />
    <Part d="M50 64 L58 64 L58 69 L60 69 Q61.5 73.5 60 78 L54 78 Q50 78 50 74 Z" tone={T.rustySteel} shade={false} />
    <Flat d={ellipse(60.3, 73.5, 1.8, 4)} fill={T.void.fill} />
    <Gauntlet x={72} y={73} />
    <Pauldron x={54.5} y={56} />
  </>;
}

export const emptyKnight: Skin = {
  id: "empty-knight",
  kind: "knight",
  name: "Empty knight",
  ref: "odd-knight",
  head: EmptyHelm,
  body: RockingRide,
  armBack: () => null,
  armFront: FrontArm,
  prop: () => null,
  quirk: "quirk-hover",
};
