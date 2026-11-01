import { RebelHorseHead } from "../ArmourKnights";
import { Flat, Ink, Part, TONES as T, circle, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** The empty knight, a rebel knight skin (reference docs/art/odd-knight.webp):
 * a suit of iron with nobody inside, riding a rocking horse. The reference
 * came out in patrol blue; this one is rebel iron, and its one accent is red:
 * a rag knotted round the foot of the helm, and the rein. The horse is the
 * rebel's carved head (`RebelHorseHead`) at its own size, raised on a longer
 * neck so it stands in front of the cuirass with its ear above the helm. The
 * joke is the emptiness: a void T with nothing behind it, a helm floating clear
 * of a hollow collar, and a gap at the wrist. */

const EYE_Y = 32.5, eyeXs = [34, 40];

/** The bucket helm with nothing in it. The pupils are void on the void, there
 * only so blink, hit and death keep their groups; the yell rattles the helm.
 * The rag hugs the helm's foot and knots at the back with one end flying, so
 * it reads as tied on; across the top it read as a lid stripe. */
function EmptyHelm() {
  return <g transform="rotate(4 37 37)">
    <Part d="M25 43.5 L21 47 L22.5 53 L27.5 48 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d="M25.5 49 L26.5 24 Q37 21 47.5 24 L48.5 49 Q37 52 25.5 49 Z" tone={T.armourIron} highlight="M28.8 37 L29 28.5" />
    <Part d="M25.8 42 Q37 39.5 48.2 42 L48.5 49 Q37 52 25.5 49 Z" tone={T.bandana} line="inner" />
    <Part d={circle(26.5, 45.5, 4.6)} tone={T.bandana} line="inner" shade={false} />
    <Part d="M30 29.5 L44 29.5 L44 34.5 L39.5 34.5 L39.5 40.5 L34.5 40.5 L34.5 34.5 L30 34.5 Z" tone={T.void} line="none" shade={false} />
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x} className="pupil"><Part d={circle(x, EYE_Y, 1.6)} tone={T.void} line="none" shade={false} /></g>)}</g>
      <g className="ko-eyes"><Part d="M32 35.5 Q29.5 30.5 34 29 Q35.5 24.5 40 26.5 Q44.5 25 44.5 29.5 Q47 33.5 43 35.5 Z" tone={T.stone} line="inner" shade={false} /></g>
    </g>
    <g className="mouth-yell"><Ink d="M23 33 L20.5 34 M23.5 39 L21 41.5 M51.5 30 L55 28.5" /></g>
  </g>;
}

/** A domed shoulder plate, its top at y. */
const Pauldron = ({ x, y, w }: { x: number; y: number; w: number }) =>
  <Part d={`M${x - w} ${y + 11} Q${x - w} ${y} ${x} ${y} Q${x + w} ${y} ${x + w} ${y + 11} Q${x} ${y + 13.5} ${x - w} ${y + 11} Z`} tone={T.armourIron} shade={false} highlight={`M${x - w + 2} ${y + 7} Q${x - w + 2.5} ${y + 3.5} ${x - 1.5} ${y + 3}`} />;

/** The rocking horse and the armour sitting on it, hollow at the collar. The
 * horse's head stands in front of the cuirass's right edge, so the silhouette
 * keeps the knight's notch between helm and ear. */
function RockingRide() {
  return <>
    <Part d="M27 84 Q19 84 20.5 96 Q24.5 92 30 91 Z" tone={T.leatherDark} line="inner" shade={false} />
    <Part d="M22 95 Q50 103 78 95 L78.5 105 Q50 112 21.5 105 Z" tone={T.wood} />
    <Part d={ellipse(47, 89, 25, 8.5)} tone={T.wood} />
    <Part d="M31 80 L53 80 L55 88 Q43 91 29 88 Z" tone={T.armourIron} shade={false} />
    <Part d="M22.5 67 Q22.5 61 29.5 61 L52 61 Q58 61 58 67 L51.5 83 L33.5 83 Z" tone={T.armourIron} highlight="M27.5 73 Q27.5 69 29 66.5" />
    <Part d={ellipse(40.5, 62.5, 12, 4.5)} tone={T.barding} shade={false} />
    <Part d={ellipse(40.5, 62, 7.5, 2.4)} tone={T.void} line="none" shade={false} />
    <Pauldron x={28.5} y={61} w={8.5} />
    <Part d="M56 90 L57 66 L69 66 L70.5 89 Z" tone={T.wood} />
    <g transform="translate(-1.5 -10)"><RebelHorseHead /></g>
  </>;
}

/** A gauntlet, apart from its vambrace: the gap shows there is no wrist. */
const Gauntlet = ({ x, y }: { x: number; y: number }) => <Part d={rect(x - 5.5, y - 5.5, 11, 11, 4)} tone={T.armourIron} line="inner" shade={false} />;

/** The front arm at the horse's neck, its vambrace open at the wrist, the
 * gauntlet on the red rein a gap away. */
function FrontArm() {
  return <>
    <Flat d="M73.5 50 L76.5 52 L67.5 80 L64.5 78.5 Z" fill={T.bandana.fill} />
    <Part d="M46.5 68 L53 65.5 L56.5 73 L50.5 75.5 Z" tone={T.armourIron} shade={false} />
    <Flat d={ellipse(53.5, 74.3, 3.4, 1.5)} fill={T.void.fill} />
    <Pauldron x={51} y={60} w={7} />
    <Gauntlet x={66} y={83} />
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
