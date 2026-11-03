const SHIELD = "M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z";

/** The round shield token: defend the selected piece, +N defense (each hit until your next turn deals
 * N less). The corner count is how many defends your side has left this battle. */
export function ShieldToken({ bonus, left, disabled, onClick }: { bonus: number; left: number; disabled?: boolean; onClick?: () => void }) {
  return <button className="shield-token" aria-label={`Defend +${bonus} · ${left} left`} title={`+${bonus} defense · ${left} left`} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 20 22" aria-hidden="true"><path d={SHIELD} /></svg>
    <b className="shield-plus" aria-hidden="true">+{bonus}</b>
    <b className={`shield-left ${left ? "" : "empty"}`} aria-hidden="true">×{left}</b>
  </button>;
}

/** A side's defends left this battle, as a small shield and a count. */
export const DefendsLeft = ({ left, side }: { left: number; side: "white" | "black" }) =>
  <span className={`defends-left ${side} ${left ? "" : "empty"}`} role="img" aria-label={`${side === "black" ? "Enemy defends" : "Defends"} left: ${left}`}>
    <svg viewBox="0 0 20 22" aria-hidden="true"><path d={SHIELD} /></svg>×{left}
  </span>;
