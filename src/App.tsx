import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PieceRig } from "./components/PieceRig";
import type { RigAction } from "./components/PieceRig";
import { Hub } from "./components/Hub";
import { DAMAGE, promote, ENCOUNTERS, ENERGY, HP, at, attack, attackTargets, buy, coord, defend, endTurn, leaveCamp, move, moveTargets, newRun, passable, readRun, same } from "./game/turns";
import type { Kind, Pos, PromoteTo, Run, Step, Unit } from "./game/turns";

const SAVE = "chezz.turns.v1";
function saved() { try { return readRun(localStorage.getItem(SAVE)); } catch { return null; } }
function exportRun(run: Run, feedback: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify({ prototype: "Escape from Exile (turn-based)", run, feedback }, null, 2)], { type: "application/json" }));
  const a = document.createElement("a"); a.href = url; a.download = "chezz-exile-turns.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const HINT: Record<Unit["kind"], string> = {
  king: "One square in any direction. Keep him alive.",
  queen: "Slides straight or diagonally, 1 energy per square. Strikes any next square.",
  rook: "Slides in straight lines, 1 energy per square. Strikes the next square in line.",
  bishop: "Slides diagonally, 1 energy per square. Strikes the next diagonal square.",
  knight: "Jumps in an L for 2 energy, over anything.",
  pawn: "Steps forward. Strikes diagonally forward.",
};
type Playback = { steps: Step[]; before: Run; index: number };
/** Presentation-only animation state: what each piece is doing, which way it faces, and fallen pieces still playing their death. */
type Anim = { action: RigAction; key: number };
type Stage = { anims: Record<string, Anim>; facing: Record<string, 1 | -1>; ghosts: Unit[]; morph: Record<string, Kind> };
const DURATION: Record<RigAction, number> = { idle: 0, move: 480, attack: 560, defend: 340, hit: 420, death: 900, cheer: 1400, "morph-out": 650, "morph-in": 750 };
/** Identifies one end-of-battle moment, so its celebration plays once. */
const outroKey = (g: Run) => g.phase === "player" ? "" : `${g.encounter}-${g.phase}-${g.turn}-${g.units.length}`;

function Board({ run, units, selected, flash, onSquare, locked, stage, spd }: { run: Run; units: Unit[]; selected: Unit | undefined; flash: Step | null; onSquare: (p: Pos) => void; locked: boolean; stage: Stage; spd: number }) {
  const e = ENCOUNTERS[run.encounter];
  const moves = selected && !locked ? moveTargets(run, selected) : [];
  const strikes = selected && !locked ? attackTargets(run, selected) : [];
  return <div className="board-camera" style={{ "--aspect": e.width / e.height } as CSSProperties}>
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
      <div className="piece-layer" aria-hidden="true" style={{ "--spd": spd } as CSSProperties}>{[...units, ...stage.ghosts.filter(gh => !units.some(u => u.id === gh.id))].map(piece => {
        const damage = flash?.damage.find(d => d.id === piece.id);
        const spent = piece.side === "white" && piece.acted;
        const ghost = !units.includes(piece), anim = ghost ? { action: "death" as const, key: -1 } : stage.anims[piece.id] ?? { action: "idle" as const, key: 0 };
        return <div key={piece.id} className={`exile-piece ${piece.side} ${selected?.id === piece.id ? "selected" : ""} ${piece.defending ? "guarded" : ""} ${spent ? "spent" : ""} ${ghost ? "ghost" : ""}`}
          style={{ left: `${(piece.x + .5) / e.width * 100}%`, top: `${(piece.y + .5) / e.height * 100}%`, width: `${92 / e.width}%`, zIndex: Math.round(piece.y * 10 + (ghost ? 29 : 30)) }}>
          <PieceRig key={`${piece.id}-${anim.key}`} kind={stage.morph[piece.id] ?? piece.kind} side={piece.side} hue="blue" action={anim.action} defending={!!piece.defending} facing={stage.facing[piece.id] ?? (piece.side === "white" ? 1 : -1)} seed={piece.id} wounded={piece.hp < HP[piece.kind] && piece.hp <= HP[piece.kind] / 2} />
          {!ghost && !stage.morph[piece.id] && <span className="piece-health">{piece.hp}<small> / {HP[piece.kind]}</small></span>}
          {damage && damage.amount > 0 && <span className="damage-pop" key={`${flash?.text}-${piece.id}`}>−{damage.amount}</span>}

        </div>;
      })}</div>
    </div>
  </div>;
}

export default function App() {
  const [run, setRun] = useState<Run>(() => saved() ?? newRun());
  const [intro, setIntro] = useState(() => !saved());
  // End-of-battle sequence: let the last blow land, celebrate (or mourn), then show the menu.
  const [outroDone, setOutroDone] = useState(() => outroKey(saved() ?? newRun()));
  const [banner, setBanner] = useState<"" | "cleared" | "victory" | "defeat">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [flash, setFlash] = useState<Step | null>(null);
  const [fast, setFast] = useState(false);
  const [stage, setStage] = useState<Stage>({ anims: {}, facing: {}, ghosts: [], morph: {} });
  const animKey = useRef(1);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Animation time scale, matched to the enemy-turn step interval (800ms, 250ms fast, 90ms reduced).
  const spd = reducedMotion ? .1 : fast ? .3 : 1;
  const clearStage = () => { timers.current.forEach(clearTimeout); timers.current = []; setStage({ anims: {}, facing: {}, ghosts: [], morph: {} }); };
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  /** Plays one piece animation (optionally after a delay), then returns it to idle. */
  const animate = (id: string, action: RigAction, delay = 0) => {
    const go = () => {
      const key = animKey.current++;
      setStage(st => ({ ...st, anims: { ...st.anims, [id]: { action, key } } }));
      timers.current.push(setTimeout(() => setStage(st => st.anims[id]?.key === key ? { ...st, anims: { ...st.anims, [id]: { action: "idle", key: animKey.current++ } } } : st), DURATION[action] * spd));
    };
    if (delay) timers.current.push(setTimeout(go, delay * spd)); else go();
  };
  const face = (id: string, from: Pos, to: Pos) => { if (to.x !== from.x) setStage(st => ({ ...st, facing: { ...st.facing, [id]: to.x > from.x ? 1 : -1 } })); };
  /** Animates a step from the rules: a move or a strike, with hits, counters and deaths. */
  const perform = (step: Step, beforeUnits: Unit[]) => {
    const actor = beforeUnits.find(u => u.id === step.actor);
    if (!actor) return;
    const target = step.target ? beforeUnits.find(u => u.id === step.target) : undefined;
    if (step.kind === "defend") { animate(actor.id, "defend"); return; }
    if (step.kind === "promote") {
      // Show the old piece transforming, then swap in the new one.
      setStage(st => ({ ...st, morph: { ...st.morph, [actor.id]: step.from ?? actor.kind } }));
      animate(actor.id, "morph-out");
      timers.current.push(setTimeout(() => {
        setStage(st => { const morph = { ...st.morph }; delete morph[actor.id]; return { ...st, morph }; });
        animate(actor.id, "morph-in");
      }, DURATION["morph-out"] * spd));
      return;
    }
    if (step.kind === "move") { const to = step.units.find(u => u.id === actor.id); if (to) face(actor.id, actor, to); animate(actor.id, "move"); return; }
    if (target) face(actor.id, actor, target);
    animate(actor.id, "attack");
    const dying = beforeUnits.filter(u => step.killed.includes(u.id));
    if (dying.length) {
      setStage(st => ({ ...st, ghosts: [...st.ghosts.filter(g => !step.killed.includes(g.id)), ...dying] }));
      timers.current.push(setTimeout(() => setStage(st => ({ ...st, ghosts: st.ghosts.filter(g => !step.killed.includes(g.id)) })), (230 + DURATION.death) * spd));
    }
    if (target && !step.killed.includes(target.id)) animate(target.id, "hit", 230);
    if (step.damage.some(d => d.id === actor.id) && !step.killed.includes(actor.id)) animate(actor.id, "hit", 520);
  };
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = ENCOUNTERS[run.encounter], king = run.units.find(u => u.id === "king");
  const selected = run.units.find(u => u.id === selectedId && u.side === "white");
  const locked = !!playback || intro || run.phase !== "player" || !!run.promoting;
  const choosePromotion = (kind: PromoteTo) => {
    if (!run.promoting) return;
    const { run: next, step } = promote(run, run.promoting, kind);
    if (next === run || !step) return;
    setRun(next); perform(step, run.units);
  };
  const key = outroKey(run), outro = key !== "" && key !== outroDone;
  useEffect(() => {
    if (!outro || playback || intro) return;
    const scale = Math.max(spd, .5);
    const celebrate = setTimeout(() => {
      setBanner(run.phase === "defeat" ? "defeat" : run.phase === "victory" ? "victory" : "cleared");
      if (run.phase !== "defeat") run.units.filter(u => u.side === "white").forEach((u, i) => animate(u.id, "cheer", i * 120));
    }, (DURATION.death + 250) * spd);
    const done = setTimeout(() => { setBanner(""); setOutroDone(key); }, (DURATION.death + 250) * spd + 1900 * scale);
    return () => { clearTimeout(celebrate); clearTimeout(done); };
  }, [outro, playback, intro, key]);
  const skipOutro = () => { setBanner(""); setOutroDone(key); };
  useEffect(() => { if (!intro) try { localStorage.setItem(SAVE, JSON.stringify(run)); } catch { setNotice("Autosave unavailable. Export your playtest to keep a copy."); } }, [run, intro]);
  useEffect(() => {
    if (!playback) return;
    timer.current = setTimeout(() => {
      if (playback.index + 1 < playback.steps.length) setPlayback({ ...playback, index: playback.index + 1 });
      else setPlayback(null);
    }, reduced ? 90 : fast ? 250 : 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playback, fast, reduced]);
  useEffect(() => {
    if (!playback) return;
    const prev = playback.index === 0 ? playback.before.units : playback.steps[playback.index - 1].units;
    perform(playback.steps[playback.index], prev);
  }, [playback?.steps, playback?.index]);
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
      if (step) perform(step, run.units);
      if (!next.units.some(v => v.id === selected.id)) setSelectedId(null);
      return;
    }
    const next = move(run, selected.id, p);
    if (next === run) { setNotice("Choose a highlighted square you can pay for."); return; }
    face(selected.id, selected, p); animate(selected.id, "move");
    setRun(next); setNotice("");
  };
  const finishTurn = () => {
    if (locked) return;
    const result = endTurn(run);
    setSelectedId(null); setNotice("");
    // Commit the enemy's result at once (autosave included); playback only shows it.
    setRun(result.run);
    if (result.steps.length) setPlayback({ steps: result.steps, before: run, index: 0 });
  };
  function start() { clearStage(); setBanner(""); setOutroDone(""); if (timer.current) clearTimeout(timer.current); setPlayback(null); setRun(newRun()); setSelectedId(null); setIntro(false); setFeedback(""); setNotice(""); }
  const step = playback ? playback.steps[playback.index] : null;
  const shown = step ? step.units : run.units;
  const caption = step ? step.text : run.phase === "player" ? (selected ? `${selected.kind}: ${selected.acted ? "done this turn" : selected.moved ? "moved; can still strike or defend" : "ready"}.` : "Select one of your pieces.") : "";
  return <main className="exile-app">
    <header className="exile-header"><div className="exile-brand">CHEZZ<span>A SMALL REBELLION</span></div><div className="header-controls"><button onClick={() => setHelp(true)}>How to play</button><button disabled={!!playback} onClick={() => setIntro(true)}>New run</button></div></header>
    <section className="run-heading"><div><p className="kicker">ESCAPE FROM EXILE · {run.encounter + 1} / 3</p><h1>{e.title}</h1><p>{e.story}</p></div><div className="run-stats"><span>♛ <b>{shown.find(u => u.id === "king")?.hp ?? 0} / {HP.king}</b><small>KING HEALTH</small></span><span>⚡ <b>{playback ? 0 : run.energy} / {ENERGY}</b><small>ENERGY</small></span><span>✦ <b>{run.gold}</b><small>GOLD</small></span></div></section>
    <div className="exile-layout">
      <section className="exile-arena"><div className="arena-topline"><span>{playback ? "ENEMY TURN" : `TURN ${run.turn} · YOUR MOVE`}</span><span>{shown.filter(u => u.side === "black").length} ENEMIES · DEFEAT THE PATROL</span></div>
        <Board run={playback ? playback.before : run} units={shown} selected={selected} flash={step ?? flash} onSquare={square} locked={locked} stage={stage} spd={spd} />
        <p className="sr-only" aria-live="polite">{banner === "defeat" ? "The crown falls." : banner === "victory" ? "Victory!" : banner === "cleared" ? "Road cleared!" : ""}</p>
        {banner && <button className={`battle-banner ${banner}`} onClick={skipOutro} autoFocus>
          <span>{banner === "defeat" ? "The crown falls…" : banner === "victory" ? "Victory!" : "Road cleared!"}</span>
          <small>Tap to continue</small></button>}
        <div className={`playback-caption ${playback ? "playing" : ""}`} aria-live="polite">{caption}</div><div className="playback-controls"><label><input type="checkbox" checked={fast} onChange={ev => setFast(ev.target.checked)} /> Fast enemy turns</label>{playback && <button onClick={() => { if (timer.current) clearTimeout(timer.current); setPlayback(null); }}>Skip enemy turn</button>}</div>
      </section>
      <aside className="exile-sidebar">
        <section className="plan-panel action-bar"><p className="kicker">⚡ {playback ? 0 : run.energy} OF {ENERGY} ENERGY LEFT</p><h2>{playback ? "The patrol answers." : "Your move, Your Majesty."}</h2>
          <div className="energy-pips" aria-hidden="true">{Array.from({ length: ENERGY }, (_, i) => <i key={i} className={i < (playback ? 0 : run.energy) ? "full" : ""} />)}</div>
          {selected && !locked ? <div className="selected-card"><PieceRig kind={selected.kind} side="white" /><div><strong>{selected.kind} · {selected.hp} HP · hits for {DAMAGE[selected.kind]}</strong><p>{HINT[selected.kind]} Green dots: move cost. Red dots: strike cost.</p></div></div> : <p>Select a piece. Each piece may move once, then strike or defend.</p>}
          {selected && !locked && <button className="secondary-button" disabled={selected.acted || run.energy < 1} onClick={() => { setRun(defend(run, selected.id)); animate(selected.id, "defend"); }}>Defend · 1 energy<span>blocks 1, counters</span></button>}
          <button className="primary-button" disabled={locked} onClick={finishTurn}>{playback ? "Enemy turn…" : "End turn"}<span>→</span></button>
          <p className="small-print">Energy refills every turn. Strikes reach only the next square in a piece's shape and cost 2 (knights 3). Defending pieces take 1 less damage and hit back if they can reach.</p>
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>
        <section className="resolution-panel"><details><summary>Battle log</summary>{run.log.map((text, i) => <p key={i}>{text}</p>)}</details><button className="text-button" onClick={() => exportRun(run, feedback)}>Export playtest ↗</button></section>
      </aside>
    </div>
    <footer className="exile-footer">Three battles. A little army. One crown to get back.<span>Prototype · turn-based</span></footer>
    {intro && <div className="exile-modal-shade"><section className="exile-modal intro-exile" role="dialog" aria-modal="true" aria-label="Start exile run"><div className="intro-king"><PieceRig kind="king" side="white" /></div><p className="kicker">BANISHED. BROKE. STILL WEARING THE CROWN.</p><h1>A king without a kingdom.</h1><p>Clear the road, recruit your first followers, and cross the bridge. You get {ENERGY} energy a turn to move and strike. Fallen allies stay gone. If your king falls, the run is over.</p><button className="primary-button" onClick={start}>Begin the rebellion<span>→</span></button>{saved() && <button className="text-button" onClick={() => setIntro(false)}>Keep playing current run</button>}</section></div>}
    {!intro && !playback && run.promoting && <div className="exile-modal-shade"><section className="exile-modal camp-modal" role="dialog" aria-modal="true" aria-label="Promote your pawn"><p className="kicker">YOUR PAWN MADE IT</p><h1>Promotion!</h1><p>It reached the far row. Pick what it becomes, at full health. It can still strike or defend this turn.</p><div className="camp-offers">{(["queen", "rook", "bishop", "knight"] as const).map(kind => <button key={kind} onClick={() => choosePromotion(kind)}><div className="offer-art"><PieceRig kind={kind} side="white" /></div><h2>{kind[0].toUpperCase() + kind.slice(1)}</h2><p>{HP[kind]} HP, hits for {DAMAGE[kind]}.</p></button>)}</div></section></div>}
    {!intro && !playback && !outro && run.phase === "camp" && <Hub run={run} reward={e.reward} spd={spd} onBuy={choice => setRun(r => buy(r, choice))} onLeave={() => { clearStage(); setRun(r => leaveCamp(r)); setSelectedId(null); }} />}
    {!intro && !playback && !outro && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Exile run complete" : "Rebellion ended"}><p className="kicker">{run.phase === "victory" ? "THREE PATROLS DOWN" : "THE CROWN HAS FALLEN"}</p><h1>{run.phase === "victory" ? "A very small rebellion." : "Long live… somebody else."}</h1><p>{run.phase === "victory" ? `You crossed the bridge with ${run.units.filter(u => u.side === "white").length} surviving pieces and ${king?.hp ?? 0} king HP. This is the end of the prototype.` : "Your king fell. Your next attempt starts with a fresh crown and questionable confidence."}</p><label className="feedback-label">What felt clever? What was confusing?<textarea value={feedback} onChange={ev => setFeedback(ev.target.value)} placeholder="Leave a note for the next design pass…" /></label><button className="secondary-button" onClick={() => exportRun(run, feedback)}>Export feedback and action history</button><button className="primary-button" onClick={start}>Play again<span>→</span></button></section></div>}
    {help && <div className="exile-modal-shade"><section className="exile-modal help-exile" role="dialog" aria-modal="true" aria-label="How to play"><p className="kicker">A FEW ROYAL DECREES</p><h1>Move. Strike. Survive.</h1><ol><li>You act, then the enemy acts. You get {ENERGY} energy each turn; the enemy has its own pool.</li><li>Select a piece. It may move once in its chess shape: 1 energy per square, or 2 for a knight's jump. Pieces and walls block slides.</li><li>Then it may strike or defend. A strike reaches only the next square in the piece's shape (a knight's jump for knights), so a rook across the board must travel first. It costs 2 (a knight's 3) and deals fixed damage: pawn 1, knight and bishop 2, king 2, rook and queen 3. The striker stays where it is, even on a kill.</li><li>Defend costs 1. Until your next turn, that piece takes 1 less damage per hit and hits back any attacker it can reach.</li><li>A pawn that reaches the far row promotes: yours becomes the piece you pick, an enemy pawn becomes a queen. Both arrive at full health.</li><li>Defeat all enemies to reach the rebel hideout. Walk the king to the barracks to recruit or heal, then take the road out. Surviving HP carries over, fallen allies stay gone, and king death ends the run.</li></ol><button className="primary-button" onClick={() => setHelp(false)}>Back to the road<span>→</span></button></section></div>}
  </main>;
}
