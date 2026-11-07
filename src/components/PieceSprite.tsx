import type { CSSProperties } from "react";
import type { Kind } from "../game/turns";
import type { Variant } from "../game/abilities";
import type { RigAction } from "./PieceRig";
import "../sprite.css";

/** The cast as drawn on Wesley's character-select sheet: one portrait per variant and kind, sliced
 * from the sheet into public/art/cast/<variant>-<kind>.png. The sprite plays the same action
 * vocabulary as PieceRig with CSS keyframes on the image, so App can drive either art. */
export const spriteSrc = (variant: Variant, kind: Kind) => `${import.meta.env.BASE_URL}art/cast/${variant}-${kind}.png`;

export function PieceSprite({ kind, variant, side, action = "idle", facing = 1, defending = false, wounded = false, seed = 0 }: {
  kind: Kind; variant: Variant; side: "white" | "black"; action?: RigAction; facing?: 1 | -1; defending?: boolean; wounded?: boolean; seed?: number | string;
}) {
  // A stable per-piece offset so idle loops don't march in step.
  const n = typeof seed === "number" ? seed : [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);
  const style = { "--face": facing, "--seed": `${(n % 7) * -0.37}s` } as CSSProperties;
  return <div className={`sprite sp-${kind} sp-${variant} ${side} act-${action} ${defending ? "is-defending" : ""} ${wounded ? "is-wounded" : ""}`} style={style} aria-hidden="true">
    <span className="sprite-shadow" />
    <div className="sprite-flip"><div className="sprite-hop"><div className="sprite-squash">
      <img src={spriteSrc(variant, kind)} alt="" draggable={false} />
    </div></div></div>
    <span className="sprite-fx" />
  </div>;
}
