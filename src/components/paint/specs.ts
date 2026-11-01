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
    /** The king's crown, painted apart from the head so the checkmate finale can throw it off.
     * `at` only places it: the finale spins it about its own centre (rig.css). */
    crown?: Place;
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
  "rebel-king": {
    id: "rebel-king",
    unit: 0.12,
    zoom: 1.1,
    parts: {
      armBack: { anchor: [170, 50], at: [37, 66], scale: 0.75 },
      body: { anchor: [240, 464], at: [50, 108] },
      armFront: { anchor: [75, 60], at: [51.5, 66], scale: 0.833, hand: [240, 165] },
      prop: { anchor: [88, 490] },
      head: { anchor: [207, 420], at: [52, 80], scale: 0.86 },
      crown: { anchor: [165, 175], at: [51, 48.5], scale: 1.05 },
    },
    face: { x: 51.8, y: 52.8, gap: 4, r: 2.2 },
    shield: [32, 86],
    mouth: [50, 62, 5],
  },
  "patrol-king": {
    id: "patrol-king",
    unit: 0.1,
    parts: {
      armBack: { anchor: [95, 40], at: [33, 66], scale: 0.8 },
      body: { anchor: [240, 526], at: [50, 108] },
      armFront: { anchor: [90, 70], at: [50.4, 66], scale: 0.8, hand: [360, 205] },
      prop: { anchor: [114, 575], scale: 0.75 },
      head: { anchor: [260, 390], at: [52, 66], scale: 0.95 },
      crown: { anchor: [200, 210], at: [51, 40], scale: 0.95 },
    },
    face: { x: 51.5, y: 47, gap: 5.2, r: 2.5, eyes: false },
    shield: [32, 86],
    mouth: [50, 62, 5],
  },
  "rebel-bishop": {
    id: "rebel-bishop",
    unit: 0.1,
    parts: {
      armBack: { anchor: [100, 50], at: [38, 56] },
      body: { anchor: [182, 652], at: [50, 108] },
      armFront: { anchor: [110, 53], at: [59.8, 55], hand: [197, 273] },
      prop: { anchor: [56, 463], scale: 1.15 },
      head: { anchor: [158, 405], at: [51, 62], scale: 1.4 },
    },
    face: { x: 51, y: 46, gap: 3.6, r: 2.2, glow: true },
    armBackOver: true,
    shield: [34, 84],
    mouth: [50, 62, 5],
  },
  "patrol-bishop": {
    id: "patrol-bishop",
    unit: 0.12,
    parts: {
      armBack: { anchor: [72, 45], at: [32, 68] },
      body: { anchor: [210, 455], at: [47, 108], scale: 1.05 },
      armFront: { anchor: [129, 47], at: [61, 72], hand: [189, 193] },
      prop: { anchor: [67, 570], scale: 1.1 },
      head: { anchor: [131, 373], at: [46, 64], scale: 1.3 },
    },
    face: { x: 51.5, y: 47.3, gap: 6, r: 2.5, eyes: false },
    armBackOver: true,
    shield: [34, 84],
    mouth: [50, 62, 5],
  },
  "rebel-queen": {
    id: "rebel-queen",
    unit: 0.105,
    parts: {
      armBack: { anchor: [165, 60], at: [36, 66] },
      body: { anchor: [230, 552], at: [50, 108] },
      armFront: { anchor: [95, 40], at: [58, 66], hand: [250, 195], scale: 0.85 },
      prop: { anchor: [112, 480], scale: 0.75 },
      head: { anchor: [202, 395], at: [49, 57], scale: 1.1 },
    },
    face: { x: 50.3, y: 45.8, gap: 3.9, r: 1.6, brows: "M44.6 42.6 L48.2 43.9 M56 42.6 L52.4 43.9" },
    armBackOver: true,
    propClass: "pan",
    shield: [30, 90],
    mouth: [52, 50, 5],
  },
  "patrol-queen": {
    id: "patrol-queen",
    unit: 0.11,
    parts: {
      armBack: { anchor: [80, 55], at: [42.3, 60.9] },
      body: { anchor: [240, 668], at: [50, 108] },
      armFront: { anchor: [75, 55], at: [58.8, 60.9], hand: [210, 165] },
      prop: { anchor: [58, 341] },
      head: { anchor: [195, 480], at: [50.5, 58.2] },
    },
    face: { x: 51.6, y: 48.5, gap: 2.75, r: 1.4 },
    armBackOver: true,
    shield: [30, 90],
    mouth: [51, 52, 5],
  },
};
