import type { CSSProperties } from "react";
import { skinById } from "./skins";
import { CrownFx, SpriteImage, hasSkinSprite, spriteBox } from "./SpriteRig";

/** A cast of misfits. Each chess piece is a distinct character whose costume
 * echoes its chess shape; rebels (white) are patched exiles, the patrol
 * (black) are prim royal guards. Each is one painted sprite (SpriteRig.tsx), skins included,
 * moved whole: src/rig.css holds the groups and shared effects, src/sprite.css the keyframes. */
export type RigKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type RigSide = "white" | "black";
export type RigAction = "idle" | "move" | "attack" | "hit" | "death" | "cheer" | "leap" | "leap-back" | "mate";

export const INK = "#382f2e";
const GOLD = "#e7ba58";
/** How long each one-shot action plays at 1x (ms); the keyframes in rig.css and sprite.css use the same values. */
export const RIG_MS: Record<RigAction, number> = { idle: 0, move: 480, attack: 560, hit: 420, death: 900, cheer: 1400, leap: 340, "leap-back": 420, mate: 2600 };

/** `skin` is a skin id from components/skins; it applies to rebels of the skin's kind that have a
 * painted sprite, and is ignored otherwise. */
export function PieceRig({ kind, side, action = "idle", facing = 1, seed = 0, wounded = false, skin: skinId }: {
  kind: RigKind; side: RigSide; action?: RigAction; facing?: 1 | -1; seed?: number | string; wounded?: boolean; skin?: string;
}) {
  const rebel = side === "white";
  const found = skinById(skinId), skin = found && rebel && found.kind === kind && hasSkinSprite(found.id) ? found : undefined;
  const sprite = spriteBox(kind, rebel, skin?.id);
  // A stable per-piece number (ids hash), so idle loops don't jump when the cast changes.
  const n = typeof seed === "number" ? seed : [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);
  const style = { "--seed": `${(n % 7) * -0.37}s`, "--face": facing } as CSSProperties;
  const states = `act-${action} ${wounded ? "is-wounded" : ""}`;
  return <svg className={`rig rig-${kind} ${rebel ? "rebel" : "patrol"} ${skin ? `skin-${skin.id}` : ""} ${states}`} viewBox="0 0 100 120" style={style} aria-hidden="true">
    {rebel ? <ellipse className="rig-shadow" cx="50" cy="108" rx="28" ry="6" fill={INK} opacity=".22" />
      : <path className="rig-shadow" d="M22 108 L50 102 L78 108 L50 114 Z" fill={INK} opacity=".22" />}
    <g className="fx-dust" fill="#efe3c6" stroke={INK} strokeWidth="1.5"><circle cx="28" cy="106" r="4" /><circle cx="72" cy="107" r="3.5" /><circle cx="50" cy="111" r="3" /></g>
    <g className="fx-lines" stroke={INK} strokeWidth="2.4" strokeLinecap="round"><path d="M4 60 L18 60 M2 74 L20 74 M6 88 L16 88" /></g>
    <g className="flip"><g className="hop"><g className="squash">
      {sprite && <SpriteImage box={sprite} />}
    </g></g></g>
    <g className="fx-side">
      <path className="fx-burst" d="M88 46 L94 36 L95 48 L106 46 L97 54 L104 62 L93 60 L90 70 L85 60 L74 62 L81 54 L74 46 L85 48 Z" fill="#ffd34d" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <g className="fx-stars" fill={GOLD} stroke={INK} strokeWidth="1.5">{[[86, 36], [94, 56], [78, 24]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} />)}</g>
      {kind === "king" && sprite && <CrownFx box={sprite} />}
    </g>
    <path className="fx-pop" d="M50 44 L55 54 L66 52 L58 60 L64 70 L53 65 L48 75 L45 64 L34 66 L41 58 L34 50 L45 53 Z" fill="#fffdf4" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <g className="fx-smoke" fill="#cfc6b8" stroke={INK} strokeWidth="1.5">{[[38, 84], [56, 76], [66, 92], [44, 98], [52, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)}</g>
  </svg>;
}
