import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PieceRig, RIG_MS as DURATION } from "./components/PieceRig";
import { SKINS } from "./components/skins";
import { creditWin, loadMeta, markTutorial, saveMeta } from "./game/meta";
import { testArmyOf, typicalStart } from "./game/levels";
import { BattleBanner, IntentMarks } from "./components/BoardArt";
import type { RigAction } from "./components/PieceRig";
import { Hub } from "./components/Hub";
import { approaches, armedRows, armedSwitch, begin, courseOf, deploy, ENCOUNTERS, at, attack, attackTargets, buy, canEscape, coord, endTurn, enemyPlan, exposesKing, intentOf, intentWaits, label, inCheck, kindName, kingThreat, leaveCamp, levelOf, levelsOf, move, moveTargets, newRun, passable, reaches, readRun, retry, rulesOf, same, sidelined, startAt, stepOnto, strikeExposesKing, testRun, turnSpent, tutorialCourse, tutorialRun, unsafeStrikes, walkAndStrike } from "./game/turns";
import { TopBar } from "./components/TopBar";
import { PauseMenu } from "./components/PauseMenu";
import { EndTurnButton } from "./components/table/EndTurn";
import { EnemyEmblem, KingHearts, TeamBar } from "./components/table/TeamBar";
import { SkipToken } from "./components/table/SkipToken";
import { PhaseBanner, phaseTiming, type PhaseKind } from "./components/table/PhaseBanner";
import { StrikeIcon } from "./components/StrikeIcon";
import type { Encounter, Intent, Kind, Placed, Pos, Rules, Run, Step, Unit } from "./game/turns";

const SAVE = "chezz.turns.v1";
/** The turn as it stood before a previewed move, saved beside the run so a reload can still cancel it. */
const SAVE_START = "chezz.turns.v1.start";
function saved() { try { return readRun(localStorage.getItem(SAVE)); } catch { return null; } }
function savedStart(g: Run | null) {
  try {
    const s = g && readRun(localStorage.getItem(SAVE_START));
    return s && g.phase === "player" && s.phase === "player" && s.encounter === g.encounter && s.turn === g.turn ? s : null;
  } catch { return null; }
}
/** A fresh run at battle `index`: a tutorial level starts the tutorial there; any other level starts
 * the roguelike there with the level's test army and the typical run's leftover gold. */
function jumpRun(index: number) {
  if (ENCOUNTERS[index].tutorial) return tutorialRun(undefined, index);
  return startAt(index, testArmyOf(ENCOUNTERS, index), typicalStart(ENCOUNTERS, index).gold);
}
const HAS_TUTORIAL = tutorialCourse(ENCOUNTERS).length > 0;
/** Choosing which square to walk to before striking a target (when there's more than one). */
type Picking = { target: Unit; options: Pos[] };
/** A piece being dragged in the deploy phase: where the pointer is, in fractional board squares, and the square under it. */
type Drag = { id: string; at: Pos; over: Pos | null };
type Deploy = { starts: Pos[]; picked: string | null; drag: Drag | null; onDown: (ev: ReactPointerEvent, p: Pos) => void };
/** Pointer travel (px) before a press on a piece becomes a drag rather than a tap. */
const DRAG_SLOP = 6;
/** The board square under a screen point, with the point's offset into it, read from the cells themselves so the board's tilt needs no maths. */
function squareAt(clientX: number, clientY: number): { p: Pos; at: Pos } | null {
  const cell = document.elementsFromPoint(clientX, clientY).find(el => el instanceof HTMLElement && el.dataset.x !== undefined) as HTMLElement | undefined;
  if (!cell) return null;
  const r = cell.getBoundingClientRect(), p = { x: Number(cell.dataset.x), y: Number(cell.dataset.y) };
  return { p, at: { x: p.x + (clientX - r.left) / r.width, y: p.y + (clientY - r.top) / r.height } };
}
/** A studio test run: one level with a set army, shown as battle `index + 1` of `battles`, optionally by the studio's unsaved rules. It never touches the run or meta saves. */
export type TestLevel = { level: Encounter; army: Placed[]; index: number; battles: number; rules?: Rules };
/** `lead`: the enemy-phase banner is still sweeping in, so no step has played yet. */
type Playback = { steps: Step[]; before: Run; index: number; lead?: boolean };
/** Presentation-only animation state: what each piece is doing, which way it faces, and fallen pieces still playing their death. */
type Anim = { action: RigAction; key: number };
/** lunge: where a leaping knight is drawn mid-strike ("home" while it flips back). doomed: fallen pieces still waiting for the blow to land.
 * counter: a struck piece hitting back; the attacker's damage and impact wait until it lands.
 * bolts: ranged strikes in flight, drawn as a streak from striker to target. */
type Stage = { anims: Record<string, Anim>; facing: Record<string, 1 | -1>; ghosts: Unit[]; lunge: Record<string, Pos | "home">; doomed: string[]; holdFlash: boolean; mating: boolean; counter: { victim: string; at: Pos; landed: boolean } | null; bolts: Bolt[] };
type Bolt = { key: number; from: Pos; to: Pos; ms: number; spear?: boolean };
const EMPTY_STAGE: Stage = { anims: {}, facing: {}, ghosts: [], lunge: {}, doomed: [], holdFlash: false, mating: false, counter: null, bolts: [] };
/** A strike from further than the next square (a knight's jump aside) flies to its target. */
const ranged = (a: Unit, b: Pos) => a.kind !== "knight" && Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) > 1;
/** How far into its attack animation a blow lands (the impact stars peak a little past halfway). */
const BLOW_MS = 300;
/** How long a sprung trap's spears take to cross the board. */
const SPEAR_MS = 420;
/** When a strike's beats happen, in unscaled ms from its start. A target that survives winds up its
 * counter once its own hit has played (after a surviving knight has flipped home). */
function strikeTiming(step: Step, before: Unit[]) {
  const actor = before.find(u => u.id === step.actor);
  const leaps = actor?.kind === "knight" && !!step.target;
  const impact = leaps ? DURATION.leap : 0, home = impact + 380;
  const actorDies = step.killed.includes(step.actor);
  const start = leaps && !actorDies ? home + DURATION["leap-back"] : impact + 230 + DURATION.hit;
  const counter = step.kind === "strike" && step.damage.some(d => d.id === step.actor) ? { start, lands: start + BLOW_MS } : null;
  return { leaps, impact, home, actorDies, counter };
}
/** Identifies one end-of-battle moment, so its celebration plays once. */
const outroKey = (g: Run) => g.phase === "player" || g.phase === "deploy" ? "" : `${g.encounter}-${g.phase}-${g.turn}-${g.units.length}`;

/** HP and damage: the same line on your pieces' cards and the enemy's. */
const UnitStats = ({ u, r }: { u: Unit; r: Rules }) => <span className="unit-stats">♥{u.hp}/{r.hp[u.kind]} <StrikeIcon />{r.damage[u.kind]}</span>;
function intentWords(g: Run, i: Intent) {
  if (intentWaits(i)) return "waits";
  const target = i.strike && g.units.find(u => u.id === i.strike!.target);
  return [i.to && `moves to ${coord(g, i.to)}`, i.strike && `strikes ${target ? label(target).toLowerCase() : "?"} −${i.strike.damage}${i.strike.kills ? ", kills" : ""}`].filter(Boolean).join(", ");
}

function Board({ run, moveRun, home, units, selected, flash: rawFlash, onSquare, onHover, locked, stage, spd, picking, checkers, pips, skinOf, intent, deploy, above, below }: { run: Run; moveRun: Run; home: Pos | null; units: Unit[]; selected: Unit | undefined; flash: Step | null; onSquare: (p: Pos) => void; onHover: (p: Pos | null) => void; locked: boolean; stage: Stage; spd: number; picking: Picking | null; checkers: string[]; pips: boolean; skinOf: (kind: Kind) => string | undefined; intent: Intent | null; deploy: Deploy | null; above?: ReactNode; below?: ReactNode }) {
  const e = levelOf(run), r = rulesOf(run), lanes = armedRows(run);
  // While a knight is still flipping over, its blow hasn't landed: hold back damage pops and impact squares.
  const flash = stage.holdFlash ? null : rawFlash;
  const counter = stage.counter && flash?.damage.some(d => d.id === stage.counter!.victim) ? stage.counter : null;
  // Moves that would put your own king in check are shown, but blocked with a red ✕. A previewed piece
  // offers its moves from where it started the turn (moveRun), so you can try another square.
  const mover = selected && moveRun.units.find(u => u.id === selected.id);
  const moves = mover && !locked ? moveTargets(moveRun, mover).map(t => ({ ...t, unsafe: exposesKing(moveRun, mover.id, t) })) : [];
  // Strikes in place, plus enemies the piece can walk up to and strike this turn.
  const strikes = selected && !locked ? [...attackTargets(run, selected).filter(t => !strikeExposesKing(run, selected.id, t.id!)), ...run.units.filter(v => v.side === "black" && approaches(run, selected.id, v.id).length).map(v => ({ x: v.x, y: v.y, id: v.id }))] : [];
  // Enemies it could hit only by leaving the king in check get a ✕ chip instead of a sword badge.
  const unsafe = selected && !locked ? unsafeStrikes(run, selected.id) : [];
  const trap = (p: Pos) => armedSwitch(run, p) >= 0 ? "armed" : e.switches?.some(s => same(s, p)) ? "sprung" : "";
  const reach = (p: Pos) => !!selected && !locked && !picking && !selected.acted && !sidelined(run, selected) && passable(run, p) && reaches(run, selected, selected, p);
  // Checkmate: zoom in on the fallen king and dim everything else.
  const fallen = stage.mating ? stage.ghosts.find(g => g.id === "king") : undefined;
  const focus: Record<string, string> = fallen ? { "--zx": `${(fallen.x + .5) / e.width * 100}%`, "--zy": `${(fallen.y + .5) / e.height * 100}%` } : {};
  return <div className={`board-camera ${fallen ? "mate-zoom" : ""}`} style={{ "--cols": e.width, "--rows": e.height, ...focus } as CSSProperties}>
    {above}
    <div className="board-plane" style={{ aspectRatio: `${e.width}/${e.height}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${e.width}, 1fr)` }}>
        {Array.from({ length: e.width * e.height }, (_, i) => {
          const p = { x: i % e.width, y: Math.floor(i / e.width) }, piece = units.find(u => same(u, p));
          // While picking where to strike from, only those squares (and the target) are marked.
          const pick = picking?.options.find(t => same(t, p)), aimed = picking && same(picking.target, p);
          const m = picking ? undefined : moves.find(t => same(t, p)), s = picking ? undefined : strikes.find(t => same(t, p));
          const focus = flash?.focus.some(q => same(p, q)) || (counter?.landed && same(counter.at, p));
          const startHere = !!deploy?.starts.some(q => same(q, p)), over = !!deploy?.drag?.over && same(deploy.drag.over, p);
          return <button key={i} disabled={(locked && !deploy) || !passable(run, p)} data-x={p.x} data-y={p.y}
            className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${!passable(run, p) ? "wall" : ""} ${focus ? "impact-square" : ""} ${aimed ? "aimed" : ""} ${reach(p) ? "in-reach" : ""} ${s ? "strikeable" : ""} ${home && !locked && same(home, p) && !piece ? "start-square" : ""} ${startHere ? "deploy-square" : ""} ${over ? "deploy-over" : ""} ${lanes.includes(p.y) ? "spear-lane" : ""}`}
            onPointerEnter={ev => { if (ev.pointerType === "mouse") onHover(p); }} onPointerLeave={ev => { if (ev.pointerType === "mouse") onHover(null); }}
            onPointerDown={deploy ? ev => deploy.onDown(ev, p) : undefined}
            aria-label={`${coord(run, p)} ${piece ? `${piece.side} ${piece.kind}, ${piece.hp} HP` : passable(run, p) ? "empty" : "obstacle"}${startHere ? ", start square" : ""}${trap(p) === "armed" ? ", switch: step here to fire the spears" : trap(p) ? ", switch, used" : ""}${lanes.includes(p.y) ? ", in the spears' path" : ""}${m ? m.unsafe ? ", blocked: would put your king in check" : ", move here" : ""}${s ? `, strike${attackTargets(run, selected!).some(t => same(t, p)) ? "" : " (walks up first)"}` : ""}${piece && unsafe.includes(piece.id) ? ", strike blocked: would put your king in check" : ""}${pick ? `, walk here and strike the ${picking!.target.kind}` : ""}${aimed ? ", target" : ""}`}
            onClick={() => onSquare(p)}><span className="tile-coord">{coord(run, p)}</span>
            {trap(p) && <span className={`floor-switch ${trap(p)}`} title={trap(p) === "armed" ? "Switch: fires the spears" : "Switch (used)"} />}
            {p.x === 0 && lanes.includes(p.y) && <span className="spear-launcher" title="Spears" />}
            {m && !m.unsafe && <span className="target-dot" />}
            {m?.unsafe && <span className="target-dot unsafe-dot" title="Exposes king"><b className="cost-label">✕</b></span>}
            {pick && <span className="target-dot approach-dot"><b className="cost-label"><StrikeIcon /></b></span>}</button>;
        })}
      </div>
      {intent && (!locked || deploy) && <IntentMarks intent={intent} cols={e.width} rows={e.height} leaps={run.units.find(u => u.id === intent.id)?.kind === "knight"} />}
      <div className="piece-layer" aria-hidden="true" style={{ "--spd": spd } as CSSProperties}>{[...units, ...stage.ghosts.filter(gh => !units.some(u => u.id === gh.id))].map(piece => {
        const awaiting = counter?.victim === piece.id && !counter.landed;
        const damage = awaiting ? undefined : flash?.damage.find(d => d.id === piece.id);
        // Until the counter lands, the attacker's chip still reads its HP from before the counter.
        const hp = awaiting ? piece.hp + (flash?.damage.find(d => d.id === piece.id)?.amount ?? 0) : piece.hp;
        // Under one move per turn, the pieces that didn't act are done once another has.
        const benched = piece.side === "white" && sidelined(run, piece);
        const spent = piece.side === "white" && (piece.acted || benched);
        const ghost = !units.includes(piece), doomed = ghost && stage.doomed.includes(piece.id);
        const anim = ghost && piece.id === "king" && stage.mating ? { action: "mate" as const, key: -3 } : doomed ? stage.anims[piece.id] ?? { action: "idle" as const, key: -2 } : ghost ? { action: "death" as const, key: -1 } : stage.anims[piece.id] ?? { action: "idle" as const, key: 0 };
        const dragged = deploy?.drag?.id === piece.id ? deploy.drag : null;
        const lunge = stage.lunge[piece.id], spot = dragged ? { x: dragged.at.x - .5, y: dragged.at.y - .5 } : lunge && lunge !== "home" ? lunge : piece;
        // Enemies you can strike right now glow and carry a sword badge, drawn over the art.
        const strike = !ghost && !picking ? strikes.find(t => t.id === piece.id) : undefined;
        return <div key={piece.id} className={`exile-piece ${piece.side} ${strike ? "targetable" : ""} ${selected?.id === piece.id || deploy?.picked === piece.id ? "selected" : ""} ${dragged ? "dragging" : ""} ${(!locked || deploy) && intent?.id === piece.id ? "inspected" : ""} ${spent ? "spent" : ""} ${ghost ? "ghost" : ""} ${lunge ? "lunging" : ""}`}
          style={{ left: `${(spot.x + .5) / e.width * 100}%`, top: `${(spot.y + .5) / e.height * 100}%`, width: `${92 / e.width}%`, zIndex: dragged ? 200 : Math.round(spot.y * 10 + (lunge ? 35 : ghost ? 29 : 30)) }}>
          <PieceRig key={`${piece.id}-${anim.key}`} kind={piece.kind} side={piece.side} action={anim.action} facing={stage.facing[piece.id] ?? (piece.side === "white" ? 1 : -1)} seed={piece.id} wounded={piece.hp < r.hp[piece.kind] && piece.hp <= r.hp[piece.kind] / 2} skin={skinOf(piece.kind)} />
          {strike && <span className="strike-badge"><StrikeIcon /></span>}
          {!ghost && !picking && unsafe.includes(piece.id) && <span className="strike-badge unsafe" title="Exposes king">✕</span>}
          {!ghost && checkers.includes(piece.id) && <span className="check-mark" title="Threatens king">!</span>}
          {!ghost && checkers.length > 0 && piece.id === "king" && <span className="check-tag">CHECK</span>}
          {!ghost && <span className="piece-health">{hp}<small> / {r.hp[piece.kind]}</small></span>}
          {!ghost && pips && piece.side === "white" && <span className="action-pips" aria-hidden="true"><i className={piece.moved || spent ? "" : "full"} /><i className={spent ? "" : "full"} /></span>}
          {damage && damage.amount > 0 && <span className="damage-pop" key={`${flash?.text}-${piece.id}`}>−{damage.amount}</span>}

        </div>;
      })}
      {stage.bolts.map(b => <span key={b.key} className={b.spear ? "strike-bolt spear-bolt" : "strike-bolt"} style={{ "--fx": `${(b.from.x + .5) / e.width * 100}%`, "--fy": `${(b.from.y + .2) / e.height * 100}%`, "--tx": `${(b.to.x + .5) / e.width * 100}%`, "--ty": `${(b.to.y + .2) / e.height * 100}%`, "--a": `${Math.atan2(b.to.y - b.from.y, b.to.x - b.from.x)}rad`, "--ms": `${b.ms}ms` } as CSSProperties} />)}</div>
    </div>
    {below}
  </div>;
}

/** Between tutorial battles: no hideout, just the next battle and the army it deals. */
function TutorialNext({ run, battle, battles, onGo }: { run: Run; battle: number; battles: number; onGo: () => void }) {
  const next = courseOf(run)[battle], army = next === undefined ? [] : levelsOf(run)[next].tutorial?.army ?? [];
  return <div className="exile-modal-shade"><section className="exile-modal intro-exile tutorial-next" role="dialog" aria-modal="true" aria-label="Battle won">
    <p className="kicker">Tutorial</p>
    <h1>Battle {battle} of {battles} ✓</h1>
    <div className="tutorial-army" role="img" aria-label={`Next army: ${army.map(p => p.kind).join(", ")}`}>{army.map((p, i) => <i key={i}><PieceRig kind={p.kind} side="white" /></i>)}</div>
    <button className="primary-button" autoFocus onClick={onGo}>Battle {battle + 1}<span>→</span></button>
  </section></div>;
}

export default function App({ test }: { test?: TestLevel } = {}) {
  const [meta, setMeta] = useState(() => loadMeta(() => localStorage, SKINS));
  // Until the tutorial is done, a new game is the tutorial.
  const tutorialNext = !test && HAS_TUTORIAL && !meta.tutorialDone;
  const fresh = () => test ? testRun(test.level, test.army, test.index, test.rules) : tutorialNext ? tutorialRun() : newRun();
  const [run, setRun] = useState<Run>(() => (test ? null : saved()) ?? fresh());
  const [intro, setIntro] = useState(() => !test && !saved());
  // End-of-battle sequence: let the last blow land, celebrate (or mourn), then show the menu.
  const [outroDone, setOutroDone] = useState(() => outroKey(run));
  const [banner, setBanner] = useState<"" | "cleared" | "victory" | "defeat" | "checkmate">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Moves are previews until a strike or End turn commits them: this is the run as it stood
  // before the first uncommitted move, which Cancel (or Escape) goes back to.
  const [turnStart, setTurnStart] = useState<Run | null>(() => test ? null : savedStart(saved()));
  // The enemy whose card and plan are shown: tapped (inspectId) or, with a mouse, hovered.
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [phaseBanner, setPhaseBanner] = useState<{ kind: PhaseKind; n: number } | null>(null);
  const [flash, setFlash] = useState<{ step: Step; hold: number } | null>(null);
  const [fast, setFast] = useState(false);
  const [stage, setStage] = useState<Stage>(EMPTY_STAGE);
  const animKey = useRef(1);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Animation time scale, matched to the enemy-phase step interval (800ms, 250ms fast, 90ms reduced).
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
  /** Fires a ranged strike's streak from `from` to `to`, arriving `ms` (unscaled) after `delay`. */
  const shoot = (from: Pos, to: Pos, delay: number, ms: number, spear = false) => {
    const key = animKey.current++;
    timers.current.push(setTimeout(() => setStage(st => ({ ...st, bolts: [...st.bolts, { key, from, to, ms, spear }] })), delay * spd));
    timers.current.push(setTimeout(() => setStage(st => ({ ...st, bolts: st.bolts.filter(b => b.key !== key) })), (delay + ms + 60) * spd));
  };
  const face = (id: string, from: Pos, to: Pos) => { if (to.x !== from.x) setStage(st => ({ ...st, facing: { ...st.facing, [id]: to.x > from.x ? 1 : -1 } })); };
  /** Animates a step from the rules: a move or a strike, with hits, counters and deaths. */
  const perform = (step: Step, beforeUnits: Unit[]) => {
    const actor = beforeUnits.find(u => u.id === step.actor);
    if (!actor) return;
    const target = step.target ? beforeUnits.find(u => u.id === step.target) : undefined;
    setStage(st => st.counter ? { ...st, counter: null } : st);
    if (step.kind === "spring") { springs(step, beforeUnits); return; }
    if (step.kind === "move") { const to = step.units.find(u => u.id === actor.id); if (to) face(actor.id, actor, to); animate(actor.id, "move"); return; }
    if (target) face(actor.id, actor, target);
    // Knights show off: front-flip over to the target, smack it, backflip home. The rules still strike from
    // the knight's own square; this is only how it looks. Everything else waits for the blow to land.
    const { leaps, impact, home, actorDies, counter } = strikeTiming(step, beforeUnits);
    const later = (ms: number, fn: () => void) => timers.current.push(setTimeout(fn, ms * spd));
    const dropLunge = () => setStage(st => { const lunge = { ...st.lunge }; delete lunge[actor.id]; return { ...st, lunge }; });
    if (leaps && target) {
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
    } else {
      animate(actor.id, "attack");
      if (target && ranged(actor, target)) shoot(actor, target, 50, 180);
    }
    const dying = beforeUnits.filter(u => step.killed.includes(u.id));
    if (dying.length) {
      // Each fallen piece waits for the blow that fells it: the target at impact, a countered attacker when the counter lands.
      const fallsAt = (id: string) => (id === actor.id ? counter?.lands ?? impact + 520 : impact + 230);
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
    if (counter && target) {
      // The struck piece hits back: it turns and swings at the attacker, and only then does the attacker
      // take the hit, show its damage and, if it dies, fall.
      setStage(st => ({ ...st, counter: { victim: actor.id, at: { x: actor.x, y: actor.y }, landed: false } }));
      later(counter.start, () => { face(target.id, target, actor); animate(target.id, "attack"); });
      if (ranged(target, actor)) shoot(target, actor, counter.start + 50, BLOW_MS - 50);
      later(counter.lands, () => setStage(st => st.counter?.victim === actor.id ? { ...st, counter: { ...st.counter, landed: true } } : st));
      if (!actorDies) animate(actor.id, "hit", counter.lands);
    }
  };
  /** A sprung trap: a spear flies along each row from the left edge, and each piece it passes takes the hit. */
  const springs = (step: Step, beforeUnits: Unit[]) => {
    const width = levelOf(run).width;
    for (const y of step.rows ?? []) shoot({ x: -1, y }, { x: width, y }, 0, SPEAR_MS, true);
    const hitAt = (u: Unit) => SPEAR_MS * (u.x + 1) / (width + 1);
    const dying = beforeUnits.filter(u => step.killed.includes(u.id));
    setStage(st => ({ ...st, ghosts: [...st.ghosts.filter(g => !step.killed.includes(g.id)), ...dying], doomed: [...st.doomed, ...step.killed] }));
    for (const u of dying) {
      timers.current.push(setTimeout(() => setStage(st => ({ ...st, doomed: st.doomed.filter(d => d !== u.id) })), hitAt(u) * spd));
      timers.current.push(setTimeout(() => setStage(st => ({ ...st, ghosts: st.ghosts.filter(g => g.id !== u.id) })), (hitAt(u) + DURATION.death) * spd));
    }
    for (const u of beforeUnits) if (step.damage.some(d => d.id === u.id) && !step.killed.includes(u.id)) animate(u.id, "hit", hitAt(u));
  };
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState("");
  // Shown briefly when the enemy's turn had no actions, so ending the turn visibly did something.
  const [waits, setWaits] = useState(0);
  // A won run unlocks the next skin (a finished tutorial marks it done); creditWin ignores a victory it has already counted (a reload, say).
  useEffect(() => { if (run.phase === "victory" && !test) setMeta(m => creditWin(m, run, SKINS).meta); }, [run]);
  useEffect(() => { if (!test && !saveMeta(() => localStorage, meta)) setNotice("Autosave off"); }, [meta]);
  // Skins can't be picked in the game for now (they'll come from the map), but one worn in an older save still draws.
  const skinOf = (kind: Kind) => meta.equipped[kind];
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const e = levelOf(run), r = rulesOf(run), king = run.units.find(u => u.id === "king");
  const course = courseOf(run);
  const battle = test ? run.encounter + 1 : course.indexOf(run.encounter) + 1, battles = test ? test.battles : course.length;
  const selected = run.units.find(u => u.id === selectedId && u.side === "white");
  const selectedBenched = !!selected && sidelined(run, selected);
  const locked = !!playback || intro || run.phase !== "player" || striding;
  const preview = run.phase === "player" ? turnStart : null;
  // A previewed piece moves again from where it started the turn, not from its preview square.
  const moveRun = useMemo(() => {
    const was = preview && selected?.moved ? preview.units.find(u => u.id === selected.id) : undefined;
    if (!preview || !was || was.moved) return run;
    if (r.turn === "one") return preview;
    if (run.units.some(u => u.id !== was.id && same(u, was))) return run;
    return { ...run, units: run.units.map(u => (u.id === was.id ? { ...u, x: was.x, y: was.y, moved: false } : u)) };
  }, [run, preview, selected?.id, selected?.moved]);
  const homeOf = (id: string) => { const was = preview?.units.find(u => u.id === id), now = run.units.find(u => u.id === id); return was && now && !same(was, now) ? { x: was.x, y: was.y } : null; };
  const home = selected ? homeOf(selected.id) : null;
  // What the enemy would do if the turn ended now, recomputed from the board as previewed.
  // Before the battle begins you rearrange your pieces; enemies can still be inspected.
  const deploying = run.phase === "deploy" && !intro && !playback;
  const [deployPick, setDeployPick] = useState<string | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // A press that turned into a drag ends in a click on the cell it started on; that click is not a tap.
  const dragged = useRef(false);
  const plan = useMemo(() => (locked && !deploying ? [] : enemyPlan(run)), [run, locked, deploying]);
  const enemy = run.units.find(u => u.side === "black" && u.id === (hoverId ?? inspectId));
  const intent = enemy && (!locked || deploying) ? intentOf(run, plan, enemy.id) : null;
  // Check: the enemy's next turn could kill the king. You can't end the turn until he's safe, unless nothing can make him safe.
  const check = useMemo(() => {
    if (run.phase !== "player" || striding || !inCheck(run)) return null;
    return { attackers: kingThreat(run).attackers, escape: canEscape(run) };
  }, [run, striding]);
  const checkLocked = !!check?.escape;
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
  useEffect(() => {
    if (intro || test) return;
    try {
      localStorage.setItem(SAVE, JSON.stringify(run));
      if (turnStart) localStorage.setItem(SAVE_START, JSON.stringify(turnStart)); else localStorage.removeItem(SAVE_START);
    } catch { setNotice("Autosave off"); }
  }, [run, turnStart, intro]);
  useEffect(() => {
    // The pause menu pauses the enemy's playback.
    if (!playback || menu) return;
    if (playback.lead) {
      timer.current = setTimeout(() => setPlayback({ ...playback, lead: false }), phaseTiming(fast, reduced).lead);
      return () => { if (timer.current) clearTimeout(timer.current); };
    }
    // A strike that draws a counter holds its beat until the counter has landed.
    const prev = playback.index === 0 ? playback.before.units : playback.steps[playback.index - 1].units;
    const counter = strikeTiming(playback.steps[playback.index], prev).counter;
    timer.current = setTimeout(() => {
      if (playback.index + 1 < playback.steps.length) setPlayback({ ...playback, index: playback.index + 1 });
      else endPlayback();
    }, (reduced ? 90 : fast ? 250 : 800) + (counter ? counter.lands * spd : 0));
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [playback, fast, reduced, menu]);
  // The menu belongs to the table: not over the intro, the hub or the end screens.
  const canMenu = !intro && (run.phase === "player" || run.phase === "deploy");
  useEffect(() => { if (!canMenu) setMenu(false); }, [canMenu]);
  // Escape backs out one step: the strike-from pick, the enemy card, the previewed move, the selection,
  // then opens the pause menu. The menu closes itself on Escape and marks the event handled.
  useEffect(() => {
    if (menu || !canMenu) return;
    const back = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      if (picking) setPicking(null);
      else if (inspectId) setInspectId(null);
      else if (preview && !locked) cancelPreview();
      else if (selectedId) setSelectedId(null);
      else if (deployPick) setDeployPick(null);
      else setMenu(true);
    };
    window.addEventListener("keydown", back);
    return () => window.removeEventListener("keydown", back);
  }, [menu, canMenu, picking, selectedId, inspectId, preview, locked, run, deployPick]);
  useEffect(() => {
    if (!playback || playback.lead) return;
    const prev = playback.index === 0 ? playback.before.units : playback.steps[playback.index - 1].units;
    perform(playback.steps[playback.index], prev);
  }, [playback?.steps, playback?.index, playback?.lead]);
  useEffect(() => { if (!flash || stage.holdFlash) return; const id = setTimeout(() => setFlash(null), 700 + flash.hold * spd); return () => clearTimeout(id); }, [flash, stage.holdFlash]);

  const strikeNow = (g: Run, attacker: Unit, target: Unit) => {
    const { run: next, step } = attack(g, attacker.id, target.id);
    if (next === g) return false;
    land(g, next, step, attacker, target);
    return true;
  };
  /** Commits a strike's result and plays it. */
  const land = (g: Run, next: Run, step: Step | null, attacker: Unit, target: Unit) => {
    setRun(next); setNotice(""); setTurnStart(null); setInspectId(null);
    setFlash(step ? { step, hold: strikeTiming(step, g.units).counter?.lands ?? 0 } : null);
    if (step) perform(step, g.units);
    // A king felled by a counter on your own turn still gets his finale.
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
    setRun(walked); setNotice(""); setStriding(true); setTurnStart(null); setInspectId(null);
    timers.current.push(setTimeout(() => {
      setStriding(false);
      const moved = walked.units.find(v => v.id === attacker.id)!;
      face(attacker.id, moved, target);
      // Land exactly the move that was approved, so what's offered is what happens.
      land(walked, plan.run, plan.step, moved, target);
    }, DURATION.move * spd));
  };
  /** Deploy: move a piece onto a start square; a piece already there swaps over to where it came from. */
  const redeploy = (id: string, to: Pos) => {
    const next = deploy(run, id, to);
    setDeployPick(null);
    if (next === run) return;
    for (const u of run.units) {
      const now = next.units.find(v => v.id === u.id);
      if (now && !same(now, u)) face(u.id, u, now);
    }
    setRun(next);
  };
  /** Deploy taps: tap a piece, then a start square to move or swap it; tap an enemy to see its plan. */
  const deploySquare = (p: Pos) => {
    if (dragged.current) { dragged.current = false; return; }
    const u = at(run, p);
    if (deployPick && (!u || u.side === "white") && u?.id !== deployPick && e.starts.some(s => same(s, p))) { redeploy(deployPick, p); return; }
    if (u?.side === "white") { setDeployPick(id => (id === u.id ? null : u.id)); setInspectId(null); return; }
    setDeployPick(null);
    setInspectId(u ? u.id : null);
  };
  /** Deploy drags: press a piece and drag it onto a start square. Anywhere else, it snaps back. */
  const pressPiece = (ev: ReactPointerEvent, p: Pos) => {
    const u = at(run, p);
    if (!u || u.side !== "white" || ev.button > 0) return;
    dragged.current = false;
    const from = { x: ev.clientX, y: ev.clientY }, pointer = ev.pointerId;
    let live = false;
    const moveTo = (me: PointerEvent) => {
      if (me.pointerId !== pointer) return;
      if (!live && Math.hypot(me.clientX - from.x, me.clientY - from.y) < DRAG_SLOP) return;
      live = true;
      const hit = squareAt(me.clientX, me.clientY);
      setDrag(d => ({ id: u.id, at: hit?.at ?? d?.at ?? { x: u.x + .5, y: u.y + .5 }, over: hit && e.starts.some(s => same(s, hit.p)) ? hit.p : null }));
    };
    const end = (me: PointerEvent) => {
      if (me.pointerId !== pointer) return;
      window.removeEventListener("pointermove", moveTo); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end);
      if (!live) return;
      dragged.current = true;
      // The click that follows a drag lands on the press's cell; if none comes (pointercancel), don't swallow the next tap.
      setTimeout(() => { dragged.current = false; }, 0);
      setDrag(null);
      const hit = me.type === "pointerup" ? squareAt(me.clientX, me.clientY) : null;
      if (hit && e.starts.some(s => same(s, hit.p))) redeploy(u.id, hit.p);
    };
    window.addEventListener("pointermove", moveTo); window.addEventListener("pointerup", end); window.addEventListener("pointercancel", end);
  };
  const beginBattle = () => { setDeployPick(null); setDrag(null); setInspectId(null); setRun(begin(run)); showPhase("player"); };
  const square = (p: Pos) => {
    if (deploying) { deploySquare(p); return; }
    if (locked) return;
    if (picking && selected) {
      const pick = picking.options.find(t => same(t, p));
      setPicking(null);
      if (pick) { strikeFrom(pick, selected, picking.target); return; }
      // Any other tap cancels; only another piece (yours or an enemy) carries on as a fresh tap.
      if (!at(run, p) || same(picking.target, p)) { setNotice(""); return; }
    }
    const u = at(run, p);
    if (u?.side === "white") { setSelectedId(u.id); setInspectId(null); setNotice(""); return; }
    if (u && selected) {
      // Tap an enemy to strike it: in place if it's next to you, otherwise walk up first.
      if (strikeNow(run, selected, u)) return;
      const ways = approaches(run, selected.id, u.id);
      if (ways.length === 1) { strikeFrom(ways[0], selected, u); return; }
      if (ways.length) { setPicking({ target: u, options: ways }); return; }
    }
    // An enemy you can't strike shows its card and plan.
    if (u) { setInspectId(u.id); setNotice(""); return; }
    setInspectId(null);
    if (!selected) return;
    // Tapping the square a previewed piece started on takes the move back.
    if (home && same(home, p)) { cancelPreview(); return; }
    const { run: next, step: sprung } = stepOnto(moveRun, selected.id, p);
    if (next === moveRun) return;
    face(selected.id, selected, p); animate(selected.id, "move");
    if (sprung) {
      // Pressing a switch is the piece's action: no preview to cancel; the spears fly once it lands.
      const walked = { ...moveRun, units: moveRun.units.map(u => (u.id === selected.id ? { ...u, x: p.x, y: p.y, moved: true } : u)) };
      setRun(walked); setNotice(""); setTurnStart(null); setStriding(true);
      timers.current.push(setTimeout(() => {
        setStriding(false);
        setRun(next); setInspectId(null);
        setFlash({ step: sprung, hold: SPEAR_MS });
        perform(sprung, walked.units);
        if (!next.units.some(v => v.id === selected.id)) setSelectedId(null);
      }, DURATION.move * spd));
      return;
    }
    if (!preview) setTurnStart(run);
    setRun(next); setNotice("");
  };
  /** Takes back every move since the last strike or End turn: pieces walk home. */
  const cancelPreview = () => {
    if (!preview || locked) return;
    for (const u of run.units) {
      const was = preview.units.find(v => v.id === u.id);
      if (was && !same(was, u)) { face(u.id, u, was); animate(u.id, "move"); }
    }
    setRun(preview); setTurnStart(null); setPicking(null); setNotice("");
  };
  const showPhase = (kind: PhaseKind) => setPhaseBanner(b => ({ kind, n: (b?.n ?? 0) + 1 }));
  // Control comes back to you only if the enemy's phase didn't end the battle.
  const endPlayback = () => { setPlayback(null); if (run.phase === "player") showPhase("player"); };
  const finishTurn = () => {
    if (locked) return;
    const result = endTurn(run);
    if (result.run === run) return;
    setSelectedId(null); setNotice(""); setPicking(null); setTurnStart(null); setInspectId(null); setHoverId(null);
    // Commit the enemy's result at once (autosave included); playback only shows it.
    setRun(result.run);
    const fallen = run.units.find(u => u.id === "king");
    if (result.run.phase === "defeat" && fallen) setFall({ king: fallen, by: [...new Set(result.steps.filter(st => st.target === "king").map(st => st.actor))] });
    if (result.steps.length) { setPlayback({ steps: result.steps, before: run, index: 0, lead: true }); showPhase("enemy"); }
    else if (result.run.phase === "player") { setWaits(w => w + 1); showPhase("player"); }
  };
  // Under one move per turn, the turn passes on its own once your piece has done all it usefully can,
  // after its animation has played.
  useEffect(() => {
    if (locked || flash || preview || !turnSpent(run)) return;
    const id = setTimeout(finishTurn, (reduced ? 150 : 450) * spd);
    return () => clearTimeout(id);
  }, [run, locked, flash, preview]);
  function start(next: Run = fresh()) { clearStage(); setFall(null); setBanner(""); setOutroDone(""); if (timer.current) clearTimeout(timer.current); setPlayback(null); setPhaseBanner(null); setWaits(0); setRun(next); setTurnStart(null); setInspectId(null); setSelectedId(null); setIntro(false); setNotice(""); setDeployPick(null); setDrag(null); }
  const step = playback && !playback.lead ? playback.steps[playback.index] : null;
  const shown = step ? step.units : playback ? playback.before.units : run.units;
  const caption = step ? (step.counter && stage.counter?.landed ? step.counter : step.text) : picking ? "Strike from?" : "";
  const captionLine = <div className="playback-caption" aria-live="polite">{caption}</div>;
  const skip = () => { if (timer.current) clearTimeout(timer.current); endPlayback(); };
  return <main className="exile-app">
    <TopBar battle={battle} battles={battles} gold={run.tutorial ? undefined : run.gold} tutorial={run.tutorial} menuOpen={menu} menuDisabled={!canMenu} onMenu={() => setMenu(true)} />
    <section className="exile-field">
      <Board run={playback ? playback.before : run} moveRun={playback ? playback.before : moveRun} home={home} onHover={p => setHoverId(p ? at(run, p)?.id ?? null : null)} intent={intent} units={shown} selected={selected} flash={step ?? flash?.step ?? null} onSquare={square} locked={locked} stage={stage} spd={spd} picking={playback ? null : picking} checkers={playback || !check ? [] : check.attackers} pips={!playback && run.phase === "player"} skinOf={skinOf} deploy={deploying ? { starts: e.starts, picked: deployPick, drag, onDown: pressPiece } : null}
        above={<TeamBar side="black" center={playback ? <><span className="turn-ribbon">ENEMY PHASE</span>{captionLine}</>
          : deploying ? <span className="turn-ribbon deploy-ribbon">DEPLOY</span>
          : waits > 0 && <span key={waits} role="status" className="turn-ribbon enemy-waits">ENEMY WAITS</span>}><EnemyEmblem /></TeamBar>}
        below={<TeamBar side="white" center={!playback && <>
          {check && <p role="alert" className={`check-alert ${check.escape ? "" : "no-way-out"}`}><strong>{check.escape ? "Check" : "No way out"}</strong></p>}
          {captionLine}</>}><KingHearts hp={shown.find(u => u.id === "king")?.hp ?? 0} max={r.hp.king} /></TeamBar>} />
      {notice && <p role="status" className="notice">{notice}</p>}
      <p className="sr-only" aria-live="polite">{banner === "checkmate" ? "Checkmate" : banner === "defeat" ? "Defeat" : banner === "victory" ? "Victory" : banner === "cleared" ? "Battle won" : ""}</p>
      {banner && <BattleBanner kind={banner} line={banner === "cleared" && !run.tutorial ? `+${e.reward} ✦` : undefined} onClick={skipOutro} />}
    </section>
    <section className="table-hud" aria-label="Actions">
      <div className="hud-info">
        {enemy && intent && (!locked || deploying) ? <div className="selected-card enemy-card" role="group" aria-label={`${label(enemy)} card`}><PieceRig kind={enemy.kind} side="black" /><div><strong>{label(enemy)}</strong><UnitStats u={enemy} r={r} />
          <span className="intent-line" role="img" aria-label={`Intent: ${intentWords(run, intent)}`}>{intentWaits(intent) ? "waits" : <>
            {intent.to && <span>→ {coord(run, intent.to)}</span>}
            {intent.strike && <span><StrikeIcon />{kindName(run.units.find(u => u.id === intent.strike!.target)?.kind ?? "")} −{intent.strike.damage}</span>}</>}</span></div></div>
        : selected && !locked && <div className="selected-card"><PieceRig kind={selected.kind} side="white" skin={skinOf(selected.kind)} /><div><strong>{kindName(selected.kind)}</strong><UnitStats u={selected} r={r} /><span className="action-pips" role="img" aria-label={selectedBenched ? "locked: another piece acted" : selected.acted ? "done" : selected.moved ? "moved" : "ready"}><i className={selected.moved || selected.acted || selectedBenched ? "" : "full"} /><i className={selected.acted || selectedBenched ? "" : "full"} /></span></div></div>}
      </div>
      {preview && !locked && <button className="cancel-move" aria-label="Cancel" onClick={cancelPreview} title="Take the move back (Esc)"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></svg><span className="cancel-label">Cancel</span></button>}
      {deploying
        ? <button className="end-turn ready begin" onClick={beginBattle}><span className="end-turn-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z" /></svg></span><span className="end-turn-label">Begin</span></button>
        : <>{playback && <SkipToken onClick={skip} />}
      <EndTurnButton state={playback ? "waiting" : checkLocked ? "locked" : "ready"} disabled={locked || checkLocked} onClick={finishTurn} /></>}
    </section>
    {intro && <div className="exile-modal-shade"><section className="exile-modal intro-exile" role="dialog" aria-modal="true" aria-label="New run"><div className="intro-king"><PieceRig kind="king" side="white" /></div>{tutorialNext && <p className="kicker">Tutorial</p>}<h1>Escape from Exile</h1><button className="primary-button" autoFocus onClick={() => start()}>Start<span>→</span></button>{!test && HAS_TUTORIAL && !tutorialNext && <button className="text-button" onClick={() => start(tutorialRun())}>Tutorial</button>}{!test && saved() && <button className="text-button" onClick={() => setIntro(false)}>Continue</button>}</section></div>}
    {!intro && !playback && !outro && run.phase === "camp" && run.tutorial && <TutorialNext run={run} battle={battle} battles={battles} onGo={() => { clearStage(); setTurnStart(null); setRun(r => leaveCamp(r)); setSelectedId(null); }} />}
    {!intro && !playback && !outro && run.phase === "camp" && !run.tutorial && <Hub run={run} reward={e.reward} spd={spd} onBuy={choice => setRun(r => buy(r, choice))} onLeave={() => { clearStage(); setTurnStart(null); setRun(r => leaveCamp(r)); setSelectedId(null); }} />}
    {!intro && !playback && !outro && ["victory", "defeat"].includes(run.phase) && <div className="exile-modal-shade"><section className="exile-modal" role="dialog" aria-modal="true" aria-label={run.phase === "victory" ? "Victory" : "Defeat"}>{run.tutorial && <p className="kicker">Tutorial</p>}<h1>{run.phase === "victory" ? "Victory" : "Defeat"}</h1><p>{run.phase === "victory" ? `${run.units.filter(u => u.side === "white").length} pieces · ♥${king?.hp ?? 0}/${r.hp.king}` : `Battle ${battle} of ${battles} · turn ${run.turn}`}</p>
      {!run.tutorial || test ? <button className="primary-button" onClick={() => start()}>Play again<span>→</span></button>
        : run.phase === "defeat" ? <button className="primary-button" onClick={() => start(retry(run))}>Retry<span>→</span></button>
        : <button className="primary-button" onClick={() => start(newRun())}>Roguelike<span>→</span></button>}</section></div>}
    {phaseBanner && <PhaseBanner key={phaseBanner.n} kind={phaseBanner.kind} total={phaseTiming(fast, reduced).total} onDone={() => setPhaseBanner(b => b?.n === phaseBanner.n ? null : b)} />}
    {menu && <PauseMenu rules={r} log={run.log} fast={fast} onFast={setFast} newRunDisabled={!!playback} onNewRun={() => { setMenu(false); setIntro(true); }} onClose={() => setMenu(false)} battles={ENCOUNTERS.length} onJump={test ? undefined : index => { setMenu(false); start(jumpRun(index)); }}
      tutorial={test || !HAS_TUTORIAL ? undefined : { done: !!meta.tutorialDone, onToggle: () => { setMeta(m => markTutorial(m, !m.tutorialDone)); setMenu(false); setIntro(true); } }} />}
  </main>;
}
