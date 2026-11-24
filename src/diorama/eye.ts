// The eye square's prop, as Cycles drew it (tools/art/diorama/build_eye_cycles.py --bake, Wesley 2026-11-24: a
// Meshy stone plinth and rusty claws, a glassy eyeball and hammered iron lids built in code). It dozes with its
// lids at a slit (it still watches its row and column); when it sees one of your pieces it snaps them open, flares
// and stares at it; when nothing is in sight it nods off again, slowly. Pure timing here; EyeSprite.tsx draws it.
//
// The sheets (public/diorama/): eye8 (awake, staring along each of 8 headings; the odd ones are a turn's
// in-betweens), eye-wake{0,2,4,6} (the frames from dozing to staring that way; played backwards, slowly, it
// nods off) and eye-doze0 (a loop of the dozing lids drifting).

export const EYE_FIGURE = "eye";
/** The wake: frames a second; nodding off plays the same frames backwards at SLEEP_FPS (lids close slowly). */
export const WAKE_FPS = 24, SLEEP_FPS = 6;
/** Awake, it turns to a new piece one heading (45 degrees) every TURN_STEP seconds. */
export const TURN_STEP = 0.06;

type At = { x: number; y: number };

/** The heading (0-7, 0 toward the camera, 2 right, as the figures) from the eye to the piece it stares at, or null
 * while it dozes. Board y grows toward the camera. */
export function stareHeading(at: At, stare: At | null | undefined): number | null {
  if (!stare) return null;
  const a = Math.atan2(stare.x - at.x, stare.y - at.y);
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

export type EyeAnim = {
  phase: "doze" | "wake" | "awake" | "sleep";
  /** heading shown */
  k: number;
  /** frame in the wake (fractional) */
  f: number;
  /** seconds into the doze loop, or since the last turn step */
  t: number;
};

/** A fresh eye: already staring if it sees a piece when the board comes up (no wake on load), else dozing. */
export const eyeStart = (want: number | null): EyeAnim => want === null ? { phase: "doze", k: 0, f: 0, t: 0 } : { phase: "awake", k: want, f: 0, t: 0 };

/** One frame: `want` is stareHeading's answer now, `frames` the wake's length. */
export function eyeTick(s: EyeAnim, want: number | null, dt: number, frames: number): EyeAnim {
  const last = frames - 1;
  switch (s.phase) {
    case "doze":
      return want === null ? { ...s, t: s.t + dt } : { phase: "wake", k: want, f: 0, t: 0 };
    case "wake": {
      if (want === null) return { ...s, phase: "sleep" };
      const f = s.f + dt * WAKE_FPS;
      return f >= last ? { phase: "awake", k: s.k, f: last, t: 0 } : { ...s, f };
    }
    case "sleep": {
      if (want !== null) return { ...s, phase: "wake", k: want };  // spotted again: open from where the lids are
      const f = s.f - dt * SLEEP_FPS;
      return f <= 0 ? { phase: "doze", k: 0, f: 0, t: 0 } : { ...s, f };
    }
    case "awake": {
      // nothing in sight: nod off, from a heading that has a wake (it only sees along its row and column)
      const to = want ?? (s.k % 2 ? (s.k + 1) % 8 : s.k);
      if (want === null && s.k === to) return { phase: "sleep", k: s.k, f: last, t: 0 };
      if (s.k === to) return { ...s, t: 0 };
      const t = s.t + dt;
      if (t < TURN_STEP) return { ...s, t };
      const d = ((to - s.k + 12) % 8) - 4 || 4;  // the short way round
      return { ...s, k: (s.k + Math.sign(d) + 8) % 8, t: t - TURN_STEP };
    }
  }
}

/** What to draw: the sheet, its heading and the frame on it. */
export function eyeFrame(s: EyeAnim, doze: { frames: number; fps: number }, frames: number): { sheet: "doze" | "wake" | "still"; k: number; i: number } {
  if (s.phase === "doze") return { sheet: "doze", k: 0, i: Math.floor(s.t * doze.fps) % doze.frames };
  if (s.phase === "awake") return { sheet: "still", k: s.k, i: s.k };
  return { sheet: "wake", k: s.k, i: Math.max(0, Math.min(frames - 1, Math.round(s.f))) };
}

/** The glow's strength on top of the baked one: dozing, it breathes slowly, like an ember. */
export const eyeGlow = (s: EyeAnim, t: number) => s.phase === "doze" ? 1 + 0.3 * Math.sin(t * 1.1 + 0.6) : 1;
