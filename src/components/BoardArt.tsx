/** Board overlays shared by the game and the art studio (art.html). */
export type BannerKind = "cleared" | "victory" | "defeat" | "checkmate" | "solved" | "timeout" | "retreat";
export const BANNER_TEXT: Record<BannerKind, string> = { checkmate: "Checkmate!", defeat: "The crown falls…", victory: "Victory!", cleared: "Road cleared!", solved: "Solved!", timeout: "Out of moves…", retreat: "Both sides fall back…" };
/** Jokes for the checkmate banner, picked by turn so a replay shows the same one. */
export const MATE_LINES = ["Long live the… oh.", "The crown has left the building.", "He'll walk it off. He won't.", "Somewhere, a pawn is laughing.", "Exile was nicer, honestly."];

export function BattleBanner({ kind, line, onClick, focus = true }: { kind: BannerKind; line?: string; onClick?: () => void; focus?: boolean }) {
  return <button className={`battle-banner ${kind}`} onClick={onClick} autoFocus={focus}>
    <span>{BANNER_TEXT[kind]}</span>
    {line && <em>{line}</em>}
    <small>Tap to continue</small></button>;
}
export const GuardBadge = () => <span className="guard-badge" title="Defending: takes 1 less damage per hit and hits back if it can reach"><svg viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z" /></svg>−1</span>;
