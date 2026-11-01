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
  copperLight: tone("#c9955f", "#9f7853"), // picked: the saucepan's rolled lip, so it reads as metal, not a hat band
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
  mail: tone("#4b5263", "#363b48"),
  stone: tone("#a2a4a4", "#76787a"), // shade picked
  darkStone: tone("#6b7077", "#4c5056"), // the rebel rook's mallet head, darker than his helm so the two never merge; picked
  helmSteel: tone("#9aa7b8", "#6c788a"), // the patrol rook's great-helm: blue-grey, so it reads as steel, not cloth; picked
  parchment: tone("#e7d5ac", "#c9b388"), // the rebel rook's glowing eyes and the rebel bishop's mitre; shade picked
  void: tone(INK, INK), // a helm's eye slot: flat ink with no shadow
  neckerchief: tone("#3275a9", "#245580"), // the rebel knight's accent; shade picked
  rust: tone("#a5562c", "#7c3f1f"), // picked: rust blotches on the rebel knight's bucket
  barding: tone("#d6dce4", "#9aa6b4"), // picked: the patrol horse's barding, lighter than his helm steel and the grey coat
  horse: tone("#bdb6ad", "#8f877d"), // picked: the patrol horse's grey coat, warmer than the steel barding
  // Frog tones sampled from docs/art/odd-pawn.webp.
  frog: tone("#7cb04c", "#52883b"),
  frogLight: tone("#a7d274", "#7cb04c"), // throat and belly; shade reuses frog green
  frogSpot: tone("#659b49", "#52883b"),
  frogEye: tone("#fdf9b0", "#e3d98a"), // the sheet's eyes are flat; shade picked
  reed: tone("#9aa64a", "#6e7a30"), // picked: the cattail stem, apart from the frog's green
  // Haystack rook tones: hay sampled from docs/art/odd-rook.webp (docs/art-style.md section 7).
  hay: tone("#ebbe52", "#b2833d"),
  straw: tone("#c9953f", "#9c6f2c"), // picked: the haystack's straw mitten, a step darker than the hay
  // Bishops, sampled from docs/art/rebel-bishop.webp and patrol-bishop.webp unless marked.
  mitreBand: tone("#cdab69", "#a8884c"), // the rebel mitre's bands; shade picked
  hood: tone("#7a7068", "#5e554e"), // picked: much lighter than the sheet's #423d34, or hood, void and robe merge at 48px
  cowl: tone("#8a8580", "#6b6762"), // picked: the rebel capelet, between hood and robe so the three part
  robeGrey: tone("#a3a09a", "#7f7c77"), // picked: the rebel bishop's robe, lighter than the sheet's so it parts from the hood
  patchYellow: tone("#eecd02", "#c2a700"), // shade picked
  glow: tone("#f9e998", "#d9c46a"), // the rebel bishop's eyes in the hood void; shade picked
  goldDeep: tone("#cb8e24", "#9e6a14"), // the bands on the patrol's gilded mitre; shade picked
  lens: tone("#d6ebf7", "#a2c5ed"), // picked: paler than the sheet's lens so it parts from the steel helm
  glove: tone("#f4f1ea", "#cfcac0"), // picked
  // Kings, sampled from docs/art/rebel-king.webp and patrol-king.webp unless marked.
  crimson: tone("#a62f42", "#7a2131"), // the rebel king's cloak; shade picked
  beard: tone("#86663f", "#64492b"), // picked: lighter than the sheet's #665136, which merged with the ink at 48px
  fur: tone("#efe3c8", "#cdbb98"), // picked: the rebel cloak's fur collar
  moustache: tone("#744924", "#56351a"), // the patrol king's painted moustache, goatee and curls; shade picked
  mask: tone("#8fa0b8", "#64738c"), // picked: the patrol king's sculpted mask, bluer than the rook's helm steel
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

