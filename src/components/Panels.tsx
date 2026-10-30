import { DAMAGE, ENERGY, STRIKE_COST } from "../game/turns";
import type { Kind } from "../game/turns";
import { StrikeIcon } from "./StrikeIcon";

const GLYPH: Record<Kind, string> = { pawn: "♙", knight: "♘", bishop: "♗", king: "♔", rook: "♖", queen: "♕" };
const REACH: Record<"pawn" | "bishop" | "rook", number[]> = { pawn: [0, 2], bishop: [0, 2, 6, 8], rook: [1, 3, 5, 7] };

export const Legend = () => <div className="board-legend" aria-hidden="true"><span><i className="lg-move">1</i>move</span><span><i className="lg-strike"><StrikeIcon />{STRIKE_COST}</i>strike</span><span><i className="lg-unsafe">✕</i>exposes king</span><span><i className="lg-check">!</i>threatens king</span></div>;

export const RulesCard = () => <dl className="rules-card">
  <dt>⚡</dt><dd>{ENERGY} per turn</dd>
  <dt>Move</dt><dd>1⚡ / square · knight 2⚡ · once</dd>
  <dt>Strike</dt><dd>{STRIKE_COST}⚡ · next square in its shape</dd>
  <dt>Damage</dt><dd>{(["pawn", "knight", "bishop", "king", "rook", "queen"] as const).map(k => <span key={k}>{GLYPH[k]}{DAMAGE[k]}</span>)}</dd>
  <dt>Defend</dt><dd>1⚡ · −1 damage · counters</dd>
  <dt><i className="lg-unsafe">✕</i></dt><dd>exposes king</dd>
  <dt><i className="lg-check">!</i></dt><dd>threatens king</dd>
  <dt>Far row</dt><dd>pawn promotes</dd>
</dl>;

export const ReachGlyph = ({ kind }: { kind: "pawn" | "bishop" | "rook" }) => <span className="reach-glyph" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <i key={i} className={i === 4 ? "self" : REACH[kind].includes(i) ? "hit" : ""} />)}</span>;

export const ArmySlots = ({ filled, total }: { filled: number; total: number }) => <span className="army-slots" role="img" aria-label={`Army ${filled} / ${total}`}>Army {Array.from({ length: total }, (_, i) => <i key={i} className={i < filled ? "full" : ""} />)} {filled} / {total}</span>;
