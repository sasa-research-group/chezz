import type { ReactNode } from "react";
import type { BodyLook } from "../ArmourPawns";
import type { RigKind } from "../PieceRig";
import { frogPawn } from "./frogPawn";

/** An unlockable look for one rebel piece (docs/art/SKINS.md). It replaces the
 * head (face and headgear), optionally the prop, recolours the body through
 * `look`, and may add an idle quirk class whose CSS lives in rig.css. The body,
 * arms, pivots and shield come from the piece's shape-kit build, so every
 * animation in rig.css plays unchanged. Drawings use only the shape kit. */
export type Skin = {
  id: string;
  kind: RigKind;
  name: string;
  /** Reference crop in docs/art/, shown beside the skin in the studio. */
  ref?: string;
  look?: Partial<BodyLook>;
  /** Must keep the head contract: `.face > .eyes > .pupil`, `.ko-eyes` and a `.mouth-yell` squint. */
  head: () => ReactNode;
  /** Drawn inside `.prop`, which swings around the build's propOrigin. */
  prop?: () => ReactNode;
  /** A class on the rig's <svg>; animate only `.quirk-bit`, `.head`, `.prop` or `.eyes` with it. */
  quirk?: string;
};

/** Rebel skins in unlock order: finishing a run unlocks the first one not yet owned. */
export const SKINS: Skin[] = [frogPawn];

export const skinById = (id: string | undefined) => id ? SKINS.find(s => s.id === id) : undefined;
