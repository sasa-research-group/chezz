import type { RigKind } from "./PieceRig";
import SIZES from "../assets/sprites/sizes.json";

/** Painted sprites (the game's art): one whole image per character, eyes painted in
 * (src/assets/sprites/<side>-<kind>.webp, and skin-<skin id>.webp for a painted skin, made by
 * docs/art/recipes/paint-*.json and tools/art/sprite.mjs). The game's only art. No parts and no rig:
 * PieceRig draws the image inside its root groups (.flip › .hop › .squash), so every animation moves the whole figure. */

const URLS = import.meta.glob<string>("../assets/sprites/*.webp", { eager: true, import: "default" });
const SIZE: Record<string, number[]> = SIZES;

/** Tallest a sprite may stand, in viewBox units, before the x 18–82 width cap applies. */
const HEIGHT: Record<RigKind, number> = { pawn: 84, knight: 98, bishop: 102, rook: 98, queen: 102, king: 102 };
const LEFT = 18.5, RIGHT = 81.5, FEET = 108;

export type SpriteBox = { href: string; x: number; y: number; w: number; h: number };
const key = (kind: RigKind, rebel: boolean) => `${rebel ? "rebel" : "patrol"}-${kind}`;
const SKIN = "skin-";
/** The twelve base pieces (`rebel-king`, `patrol-pawn`, …). */
export const SPRITE_IDS = Object.keys(SIZE).filter(id => !id.startsWith(SKIN));
/** Skin ids that have a painted sprite (`skin-<id>.webp`); a skin without one draws as its base piece. */
export const PAINTED_SKINS = Object.keys(SIZE).filter(id => id.startsWith(SKIN)).map(id => id.slice(SKIN.length));
/** The seated cat fills its whole box and outweighs the cast, so it stands shorter than a king. */
const SKIN_HEIGHT: Record<string, number> = { "cat-king": 90 };

export const hasSkinSprite = (skin: string | undefined) => !!skin && `${SKIN}${skin}` in SIZE;

/** Where the sprite lands in viewBox units: feet on the ground line, centred, inside x 18–82 and y ≥ 0.
 * A painted `skin` takes the place of the rebel's own sprite. */
export function spriteBox(kind: RigKind, rebel: boolean, skin?: string): SpriteBox | undefined {
  const id = skin ? `${SKIN}${skin}` : key(kind, rebel), size = SIZE[id], href = URLS[`../assets/sprites/${id}.webp`];
  if (!size || !href) return undefined;
  const tallest = (skin && SKIN_HEIGHT[skin]) || HEIGHT[kind];
  const [pw, ph] = size, k = Math.min(tallest / ph, (RIGHT - LEFT) / pw), w = pw * k, h = ph * k;
  return { href, x: 50 - w / 2, y: FEET - h, w, h };
}

export function SpriteImage({ box }: { box: SpriteBox }) {
  return <image className="sprite" href={box.href} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="none" />;
}

/** The checkmate crown: the painted crown can't come off a whole sprite, so a gold crown
 * particle (the old rig's crown shape) launches from the top of the head as the king falls. */
export function CrownFx({ box }: { box: SpriteBox }) {
  return <g className="fx-crown" transform={`translate(${box.x + box.w * .5} ${box.y + 8}) scale(.62)`}>
    <g className="fx-crown-spin">
      <path d="M-14 9 L-17 -6 L-8 1 L0 -10 L8 1 L17 -6 L14 9 Z" fill="#e7ba58" stroke="#382f2e" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M-14 9 L14 9" stroke="#c0913c" strokeWidth="3" /><circle cx="0" cy="3" r="2.4" fill="#c8504a" stroke="#382f2e" strokeWidth="1.2" />
    </g>
  </g>;
}
