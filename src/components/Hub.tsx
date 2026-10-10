import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { COST, DAMAGE, ENCOUNTERS, HP, campReason } from "../game/turns";
import type { CampChoice, Pos, Run } from "../game/turns";
import { PieceRig } from "./PieceRig";
import "../hub.css";

/** The hub between battles: a small village the king walks around. Presentation only; the rules
 * live in turns.ts (buy, leaveCamp). Training grounds and the merchant are placeholders for now. */
type PlaceId = "barracks" | "training" | "merchant" | "road";
type Place = { id: PlaceId; name: string; tagline: string; at: Pos; size: Pos; door: Pos; soon?: boolean };
const W = 7, H = 5;
const PLACES: Place[] = [
  { id: "barracks", name: "Barracks", tagline: "Recruit and rest", at: { x: 0, y: 0 }, size: { x: 2, y: 2 }, door: { x: 2, y: 1 } },
  { id: "training", name: "Training grounds", tagline: "Coming soon", at: { x: 5, y: 0 }, size: { x: 2, y: 2 }, door: { x: 4, y: 1 }, soon: true },
  { id: "merchant", name: "Merchant", tagline: "Coming soon", at: { x: 0, y: 3 }, size: { x: 2, y: 2 }, door: { x: 2, y: 3 }, soon: true },
  { id: "road", name: "Road out", tagline: "Next battle", at: { x: 6, y: 3 }, size: { x: 1, y: 2 }, door: { x: 5, y: 4 } },
];
const START: Pos = { x: 3, y: 2 };
const blocked = (p: Pos) => PLACES.some(b => p.x >= b.at.x && p.x < b.at.x + b.size.x && p.y >= b.at.y && p.y < b.at.y + b.size.y);
// A dirt road from the square out front to every door.
const onPath = (p: Pos) => p.y === 2 || PLACES.some(b => b.door.x === p.x && b.door.y === p.y) || (p.x === 5 && p.y > 2);
const OFFERS: CampChoice[] = ["pawn", "bishop", "rook", "heal"];

/** Shortest walk between two village squares, around the buildings. */
export function walkPath(from: Pos, to: Pos): Pos[] {
  const key = (p: Pos) => p.y * W + p.x;
  const prev = new Map<number, Pos | null>([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    if (p.x === to.x && p.y === to.y) break;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      if (n.x < 0 || n.y < 0 || n.x >= W || n.y >= H || blocked(n) || prev.has(key(n))) continue;
      prev.set(key(n), p); queue.push(n);
    }
  }
  if (!prev.has(key(to))) return [];
  const path: Pos[] = [];
  for (let p: Pos | null = to; p && key(p) !== key(from); p = prev.get(key(p)) ?? null) path.unshift(p);
  return path;
}

function PlaceArt({ id }: { id: PlaceId }) {
  const ink = "#382f2e";
  if (id === "barracks") return <svg viewBox="0 0 120 110" aria-hidden="true">
    <path d="M60 8v18" stroke={ink} strokeWidth="4" /><path d="M60 8l22 7-22 7z" fill="#c4553f" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
    <path d="M10 98L60 24l50 74z" fill="#e8c784" stroke={ink} strokeWidth="5" strokeLinejoin="round" />
    <path d="M35 98L60 24l25 74" fill="none" stroke="#c99f55" strokeWidth="4" />
    <path d="M47 98l13-30 13 30z" fill="#5b4033" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
    <path d="M4 100h112" stroke={ink} strokeWidth="5" strokeLinecap="round" /></svg>;
  if (id === "training") return <svg viewBox="0 0 120 110" aria-hidden="true">
    <path d="M30 100V40M90 100V40M22 46h76" stroke="#8a5a3c" strokeWidth="7" strokeLinecap="round" /><path d="M30 100V40M90 100V40M22 46h76" stroke={ink} strokeWidth="2" strokeLinecap="round" opacity=".5" />
    <circle cx="60" cy="38" r="12" fill="#e8c784" stroke={ink} strokeWidth="4" /><path d="M60 50v40M46 62h28" stroke="#c99f55" strokeWidth="9" strokeLinecap="round" /><path d="M60 50v40M46 62h28" stroke={ink} strokeWidth="3" strokeLinecap="round" opacity=".6" />
    <circle cx="60" cy="70" r="8" fill="none" stroke="#c4553f" strokeWidth="4" />
    <path d="M4 100h112" stroke={ink} strokeWidth="5" strokeLinecap="round" /></svg>;
  if (id === "merchant") return <svg viewBox="0 0 120 110" aria-hidden="true">
    <path d="M18 40h84l-8 16H26z" fill="#f3ead7" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
    <path d="M32 40l-4 16M46 40l-3 16M60 40v16M74 40l3 16M88 40l4 16" stroke="#437d72" strokeWidth="7" />
    <path d="M24 56h72v28H24z" fill="#a9734d" stroke={ink} strokeWidth="4" strokeLinejoin="round" /><path d="M28 40V22M92 40V22" stroke={ink} strokeWidth="4" />
    <circle cx="38" cy="90" r="10" fill="#e8c784" stroke={ink} strokeWidth="4" /><circle cx="82" cy="90" r="10" fill="#e8c784" stroke={ink} strokeWidth="4" />
    <path d="M4 100h112" stroke={ink} strokeWidth="5" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 60 110" aria-hidden="true">
    <path d="M28 100V20" stroke="#8a5a3c" strokeWidth="8" strokeLinecap="round" /><path d="M28 100V20" stroke={ink} strokeWidth="2" opacity=".5" />
    <path d="M8 26h38l10 10-10 10H8z" fill="#e8c784" stroke={ink} strokeWidth="4" strokeLinejoin="round" />
    <path d="M18 36h22m-6-5l6 5-6 5" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 100h56" stroke={ink} strokeWidth="5" strokeLinecap="round" /></svg>;
}

export function Hub({ run, reward, spd, onBuy, onLeave }: { run: Run; reward: number; spd: number; onBuy: (choice: CampChoice) => void; onLeave: () => void }) {
  const [king, setKing] = useState<Pos>(START);
  const [walking, setWalking] = useState(false);
  const [open, setOpen] = useState<PlaceId | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const panel = useRef<HTMLElement>(null);
  const doors = useRef<Partial<Record<PlaceId, HTMLButtonElement | null>>>({});
  const lastOpen = useRef<PlaceId | null>(null);
  // Focus moves into a panel when it opens and back to its building when it closes.
  useEffect(() => {
    if (open) { lastOpen.current = open; panel.current?.focus(); }
    else if (lastOpen.current) doors.current[lastOpen.current]?.focus();
  }, [open]);
  // A purchase can disable the button that had focus; keep focus inside the panel.
  useEffect(() => { if (open && (!document.activeElement || document.activeElement === document.body)) panel.current?.focus(); }, [run, open]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => stop, []);
  useEffect(() => {
    if (!open) return;
    const close = (ev: KeyboardEvent) => { if (ev.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const stepMs = 190 * spd;
  /** Walk the king square by square, then open whatever is at the end of the walk. */
  const walkTo = (to: Pos, then?: PlaceId) => {
    stop();
    const path = walkPath(king, to);
    if (!path.length || stepMs < 30) { if (path.length || (king.x === to.x && king.y === to.y)) setKing(to); setWalking(false); if (then) setOpen(then); return; }
    setWalking(true);
    path.forEach((p, i) => timers.current.push(setTimeout(() => setKing(p), i * stepMs)));
    timers.current.push(setTimeout(() => { setWalking(false); if (then) setOpen(then); }, path.length * stepMs));
  };
  const kingUnit = run.units.find(u => u.id === "king");
  const army = run.units.filter(u => u.side === "white");
  const recruits = run.recruits ?? [];
  const next = ENCOUNTERS[run.encounter + 1];
  const place = PLACES.find(p => p.id === open);
  const left = (x: number) => `${(x / W) * 100}%`, top = (y: number) => `${(y / H) * 100}%`;
  return <section className="hub-screen" role="dialog" aria-modal="true" aria-label="Rebel hideout">
    <div className="hub-body" inert={!!place}>
    <header className="hub-header">
      <div><p className="kicker">PATROL DEFEATED · +{reward} GOLD</p><h1>The rebel hideout</h1><p>Tap a building and the king will walk over. Take the road when you're ready.</p></div>
      <div className="hub-stats">
        <span>✦ <b>{run.gold}</b><small>GOLD</small></span>
        <span>♛ <b>{kingUnit?.hp ?? 0} / {HP.king}</b><small>KING HEALTH</small></span>
        <span className="hub-army" aria-label={`Army: ${[...army.map(u => u.kind), ...recruits.map(k => `${k} (recruit)`)].join(", ")}`}>
          {army.map(u => <i key={u.id}><PieceRig kind={u.kind} side="white" /></i>)}
          {recruits.map((k, i) => <i key={`r${i}`} className="new"><PieceRig kind={k} side="white" /></i>)}
          <small>ARMY</small></span>
      </div>
    </header>
    <div className="hub-map" style={{ aspectRatio: `${W}/${H}`, "--spd": spd } as CSSProperties}>
      <div className="hub-ground" aria-hidden="true">
        {Array.from({ length: W * H }, (_, i) => {
          const p = { x: i % W, y: Math.floor(i / W) };
          return <span key={i} className={`hub-tile ${blocked(p) ? "lot" : onPath(p) ? "path" : (p.x + p.y) % 2 ? "grass" : "grass alt"}`}
            onClick={() => { if (!blocked(p)) walkTo(p); }} />;
        })}
      </div>
      {PLACES.map(b => <button key={b.id} ref={el => { doors.current[b.id] = el; }} className={`hub-place ${b.id} ${b.soon ? "soon" : ""}`} style={{ left: left(b.at.x), top: top(b.at.y), width: left(b.size.x), height: top(b.size.y) }}
        aria-label={`${b.name}: ${b.tagline}`} onClick={() => walkTo(b.door, b.id)}>
        <PlaceArt id={b.id} /><span className="hub-sign"><b>{b.name}</b><small>{b.tagline}</small></span>
      </button>)}
      <div className={`hub-king ${walking ? "walking" : ""}`} aria-hidden="true" style={{ left: left(king.x + .5), top: top(king.y + .5), transitionDuration: `${stepMs}ms` }}>
        <PieceRig kind="king" side="white" action={walking ? "move" : "idle"} seed="king" />
      </div>
    </div>
    </div>
    {place && <div className="exile-modal-shade" onClick={ev => { if (ev.target === ev.currentTarget) setOpen(null); }}>
      <section className={`exile-modal camp-modal hub-panel ${place.id}`} role="dialog" aria-modal="true" aria-label={place.name} ref={panel} tabIndex={-1}>
        {place.id === "barracks" ? <>
          <p className="kicker">THE BARRACKS</p><h1>New blood, warm soup.</h1>
          <p>Recruits join in the next battle. Buy as many as your gold and the next road allow ({next?.starts.length ?? 0} squares).</p>
          <div className="camp-gold">✦ {run.gold} gold</div>
          <div className="camp-offers">{OFFERS.map(choice => <button key={choice} disabled={!!campReason(run, choice)} onClick={() => onBuy(choice)}>
            <div className="offer-art">{choice === "heal" ? <span>♥</span> : <PieceRig kind={choice} side="white" />}</div>
            <h2>{choice === "heal" ? "Mend the king" : `Recruit a ${choice}`}</h2>
            <p>{choice === "pawn" ? `${HP.pawn} HP, hits for ${DAMAGE.pawn}. Reach the far row to promote it.` : choice === "bishop" ? `${HP.bishop} HP, hits for ${DAMAGE.bishop}. Strikes diagonal neighbours.` : choice === "rook" ? `${HP.rook} HP, hits for ${DAMAGE.rook}. Strikes straight neighbours.` : `Restore 2 king HP, up to ${HP.king}.`}</p>
            <strong>{campReason(run, choice) || `${COST[choice]} gold →`}</strong></button>)}</div>
        </> : place.id === "road" ? <>
          <p className="kicker">THE ROAD OUT · BATTLE {run.encounter + 2} / {ENCOUNTERS.length}</p><h1>{next?.title ?? "Onward"}</h1>
          <p>{next?.story} Your army marches as it is{recruits.length ? `, with ${recruits.length} new recruit${recruits.length > 1 ? "s" : ""}` : ""}.</p>
          <button className="primary-button" onClick={onLeave}>March out<span>→</span></button>
        </> : <>
          <p className="kicker">{place.name.toUpperCase()} · COMING SOON</p>
          <h1>{place.id === "training" ? "Nobody's training yet." : "The merchant is still unpacking."}</h1>
          <p>{place.id === "training" ? "Upgrades for your pieces will live here. For now the dummy just stands there, judging you." : "Consumables will be sold here. For now the cart is empty and the merchant is \"between suppliers\"."}</p>
        </>}
        <button className="text-button" onClick={() => setOpen(null)}>Back to the hideout</button>
      </section>
    </div>}
  </section>;
}
