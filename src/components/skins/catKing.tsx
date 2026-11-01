import { Flat, Ink, Part, TONES as T, circle, ellipse } from "../inkKit";
import type { Skin } from "./index";

/** The cat king, a rebel king skin (reference docs/art/odd-king.webp): a sleepy
 * orange tabby sitting under a gold crown far too big for it. The crown slips
 * down over one side of its head and squashes an ear out sideways; it is the
 * `.crown` group, so the checkmate finale throws it off. Face per the guide's
 * creature limit: closed-eye arcs, a nose and whiskers. No arms and no prop:
 * the strike is the body's lunge. */

const EYE_Y = 58, eyeXs = [43.5, 58.5];

/** Three bold points over a red velvet cap, tilted well over as it slides off.
 * Three, not five: more points fill their gaps with ink at 48px. */
function BigCrown() {
  return <g className="crown"><g transform="rotate(-15 50 40)">
    <Part d="M29 41 Q29 24 50 24 Q71 24 71 41 Z" tone={T.velvet} shade={false} />
    <Part d="M25 47 L24.5 25 L36 34.5 L50 18.5 L64 34.5 L77.5 25 L75 47 Z" tone={T.gold} highlight="M28 42 L27 32" />
    <Part d="M24.6 39.5 L75.4 39.5 L75 47 L25 47 Z" tone={T.goldDeep} line="inner" shade={false} />
    <Part d="M50 38.5 L54 43.3 L50 48 L46 43.3 Z" tone={T.bandana} line="inner" shade={false} />
    {[34, 66].map(x => <Part key={x} d={circle(x, 43.3, 3)} tone={T.neckerchief} line="none" shade={false} />)}
  </g></g>;
}

function CatHead() {
  return <>
    <Part d="M63 47.5 L79.5 56.5 L66 67 Z" tone={T.cat} shade={false} />
    <Part d="M70 53 L76.5 56.5 L70 61.5 Z" tone={T.catPale} line="none" shade={false} />
    <Part d={ellipse(51, 59, 22, 14.5)} tone={T.cat} />
    <Flat d="M32.5 55 L37 56 L32.5 59 Z M69.5 55 L65 56 L69.5 59 Z" fill={T.catStripe.fill} />
    <Part d={ellipse(51, 65.5, 8.5, 5.5)} tone={T.catPale} line="none" shade={false} />
    <g className="face">
      <g className="eyes">{eyeXs.map(x => <g key={x} className="pupil"><Ink d={`M${x - 4} ${EYE_Y - 1} Q${x} ${EYE_Y + 3.5} ${x + 4} ${EYE_Y - 1}`} /></g>)}</g>
      <g className="ko-eyes">{eyeXs.map(x => <Ink key={x} d={`M${x - 2.8} ${EYE_Y - 2.8} L${x + 2.8} ${EYE_Y + 2.8} M${x + 2.8} ${EYE_Y - 2.8} L${x - 2.8} ${EYE_Y + 2.8}`} />)}</g>
    </g>
    <Part d="M48.5 62 L53.5 62 L51 65 Z" tone={T.lips} line="inner" shade={false} />
    <Ink d="M38 64 L24 61.5 M38.5 67.5 L25 70 M64 64 L78 61.5 M63.5 67.5 L77 70" weight="inner" />
    <g className="mouth-yell">
      {eyeXs.map(x => <Flat key={x} d={ellipse(x, EYE_Y, 5.5, 4)} fill={T.cat.fill} />)}
      <Ink d={`M${eyeXs[0] - 3} ${EYE_Y - 2.6} L${eyeXs[0] + 1.8} ${EYE_Y} L${eyeXs[0] - 3} ${EYE_Y + 2.6} M${eyeXs[1] + 3} ${EYE_Y - 2.6} L${eyeXs[1] - 1.8} ${EYE_Y} L${eyeXs[1] + 3} ${EYE_Y + 2.6}`} />
    </g>
    <BigCrown />
  </>;
}

/** A sitting tabby: a round body with a pale chest, bold flank stripes, the
 * tail wrapped round the front with its tip curling up past the body, and two
 * front paws on it. The body's top rises well behind the head, so when the
 * head pops in death the shoulders show outlined rather than a gap. */
function CatBody() {
  return <>
    <Part d="M27 106 Q22 90 30 74 Q35 60 51 59 Q67 60 72 74 Q79 90 74 106 Z" tone={T.cat} />
    <Flat d="M28.8 86 L36 84 L36.5 87.5 L28.3 89.5 Z M72 82 L64 80 L63.5 85 L73.4 87.3 Z M74 92.2 L64.5 90.5 L64 95.5 L74.2 97.6 Z" fill={T.catStripe.fill} />
    <Part d="M41 76 Q51 72 61 76 Q63 90 59 99 L43 99 Q39 90 41 76 Z" tone={T.catPale} line="inner" shade={false} />
    <Part d="M23.5 102 Q25 108.5 50 108.5 Q71 108.5 76.5 102 Q80.5 97 79 91.5 Q77 88 73.5 90 Q75.5 95.5 71.5 99 Q66 103 50 103 Q32 103 26 98.5 Z" tone={T.cat} shade={false} />
    {[43, 59].map(x => <Part key={x} d={ellipse(x, 102, 6.5, 4.3)} tone={T.catPale} line="inner" shade={false} />)}
  </>;
}

export const catKing: Skin = {
  id: "cat-king",
  kind: "king",
  name: "Cat king",
  ref: "odd-king",
  head: CatHead,
  body: CatBody,
  back: () => null,
  armBack: () => null,
  armFront: () => null,
  prop: () => null,
};
