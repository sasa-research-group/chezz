import { useEffect, type CSSProperties } from "react";
import "./phase-banner.css";

export type PhaseKind = "enemy" | "player";
const TEXT: Record<PhaseKind, string> = { enemy: "ENEMY PHASE", player: "YOUR PHASE" };

/** How long a phase banner stays up, and how far into it the enemy's playback starts (overlapping its sweep out). */
export const phaseTiming = (fast: boolean, reduced: boolean) =>
  reduced ? { total: 700, lead: 250 } : fast ? { total: 600, lead: 300 } : { total: 1050, lead: 650 };

/** The band swept across the middle of the screen when the side to act changes. It never takes input. */
export function PhaseBanner({ kind, total, onDone }: { kind: PhaseKind; total: number; onDone: () => void }) {
  useEffect(() => { const id = setTimeout(onDone, total); return () => clearTimeout(id); }, []);
  return <div className={`phase-banner ${kind}`} role="status" style={{ "--phase-ms": `${total}ms` } as CSSProperties}>
    <span>{TEXT[kind]}</span>
  </div>;
}
