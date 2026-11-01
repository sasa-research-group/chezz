import type { TONES } from "../inkKit";

/** One painted character: where each generated part sits in the rig's 100×120 viewBox
 * (feet at y 108, facing right). A new character is a recipe
 * (docs/art/recipes/paint-<id>.json), its cut parts (src/assets/paint/<id>/) and one entry
 * here; docs/art/PAINTED.md has the steps.
 *
 * Each part pins one pixel of its own image (`anchor`, in the cut image's pixels) to a rig
 * point (`at`), and that point is also the part's pivot: the shoulders for the arms (the
 * cheer raises them), the fist for the prop (the strike swings it), the top edge for the
 * door (it drops over the face). */

export type Xy = [number, number];
/** `rotate` turns the part (degrees, clockwise) about `at`; `scale` multiplies the character's `unit`. */
export type Place = { anchor: Xy; at: Xy; rotate?: number; scale?: number };
export type Painted = {
  /** Folder under src/assets/paint/. */
  id: string;
  /** Rig units per image pixel, shared by every part so they keep the sheet's relative sizes. */
  unit: number;
  /** Scales the whole figure about the feet (50, 108): every `at`, the face, shield and sweat. */
  zoom?: number;
  parts: {
    head: Place; body: Place; armBack?: Place;
    /** `hand`: the fist's centre in the arm image; the prop's grip lands there. */
    armFront: Place & { hand: Xy };
    /** `anchor` is the grip; `at` defaults to the front fist. */
    prop: Omit<Place, "at"> & { at?: Xy };
    door?: Place;
  };
  /** Vector face over the painted head. `glow` draws light eyes for a dark void; `eyes:
   * false` keeps the painted eyes (no blink); `skin` is the lid colour for the squint. */
  face?: { x: number; y: number; gap: number; r: number; glow?: boolean; eyes?: false; brows?: string; skin?: keyof typeof TONES };
  /** Draw the back arm over the body, for a torso painted with an empty armhole. */
  armBackOver?: boolean;
  /** Extra class on the prop group, for a piece-specific strike in rig.css. */
  propClass?: string;
  shield: Xy;
  /** Anchor for the sweat drop: [x, y, width]. */
  mouth: [number, number, number];
};

export const PAINTED: Record<string, Painted> = {
  "rebel-pawn": {
    id: "rebel-pawn",
    unit: 0.105,
    parts: {
      armBack: { anchor: [75, 50], at: [38.8, 66.7] },
      body: { anchor: [176, 85], at: [51, 63] },
      armFront: { anchor: [95, 45], at: [63, 66.7], hand: [163, 260] },
      prop: { anchor: [79, 557], scale: 1.15 },
      head: { anchor: [312, 318], at: [55, 66], scale: 1.1 },
    },
    face: { x: 58.1, y: 57.8, gap: 5.3, r: 2.7 },
    shield: [38, 90],
    mouth: [52, 62, 5],
  },
  "patrol-pawn": {
    id: "patrol-pawn",
    unit: 0.1,
    zoom: 1.08,
    parts: {
      armBack: { anchor: [78, 75], at: [40.5, 63.7] },
      body: { anchor: [146, 70], at: [50, 61.7] },
      armFront: { anchor: [101, 75], at: [60.5, 63.7], hand: [166, 230] },
      prop: { anchor: [55, 521], scale: 1.2 },
      head: { anchor: [166, 290], at: [50, 64], scale: 1.2 },
    },
    face: { x: 50, y: 58.6, gap: 5.5, r: 2.6, brows: "M41 53 L46.5 54.8 M59 53 L53.5 54.8" },
    armBackOver: true,
    shield: [36, 90],
    mouth: [50, 62, 5],
  },
  "rebel-rook": {
    id: "rebel-rook",
    unit: 0.1125,
    parts: {
      armBack: { anchor: [81, 45], at: [30.4, 60] },
      body: { anchor: [224, 85], at: [50, 55] },
      armFront: { anchor: [205, 70], at: [64.6, 60], hand: [250, 345] },
      prop: { anchor: [121, 670], scale: 0.85 },
      head: { anchor: [134, 356], at: [49, 57], scale: 1.2 },
      door: { anchor: [126, 12], at: [50.6, 33], scale: 0.82 },
    },
    face: { x: 50.6, y: 38, gap: 4.1, r: 2.5, glow: true },
    armBackOver: true,
    shield: [27, 92],
    mouth: [50, 50, 5],
  },
  "patrol-rook": {
    id: "patrol-rook",
    unit: 0.13,
    parts: {
      armBack: { anchor: [110, 110], at: [36.4, 58.5] },
      body: { anchor: [140, 60], at: [50, 53] },
      armFront: { anchor: [126, 110], at: [57.6, 57], hand: [206, 325] },
      prop: { anchor: [86, 643], scale: 0.95 },
      head: { anchor: [118, 298], at: [49, 58], scale: 1.15 },
      door: { anchor: [96, 12], at: [49, 28.5], scale: 1.05 },
    },
    face: { x: 49, y: 38.1, gap: 6.4, r: 2.5, eyes: false },
    armBackOver: true,
    shield: [26, 92],
    mouth: [50, 50, 5],
  },
  "rebel-knight": {
    id: "rebel-knight",
    unit: 0.086,
    parts: {
      armBack: { anchor: [70, 40], at: [29.5, 67], scale: 0.85 },
      body: { anchor: [180, 40], at: [44, 61.5] },
      armFront: { anchor: [165, 50], at: [55, 67], hand: [215, 225], scale: 0.8 },
      prop: { anchor: [345, 285], scale: 1.05 },
      head: { anchor: [135, 275], at: [44, 58], scale: 1.45 },
    },
    face: { x: 50.3, y: 42.4, gap: 4.3, r: 2 },
    armBackOver: true,
    shield: [29, 88],
    mouth: [46, 52, 5],
  },
  "patrol-knight": {
    id: "patrol-knight",
    unit: 0.105,
    parts: {
      armBack: { anchor: [75, 85], at: [50.5, 56] },
      body: { anchor: [300, 601], at: [50, 108] },
      armFront: { anchor: [190, 80], at: [39.5, 55], hand: [55, 200] },
      prop: { anchor: [55, 410], scale: 1.1 },
      head: { anchor: [205, 290], at: [46.5, 51], scale: 1.05 },
    },
    face: { x: 48.2, y: 40.7, gap: 3.3, r: 2.5, eyes: false },
    armBackOver: true,
    shield: [30, 84],
    mouth: [48, 48, 5],
  },
};
