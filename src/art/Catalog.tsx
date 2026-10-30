import type { CSSProperties, ReactNode } from "react";
import { PieceRig, RIG_MS } from "../components/PieceRig";
import type { RigAction, RigKind, RigSide } from "../components/PieceRig";
import { PieceArt } from "../components/PieceArt";
import { BattleBanner, GuardBadge } from "../components/BoardArt";
import type { BannerKind } from "../components/BoardArt";
import { ArmySlots, Legend, ReachGlyph, RulesCard } from "../components/Panels";
import { StrikeIcon } from "../components/StrikeIcon";
import { H, PLACES, PlaceArt, START, W, blocked, onPath } from "../components/Hub";
import { COST, DAMAGE, ENCOUNTERS, HP, STRIKE_COST } from "../game/turns";
import { Entry, Group, LoopRig, MiniBoard, usePhase, useStudio } from "./kit";

export const KINDS: RigKind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];
const SIDES: { side: RigSide; name: string }[] = [{ side: "white", name: "Rebel" }, { side: "black", name: "Patrol" }];
type State = { label: string; action: RigAction; wounded?: boolean; defending?: boolean; used: (k: RigKind, s: RigSide) => boolean };
const all = () => true;
/** Patrol pieces some battle spawns, plus the queen enemy pawns promote into. */
const PATROL_IN_GAME = new Set<RigKind>([...ENCOUNTERS.flatMap(e => e.spawns.map(([k]) => k)), "queen"]);
const STATES: State[] = [
  { label: "Idle", action: "idle", used: all },
  { label: "Wounded", action: "idle", wounded: true, used: k => HP[k] > 1 },
  { label: "Guarding", action: "idle", defending: true, used: all },
  { label: "Move", action: "move", used: all },
  { label: "Attack", action: "attack", used: all },
  { label: "Defend", action: "defend", used: all },
  { label: "Hit", action: "hit", used: all },
  { label: "Death", action: "death", used: all },
  { label: "Cheer", action: "cheer", used: all },
  { label: "Morph out", action: "morph-out", used: k => k === "pawn" },
  { label: "Morph in", action: "morph-in", used: (k, s) => s === "white" ? k !== "king" && k !== "pawn" : k === "queen" },
  { label: "Leap", action: "leap", used: k => k === "knight" },
  { label: "Leap back", action: "leap-back", used: k => k === "knight" },
  { label: "Mate", action: "mate", used: (k, s) => k === "king" && s === "white" },
];

function CastMatrix() {
  return <div className="matrix-wrap" tabIndex={0} aria-label="Cast by state (scrolls sideways)">
    <table className="matrix">
      <thead><tr><th scope="col">Piece</th>{STATES.map(s => <th key={s.label} scope="col">{s.label}<small>{s.action === "idle" ? "loop" : `${RIG_MS[s.action]}ms`}</small></th>)}</tr></thead>
      <tbody>{KINDS.flatMap(kind => SIDES.map(({ side, name }) => <tr key={kind + side}>
        <th scope="row">{kind}<small>{name}{side === "black" && !PATROL_IN_GAME.has(kind) ? " · not in a battle yet" : side === "black" && kind === "queen" ? " · via promotion" : ""}</small></th>
        {STATES.map(s => <td key={s.label}>{s.used(kind, side)
          ? <LoopRig kind={kind} side={side} action={s.action} wounded={s.wounded} defending={s.defending} />
          : <span className="na" title="Not used in the game">—</span>}</td>)}
      </tr>))}</tbody>
    </table>
  </div>;
}

/** One-shot rig actions chained the way App.tsx plays them. */
function Sequence({ steps, pause = 900 }: { steps: { kind: RigKind; side: RigSide; action: RigAction }[]; pause?: number }) {
  const { hue } = useStudio();
  const marks = steps.reduce<number[]>((at, s, i) => [...at, i ? at[i - 1] + RIG_MS[steps[i - 1].action] : 0], []);
  const { ref, phase, cycle } = usePhase(marks, marks[marks.length - 1] + RIG_MS[steps[steps.length - 1].action] + pause);
  const s = steps[phase];
  return <div ref={ref} className="loop-rig"><PieceRig key={`${cycle}-${phase}`} kind={s.kind} side={s.side} hue={hue} action={s.action} facing={s.side === "white" ? 1 : -1} seed="seq" /></div>;
}

/** Knight strike as App.tsx stages it: flip over (lunge), strike, target hit, backflip home. */
export function KnightStrike() {
  const { ref, phase, cycle } = usePhase([0, 340, 570, 720, 1140], 2300);
  const lunge = phase < 3, home = { x: 0, y: 2 }, target = { x: 1, y: 0 };
  const at = lunge ? { x: home.x + (target.x - home.x) * .62, y: home.y + (target.y - home.y) * .62 } : home;
  const knight = ["leap", "attack", "attack", "leap-back", "idle"][phase] as RigAction;
  return <div ref={ref} className="scene"><MiniBoard cols={2} rows={3} cells={phase === 2 ? { "1,0": { cls: "impact-square" } } : {}} pieces={[
    { kind: "knight", side: "white", ...at, cls: phase < 4 ? "lunging" : "", action: knight, actionKey: cycle * 10 + [0, 1, 1, 3, 4][phase] },
    { kind: "pawn", side: "black", ...target, action: phase === 2 || phase === 3 ? "hit" : "idle", actionKey: cycle * 10 + (phase === 2 || phase === 3 ? 2 : 0), extra: phase === 2 || phase === 3 ? <span className="damage-pop">−{DAMAGE.knight}</span> : undefined },
  ]} /></div>;
}
function StrikeScene({ kill }: { kill?: boolean }) {
  // A plain kill drops the target straight into its death; a survivor is hit as the blow lands.
  const { ref, phase, cycle } = usePhase(kill ? [0] : [0, 230], kill ? 2200 : 1700), hit = kill || phase > 0;
  return <div ref={ref} className="scene"><MiniBoard cols={2} rows={1} cells={hit ? { "1,0": { cls: "impact-square" } } : {}} pieces={[
    { kind: "rook", side: "white", x: 0, y: 0, action: "attack", actionKey: cycle },
    { kind: kill ? "pawn" : "queen", side: "black", x: 1, y: 0, action: hit ? kill ? "death" : "hit" : "idle", actionKey: cycle * 2 + phase, cls: kill ? "ghost" : "", hp: kill ? undefined : HP.queen - (hit ? DAMAGE.rook : 0), max: HP.queen, extra: hit ? <span className="damage-pop" key={cycle}>−{DAMAGE.rook}</span> : undefined },
  ]} /></div>;
}
function MateScene() {
  // App.tsx outro: spotlight at 250ms, attackers cheer at +300 and +1900, banner at 1750.
  const { ref, phase, cycle } = usePhase([0, 250, 550, 1750, 2150], 5400);
  const zoom = phase >= 1, cheer = phase >= 2 ? cycle * 3 + (phase >= 4 ? 2 : 1) : cycle * 3;
  return <div ref={ref} className="stage mate-stage">
    <MiniBoard cols={3} rows={3} camera={zoom ? "mate-zoom" : ""} style={zoom ? { "--zx": "50%", "--zy": "83%" } as CSSProperties : undefined} pieces={[
      { kind: "king", side: "white", x: 1, y: 2, action: zoom ? "mate" : "hit", actionKey: cycle * 2 + (zoom ? 1 : 0), cls: zoom ? "ghost" : "" },
      { kind: "queen", side: "black", x: 1, y: 1, action: phase >= 2 ? "cheer" : phase ? "idle" : "attack", actionKey: cheer },
      { kind: "pawn", side: "black", x: 2, y: 1, action: phase >= 2 ? "cheer" : "idle", actionKey: cheer },
    ]} />
    {phase >= 3 && <BattleBanner key={cycle} kind="checkmate" focus={false} />}
  </div>;
}
function Banner({ kind }: { kind: BannerKind }) {
  const { ref, cycle } = usePhase([0], 3200);
  return <div ref={ref} className="stage banner-stage"><BattleBanner key={cycle} kind={kind} focus={false} /></div>;
}
function Looping({ ms, children }: { ms: number; children: (n: number) => ReactNode }) {
  const { ref, cycle } = usePhase([0], ms);
  return <div ref={ref} className="scene">{children(cycle)}</div>;
}

const tile = (cls: string, dot?: ReactNode, coord?: string) => <div className="tile-spec"><div className={`exile-cell ${cls}`}>{coord && <span className="tile-coord">{coord}</span>}{dot}</div></div>;
const one = (p: Parameters<typeof MiniBoard>[0]["pieces"], cells?: Parameters<typeof MiniBoard>[0]["cells"]) => <MiniBoard cols={1} rows={1} pieces={p} cells={cells} />;
const FX: { name: string; cls: string; kind: RigKind; side: RigSide; defending?: boolean; wounded?: boolean; action?: RigAction }[] = [
  { name: "Dust (fx-dust)", cls: "show-dust", kind: "pawn", side: "white" },
  { name: "Speed lines (fx-lines)", cls: "show-lines", kind: "knight", side: "white" },
  { name: "Smear (fx-smear)", cls: "show-smear", kind: "queen", side: "white" },
  { name: "Impact burst (fx-burst)", cls: "show-burst", kind: "rook", side: "white" },
  { name: "Stars (fx-stars)", cls: "show-stars", kind: "bishop", side: "white" },
  { name: "Smoke (fx-smoke)", cls: "show-smoke", kind: "pawn", side: "black" },
  { name: "Sweat drop", cls: "show-sweat", kind: "pawn", side: "white" },
  { name: "Yell mouth", cls: "show-yell", kind: "king", side: "white" },
  { name: "Ouch mouth", cls: "show-ouch", kind: "queen", side: "black" },
  { name: "KO eyes", cls: "show-ko", kind: "bishop", side: "black" },
  { name: "Buckler (rebel shield)", cls: "", kind: "pawn", side: "white", defending: true },
  { name: "Kite shield (patrol)", cls: "", kind: "pawn", side: "black", defending: true },
  { name: "Rook door (rook defend)", cls: "", kind: "rook", side: "white", defending: true },
  { name: "Bandage (wounded)", cls: "", kind: "knight", side: "black", wounded: true },
  { name: "Line boil (SVG filter)", cls: "", kind: "king", side: "black", action: "defend" },
];

export function Catalog() {
  const { hue } = useStudio();
  const fav = `${import.meta.env.BASE_URL}favicon.svg`;
  return <div className="catalog">
    <Group id="cast" title="Cast × state">
      <CastMatrix />
    </Group>

    <Group id="cast-pairs" title="Cast pairs">
      {KINDS.map((kind, i) => <Entry key={kind} name={kind} src="components/PieceRig.tsx">
        <div className="pair">{SIDES.map(({ side, name }, j) => <div key={side} className={`pair-tile ${j ? "grass" : "sand"}`}><PieceRig kind={kind} side={side} hue={hue} facing={j ? -1 : 1} seed={i * 2 + j} /><small>{name}</small></div>)}</div>
      </Entry>)}
    </Group>

    <Group id="sequences" title="Sequences">
      <Entry name="Promotion · rebel" src="App.tsx perform() · rig.css morph-*"><Sequence steps={[{ kind: "pawn", side: "white", action: "morph-out" }, { kind: "queen", side: "white", action: "morph-in" }]} /></Entry>
      <Entry name="Promotion · patrol" src="App.tsx perform() · rig.css morph-*"><Sequence steps={[{ kind: "pawn", side: "black", action: "morph-out" }, { kind: "queen", side: "black", action: "morph-in" }]} /></Entry>
      <Entry name="Knight strike" src="App.tsx perform() stage.lunge · rig.css leap" wide><KnightStrike /></Entry>
      <Entry name="Strike + hit" src="App.tsx perform() · exile.css damage-pop" wide><StrikeScene /></Entry>
      <Entry name="Strike + death" src="App.tsx perform() · rig.css death" wide><StrikeScene kill /></Entry>
      <Entry name="Checkmate finale" src="App.tsx outro · exile.css mate-zoom" wide><MateScene /></Entry>
    </Group>

    <Group id="board" title="Board">
      <Entry name="Board in play" src="App.tsx Board · exile.css" wide>
        <MiniBoard cols={4} rows={4} coords cells={{
          "1,1": { cls: "wall" }, "2,3": { dot: <span className="target-dot"><b className="cost-label">1</b></span> }, "3,3": { dot: <span className="target-dot unsafe-dot"><b className="cost-label">✕</b></span> },
          "3,1": { cls: "strikeable" }, "0,0": { cls: "guarded-tile black" },
        }} pieces={[
          { kind: "king", side: "white", x: 1, y: 3, cls: "selected", hp: 4, max: HP.king, extra: <span className="check-tag">CHECK</span> },
          { kind: "rook", side: "white", x: 0, y: 2, cls: "spent", hp: 5, max: HP.rook },
          { kind: "pawn", side: "black", x: 3, y: 1, cls: "targetable", hp: 1, max: HP.pawn, extra: <span className="strike-badge"><StrikeIcon />{STRIKE_COST}</span> },
          { kind: "knight", side: "black", x: 0, y: 0, cls: "guarded", defending: true, hp: 3, max: HP.knight, extra: <><GuardBadge /><span className="check-mark">!</span></> },
        ]} />
      </Entry>
      <Entry name="Sand" src="exile.css .exile-cell.sand">{tile("sand")}</Entry>
      <Entry name="Grass" src="exile.css .exile-cell.grass">{tile("grass")}</Entry>
      <Entry name="Wall" src="exile.css .exile-cell.wall">{tile("wall")}</Entry>
      <Entry name="Coordinate" src="exile.css .tile-coord">{tile("sand", undefined, "b2")}</Entry>
      <Entry name="Move dot + cost" src="exile.css .target-dot">{tile("grass", <span className="target-dot"><b className="cost-label">2</b></span>)}</Entry>
      <Entry name="Blocked move ✕" src="exile.css .unsafe-dot">{tile("sand", <span className="target-dot unsafe-dot"><b className="cost-label">✕</b></span>)}</Entry>
      <Entry name="Strike-from dot" src="exile.css .approach-dot">{tile("grass", <span className="target-dot approach-dot"><b className="cost-label"><StrikeIcon />3</b></span>)}</Entry>
      <Entry name="Strikeable" src="exile.css .strikeable">{tile("sand strikeable")}</Entry>
      <Entry name="Aimed" src="exile.css .aimed">{tile("grass aimed")}</Entry>
      <Entry name="Guarded tile" src="exile.css .guarded-tile">{tile("sand guarded-tile")}</Entry>
      <Entry name="Impact" src="exile.css .impact-square"><Looping ms={1400}>{n => <div key={n}>{tile("grass impact-square")}</div>}</Looping></Entry>
    </Group>

    <Group id="markers" title="Piece markers">
      <Entry name="Selected" src="exile.css .exile-piece.selected">{one([{ kind: "bishop", side: "white", x: 0, y: 0, cls: "selected" }])}</Entry>
      <Entry name="Spent" src="exile.css .exile-piece.spent">{one([{ kind: "bishop", side: "white", x: 0, y: 0, cls: "spent" }])}</Entry>
      <Entry name="Guarded + chip" src="BoardArt.tsx GuardBadge · exile.css .guarded">{one([{ kind: "pawn", side: "black", x: 0, y: 0, cls: "guarded", defending: true, extra: <GuardBadge /> }], { "0,0": { cls: "guarded-tile" } })}</Entry>
      <Entry name="Targetable + strike badge" src="exile.css .targetable .strike-badge">{one([{ kind: "pawn", side: "black", x: 0, y: 0, cls: "targetable", extra: <span className="strike-badge"><StrikeIcon />{STRIKE_COST}</span> }], { "0,0": { cls: "strikeable" } })}</Entry>
      <Entry name="Unsafe-strike chip ✕" src="exile.css .strike-badge.unsafe">{one([{ kind: "pawn", side: "black", x: 0, y: 0, extra: <span className="strike-badge unsafe">✕</span> }])}</Entry>
      <Entry name="Strike reach ticks" src="exile.css .exile-cell.in-reach">{one([{ kind: "pawn", side: "black", x: 0, y: 0 }], { "0,0": { cls: "in-reach" } })}</Entry>
      <Entry name="Action pips: ready / moved / done" src="exile.css .action-pips"><div className="pip-states">{[[1, 1], [0, 1], [0, 0]].map(([a, b], i) => <span key={i} className="action-pips"><i className={a ? "full" : ""} /><i className={b ? "full" : ""} /></span>)}</div></Entry>
      <Entry name="CHECK tag" src="exile.css .check-tag">{one([{ kind: "king", side: "white", x: 0, y: 0, extra: <span className="check-tag">CHECK</span> }])}</Entry>
      <Entry name="Attacker !" src="exile.css .check-mark">{one([{ kind: "queen", side: "black", x: 0, y: 0, extra: <span className="check-mark">!</span> }])}</Entry>
      <Entry name="HP · rebel / patrol" src="exile.css .piece-health"><MiniBoard cols={2} rows={1} pieces={[{ kind: "rook", side: "white", x: 0, y: 0, hp: 3, max: HP.rook }, { kind: "rook", side: "black", x: 1, y: 0, hp: 5, max: HP.rook }]} /></Entry>
      <Entry name="Damage number" src="exile.css .damage-pop"><Looping ms={1200}>{n => one([{ kind: "knight", side: "black", x: 0, y: 0, extra: <span className="damage-pop" key={n}>−2</span> }])}</Looping></Entry>
    </Group>

    <Group id="effects" title="Rig parts and effects">
      {FX.map(fx => <Entry key={fx.name} name={fx.name} src="components/PieceRig.tsx">
        <div className={`fx-spec ${fx.cls}`}><PieceRig kind={fx.kind} side={fx.side} hue={hue} action={fx.action ?? "idle"} defending={fx.defending} wounded={fx.wounded} facing={fx.side === "white" ? 1 : -1} seed={fx.name} /></div>
      </Entry>)}
    </Group>

    <Group id="banners" title="Banners">
      {(["cleared", "victory", "defeat", "checkmate"] as const).map(k => <Entry key={k} name={k} src="BoardArt.tsx BattleBanner · exile.css" wide><Banner kind={k} /></Entry>)}
    </Group>

    <Group id="hub" title="Hideout">
      <Entry name="Village map" src="components/Hub.tsx · hub.css" wide>
        <div className="hub-screen-bg"><div className="hub-map" style={{ aspectRatio: `${W}/${H}` }}>
          <div className="hub-ground">{Array.from({ length: W * H }, (_, i) => { const p = { x: i % W, y: Math.floor(i / W) }; return <span key={i} className={`hub-tile ${blocked(p) ? "lot" : onPath(p) ? "path" : (p.x + p.y) % 2 ? "grass" : "grass alt"}`} />; })}</div>
          {PLACES.map(b => <div key={b.id} className={`hub-place ${b.id} ${b.soon ? "soon" : ""}`} style={{ left: `${b.at.x / W * 100}%`, top: `${b.at.y / H * 100}%`, width: `${b.size.x / W * 100}%`, height: `${b.size.y / H * 100}%` }}>
            <PlaceArt id={b.id} /><span className="hub-sign"><b>{b.name}</b><small>{b.tagline}</small></span></div>)}
          <div className="hub-king" style={{ left: `${(START.x + .5) / W * 100}%`, top: `${(START.y + .5) / H * 100}%` }}><PieceRig kind="king" side="white" seed="king" /></div>
        </div></div>
      </Entry>
      {PLACES.map(b => <Entry key={b.id} name={b.name} src="Hub.tsx PlaceArt" note={b.soon ? "placeholder" : undefined}><div className={`building ${b.soon ? "soon" : ""}`}><PlaceArt id={b.id} /></div></Entry>)}
      <Entry name="Locked buildings 🔒" src="Hub.tsx PLACES soon" wide><div className="locked-row">{PLACES.filter(b => b.soon).map(b => <div key={b.id} className="studio-lock"><span className="hub-sign"><b>{b.name}</b><small>{b.tagline}</small></span></div>)}</div></Entry>
      <Entry name="Walking king" src="Hub.tsx .hub-king" note="plays once per walk"><LoopRig kind="king" side="white" action="move" pause={0} /></Entry>
      <Entry name="Tiles: grass / alt / path / lot" src="hub.css .hub-tile"><div className="hub-tiles">{["grass", "grass alt", "path", "lot"].map(c => <span key={c} className={`hub-tile ${c}`} />)}</div></Entry>
      <Entry name="Army chips (recruit glow)" src="hub.css .hub-army"><span className="hub-army">{(["king", "rook", "pawn"] as const).map((k, i) => <i key={k} className={i === 2 ? "new" : ""}><PieceRig kind={k} side="white" /></i>)}</span></Entry>
    </Group>

    <Group id="ui" title="UI">
      <Entry name="Wordmark" src="exile.css .exile-brand"><div className="exile-brand">CHEZZ</div></Entry>
      <Entry name="Primary button" src="exile.css .primary-button"><button className="primary-button" tabIndex={-1}>End turn<span>→</span></button></Entry>
      <Entry name="Secondary button" src="exile.css .secondary-button"><button className="secondary-button" tabIndex={-1}>Defend · 1⚡<span>−1 · counter</span></button></Entry>
      <Entry name="Text button" src="exile.css .text-button"><button className="text-button" tabIndex={-1}>New run</button></Entry>
      <Entry name="Legend row" src="components/Panels.tsx Legend" wide><div className="studio-legend"><Legend /></div></Entry>
      <Entry name="Rules card" src="components/Panels.tsx RulesCard" wide><section className="exile-modal studio-modal help-exile"><h1>Rules</h1><RulesCard /></section></Entry>
      <Entry name="Barracks army slots" src="components/Panels.tsx ArmySlots"><div className="camp-gold"><ArmySlots filled={2} total={4} /></div></Entry>
      <Entry name="Barracks stats + reach grid" src="components/Panels.tsx ReachGlyph" wide><div className="studio-stats">{(["pawn", "bishop", "rook"] as const).map(k => <p key={k}>{k} ♥{HP[k]} <StrikeIcon />{DAMAGE[k]}<ReachGlyph kind={k} /></p>)}</div></Entry>
      <Entry name="Energy pips" src="exile.css .energy-pips"><div className="energy-pips">{[1, 1, 0, 0].map((f, i) => <i key={i} className={f ? "full" : ""} />)}</div></Entry>
      <Entry name="Check alert" src="exile.css .check-alert"><p className="check-alert"><strong>Check!</strong></p><p className="check-alert no-way-out"><strong>Check. No way out.</strong></p></Entry>
      <Entry name="Selected card" src="exile.css .selected-card" wide><div className="selected-card"><PieceRig kind="rook" side="white" /><div><strong>rook · {HP.rook} HP · hits for {DAMAGE.rook}</strong></div></div></Entry>
      <Entry name="Offer card" src="exile.css .camp-offers" wide><div className="camp-offers one"><button tabIndex={-1}><div className="offer-art"><PieceRig kind="bishop" side="white" /></div><h2>Recruit a bishop</h2><strong>{COST.bishop} gold →</strong></button><button tabIndex={-1}><div className="offer-art"><span>♥</span></div><h2>Mend the king</h2><strong>{COST.heal} gold →</strong></button></div></Entry>
      <Entry name="Run stats" src="exile.css .run-stats" wide><div className="run-stats"><span>♛ <b>4 / {HP.king}</b><small>KING HEALTH</small></span><span>⚡ <b>2 / 4</b><small>ENERGY</small></span><span>✦ <b>10</b><small>GOLD</small></span></div></Entry>
      <Entry name="Arena topline" src="exile.css .arena-topline" wide><div className="arena-topline studio-fill"><span>TURN 3 · YOUR MOVE</span><span>2 ENEMIES</span></div></Entry>
      <Entry name="Caption · enemy turn" src="exile.css .playback-caption" wide><div className="playback-caption playing studio-fill">Enemy pawn moves to b3.</div></Entry>
      <Entry name="Playback controls" src="exile.css .playback-controls" wide><div className="playback-controls studio-fill"><label><input type="checkbox" readOnly tabIndex={-1} /> Fast enemy turns</label><button tabIndex={-1}>Skip enemy turn</button></div></Entry>
      <Entry name="Notice" src="exile.css .notice"><p className="notice">Autosave off</p></Entry>
      <Entry name="Modal card" src="exile.css .exile-modal" wide><section className="exile-modal studio-modal"><p className="kicker">KICKER</p><h1>Title</h1><button className="primary-button" tabIndex={-1}>Continue<span>→</span></button><button className="text-button" tabIndex={-1}>Back</button></section></Entry>
      <Entry name="Battle log" src="exile.css .resolution-panel"><section className="resolution-panel"><details open><summary>Battle log</summary><p>Your rook strikes Enemy pawn for 3.</p></details></section></Entry>
      <Entry name="Hub sign" src="hub.css .hub-sign"><div className="sign-spec"><span className="hub-sign"><b>Barracks</b><small>Recruit and rest</small></span></div></Entry>
    </Group>

    <Group id="icons" title="Icons and glyphs">
      <Entry name="favicon.svg" src="public/favicon.svg"><img src={fav} width={64} height={64} alt="Chezz favicon" /></Entry>
      {[["♛", "King health"], ["⚡", "Energy"], ["✦", "Gold"], ["✕", "Blocked"], ["♥", "Heal"], ["!", "Attacker"], ["→", "Go"]].map(([g, n]) => <Entry key={n} name={n} src="Unicode glyph"><span className="glyph">{g}</span></Entry>)}
      <Entry name="Strike (crossed swords)" src="components/StrikeIcon.tsx"><span className="glyph"><StrikeIcon /></span></Entry>
      <Entry name="Guard shield" src="BoardArt.tsx GuardBadge"><span className="glyph"><GuardBadge /></span></Entry>
    </Group>

    <Group id="legacy" title="Legacy art (lab only)">
      {KINDS.map(kind => <Entry key={kind} name={kind} src="components/PieceArt.tsx"><div className="pair">{SIDES.map(({ side }, j) => <div key={side} className={`pair-tile ${j ? "grass" : "sand"}`}><PieceArt kind={kind} side={side} /></div>)}</div></Entry>)}
    </Group>
  </div>;
}
