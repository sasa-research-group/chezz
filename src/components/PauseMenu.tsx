import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { RulesCard } from "./Panels";

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
    return () => { document.removeEventListener("keydown", onKey); back?.focus(); };
  }, [ref]);
}

type MenuProps = { log: string[]; fast: boolean; onFast: (fast: boolean) => void; onNewRun: () => void; newRunDisabled?: boolean; onExport: () => void; onClose: () => void };

/** The pause menu's card: everything that isn't play. Rendered bare in the studio; the game wraps it in PauseMenu. */
export function MenuCard({ log, fast, onFast, onNewRun, newRunDisabled, onExport, onClose }: MenuProps) {
  const [rules, setRules] = useState(false);
  return <div className="menu-card">
    <button className="menu-row resume" onClick={onClose}><span aria-hidden="true">▶</span>Resume</button>
    <button className="menu-row" aria-expanded={rules} onClick={() => setRules(r => !r)}><span aria-hidden="true">?</span>Rules</button>
    {rules && <RulesCard />}
    <button className="menu-row" disabled={newRunDisabled} onClick={onNewRun}><span aria-hidden="true">↺</span>New run</button>
    <label className="menu-row toggle"><span aria-hidden="true">»</span>Fast enemy turns<input type="checkbox" checked={fast} onChange={ev => onFast(ev.target.checked)} /></label>
    <details className="menu-log"><summary className="menu-row"><span aria-hidden="true">≡</span>Battle log</summary>{log.map((text, i) => <p key={i}>{text}</p>)}</details>
    <button className="menu-row" onClick={onExport}><span aria-hidden="true">↗</span>Export</button>
    <a className="menu-row" href="./art.html"><span aria-hidden="true">✎</span>Art studio</a>
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
