import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { RIG_MS as DURATION } from "./components/PieceRig";
import { PieceSprite } from "./components/PieceSprite";
import { BattleBanner, GuardBadge, MATE_LINES } from "./components/BoardArt";
import type { BannerKind } from "./components/BoardArt";
import type { RigAction } from "./components/PieceRig";
import { Hub } from "./components/Hub";
import { DAMAGE, approaches, promote, ENCOUNTERS, ENERGY, PUZZLES, alt, altActions, at, attack, attackTargets, boardOf, buy, canEscape, coord, defend, endTurn, exposesKing, inCheck, kingThreat, leaveCamp, maxHp, move, moveTargets, newRun, passable, readRun, same, startPuzzle, strikeExposesKing, variantOf, walkAndStrike, abilityOf, RETREAT_AFTER, TIRE_AFTER, crownOf } from "./game/turns";
import type { AltAction, Kind, Pos, PromoteTo, Run, Step, Target, Unit } from "./game/turns";
import { gateAt, gateOpen, isCrumbling, isHole, isIce, isWall, leverAt, portalExit } from "./game/board";
import { isDazed, isHexed } from "./game/status";

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
/** Choosing a square: where to walk before striking a target (when there's more than one), or what an ability acts on. */
type Picking = { kind: "strike"; target: Unit; options: Target[] } | { kind: "alt"; action: AltAction; targets: Pos[] };
type Playback = { steps: Step[]; before: Run; index: number };
/** Presentation-only animation state: what each piece is doing, which way it faces, and fallen pieces still playing their death. */
type Anim = { action: RigAction; key: number };
/** lunge: where a leaping knight is drawn mid-strike ("home" while it flips back). doomed: fallen pieces still waiting for the blow to land. */
type Stage = { anims: Record<string, Anim>; facing: Record<string, 1 | -1>; ghosts: Unit[]; morph: Record<string, Kind>; lunge: Record<string, Pos | "home">; doomed: string[]; holdFlash: boolean; mating: boolean };
const EMPTY_STAGE: Stage = { anims: {}, facing: {}, ghosts: [], morph: {}, lunge: {}, doomed: [], holdFlash: false, mating: false };
/** Identifies one end-of-battle moment, so its celebration plays once. */
const outroKey = (g: Run) => g.phase === "player" ? "" : `${g.encounter}-${g.phase}-${g.turn}-${g.units.length}`;

/** What a square's tile is called in the cell's accessible name. */
const TILE_NAME: Record<string, string> = { hole: "pit", crumbling: "crumbling tile", burrow: "burrow", ice: "ice", "gate-open": "gate (open)", "gate-shut": "gate (shut)", lever: "lever", wall: "obstacle" };
/** A floor lever: a plate, an arm and a knob. It leans the other way once its gates stand open. */
const LeverGlyph = ({ pulled }: { pulled: boolean }) => <svg className={`lever-glyph ${pulled ? "pulled" : ""}`} viewBox="0 0 40 40" aria-hidden="true">
  <rect x="9" y="29" width="22" height="7" rx="2.5" fill="#5b4033" stroke="#382f2e" strokeWidth="2.5" />
  <path d="M20 30 L29 11" stroke="#382f2e" strokeWidth="4.5" strokeLinecap="round" /><path d="M20 30 L29 11" stroke="#8a7d6b" strokeWidth="1.5" strokeLinecap="round" />
  <circle cx="30" cy="9" r="5.5" fill="#c4553f" stroke="#382f2e" strokeWidth="2.5" /></svg>;

/** Timed statuses and the misfit king's naps, as small chips beside the piece. Nothing renders for a piece with none. */
function StatusBadges({ piece, turn }: { piece: Unit; turn: number }) {
  const burning = typeof piece.mods?.burning === "number" && piece.mods.burning > 0 ? piece.mods.burning : 0;
  const cat = piece.kind === "king" && variantOf(piece) === "misfit";
  const badges = [
    isDazed(piece, turn) && <span key="dazed" className="status-badge dazed" title="Dazed: can't move this turn">💫</span>,
    isHexed(piece, turn) && <span key="hexed" className="status-badge hexed" title="Hexed: deals 1 less">🧿</span>,
    burning > 0 && <span key="burning" className="status-badge burning" title={`Burning: takes 1 at the start of its turn, ${burning} more time${burning === 1 ? "" : "s"}`}>🔥{burning}</span>,
    cat && (piece.mods?.awake === true ? <span key="awake" className="status-badge awake" title="Awake: zoomies, moves like a queen this turn">⚡</span> : <span key="asleep" className="status-badge asleep" title="Asleep: can't move, strike or defend; takes 1 less from every hit. A friend ending a move beside him wakes him.">💤</span>),
  ].filter(Boolean);
  return badges.length ? <span className="status-badges">{badges}</span> : null;
}

function Board({ run, units, selected, flash: rawFlash, onSquare, locked, stage, spd, picking, checkers }: { run: Run; units: Unit[]; selected: Unit | undefined; flash: Step | null; onSquare: (p: Pos) => void; locked: boolean; stage: Stage; spd: number; picking: Picking | null; checkers: string[] }) {
  const e = boardOf(run);
  // While a knight is still flipping over, its blow hasn't landed: hold back damage pops and impact squares.
  const flash = stage.holdFlash ? null : rawFlash;
  // Moves that would put your own king in check are shown, but blocked with a red ✕.
  const moves = selected && !locked ? moveTargets(run, selected).map(t => ({ ...t, unsafe: exposesKing(run, selected.id, t) })) : [];
  // Strikes in place, plus enemies the piece can walk up to and strike this turn (cheapest way in).
  const strikes = selected && !locked ? [...attackTargets(run, selected).filter(t => !strikeExposesKing(run, selected.id, t.id!)), ...run.units.filter(v => v.side === "black").flatMap(v => {
    const ways = approaches(run, selected.id, v.id);
    return ways.length ? [{ x: v.x, y: v.y, cost: Math.min(...ways.map(t => t.cost)), id: v.id }] : [];
  })] : [];
  const aiming = picking?.kind === "strike" ? picking : null, alting = picking?.kind === "alt" ? picking : null;
  // Checkmate: zoom in on the fallen king and dim everything else.
  const fallen = stage.mating ? stage.ghosts.find(g => g.id === "king") : undefined;
  const focus: Record<string, string> = fallen ? { "--zx": `${(fallen.x + .5) / e.width * 100}%`, "--zy": `${(fallen.y + .5) / e.height * 100}%` } : {};
  return <div className={`board-camera ${fallen ? "mate-zoom" : ""}`} style={{ "--aspect": e.width / e.height, ...focus } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${e.width}/${e.height}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${e.width}, 1fr)` }}>
        {Array.from({ length: e.width * e.height }, (_, i) => {
          const p = { x: i % e.width, y: Math.floor(i / e.width) }, piece = units.find(u => same(u, p));
          // The square's tile: a pit (dug, or a fallen bridge tile), a crumbling bridge tile, a burrow mouth, ice, a gate or a lever. Plain walls last.
          const gate = gateAt(run, p), lever = leverAt(run, p), burrow = !!portalExit(run, p);
          const tile = isHole(run, p) ? "hole" : isCrumbling(run, p) ? "crumbling" : burrow ? "burrow" : isIce(run, p) ? "ice" : gate ? (gateOpen(run, gate) ? "gate-open" : "gate-shut") : lever ? "lever" : isWall(run, p) ? "wall" : "";
          const pulled = !!lever && (e.gates ?? []).some(x => x.group === lever.group && gateOpen(run, x));
          // While picking where to strike from, only those squares (and the target) are marked; while picking an ability's target, only its targets.
          const pick = aiming?.options.find(t => same(t, p)), aimed = !!aiming && same(aiming.target, p), altPick = !!alting?.targets.some(t => same(t, p));
          const m = picking ? undefined : moves.find(t => same(t, p)), s = picking ? undefined : strikes.find(t => same(t, p));
          const focus = flash?.focus.some(q => same(p, q));
          // Pits and shut gates are out of play like walls, unless an ability targets one (Brick demolishes walls). An empty burrow
          // mouth is only in play while it's a destination (a move through the other mouth lands here).
          const inPlay = altPick || (passable(run, p) && (!burrow || !!piece || !!m || !!s || !!pick));
          return <button key={i} disabled={locked || !inPlay}
            className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${tile} ${focus ? "impact-square" : ""} ${aimed ? "aimed" : ""} ${altPick ? "alt-aimed" : ""} ${piece?.defending ? `guarded-tile ${piece.side}` : ""} ${s ? "strikeable" : ""}`}
            aria-label={`${coord(run, p)} ${piece ? `${piece.side} ${piece.kind}, ${piece.hp} HP${piece.defending ? ", defending" : ""}${tile && tile !== "wall" ? `, on ${TILE_NAME[tile]}` : ""}` : tile ? TILE_NAME[tile] : "empty"}${m ? m.unsafe ? ", blocked: would put your king in check" : `, move for ${m.cost}` : ""}${s ? `, strike for ${s.cost}${attackTargets(run, selected!).some(t => same(t, p)) ? "" : " (walks up first)"}` : ""}${pick ? `, walk here and strike the ${aiming!.target.kind} for ${pick.cost}` : ""}${aimed ? ", target" : ""}${altPick ? `, ${alting!.action.label} here` : ""}`}
            onClick={() => onSquare(p)}><span className="tile-coord">{coord(run, p)}</span>
            {lever && <LeverGlyph pulled={pulled} />}
            {altPick && <span className="target-dot alt-dot"><b className="cost-label">{alting!.action.label}</b></span>}
            {m && !m.unsafe && <span className="target-dot"><b className="cost-label">{m.cost}</b></span>}
            {m?.unsafe && <span className="target-dot unsafe-dot" title="Would put your king in check"><b className="cost-label">✕</b></span>}
            {pick && <span className="target-dot approach-dot"><b className="cost-label">⚔{pick.cost}</b></span>}</button>;
        })}
      </div>
      <div className="piece-layer" aria-hidden="true" style={{ "--spd": spd } as CSSProperties}>{[...units, ...stage.ghosts.filter(gh => !units.some(u => u.id === gh.id))].map(piece => {
        const damage = flash?.damage.find(d => d.id === piece.id);
        const spent = piece.side === "white" && piece.acted;
        const ghost = !units.includes(piece), doomed = ghost && stage.doomed.includes(piece.id);
        const anim = ghost && piece.id === "king" && stage.mating ? { action: "mate" as const, key: -3 } : doomed ? stage.anims[piece.id] ?? { action: "idle" as const, key: -2 } : ghost ? { action: "death" as const, key: -1 } : stage.anims[piece.id] ?? { action: "idle" as const, key: 0 };
        const lunge = stage.lunge[piece.id], spot = lunge && lunge !== "home" ? lunge : piece;
        // Enemies you can strike right now glow and carry a sword badge with the cost, drawn over the art.
        const strike = !ghost && !picking ? strikes.find(t => t.id === piece.id) : undefined;
        const altAimed = !ghost && !!alting?.targets.some(t => same(t, piece));
        return <div key={piece.id} className={`exile-piece has-sprite ${piece.side} ${strike ? "targetable" : ""} ${altAimed ? "alt-target" : ""} ${selected?.id === piece.id ? "selected" : ""} ${piece.defending ? "guarded" : ""} ${spent ? "spent" : ""} ${ghost ? "ghost" : ""} ${lunge ? "lunging" : ""}`}
          style={{ left: `${(spot.x + .5) / e.width * 100}%`, top: `${(spot.y + .5) / e.height * 100}%`, width: `${92 / e.width}%`, zIndex: Math.round(spot.y * 10 + (lunge ? 35 : ghost ? 29 : 30)) }}>
          <PieceSprite key={`${piece.id}-${anim.key}`} kind={stage.morph[piece.id] ?? piece.kind} variant={variantOf(piece)} side={piece.side} action={anim.action} defending={!!piece.defending} facing={stage.facing[piece.id] ?? (piece.side === "white" ? 1 : -1)} seed={piece.id} wounded={piece.hp < maxHp(piece) && piece.hp <= maxHp(piece) / 2} />
          {strike && <span className="strike-badge">⚔ {strike.cost}</span>}
          {!ghost && checkers.includes(piece.id) && <span className="check-mark" title="Could kill your king next turn">!</span>}
          {!ghost && checkers.length > 0 && piece.id === "king" && <span className="check-tag">CHECK</span>}
          {!ghost && piece.defending && <GuardBadge />}
          {!ghost && typeof piece.mods?.absorbed === "string" && (piece.mods.absorbedUntil as number) >= run.turn && <span className="absorb-badge" title={`Ate a ${piece.mods.absorbed}: moves like one for ${(piece.mods.absorbedUntil as number) - run.turn + 1} more turn(s)`}>🍴 {piece.mods.absorbed}</span>}
          {!ghost && <StatusBadges piece={piece} turn={run.turn} />}
          {!ghost && !stage.morph[piece.id] && <span className="piece-health">{piece.hp}<small> / {maxHp(piece)}</small></span>}
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
  const [banner, setBanner] = useState<"" | BannerKind>("");
  // The road run waiting at the hideout while a Guild puzzle is played; it stays the saved run.
  const [campaign, setCampaign] = useState<Run | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [flash, setFlash] = useState<Step | null>(null);
  const [fast, setFast] = useState(false);
  const [stage, setStage] = useState<Stage>(EMPTY_STAGE);
  const animKey = useRef(1);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Animation time scale, matched to the enemy-turn step interval (800ms, 250ms fast, 90ms reduced).
  const spd = reducedMotion ? .1 : fast ? .3 : 1;
  const clearStage = () => { timers.current.forEach(clearTimeout); timers.current = []; setStage(EMPTY_STAGE); setStriding(false); setPicking(null); };
  const [picking, setPicking] = useState<Picking | null>(null);
  // The king's last stand: where he fell and who mated him, for the finale.
  const [fall, setFall] = useState<{ king: Unit; by: string[] } | null>(null);
  // True while a piece walks up to strike: the strike lands when the walk ends.
  const [striding, setStriding] = useState(false);
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
    // Knights show off: front-flip over to the target, smack it, backflip home. The rules still strike from
    // the knight's own square; this is only how it looks. Everything else waits for the blow to land.
    const leaps = actor.kind === "knight" && !!target && step.kind === "strike";
    const impact = leaps ? DURATION.leap : 0, home = impact + 380;
    const actorDies = step.killed.includes(actor.id);
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms * spd));
    const dropLunge = () => setStage(st => { const lunge = { ...st.lunge }; delete lunge[actor.id]; return { ...st, lunge }; });
    if (leaps) {
      const near = { x: actor.x + (target.x - actor.x) * .62, y: actor.y + (target.y - actor.y) * .62 };
      setStage(st => ({ ...st, lunge: { ...st.lunge, [actor.id]: near }, holdFlash: true }));
      later(impact + 230, () => setStage(st => ({ ...st, holdFlash: false })));
      animate(actor.id, "leap");
      animate(actor.id, "attack", impact);
      // A knight killed by a counter falls where it struck; otherwise it backflips home.
      if (!actorDies) {
        later(home, () => { setStage(st => ({ ...st, lunge: { ...st.lunge, [actor.id]: "home" } })); animate(actor.id, "leap-back"); });
        later(home + DURATION["leap-back"], dropLunge);
      }
    } else animate(actor.id, "attack");
    const dying = beforeUnits.filter(u => step.killed.includes(u.id));
    if (dying.length) {
      // Each fallen piece waits for the blow that fells it: the target at impact, a countered attacker after.
      const fallsAt = (id: string) => (id === actor.id ? impact + 520 : impact + 230);
      setStage(st => ({ ...st, ghosts: [...st.ghosts.filter(g => !step.killed.includes(g.id)), ...dying], doomed: leaps || actorDies ? [...st.doomed, ...step.killed] : st.doomed }));
      // A fallen king stays on his square, reeling, until the checkmate finale.
      if (step.killed.includes("king")) {
        setStage(st => ({ ...st, doomed: st.doomed.includes("king") ? st.doomed : [...st.doomed, "king"] }));
        animate("king", "hit", fallsAt("king"));
      }
      for (const id of step.killed.filter(k => k !== "king")) {
        if (leaps || actorDies) later(fallsAt(id), () => setStage(st => ({ ...st, doomed: st.doomed.filter(d => d !== id) })));
        later(fallsAt(id) + DURATION.death, () => { setStage(st => ({ ...st, ghosts: st.ghosts.filter(g => g.id !== id) })); if (id === actor.id) dropLunge(); });
      }
    }
    if (step.kind === "alt") {
      // An ability's victims: whoever took damage or was shoved somewhere else (a honk, a heave) reels.
      for (const u of beforeUnits) {
        if (u.id === actor.id || step.killed.includes(u.id)) continue;
        const after = step.units.find(w => w.id === u.id);
        if (step.damage.some(d => d.id === u.id) || (after && !same(after, u))) animate(u.id, "hit", 230);
      }
    } else if (target && !step.killed.includes(target.id)) animate(target.id, "hit", impact + 230);
    // A surviving knight takes its counter after landing home, so the backflip isn't cut short.
    if (step.damage.some(d => d.id === actor.id) && !actorDies) animate(actor.id, "hit", leaps ? home + DURATION["leap-back"] : 520);
  };
  const [help, setHelp] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = boardOf(run), king = run.units.find(u => u.id === "king");
  const inPuzzle = run.puzzle !== undefined;
  const selected = run.units.find(u => u.id === selectedId && u.side === "white");
  const locked = !!playback || intro || run.phase !== "player" || !!run.promoting || striding;
  // Check: the enemy's next turn could kill the king. You can't end the turn until he's safe, unless nothing can make him safe.
  const check = useMemo(() => {
    if (run.phase !== "player" || run.promoting || striding || !inCheck(run)) return null;
    return { attackers: kingThreat(run).attackers, escape: canEscape(run) };
  }, [run, striding]);
  const checkLocked = !!check?.escape;
  const unsafeShown = !!selected && !locked && moveTargets(run, selected).some(t => exposesKing(run, selected.id, t));
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
    if (run.phase === "defeat" && fall) {
      // Checkmate: spotlight the king, let the attackers gloat, then the big fall and the banner.
      const begin = setTimeout(() => {
        setStage(st => ({ ...st, mating: true, ghosts: st.ghosts.some(g => g.id === "king") ? st.ghosts : [...st.ghosts, fall.king], doomed: st.doomed.includes("king") ? st.doomed : [...st.doomed, "king"] }));
        fall.by.forEach((id, i) => { animate(id, "cheer", 300 + i * 150); animate(id, "cheer", 1900 + i * 150); });
      }, 250 * spd);
      const slam = setTimeout(() => setBanner("checkmate"), (250 + 1500) * spd);
      const done = setTimeout(() => { setBanner(""); setOutroDone(key); }, (250 + DURATION.mate) * spd + 1900 * scale);
      return () => { clearTimeout(begin); clearTimeout(slam); clearTimeout(done); };
    }
    const celebrate = setTimeout(() => {
      const retreated = run.flags?.retreated === true;
      setBanner(retreated && !inPuzzle ? "retreat" : run.phase === "defeat" ? (inPuzzle && king ? "timeout" : "defeat") : run.phase === "victory" ? (inPuzzle ? "solved" : "victory") : "cleared");
      if (run.phase !== "defeat" && !retreated) run.units.filter(u => u.side === "white").forEach((u, i) => animate(u.id, "cheer", i * 120));
    }, (DURATION.leap + DURATION.death + 250) * spd);
    const done = setTimeout(() => { setBanner(""); setOutroDone(key); }, (DURATION.leap + DURATION.death + 250) * spd + 1900 * scale);
    return () => { clearTimeout(celebrate); clearTimeout(done); };
  }, [outro, playback, intro, key]);
  const skipOutro = () => { setBanner(""); setOutroDone(key); };
  useEffect(() => { if (!intro) try { localStorage.setItem(SAVE, JSON.stringify(campaign ?? run)); } catch { setNotice("Autosave unavailable. Export your playtest to keep a copy."); } }, [run, campaign, intro]);
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
  useEffect(() => { if (!flash || stage.holdFlash) return; const id = setTimeout(() => setFlash(null), 700); return () => clearTimeout(id); }, [flash, stage.holdFlash]);

  const strikeNow = (g: Run, attacker: Unit, target: Unit) => {
    const { run: next, step } = attack(g, attacker.id, target.id);
    if (next === g) return false;
    land(g, next, step, attacker, target);
    return true;
  };
  /** Commits a strike's result and plays it. */
  const land = (g: Run, next: Run, step: Step | null, attacker: Unit, target: Unit) => {
    setRun(next); setNotice("");
    setFlash(step);
    if (step) perform(step, g.units);
    // A king felled by a defender's counter on your own turn still gets his finale.
    const king = g.units.find(u => u.id === "king");
    if (next.phase === "defeat" && king) setFall({ king, by: [target.id] });
    if (!next.units.some(v => v.id === attacker.id)) setSelectedId(null);
  };
  /** Walk to `from`, then strike `target` once the walk has played. */
  const strikeFrom = (from: Pos, attacker: Unit, target: Unit) => {
    setPicking(null);
    // Judged as one move: the walk may pass through danger if the strike leaves the king safe.
    const plan = walkAndStrike(run, attacker.id, from, target.id);
    if (!plan) { setNotice("That piece can't get there this turn."); return; }
    const walked = plan.walked;
    face(attacker.id, attacker, from); animate(attacker.id, "move");
    setRun(walked); setNotice(""); setStriding(true);
    timers.current.push(setTimeout(() => {
      setStriding(false);
      const moved = walked.units.find(v => v.id === attacker.id)!;
      face(attacker.id, moved, target);
      // Land exactly the move that was approved, so what's offered is what happens.
      land(walked, plan.run, plan.step, moved, target);
    }, DURATION.move * spd));
  };
  /** Takes an ability's action with the selected piece: at once if it needs no target, else after the player picks one. */
  const takeAlt = (action: AltAction, target?: Pos) => {
    if (!selected) return;
    if (action.targets.length && !target) {
      setPicking({ kind: "alt", action, targets: action.targets });
      setNotice(`Pick what ${action.label} acts on.`);
      return;
    }
    const { run: next, step } = alt(run, selected.id, action.id, target);
    if (next === run || !step) { setNotice("That would leave your king in check."); return; }
    setRun(next); setNotice(""); setPicking(null);
    setFlash(step); perform(step, run.units);
    if (next.phase === "defeat" && king) setFall({ king, by: [step.actor] });
    if (!next.units.some(v => v.id === selected.id)) setSelectedId(null);
  };
  const square = (p: Pos) => {
    if (locked) return;
    if (picking?.kind === "alt" && selected) {
      const chosen = picking.targets.find(t => same(t, p));
      setPicking(null);
      if (chosen) { takeAlt(picking.action, chosen); return; }
      // Any other tap cancels; only one of your own pieces carries on as a fresh tap.
      if (at(run, p)?.side !== "white") { setNotice(""); return; }
    } else if (picking?.kind === "strike" && selected) {
      const pick = picking.options.find(t => same(t, p));
      setPicking(null);
      if (pick) { strikeFrom(pick, selected, picking.target); return; }
      // Any other tap cancels; only another piece (yours or an enemy) carries on as a fresh tap.
      if (!at(run, p) || same(picking.target, p)) { setNotice(""); return; }
    }
    const u = at(run, p);
    if (u?.side === "white") { setSelectedId(u.id); setNotice(""); return; }
    if (!selected) return;
    if (u) {
      // Tap an enemy to strike it: in place if it's next to you, otherwise walk up first.
      if (strikeNow(run, selected, u)) return;
      if (attackTargets(run, selected).some(t => t.id === u.id) && strikeExposesKing(run, selected.id, u.id)) { setNotice("Not that one: the counter would leave your king in check."); return; }
      const ways = approaches(run, selected.id, u.id);
      if (!ways.length) { setNotice("That piece can't reach it safely this turn, or you don't have the energy."); return; }
      if (ways.length === 1) { strikeFrom(ways[0], selected, u); return; }
      setPicking({ kind: "strike", target: u, options: ways });
      setNotice(`Pick a square to strike the ${u.kind} from.`);
      return;
    }
    const next = move(run, selected.id, p);
    if (next === run) { setNotice(exposesKing(run, selected.id, p) ? "You can't move there: it would put your king in check." : "Choose a highlighted square you can pay for."); return; }
    face(selected.id, selected, p); animate(selected.id, "move");
    setRun(next); setNotice("");
  };
  const finishTurn = () => {
    if (locked) return;
    const result = endTurn(run);
    if (result.run === run) { setNotice("Your king is in check. Get him safe before ending the turn."); return; }
    setSelectedId(null); setNotice(""); setPicking(null);
    // Commit the enemy's result at once (autosave included); playback only shows it.
    setRun(result.run);
    // The checkmate finale is for a king who fell; a puzzle lost to its turn limit leaves him standing.
    const fallen = run.units.find(u => u.id === "king");
    if (result.run.phase === "defeat" && fallen && !result.run.units.some(u => u.id === "king")) setFall({ king: fallen, by: [...new Set(result.steps.filter(st => st.target === "king").map(st => st.actor))] });
    if (result.steps.length) setPlayback({ steps: result.steps, before: run, index: 0 });
  };
  /** Drops whatever is on the board (animations, playback, the finale) so a different run can take it. */
  const reset = () => { clearStage(); setFall(null); setBanner(""); if (timer.current) clearTimeout(timer.current); setPlayback(null); setSelectedId(null); setNotice(""); };
  function start() { reset(); setOutroDone(""); setCampaign(null); setRun(newRun()); setIntro(false); setFeedback(""); }
  /** Into the Guild: the campaign waits (and stays saved) while puzzle `i` is played. Called again mid-puzzle, it restarts the same puzzle. */
  const attemptPuzzle = (i: number) => { reset(); if (run.puzzle === undefined) setCampaign(run); setOutroDone(""); setRun(startPuzzle(i)); };
  /** Back to the hideout: the campaign run picks up exactly where it was. */
  const leavePuzzle = () => { const back = campaign ?? newRun(); reset(); setCampaign(null); setOutroDone(outroKey(back)); setRun(back); };
  const step = playback ? playback.steps[playback.index] : null;
  const shown = step ? step.units : run.units;
  const caption = step ? step.text : picking?.kind === "alt" ? `Pick what ${picking.action.label} acts on, or tap elsewhere to cancel.` : picking ? `Pick a square to strike the ${picking.target.kind} from, or tap elsewhere to cancel.` : run.phase === "player" ? (selected ? `${selected.kind}: ${selected.acted ? "done this turn" : selected.moved ? "moved; can still strike or defend" : "ready"}.` : "Select one of your pieces.") : "";
  return <main className="exile-app">
    <header className="exile-header"><div className="exile-brand">CHEZZ<span>A SMALL REBELLION</span></div><div className="header-controls"><button onClick={() => setHelp(true)}>How to play</button>{inPuzzle ? <button disabled={!!playback} onClick={leavePuzzle}>Leave puzzle</button> : <button disabled={!!playback} onClick={() => setIntro(true)}>New run</button>}</div></header>
    <section className="run-heading"><div><p className="kicker">{inPuzzle ? `GRANDMASTER'S GUILD · PUZZLE ${run.puzzle! + 1} / ${PUZZLES.length}` : `ESCAPE FROM EXILE · ${run.encounter + 1} / ${ENCOUNTERS.length}`}</p><h1>{e.title}</h1><p>{inPuzzle ? `${e.goal ?? "Defeat every enemy."}${e.turns ? ` Turn ${run.turn} of ${e.turns}.` : ""}` : e.story}</p></div><div className="run-stats"><span>♛ <b>{shown.find(u => u.id === "king")?.hp ?? 0} / {king ? maxHp(king) : 5}</b><small>KING HEALTH</small></span><span>⚡ <b>{playback ? 0 : run.energy} / {ENERGY}</b><small>ENERGY</small></span>{inPuzzle ? e.turns && <span>⏳ <b>{run.turn} / {e.turns}</b><small>TURN</small></span> : <span>✦ <b>{run.gold}</b><small>GOLD</small></span>}</div></section>
    <div className="exile-layout">
      <section className="exile-arena"><div className="arena-topline"><span>{playback ? "ENEMY TURN" : `TURN ${run.turn} · YOUR MOVE`}{!playback && (run.quiet ?? 0) > 0 && <b className={`quiet-clock ${(run.quiet ?? 0) >= TIRE_AFTER ? "tiring" : ""}`} title={`No piece has lost HP for ${run.quiet} turn(s). After ${TIRE_AFTER} every piece but the kings tires (1 HP a turn); after ${RETREAT_AFTER} both sides fall back.`}> · QUIET {run.quiet}/{RETREAT_AFTER}{(run.quiet ?? 0) >= TIRE_AFTER ? " · TIRING" : ""}</b>}</span><span>{shown.filter(u => u.side === "black").length} ENEMIES · {inPuzzle ? (e.goal ?? "Defeat every enemy.").toUpperCase() : "DEFEAT THE PATROL"}</span></div>
        <Board run={playback ? playback.before : run} units={shown} selected={selected} flash={step ?? flash} onSquare={square} locked={locked} stage={stage} spd={spd} picking={playback ? null : picking} checkers={playback || !check ? [] : check.attackers} />
        <p className="sr-only" aria-live="polite">{banner === "checkmate" ? "Checkmate. The crown falls." : banner === "defeat" ? "The crown falls." : banner === "victory" ? "Victory!" : banner === "cleared" ? "Road cleared!" : banner === "solved" ? "Solved!" : banner === "timeout" ? "Out of moves." : ""}</p>
        {banner && <BattleBanner kind={banner} line={banner === "checkmate" ? MATE_LINES[run.turn % MATE_LINES.length] : undefined} onClick={skipOutro} />}
        <div className={`playback-caption ${playback ? "playing" : ""}`} aria-live="polite">{caption}</div><div className="playback-controls"><label><input type="checkbox" checked={fast} onChange={ev => setFast(ev.target.checked)} /> Fast enemy turns</label>{playback && <button onClick={() => { if (timer.current) clearTimeout(timer.current); setPlayback(null); }}>Skip enemy turn</button>}</div>
      </section>
      <aside className="exile-sidebar">
        <section className="plan-panel action-bar"><p className="kicker">⚡ {playback ? 0 : run.energy} OF {ENERGY} ENERGY LEFT</p><h2>{playback ? "The patrol answers." : "Your move, Your Majesty."}</h2>
          <div className="energy-pips" aria-hidden="true">{Array.from({ length: ENERGY }, (_, i) => <i key={i} className={i < (playback ? 0 : run.energy) ? "full" : ""} />)}</div>
          {selected && !locked ? <div className="selected-card"><PieceSprite kind={selected.kind} variant={variantOf(selected)} side="white" /><div><strong>{abilityOf(selected)?.name ?? selected.kind} · {selected.hp} HP · hits for {DAMAGE[selected.kind]}</strong><p>{abilityOf(selected) ? `${abilityOf(selected)!.ability}: ${abilityOf(selected)!.sentence} ` : ""}{HINT[selected.kind]} Green dots: move cost.{unsafeShown ? " Red ✕: you can't stop there, it would put your king in check." : ""} Glowing enemies with a ⚔ badge can be struck: tap one (your piece walks up first if it needs to).</p></div></div> : <p>Select a piece. Each piece may move once, then strike or defend.</p>}
          {selected && !locked && <div className="piece-actions">
            <button className="secondary-button" disabled={selected.acted || run.energy < 1} onClick={() => { setPicking(null); setNotice(""); setRun(defend(run, selected.id)); animate(selected.id, "defend"); }}>Defend · 1 energy<span>blocks 1, counters</span></button>
            {altActions(run, selected, run.energy).map(a => <button key={a.id} className={`secondary-button alt-button ${picking?.kind === "alt" && picking.action.id === a.id ? "picking" : ""}`} onClick={() => { setNotice(""); takeAlt(a); }}>{a.label} · {a.cost} energy<span>{a.targets.length ? `pick a target (${a.targets.length})` : "no target needed"}</span></button>)}
          </div>}
          {check && !playback && <p role="alert" className={`check-alert ${check.escape ? "" : "no-way-out"}`}><strong>{check.escape ? "Check!" : "Check. No way out."}</strong> {check.escape ? "The enemy could kill your king next turn. Move him, block, defend, or take out the piece marked !" : "Nothing this turn makes him safe. End the turn and hope he holds."}</p>}
          <button className="primary-button" disabled={locked || (checkLocked && !playback)} onClick={finishTurn}>{playback ? "Enemy turn…" : checkLocked ? "King in check" : "End turn"}<span>→</span></button>
          <p className="small-print">Energy refills every turn. Strikes reach only the next square in a piece's shape and cost 2. Defending pieces take 1 less damage and hit back if they can reach.</p>
          {notice && <p role="status" className="notice">{notice}</p>}
        </section>
        <section className="resolution-panel"><details><summary>Battle log</summary>{run.log.map((text, i) => <p key={i}>{text}</p>)}</details><button className="text-button" onClick={() => exportRun(run, feedback)}>Export playtest ↗</button></section>
      </aside>
    </div>
    <footer className="exile-footer">Three battles. A little army. One crown to get back.<span>Prototype · turn-based · <a href="./art.html">Art studio</a></span></footer>
    {intro && <div className="exile-modal-shade"><section className="exile-modal intro-exile" role="dialog" aria-modal="true" aria-label="Start exile run"><div className="intro-king"><PieceSprite kind="king" variant="rebel" side="white" /></div><p className="kicker">BANISHED. BROKE. STILL WEARING THE CROWN.</p><h1>A king without a kingdom.</h1><p>Clear the road, recruit your first followers, and cross the bridge. You get {ENERGY} energy a turn to move and strike. Fallen allies stay gone. If your king falls, the run is over.</p><button className="primary-button" onClick={start}>Begin the rebellion<span>→</span></button>{saved() && <button className="text-button" onClick={() => setIntro(false)}>Keep playing current run</button>}</section></div>}
    {!intro && !playback && run.promoting && <div className="exile-modal-shade"><section className="exile-modal camp-modal" role="dialog" aria-modal="true" aria-label="Promote your pawn"><p className="kicker">YOUR PAWN MADE IT</p><h1>Promotion!</h1><p>It reached the far row. Pick what it becomes, at full health. It can still strike or defend this turn.</p><div className="camp-offers">{(["queen", "rook", "bishop", "knight"] as const).filter(kind => { const c = crownOf(run.units.find(u => u.id === run.promoting)!); return !c || c === kind; }).map(kind => <button key={kind} onClick={() => choosePromotion(kind)}><div className="offer-art"><PieceSprite kind={kind} variant={variantOf(run.units.find(u => u.id === run.promoting) ?? { side: "white" })} side="white" /></div><h2>{kind[0].toUpperCase() + kind.slice(1)}</h2><p>{maxHp({ side: "white", variant: variantOf(run.units.find(u => u.id === run.promoting) ?? { side: "white" }), kind })} HP, hits for {DAMAGE[kind]}.</p></button>)}</div></section></div>}
    {!intro && !playback && !outro && run.phase === "camp" && <Hub run={run} reward={e.reward} spd={spd} onBuy={choice => setRun(r => buy(r, choice))} onLeave={() => { clearStage(); setRun(r => leaveCamp(r)); setSelectedId(null); }} onPuzzle={attemptPuzzle} />}
    {!intro && !playback && !outro && inPuzzle && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal puzzle-end" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Puzzle solved" : "Puzzle failed"}><p className="kicker">GRANDMASTER'S GUILD · {e.title.toUpperCase()}</p><h1>{run.phase === "victory" ? "Solved!" : "Not this time."}</h1><p>{run.phase === "victory" ? `The Grandmaster nods${e.turns ? `: ${run.turn} of ${e.turns} turn${e.turns === 1 ? "" : "s"} used` : ""}. Your campaign waits at the hideout, exactly as you left it.` : run.log[0]}</p><div className="puzzle-end-actions"><button className="secondary-button" onClick={() => attemptPuzzle(run.puzzle!)}>Try again</button><button className="primary-button" onClick={leavePuzzle}>Back to the hideout<span>→</span></button></div></section></div>}
    {!intro && !playback && !outro && !inPuzzle && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Exile run complete" : "Rebellion ended"}><p className="kicker">{run.phase === "victory" ? "THREE PATROLS DOWN" : run.flags?.retreated ? "THE PATROL HOLDS THE BRIDGE" : "THE CROWN HAS FALLEN"}</p><h1>{run.phase === "victory" ? "A very small rebellion." : "Long live… somebody else."}</h1><p>{run.phase === "victory" ? `You crossed the bridge with ${run.units.filter(u => u.side === "white").length} surviving pieces and ${king?.hp ?? 0} king HP. This is the end of the prototype.` : run.flags?.retreated ? "Eight quiet turns, and both sides fell back. The bridge stays shut. Your next attempt starts with a fresh crown." : "Your king fell. Your next attempt starts with a fresh crown and questionable confidence."}</p><label className="feedback-label">What felt clever? What was confusing?<textarea value={feedback} onChange={ev => setFeedback(ev.target.value)} placeholder="Leave a note for the next design pass…" /></label><button className="secondary-button" onClick={() => exportRun(run, feedback)}>Export feedback and action history</button><button className="primary-button" onClick={start}>Play again<span>→</span></button></section></div>}
    {help && <div className="exile-modal-shade"><section className="exile-modal help-exile" role="dialog" aria-modal="true" aria-label="How to play"><p className="kicker">A FEW ROYAL DECREES</p><h1>Move. Strike. Survive.</h1><ol><li>You act, then the enemy acts. You get {ENERGY} energy each turn; the enemy has its own pool.</li><li>Select a piece. It may move once in its chess shape: 1 energy per square, or 2 for a knight's jump. Pieces and walls block slides.</li><li>Then it may strike or defend. Tap an enemy to strike it: if your piece isn't next to it yet, it walks up first (paying for both), and if there's more than one square to strike from, you pick one. A strike reaches only the next square in the piece's shape (a knight's jump for knights), so a rook across the board must travel first. It costs 2 and deals fixed damage: pawn 1, knight and bishop 2, king 2, rook and queen 3. The striker stays where it is, even on a kill.</li><li>You can't put your own king in check: you can't stop on a square marked with a red ✕, and strikes that would (through the counter) lose their ⚔ badge. A walk-up strike may pass through danger if the blow leaves him safe.</li><li>Check: if the enemy's next turn could kill your king, he's in check (the attackers are marked !). You can't end your turn until he's safe: move him, block, defend or take out the attacker. If nothing works, you may end the turn, and the king only falls if the blow lands.</li><li>Defend costs 1. Until your next turn, that piece takes 1 less damage per hit and hits back any attacker it can reach. Defending pieces (yours or the enemy's) wear a blue shield chip and stand on a blue-ringed tile.</li><li>A pawn that reaches the far row promotes: yours becomes the piece you pick, an enemy pawn becomes a queen. Both arrive at full health.</li><li>Defeat all enemies to reach the rebel hideout. Walk the king to the barracks to recruit or heal, then take the road out. Surviving HP carries over, fallen allies stay gone, and king death ends the run.</li><li>Strange ground: pits swallow whatever is shoved in, bridge tiles crumble behind you, burrows connect (go in one, come out the other), ice slides you on for free, and a piece ending its move on a lever works that lever's gates.</li><li>Some pieces have an ability button instead of striking; the card tells you what it does. The Grandmaster's Guild at the hideout sets puzzles on boards the road never shows.</li></ol><button className="primary-button" onClick={() => setHelp(false)}>Back to the road<span>→</span></button></section></div>}
  </main>;
}
