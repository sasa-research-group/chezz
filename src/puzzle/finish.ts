// The finishing blow after a checkmate (show only; the engine's game is over by then). One of the pieces giving
// mate walks up to the enemy king and strikes him, he falls, then "Checkmate!" comes up. When several give mate
// the player picks which one strikes. The blow is a made-up last move appended to the play history so the 3D view
// plays it as any capture (the taker stops short, strikes, the king falls).
import { checkers, inCheck, other, same } from "./engine";
import type { Board, Move, Piece, Pos, State } from "./engine";

/** The pieces that may deliver the finishing blow: those giving mate. Empty when the position isn't a mate of
 *  black (it's black's move, black is in check, and `stuck`: black has no legal move). */
export function mateStrikers(b: Board, s: State, stuck: boolean): Piece[] {
  return s.turn === "black" && stuck && inCheck(b, s, "black") ? checkers(b, s, "black") : [];
}

/** The blow by the piece on `by`: it moves onto the king's square and the king is gone (a statue strikes from
 *  where it stands). Null when `by` holds no piece giving check. */
export function finishingBlow(b: Board, s: State, by: Pos): { move: Move; state: State } | null {
  const pc = checkers(b, s, s.turn).find(q => same(q, by)), king = s.pieces.find(q => q.kind === "king" && q.side === s.turn);
  if (!pc || !king) return null;
  const to = { x: king.x, y: king.y };
  const move: Move = { from: { x: pc.x, y: pc.y }, to, ...(pc.statue ? { strike: true as const } : {}) };
  const pieces = s.pieces.filter(q => q !== king).map(q => (q === pc && !pc.statue ? { ...q, ...to } : q));
  return { move, state: { ...s, pieces, turn: other(s.turn) } };
}

/** What the result line says around a mate: "pick" while several strikers wait for the player's choice,
 *  "blow" while the blow plays (nothing shown yet), "mate" once it has landed. */
export function mateStage(strikers: number, chosen: boolean, landed: boolean): "pick" | "blow" | "mate" | null {
  if (!strikers) return null;
  if (!chosen) return strikers > 1 ? "pick" : "blow";
  return landed ? "mate" : "blow";
}
