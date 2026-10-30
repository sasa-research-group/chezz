import { PieceRig } from "../components/PieceRig";
import { PLACES } from "../components/Hub";
import { COST, DAMAGE, ENCOUNTERS, ENERGY, HP, STRIKE_COST, approaches, canEscape, exposesKing, inCheck, kingThreat, moveTargets, newRun, reaches } from "../game/turns";
import type { Kind, PromoteTo, Run, Side, Unit } from "../game/turns";
import { KINDS, KnightStrike } from "./Catalog";
import { Entry, Group, MiniBoard } from "./kit";
import type { Cell, Piece } from "./kit";

/** Every diagram here is computed by turns.ts on battle 1's open 4×4 board, so it follows the rules when they change. */
const board = (units: Unit[]): Run => ({ ...newRun(), units });
const unit = (id: string, kind: Kind, side: Side, x: number, y: number, hp = HP[kind]): Unit => ({ id, kind, side, x, y, hp });
const pc = (u: Unit): Piece => ({ kind: u.kind, side: u.side, x: u.x, y: u.y, hp: u.hp, max: HP[u.kind] });
const dot = (label: string | number, cls = "") => <span className={`target-dot ${cls}`}><b className="cost-label">{label}</b></span>;
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
const REACH: Record<Kind, string> = { king: "8 neighbours", queen: "8 neighbours", rook: "4 straight neighbours", bishop: "4 diagonal neighbours", knight: "L-jump", pawn: "2 diagonals forward" };

function Shape({ kind, side = "white" }: { kind: Kind; side?: Side }) {
  const at = { x: 1, y: side === "white" ? 2 : 1 }, u = unit("u", kind, side, at.x, at.y), run = board([u]);
  const cells: Record<string, Cell> = {};
  for (let i = 0; i < 16; i++) { const p = { x: i % 4, y: Math.floor(i / 4) }; if (reaches(run, u, u, p)) cells[key(p)] = { cls: "strikeable" }; }
  for (const t of moveTargets(run, u)) cells[key(t)] = { ...cells[key(t)], dot: dot(t.cost) };
  return <MiniBoard cols={4} rows={4} cells={cells} pieces={[{ kind, side, x: u.x, y: u.y }]} />;
}
const moveCost = (kind: Kind) => { const u = unit("u", kind, "white", 1, 2); const c = moveTargets(board([u]), u).map(t => t.cost); return kind === "knight" ? `${Math.min(...c)} per jump` : kind === "king" || kind === "pawn" ? `${Math.min(...c)} (1 square)` : `1 per square, up to ${Math.max(...c)} here`; };

function Check() {
  const king = unit("king", "king", "white", 1, 2, 1), pawn = unit("e", "pawn", "black", 2, 1), run = board([king, pawn]);
  const threat = kingThreat(run), check = inCheck(run);
  return <><MiniBoard cols={4} rows={4} pieces={[
    { ...pc(king), extra: check ? <span className="check-tag">CHECK</span> : undefined },
    { ...pc(pawn), extra: threat.attackers.includes("e") ? <span className="check-mark">!</span> : undefined },
  ]} /><p className="fine">inCheck: {String(check)} · threat {threat.damage} vs {king.hp} HP · canEscape: {String(canEscape(run))}</p></>;
}
function NoMoveIntoCheck() {
  const king = unit("king", "king", "white", 1, 3, 1), pawn = unit("e", "pawn", "black", 2, 1), run = board([king, pawn]);
  const cells = Object.fromEntries(moveTargets(run, king).map(t => [key(t), { dot: exposesKing(run, "king", t) ? dot("✕", "unsafe-dot") : dot(t.cost) }]));
  return <MiniBoard cols={4} rows={4} cells={cells} pieces={[{ ...pc(king), cls: "selected" }, pc(pawn)]} />;
}
function TapToStrike() {
  const king = unit("king", "king", "white", 3, 3), q = unit("q", "queen", "white", 0, 2), e = unit("e", "rook", "black", 2, 1), run = board([king, q, e]);
  const ways = approaches(run, "q", "e");
  const cells: Record<string, Cell> = { [key(e)]: { cls: "aimed" }, ...Object.fromEntries(ways.map(t => [key(t), { dot: dot(`⚔${t.cost}`, "approach-dot") }])) };
  return <><MiniBoard cols={4} rows={4} cells={cells} pieces={[pc(king), { ...pc(q), cls: "selected" }, { ...pc(e), cls: "targetable", extra: ways.length ? <span className="strike-badge">⚔ {Math.min(...ways.map(t => t.cost))}</span> : undefined }]} />
    <p className="fine">approaches(): {ways.length} square{ways.length === 1 ? "" : "s"} · cost = move + {STRIKE_COST}</p></>;
}
function Encounter({ i }: { i: number }) {
  const e = ENCOUNTERS[i];
  const cells: Record<string, Cell> = Object.fromEntries([...e.walls.map(w => [key(w), { cls: "wall" }]), ...e.starts.map((s, n) => [key(s), { dot: dot(n + 1) }])]);
  return <MiniBoard cols={e.width} rows={e.height} cells={cells} pieces={e.spawns.map(([kind, x, y, hp]) => ({ kind, side: "black", x, y, hp, max: HP[kind] }))} />;
}

const ENEMY: [string, string][] = [
  ["1 · Strike", `100 + 10×damage + 50 if it kills + 30 if the king − 8×counter − 60 if the counter kills it − cost. Never for 0 damage.`],
  ["2 · Pawn to far row", "30 (then promotes to queen)"],
  ["3 · Step into strike range", `20 − move cost, only if ${STRIKE_COST} energy is left to strike`],
  ["4 · Close in", "5 × squares gained − cost, toward the king (weighted) or the nearest piece; pawns with targets ahead march (1)"],
  ["5 · Brace (defend)", "0.4, only if threatened and the −1 saves it, or it can counter"],
  ["6 · Wait", "Nothing scores above 0"],
];
const RUN: [string, string][] = [
  ["Battles", `${ENCOUNTERS.length}, hideout between each`],
  ["HP", "Carries between battles"],
  ["Fallen allies", "Gone for the run"],
  ["King dies", "Run over (checkmate finale)"],
  ["Last battle won", "Victory screen"],
  ["Save", "Autosave every change (localStorage chezz.turns.v1)"],
  ["Export", "Playtest JSON (run + log + note)"],
];
const PROMOTE: PromoteTo[] = ["queen", "rook", "bishop", "knight"];
const RECRUITS = (["pawn", "bishop", "rook"] as const);

export function Mechanics() {
  const start = newRun();
  const knightJump = Math.min(...moveTargets(board([unit("k", "knight", "white", 1, 2)]), unit("k", "knight", "white", 1, 2)).map(t => t.cost));
  let gold = start.gold;
  return <div className="mechanics">
    <Group id="turn" title="Turn">
      <table className="spec"><tbody>
        <tr><th>Order</th><td>You, then the enemy</td></tr>
        <tr><th>Your energy</th><td>{ENERGY} per turn, refills</td></tr>
        <tr><th>Enemy energy</th><td>{ENCOUNTERS.map((e, i) => `battle ${i + 1}: ${e.enemyEnergy}`).join(" · ")}</td></tr>
        <tr><th>Per piece</th><td>1 move, then strike or defend</td></tr>
        <tr><th>Move</th><td>1 per square · knight {knightJump} per jump · slides stop at pieces and walls</td></tr>
        <tr><th>Strike</th><td>{STRIKE_COST} · next square in the piece's shape · striker stays put</td></tr>
        <tr><th>Defend</th><td>1 · −1 damage per hit until your next turn · counters any attacker it can reach</td></tr>
      </tbody></table>
    </Group>

    <Group id="pieces" title="Pieces">
      <table className="spec wide-table"><thead><tr><th>Piece</th><th>HP</th><th>Damage</th><th>vs defender</th><th>Move</th><th>Strike reach</th></tr></thead>
        <tbody>{KINDS.map(k => <tr key={k}><th>{k}</th><td>{HP[k]}</td><td>{DAMAGE[k]}</td><td>{Math.max(0, DAMAGE[k] - 1)}</td><td>{moveCost(k)}</td><td>{REACH[k]}</td></tr>)}</tbody></table>
      {KINDS.map(k => <Entry key={k} name={k} src="moveTargets() · reaches()" note="dots: move cost · red: strike reach" wide><Shape kind={k} /></Entry>)}
      <Entry name="pawn (patrol)" src="moveTargets() · reaches()" note="patrol pawns go down" wide><Shape kind="pawn" side="black" /></Entry>
    </Group>

    <Group id="check" title="Check">
      <Entry name="Check" src="kingThreat() · inCheck()" note="enemy's next turn could kill the king" wide><Check /></Entry>
      <Entry name="Can't move into check" src="exposesKing()" wide><NoMoveIntoCheck /></Entry>
      <table className="spec"><tbody>
        <tr><th>In check</th><td>End turn locked until safe, unless canEscape() finds nothing</td></tr>
        <tr><th>Moves / strikes into check</th><td>Refused (✕, no ⚔ badge)</td></tr>
        <tr><th>Already in check</th><td>Any action allowed; safe by end of turn</td></tr>
        <tr><th>King dies</th><td>Checkmate finale, run over</td></tr>
      </tbody></table>
    </Group>

    <Group id="strike" title="Tap to strike">
      <Entry name="Walk up, then strike" src="approaches() · walkAndStrike()" wide><TapToStrike /></Entry>
      <table className="spec"><tbody>
        <tr><th>Adjacent</th><td>Strike in place, {STRIKE_COST}</td></tr>
        <tr><th>One way in</th><td>Walks and strikes automatically</td></tr>
        <tr><th>Several ways</th><td>Pick the square (⚔ dots)</td></tr>
        <tr><th>Judged as</th><td>One action: walk may pass danger if the king is safe after the blow</td></tr>
      </tbody></table>
    </Group>

    <Group id="knight" title="Knight leap">
      <Entry name="Jump + strike" src="App.tsx perform() stage.lunge" wide><KnightStrike /></Entry>
      <table className="spec"><tbody>
        <tr><th>Jump</th><td>{knightJump}</td></tr><tr><th>Strike</th><td>{STRIKE_COST} (L-jump away, from its own square)</td></tr>
        <tr><th>Jump + strike</th><td>{knightJump + STRIKE_COST} of {ENERGY}</td></tr><tr><th>Animation</th><td>Front-flip to the target, backflip home (presentation only)</td></tr>
      </tbody></table>
    </Group>

    <Group id="promotion" title="Promotion">
      <Entry name="Rebel pawn → your pick" src="promote()" wide>
        <div className="promo-row">{PROMOTE.map(k => <div key={k}><PieceRig kind={k} side="white" /><small>{k} · {HP[k]} HP · {DAMAGE[k]} dmg</small></div>)}</div>
      </Entry>
      <Entry name="Patrol pawn → queen" src="enemyTurn()" wide><div className="promo-row"><div><PieceRig kind="queen" side="black" facing={-1} /><small>queen · {HP.queen} HP</small></div></div></Entry>
      <table className="spec"><tbody>
        <tr><th>Trigger</th><td>Pawn moves onto the far row</td></tr><tr><th>HP</th><td>Full HP of the new piece</td></tr>
        <tr><th>Your pawn</th><td>Play pauses for the picker; can still strike or defend</td></tr>
      </tbody></table>
    </Group>

    <Group id="enemy" title="Enemy turn">
      <table className="spec"><thead><tr><th>Priority</th><th>Score</th></tr></thead><tbody>{ENEMY.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      <p className="fine">enemyTurn(): best score first, repeat until the pool is spent. Deterministic; computed in full before playback.</p>
    </Group>

    <Group id="battles" title="Battles">
      {ENCOUNTERS.map((e, i) => <Entry key={i} name={`Battle ${i + 1}`} src="ENCOUNTERS" note={`${e.width}×${e.height} · enemy energy ${e.enemyEnergy} · reward ${e.reward} gold · ${e.starts.length} start square${e.starts.length > 1 ? "s" : ""}`} wide><Encounter i={i} /></Entry>)}
    </Group>

    <Group id="hideout" title="Hideout">
      <table className="spec"><thead><tr><th>Building</th><th>Offers</th></tr></thead><tbody>
        {PLACES.map(p => <tr key={p.id}><th>{p.name}</th><td>{p.id === "barracks" ? `Recruit pawn ${COST.pawn} · bishop ${COST.bishop} · rook ${COST.rook} · heal king +2 (max ${HP.king}) ${COST.heal}` : p.id === "road" ? "Next battle" : <span className="tag">placeholder</span>}</td></tr>)}
      </tbody></table>
      {RECRUITS.map(k => <Entry key={k} name={`Recruit ${k}`} src="buy() · COST" note={`${COST[k]} gold · ${HP[k]} HP · ${DAMAGE[k]} dmg`}><div className="promo-row"><div><PieceRig kind={k} side="white" /></div></div></Entry>)}
      <table className="spec"><tbody>
        <tr><th>Limit</th><td>Army + recruits ≤ next battle's start squares ({ENCOUNTERS.slice(1).map(e => e.starts.length).join(", ")})</td></tr>
        <tr><th>Buys</th><td>As many as gold and room allow</td></tr>
        <tr><th>Recruits join</th><td>When you take the road</td></tr>
        <tr><th>Upgrades, gear, consumables</th><td><span className="tag">not implemented</span></td></tr>
      </tbody></table>
    </Group>

    <Group id="gold" title="Gold">
      <table className="spec"><thead><tr><th>When</th><th>Gold</th><th>Most you can hold</th></tr></thead><tbody>
        <tr><th>Run start</th><td>{start.gold}</td><td>{gold}</td></tr>
        {ENCOUNTERS.map((e, i) => { gold += e.reward; return <tr key={i}><th>Win battle {i + 1}</th><td>+{e.reward}</td><td>{gold}</td></tr>; })}
      </tbody></table>
      <p className="fine">Only source: battle rewards. Only sink: the barracks.</p>
    </Group>

    <Group id="run" title="Run">
      <table className="spec"><tbody>{RUN.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
    </Group>
  </div>;
}
