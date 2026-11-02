import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { armourPawn, type BodyLook } from "./ArmourPawns";
import { armourRook } from "./ArmourRooks";
import { armourKnight } from "./ArmourKnights";
import { armourBishop } from "./ArmourBishops";
import { armourKing } from "./ArmourKings";
import { armourQueen } from "./ArmourQueens";
import { skinById, type Skin } from "./skins";
import { CrownFx, SpriteImage, hasSprite, spriteBox } from "./SpriteRig";

/** A cast of misfits. Each chess piece is a distinct character whose costume
 * echoes its chess shape; rebels (white) are patched exiles, the patrol
 * (black) are prim royal guards. Each is one painted sprite (SpriteRig.tsx) moved whole by
 * src/sprite.css; skins and the red patrol fall back to the SVG shape kit (Armour*.tsx), whose
 * groups (.flip > .hop > .squash > body/arms/prop/head) src/rig.css animates. */
export type RigKind = "king" | "queen" | "rook" | "bishop" | "knight" | "pawn";
export type RigSide = "white" | "black";
export type RigAction = "idle" | "move" | "attack" | "defend" | "hit" | "death" | "cheer" | "morph-out" | "morph-in" | "leap" | "leap-back" | "mate";
export type PatrolHue = "blue" | "red";

export const INK = "#382f2e", GOLD = "#e7ba58", GOLD_SH = "#c0913c", STEEL = "#cfd6d8", WOOD = "#a77a4f", WOOD_SH = "#80583a";
export type Palette = { main: string; mainSh: string; acc: string; accSh: string; cloth: string; clothSh: string };
export const REBEL: Palette = { main: "#1f8a72", mainSh: "#166553", acc: "#f2c36b", accSh: "#d39d43", cloth: "#c98a4b", clothSh: "#9c6434" };
export const PATROL: Record<PatrolHue, Palette> = {
  blue: { main: "#3d5fc4", mainSh: "#2a4594", acc: GOLD, accSh: GOLD_SH, cloth: "#f2ede0", clothSh: "#d6cdb8" },
  red: { main: "#c35d55", mainSh: "#9c4640", acc: GOLD, accSh: GOLD_SH, cloth: "#f2ede0", clothSh: "#d6cdb8" },
};
/** How long each one-shot action plays at 1x (ms); the keyframes in rig.css use the same values. */
export const RIG_MS: Record<RigAction, number> = { idle: 0, move: 480, attack: 560, defend: 340, hit: 420, death: 900, cheer: 1400, "morph-out": 650, "morph-in": 750, leap: 340, "leap-back": 420, mate: 2600 };
const o = { stroke: INK, strokeWidth: 3.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
const f = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** One shape-kit build (Armour*.tsx); skins dress it. `mouths` is an optional overlay drawn in the head. */
export type Figure = { back?: ReactNode; body: ReactNode; armBack?: ReactNode; prop?: ReactNode; armFront: ReactNode; armFrontOverHead?: boolean; head: ReactNode; mouths?: ReactNode; propOrigin: string; shield: [number, number]; mouth: [number, number, number] };

/** "paint" (the game's art) draws one whole painted sprite (SpriteRig.tsx) where a piece has
 * one and the SVG shape kit elsewhere (skins, the red patrol); "new" draws only the shape kit. */
export type ArtStyle = "new" | "paint";
const NEW_FIGURES: Record<RigKind, (rebel: boolean, c: Palette, hue: PatrolHue, look?: Partial<BodyLook>) => Figure> = { pawn: armourPawn, rook: armourRook, knight: armourKnight, bishop: armourBishop, queen: armourQueen, king: armourKing };
/** A skin dresses a piece's shape-kit build: new head, and optionally new body, back,
 * arms and prop, drawn into the same groups around the same pivots. */
function dress(fig: Figure, skin: Skin): Figure {
  return {
    ...fig, head: skin.head(),
    back: skin.back ? skin.back() : fig.back,
    body: skin.body ? skin.body() : fig.body,
    armBack: skin.armBack ? skin.armBack() : fig.armBack,
    armFront: skin.armFront ? skin.armFront() : fig.armFront,
    prop: skin.prop ? <g className="prop">{skin.prop()}</g> : fig.prop,
  };
}
/** `?art=new` in the page URL shows the game with the shape kit only. */
const urlArt = typeof location !== "undefined" ? new URLSearchParams(location.search).get("art") : null;
export const URL_ART: ArtStyle = urlArt === "new" ? "new" : "paint";

function Shield({ rebel, c, at: [x, y] }: { rebel: boolean; c: Palette; at: [number, number] }) {
  return <g className="shield" style={{ transformOrigin: `${x}px ${y}px` }}>{rebel
    ? <><circle cx={x} cy={y} r="11" fill={WOOD} {...o} /><path d={`M${x - 10} ${y} L${x + 10} ${y} M${x} ${y - 10} L${x} ${y + 10}`} stroke={WOOD_SH} strokeWidth="2" /><circle cx={x} cy={y} r="3.4" fill={STEEL} {...f} /></>
    : <><path d={`M${x - 10} ${y - 11} L${x + 10} ${y - 11} L${x + 9} ${y + 3} Q${x} ${y + 13} ${x - 9} ${y + 3} Z`} fill={c.main} {...o} /><path d={`M${x} ${y - 10} L${x} ${y + 9} M${x - 8} ${y - 3} L${x + 8} ${y - 3}`} stroke={GOLD} strokeWidth="2.6" /></>}</g>;
}

let rigCount = 0;
/** `skin` is a skin id from components/skins; it applies to rebels of the skin's kind, whatever `art` says. */
export function PieceRig({ kind, side, action = "idle", defending = false, facing = 1, hue = "blue", seed = 0, wounded = false, art = URL_ART, skin: skinId }: {
  kind: RigKind; side: RigSide; action?: RigAction; defending?: boolean; facing?: 1 | -1; hue?: PatrolHue; seed?: number | string; wounded?: boolean; art?: ArtStyle; skin?: string;
}) {
  const rebel = side === "white", c = rebel ? REBEL : PATROL[hue];
  const found = skinById(skinId), skin = found && rebel && found.kind === kind ? found : undefined;
  const sprite = art === "paint" && !skin && hasSprite(kind, rebel, hue) ? spriteBox(kind, rebel) : undefined;
  const built = NEW_FIGURES[kind](rebel, c, hue, skin?.look);
  const fig = skin ? dress(built, skin) : built;
  const [boil] = useState(() => `boil-${++rigCount}`);
  // A stable per-piece number (ids hash), so idle loops don't jump when the cast changes.
  const n = typeof seed === "number" ? seed : [...seed].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 997, 7);
  const style = { "--seed": `${(n % 7) * -0.37}s`, "--face": facing, "--prop-origin": fig.propOrigin } as CSSProperties;
  const states = `act-${action} ${defending ? "is-defending" : ""} ${wounded ? "is-wounded" : ""}`;
  const ground = <>
    {rebel ? <ellipse className="rig-shadow" cx="50" cy="108" rx="28" ry="6" fill={INK} opacity=".22" />
      : <path className="rig-shadow" d="M22 108 L50 102 L78 108 L50 114 Z" fill={INK} opacity=".22" />}
    <g className="fx-dust" fill="#efe3c6" stroke={INK} strokeWidth="1.5"><circle cx="28" cy="106" r="4" /><circle cx="72" cy="107" r="3.5" /><circle cx="50" cy="111" r="3" /></g>
    <g className="fx-lines" stroke={INK} strokeWidth="2.4" strokeLinecap="round"><path d="M4 60 L18 60 M2 74 L20 74 M6 88 L16 88" /></g>
  </>;
  const strikeFx = <>
    <path className="fx-burst" d="M88 46 L94 36 L95 48 L106 46 L97 54 L104 62 L93 60 L90 70 L85 60 L74 62 L81 54 L74 46 L85 48 Z" fill="#ffd34d" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    <g className="fx-stars" fill={GOLD} stroke={INK} strokeWidth="1.5">{[[86, 36], [94, 56], [78, 24]].map(([x, y], i) => <path key={i} d={`M${x} ${y - 6} L${x + 2} ${y - 2} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 2} Z`} />)}</g>
  </>;
  const smoke = <g className="fx-smoke" fill="#cfc6b8" stroke={INK} strokeWidth="1.5">{[[38, 84], [56, 76], [66, 92], [44, 98], [52, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" />)}</g>;
  if (sprite) return <svg className={`rig rig-${kind} ${rebel ? "rebel" : "patrol"} art-sprite ${states}`} viewBox="0 0 100 120" style={style} aria-hidden="true">
    {ground}
    <g className="flip"><g className="hop"><g className="squash">
      <SpriteImage box={sprite} />
      <Shield rebel={rebel} c={c} at={[Math.max(30, sprite.x + 10), 84]} />
    </g></g></g>
    <g className="fx-side">{strikeFx}{kind === "king" && <CrownFx box={sprite} />}</g>
    <path className="fx-pop" d="M50 44 L55 54 L66 52 L58 60 L64 70 L53 65 L48 75 L45 64 L34 66 L41 58 L34 50 L45 53 Z" fill="#fffdf4" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    {smoke}
  </svg>;
  return <svg className={`rig rig-${kind} ${rebel ? "rebel" : "patrol"} art-new ${skin ? `skin-${skin.id} ${skin.quirk ?? ""}` : ""} ${states}`} viewBox="0 0 100 120" style={style} aria-hidden="true">
    {/* Line boil: the outlines wobble a little, like hand-drawn frames. */}
    <defs><filter id={boil} x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="1" seed={n % 5}><animate attributeName="seed" values="1;2;3;4" dur=".48s" calcMode="discrete" repeatCount="indefinite" /></feTurbulence><feDisplacementMap in="SourceGraphic" scale="1.8" /></filter></defs>
    {ground}
    <g className="flip" style={action === "idle" ? undefined : { filter: `url(#${boil})` }}><g className="hop"><g className="squash">
      {fig.back}
      {fig.armBack}
      {fig.body}
      {fig.prop}
      {!fig.armFrontOverHead && fig.armFront}
      <g className="head-tilt"><g className="head">{fig.head}{fig.mouths}<path className="sweat" d={`M${fig.mouth[0] + 14} ${fig.mouth[1] - 22} Q${fig.mouth[0] + 18} ${fig.mouth[1] - 15} ${fig.mouth[0] + 14} ${fig.mouth[1] - 13} Q${fig.mouth[0] + 10} ${fig.mouth[1] - 15} ${fig.mouth[0] + 14} ${fig.mouth[1] - 22} Z`} fill="#8fd3e8" stroke={INK} strokeWidth="1.4" /></g></g>
      {fig.armFrontOverHead && fig.armFront}
      {wounded && <g className="bandage"><rect x="56" y={kind === "pawn" ? 48 : 30} width="12" height="5" rx="1" fill="#fffaf0" {...f} strokeWidth="1.6" transform={`rotate(25 62 ${kind === "pawn" ? 50 : 32})`} /><path d="M30 100 L36 96" stroke={INK} strokeWidth="1.6" /></g>}
      <Shield rebel={rebel} c={c} at={fig.shield} />
      <path className="fx-smear" d="M64 30 Q100 56 80 102" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" opacity=".55" />
    </g></g></g>
    <g className="fx-side">{strikeFx}</g>
    {smoke}
  </svg>;
}
