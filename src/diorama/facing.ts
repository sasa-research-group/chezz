// Which way each piece faces in the 3D view: the direction of its last move, kept until it moves again.
// Derived from the play history here, not stored in the engine. Directions are in Blender's floor axes
// (x right, y toward the back wall), snapped to the 8 compass points; null means facing the camera.

export type Facing = readonly [number, number] | null;
type At = { x: number; y: number };
type Step = { from: At; to: At; strike?: true } | null;

/** A board step (puzzle y grows toward the camera) as the nearest of the 8 directions, in Blender axes. */
export function snapDir(dx: number, dy: number): Facing {
  if (!dx && !dy) return null;
  const k = Math.round(Math.atan2(-dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [Math.round(Math.cos(k)) + 0, Math.round(Math.sin(k)) + 0];
}

/** The king's yaw for a facing: 0 looks at the camera (Blender -y), pi/2 looks right. */
export const yawOf = (f: Facing) => (f ? Math.atan2(f[0], -f[1]) : 0);

/** Stable ids and facings for the pieces of the last state, replaying `moves` from `states[0]`.
 * states[i + 1] is states[i] after moves[i] (null: a pass). Pieces keep their id from the start position;
 * a piece that appears from nowhere gets a fresh one. A statue's strike turns it toward its target. */
export function track(states: { pieces: At[] }[], moves: Step[]): { id: string; facing: Facing }[] {
  const key = (p: At) => `${p.x},${p.y}`;
  let at = new Map<string, { id: string; facing: Facing }>(states[0].pieces.map((p, i) => [key(p), { id: `p${i}`, facing: null }]));
  let fresh = states[0].pieces.length;
  moves.forEach((m, i) => {
    if (m) {
      const who = at.get(key(m.from)), dir = snapDir(m.to.x - m.from.x, m.to.y - m.from.y);
      at.delete(key(m.to));
      if (who && m.strike) who.facing = dir;
      else if (who) { at.delete(key(m.from)); at.set(key(m.to), { ...who, facing: dir }); }
    }
    // Keep only what the engine says is still there (sludge, falls); anything new gets its own id.
    const next = states[i + 1];
    if (next) at = new Map(next.pieces.map(p => [key(p), at.get(key(p)) ?? { id: `p${fresh++}`, facing: null }]));
  });
  const last = states[Math.min(moves.length, states.length - 1)];
  return last.pieces.map(p => at.get(key(p)) ?? { id: `p${fresh++}`, facing: null });
}
