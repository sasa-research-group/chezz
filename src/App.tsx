import { useEffect, useRef, useState } from "react";
import { PieceArt } from "./components/PieceArt";
import { COST, DAMAGE, ENCOUNTERS, ENERGY, HP, at, attack, attackTargets, campReason, coord, defend, endTurn, leaveCamp, move, moveTargets, newRun, passable, readRun, same } from "./game/turns";
import type { Pos, Run, Step, Unit } from "./game/turns";

const SAVE = "chezz.turns.v1";
function saved() { try { return readRun(localStorage.getItem(SAVE)); } catch { return null; } }
function exportRun(run: Run, feedback: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ prototype: "Escape from Exile (turn-based)", run, feedback }, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "chezz-exile-turns.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const HINT: Record<Unit["kind"], string> = {
  king: "One square in any direction. Keep him alive.",
  queen: "Slides straight or diagonally, 1 energy per square.",
  rook: "Slides in straight lines, 1 energy per square.",
  bishop: "Slides diagonally, 1 energy per square.",
  knight: "Jumps in an L for 2 energy, over anything.",
  pawn: "Steps forward. Strikes diagonally forward.",
};
type Playback = { steps: Step[]; run: Run; index: number };

function Board({ run, units, selected, flash, onSquare, locked }: { run: Run; units: Unit[]; selected: Unit | undefined; flash: Step | null; onSquare: (p: Pos) => void; locked: boolean }) {
  const e = ENCOUNTERS[run.encounter];
  const moves = selected && !locked ? moveTargets(run, selected) : [];
  const strikes = selected && !locked ? attackTargets(run, selected) : [];
  return <div className="board-camera">
    <div className="board-plane" style={{ aspectRatio: `${e.width}/${e.height}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${e.width}, 1fr)` }}>
        {Array.from({ length: e.width * e.height }, (_, i) => {
          const p = { x: i % e.width, y: Math.floor(i / e.width) }, piece = units.find(u => same(u, p));
          const m = moves.find(t => same(t, p)), s = strikes.find(t => same(t, p));
          const focus = flash?.focus.some(q => same(p, q));
          return <button key={i} disabled={locked || !passable(run, p)}
            className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${!passable(run, p) ? "wall" : ""} ${focus ? "impact-square" : ""}`}
            aria-label={`${coord(run, p)} ${piece ? `${piece.side} ${piece.kind}, ${piece.hp} HP` : passable(run, p) ? "empty" : "obstacle"}${m ? `, move for ${m.cost}` : ""}${s ? `, strike for ${s.cost}` : ""}`}
            onClick={() => onSquare(p)}><span className="tile-coord">{coord(run, p)}</span>
            {(m || s) && <span className={`target-dot ${s ? "attack-dot" : ""}`}><b className="cost-label">{(m ?? s)!.cost}</b></span>}</button>;
        })}
      </div>
      <div className="piece-layer" aria-hidden="true">{units.map(piece => {
        const damage = flash?.damage.find(d => d.id === piece.id);
        const spent = piece.side === "white" && piece.acted;
        return <div key={piece.id} className={`exile-piece ${piece.side} ${selected?.id === piece.id ? "selected" : ""} ${damage ? "hit" : ""} ${piece.defending ? "guarded" : ""} ${spent ? "spent" : ""}`}
          style={{ left: `${(piece.x + .5) / e.width * 100}%`, top: `${(piece.y + .5) / e.height * 100}%`, width: `${83 / e.width}%`, zIndex: Math.round(piece.y * 10 + 30) }}>
          <PieceArt kind={piece.kind} side={piece.side} /><span className="piece-health">{piece.hp}<small> / {HP[piece.kind]}</small></span>
          {damage && damage.amount > 0 && <span className="damage-pop" key={`${flash?.text}-${piece.id}`}>−{damage.amount}</span>}
          {piece.defending && <span className="guard-ring">◆</span>}
        </div>;
      })}</div>
    </div>
  </div>;
}

export default function App() {
  const [run, setRun] = useState<Run>(() => saved() ?? newRun());
  const [intro, setIntro] = useState(() => !saved());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [flash, setFlash] = useState<Step | null>(null);
  const [fast, setFast] = useState(false);
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = ENCOUNTERS[run.encounter], king = run.units.find(u => u.id === "king");
  const selected = run.units.find(u => u.id === selectedId && u.side === "white");
  const locked = !!playback || intro || run.phase !== "player";
  useEffect(() => { if (!intro) try { localStorage.setItem(SAVE, JSON.stringify(run)); } catch { setNotice("Autosave unavailable. Export your playtest to keep a copy."); } }, [run, intro]);
  useEffect(() => {
    if (!playback) return;
    timer.current = setTimeout(() => {
      if (playback.index + 1 < playback.steps.length) setPlayback({ ...playback, index: playback.index + 1 });
      else { setRun(playback.run); setPlayback(null); }
    }, reduced ? 90 : fast ? 250 : 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playback, fast, reduced]);
  useEffect(() => { if (!flash) return; const id = setTimeout(() => setFlash(null), 700); return () => clearTimeout(id); }, [flash]);

  const square = (p: Pos) => {
    if (locked) return;
    const u = at(run, p);
    if (u?.side === "white") { setSelectedId(u.id); setNotice(""); return; }
    if (!selected) return;
    if (u) {
      const { run: next, step } = attack(run, selected.id, u.id);
      if (next === run) { setNotice("That piece can't reach it, or you don't have the energy."); return; }
      setRun(next); setFlash(step); setNotice("");
      if (!next.units.some(v => v.id === selected.id)) setSelectedId(null);
      return;
    }
    const next = move(run, selected.id, p);
    if (next === run) { setNotice("Choose a highlighted square you can pay for."); return; }
    setRun(next); setNotice("");
  };
  const finishTurn = () => {
    if (locked) return;
    const result = endTurn(run);
    setSelectedId(null); setNotice("");
    if (!result.steps.length) { setRun(result.run); return; }
    setPlayback({ steps: result.steps, run: result.run, index: 0 });
  };
  function start() { if (timer.current) clearTimeout(timer.current); setPlayback(null); setRun(newRun()); setSelectedId(null); setIntro(false); setFeedback(""); setNotice(""); }
  const step = playback ? playback.steps[playback.index] : null;
  const shown = step ? step.units : run.units;
  const caption = step ? step.text : run.phase === "player" ? (selected ? `${selected.kind}: ${selected.acted ? "done this turn" : selected.moved ? "moved; can still strike or defend" : "ready"}.` : "Select one of your pieces.") : "";
  return <main className="exile-app">
    <header className="exile-header"><div className="exile-brand">CHEZZ<span>A SMALL REBELLION</span></div><div className="header-controls"><button onClick={() => setHelp(true)}>How to play</button><button disabled={!!playback} onClick={() => setIntro(true)}>New run</button></div></header>
    <section className="run-heading"><div><p className="kicker">ESCAPE FROM EXILE · {run.encounter + 1} / 3</p><h1>{e.title}</h1><p>{e.story}</p></div><div className="run-stats"><span>♛ <b>{king?.hp ?? 0} / {HP.king}</b><small>KING HEALTH</small></span><span>⚡ <b>{playback ? 0 : run.energy} / {ENERGY}</b><small>ENERGY</small></span><span>✦ <b>{run.gold}</b><small>GOLD</small></span></div></section>
    <div className="exile-layout">
      <section className="exile-arena"><div className="arena-topline"><span>{playback ? "ENEMY TURN" : `TURN ${run.turn} · YOUR MOVE`}</span><span>{shown.filter(u => u.side === "black").length} ENEMIES · DEFEAT THE PATROL</span></div>
        <Board run={run} units={shown} selected={selected} flash={step ?? flash} onSquare={square} locked={locked} />
        <div className={`playback-caption ${playback ? "playing" : ""}`} aria-live="polite">{caption}</div><div className="playback-controls"><label><input type="checkbox" checked={fast} onChange={ev => setFast(ev.target.checked)} /> Fast enemy turns</label>{playback && <button onClick={() => { if (timer.current) clearTimeout(timer.current); setRun(playback.run); setPlayback(null); }}>Skip enemy turn</button>}</div>
      </section>
      <aside className="exile-sidebar">
        <section className="plan-panel"><p className="kicker">⚡ {playback ? 0 : run.energy} OF {ENERGY} ENERGY LEFT</p><h2>{playback ? "The patrol answers." : "Your move, Your Majesty."}</h2>
          <div className="energy-pips" aria-hidden="true">{Array.from({ length: ENERGY }, (_, i) => <i key={i} className={i < (playback ? 0 : run.energy) ? "full" : ""} />)}</div>
          {selected && !locked ? <div className="selected-card"><PieceArt kind={selected.kind} side="white" /><div><strong>{selected.kind} · {selected.hp} HP · hits for {DAMAGE[selected.kind]}</strong><p>{HINT[selected.kind]} Green dots: move cost. Red dots: strike cost.</p></div></div> : <p>Select a piece. Each piece may move once, then strike or defend.</p>}
          {selected && !locked && <button className="secondary-button" disabled={selected.acted || run.energy < 1} onClick={() => setRun(defend(run, selected.id))}>Defend · 1 energy<span>blocks 1, counters</span></button>}
          <button className="primary-button" disabled={locked} onClick={finishTurn}>{playback ? "Enemy turn…" : "End turn"}<span>→</span></button>
          <p className="small-print">Energy refills every turn. A strike costs the squares to its target + 1. Defending pieces take 1 less damage and hit back if they can reach.</p>
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>
        <section className="resolution-panel"><details><summary>Battle log</summary>{run.log.map((text, i) => <p key={i}>{text}</p>)}</details><button className="text-button" onClick={() => exportRun(run, feedback)}>Export playtest ↗</button></section>
      </aside>
    </div>
    <footer className="exile-footer">Three battles. A little army. One crown to get back.<span>Prototype · turn-based</span></footer>
    {intro && <div className="exile-modal-shade"><section className="exile-modal intro-exile" role="dialog" aria-modal="true" aria-label="Start exile run"><div className="intro-king"><PieceArt kind="king" side="white" /></div><p className="kicker">BANISHED. BROKE. STILL WEARING THE CROWN.</p><h1>A king without a kingdom.</h1><p>Clear the road, recruit your first followers, and cross the bridge. You get {ENERGY} energy a turn to move and strike. Fallen allies stay gone. If your king falls, the run is over.</p><button className="primary-button" onClick={start}>Begin the rebellion<span>→</span></button>{saved() && <button className="text-button" onClick={() => setIntro(false)}>Keep playing current run</button>}</section></div>}
    {!intro && !playback && run.phase === "camp" && <div className="exile-modal-shade"><section className="exile-modal camp-modal" role="dialog" aria-modal="true" aria-label="Roadside camp"><p className="kicker">PATROL DEFEATED · +{e.reward} GOLD</p><h1>A fire. A choice.</h1><p>Your king has {king?.hp ?? 0} / {HP.king} HP. Your surviving army keeps its health. Choose one offer, then move on.</p><div className="camp-gold">✦ {run.gold} gold</div><div className="camp-offers">{(["bishop", "rook", "heal"] as const).map(choice => <button key={choice} disabled={!!campReason(run, choice)} onClick={() => { setRun(leaveCamp(run, choice)); setSelectedId(null); }}><div className="offer-art">{choice === "heal" ? <span>♥</span> : <PieceArt kind={choice} side="white" />}</div><h2>{choice === "heal" ? "Mend the king" : `Recruit a ${choice}`}</h2><p>{choice === "bishop" ? `${HP.bishop} HP, hits for ${DAMAGE.bishop}. Diagonal reach.` : choice === "rook" ? `${HP.rook} HP, hits for ${DAMAGE.rook}. Straight lines.` : `Restore 2 king HP, up to ${HP.king}.`}</p><strong>{campReason(run, choice) || `${COST[choice]} gold →`}</strong></button>)}</div><button className="text-button" onClick={() => { setRun(leaveCamp(run, "save")); setSelectedId(null); }}>Save the gold and continue →</button></section></div>}
    {!intro && !playback && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Exile run complete" : "Rebellion ended"}><p className="kicker">{run.phase === "victory" ? "THREE PATROLS DOWN" : "THE CROWN HAS FALLEN"}</p><h1>{run.phase === "victory" ? "A very small rebellion." : "Long live… somebody else."}</h1><p>{run.phase === "victory" ? `You crossed the bridge with ${run.units.filter(u => u.side === "white").length} surviving pieces and ${king?.hp ?? 0} king HP. This is the end of the prototype.` : "Your king fell. Your next attempt starts with a fresh crown and questionable confidence."}</p><label className="feedback-label">What felt clever? What was confusing?<textarea value={feedback} onChange={ev => setFeedback(ev.target.value)} placeholder="Leave a note for the next design pass…" /></label><button className="secondary-button" onClick={() => exportRun(run, feedback)}>Export feedback and action history</button><button className="primary-button" onClick={start}>Play again<span>→</span></button></section></div>}
    {help && <div className="exile-modal-shade"><section className="exile-modal help-exile" role="dialog" aria-modal="true" aria-label="How to play"><p className="kicker">A FEW ROYAL DECREES</p><h1>Move. Strike. Survive.</h1><ol><li>You act, then the enemy acts. You get {ENERGY} energy each turn; the enemy has its own pool.</li><li>Select a piece. It may move once in its chess shape: 1 energy per square, or 2 for a knight's jump. Pieces and walls block slides.</li><li>Then it may strike or defend. A strike costs the squares to the target + 1 and deals fixed damage: pawn 1, knight and bishop 2, king 2, rook and queen 3. A kill takes the target's square; otherwise a sliding piece stops next to it.</li><li>Defend costs 1. Until your next turn, that piece takes 1 less damage per hit and hits back any attacker it can reach.</li><li>Defeat all enemies to reach camp. Recruit or heal. Surviving HP carries over, fallen allies stay gone, and king death ends the run.</li></ol><button className="primary-button" onClick={() => setHelp(false)}>Back to the road<span>→</span></button></section></div>}
  </main>;
}
