/** The slim bar along the table's far edge: "Battle n of N", gold and the menu. Team status sits in the
 * team bars on the board's edges. */
export function TopBar({ battle, battles, gold, menuOpen, menuDisabled, onMenu }: { battle: number; battles: number; gold: number; menuOpen?: boolean; menuDisabled?: boolean; onMenu?: () => void }) {
  return <header className="top-bar">
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
