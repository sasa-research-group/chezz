import { RebelBattlements } from "../ArmourRooks";
import { Flat, Ink, Part, Pole, TONES as T, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** The walking haystack, a rebel rook skin (reference docs/art/odd-rook.webp).
 * It wears RebelBattlements, so it follows any restyle of the stonemason's crest.
 * The hay is one bell, as wide as the crest where they meet, flaring to a tufted
 * hem. Hay strands are a few inner strokes over the kit's shading; anything
 * finer turns to noise at 48px. */

const EYE_Y = 47, EYE_GAP = 7;
const eyeXs = [50 - EYE_GAP, 50 + EYE_GAP];

/** Eyes, crest and door only: the hay is one mound in the body, so no seam crosses it
 * and the eyes peek out of the hay as the head bobs. */
function HayHead() {
  return <>
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x} className="pupil"><Part d={ellipse(x, EYE_Y, 3.4, 5)} tone={T.void} line="none" shade={false} /></g>)}</g>
      <g className="ko-eyes">{eyeXs.map(x => <Ink key={x} d={`M${x - 3} ${EYE_Y - 3} L${x + 3} ${EYE_Y + 3} M${x + 3} ${EYE_Y - 3} L${x - 3} ${EYE_Y + 3}`} />)}</g>
    </g>
    <g className="mouth-yell">
      {eyeXs.map(x => <Flat key={x} d={ellipse(x, EYE_Y, 4.4, 6)} fill={T.hay.fill} />)}
      <Ink d={`M${eyeXs[0] - 3} ${EYE_Y - 3} L${eyeXs[0] + 2} ${EYE_Y} L${eyeXs[0] - 3} ${EYE_Y + 3} M${eyeXs[1] + 3} ${EYE_Y - 3} L${eyeXs[1] - 2} ${EYE_Y} L${eyeXs[1] + 3} ${EYE_Y + 3}`} />
    </g>
    <RebelBattlements />
    <g className="door">
      <Part d={rect(37.5, 23, 25, 40, 2)} tone={T.wood} />
      <Ink d="M45.5 26 L45.5 60 M54.5 26 L54.5 60" weight="inner" />
      <Pole d="M39 31 L61 31 M39 54 L61 54" tone={T.rustySteel} width={2.6} />
    </g>
  </>;
}

const Boot = ({ x }: { x: number }) =>
  <Part d={`M${x - 6.5} 108 Q${x - 6.5} 99 ${x} 99 Q${x + 7} 99 ${x + 7} 108 Z`} tone={T.leatherDark} shade={false} />;

/** One bell of hay from under the crest to a tufted hem, tufts poking out of its
 * sides. The back arm would hide behind it, so the skin draws none, and the
 * front arm is only a mitten on the fork. */
function HayBody() {
  return <>
    <Boot x={41} /><Boot x={59} />
    <Part d="M34 30 L66 30 L69 37 L73.5 42.5 L78.5 44.5 L75 48 L77.5 58 L79.5 61 L77 63.5 L78 76 L79.5 79 L77.5 81.5 L78.5 94 L79.5 97 L78 101 L71 99.5 L65 104.5 L58 101 L50 105.5 L42 101 L35 104.5 L29 99.5 L22 101 L20.5 97 L21.5 94 L22.5 81.5 L20.5 79 L22 76 L23 63.5 L20.5 61 L22.5 58 L25 48 L21.5 44.5 L26.5 42.5 L31 37 Z" tone={T.hay} />
    <Ink d="M38.5 34 Q38 38 36 41 M42.5 34 Q42.3 37 41 39.5 M61.5 34 Q62 38 64 41 M30 66 Q29 70 27.5 73 M34.5 68 Q34 72 32.5 75 M63 70 Q64 74 65.5 77 M33 92 Q31 96 29.5 99 M45 92 Q44 96 42.5 99.5 M57 92 Q58 96 59.5 99.5 M67 92 Q69 96 70.5 99" weight="inner" />
  </>;
}

/** A tufted straw mitten round the fork shaft, two spikes toward the body. */
const Mitten = () =>
  <Part d="M67.3 86 L63 82.5 L68.5 82.3 Q70 81.5 73.5 81.5 Q79.7 81.5 79.7 88 Q79.7 94.5 73.5 94.5 Q67.3 94.5 67.3 91 L63 91 L67.3 87.5 Z" tone={T.straw} shade={false} />;

/** A two-tined hayfork: two tines, not three, spaced so the gap stays open at 48px. */
function Hayfork() {
  return <>
    <Pole d="M72.2 61 L74.6 101" tone={T.wood} width={4} />
    <Pole d="M66.5 39 L66.5 54 Q66.5 61 72.2 61 Q78 61 78 54 L78 39" tone={T.rustySteel} width={3.2} />
  </>;
}

export const haystackRook: Skin = {
  id: "haystack",
  kind: "rook",
  name: "Haystack",
  ref: "odd-rook",
  head: HayHead,
  body: HayBody,
  armBack: () => null,
  armFront: () => <Mitten />,
  prop: Hayfork,
};
