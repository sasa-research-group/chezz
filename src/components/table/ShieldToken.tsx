/** The round shield token: defend the selected piece, +N defense (each hit until your next turn deals N less). */
export function ShieldToken({ bonus, disabled, onClick }: { bonus: number; disabled?: boolean; onClick?: () => void }) {
  return <button className="shield-token" aria-label={`Defend +${bonus}`} title={`+${bonus} defense · counter`} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z" /></svg>
    <b className="shield-plus" aria-hidden="true">+{bonus}</b>
  </button>;
}
