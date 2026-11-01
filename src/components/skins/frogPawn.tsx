import { PAWN_ARMS, RebelPot, Sleeve } from "../ArmourPawns";
import { Dot, Flat, Ink, Part, Pole, TONES as T, circle, ellipse, rect } from "../inkKit";
import type { Skin } from "./index";

/** The frog in the saucepan, a rebel pawn skin (reference docs/art/odd-pawn.webp).
 * It wears RebelPot, so it follows any restyle of the rebel pawn's pan. A wide
 * flat frog head whose eye domes bulge out under and around the pan's lip, a
 * squat body on haunches, webbed hands and feet, and a cattail. */

const EYE_Y = 60, EYE_GAP = 12.5, EYE_R = 6.6, DOME_R = 8.8, LID = 2.4;
const eyeXs = [50 - EYE_GAP, 50 + EYE_GAP];
/** A heavy lid over the top of the eye, cut along a chord LID above its centre. */
const lidHalf = Math.sqrt(EYE_R ** 2 - LID ** 2);
const lid = (x: number) => `M${x - lidHalf} ${EYE_Y - LID} A${EYE_R} ${EYE_R} 0 0 1 ${x + lidHalf} ${EYE_Y - LID} Z`;

function FrogHead() {
  return <>
    <g transform="translate(2 0)">
      <g className="quirk-bit"><Part d={ellipse(50, 81.5, 7, 3.6)} tone={T.frogLight} line="inner" shade={false} /></g>
      <Part d={ellipse(50, 71, 19.5, 12.5)} tone={T.frog} />
      <Part d="M34.5 77 Q39 75.3 42 75.5 Q50 76.5 58 75.5 Q61 75.3 65.5 77 Q62 80.8 50 80.8 Q38 80.8 34.5 77 Z" tone={T.frogLight} line="none" shade={false} />
      <Ink d="M32 78.5 Q36 75 42 75.5 Q50 76.5 58 75.5 Q64 75 68 78.5" />
      <Part d={rect(eyeXs[0], 50, eyeXs[1] - eyeXs[0], 15)} tone={T.frog} shade={false} />
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
    </g>
    <Pole d="M34 46 Q29.5 76 46 84.5" tone={T.bandana} width={2.4} />
    <Part d={circle(49, 84.5, 3.4)} tone={T.bandana} line="inner" shade={false} />
    <g transform="translate(0 -9)"><RebelPot /></g>
  </>;
}

/** A webbed foot, two round toes along the ground. */
const Foot = ({ x }: { x: number }) => <Part tone={T.frog} shade={false} d={
  `M${x - 6} 107 Q${x - 5.5} 101 ${x} 101 Q${x + 5.5} 101 ${x + 6} 107 ` +
  `Q${x + 5} 109.5 ${x + 3} 107.8 Q${x} 110 ${x - 3} 107.8 Q${x - 5} 109.5 ${x - 6} 107 Z`} />;

/** A webbed hand: three round finger pads fanned toward `deg` (0 = right, 90 = down) under a palm. */
function Hand({ at: [x, y], deg }: { at: readonly [number, number]; deg: number }) {
  return <>
    {[-50, 0, 50].map(a => {
      const t = (deg + a) * Math.PI / 180;
      return <Part key={a} d={circle(x + 4.6 * Math.cos(t), y + 4.6 * Math.sin(t), 2.6)} tone={T.frogSpot} line="inner" shade={false} />;
    })}
    <Part d={circle(x, y, 4.6)} tone={T.frogSpot} line="inner" shade={false} />
  </>;
}

function FrogBody() {
  return <>
    <Part d="M33 103 Q29 87 38 78 Q50 73 62 78 Q71 87 67 103 Q50 107 33 103 Z" tone={T.frog} />
    <Part d={ellipse(38, 87, 3, 3.4)} tone={T.frogSpot} line="none" shade={false} />
    <Part d={ellipse(50, 93, 10, 8.5)} tone={T.frogLight} line="inner" shade={false} />
    <Part d="M38 81 L25.5 77 L28.5 87.5 Z M38 82 L27.5 92 L37.5 90.5 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d="M39 82 Q50 87 61 82 L53 93 Q50 95.5 47 93 Z" tone={T.bandana} line="inner" shade={false} />
    <Part d={ellipse(36, 100, 6.5, 5.5)} tone={T.frog} shade={false} />
    <Part d={ellipse(64, 100, 6.5, 5.5)} tone={T.frog} shade={false} />
    <Foot x={38} /><Foot x={62} />
  </>;
}

function Cattail() {
  return <>
    <Pole d="M71 105 L74 30" tone={T.reed} width={3.2} />
    <Pole d="M71.5 82 Q77 74 78 61" tone={T.reed} width={2.6} />
    <Pole d="M72.5 66 Q67 58 66.5 49" tone={T.reed} width={2.4} />
    <Pole d="M75 9 L75.3 4.5" tone={T.reed} width={1.8} />
    <g transform="rotate(4 74.5 19)"><Part d={rect(70, 8, 9, 22, 4.5)} tone={T.leather} shade={false} /></g>
  </>;
}

export const frogPawn: Skin = {
  id: "frog-pot",
  kind: "pawn",
  name: "Frog",
  ref: "odd-pawn",
  head: FrogHead,
  body: FrogBody,
  armBack: () => <><Sleeve d={PAWN_ARMS.back} tone={T.frog} /><Hand at={PAWN_ARMS.backHand} deg={110} /></>,
  armFront: () => <><Sleeve d={PAWN_ARMS.front} tone={T.frog} front /><Hand at={PAWN_ARMS.frontHand} deg={-10} /></>,
  prop: Cattail,
  quirk: "quirk-croak",
};
