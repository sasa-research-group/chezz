/** The round shield token: defend the selected piece. */
export function ShieldToken({ disabled, onClick }: { disabled?: boolean; onClick?: () => void }) {
  return <button className="shield-token" aria-label="Defend" title="−1 damage · counter" disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z" /></svg>
  </button>;
}
