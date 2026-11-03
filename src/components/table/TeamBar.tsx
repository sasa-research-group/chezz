import { useRef } from "react";
import type { ReactNode } from "react";
import { PieceRig } from "../PieceRig";
import { SHIELD } from "./ShieldToken";

/** One shield per defend a side gets this battle; spent ones stay, hollow and cracked. A shield spent
 * since the last render plays its breaking animation. */
function DefendBadges({ left, total, label }: { left: number; total: number; label: string }) {
  const last = useRef(left), breaking = useRef<number[]>([]);
  if (left !== last.current) {
    breaking.current = left < last.current ? Array.from({ length: last.current - left }, (_, i) => left + i) : [];
    last.current = left;
  }
  return <span className="defend-badges" role="img" aria-label={`${label}: ${left} of ${total} left`}>
    {Array.from({ length: total }, (_, i) =>
      <svg key={i} viewBox="0 0 20 22" aria-hidden="true" className={`defend-badge ${i < left ? "" : "spent"} ${breaking.current.includes(i) ? "breaking" : ""}`}>
        <path d={SHIELD} /><path className="crack" d="M11 3 L8.5 9 L12 12 L9 19" />
      </svg>)}
  </span>;
}

/** A side's team status, on its own edge of the board: the enemy's above, yours below. The middle
 * carries that side's turn labels and alerts. */
export function TeamBar({ side, defendsLeft, defends, center, children }: { side: "white" | "black"; defendsLeft: number; defends: number; center?: ReactNode; children?: ReactNode }) {
  return <div className={`team-bar ${side}`} role="group" aria-label={side === "black" ? "Opponent team" : "Your team"}>
    {children}
    <div className="team-center">{center}</div>
    <DefendBadges left={defendsLeft} total={defends} label={side === "black" ? "Enemy defends" : "Defends"} />
  </div>;
}

/** Your king's hearts, for your team bar. */
export const KingHearts = ({ hp, max }: { hp: number; max: number }) =>
  <span className="team-king" role="img" aria-label={`King HP ${hp} / ${max}`}>
    <span className="team-face"><PieceRig kind="king" side="white" /></span>
    <span className="hearts">{Array.from({ length: max }, (_, i) => <i key={i} className={i < hp ? "full" : ""}>♥</i>)}</span>
  </span>;

/** The enemy's emblem, for its team bar. */
export const EnemyEmblem = () =>
  <span className="team-king" aria-hidden="true"><span className="team-face"><PieceRig kind="pawn" side="black" /></span></span>;
