import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { apply, boardOf, legalMoves, moveName, movesFrom, outcome, pass, pieceAt, same, squareName, start } from "../puzzle/engine";
import type { Move, PKind, Pos, Puzzle, Side, State } from "../puzzle/engine";
import { GOALS, MAX_MOVES, MAX_SIDE, MIN_SIDE, PUZZLES, P_KINDS, formatPuzzles, goalOf, goalSquares, goalText, puzzleIssues, withGoalSquares } from "../puzzle/puzzles";
import { NEVER, analyze, bestReply, solver } from "../puzzle/solve";
import type { Analysis, Solver } from "../puzzle/solve";
import { SpriteStill } from "./kit";
import "./puzzles.css";

const ENDPOINT = "/__studio/puzzles";
type Tool = "piece" | "hole" | "wall" | "goal" | "erase";
const TOOLS: [Tool, string][] = [["piece", "Piece"], ["wall", "Wall"], ["hole", "Hole"], ["goal", "Goal square"], ["erase", "Erase"]];
const BLANK: Puzzle = { width: 5, height: 5, moves: 2, goal: { type: "mate" }, holes: [], walls: [], pieces: [["king", "black", 2, 0], ["king", "white", 2, 4]] };
const copy = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n) || 0));
const nameOf = (pz: Puzzle, i: number) => pz.name || `Puzzle ${i + 1}`;
/** Everything on a square comes off it (pieces, holes, walls, goal marks). */
const clear = (pz: Puzzle, p: Pos): Puzzle => ({ ...pz, holes: pz.holes.filter(q => !same(q, p)), walls: pz.walls.filter(q => !same(q, p)), pieces: pz.pieces.filter(([, , x, y]) => !same({ x, y }, p)), goal: withGoalSquares(pz.goal, goalSquares(pz.goal).filter(q => !same(q, p))) });
const resize = (pz: Puzzle, width: number, height: number): Puzzle => {
  const fits = (p: Pos) => p.x < width && p.y < height;
  return { ...pz, width, height, holes: pz.holes.filter(fits), walls: pz.walls.filter(fits), pieces: pz.pieces.filter(([, , x, y]) => fits({ x, y })), goal: withGoalSquares(pz.goal, goalSquares(pz.goal).filter(fits)) };
};

// Unsaved edits survive a trip to another studio tab; a reload drops them.
let draft: Puzzle[] | null = null;

/** A puzzle's board: holes are gaps in the floor, walls are blocks, goal squares glow. In play the
 * picked piece's moves show as dots and the last move is tinted. */
function PuzzleBoard({ pz, state, picked, targets, last, flags, onSquare }: { pz: Puzzle; state: State; picked: Pos | null; targets: Pos[]; last: Move | null; flags: Pos[]; onSquare: (p: Pos) => void }) {
  const cols = pz.width, rows = pz.height, goals = goalSquares(pz.goal);
  return <div className="board-camera level-board puzzle-board" style={{ "--cols": cols, "--rows": rows } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${cols}/${rows}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const p = { x: i % cols, y: Math.floor(i / cols) };
          const hole = pz.holes.some(q => same(q, p)), wall = pz.walls.some(q => same(q, p)), goal = goals.some(q => same(q, p));
          const pc = pieceAt(state, p);
          const cls = ["exile-cell", (p.x + p.y) % 2 ? "grass" : "sand", hole && "hole", wall && "wall", goal && `goal-${pz.goal.type}`,
            picked && same(picked, p) && "picked", last && (same(last.from, p) || same(last.to, p)) && "last-move", flags.some(q => same(q, p)) && "level-flag"].filter(Boolean).join(" ");
          const what = [hole && "hole", wall && "wall", goal && (pz.goal.type === "escort" ? "exit" : "goal square"), pc && `${pc.side === "white" ? "your" : "enemy"} ${pc.kind}`].filter(Boolean).join(", ") || "empty";
          return <button key={i} type="button" className={cls} aria-label={`${squareName(pz, p)} ${what}`} onClick={() => onSquare(p)}>
            {!hole && <span className="tile-coord">{squareName(pz, p)}</span>}
            {goal && !hole && <span className="goal-mark" aria-hidden="true">{pz.goal.type === "escort" ? "⌂" : "★"}</span>}
            {targets.some(q => same(q, p)) && <span className={pc ? "capture-ring" : "target-dot"} />}
          </button>;
        })}
      </div>
      <div className="piece-layer">{state.pieces.map(pc =>
        <div key={`${pc.side}${pc.kind}${pc.x},${pc.y}`} className={`exile-piece ${pc.side} ${pc.kind === "peasant" ? "peasant" : ""} ${picked && same(picked, pc) ? "selected" : ""}`} style={{ left: `${(pc.x + .5) / cols * 100}%`, top: `${(pc.y + .5) / rows * 100}%`, width: `${92 / cols}%`, zIndex: Math.round(pc.y * 10 + 30) }}>
          <SpriteStill kind={pc.kind === "peasant" ? "pawn" : pc.kind} side={pc.side} className="rig" />
          {pc.kind === "peasant" && <span className="peasant-tag">peasant</span>}
        </div>)}</div>
    </div>
  </div>;
}

/** The solver's verdict on a puzzle: can it be forced, in how many, is the key unique, and the traps. */
function Verdict({ pz, a }: { pz: Puzzle; a: Analysis | null }) {
  if (!a) return <p className="verdict">Fix the problems to check the puzzle.</p>;
  if (!a.ok) return <p className="verdict warn">Too big to check ({a.nodes.toLocaleString()} positions). Shrink the board, the pieces or the move limit.</p>;
  if (a.par === NEVER) return <p className="verdict bad">✗ Not solvable in {pz.moves}: the dungeon always has a defence.</p>;
  const sound = a.keys.length === 1;
  return <div className="verdict">
    <p className={sound ? "good" : "warn"}>{sound ? "✓ Sound" : `⚠ Cooked: ${a.keys.length} first moves win`} · fastest win in {a.par}{a.par < pz.moves ? ` (limit ${pz.moves})` : ""} · {a.nodes.toLocaleString()} positions</p>
    <dl>
      <dt>{sound ? "Key" : "Winning first moves"}</dt><dd>{a.keys.join(", ")}</dd>
      <dt>Main line</dt><dd className="line">{a.line.map((m, i) => <span key={i} className={m.side}>{m.side === "white" ? `${Math.floor(i / 2) + 1}. ` : ""}{m.name}</span>)}</dd>
      <dt>Tries</dt><dd>{a.tries.length ? a.tries.map(t => `${t.move}? ${t.refutation}!`).join(" · ") : "none: no wrong first move has a single refutation"}</dd>
    </dl>
  </div>;
}

type Play = { states: State[]; moves: (Move | null)[]; picked: Pos | null };

/** Studio puzzle designer: paint a board, set the goal and move limit, let the solver prove it, and play it. */
export function Puzzles({ index, onPick }: { index: number; onPick: (i: number) => void }) {
  const [puzzles, setRaw] = useState<Puzzle[]>(() => draft ?? copy(PUZZLES));
  const setPuzzles = (next: Puzzle[]) => { draft = next; setRaw(next); };
  const [saved, setSaved] = useState(() => formatPuzzles(PUZZLES));
  const [tool, setTool] = useState<Tool>("piece");
  const [kind, setKind] = useState<PKind>("pawn");
  const [side, setSide] = useState<Side>("black");
  const [status, setStatus] = useState<string>("");
  const [play, setPlay] = useState<Play | null>(null);
  const past = useRef<Puzzle[][]>([]), future = useRef<Puzzle[][]>([]);
  const sel = Math.min(Math.max(0, index), puzzles.length - 1);
  const pz = puzzles[sel];
  const issues = useMemo(() => puzzleIssues(pz), [pz]);
  const analysis = useMemo(() => (issues.length ? null : analyze(pz, 400_000)), [pz, issues]);
  const text = formatPuzzles(puzzles), dirty = text !== saved;
  const broken = puzzles.some(p => puzzleIssues(p).length);
  useEffect(() => setPlay(null), [sel]);

  const edit = (patch: (p: Puzzle) => Puzzle) => {
    const next = patch(pz);
    if (JSON.stringify(next) === JSON.stringify(pz)) return;
    past.current.push(puzzles); future.current = [];
    setPuzzles(puzzles.map((p, i) => (i === sel ? next : p))); setStatus(""); setPlay(null);
  };
  const undo = () => { const prev = past.current.pop(); if (prev) { future.current.push(puzzles); setPuzzles(prev); } };
  const redo = () => { const next = future.current.pop(); if (next) { past.current.push(puzzles); setPuzzles(next); } };
  const setList = (list: Puzzle[], to: number) => { past.current.push(puzzles); future.current = []; setPuzzles(list); onPick(to); };

  const paint = (p: Pos) => edit(z => {
    const rest = clear(z, p);
    const pc = z.pieces.find(([, , x, y]) => same({ x, y }, p));
    switch (tool) {
      case "erase": return rest;
      case "hole": return z.holes.some(q => same(q, p)) ? rest : { ...rest, holes: [...rest.holes, p] };
      case "wall": return z.walls.some(q => same(q, p)) ? rest : { ...rest, walls: [...rest.walls, p] };
      case "goal": {
        if (z.goal.type !== "escort" && z.goal.type !== "reach") return z;
        const sq = goalSquares(z.goal);
        return { ...z, goal: withGoalSquares(z.goal, sq.some(q => same(q, p)) ? sq.filter(q => !same(q, p)) : [...sq, p]) };
      }
      case "piece": {
        if (pc && pc[0] === kind && pc[1] === side) return rest;
        // One king a side: placing a king moves it.
        const pieces = kind === "king" ? rest.pieces.filter(q => !(q[0] === "king" && q[1] === side)) : rest.pieces;
        return { ...rest, goal: z.goal, pieces: [...pieces, [kind, side, p.x, p.y]] };
      }
    }
  });

  // --- Play: you move, the dungeon answers with its best move. ---
  const sv = useMemo<Solver | null>(() => (play ? solver(pz, 2_000_000) : null), [play !== null, pz]); // eslint-disable-line react-hooks/exhaustive-deps
  const b = useMemo(() => boardOf(pz), [pz]);
  const cur = play ? play.states[play.states.length - 1] : start(pz);
  const result = play ? outcome(pz, b, cur) : null;
  const targets = play?.picked ? movesFrom(pz, b, cur, play.picked).map(m => m.to) : [];
  useEffect(() => {
    if (!play || !sv || result || cur.turn !== "black") return;
    const t = setTimeout(() => {
      let reply: Move | null;
      try { reply = bestReply(sv, cur); } catch { reply = legalMoves(pz, b, cur)[0] ?? null; }
      setPlay(p => p && { ...p, states: [...p.states, reply ? apply(pz, cur, reply) : pass(cur)], moves: [...p.moves, reply] });
    }, 450);
    return () => clearTimeout(t);
  }, [play, sv, cur, result, pz, b]);
  const playSquare = (p: Pos) => {
    if (!play || result || cur.turn !== "white") return;
    const m = play.picked && movesFrom(pz, b, cur, play.picked).find(m => same(m.to, p));
    if (m) { setPlay({ states: [...play.states, apply(pz, cur, m)], moves: [...play.moves, m], picked: null }); return; }
    const pc = pieceAt(cur, p);
    setPlay({ ...play, picked: pc?.side === "white" && !(play.picked && same(play.picked, p)) ? p : null });
  };
  const takeBack = () => play && setPlay(p => {
    if (!p) return p;
    // Back to the last position where it was your move.
    let n = p.states.length - 1;
    do n--; while (n > 0 && p.states[n].turn !== "white");
    return { states: p.states.slice(0, Math.max(1, n + 1)), moves: p.moves.slice(0, Math.max(0, n)), picked: null };
  });
  const lastMove = play?.moves[play.moves.length - 1] ?? null;
  const log = play ? play.moves.map((m, i) => (m ? moveName(pz, play.states[i], m) : "—")) : [];

  async function save() {
    if (broken) return;
    if (!import.meta.env.DEV) {
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const a = document.createElement("a"); a.href = url; a.download = "puzzles.json"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus("Downloaded"); return;
    }
    try {
      const res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", "x-chezz-studio": "save" }, body: JSON.stringify({ version: 1, puzzles }) });
      const body = await res.json() as { ok?: boolean; errors?: string[] };
      if (res.ok && body.ok) { setSaved(text); setStatus("Saved"); } else setStatus(body.errors?.join(" · ") ?? `Error ${res.status}`);
    } catch { setStatus("Save failed"); }
  }

  const g = pz.goal, hasSquares = g.type === "escort" || g.type === "reach";
  return <div className="levels-area puzzles-area">
    <aside className="level-list" aria-label="Puzzles">
      <ol>{puzzles.map((p, i) => <li key={i}>
        <button type="button" aria-current={i === sel ? "true" : undefined} onClick={() => onPick(i)}>
          <b>{nameOf(p, i)}</b><small>{p.width}×{p.height} · {goalText(p.goal, p.moves)}</small>
          {puzzleIssues(p).length > 0 && <i className="level-bad">{puzzleIssues(p).length}</i>}
        </button>
      </li>)}</ol>
      <div className="level-list-tools">
        <button type="button" onClick={() => setList([...puzzles, copy(BLANK)], puzzles.length)}>Add</button>
        <button type="button" onClick={() => setList([...puzzles.slice(0, sel + 1), { ...copy(pz), name: `${nameOf(pz, sel)} copy` }, ...puzzles.slice(sel + 1)], sel + 1)}>Duplicate</button>
        <button type="button" aria-label="Move up" disabled={sel === 0} onClick={() => { const l = [...puzzles]; [l[sel - 1], l[sel]] = [l[sel], l[sel - 1]]; setList(l, sel - 1); }}>↑</button>
        <button type="button" aria-label="Move down" disabled={sel === puzzles.length - 1} onClick={() => { const l = [...puzzles]; [l[sel + 1], l[sel]] = [l[sel], l[sel + 1]]; setList(l, sel + 1); }}>↓</button>
        <button type="button" disabled={puzzles.length < 2} onClick={() => { if (confirm(`Delete ${nameOf(pz, sel)}?`)) setList(puzzles.filter((_, i) => i !== sel), Math.max(0, sel - 1)); }}>Delete</button>
      </div>
    </aside>

    <section className="level-canvas" aria-label="Board">
      <p className="puzzle-goal"><b>{goalText(g, pz.moves)}</b>{play && <> · moves left {Math.max(0, pz.moves - cur.played)}</>}</p>
      {!play ? <>
        <div className="seg level-tools" role="group" aria-label="Tool">{TOOLS.map(([t, label]) => <button key={t} type="button" disabled={t === "goal" && !hasSquares} aria-pressed={tool === t} onClick={() => setTool(t)}>{label}</button>)}</div>
        {tool === "piece" && <div className="seg level-tools" role="group" aria-label="Piece">
          {(["white", "black"] as const).map(s => <button key={s} type="button" aria-pressed={side === s} onClick={() => { setSide(s); if (s === "black" && kind === "peasant") setKind("pawn"); }}>{s === "white" ? "Yours" : "Enemy"}</button>)}
          <span className="seg-gap" />
          {P_KINDS.filter(k => side === "white" || k !== "peasant").map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{k}</button>)}
        </div>}
        {tool === "goal" && <p className="level-hint">Click squares to mark them as {g.type === "escort" ? "exits (the village)" : "squares to reach"}.</p>}
      </> : <div className="puzzle-log" aria-label="Moves">{log.map((m, i) => <span key={i} className={i % 2 ? "black" : "white"}>{i % 2 ? "" : `${i / 2 + 1}. `}{m}</span>)}</div>}

      <PuzzleBoard pz={pz} state={cur} picked={play?.picked ?? null} targets={targets} last={lastMove} flags={issues.flatMap(i => (i.at ? [i.at] : []))} onSquare={play ? playSquare : paint} />
      {play && result && <p className={`puzzle-result ${result}`} role="status">{result === "win" ? "Solved!" : "Failed. Try again."}</p>}
      {play && !result && cur.turn === "black" && <p className="puzzle-result thinking" role="status">The dungeon is thinking…</p>}
      {!play && issues.length > 0 && <ul className="level-issues" aria-label="Problems">{issues.map((i, n) => <li key={n}>{i.message}{i.at && <code>{squareName(pz, i.at)}</code>}</li>)}</ul>}

      <div className="level-actions">
        {play ? <>
          <button type="button" onClick={() => setPlay({ states: [start(pz)], moves: [], picked: null })}>↺ Retry</button>
          <button type="button" disabled={play.states.length < 2} onClick={takeBack}>↶ Take back</button>
          <button type="button" className="level-play" onClick={() => setPlay(null)}>■ Edit</button>
        </> : <>
          <button type="button" aria-label="Undo" disabled={!past.current.length} onClick={undo}>↶ Undo</button>
          <button type="button" aria-label="Redo" disabled={!future.current.length} onClick={redo}>↷ Redo</button>
          <button type="button" className="level-play" disabled={issues.length > 0} onClick={() => setPlay({ states: [start(pz)], moves: [], picked: null })}>▶ Play</button>
          <button type="button" disabled={broken || !dirty} onClick={save}>{import.meta.env.DEV ? "Save" : "Download JSON"}</button>
          <button type="button" disabled={!dirty} onClick={() => { setPuzzles(JSON.parse(saved).puzzles); setStatus(""); }}>Revert</button>
        </>}
        <span className="level-status" role="status">{status || (dirty ? "Unsaved" : "")}</span>
      </div>
    </section>

    <section className="level-controls" aria-label="Puzzle settings">
      <label className="stage-field"><span>Name</span><input value={pz.name ?? ""} placeholder={`Puzzle ${sel + 1}`} maxLength={40} onChange={e => edit(z => { const { name: _, ...rest } = z; return e.target.value ? { ...rest, name: e.target.value } : rest; })} /></label>
      <div className="level-nums">
        <label className="level-num"><span>Width</span><input type="number" min={MIN_SIDE} max={MAX_SIDE} value={pz.width} onChange={e => edit(z => resize(z, clamp(+e.target.value, MIN_SIDE, MAX_SIDE), z.height))} /></label>
        <label className="level-num"><span>Height</span><input type="number" min={MIN_SIDE} max={MAX_SIDE} value={pz.height} onChange={e => edit(z => resize(z, z.width, clamp(+e.target.value, MIN_SIDE, MAX_SIDE)))} /></label>
        <label className="level-num"><span>Moves</span><input type="number" min={1} max={MAX_MOVES} value={pz.moves} onChange={e => edit(z => ({ ...z, moves: clamp(+e.target.value, 1, MAX_MOVES) }))} /></label>
      </div>
      <label className="stage-field"><span>Goal</span>
        <select value={g.type} onChange={e => edit(z => ({ ...z, goal: goalOf(e.target.value as Puzzle["goal"]["type"], z.goal) }))}>{GOALS.map(([t, label]) => <option key={t} value={t}>{label}</option>)}</select>
      </label>
      {g.type === "capture" && <label className="level-num"><span>Pieces to capture</span><input type="number" min={1} max={16} value={g.count} onChange={e => edit(z => ({ ...z, goal: { type: "capture", count: clamp(+e.target.value, 1, 16) } }))} /></label>}
      {g.type === "material" && <label className="level-num"><span>Points (P1 N3 B3 R5 Q9)</span><input type="number" min={1} max={99} value={g.points} onChange={e => edit(z => ({ ...z, goal: { type: "material", points: clamp(+e.target.value, 1, 99) } }))} /></label>}
      {g.type === "reach" && <label className="stage-field"><span>Which piece</span>
        <select value={g.kind ?? ""} onChange={e => edit(z => { const { kind: _, ...rest } = g; return { ...z, goal: e.target.value ? { ...rest, kind: e.target.value as PKind } : rest }; })}>
          <option value="">any of yours</option>{P_KINDS.map(k => <option key={k} value={k}>{k}</option>)}
        </select></label>}
      {hasSquares && <small className="level-note plain">{goalSquares(g).length} {g.type === "escort" ? "exit" : "target"} square{goalSquares(g).length === 1 ? "" : "s"}. Use the Goal square tool.</small>}
      <label className="stage-field"><span>Designer note</span><textarea rows={2} value={pz.note ?? ""} placeholder="The idea, the trick, the try…" onChange={e => edit(z => { const { note: _, ...rest } = z; return e.target.value ? { ...rest, note: e.target.value } : rest; })} /></label>

      <div className="stage-field"><span>Solver</span><Verdict pz={pz} a={analysis} /></div>
      <small className="level-note plain">You move first. The dungeon always plays its best reply: it stops your goal if it can, otherwise holds out longest, then takes the most material. You lose if your king or a peasant is captured, you're mated or stalemated, or you run out of moves. Mating the enemy king always wins. Pawns promote to queens; no castling, double steps or en passant.</small>
    </section>
  </div>;
}
