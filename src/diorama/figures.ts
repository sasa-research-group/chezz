// Which pieces are drawn as pre-rendered sprite figures (KingSprite) and under which file prefix: the figure
// "king" is public/diorama/king8.json, king8.webp, king8-glow.png, king-walk.json, king-walk{0..7}.webp ...
// Keyed "<side> <kind>". A piece not listed here is drawn as before (the 3D king, or a card).
export const SPRITE_FIGURES: Record<string, string> = {
  "white king": "king",
  // The patrol guard (enemy pawn): idle, walk, the two-handed spear lunge (strike) and his death when taken.
  "black pawn": "guard",
  // The rebel rook: hammer on his shoulder, and a one-handed overhead slam (strike) on a capture. No walk yet (he
  // slides on his still frame), and taken he falls without a death of his own.
  "white rook": "rook",
};

/** The figure prefix a piece is drawn with, or null when it has no pre-rendered sprite. */
export const spriteFigure = (pc: { kind: string; side: string }): string | null => SPRITE_FIGURES[`${pc.side} ${pc.kind}`] ?? null;

/** A capture plays the taker's attack (the king's sword strike, the guard's spear lunge) when it has a baked figure;
 *  any other taker just moves, and the piece it takes falls on its own. */
export const playsStrike = (pc: { kind: string; side: string }): boolean => spriteFigure(pc) !== null;

/** A capture keeps the taken piece on the board to fall (Diorama's Falling) when the taker plays an attack (it
 *  falls on the blow) or the taken piece is a baked figure (the guard plays his death, from the blow or at once). */
export const keepsTaken = (taker: { kind: string; side: string }, taken: { kind: string; side: string }): boolean =>
  playsStrike(taker) || spriteFigure(taken) !== null;
