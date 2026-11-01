import { RebelMitre } from "../ArmourBishops";
import { Dot, Flat, Ink, Part, TONES as T, circle, ellipse } from "../inkKit";
import type { Skin } from "./index";

/** The goose in a mitre, a rebel bishop skin (reference docs/art/odd-bishop.webp).
 * It wears RebelMitre, so it follows any restyle of the rebel bishop's crest,
 * at 0.82 scale and lowered, so its peak stays inside the board frame on the top
 * row and the skull still shows under the brim. One eye in
 * profile; the smugness is the head tipped back, the beak raised and one low
 * angry brow, not a half-lidded eye, which blurs to a dash at 48px. No prop: the
 * beak takes the space where the crook's hook would go, and the goose pecks
 * instead of swinging (`quirk-peck` in rig.css); the mitre is its `.quirk-bit`,
 * which tips back as the head lunges. */

const MITRE_AT = "translate(5 6.8)", MITRE_SCALE = 0.82;
const TILT = "rotate(-9 55 70)";
const EYE: [number, number] = [58, 62.5];

function GooseHead() {
  const [ex, ey] = EYE;
  return <g transform={TILT}>
    <Part d={ellipse(55, 62.5, 12.5, 9)} tone={T.goose} />
    <Part d="M62.5 58.5 Q71 56 77.5 57 Q82 59 79 64 Q72.5 69 63.5 71.5 Z" tone={T.beak} />
    <g className="face">
      <g className="eyes"><g className="pupil"><Dot cx={ex} cy={ey} r={2.7} /></g></g>
      <g className="ko-eyes"><Ink d={`M${ex - 3} ${ey - 3} L${ex + 3} ${ey + 3} M${ex + 3} ${ey - 3} L${ex - 3} ${ey + 3}`} /></g>
    </g>
    <g className="mouth-yell">
      <Flat d={circle(ex, ey, 4)} fill={T.goose.fill} />
      <Ink d={`M${ex - 3} ${ey - 3} L${ex + 2} ${ey} L${ex - 3} ${ey + 3}`} />
    </g>
    <Ink d={`M${ex - 5} ${ey - 5} L${ex + 3.5} ${ey - 2}`} />
    <g transform={MITRE_AT}><g className="quirk-bit"><RebelMitre scale={MITRE_SCALE} /></g></g>
  </g>;
}

const Foot = ({ x }: { x: number }) =>
  <Part d={`M${x - 6} 108 L${x + 10} 108 Q${x + 8} 101 ${x + 2} 99.5 L${x - 1} 99.5 Q${x - 5} 101.5 ${x - 6} 108 Z`} tone={T.beak} shade={false} />;

/** Neck and body are one shape, so no seam crosses the neck. The neck runs up
 * under the head, so when the head pops loose in the death animation the neck
 * stays joined to it instead of showing a gap. */
function GooseBody() {
  return <>
    <Part d="M25 84.5 Q31 88.5 38 87.5 Q44.5 86.5 47.5 82 Q45 74 48 66 L48.5 61 Q55 54 62 61 Q61.5 68 63.5 78 Q72.5 84.5 72.5 93.5 Q72 103 57 103 L38 103 Q27.5 102.5 25.5 95.5 Q24.5 90 25 84.5 Z" tone={T.goose} />
    <Part d="M33 89 Q45 85.5 57 90 Q60.5 95.5 55 99.5 L50.5 97 L45 100.5 Q35 99 28.5 91.5 Q30.5 89.5 33 89 Z" tone={T.goose} line="inner" />
    <Foot x={37} /><Foot x={53} />
  </>;
}

export const gooseBishop: Skin = {
  id: "goose-mitre",
  kind: "bishop",
  name: "Goose",
  ref: "odd-bishop",
  head: GooseHead,
  body: GooseBody,
  armBack: () => null,
  armFront: () => null,
  prop: () => null,
  quirk: "quirk-peck",
};
