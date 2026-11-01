import type { CSSProperties } from "react";
import type { Figure, PatrolHue, RigKind } from "./PieceRig";
import { Dot, Flat, Ink, Part, Pole, TONES, circle } from "./inkKit";
import { PAINTED, type Painted, type Place, type Xy } from "./paint/specs";

/** Painted sprites (`?art=paint`): image-generated parts (src/assets/paint/<id>/, made by
 * docs/art/recipes/paint-*.json and tools/art/cut-parts.mjs) hung on the same groups and
 * pivots as the drawn rigs, so the keyframes in rig.css drive them unchanged. One generic
 * builder; each character is data in paint/specs.ts. The face's dot eyes, KO crosses and
 * effort squint stay vector, so blink, hit and death still play on a painted head. */

const URLS = import.meta.glob<string>("../assets/paint/*/*.webp", { eager: true, import: "default" });
const SIZES = import.meta.glob<Record<string, [number, number]>>("../assets/paint/*/sizes.json", { eager: true, import: "default" });

type PartName = keyof Painted["parts"];
export type PartBox = { href: string; x: number; y: number; w: number; h: number; rotate: number; at: Xy };

/** A rig point after the character's `zoom` about the feet. */
const zoomed = (spec: Painted, [x, y]: Xy): Xy => { const z = spec.zoom ?? 1; return [50 + (x - 50) * z, 108 + (y - 108) * z]; };

/** The front fist in rig units: where the prop's grip lands. */
export function handOf(spec: Painted): Xy {
  const { anchor, at, hand, rotate = 0, scale = 1 } = spec.parts.armFront;
  const k = spec.unit * scale * (spec.zoom ?? 1), r = (rotate * Math.PI) / 180, [ax, ay] = zoomed(spec, at);
  const dx = (hand[0] - anchor[0]) * k, dy = (hand[1] - anchor[1]) * k;
  return [ax + dx * Math.cos(r) - dy * Math.sin(r), ay + dx * Math.sin(r) + dy * Math.cos(r)];
}

/** Where a part's image lands in rig units. Also used by the figure-bounds test. */
export function partBox(spec: Painted, name: PartName): PartBox | undefined {
  const raw = spec.parts[name];
  if (!raw) return undefined;
  const place: Place = { ...raw, at: raw.at ? zoomed(spec, raw.at) : handOf(spec) };
  const href = URLS[`../assets/paint/${spec.id}/${name}.webp`], size = SIZES[`../assets/paint/${spec.id}/sizes.json`]?.[name];
  if (!href || !size) throw new Error(`painted ${spec.id} has no ${name} part; run tools/art/cut-parts.mjs --install`);
  const k = spec.unit * (place.scale ?? 1) * (spec.zoom ?? 1);
  return { href, x: place.at[0] - place.anchor[0] * k, y: place.at[1] - place.anchor[1] * k, w: size[0] * k, h: size[1] * k, rotate: place.rotate ?? 0, at: place.at };
}

function Img({ spec, name }: { spec: Painted; name: PartName }) {
  const b = partBox(spec, name);
  if (!b) return null;
  return <image className={`paint-${name}`} href={b.href} x={b.x} y={b.y} width={b.w} height={b.h}
    transform={b.rotate ? `rotate(${b.rotate} ${b.at[0]} ${b.at[1]})` : undefined} preserveAspectRatio="none" />;
}

const origin = ([x, y]: Xy): CSSProperties => ({ transformOrigin: `${x}px ${y}px` });

/** Dot eyes, KO crosses and an effort squint over the painted head. `glow` eyes sit in a
 * dark void, so they and their crosses are light. */
function Face({ spec }: { spec: Painted }) {
  const f = spec.face;
  if (!f) return null;
  const xs = [f.x - f.gap, f.x + f.gap], z = spec.zoom ?? 1;
  return <g transform={z === 1 ? undefined : `translate(${50 * (1 - z)} ${108 * (1 - z)}) scale(${z})`}>
    <g className="face">
      {f.eyes !== false && <g className="eyes">{xs.map(x => <g key={x} className="pupil">
        {f.glow ? <Part d={circle(x, f.y, f.r)} tone={TONES.parchment} line="none" shade={false} /> : <Dot cx={x} cy={f.y} r={f.r} />}
      </g>)}</g>}
      <g className="ko-eyes">{xs.map(x => f.glow
        ? <Pole key={x} d={`M${x - 2.5} ${f.y - 2.5} L${x + 2.5} ${f.y + 2.5} M${x + 2.5} ${f.y - 2.5} L${x - 2.5} ${f.y + 2.5}`} tone={TONES.parchment} width={1.8} />
        : <Ink key={x} d={`M${x - 3} ${f.y - 3} L${x + 3} ${f.y + 3} M${x + 3} ${f.y - 3} L${x - 3} ${f.y + 3}`} />)}</g>
      {f.brows && <Ink d={f.brows} />}
    </g>
    {f.eyes !== false && !f.glow && <g className="mouth-yell">
      {xs.map(x => <Flat key={x} d={circle(x, f.y, f.r + 1.2)} fill={TONES[f.skin ?? "skin"].fill} />)}
      <Ink d={`M${xs[0] - 4} ${f.y - 3} L${xs[0] + 1} ${f.y} L${xs[0] - 4} ${f.y + 3} M${xs[1] + 4} ${f.y - 3} L${xs[1] - 1} ${f.y} L${xs[1] + 4} ${f.y + 3}`} />
    </g>}
  </g>;
}

export function buildPainted(spec: Painted): Figure {
  const { armBack, armFront, door } = spec.parts, hand = spec.parts.prop.at ? zoomed(spec, spec.parts.prop.at) : handOf(spec);
  const back = armBack && <g className="arm arm-back" style={origin(zoomed(spec, armBack.at))}><Img spec={spec} name="armBack" /></g>;
  return {
    body: <><Img spec={spec} name="body" />{spec.armBackOver && back}</>,
    armBack: spec.armBackOver ? undefined : back,
    // The prop rides inside the front arm, so the cheer raises it with the fist; the strike
    // still swings it alone about the fist (--prop-origin).
    armFront: <g className="arm arm-front" style={origin(zoomed(spec, armFront.at))}>
      <g className={`prop ${spec.propClass ?? ""}`}><Img spec={spec} name="prop" /></g>
      <Img spec={spec} name="armFront" />
    </g>,
    head: <>
      <Img spec={spec} name="head" />
      <Face spec={spec} />
      {door && <g className="door" style={origin(zoomed(spec, door.at))}><Img spec={spec} name="door" /></g>}
    </>,
    mouths: null,
    propOrigin: `${hand[0]}px ${hand[1]}px`,
    shield: zoomed(spec, spec.shield),
    mouth: [...zoomed(spec, [spec.mouth[0], spec.mouth[1]]), spec.mouth[2]],
  };
}

const key = (kind: RigKind, rebel: boolean) => `${rebel ? "rebel" : "patrol"}-${kind}`;
/** The painted parts are drawn in the patrol's royal blue only; the red hue keeps the drawn rig. */
export const hasPaintedArt = (kind: RigKind, rebel: boolean, hue: PatrolHue = "blue") => key(kind, rebel) in PAINTED && (rebel || hue === "blue");
export const paintedFigure = (kind: RigKind, rebel: boolean, hue: PatrolHue): Figure | undefined =>
  hasPaintedArt(kind, rebel, hue) ? buildPainted(PAINTED[key(kind, rebel)]) : undefined;
