import { RebelPot } from "../ArmourPawns";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** Placeholder frog for the rebel pawn (reference docs/art/odd-pawn.webp). It
 * wears RebelPot, so it follows any restyle of the rebel pawn's pot. Head r 14
 * area of the pawn build: a wide frog head, eye domes peeking under the rim. */

const EYE_Y = 67, EYE_GAP = 7.4, EYE_R = 5.4, LID = 1.6;
const eyeXs = [50 - EYE_GAP, 50 + EYE_GAP];
/** A heavy lid over the top of the eye, cut along a chord LID above its centre. */
const lidHalf = Math.sqrt(EYE_R ** 2 - LID ** 2);
const lid = (x: number) => `M${x - lidHalf} ${EYE_Y - LID} A${EYE_R} ${EYE_R} 0 0 1 ${x + lidHalf} ${EYE_Y - LID} Z`;

function FrogHead() {
  return <>
    <g className="quirk-bit"><Part d={ellipse(50, 79, 5, 3)} tone={T.frogLight} line="inner" shade={false} /></g>
    <Part d={ellipse(50, 70.5, 17.5, 11.5)} tone={T.frog} />
    {eyeXs.map(x => <Part key={x} d={circle(x, EYE_Y - .5, 7.2)} tone={T.frog} shade={false} />)}
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x}>
        <Part d={circle(x, EYE_Y, EYE_R)} tone={T.frogEye} line="none" shade={false} />
        <g className="pupil"><Dot cx={x + 1} cy={EYE_Y + 1.4} r={2.4} /></g>
        <Part d={lid(x)} tone={T.frog} line="none" shade={false} />
        <Ink d={`M${x - lidHalf} ${EYE_Y - LID} L${x + lidHalf} ${EYE_Y - LID}`} />
      </g>)}</g>
      <g className="ko-eyes">{eyeXs.map(x => <Ink key={x} d={`M${x - 3} ${EYE_Y - 3} L${x + 3} ${EYE_Y + 3} M${x + 3} ${EYE_Y - 3} L${x - 3} ${EYE_Y + 3}`} />)}</g>
    </g>
    <Ink d="M38 77.5 Q44 75 50 76 Q56 75 62 77.5" />
    <g className="mouth-yell">
      {eyeXs.map(x => <Flat key={x} d={circle(x, EYE_Y, EYE_R + 1)} fill={T.frog.fill} />)}
      <Ink d={`M${eyeXs[0] - 3} ${EYE_Y - 3} L${eyeXs[0] + 2} ${EYE_Y} L${eyeXs[0] - 3} ${EYE_Y + 3} M${eyeXs[1] + 3} ${EYE_Y - 3} L${eyeXs[1] - 2} ${EYE_Y} L${eyeXs[1] + 3} ${EYE_Y + 3}`} />
    </g>
    <RebelPot />
  </>;
}

function Cattail() {
  return <>
    <Pole d="M71 105 L72 40" tone={T.frog} width={3.2} />
    <Pole d="M71.5 78 Q77 68 77.5 56" tone={T.frog} width={2.4} />
    <Pole d="M72 22 L72 14" tone={T.frog} width={1.8} />
    <Part d={rect(67.5, 20, 9, 22, 4.5)} tone={T.cattail} shade={false} />
  </>;
}

export const frogPawn: Skin = {
  id: "frog-pot",
  kind: "pawn",
  name: "Frog",
  ref: "odd-pawn",
  look: { cloth: T.frog, patch: T.frogLight, boot: T.frog, hand: T.frog },
  head: FrogHead,
  prop: Cattail,
  quirk: "quirk-croak",
};
