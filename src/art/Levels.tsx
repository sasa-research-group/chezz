import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { ENCOUNTERS, spawnHp } from "../game/turns";
import type { Kind, Placed, Pos, Rules } from "../game/turns";
import { KINDS, MAX_REWARD, MAX_SIDE, MIN_SIDE, formatLevels, isError, listIssues, testArmyOf, typicalArmy } from "../game/levels";
import type { Issue, Level } from "../game/levels";
import { SpriteStill } from "./kit";
import { draftRules } from "./rulesDraft";

const TestRun = lazy(() => import("./TestRun"));
const LEVELS_ENDPOINT = "/__studio/levels";

type Tool = "wall" | "enemy" | "army" | "erase";
const TOOLS: [Tool, string][] = [["wall", "Wall"], ["enemy", "Enemy"], ["army", "Army"], ["erase", "Erase"]];
const BLANK: Level = { reward: 0, width: 6, height: 6, walls: [], spawns: [["pawn", 2, 1]], starts: [{ x: 2, y: 5 }] };

const same = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;
const sq = (l: Level, p: Pos) => `${"abcdefgh"[p.x] ?? "?"}${l.height - p.y}`;
const copy = (l: Level): Level => JSON.parse(JSON.stringify(l));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || 0));
const without = (l: Level, p: Pos): Level => ({ ...l, walls: l.walls.filter(w => !same(w, p)), spawns: l.spawns.filter(([, x, y]) => !same({ x, y }, p)), starts: l.starts.filter(s => !same(s, p)) });
const levelName = (l: Level, i: number) => l.name || `Battle ${i + 1}`;
/** Shrinking the board drops whatever falls outside it. */
const resize = (l: Level, width: number, height: number): Level => {
  const fits = (p: Pos) => p.x < width && p.y < height;
  return { ...l, width, height, walls: l.walls.filter(fits), spawns: l.spawns.filter(([, x, y]) => fits({ x, y })), starts: l.starts.filter(fits) };
};
/** A test army only stands on start squares: a removed start takes its piece with it. Kept in start order so saves diff cleanly. */
const prune = (l: Level): Level => {
  if (!l.testArmy) return l;
  const order = (p: Pos) => l.starts.findIndex(s => same(s, p));
  return { ...l, testArmy: l.testArmy.filter(p => order(p) >= 0).sort((a, b) => order(a) - order(b)) };
};
const armyLabel = (army: Placed[]) => army.map(p => p.kind).join(" · ") || "none";

/** Unsaved edits, each level's undo history and the ids that tie a history to its level outlive a
 * trip to another studio tab (the tab unmounts); a reload drops them, and so does Save for the history. */
type Draft = { levels: Level[]; ids: number[] };
let draft: Draft | null = null;
let lastId = 0;
const freshIds = (n: number) => Array.from({ length: n }, () => ++lastId);
type History = { past: Level[]; future: Level[] };
const histories = new Map<number, History>();
const historyOf = (id: number) => histories.get(id) ?? histories.set(id, { past: [], future: [] }).get(id)!;

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <label className="level-num"><span>{label}</span>
    <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />
  </label>;
}

/** The board as the game draws it (tilted plane, painted stills), with each square a button for the current tool. */
function LevelBoard({ level, rules, army, issues, picked, onSquare }: { level: Level; rules: Rules; army: Placed[]; issues: Issue[]; picked: Pos | null; onSquare: (p: Pos) => void }) {
  const { width: w, height: h } = level;
  const cols = clamp(w, 1, MAX_SIDE), rows = clamp(h, 1, MAX_SIDE);
  const flag = (p: Pos) => {
    const here = issues.filter(i => i.at && same(i.at, p));
    return here.some(isError) ? "level-flag" : here.length ? "level-flag warn" : "";
  };
  const pieces = [
    ...level.spawns.map(s => ({ kind: s[0], side: "black" as const, x: s[1], y: s[2], hp: spawnHp(rules, s), max: rules.hp[s[0]] })),
    ...army.map(p => ({ kind: p.kind, side: "white" as const, x: p.x, y: p.y, hp: rules.hp[p.kind], max: rules.hp[p.kind] })),
  ].filter(p => p.x < cols && p.y < rows && p.x >= 0 && p.y >= 0);
  return <div className="board-camera level-board" style={{ "--cols": cols, "--rows": rows } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${cols}/${rows}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const p = { x: i % cols, y: Math.floor(i / cols) };
          const wall = level.walls.some(v => same(v, p)), start = level.starts.findIndex(s => same(s, p));
          const spawn = level.spawns.find(([, x, y]) => same({ x, y }, p)), unit = army.find(a => same(a, p));
          const what = [wall && "wall", spawn && `enemy ${spawn[0]} ${spawnHp(rules, spawn)} HP`, start >= 0 && `start ${start + 1} ${unit ? `with ${unit.kind}` : "empty"}`].filter(Boolean).join(", ") || "empty";
          return <button key={i} type="button" className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${wall ? "wall" : ""} ${flag(p)} ${picked && same(picked, p) ? "picked" : ""}`}
            aria-label={`${sq(level, p)} ${what}`} aria-pressed={picked ? same(picked, p) : undefined} onClick={() => onSquare(p)}>
            <span className="tile-coord">{sq(level, p)}</span>
            {start >= 0 && <span className={`start-mark ${start === 0 ? "king" : ""}`}>{start + 1}</span>}
          </button>;
        })}
      </div>
      <div className="piece-layer">{pieces.map((p, i) =>
        <div key={i} className={`exile-piece ${p.side}`} style={{ left: `${(p.x + .5) / cols * 100}%`, top: `${(p.y + .5) / rows * 100}%`, width: `${92 / cols}%`, zIndex: Math.round(p.y * 10 + 30) }}>
          <SpriteStill kind={p.kind} side={p.side} className="rig" />
          <span className="piece-health">{p.hp}<small> / {p.max}</small></span>
        </div>)}</div>
    </div>
  </div>;
}

/** A level's badge in the list: red with its error count, or amber with its warning count when it only has warnings. */
function IssueCount({ issues }: { issues: Issue[] }) {
  const errors = issues.filter(isError).length, warnings = issues.length - errors;
  if (errors) return <i className="level-bad" aria-label={`${errors} problems`}>{errors}</i>;
  return warnings ? <i className="level-bad warn" aria-label={`${warnings} warnings`}>{warnings}</i> : null;
}
function IssueList({ level, issues, label }: { level: Level; issues: Issue[]; label: "Problems" | "Warnings" }) {
  if (!issues.length) return null;
  return <ul className={`level-issues ${label === "Warnings" ? "warn" : ""}`} aria-label={label}>{issues.map((i, n) => <li key={n}>{i.message}{i.at && <code>{sq(level, i.at)}</code>}</li>)}</ul>;
}

/** Studio level designer: pick a level on the left, paint it on the board, set its numbers on the right,
 * play it on its own, and save the whole list back to `src/game/levels/levels.json`. */
export function Levels({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const [state, setStateRaw] = useState<Draft>(() => draft ?? { levels: ENCOUNTERS.map(copy), ids: freshIds(ENCOUNTERS.length) });
  const setState = (next: Draft) => { draft = next; setStateRaw(next); };
  const { levels, ids } = state;
  const [saved, setSaved] = useState(() => formatLevels(ENCOUNTERS));
  const [tool, setTool] = useState<Tool>("wall");
  const [enemy, setEnemy] = useState<Kind>("pawn");
  const [picked, setPicked] = useState<Pos | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const sel = Math.min(Math.max(0, index), levels.length - 1);
  const level = levels[sel], history = historyOf(ids[sel]);
  const rules = draftRules();
  const issues = useMemo(() => listIssues(levels, rules), [levels, rules]);
  const army = testArmyOf(levels, sel, rules);
  const text = formatLevels(levels);
  const dirty = text !== saved;
  const broken = issues.some(i => i.some(isError));
  const pick = tool === "army" && picked && level.starts.some(s => same(s, picked)) ? picked : null;
  useEffect(() => setPicked(null), [sel]);

  const replace = (next: Level) => { setState({ levels: levels.map((l, i) => (i === sel ? next : l)), ids }); setStatus(null); };
  /** Every change to the selected level goes through here, so each one can be undone. */
  const edit = (patch: (l: Level) => Level) => {
    const next = prune(patch(level));
    if (JSON.stringify(next) === JSON.stringify(level)) return;
    history.past.push(level); history.future = [];
    replace(next);
  };
  const undo = () => { const prev = history.past.pop(); if (!prev) return; history.future.push(level); replace(prev); };
  const redo = () => { const next = history.future.pop(); if (!next) return; history.past.push(level); replace(next); };
  const keys = useRef({ undo, redo, off: false });
  keys.current = { undo, redo, off: playing !== null };
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.metaKey || ev.ctrlKey) || ev.altKey || keys.current.off) return;
      const k = ev.key.toLowerCase();
      if (k !== "z" && k !== "y") return;
      ev.preventDefault();
      if (k === "y" || ev.shiftKey) keys.current.redo(); else keys.current.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setList = (ls: Level[], nextIds: number[], to: number) => { setState({ levels: ls, ids: nextIds }); onPick(to); setStatus(null); };
  const move = (by: -1 | 1) => {
    const ls = [...levels], is = [...ids], to = sel + by;
    [ls[sel], ls[to]] = [ls[to], ls[sel]]; [is[sel], is[to]] = [is[to], is[sel]];
    setList(ls, is, to);
  };

  const square = (p: Pos) => {
    if (tool === "army") {
      if (!level.starts.some(s => same(s, p))) edit(l => { const rest = without(l, p); return { ...rest, starts: [...rest.starts, p] }; });
      setPicked(p);
      return;
    }
    edit(l => {
      const rest = without(l, p);
      if (tool === "erase") return rest;
      if (tool === "wall") return l.walls.some(w => same(w, p)) ? rest : { ...rest, walls: [...rest.walls, p] };
      const here = l.spawns.find(([, x, y]) => same({ x, y }, p));
      return here?.[0] === enemy ? rest : { ...rest, spawns: [...rest.spawns, [enemy, p.x, p.y]] };
    });
  };
  const setArmy = (next: Placed[] | undefined) => edit(l => { const { testArmy: _, ...rest } = l; return next ? { ...rest, testArmy: next } : rest; });
  /** Puts `kind` on start `p`, or clears it. There's one king: placing him elsewhere moves him. */
  const setUnit = (p: Pos, kind: Kind | null) => setArmy([...army.filter(a => !same(a, p) && !(kind === "king" && a.kind === "king")), ...(kind ? [{ kind, x: p.x, y: p.y }] : [])]);
  const removeStart = (p: Pos) => edit(l => ({ ...l, starts: l.starts.filter(s => !same(s, p)) }));

  async function save() {
    if (broken) return;
    if (!import.meta.env.DEV) {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "levels.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus({ ok: true, text: "Downloaded" });
      return;
    }
    try {
      const res = await fetch(LEVELS_ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "x-chezz-studio": "save" }, body: JSON.stringify({ version: 1, levels }) });
      const body = await res.json() as { ok?: boolean; errors?: string[] };
      if (res.ok && body.ok) { histories.clear(); setSaved(text); setStatus({ ok: true, text: "Saved" }); }
      else setStatus({ ok: false, text: body.errors?.join(" · ") ?? `Error ${res.status}` });
    } catch { setStatus({ ok: false, text: "Save failed" }); }
  }

  const mine = issues[sel], errors = mine.filter(isError), warnings = mine.filter(i => !isError(i));
  const typical = typicalArmy(levels, sel, rules);
  const minimum = level.starts.length ? [{ kind: "king" as const, x: level.starts[0].x, y: level.starts[0].y }] : [];
  const unitAt = (p: Pos) => army.find(a => same(a, p))?.kind ?? null;
  return <div className="levels-area">
    <aside className="level-list" aria-label="Levels">
      <ol>{levels.map((l, i) => <li key={ids[i]}>
        <button type="button" aria-current={i === sel ? "true" : undefined} onClick={() => onPick(i)}>
          <b>{levelName(l, i)}</b><small>{l.width}×{l.height} · {l.spawns.length}♟ · {l.starts.length}⚑</small>
          <IssueCount issues={issues[i]} />
        </button>
      </li>)}</ol>
      <div className="level-list-tools">
        <button type="button" onClick={() => setList([...levels, copy(BLANK)], [...ids, ...freshIds(1)], levels.length)}>Add</button>
        <button type="button" onClick={() => setList([...levels.slice(0, sel + 1), { ...copy(level), name: level.name ? `${level.name} copy` : undefined }, ...levels.slice(sel + 1)], [...ids.slice(0, sel + 1), ...freshIds(1), ...ids.slice(sel + 1)], sel + 1)}>Duplicate</button>
        <button type="button" aria-label="Move up" disabled={sel === 0} onClick={() => move(-1)}>↑</button>
        <button type="button" aria-label="Move down" disabled={sel === levels.length - 1} onClick={() => move(1)}>↓</button>
        <button type="button" disabled={levels.length < 2} onClick={() => { if (confirm(`Delete ${levelName(level, sel)}?`)) setList(levels.filter((_, i) => i !== sel), ids.filter((_, i) => i !== sel), Math.max(0, sel - 1)); }}>Delete</button>
      </div>
    </aside>

    <section className="level-canvas" aria-label="Board">
      <div className="seg level-tools" role="group" aria-label="Tool">
        {TOOLS.map(([t, label]) => <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)}>{label}</button>)}
      </div>
      {tool === "enemy" && <div className="seg level-tools" role="group" aria-label="Enemy piece">
        {KINDS.map(k => <button key={k} type="button" aria-pressed={enemy === k} onClick={() => setEnemy(k)}>{k}</button>)}
      </div>}
      {tool === "army" && (pick
        ? <div className="level-tools unit-picker" role="group" aria-label={`Unit on ${sq(level, pick)}`}>
          <b>{sq(level, pick)}</b>
          <div className="seg">{KINDS.map(k => <button key={k} type="button" aria-pressed={unitAt(pick) === k} onClick={() => setUnit(pick, k)}>{k}</button>)}
            <button type="button" aria-pressed={!unitAt(pick)} onClick={() => setUnit(pick, null)}>None</button></div>
          <button type="button" className="unit-picker-remove" onClick={() => { removeStart(pick); setPicked(null); }}>Remove start</button>
        </div>
        : <p className="level-hint">Click a square to make it a start; click a start to choose its unit.</p>)}
      <LevelBoard level={level} rules={rules} army={army} issues={mine} picked={pick} onSquare={square} />
      <IssueList level={level} issues={errors} label="Problems" />
      <IssueList level={level} issues={warnings} label="Warnings" />
      <div className="level-actions">
        <button type="button" aria-label="Undo" title="Undo (Ctrl/⌘ Z)" disabled={!history.past.length} onClick={undo}>↶ Undo</button>
        <button type="button" aria-label="Redo" title="Redo (Shift Ctrl/⌘ Z)" disabled={!history.future.length} onClick={redo}>↷ Redo</button>
        <button type="button" className="level-play" disabled={errors.length > 0} onClick={() => setPlaying(sel)}>▶ Play</button>
        <button type="button" disabled={broken || !dirty} onClick={save}>{import.meta.env.DEV ? "Save" : "Download JSON"}</button>
        <button type="button" disabled={!dirty} onClick={() => { histories.clear(); setState({ levels: JSON.parse(saved).levels, ids: freshIds(JSON.parse(saved).levels.length) }); setStatus(null); }}>Revert</button>
        <span className={`level-status ${status && !status.ok ? "bad" : ""}`} role="status">{status?.text ?? (dirty ? "Unsaved" : "")}</span>
      </div>
    </section>

    <section className="level-controls" aria-label="Level settings">
      <label className="stage-field"><span>Name</span><input value={level.name ?? ""} placeholder={`Battle ${sel + 1}`} maxLength={40} onChange={e => edit(l => { const { name: _, ...rest } = l; return e.target.value ? { ...rest, name: e.target.value } : rest; })} /></label>
      <div className="level-nums">
        <NumberField label="Width" value={level.width} min={MIN_SIDE} max={MAX_SIDE} onChange={n => edit(l => resize(l, clamp(n, 1, 9), l.height))} />
        <NumberField label="Height" value={level.height} min={MIN_SIDE} max={MAX_SIDE} onChange={n => edit(l => resize(l, l.width, clamp(n, 1, 9)))} />
        <NumberField label="Reward ✦" value={level.reward} min={0} max={MAX_REWARD} onChange={n => edit(l => ({ ...l, reward: clamp(n, -1, MAX_REWARD + 1) }))} />
      </div>

      <div className="stage-field"><span>Enemies</span>
        <ul className="level-rows">{level.spawns.map(([kind, x, y, hp], i) => <li key={i}>
          <SpriteStill kind={kind} side="black" /><b>{kind}</b><code>{sq(level, { x, y })}</code>
          <label><span className="sr-only">{kind} {sq(level, { x, y })} HP</span>♥<input type="number" min={1} max={rules.hp[kind]} value={hp ?? ""} placeholder={`${rules.hp[kind]}`} title="Empty: full HP" onChange={e => edit(l => ({ ...l, spawns: l.spawns.map((s, j) => (j !== i ? s : e.target.value === "" ? [s[0], s[1], s[2]] : [s[0], s[1], s[2], clamp(Number(e.target.value), 0, 99)])) }))} /></label>
          <button type="button" aria-label={`Remove ${kind} ${sq(level, { x, y })}`} onClick={() => edit(l => ({ ...l, spawns: l.spawns.filter((_, j) => j !== i) }))}>×</button>
        </li>)}</ul>
      </div>

      <div className="stage-field"><span>Army</span>
        <div className="seg" role="group" aria-label="Army preset">
          <button type="button" disabled={!minimum.length} aria-pressed={JSON.stringify(level.testArmy) === JSON.stringify(minimum)} onClick={() => setArmy(minimum)}>Minimum</button>
          <button type="button" aria-pressed={!level.testArmy} onClick={() => setArmy(undefined)}>Typical</button>
        </div>
        <ol className="level-army">{level.starts.map((s, i) => <li key={`${s.x},${s.y}`}>
          <span className={`start-mark ${i === 0 ? "king" : ""}`}>{i + 1}</span><code>{sq(level, s)}</code>
          <select aria-label={`Army ${sq(level, s)}`} value={unitAt(s) ?? ""} onChange={e => setUnit(s, (e.target.value || null) as Kind | null)}>
            {KINDS.map(k => <option key={k} value={k}>{k}</option>)}<option value="">none</option>
          </select>
          <button type="button" aria-label={`Remove start ${sq(level, s)}`} onClick={() => removeStart(s)}>×</button>
        </li>)}</ol>
        <small className="level-note">Typical: {typical.join(" · ")}</small>
        <small className="level-note plain">Numbers are the order a real run's army fills the starts, king first. The test army stands where you put it.</small>
      </div>
    </section>
    {playing !== null && <Suspense fallback={null}>
      <TestRun test={{ level: levels[playing], army: testArmyOf(levels, playing, rules), index: playing, battles: levels.length, rules }} title={levelName(levels[playing], playing)} armyText={armyLabel(testArmyOf(levels, playing, rules))} onStop={() => setPlaying(null)} />
    </Suspense>}
  </div>;
}
