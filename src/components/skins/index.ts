import type { RigKind } from "../PieceRig";

/** An unlockable look for one rebel piece (docs/art/SKINS.md): a painted sprite,
 * src/assets/sprites/skin-<id>.webp, drawn in place of the piece's own. */
export type Skin = {
  id: string;
  kind: RigKind;
  name: string;
  /** Reference crop in docs/art/ that the sprite was painted from. */
  ref: string;
};

/** Rebel skins in unlock order: finishing a run unlocks the first one not yet owned. */
export const SKINS: Skin[] = [
  { id: "frog-pot", kind: "pawn", name: "Frog", ref: "odd-pawn" },
  { id: "haystack", kind: "rook", name: "Haystack", ref: "odd-rook" },
  { id: "empty-knight", kind: "knight", name: "Empty knight", ref: "odd-knight" },
  { id: "goose-mitre", kind: "bishop", name: "Goose", ref: "odd-bishop" },
  { id: "candle-queen", kind: "queen", name: "Candle queen", ref: "odd-queen" },
  { id: "cat-king", kind: "king", name: "Cat king", ref: "odd-king" },
];

export const skinById = (id: string | undefined) => id ? SKINS.find(s => s.id === id) : undefined;
