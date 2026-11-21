// Which pieces are drawn as pre-rendered sprite figures (KingSprite) and under which file prefix: the figure
// "king" is public/diorama/king8.json, king8.webp, king8-glow.png, king-walk.json, king-walk{0..7}.webp ...
// Keyed "<side> <kind>". A piece not listed here is drawn as before (the 3D king, or a card).
export const SPRITE_FIGURES: Record<string, string> = {
  "white king": "king",
  // The patrol guard goes in as `"black pawn": "guard",` once public/diorama/guard8.json (and its sheets) is installed.
};

/** The figure prefix a piece is drawn with, or null when it has no pre-rendered sprite. */
export const spriteFigure = (pc: { kind: string; side: string }): string | null => SPRITE_FIGURES[`${pc.side} ${pc.kind}`] ?? null;
