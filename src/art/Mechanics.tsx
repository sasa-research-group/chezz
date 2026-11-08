import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { StrikeIcon } from "../components/StrikeIcon";
import { PLACES } from "../components/Hub";
import { IntentMarks } from "../components/BoardArt";
import { ENCOUNTERS, RULES, roguelikeCourse, tutorialCourse, approaches, attack, spawnHp, canEscape, enemyPlan, exposesKing, intentOf, inCheck, kingThreat, moveTargets, newRun, reaches } from "../game/turns";
import type { Kind, Reach, Rules, Run, Side, Unit } from "../game/turns";
import { LIMITS, SHOP, formatRules, parseRules } from "../game/rules";
import { listIssues } from "../game/levels";
import type { Shop } from "../game/rules";
import { Entry, Group, KINDS, MiniBoard, SpriteStill } from "./kit";
import type { Cell, Piece } from "./kit";
import { draftRules, setDraftRules } from "./rulesDraft";

const RULES_ENDPOINT = "/__studio/rules";
/** Every diagram here is computed by turns.ts on battle 1's open 4×4 board with the rules being edited, so it follows them live. */
const board = (r: Rules, units: Unit[]): Run => ({ ...newRun(), units, rules: r });
const unit = (r: Rules, id: string, kind: Kind, side: Side, x: number, y: number, hp = r.hp[kind]): Unit => ({ id, kind, side, x, y, hp });
const pc = (r: Rules, u: Unit): Piece => ({ kind: u.kind, side: u.side, x: u.x, y: u.y, hp: u.hp, max: r.hp[u.kind] });
const dot = (label?: ReactNode, cls = "") => <span className={`target-dot ${cls}`}>{label !== undefined && <b className="cost-label">{label}</b>}</span>;
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;
const REACH: Record<Kind, string> = { king: "8 neighbours", queen: "8 neighbours", rook: "4 straight neighbours", bishop: "4 diagonal neighbours", knight: "L-jump", pawn: "2 diagonals forward" };
const REACH_LINE: Record<Kind, string> = { king: "8 lines", queen: "8 lines", rook: "4 straight lines", bishop: "4 diagonal lines", knight: "L-jumps in a line", pawn: "2 diagonal lines forward" };
const MOVE: Record<Kind, string> = { king: "1 square, any way", queen: "slides any way", rook: "slides straight", bishop: "slides diagonally", knight: "L-jump (leaps)", pawn: "1 square forward, stops at the far row" };

function Shape({ r, kind, side = "white" }: { r: Rules; kind: Kind; side?: Side }) {
  const at = { x: 1, y: side === "white" ? 2 : 1 }, u = unit(r, "u", kind, side, at.x, at.y), run = board(r, [u]);
  const cells: Record<string, Cell> = {};
  for (let i = 0; i < 16; i++) { const p = { x: i % 4, y: Math.floor(i / 4) }; if (reaches(run, u, u, p)) cells[key(p)] = { cls: "strikeable" }; }
  for (const t of moveTargets(run, u)) cells[key(t)] = { ...cells[key(t)], dot: dot() };
  return <MiniBoard cols={4} rows={4} cells={cells} pieces={[{ kind, side, x: u.x, y: u.y }]} />;
}

function Check({ r }: { r: Rules }) {
  const king = unit(r, "king", "king", "white", 1, 2, 1), pawn = unit(r, "e", "pawn", "black", 2, 1), run = board(r, [king, pawn]);
  const threat = kingThreat(run), check = inCheck(run);
  return <><MiniBoard cols={4} rows={4} pieces={[
    { ...pc(r, king), extra: check ? <span className="check-tag">CHECK</span> : undefined },
    { ...pc(r, pawn), extra: threat.attackers.includes("e") ? <span className="check-mark">!</span> : undefined },
  ]} /><p className="fine">inCheck: {String(check)} · threat {threat.damage} vs {king.hp} HP · canEscape: {String(canEscape(run))}</p></>;
}
function NoMoveIntoCheck({ r }: { r: Rules }) {
  const king = unit(r, "king", "king", "white", 1, 3, 1), pawn = unit(r, "e", "pawn", "black", 2, 1), run = board(r, [king, pawn]);
  const cells = Object.fromEntries(moveTargets(run, king).map(t => [key(t), { dot: exposesKing(run, "king", t) ? dot("✕", "unsafe-dot") : dot() }]));
  return <MiniBoard cols={4} rows={4} cells={cells} pieces={[{ ...pc(r, king), cls: "selected" }, pc(r, pawn)]} />;
}
function TapToStrike({ r }: { r: Rules }) {
  const king = unit(r, "king", "king", "white", 3, 3), q = unit(r, "q", "queen", "white", 0, 2), e = unit(r, "e", "rook", "black", 2, 1), run = board(r, [king, q, e]);
  const ways = approaches(run, "q", "e");
  const cells: Record<string, Cell> = { [key(e)]: { cls: "aimed" }, ...Object.fromEntries(ways.map(t => [key(t), { dot: dot(<StrikeIcon />, "approach-dot") }])) };
  return <><MiniBoard cols={4} rows={4} cells={cells} pieces={[pc(r, king), { ...pc(r, q), cls: "selected" }, { ...pc(r, e), cls: "targetable", extra: ways.length ? <span className="strike-badge"><StrikeIcon /></span> : undefined }]} />
    <p className="fine">approaches(): {ways.length} square{ways.length === 1 ? "" : "s"}</p></>;
}
/** A bishop strikes down a diagonal: a rook can't hit back from there, another bishop can. */
function StrikeBack({ r, foe }: { r: Rules; foe: Kind }) {
  const king = unit(r, "king", "king", "white", 3, 3), b = unit(r, "b", "bishop", "white", 0, 3), e = unit(r, "e", foe, "black", 2, 1);
  const run: Run = { ...board(r, [king, b, e]), phase: "player" }, { step } = attack(run, "b", "e");
  return <><MiniBoard cols={4} rows={4} cells={{ [key(e)]: { cls: "aimed" } }} pieces={[pc(r, king), { ...pc(r, b), cls: "selected" }, pc(r, e)]} />
    <p className="fine">{step ? [step.text, step.counter].filter(Boolean).join(" · ") : "can't strike"}</p></>;
}
/** A rook's plan before and after a previewed king move: the same enemyPlan() the game draws on hover. */
function Intent({ r, previewed }: { r: Rules; previewed: boolean }) {
  const king = unit(r, "king", "king", "white", previewed ? 0 : 1, 3), rook = unit(r, "e", "rook", "black", 1, 1), pawn = unit(r, "p", "pawn", "black", 3, 0);
  const run = board(r, [king, rook, pawn]), plan = enemyPlan(run), intent = intentOf(run, plan, "e")!;
  return <><MiniBoard cols={4} rows={4} pieces={[pc(r, king), { ...pc(r, rook), cls: "inspected" }, pc(r, pawn)]} overlay={<IntentMarks intent={intent} cols={4} rows={4} leaps={false} />} />
    <p className="fine">{plan.map(s => s.text).join(" · ") || "Enemy waits"}</p></>;
}
function Encounter({ r, i }: { r: Rules; i: number }) {
  const e = ENCOUNTERS[i];
  const cells: Record<string, Cell> = Object.fromEntries([...e.walls.map(w => [key(w), { cls: "wall" }]), ...e.starts.map((s, n) => [key(s), { dot: dot(n + 1) }])]);
  return <MiniBoard cols={e.width} rows={e.height} cells={cells} pieces={e.spawns.map(s => ({ kind: s[0], side: "black", x: s[1], y: s[2], hp: spawnHp(r, s), max: r.hp[s[0]] }))} />;
}

const enemyScores = (r: Rules): [string, string][] => [
  ["Strike", `100 + 10×damage + 50 if it kills + 30 if the king${r.counter ? " − 8×strikeback − 60 if the strikeback kills it" : ""}. Never for 0 damage.`],
  ["Step into strike range", "20 − squares travelled ÷ 10, only if it hasn't struck"],
  ["Close in", "5 × moves saved − squares travelled ÷ 10, counting its own moves around walls to a square it could strike the king (weighted) or the nearest piece from; pawns with targets ahead march (1)"],
  ["Wait", "Nothing scores above 0"],
];
const RUN: [string, string][] = [
  ["Tutorial", `${tutorialCourse(ENCOUNTERS).length} battles in order, a preset army each, no hideout; a loss retries the battle`],
  ["Roguelike", `${roguelikeCourse(ENCOUNTERS).length} battles, hideout between each`],
  ["HP", "Carries between battles"],
  ["Fallen allies", "Gone for the run"],
  ["King dies", "Run over (checkmate finale)"],
  ["Last battle won", "Victory screen"],
  ["Save", "Autosave every change (localStorage chezz.turns.v1)"],
];
const RECRUITS = (["pawn", "bishop", "rook"] as const);
const SHOP_LABEL: Record<Shop, string> = { pawn: "Pawn", bishop: "Bishop", rook: "Rook", heal: "Heal" };

function Num({ label, value, range, onChange, prefix }: { label: string; value: number; range: readonly [number, number]; onChange: (n: number) => void; prefix?: ReactNode }) {
  return <label className="rule-num"><span className="sr-only">{label}</span>{prefix && <i aria-hidden="true">{prefix}</i>}
    <input type="number" inputMode="numeric" aria-label={label} min={range[0]} max={range[1]} value={Number.isFinite(value) ? value : ""} onChange={e => onChange(e.target.value === "" ? NaN : Number(e.target.value))} />
  </label>;
}
function Seg<T extends string>({ label, value, options, onPick }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void }) {
  return <div className="seg" role="group" aria-label={label}>{options.map(([v, l]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onPick(v)}>{l}</button>)}</div>;
}

/** Piece stats and rule switches, edited in place and saved to `src/game/rules.json`. */
function RulesEditor({ r, onChange }: { r: Rules; onChange: (r: Rules) => void }) {
  const [saved, setSaved] = useState(() => formatRules(RULES));
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const text = formatRules(r), dirty = text !== saved;
  const parsed = parseRules(JSON.parse(JSON.stringify(r)));
  const errors = parsed.ok ? [] : parsed.errors;
  // Stats never break a battle; the game clamps what no longer fits, and this says where.
  const clamps = parsed.ok ? listIssues(ENCOUNTERS, parsed.rules).flatMap((issues, i) => issues.filter(x => x.clamped).map(x => `Battle ${i + 1} ${"abcdefgh"[x.at!.x]}${ENCOUNTERS[i].height - x.at!.y}: ${x.message}`)) : [];
  const edit =(patch: Partial<Rules>) => { onChange({ ...r, ...patch }); setStatus(null); };
  async function save() {
    if (errors.length) return;
    if (!import.meta.env.DEV) {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "rules.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ ok: true, text: "Downloaded" });
      return;
    }
    try {
      const res = await fetch(RULES_ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "x-chezz-studio": "save" }, body: JSON.stringify(r) });
      const body = await res.json() as { ok?: boolean; errors?: string[] };
      if (res.ok && body.ok) { setSaved(text); setStatus({ ok: true, text: "Saved" }); }
      else setStatus({ ok: false, text: body.errors?.join(" · ") ?? `Error ${res.status}` });
    } catch { setStatus({ ok: false, text: "Save failed" }); }
  }
  return <div className="rules-editor" aria-label="Rules editor" role="group">
    <table className="spec wide-table rules-table"><thead><tr><th>Piece</th><th>HP</th><th>Damage</th><th>Move</th><th>Strike range</th><th>Strike reach</th></tr></thead>
      <tbody>{KINDS.map(k => <tr key={k}><th><span className="rule-kind"><SpriteStill kind={k} side="white" />{k}</span></th>
        <td><Num label={`${k} HP`} prefix="♥" value={r.hp[k]} range={LIMITS.hp} onChange={n => edit({ hp: { ...r.hp, [k]: n } })} /></td>
        <td><Num label={`${k} damage`} prefix={<StrikeIcon />} value={r.damage[k]} range={LIMITS.damage} onChange={n => edit({ damage: { ...r.damage, [k]: n } })} /></td>
        <td>{MOVE[k]}</td>
        <td><Seg<`${Reach}`> label={`${k} strike range`} value={`${r.range[k]}`} options={[["1", "1"], ["line", "Line"]]} onPick={v => edit({ range: { ...r.range, [k]: v === "line" ? "line" : 1 } })} /></td>
        <td>{r.range[k] === "line" ? REACH_LINE[k] : REACH[k]}</td></tr>)}</tbody></table>
    <div className="rules-globals">
      <div className="stage-field"><span>Turn</span><Seg label="Turn" value={r.turn} options={[["one", "One piece"], ["all", "Every piece"]]} onPick={turn => edit({ turn })} /></div>
      <div className="stage-field"><span>Strike back</span><Seg label="Strike back" value={r.counter ? "on" : "off"} options={[["on", "On"], ["off", "Off"]]} onPick={v => edit({ counter: v === "on" })} /></div>
      <div className="stage-field"><span>Start gold</span><Num label="Start gold" prefix="✦" value={r.gold} range={LIMITS.gold} onChange={gold => edit({ gold })} /></div>
      <div className="stage-field"><span>Heal</span><Num label="Heal HP" prefix="+♥" value={r.heal} range={LIMITS.heal} onChange={heal => edit({ heal })} /></div>
      <div className="stage-field rules-prices"><span>Prices ✦</span><div>{SHOP.map(s => <label key={s} className="rule-price">{SHOP_LABEL[s]}<Num label={`${SHOP_LABEL[s]} price`} value={r.cost[s]} range={LIMITS.cost} onChange={n => edit({ cost: { ...r.cost, [s]: n } })} /></label>)}</div></div>
    </div>
    {errors.length > 0 && <ul className="level-issues" aria-label="Problems">{errors.map(e => <li key={e}>{e}</li>)}</ul>}
    {clamps.length > 0 && <ul className="level-issues warn" aria-label="Warnings">{clamps.map(c => <li key={c}>{c}</li>)}</ul>}
    <div className="level-actions rules-actions">
      <button type="button" disabled={errors.length > 0 || !dirty} onClick={save}>{import.meta.env.DEV ? "Save" : "Download JSON"}</button>
      <button type="button" disabled={!dirty} onClick={() => { onChange(JSON.parse(saved)); setStatus(null); }}>Revert</button>
      <span className={`level-status ${status && !status.ok ? "bad" : ""}`} role="status">{status?.text ?? (dirty ? "Unsaved" : "")}</span>
      <code className="fine">src/game/rules.json</code>
    </div>
  </div>;
}

export function Mechanics() {
  const [r, setR] = useState<Rules>(draftRules);
  const change = (next: Rules) => { setDraftRules(next); setR(next); };
  // Diagrams can't draw a broken number (an empty field), so they keep the last values that parse.
  const lastGood = useRef(r);
  if (parseRules(JSON.parse(JSON.stringify(r))).ok) lastGood.current = r;
  const live = lastGood.current;
  let gold = live.gold;
  const one = live.turn === "one";
  return <div className="mechanics">
    <Group id="stats" title="Stats">
      <RulesEditor r={r} onChange={change} />
    </Group>

    <Group id="turn" title="Turn">
      <table className="spec"><tbody>
        <tr><th>Order</th><td>You, then the enemy</td></tr>
        <tr><th>Per turn</th><td>{one ? "One piece per side: it moves, then strikes (or just strikes). Once it has struck the turn passes; a move alone is a preview until End turn (Cancel takes it back); End turn skips the rest" : "Every piece, every turn: 1 move, then strike"}</td></tr>
        <tr><th>Move</th><td>Its chess shape, any distance · slides stop at pieces and walls · knights leap · pawns stop at the far row</td></tr>
        <tr><th>Strike</th><td>Next square in the piece's shape · range "Line": any distance along it, stopped by the first piece or wall · striker stays put</td></tr>
        <tr><th>Strike back</th><td>{live.counter ? "A struck piece that survives hits back with its own damage, if it can reach the attacker. Never from range: a ranged strike draws none, and a ranged piece never strikes back from afar" : "Off"}</td></tr>
        <tr><th>Enemy</th><td>{one ? "One piece too: its best-scoring action, then that piece's follow-up" : "Every piece may act"}</td></tr>
      </tbody></table>
    </Group>

    <Group id="pieces" title="Pieces">
      {KINDS.map(k => <Entry key={k} name={k} src="moveTargets() · reaches()" note={`dots: moves · red: strike reach · ♥${live.hp[k]} ⚔${live.damage[k]}`} wide><Shape r={live} kind={k} /></Entry>)}
      <Entry name="pawn (patrol)" src="moveTargets() · reaches()" note="patrol pawns go down" wide><Shape r={live} kind="pawn" side="black" /></Entry>
    </Group>

    <Group id="check" title="Check">
      <Entry name="Check" src="kingThreat() · inCheck()" note={one ? "one enemy piece could kill the king next turn" : "the enemy's next turn could kill the king"} wide><Check r={live} /></Entry>
      <Entry name="Can't move into check" src="exposesKing()" wide><NoMoveIntoCheck r={live} /></Entry>
      <table className="spec"><tbody>
        <tr><th>Threat</th><td>{one ? "The hardest single hit from any one enemy piece that can reach the king this turn" : "Every enemy piece that can reach the king this turn hits once; the hits add up"}</td></tr>
        <tr><th>In check</th><td>End turn locked until safe, unless canEscape() finds nothing</td></tr>
        <tr><th>Moves / strikes into check</th><td>Refused (✕, no sword badge)</td></tr>
        <tr><th>Already in check</th><td>Any action allowed; safe by end of turn</td></tr>
        <tr><th>King dies</th><td>Checkmate finale, run over</td></tr>
      </tbody></table>
    </Group>

    <Group id="strike" title="Tap to strike">
      <Entry name="Walk up, then strike" src="approaches() · walkAndStrike()" wide><TapToStrike r={live} /></Entry>
      <table className="spec"><tbody>
        <tr><th>In reach</th><td>Strike in place</td></tr>
        <tr><th>One way in</th><td>Walks and strikes automatically</td></tr>
        <tr><th>Several ways</th><td>Pick the square (sword dots)</td></tr>
        <tr><th>Judged as</th><td>One action: walk may pass danger if the king is safe after the blow</td></tr>
      </tbody></table>
    </Group>

    <Group id="strikeback" title="Ranged strikes and strike back">
      <Entry name="Bishop vs rook" src="attack() · reaches()" note="ranged: no strike back" wide><StrikeBack r={live} foe="rook" /></Entry>
      <Entry name="Bishop vs bishop" src="attack() · reaches()" note="ranged: no strike back, even bishop to bishop" wide><StrikeBack r={live} foe="bishop" /></Entry>
    </Group>

    <Group id="knight" title="Knight leap">
      <table className="spec"><tbody>
        <tr><th>Move</th><td>L-jump, over anything</td></tr><tr><th>Strike</th><td>L-jump away, from its own square</td></tr>
        <tr><th>Jump + strike</th><td>Both in one turn</td></tr><tr><th>Animation</th><td>Front-flip to the target, backflip home (presentation only)</td></tr>
      </tbody></table>
    </Group>

    <Group id="enemy" title="Enemy phase">
      <Entry name="Intent" src="enemyPlan() · intentOf()" note="hover or tap an enemy" wide><Intent r={live} previewed={false} /></Entry>
      <Entry name="Intent after a previewed move" src="enemyPlan()" note="king previewed on a1" wide><Intent r={live} previewed /></Entry>
      <table className="spec"><thead><tr><th>Action</th><th>Score</th></tr></thead><tbody>{enemyScores(live).map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      <p className="fine">enemyTurn(): best score first {one ? "across every piece; once one piece has acted only it may carry on" : "across every piece, repeat until nothing scores above 0 (each piece moves once and strikes once)"}. Deterministic; computed in full before playback.</p>
    </Group>

    <Group id="battles" title="Battles">
      {ENCOUNTERS.map((e, i) => <Entry key={i} name={`Battle ${i + 1}`} src="src/game/levels/levels.json" note={`${e.width}×${e.height} · reward ${e.reward} gold · ${e.starts.length} start square${e.starts.length > 1 ? "s" : ""}`} wide><Encounter r={live} i={i} /></Entry>)}
    </Group>

    <Group id="hideout" title="Hideout">
      <table className="spec"><thead><tr><th>Building</th><th>Offers</th></tr></thead><tbody>
        {PLACES.map(p => <tr key={p.id}><th>{p.name}</th><td>{p.id === "barracks" ? `Recruit pawn ${live.cost.pawn} · bishop ${live.cost.bishop} · rook ${live.cost.rook} · heal king +${live.heal} (max ${live.hp.king}) ${live.cost.heal}` : p.id === "road" ? "Next battle" : <span className="tag">placeholder</span>}</td></tr>)}
      </tbody></table>
      {RECRUITS.map(k => <Entry key={k} name={`Recruit ${k}`} src="buy() · rules.cost" note={`${live.cost[k]} gold · ${live.hp[k]} HP · ${live.damage[k]} dmg`}><div className="promo-row"><div><SpriteStill kind={k} side="white" /></div></div></Entry>)}
      <table className="spec"><tbody>
        <tr><th>Limit</th><td>Army + recruits ≤ next battle's start squares ({ENCOUNTERS.slice(1).map(e => e.starts.length).join(", ")})</td></tr>
        <tr><th>Buys</th><td>As many as gold and room allow</td></tr>
        <tr><th>Recruits join</th><td>When you take the road</td></tr>
        <tr><th>Upgrades, gear, consumables</th><td><span className="tag">not implemented</span></td></tr>
      </tbody></table>
    </Group>

    <Group id="gold" title="Gold">
      <table className="spec"><thead><tr><th>When</th><th>Gold</th><th>Most you can hold</th></tr></thead><tbody>
        <tr><th>Run start</th><td>{live.gold}</td><td>{gold}</td></tr>
        {ENCOUNTERS.map((e, i) => { gold += e.reward; return <tr key={i}><th>Win battle {i + 1}</th><td>+{e.reward}</td><td>{gold}</td></tr>; })}
      </tbody></table>
      <p className="fine">Only source: battle rewards. Only sink: the barracks.</p>
    </Group>

    <Group id="run" title="Run">
      <table className="spec"><tbody>{RUN.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
    </Group>
  </div>;
}
