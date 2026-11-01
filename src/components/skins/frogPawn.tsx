import { PAWN_ARMS, RebelPot, Sleeve } from "../ArmourPawns";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** The frog in the saucepan, a rebel pawn skin (reference docs/art/odd-pawn.webp).
 * It wears RebelPot, so it follows any restyle of the rebel pawn's pan. A wide
 * flat frog head, wider than the pan, whose eye domes tuck under its rim; a squat
 * body on two plain leg ovals, round mitts, a red cord knotted under the jaw, and
 * a cattail. Detail is kept sparse because inner lines turn to stripes at 48px. */

const HEAD_X = 51, EYE_Y = 60, EYE_GAP = 13.5, EYE_R = 6.6, DOME_R = 8.8, LID = 1.3;
const eyeXs = [HEAD_X - EYE_GAP, HEAD_X + EYE_GAP];
/** A heavy lid over the top of the eye, cut along a chord LID above its centre. */
const lidHalf = Math.sqrt(EYE_R ** 2 - LID ** 2);
const lid = (x: number) => `M${x - lidHalf} ${EYE_Y - LID} A${EYE_R} ${EYE_R} 0 0 1 ${x + lidHalf} ${EYE_Y - LID} Z`;

function FrogHead() {
  return <>
    <g className="quirk-bit"><Part d={ellipse(HEAD_X, 79, 7, 3.6)} tone={T.frogLight} line="inner" shade={false} /></g>
    <Part d={ellipse(HEAD_X, 71, 23.5, 12.5)} tone={T.frog} />
    <Flat d={ellipse(33.5, 71.5, 3.4, 3)} fill={T.frogSpot.fill} />
    <Part d={`M${HEAD_X - 18} 77 Q${HEAD_X} 78 ${HEAD_X + 18} 77 Q${HEAD_X + 13} 81.3 ${HEAD_X} 81.3 Q${HEAD_X - 13} 81.3 ${HEAD_X - 18} 77 Z`} tone={T.frogLight} line="none" shade={false} />
    <Ink d={`M${HEAD_X - 13} 77 Q${HEAD_X} 73.5 ${HEAD_X + 13} 77`} />
    <Part d={rect(eyeXs[0], 50, eyeXs[1] - eyeXs[0], 15)} tone={T.frog} line="none" shade={false} />
    {eyeXs.map(x => <Part key={x} d={circle(x, EYE_Y - 1, DOME_R)} tone={T.frog} shade={false} />)}
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x}>
        <Part d={circle(x, EYE_Y, EYE_R)} tone={T.frogEye} line="none" shade={false} />
        <g className="pupil"><Dot cx={x + 1} cy={EYE_Y + 2} r={2.5} /></g>
        <Part d={lid(x)} tone={T.frog} line="none" shade={false} />
        <Ink d={`M${x - lidHalf} ${EYE_Y - LID} L${x + lidHalf} ${EYE_Y - LID}`} weight="inner" />
      </g>)}</g>
      <g className="ko-eyes">{eyeXs.map(x => <Ink key={x} d={`M${x - 3} ${EYE_Y - 3} L${x + 3} ${EYE_Y + 3} M${x + 3} ${EYE_Y - 3} L${x - 3} ${EYE_Y + 3}`} />)}</g>
    </g>
    <g className="mouth-yell">
      {eyeXs.map(x => <Flat key={x} d={circle(x, EYE_Y, EYE_R + 1)} fill={T.frog.fill} />)}
      <Ink d={`M${eyeXs[0] - 3} ${EYE_Y - 3} L${eyeXs[0] + 2} ${EYE_Y} L${eyeXs[0] - 3} ${EYE_Y + 3} M${eyeXs[1] + 3} ${EYE_Y - 3} L${eyeXs[1] - 2} ${EYE_Y} L${eyeXs[1] + 3} ${EYE_Y + 3}`} />
    </g>
    <g transform="translate(0 -4)"><RebelPot /></g>
  </>;
}

function FrogBody() {
  return <>
    <Part d="M32 103 Q28 87 38 78 Q50 73 62 78 Q72 87 68 103 Q50 107 32 103 Z" tone={T.frog} />
    <Part d={ellipse(50, 94, 9.5, 8)} tone={T.frogLight} line="none" shade={false} />
    <Part d={ellipse(36.5, 101.5, 8.5, 6.5)} tone={T.frog} />
    <Part d={ellipse(63.5, 101.5, 8.5, 6.5)} tone={T.frog} />
    <Flat d={ellipse(34, 100.5, 3.2, 2.8)} fill={T.frogSpot.fill} />
    <Part d="M34 83.5 Q50 88 67 83.5 L67 87.5 Q50 96 34 87.5 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d={circle(58, 89.5, 3.8)} tone={T.bandana} line="inner" shade={false} />
  </>;
}

const Hand = ({ at: [x, y] }: { at: readonly [number, number] }) =>
  <Part d={circle(x, y, 5)} tone={T.frogSpot} line="inner" shade={false} />;

function Cattail() {
  return <>
    <Pole d="M71 105 L75 24" tone={T.wood} width={4.4} />
    <Pole d="M71.5 82 Q77 74 78 62" tone={T.wood} width={2.8} />
    <Part d={rect(70.5, 2.5, 9, 19.5, 4.5)} tone={T.leather} shade={false} />
  </>;
}

export const frogPawn: Skin = {
  id: "frog-pot",
  kind: "pawn",
  name: "Frog",
  ref: "odd-pawn",
  head: FrogHead,
  body: FrogBody,
  armBack: () => <><Sleeve d={PAWN_ARMS.back} tone={T.frog} /><Hand at={PAWN_ARMS.backHand} /></>,
  armFront: () => <><Sleeve d={PAWN_ARMS.front} tone={T.frog} front /><Hand at={PAWN_ARMS.frontHand} /></>,
  prop: Cattail,
  quirk: "quirk-croak",
};
