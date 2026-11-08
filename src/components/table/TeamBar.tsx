import type { ReactNode } from "react";
import { PieceRig } from "../PieceRig";

/** A side's team status, on its own edge of the board: the enemy's above, yours below. The middle
 * carries that side's turn labels and alerts. */
export function TeamBar({ side, center, children }: { side: "white" | "black"; center?: ReactNode; children?: ReactNode }) {
  return <div className={`team-bar ${side}`} role="group" aria-label={side === "black" ? "Opponent team" : "Your team"}>
    {children}
    <div className="team-center">{center}</div>
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
