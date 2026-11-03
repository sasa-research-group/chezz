import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { RulesCard } from "./Panels";
import type { Rules } from "../game/turns";

const FOCUSABLE = "button:not(:disabled), a[href], input:not(:disabled), summary, [tabindex]:not([tabindex='-1'])";

/** Modal keyboard rules: focus moves in on open, Tab cycles inside, Escape closes, and focus returns on close. */
export function useDialogKeys(ref: RefObject<HTMLElement | null>, onClose: () => void) {
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const inside = () => [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
    inside()[0]?.focus();
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") { ev.preventDefault(); close.current(); return; }
      if (ev.key !== "Tab") return;
      const list = inside();
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1], at = document.activeElement;
      if (ev.shiftKey && (at === first || !box.contains(at))) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && (at === last || !box.contains(at))) { ev.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    // Hand focus back only if nothing else (say, a dialog that opened next) has taken it.
    return () => { document.removeEventListener("keydown", onKey); if (!document.activeElement || document.activeElement === document.body || box.contains(document.activeElement)) back?.focus(); };
  }, [ref]);
}

type MenuProps = { log: string[]; fast: boolean; onFast: (fast: boolean) => void; onNewRun: () => void; newRunDisabled?: boolean; onClose: () => void; battles: number; onJump?: (index: number) => void; rules?: Rules };

/** The pause menu's card: the player's items, then the developer's under their own header. */
export function MenuCard({ log, fast, onFast, onNewRun, newRunDisabled, onClose, battles, onJump, rules: shown }: MenuProps) {
  const [rules, setRules] = useState(false);
  // Jumping replaces the run, so the first tap only arms a battle and a second tap on it goes.
  const [armed, setArmed] = useState<number | null>(null);
  return <div className="menu-card">
    <button className="menu-row resume" onClick={onClose}><span aria-hidden="true">▶</span>Resume</button>
    <button className="menu-row" aria-expanded={rules} onClick={() => setRules(r => !r)}><span aria-hidden="true">?</span>Rules</button>
    {rules && <RulesCard rules={shown} />}
    <button className="menu-row" disabled={newRunDisabled} onClick={onNewRun}><span aria-hidden="true">↺</span>New run</button>
    <label className="menu-row toggle"><span aria-hidden="true">»</span>Fast enemy phase<input type="checkbox" checked={fast} onChange={ev => onFast(ev.target.checked)} /></label>
    <details className="menu-log"><summary className="menu-row"><span aria-hidden="true">≡</span>Battle log</summary>{log.map((text, i) => <p key={i}>{text}</p>)}</details>
    <h2 className="menu-section">Developer</h2>
    <a className="menu-row" href="./art.html"><span aria-hidden="true">✎</span>Art studio</a>
    {onJump && <div className="menu-row jump" role="group" aria-label="Jump to battle"><span aria-hidden="true">⇥</span>Jump to battle
      <span className="jump-picks">{Array.from({ length: battles }, (_, i) => {
        const go = armed === i;
        return <button key={i} className={go ? "armed" : ""} disabled={newRunDisabled} aria-label={go ? `Confirm battle ${i + 1}` : `Battle ${i + 1}`} onClick={() => go ? onJump(i) : setArmed(i)}>{i + 1}{go && " ✓"}</button>;
      })}</span>
    </div>}
  </div>;
}

/** The ☰ pause menu: an overlay with Escape and a focus trap. A tap on the shade closes it. */
export function PauseMenu(props: MenuProps) {
  const ref = useRef<HTMLElement>(null);
  useDialogKeys(ref, props.onClose);
  return <div className="exile-modal-shade menu-shade" onClick={ev => { if (ev.target === ev.currentTarget) props.onClose(); }}>
    <section className="pause-menu" role="dialog" aria-modal="true" aria-label="Menu" ref={ref}>
      <MenuCard {...props} />
    </section>
  </div>;
}
