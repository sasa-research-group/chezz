/** The pill that ends your turn. "locked" is check (the king must get safe first); "waiting" is the enemy phase. */
export type EndTurnState = "ready" | "locked" | "waiting";
const LABEL: Record<EndTurnState, string> = { ready: "End turn", locked: "King in check", waiting: "Enemy phase" };
export function EndTurnButton({ state, disabled, onClick }: { state: EndTurnState; disabled?: boolean; onClick?: () => void }) {
  return <button className={`end-turn ${state}`} disabled={disabled} onClick={onClick}>
    <span className="end-turn-icon" aria-hidden="true">{state === "locked" ? "!" : state === "waiting" ? "…" : <svg viewBox="0 0 24 24"><path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" /></svg>}</span>
    <span className="end-turn-label">{LABEL[state]}</span>
  </button>;
}
