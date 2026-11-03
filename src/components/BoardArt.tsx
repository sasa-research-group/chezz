/** Board overlays shared by the game and the art studio (art.html). */
import type { Intent, Pos } from "../game/turns";
import { intentWaits } from "../game/turns";
export type BannerKind = "cleared" | "victory" | "defeat" | "checkmate";
export const BANNER_TEXT: Record<BannerKind, string> = { checkmate: "Checkmate!", defeat: "Defeat", victory: "Victory!", cleared: "Battle won" };

export function BattleBanner({ kind, line, onClick, focus = true }: { kind: BannerKind; line?: string; onClick?: () => void; focus?: boolean }) {
  return <button className={`battle-banner ${kind}`} onClick={onClick} autoFocus={focus}>
    <span>{BANNER_TEXT[kind]}</span>
    {line && <em>{line}</em>}
    <small>Tap to continue</small></button>;
}
const SHIELD = "M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z";
export const GuardBadge = ({ bonus }: { bonus: number }) => <span className="guard-badge" title={`+${bonus} defense`}><svg viewBox="0 0 20 22" aria-hidden="true"><path d={SHIELD} /></svg>+{bonus}</span>;

const centre = (p: Pos) => ({ x: p.x + .5, y: p.y + .5 });
/** The point `by` squares short of b on the way from a, so a line ends before a marker instead of under it. */
function shortOf(a: Pos, b: Pos, by: number) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  return { x: b.x - dx / len * by, y: b.y - dy / len * by };
}
/** An enemy piece's planned turn drawn on the board, in squares: an arrow to the square it would move
 * to, a ring and −N on the piece it would strike, a ghost shield where it would brace, or a "waits" tag.
 * Two layers: the lines lie on the board under the pieces; the chips stand in front of them. */
export function IntentMarks({ intent, cols, rows, leaps, bonus }: { intent: Intent; cols: number; rows: number; leaps: boolean; bonus: number }) {
  const from = centre(intent.from), to = intent.to ? centre(intent.to) : null, stand = to ?? from;
  const hit = intent.strike ? centre(intent.strike.at) : null;
  const end = to && shortOf(from, to, .22);
  // A knight leaps, so its path arcs; everything else slides straight.
  const bend = to && leaps ? { x: (from.x + to.x) / 2 + (to.y - from.y) * .25, y: (from.y + to.y) / 2 - (to.x - from.x) * .25 } : null;
  const path = to && end ? bend ? `M${from.x} ${from.y} Q${bend.x} ${bend.y} ${end.x} ${end.y}` : `M${from.x} ${from.y} L${end.x} ${end.y}` : "";
  const blow = hit && shortOf(stand, hit, .42);
  const pin = (p: Pos, dy = 0) => ({ left: `${p.x / cols * 100}%`, top: `${(p.y + dy) / rows * 100}%` });
  return <>
    <svg className="intent-layer" viewBox={`0 0 ${cols} ${rows}`} aria-hidden="true">
      <defs><marker id="intent-head" viewBox="0 0 10 10" refX="4" refY="5" markerWidth="2.6" markerHeight="2.6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" /></marker></defs>
      {path && <><path className="intent-path-under" d={path} /><path className="intent-path" d={path} markerEnd="url(#intent-head)" /></>}
      {to && <circle className="intent-dest" cx={to.x} cy={to.y} r=".3" />}
      {hit && blow && <><line className="intent-blow" x1={stand.x} y1={stand.y} x2={blow.x} y2={blow.y} /><circle className="intent-ring" cx={hit.x} cy={hit.y} r=".42" /></>}
    </svg>
    <div className="intent-chips" aria-hidden="true">
      {intent.strike && <span className={`intent-chip hit ${intent.strike.kills ? "kills" : ""}`} style={pin(hit!, -.38)}>−{intent.strike.damage}</span>}
      {intent.defend && <span className="intent-chip brace" style={pin(stand, -.05)}><svg viewBox="0 0 20 22"><path d={SHIELD} /></svg>+{bonus}</span>}
      {intentWaits(intent) && <span className="intent-chip idle" style={pin(from, -.42)}>waits</span>}
    </div>
  </>;
}
