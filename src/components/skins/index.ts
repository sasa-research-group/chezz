import type { ReactNode } from "react";
import type { BodyLook } from "../ArmourPawns";
import type { RigKind } from "../PieceRig";
import { frogPawn } from "./frogPawn";
import { haystackRook } from "./haystackRook";
import { emptyKnight } from "./emptyKnight";

/** An unlockable look for one rebel piece (docs/art/SKINS.md). It replaces the
 * head (face and headgear) and optionally the body, arms and prop, or recolours
 * the build's body through `look`, and may add an idle quirk class whose CSS
 * lives in rig.css. Groups, pivots and shield stay the piece's shape-kit build,
 * so every animation in rig.css plays unchanged. Drawings use only the shape kit. */
export type Skin = {
  id: string;
  kind: RigKind;
  name: string;
  /** Reference crop in docs/art/, shown beside the skin in the studio. */
  ref?: string;
  look?: Partial<BodyLook>;
  /** Must keep the head contract: `.face > .eyes > .pupil`, `.ko-eyes` and a `.mouth-yell` squint. */
  head: () => ReactNode;
  /** Optional: replaces the build's body (torso, legs, feet) for a creature
   * with a different shape. Keep the feet on y 108. */
  body?: () => ReactNode;
  /** Optional: replaces the build's arms. Draw the sleeves with `Sleeve` (it
   * carries the classes the cheer animates) and keep the hands where the build
   * has them (`PAWN_ARMS` for the pawn), so the prop pivot still lines up. */
  armBack?: () => ReactNode;
  armFront?: () => ReactNode;
  /** Drawn inside `.prop`, which swings around the build's propOrigin. */
  prop?: () => ReactNode;
  /** A class on the rig's <svg>; animate only `.quirk-bit`, `.head`, `.prop` or `.eyes` with it. */
  quirk?: string;
};

/** Rebel skins in unlock order: finishing a run unlocks the first one not yet owned. */
export const SKINS: Skin[] = [frogPawn, haystackRook, emptyKnight];

export const skinById = (id: string | undefined) => id ? SKINS.find(s => s.id === id) : undefined;
