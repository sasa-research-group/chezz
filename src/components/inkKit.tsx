import { useId, type CSSProperties } from "react";

/** The shape kit for art in the docs/art-style.md style. New character art draws
 * only with these components and tokens; tests/ink-kit.test.ts enforces it.
 *
 * Light comes from the upper left of the screen. A part's cel shadow is not
 * drawn by hand: the kit fills the part with its shadow tone, then lays a copy
 * of the part shifted toward the light on top, so the uncovered crescent on the
 * lower right is the shadow. The shift is multiplied by the rig's --face, so a
 * figure mirrored to face left is still lit from the upper left. Everything is
 * clipped to the part and the outline is painted last. */

export const INK = "#1f1a19";
/** Stroke widths in rig viewBox units (100×120). `outer` traces the silhouette,
 * `inner` traces parts inside it, `face` draws brows and squints, `shine` the
 * highlight tick, `side` is the ink each side of a pole. */
export const WEIGHT = { outer: 4.5, inner: 2.8, face: 2.6, shine: 2.8, side: 2.4 } as const;
/** How far the lit copy shifts, in viewBox units. About 2.2 of it hides under the outline. */
export const SHADE = { x: 5.5, y: 4 } as const;
export const SHINE = "#fffaf0";

export type Tone = { fill: string; shade: string };
const tone = (fill: string, shade: string): Tone => ({ fill, shade });

/** docs/art-style.md section 7. Shades not sampled from the sheet are marked. */
export const TONES = {
  skin: tone("#f0be9a", "#d99a74"), // shade picked, not sampled
  copper: tone("#9f7853", "#6e4f33"), // shade darker than the sheet's #896749, which vanished at game size
  shirtGreen: tone("#869043", "#646d2f"),
  bandana: tone("#cd2a25", "#94201c"),
  patchBlue: tone("#507b92", "#3b5e70"),
  leatherDark: tone("#5f3f2c", "#47301f"),
  leather: tone("#865637", "#69432a"),
  wood: tone("#a57952", "#80583a"),
  rustySteel: tone("#8a9094", "#6a7074"),
  royalBlue: tone("#4b76cf", "#314e8f"),
  gold: tone("#f0bf44", "#cb8e24"),
  steel: tone("#a9c1d6", "#617085"),
  moustache: tone("#744924", "#56351a"),
  mail: tone("#4b5263", "#363b48"),
} as const;

const clipId = (raw: string) => `ink${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
const LIT: CSSProperties = { transform: `translate(calc(var(--face, 1) * ${-SHADE.x}px), ${-SHADE.y}px)` };
/** Mirrors a highlight about its part's own box when the rig faces left, so it stays upper left. */
const SHINE_FLIP: CSSProperties = { transformBox: "fill-box", transformOrigin: "center", transform: "scaleX(var(--face, 1))" };

type Line = "outer" | "inner" | "none";
/** One part: flat fill, the derived shadow and an optional highlight tick, both
 * clipped to the part's own path, then the outline on top. */
export function Part({ d, tone: t, line = "outer", shade = true, highlight, className }: {
  d: string; tone: Tone; line?: Line; shade?: boolean; highlight?: string; className?: string;
}) {
  const id = clipId(useId());
  const clipped = shade || highlight;
  return <g className={className}>
    <path d={d} fill={t.fill} />
    {clipped && <clipPath id={id}><path d={d} /></clipPath>}
    {clipped && <g clipPath={`url(#${id})`}>
      {shade && <><path d={d} fill={t.shade} /><path d={d} fill={t.fill} style={LIT} /></>}
      {highlight && <g style={SHINE_FLIP}><path d={d} fill="none" /><path d={highlight} fill="none" stroke={SHINE} strokeWidth={WEIGHT.shine} strokeLinecap="round" /></g>}
    </g>}
    {line !== "none" && <path d={d} fill="none" stroke={INK} strokeWidth={WEIGHT[line]} strokeLinejoin="round" strokeLinecap="round" />}
  </g>;
}

/** A pole, shaft, tine or trim: an ink stroke under a colour stroke `width` wide. Flat, no shadow. */
export function Pole({ d, tone: t, width, className }: { d: string; tone: Tone; width: number; className?: string }) {
  return <g className={className} fill="none" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} stroke={INK} strokeWidth={width + 2 * WEIGHT.side} />
    <path d={d} stroke={t.fill} strokeWidth={width} />
  </g>;
}

/** A bare ink line: brows, squints, KO crosses, seams. */
export function Ink({ d, weight = "face" }: { d: string; weight?: "face" | "inner" }) {
  return <path d={d} fill="none" stroke={INK} strokeWidth={WEIGHT[weight]} strokeLinecap="round" strokeLinejoin="round" />;
}

/** A solid ink dot: eyes. */
export const Dot = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => <circle cx={cx} cy={cy} r={r} fill={INK} />;

/** A flat patch of colour with no line and no shadow, for covering (the squint's lids). */
export const Flat = ({ d, fill }: { d: string; fill: string }) => <path d={d} fill={fill} />;

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);
export const ellipse = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy} A${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
export const rect = (x: number, y: number, w: number, h: number, r = 0) =>
  `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y} Z`;

