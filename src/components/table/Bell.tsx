/** The brass bell that ends the turn. "locked" is check (the king must get safe first); "waiting" is the enemy's turn. */
export type BellState = "ready" | "locked" | "waiting";
export function Bell({ state, label, disabled, onClick }: { state: BellState; label: string; disabled?: boolean; onClick?: () => void }) {
  return <button className={`bell ${state}`} aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a2 2 0 0 1 2 2v.3A7 7 0 0 1 19 11v5l2 2v1H3v-1l2-2v-5a7 7 0 0 1 5-6.7V4a2 2 0 0 1 2-2zm-2 18h4a2 2 0 0 1-4 0z" /></svg>
    {state === "locked" && <i className="bell-lock" aria-hidden="true">!</i>}
  </button>;
}
