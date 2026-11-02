/** Board overlays shared by the game and the art studio (art.html). */
export type BannerKind = "cleared" | "victory" | "defeat" | "checkmate";
export const BANNER_TEXT: Record<BannerKind, string> = { checkmate: "Checkmate!", defeat: "Defeat", victory: "Victory!", cleared: "Battle won" };

export function BattleBanner({ kind, line, onClick, focus = true }: { kind: BannerKind; line?: string; onClick?: () => void; focus?: boolean }) {
  return <button className={`battle-banner ${kind}`} onClick={onClick} autoFocus={focus}>
    <span>{BANNER_TEXT[kind]}</span>
    {line && <em>{line}</em>}
    <small>Tap to continue</small></button>;
}
export const GuardBadge = () => <span className="guard-badge" title="+1 defense · counters"><svg viewBox="0 0 20 22" aria-hidden="true"><path d="M10 1 L18 4 V10 C18 15 14.5 19 10 21 C5.5 19 2 15 2 10 V4 Z" /></svg>+1</span>;
