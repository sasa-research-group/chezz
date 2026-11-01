import { Dot, Flat, Ink, Part, TONES as T, circle, rect } from "../inkKit";
import type { Skin } from "./index";

/** The candle queen, a rebel queen skin (reference docs/art/odd-queen.webp): a
 * living, melting candle in a copper dish. The reference has one flame; the
 * queen's crest is a crown, so her flame burns as three points, the middle one
 * tallest, on a short dark wick. The wax slumps into a puddle under fat
 * drips, so the outline isn't a rook's straight tower. The rebel accent is the
 * rebel queen's purple, as a ribbon tied round the wax. The wax and flame are in
 * the body slot, so the flame stays on the wick when the head pops; the head
 * slot holds only the face. No arms and no prop: the strike is the lunge. */

const EYE_Y = 68, eyeXs = [44, 56];

function CandleFace() {
  return <>
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x} className="pupil"><Dot cx={x} cy={EYE_Y} r={2.6} /></g>)}</g>
      <g className="ko-eyes">{eyeXs.map(x => <Ink key={x} d={`M${x - 2.8} ${EYE_Y - 2.8} L${x + 2.8} ${EYE_Y + 2.8} M${x + 2.8} ${EYE_Y - 2.8} L${x - 2.8} ${EYE_Y + 2.8}`} />)}</g>
    </g>
    <Ink d="M45.5 74 Q50 70 54.5 74 Q55.5 74.8 55.5 75.5" />
    <g className="mouth-yell">
      {eyeXs.map(x => <Flat key={x} d={circle(x, EYE_Y, 3.8)} fill={T.wax.fill} />)}
      <Ink d={`M${eyeXs[0] - 3} ${EYE_Y - 2.6} L${eyeXs[0] + 1.6} ${EYE_Y} L${eyeXs[0] - 3} ${EYE_Y + 2.6} M${eyeXs[1] + 3} ${EYE_Y - 2.6} L${eyeXs[1] - 1.6} ${EYE_Y} L${eyeXs[1] + 3} ${EYE_Y + 2.6}`} />
    </g>
  </>;
}

/** Three flame points on one wick. Flames may skip the outer outline
 * (docs/art-style.md section 2); the inner line keeps them apart from the
 * tile at 48px. */
function FlameCrown() {
  return <>
    <Part d={rect(48.6, 36, 2.8, 7)} tone={T.void} line="none" shade={false} />
    <g transform="translate(0 -1)"><Part d="M42 38 Q36 34 37.5 30 L39.5 26 Q42.5 29.5 44.5 32 Q46 25 50 17.5 Q54 25 55.5 32 Q57.5 29.5 60.5 26 L62.5 30 Q64 34 58 38 Z" tone={T.flame} line="inner" shade={false} />
    <Flat d="M46.5 37.5 Q44 34 46.5 30 Q48.5 26.5 50 24 Q51.5 26.5 53.5 30 Q56 34 53.5 37.5 Z" fill={T.flameCore.fill} /></g>
  </>;
}

/** The wax, its foot slumping into the copper bowl and its top a cap of drips that
 * bulge past the corners; the purple ribbon round it; and the flame. */
function CandleBody() {
  return <>
    <Part d="M29 96 Q34.5 94.5 35 88 L34.5 52 Q34.5 42 42 42 L58 42 Q65.5 42 65.5 52 L66 88 Q66.5 94.5 72 96 Z" tone={T.wax} />
    <Part d="M22 93.5 L78 93.5 Q77 108 50 108 Q23 108 22 93.5 Z" tone={T.copper} highlight="M27 97 Q28 101 31 103" />
    <Part d="M33 50 Q33.5 41.5 42 41.5 L58 41.5 Q66.5 41.5 67 50 L69.5 60 Q70 65 66.5 65 Q63.5 65 63.5 60 L62.5 53 Q60.5 53 60.5 57 Q60.5 62 57 62 Q54 62 54 56.5 Q53.5 53 51 53 Q48 53 48 58 Q48 63 44.5 63 Q41 63 41 57.5 Q41 54 38.5 54 L37.5 54 L36 63 Q35.5 67.5 32.5 67 Q29.5 66.5 30.5 61.5 Z" tone={T.waxLight} line="inner" shade={false} />
    <Part d="M34.6 80 Q50 77.5 65.6 80 L65.8 89 Q50 86.5 34.8 89 Z" tone={T.armband} line="inner" shade={false} />
    <Part d="M66 83.5 L74.5 78.5 L75.5 84.5 Z" tone={T.armband} line="inner" shade={false} />
    <Part d="M66 86 L74 92 L70.5 94.5 Z" tone={T.armband} line="inner" shade={false} />
    <Part d={circle(65.5, 84.5, 4.5)} tone={T.armband} line="inner" shade={false} />
    <FlameCrown />
  </>;
}

export const candleQueen: Skin = {
  id: "candle-queen",
  kind: "queen",
  name: "Candle queen",
  ref: "odd-queen",
  head: CandleFace,
  body: CandleBody,
  armBack: () => null,
  armFront: () => null,
  prop: () => null,
};
