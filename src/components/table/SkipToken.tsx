/** Shown beside End turn during the enemy's turn: skip the rest of the playback. */
export function SkipToken({ onClick }: { onClick?: () => void }) {
  return <button className="skip-token" aria-label="Skip" title="Skip" onClick={onClick}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5l9 7-9 7zM12 5l9 7-9 7z" /></svg>
  </button>;
}
