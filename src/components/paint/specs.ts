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
    unit: 0.12,
    parts: {
      armBack: { anchor: [85, 40], at: [37.4, 61.4], scale: 0.8 },
      body: { anchor: [195, 488], at: [50, 108] },
      armFront: { anchor: [85, 40], at: [59.5, 63.5], scale: 0.72, hand: [230, 195] },
      prop: { anchor: [100, 560], scale: 0.7 },
      head: { anchor: [117, 300], at: [49.5, 57], scale: 1.15 },
      door: { anchor: [105, 10], at: [50.5, 30], scale: 1.1 },
    },
    face: { x: 51.3, y: 39.5, gap: 4.6, r: 2.2, glow: true },
    armBackOver: true,
    propClass: "sledge",
    shield: [27, 92],
    mouth: [50, 50, 5],
  },
  "patrol-rook": {
    id: "patrol-rook",
    unit: 0.105,
    parts: {
      armBack: { anchor: [190, 120], at: [38, 58] },
      body: { anchor: [185, 575], at: [50, 108] },
      armFront: { anchor: [123, 95], at: [57, 57], scale: 0.85, hand: [263, 265] },
      prop: { anchor: [95, 450], scale: 0.8 },
      head: { anchor: [130, 300], at: [48, 57], scale: 1.15 },
      door: { anchor: [115, 10], at: [48, 28], scale: 1.1 },
    },
    face: { x: 48, y: 38, gap: 6, r: 2.5, eyes: false },
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
    unit: 0.11,
    parts: {
      armBack: { anchor: [60, 45], at: [35, 67], scale: 0.8 },
      body: { anchor: [180, 40], at: [50, 60] },
      armFront: { anchor: [55, 50], at: [61, 66], hand: [170, 237], scale: 0.8 },
      prop: { anchor: [110, 520], scale: 0.8 },
      head: { anchor: [255, 440], at: [51, 64], scale: 0.92 },
    },
    face: { x: 50.5, y: 56.4, gap: 3.3, r: 1.7 },
    armBackOver: true,
    propClass: "pan",
    shield: [30, 90],
    mouth: [52, 60, 5],
  },
  "patrol-queen": {
    id: "patrol-queen",
    unit: 0.116,
    parts: {
      armBack: { anchor: [70, 40], at: [45.4, 65.5] },
      body: { anchor: [165, 100], at: [50, 58] },
      armFront: { anchor: [90, 50], at: [62.8, 65.5], hand: [118, 212] },
      prop: { anchor: [57, 420], scale: 1.1 },
      head: { anchor: [230, 505], at: [51, 60] },
    },
    face: { x: 50.4, y: 53.6, gap: 3.4, r: 1.6 },
    armBackOver: true,
    shield: [30, 90],
    mouth: [50, 58, 5],
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
