import type { CSSProperties } from "react";
import type { Pos, Volley } from "../game/turns";

/** A sprung trap's launchers wind up for WINDUP_MS, then the spears take SPEAR_MS to cross the board (unscaled). */
export const WINDUP_MS = 160, SPEAR_MS = 460;
/** A volley in flight: one spear per row, crossing the board in `ms` (unscaled), and each piece it hits, `delay` ms in. */
export type Shot = { key: number; rows: number[]; ms: number; hits: { id: string; at: Pos; delay: number }[] };

/** When a spear crossing the board in `ms` reaches column x: it leaves the launcher left of column 0 and exits past the last. */
export const spearReaches = (x: number, cols: number, ms: number) => ms * (x + 1) / (cols + 1);

/** What a switch would do if pressed now: a dashed spear path along each row and a damage chip on every
 * piece it would hit, red-ringed on your own pieces. Drawn for your move onto a switch and in an enemy's intent. */
export function VolleyMarks({ volley, cols, rows }: { volley: Volley; cols: number; rows: number }) {
  const pin = (p: Pos) => ({ left: `${(p.x + .5) / cols * 100}%`, top: `${(p.y + .12) / rows * 100}%` });
  return <>
    <svg className="volley-layer" viewBox={`0 0 ${cols} ${rows}`} preserveAspectRatio="none" aria-hidden="true">
      {volley.rows.map(y => <line key={y} className="volley-path" x1={0} y1={y + .5} x2={cols - .08} y2={y + .5} />)}
    </svg>
    <div className="intent-chips" aria-hidden="true">
      {volley.hits.map(h => <span key={h.id} className={`intent-chip hit volley-chip ${h.side === "white" ? "friendly" : ""} ${h.kills ? "kills" : ""}`} style={pin(h.at)}>−{volley.damage}</span>)}
    </div>
  </>;
}

/** The spears in flight, and an impact burst on each piece as its spear arrives. Timed by `--spd`. */
export function SpearVolleys({ shots, cols, rows, spd }: { shots: Shot[]; cols: number; rows: number; spd: number }) {
  return <>{shots.map(s => <div key={s.key} className="spear-volleys" style={{ "--ms": `${s.ms}ms`, "--spd": spd } as CSSProperties} aria-hidden="true">
    {s.rows.map(y => <div key={y} className="spear-volley" style={{ top: `${(y + .5) / rows * 100}%` }}><i /></div>)}
    {s.hits.map(h => <span key={h.id} className="spear-impact" style={{ left: `${(h.at.x + .5) / cols * 100}%`, top: `${(h.at.y + .45) / rows * 100}%`, "--delay": `${h.delay}ms` } as CSSProperties} />)}
  </div>)}</>;
}
