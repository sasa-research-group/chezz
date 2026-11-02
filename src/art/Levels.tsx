import { Suspense, lazy, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { ENCOUNTERS, HP } from "../game/turns";
import type { Kind, Pos } from "../game/turns";
import { KINDS, MAX_REWARD, MAX_SIDE, MIN_SIDE, formatLevels, listIssues, testArmyOf, typicalArmy } from "../game/levels";
import type { Issue, Level } from "../game/levels";
import { SpriteStill } from "./kit";

const TestRun = lazy(() => import("./TestRun"));
const LEVELS_ENDPOINT = "/__studio/levels";

type Tool = "wall" | "enemy" | "start" | "erase";
const TOOLS: [Tool, string][] = [["wall", "Wall"], ["enemy", "Enemy"], ["start", "Start"], ["erase", "Erase"]];
const ARMY_KINDS = KINDS.filter(k => k !== "king");
const BLANK: Level = { reward: 0, width: 6, height: 6, walls: [], spawns: [["pawn", 2, 1, 1]], starts: [{ x: 2, y: 5 }] };

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
/** Unsaved edits outlive a trip to another studio tab (the tab unmounts); a reload drops them. */
let draft: Level[] | null = null;

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (n: number) => void }) {
  return <label className="level-num"><span>{label}</span>
    <input type="number" inputMode="numeric" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />
  </label>;
}

/** The board as the game draws it (tilted plane, painted stills), with each square a button for the current tool. */
function LevelBoard({ level, army, issues, onSquare }: { level: Level; army: Kind[]; issues: Issue[]; onSquare: (p: Pos) => void }) {
  const { width: w, height: h } = level;
  const cols = clamp(w, 1, MAX_SIDE), rows = clamp(h, 1, MAX_SIDE);
  const flagged = (p: Pos) => issues.some(i => i.at && same(i.at, p));
  const pieces = [
    ...level.spawns.map(([kind, x, y, hp]) => ({ kind, side: "black" as const, x, y, hp, max: HP[kind] })),
    ...level.starts.flatMap((s, i) => army[i] ? [{ kind: army[i], side: "white" as const, x: s.x, y: s.y, hp: HP[army[i]], max: HP[army[i]] }] : []),
  ].filter(p => p.x < cols && p.y < rows && p.x >= 0 && p.y >= 0);
  return <div className="board-camera level-board" style={{ "--cols": cols, "--rows": rows } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${cols}/${rows}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const p = { x: i % cols, y: Math.floor(i / cols) };
          const wall = level.walls.some(v => same(v, p)), start = level.starts.findIndex(s => same(s, p));
          const spawn = level.spawns.find(([, x, y]) => same({ x, y }, p));
          const what = [wall && "wall", spawn && `enemy ${spawn[0]} ${spawn[3]} HP`, start >= 0 && (start === 0 ? "king start" : `start ${start + 1}`)].filter(Boolean).join(", ") || "empty";
          return <button key={i} type="button" className={`exile-cell ${(p.x + p.y) % 2 ? "grass" : "sand"} ${wall ? "wall" : ""} ${flagged(p) ? "level-flag" : ""}`}
            aria-label={`${sq(level, p)} ${what}`} onClick={() => onSquare(p)}>
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

/** Studio level designer: pick a level on the left, paint it on the board, set its numbers on the right,
 * play it on its own, and save the whole list back to `src/game/levels/levels.json`. */
export function Levels({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const [levels, setLevelsState] = useState<Level[]>(() => draft ?? ENCOUNTERS.map(copy));
  const setLevels = (next: Level[] | ((ls: Level[]) => Level[])) => setLevelsState(ls => (draft = typeof next === "function" ? next(ls) : next));
  const [saved, setSaved] = useState(() => formatLevels(ENCOUNTERS));
  const [tool, setTool] = useState<Tool>("wall");
  const [enemy, setEnemy] = useState<Kind>("pawn");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const sel = Math.min(Math.max(0, index), levels.length - 1);
  const level = levels[sel];
  const issues = useMemo(() => listIssues(levels), [levels]);
  const army = testArmyOf(levels, sel);
  const text = formatLevels(levels);
  const dirty = text !== saved;
  const broken = issues.some(i => i.length);

  const edit = (patch: (l: Level) => Level) => { setLevels(ls => ls.map((l, i) => (i === sel ? patch(l) : l))); setStatus(null); };
  const setList = (ls: Level[], pick: number) => { setLevels(ls); onPick(pick); setStatus(null); };
  const move = (by: -1 | 1) => { const ls = [...levels], to = sel + by; [ls[sel], ls[to]] = [ls[to], ls[sel]]; setList(ls, to); };

  const square = (p: Pos) => edit(l => {
    const rest = without(l, p);
    if (tool === "erase") return rest;
    if (tool === "wall") return l.walls.some(w => same(w, p)) ? rest : { ...rest, walls: [...rest.walls, p] };
    if (tool === "start") {
      // Toggling an existing start keeps the others in order; a new one goes last.
      const at = l.starts.findIndex(s => same(s, p));
      return at >= 0 ? { ...l, starts: l.starts.filter((_, i) => i !== at) } : { ...rest, starts: [...rest.starts, p] };
    }
    const here = l.spawns.find(([, x, y]) => same({ x, y }, p));
    return here?.[0] === enemy ? rest : { ...rest, spawns: [...rest.spawns, [enemy, p.x, p.y, HP[enemy]]] };
  });
  const setArmy = (next: Kind[] | undefined) => edit(l => { const { testArmy: _, ...rest } = l; return next ? { ...rest, testArmy: next } : rest; });

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
      if (res.ok && body.ok) { setSaved(text); setStatus({ ok: true, text: "Saved" }); }
      else setStatus({ ok: false, text: body.errors?.join(" · ") ?? `Error ${res.status}` });
    } catch { setStatus({ ok: false, text: "Save failed" }); }
  }

  const mine = issues[sel];
  const typical = typicalArmy(levels, sel);
  return <div className="levels-area">
    <aside className="level-list" aria-label="Levels">
      <ol>{levels.map((l, i) => <li key={i}>
        <button type="button" aria-current={i === sel ? "true" : undefined} onClick={() => onPick(i)}>
          <b>{levelName(l, i)}</b><small>{l.width}×{l.height} · {l.spawns.length}♟ · {l.starts.length}⚑</small>
          {issues[i].length > 0 && <i className="level-bad" aria-label={`${issues[i].length} problems`}>{issues[i].length}</i>}
        </button>
      </li>)}</ol>
      <div className="level-list-tools">
        <button type="button" onClick={() => setList([...levels, copy(BLANK)], levels.length)}>Add</button>
        <button type="button" onClick={() => setList([...levels.slice(0, sel + 1), { ...copy(level), name: level.name ? `${level.name} copy` : undefined }, ...levels.slice(sel + 1)], sel + 1)}>Duplicate</button>
        <button type="button" aria-label="Move up" disabled={sel === 0} onClick={() => move(-1)}>↑</button>
        <button type="button" aria-label="Move down" disabled={sel === levels.length - 1} onClick={() => move(1)}>↓</button>
        <button type="button" disabled={levels.length < 2} onClick={() => { if (confirm(`Delete ${levelName(level, sel)}?`)) setList(levels.filter((_, i) => i !== sel), Math.max(0, sel - 1)); }}>Delete</button>
      </div>
    </aside>

    <section className="level-canvas" aria-label="Board">
      <div className="seg level-tools" role="group" aria-label="Tool">
        {TOOLS.map(([t, label]) => <button key={t} type="button" aria-pressed={tool === t} onClick={() => setTool(t)}>{label}</button>)}
      </div>
      {tool === "enemy" && <div className="seg level-tools" role="group" aria-label="Enemy piece">
        {KINDS.map(k => <button key={k} type="button" aria-pressed={enemy === k} onClick={() => setEnemy(k)}>{k}</button>)}
      </div>}
      <LevelBoard level={level} army={army} issues={mine} onSquare={square} />
      {mine.length > 0 && <ul className="level-issues" aria-label="Problems">{mine.map((i, n) => <li key={n}>{i.message}{i.at && <code>{sq(level, i.at)}</code>}</li>)}</ul>}
      <div className="level-actions">
        <button type="button" className="level-play" disabled={mine.length > 0} onClick={() => setPlaying(sel)}>▶ Play</button>
        <button type="button" disabled={broken || !dirty} onClick={save}>{import.meta.env.DEV ? "Save" : "Download JSON"}</button>
        <button type="button" disabled={!dirty} onClick={() => { setLevels(JSON.parse(saved).levels); setStatus(null); }}>Revert</button>
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
          <label><span className="sr-only">{kind} {sq(level, { x, y })} HP</span>♥<input type="number" min={1} max={HP[kind]} value={hp} onChange={e => edit(l => ({ ...l, spawns: l.spawns.map((s, j) => (j === i ? [s[0], s[1], s[2], clamp(Number(e.target.value), 0, 99)] : s)) }))} /></label>
          <button type="button" aria-label={`Remove ${kind} ${sq(level, { x, y })}`} onClick={() => edit(l => ({ ...l, spawns: l.spawns.filter((_, j) => j !== i) }))}>×</button>
        </li>)}</ul>
      </div>

      <div className="stage-field"><span>Starts</span>
        <ol className="level-chips">{level.starts.map((s, i) => <li key={i}><span className={`start-mark ${i === 0 ? "king" : ""}`}>{i + 1}</span>{sq(level, s)}
          <button type="button" aria-label={`Remove start ${i + 1}`} onClick={() => edit(l => ({ ...l, starts: l.starts.filter((_, j) => j !== i) }))}>×</button></li>)}</ol>
      </div>

      <div className="stage-field"><span>Test army</span>
        <div className="seg" role="group" aria-label="Army preset">
          <button type="button" aria-pressed={level.testArmy?.length === 1} onClick={() => setArmy(["king"])}>Minimum</button>
          <button type="button" aria-pressed={!level.testArmy} onClick={() => setArmy(undefined)}>Typical</button>
        </div>
        <ol className="level-army">{army.map((k, i) => <li key={i}>
          <span className={`start-mark ${i === 0 ? "king" : ""}`}>{i + 1}</span>
          {i === 0 ? <b>king</b> : <select aria-label={`Army ${i + 1}`} value={k} onChange={e => setArmy(army.map((a, j) => (j === i ? e.target.value as Kind : a)))}>{ARMY_KINDS.map(a => <option key={a}>{a}</option>)}</select>}
          {i > 0 && <button type="button" aria-label={`Remove army ${i + 1}`} onClick={() => setArmy(army.filter((_, j) => j !== i))}>×</button>}
        </li>)}</ol>
        <button type="button" disabled={army.length >= level.starts.length} onClick={() => setArmy([...army, "pawn"])}>+ Piece</button>
        <small className="level-note">Typical: {typical.join(" · ")}</small>
      </div>
    </section>
    {playing !== null && <Suspense fallback={null}>
      <TestRun test={{ level: levels[playing], army: testArmyOf(levels, playing), index: playing, battles: levels.length }} title={levelName(levels[playing], playing)} onStop={() => setPlaying(null)} />
    </Suspense>}
  </div>;
}
