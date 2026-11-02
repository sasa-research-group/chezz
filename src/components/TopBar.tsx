import { PieceRig } from "./PieceRig";

/** The slim bar along the table's far edge: king's hearts, "Battle n of N", gold and the menu. */
export function TopBar({ kingHp, kingMax, battle, battles, gold, menuOpen, menuDisabled, onMenu }: { kingHp: number; kingMax: number; battle: number; battles: number; gold: number; menuOpen?: boolean; menuDisabled?: boolean; onMenu?: () => void }) {
  return <header className="top-bar">
    <span className="plaque king-plaque" role="img" aria-label={`King HP ${kingHp} / ${kingMax}`}>
      <span className="plaque-face"><PieceRig kind="king" side="white" /></span>
      <span className="hearts">{Array.from({ length: kingMax }, (_, i) => <i key={i} className={i < kingHp ? "full" : ""}>♥</i>)}</span>
    </span>
    <span className="plaque battle-plaque" role="img" aria-label={`Battle ${battle} of ${battles}`}>
      <small>Battle</small>
      <b>{battle}<small> of {battles}</small></b>
    </span>
    <span className="coins" role="img" aria-label={`Gold ${gold}`}><i>✦</i>{gold}</span>
    <button className="menu-button" aria-label="Menu" aria-haspopup="dialog" aria-expanded={!!menuOpen} disabled={menuDisabled} onClick={onMenu}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
    </button>
  </header>;
}
