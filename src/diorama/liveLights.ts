// The live lights that light the pieces on the baked set, placed like the stage's (stage.py). A bake that lists its
// lamps (bake_set.py stage_lights: every copy of the lantern, frame key, pool, warm fill and moon, so a long board has
// one per stretch) is lit from that list; an older bake without it gets the 5x5 stage's lamps, by hand, as before.
// Cycles watts become candela: a point or spot of P W is P/4pi, an area light P/pi along its axis.
import type { SetInfo } from "./set";
import { slide } from "./set";

type V3 = [number, number, number];
export type LiveLight = { name: string; kind: "point" | "spot"; at: V3; dir: V3; intensity: number; color: V3; angle: number; penumbra: number };
export type StageLamp = { name: string; at: V3; dir: V3; watts: number; half?: number };

/** How each stage lamp shows live: its colour and softness (tuned by eye against the bake), and whether it was an
 * area light (a wide soft spot at P/pi) or a point or spot (P/4pi). `angle` is the area's cone, or a spot's when the
 * bake didn't say. */
export const LAMP_LOOK: Record<string, { kind: "point" | "spot"; area: boolean; color: V3; angle: number; penumbra: number }> = {
  lantern: { kind: "point", area: false, color: [0.9, 0.88, 0.82], angle: 0, penumbra: 0 },
  framekey: { kind: "spot", area: true, color: [0.55, 0.7, 1.0], angle: 1.2, penumbra: 1 },
  pool: { kind: "spot", area: false, color: [0.6, 0.75, 1.0], angle: 0.4, penumbra: 0.6 },
  warmfill: { kind: "spot", area: false, color: [1.0, 0.7, 0.42], angle: 0.96, penumbra: 0.8 },
  moon: { kind: "spot", area: true, color: [0.4, 0.58, 1.0], angle: 1.3, penumbra: 1 },
};

/** The 5x5 stage's lamps in units of the king's height H (what the set sources were baked with). */
const SQUARE_LAMPS = (H: number, backY: number): StageLamp[] => [
  { name: "lantern", at: [-1.08 * H, -5.98 * H, 2.6 * H], dir: [0, 0, -1], watts: 4046 },
  { name: "framekey", at: [-0.96 * H, -6.34 * H, 7.2 * H], dir: [0.13, 0.63, -0.77], watts: 1734 },
  { name: "pool", at: [0.24 * H, -4.06 * H, 5.5 * H], dir: [0, 0.53, -0.85], watts: 2601 },
  { name: "warmfill", at: [0, -6.34 * H, 4.5 * H], dir: [0, 0.82, -0.58], watts: 3757 },
  { name: "moon", at: [-1.2 * H, Math.min(1.92 * H, backY), 3.4 * H], dir: [-0.1, -0.56, -0.82], watts: 101 },
];

/** The live lights for a `w` x `h` board cut from this bake. */
export function liveLights(info: SetInfo & { lights?: StageLamp[] }, w: number, h: number): LiveLight[] {
  const lamps = info.lights ?? SQUARE_LAMPS(info.H, h * info.S / 2);
  const own = !!info.lights;
  return lamps.flatMap(l => {
    const look = LAMP_LOOK[l.name];
    if (!look) return [];
    // a listed lamp moves with the part of the set it sits over when a smaller board is cut from the bake
    const at = own ? slide(info, w, h, l.at) ?? l.at : l.at;
    return [{
      name: l.name, kind: look.kind, at, dir: l.dir, color: look.color, penumbra: look.penumbra,
      intensity: l.watts / (look.area ? Math.PI : 4 * Math.PI),
      angle: look.area ? look.angle : l.half ?? look.angle,
    }];
  });
}
