import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PieceRig, RIG_MS as DURATION } from "./components/PieceRig";
import { SKINS } from "./components/skins";
import { creditWin, loadMeta, saveMeta } from "./game/meta";
import { testArmyOf, typicalStart } from "./game/levels";
import { BattleBanner, GuardBadge } from "./components/BoardArt";
import type { RigAction } from "./components/PieceRig";
import { Hub } from "./components/Hub";
import { DAMAGE, approaches, promote, ENCOUNTERS, HP, at, attack, attackTargets, buy, canEscape, coord, defend, endTurn, exposesKing, inCheck, kindName, kingThreat, leaveCamp, levelOf, move, moveTargets, newRun, passable, reaches, readRun, same, startAt, strikeExposesKing, testRun, unsafeStrikes, walkAndStrike } from "./game/turns";
import { TopBar } from "./components/TopBar";
import { PauseMenu } from "./components/PauseMenu";
import { EndTurnButton } from "./components/table/EndTurn";
import { ShieldToken } from "./components/table/ShieldToken";
import { SkipToken } from "./components/table/SkipToken";
import { StrikeIcon } from "./components/StrikeIcon";
import type { Encounter, Kind, Pos, PromoteTo, Run, Step, Unit } from "./game/turns";

const SAVE = "chezz.turns.v1";
function saved() { try { return readRun(localStorage.getItem(SAVE)); } catch { return null; } }
/** A fresh run at battle `index` with the level's test army and the typical run's leftover gold. */
function jumpRun(index: number) {
  return startAt(index, testArmyOf(ENCOUNTERS, index), typicalStart(ENCOUNTERS, index).gold);
}
/** Choosing which square to walk to before striking a target (when there's more than one). */
type Picking = { target: Unit; options: Pos[] };
/** A studio test run: one level with a set army, shown as battle `index + 1` of `battles`. It never touches the run or meta saves. */
export type TestLevel = { level: Encounter; army: Kind[]; index: number; battles: number };
type Playback = { steps: Step[]; before: Run; index: number };
/** Presentation-only animation state: what each piece is doing, which way it faces, and fallen pieces still playing their death. */
type Anim = { action: RigAction; key: number };
/** lunge: where a leaping knight is drawn mid-strike ("home" while it flips back). doomed: fallen pieces still waiting for the blow to land. */
type Stage = { anims: Record<string, Anim>; facing: Record<string, 1 | -1>; ghosts: Unit[]; morph: Record<string, Kind>; lunge: Record<string, Pos | "home">; doomed: string[]; holdFlash: boolean; mating: boolean };
const EMPTY_STAGE: Stage = { anims: {}, facing: {}, ghosts: [], morph: {}, lunge: {}, doomed: [], holdFlash: false, mating: false };
/** Identifies one end-of-battle moment, so its celebration plays once. */
const outroKey = (g: Run) => g.phase === "player" ? "" : `${g.encounter}-${g.phase}-${g.turn}-${g.units.length}`;

function Board({ run, units, selected, flash: rawFlash, onSquare, locked, stage, spd, picking, checkers, pips, skinOf }: { run: Run; units: Unit[]; selected: Unit | undefined; flash: Step | null; onSquare: (p: Pos) => void; locked: boolean; stage: Stage; spd: number; picking: Picking | null; checkers: string[]; pips: boolean; skinOf: (kind: Kind) => string | undefined }) {
  const e = levelOf(run);
  // While a knight is still flipping over, its blow hasn't landed: hold back damage pops and impact squares.
  const flash = stage.holdFlash ? null : rawFlash;
  // Moves that would put your own king in check are shown, but blocked with a red ✕.
  const moves = selected && !locked ? moveTargets(run, selected).map(t => ({ ...t, unsafe: exposesKing(run, selected.id, t) })) : [];
  // Strikes in place, plus enemies the piece can walk up to and strike this turn.
  const strikes = selected && !locked ? [...attackTargets(run, selected).filter(t => !strikeExposesKing(run, selected.id, t.id!)), ...run.units.filter(v => v.side === "black" && approaches(run, selected.id, v.id).length).map(v => ({ x: v.x, y: v.y, id: v.id }))] : [];
  // Enemies it could hit only by leaving the king in check get a ✕ chip instead of a sword badge.
  const unsafe = selected && !locked ? unsafeStrikes(run, selected.id) : [];
  const reach = (p: Pos) => !!selected && !locked && !picking && !selected.acted && passable(run, p) && reaches(run, selected, selected, p);
  // Checkmate: zoom in on the fallen king and dim everything else.
  const fallen = stage.mating ? stage.ghosts.find(g => g.id === "king") : undefined;
  const focus: Record<string, string> = fallen ? { "--zx": `${(fallen.x + .5) / e.width * 100}%`, "--zy": `${(fallen.y + .5) / e.height * 100}%` } : {};
  return <div className={`board-camera ${fallen ? "mate-zoom" : ""}`} style={{ "--cols": e.width, "--rows": e.height, ...focus } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${e.width}/${e.height}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${e.width}, 1fr)` }}>
        {Array.from({ length: e.width * e.height }, (_, i) => {
          const p = { x: i % e.width, y: Math.floor(i / e.width) }, piece = units.find(u => same(u, p));
          // While picking where to strike from, only those squares (and the target) are marked.
          const pick = picking?.options.find(t => same(t, p)), aimed = picking && same(picking.target, p);
          const m = picking ? undefined : moves.find(t => same(t, p)), s = picking ? undefined : strikes.find(t => same(t, p));
          const focus = flash?.focus.some(q => same(p, q));
          return <button key={i} disabled={locked || !passable(run, p)}
            className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${!passable(run, p) ? "wall" : ""} ${focus ? "impact-square" : ""} ${aimed ? "aimed" : ""} ${reach(p) ? "in-reach" : ""} ${piece?.defending ? `guarded-tile ${piece.side}` : ""} ${s ? "strikeable" : ""}`}
            aria-label={`${coord(run, p)} ${piece ? `${piece.side} ${piece.kind}, ${piece.hp} HP${piece.defending ? ", defending" : ""}` : passable(run, p) ? "empty" : "obstacle"}${m ? m.unsafe ? ", blocked: would put your king in check" : ", move here" : ""}${s ? `, strike${attackTargets(run, selected!).some(t => same(t, p)) ? "" : " (walks up first)"}` : ""}${piece && unsafe.includes(piece.id) ? ", strike blocked: would put your king in check" : ""}${pick ? `, walk here and strike the ${picking!.target.kind}` : ""}${aimed ? ", target" : ""}`}
            onClick={() => onSquare(p)}><span className="tile-coord">{coord(run, p)}</span>
            {m && !m.unsafe && <span className="target-dot" />}
            {m?.unsafe && <span className="target-dot unsafe-dot" title="Exposes king"><b className="cost-label">✕</b></span>}
            {pick && <span className="target-dot approach-dot"><b className="cost-label"><StrikeIcon /></b></span>}</button>;
        })}
      </div>
      <div className="piece-layer" aria-hidden="true" style={{ "--spd": spd } as CSSProperties}>{[...units, ...stage.ghosts.filter(gh => !units.some(u => u.id === gh.id))].map(piece => {
        const damage = flash?.damage.find(d => d.id === piece.id);
        const spent = piece.side === "white" && piece.acted;
        const ghost = !units.includes(piece), doomed = ghost && stage.doomed.includes(piece.id);
        const anim = ghost && piece.id === "king" && stage.mating ? { action: "mate" as const, key: -3 } : doomed ? stage.anims[piece.id] ?? { action: "idle" as const, key: -2 } : ghost ? { action: "death" as const, key: -1 } : stage.anims[piece.id] ?? { action: "idle" as const, key: 0 };
        const lunge = stage.lunge[piece.id], spot = lunge && lunge !== "home" ? lunge : piece;
        // Enemies you can strike right now glow and carry a sword badge, drawn over the art.
        const strike = !ghost && !picking ? strikes.find(t => t.id === piece.id) : undefined;
        return <div key={piece.id} className={`exile-piece ${piece.side} ${strike ? "targetable" : ""} ${selected?.id === piece.id ? "selected" : ""} ${piece.defending ? "guarded" : ""} ${spent ? "spent" : ""} ${ghost ? "ghost" : ""} ${lunge ? "lunging" : ""}`}
          style={{ left: `${(spot.x + .5) / e.width * 100}%`, top: `${(spot.y + .5) / e.height * 100}%`, width: `${92 / e.width}%`, zIndex: Math.round(spot.y * 10 + (lunge ? 35 : ghost ? 29 : 30)) }}>
          <PieceRig key={`${piece.id}-${anim.key}`} kind={stage.morph[piece.id] ?? piece.kind} side={piece.side} action={anim.action} defending={!!piece.defending} facing={stage.facing[piece.id] ?? (piece.side === "white" ? 1 : -1)} seed={piece.id} wounded={piece.hp < HP[piece.kind] && piece.hp <= HP[piece.kind] / 2} skin={skinOf(stage.morph[piece.id] ?? piece.kind)} />
          {strike && <span className="strike-badge"><StrikeIcon /></span>}
          {!ghost && !picking && unsafe.includes(piece.id) && <span className="strike-badge unsafe" title="Exposes king">✕</span>}
          {!ghost && checkers.includes(piece.id) && <span className="check-mark" title="Threatens king">!</span>}
          {!ghost && checkers.length > 0 && piece.id === "king" && <span className="check-tag">CHECK</span>}
          {!ghost && piece.defending && <GuardBadge />}
          {!ghost && !stage.morph[piece.id] && <span className="piece-health">{piece.hp}<small> / {HP[piece.kind]}</small></span>}
          {!ghost && pips && piece.side === "white" && <span className="action-pips" aria-hidden="true"><i className={piece.moved || piece.acted ? "" : "full"} /><i className={piece.acted ? "" : "full"} /></span>}
          {damage && damage.amount > 0 && <span className="damage-pop" key={`${flash?.text}-${piece.id}`}>−{damage.amount}</span>}

        </div>;
      })}</div>
    </div>
  </div>;
}

export default function App({ test }: { test?: TestLevel } = {}) {
  const fresh = () => test ? testRun(test.level, test.army, test.index) : newRun();
  const [run, setRun] = useState<Run>(() => (test ? null : saved()) ?? fresh());
  const [intro, setIntro] = useState(() => !test && !saved());
  // End-of-battle sequence: let the last blow land, celebrate (or mourn), then show the menu.
  const [outroDone, setOutroDone] = useState(() => outroKey(run));
  const [banner, setBanner] = useState<"" | "cleared" | "victory" | "defeat" | "checkmate">("");
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
    const leaps = actor.kind === "knight" && !!target;
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
    if (target && !step.killed.includes(target.id)) animate(target.id, "hit", impact + 230);
    // A surviving knight takes its counter after landing home, so the backflip isn't cut short.
    if (step.damage.some(d => d.id === actor.id) && !actorDies) animate(actor.id, "hit", leaps ? home + DURATION["leap-back"] : 520);
  };
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  // Shown briefly when the enemy's turn had no actions, so ending the turn visibly did something.
  const [waits, setWaits] = useState(0);
  const [meta, setMeta] = useState(() => loadMeta(() => localStorage, SKINS));
  // A won run unlocks the next skin; creditWin ignores a victory it has already counted (a reload, say).
  useEffect(() => { if (run.phase === "victory" && !test) setMeta(m => creditWin(m, run, SKINS).meta); }, [run]);
  useEffect(() => { if (!test && !saveMeta(() => localStorage, meta)) setNotice("Autosave off"); }, [meta]);
  // Skins can't be picked in the game for now (they'll come from the map), but one worn in an older save still draws.
  const skinOf = (kind: Kind) => meta.equipped[kind];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = levelOf(run), king = run.units.find(u => u.id === "king");
  const battles = test ? test.battles : ENCOUNTERS.length;
  const selected = run.units.find(u => u.id === selectedId && u.side === "white");
  const locked = !!playback || intro || run.phase !== "player" || !!run.promoting || striding;
  // Check: the enemy's next turn could kill the king. You can't end the turn until he's safe, unless nothing can make him safe.
  const check = useMemo(() => {
    if (run.phase !== "player" || run.promoting || striding || !inCheck(run)) return null;
    return { attackers: kingThreat(run).attackers, escape: canEscape(run) };
  }, [run, striding]);
  const checkLocked = !!check?.escape;
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
      setBanner(run.phase === "defeat" ? "defeat" : run.phase === "victory" ? "victory" : "cleared");
      if (run.phase !== "defeat") run.units.filter(u => u.side === "white").forEach((u, i) => animate(u.id, "cheer", i * 120));
    }, (DURATION.leap + DURATION.death + 250) * spd);
    const done = setTimeout(() => { setBanner(""); setOutroDone(key); }, (DURATION.leap + DURATION.death + 250) * spd + 1900 * scale);
    return () => { clearTimeout(celebrate); clearTimeout(done); };
  }, [outro, playback, intro, key]);
  const skipOutro = () => { setBanner(""); setOutroDone(key); };
  useEffect(() => { if (!waits) return; const id = setTimeout(() => setWaits(0), reduced ? 1200 : fast ? 700 : 1400); return () => clearTimeout(id); }, [waits]);
  useEffect(() => { if (!intro && !test) try { localStorage.setItem(SAVE, JSON.stringify(run)); } catch { setNotice("Autosave off"); } }, [run, intro]);
  useEffect(() => {
    // The pause menu pauses the enemy's playback.
    if (!playback || menu) return;
    timer.current = setTimeout(() => {
      if (playback.index + 1 < playback.steps.length) setPlayback({ ...playback, index: playback.index + 1 });
      else setPlayback(null);
    }, reduced ? 90 : fast ? 250 : 800);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playback, fast, reduced, menu]);
  // The menu belongs to the table: not over the intro, a promotion pick, the hub or the end screens.
  const canMenu = !intro && run.phase === "player" && !run.promoting;
  useEffect(() => { if (!canMenu) setMenu(false); }, [canMenu]);
  // Escape backs out one step: the strike-from pick, then the selection, then opens the pause menu.
  // The menu closes itself on Escape and marks the event handled.
  useEffect(() => {
    if (menu || !canMenu) return;
    const back = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (picking) setPicking(null);
      else if (selectedId) setSelectedId(null);
      else setMenu(true);
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [menu, canMenu, picking, selectedId]);
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
    if (!plan) return;
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
  const square = (p: Pos) => {
    if (locked) return;
    if (picking && selected) {
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
      const ways = approaches(run, selected.id, u.id);
      if (!ways.length) return;
      if (ways.length === 1) { strikeFrom(ways[0], selected, u); return; }
      setPicking({ target: u, options: ways });
      return;
    }
    const next = move(run, selected.id, p);
    if (next === run) return;
    face(selected.id, selected, p); animate(selected.id, "move");
    setRun(next); setNotice("");
  };
  const finishTurn = () => {
    if (locked) return;
    const result = endTurn(run);
    if (result.run === run) return;
    setSelectedId(null); setNotice(""); setPicking(null);
    // Commit the enemy's result at once (autosave included); playback only shows it.
    setRun(result.run);
    const fallen = run.units.find(u => u.id === "king");
    if (result.run.phase === "defeat" && fallen) setFall({ king: fallen, by: [...new Set(result.steps.filter(st => st.target === "king").map(st => st.actor))] });
    if (result.steps.length) setPlayback({ steps: result.steps, before: run, index: 0 });
    else if (result.run.phase === "player") setWaits(w => w + 1);
  };
  function start(next: Run = fresh()) { clearStage(); setFall(null); setBanner(""); setOutroDone(""); if (timer.current) clearTimeout(timer.current); setPlayback(null); setWaits(0); setRun(next); setSelectedId(null); setIntro(false); setNotice(""); }
  const step = playback ? playback.steps[playback.index] : null;
  const shown = step ? step.units : run.units;
  const caption = step ? step.text : picking ? "Strike from?" : "";
  const defendNow = () => { if (!selected) return; setPicking(null); setNotice(""); setRun(defend(run, selected.id)); animate(selected.id, "defend"); };
  const skip = () => { if (timer.current) clearTimeout(timer.current); setPlayback(null); };
  return <main className="exile-app">
    <TopBar kingHp={shown.find(u => u.id === "king")?.hp ?? 0} kingMax={HP.king} battle={run.encounter + 1} battles={battles} gold={run.gold} menuOpen={menu} menuDisabled={!canMenu} onMenu={() => setMenu(true)} />
    <section className="exile-field">
      <Board run={playback ? playback.before : run} units={shown} selected={selected} flash={step ?? flash} onSquare={square} locked={locked} stage={stage} spd={spd} picking={playback ? null : picking} checkers={playback || !check ? [] : check.attackers} pips={!playback && run.phase === "player"} skinOf={skinOf} />
      {playback && <span className="turn-ribbon">ENEMY TURN</span>}
      {waits > 0 && !playback && <span key={waits} role="status" className="turn-ribbon enemy-waits">ENEMY WAITS</span>}
      {check && !playback && <p role="alert" className={`check-alert ${check.escape ? "" : "no-way-out"}`}><strong>{check.escape ? "Check" : "No way out"}</strong></p>}
      <div className={`playback-caption ${playback ? "playing" : ""}`} aria-live="polite">{caption}</div>
      {notice && <p role="status" className="notice">{notice}</p>}
      <p className="sr-only" aria-live="polite">{banner === "checkmate" ? "Checkmate" : banner === "defeat" ? "Defeat" : banner === "victory" ? "Victory" : banner === "cleared" ? "Battle won" : ""}</p>
      {banner && <BattleBanner kind={banner} line={banner === "cleared" ? `+${e.reward} ✦` : undefined} onClick={skipOutro} />}
    </section>
    <section className="table-hud" aria-label="Actions">
      <div className="hud-info">
        {selected && !locked && <div className="selected-card"><PieceRig kind={selected.kind} side="white" skin={skinOf(selected.kind)} /><div><strong>{kindName(selected.kind)}</strong><span className="unit-stats">♥{selected.hp} <StrikeIcon />{DAMAGE[selected.kind]}</span><span className="action-pips" role="img" aria-label={selected.acted ? "done" : selected.moved ? "moved" : "ready"}><i className={selected.moved || selected.acted ? "" : "full"} /><i className={selected.acted ? "" : "full"} /></span></div></div>}
      </div>
      {playback
        ? <SkipToken onClick={skip} />
        : <ShieldToken disabled={!selected || locked || selected.acted} onClick={defendNow} />}
      <EndTurnButton state={playback ? "waiting" : checkLocked ? "locked" : "ready"} disabled={locked || checkLocked} onClick={finishTurn} />
    </section>
    {intro && <div className="exile-modal-shade"><section className="exile-modal intro-exile" role="dialog" aria-modal="true" aria-label="New run"><div className="intro-king"><PieceRig kind="king" side="white" /></div><h1>Escape from Exile</h1><button className="primary-button" autoFocus onClick={() => start()}>Start<span>→</span></button>{!test && saved() && <button className="text-button" onClick={() => setIntro(false)}>Continue</button>}</section></div>}
    {!intro && !playback && run.promoting && <div className="exile-modal-shade"><section className="exile-modal camp-modal" role="dialog" aria-modal="true" aria-label="Promote your pawn"><h1>Promote</h1><div className="camp-offers">{(["queen", "rook", "bishop", "knight"] as const).map(kind => <button key={kind} onClick={() => choosePromotion(kind)}><div className="offer-art"><PieceRig kind={kind} side="white" /></div><h2>{kindName(kind)}</h2><p>♥{HP[kind]} ⚔{DAMAGE[kind]}</p></button>)}</div></section></div>}
    {!intro && !playback && !outro && run.phase === "camp" && <Hub run={run} reward={e.reward} spd={spd} onBuy={choice => setRun(r => buy(r, choice))} onLeave={() => { clearStage(); setRun(r => leaveCamp(r)); setSelectedId(null); }} />}
    {!intro && !playback && !outro && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Victory" : "Defeat"}><h1>{run.phase === "victory" ? "Victory" : "Defeat"}</h1><p>{run.phase === "victory" ? `${run.units.filter(u => u.side === "white").length} pieces · ♥${king?.hp ?? 0}/${HP.king}` : `Battle ${run.encounter + 1} of ${battles} · turn ${run.turn}`}</p><button className="primary-button" onClick={() => start()}>Play again<span>→</span></button></section></div>}
    {menu && <PauseMenu log={run.log} fast={fast} onFast={setFast} newRunDisabled={!!playback} onNewRun={() => { setMenu(false); setIntro(true); }} onClose={() => setMenu(false)} battles={battles} onJump={test ? undefined : index => { setMenu(false); start(jumpRun(index)); }} />}
  </main>;
}
