import { DAMAGE } from "../game/turns";
import type { Kind } from "../game/turns";

const GLYPH: Record<Kind, string> = { pawn: "♙", knight: "♘", bishop: "♗", king: "♔", rook: "♖", queen: "♕" };
const REACH: Record<"pawn" | "bishop" | "rook", number[]> = { pawn: [0, 2], bishop: [0, 2, 6, 8], rook: [1, 3, 5, 7] };

export const RulesCard = () => <dl className="rules-card">
  <dt>Turn</dt><dd>every piece acts</dd>
  <dt>Move</dt><dd>once · its chess shape · any distance</dd>
  <dt>Strike</dt><dd>after moving · next square in its shape</dd>
  <dt>Damage</dt><dd>{(["pawn", "knight", "bishop", "king", "rook", "queen"] as const).map(k => <span key={k}>{GLYPH[k]}{DAMAGE[k]}</span>)}</dd>
  <dt>Defend</dt><dd>instead of strike · +1 defense: each hit −1 · counters</dd>
  <dt><i className="lg-unsafe">✕</i></dt><dd>exposes king</dd>
  <dt><i className="lg-check">!</i></dt><dd>threatens king</dd>
  <dt>Far row</dt><dd>pawn promotes</dd>
</dl>;

export const ReachGlyph = ({ kind }: { kind: "pawn" | "bishop" | "rook" }) => <span className="reach-glyph" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} className={i === 4 ? "self" : REACH[kind].includes(i) ? "hit" : ""} />)}</span>;

export const ArmySlots = ({ filled, total }: { filled: number; total: number }) => <span className="army-slots" role="img" aria-label={`Army ${filled} / ${total}`}>Army {Array.from({ length: total }, (_, i) => <i key={i} className={i < filled ? "full" : ""} />)} {filled} / {total}</span>;
