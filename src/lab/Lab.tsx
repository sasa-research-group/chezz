import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PieceArt } from "../components/PieceArt";
import { MAX_HP, defaultSettings, options, resolve, solveDuel, stateKey } from "./duel";
import type { Choice, Guard, Rule, Settings, Solution, State, Turn } from "./duel";

const LOG_KEY = "chezz.lab.v1";
const LABEL: Record<Choice, string> = { strike: "Strike", guard: "Guard", sidestep: "Sidestep", advance: "Advance" };
const HINT: Record<Choice, string> = {
  strike: "Hit with your current HP as damage.",
  guard: "Stay put and brace. Attackers get hit back.",
  sidestep: "Dodge. Strikes at you miss this turn.",
  advance: "Take a step toward your gate. Reach it to win.",
};
type Entry = { at: string; settings: Settings; turns: { you: Choice; enemy: Choice; text: string[] }[]; result: string; rating?: number; note?: string };

function readLog(): Entry[] { try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); } catch { return []; } }
function saveLog(log: Entry[]) { try { localStorage.setItem(LOG_KEY, JSON.stringify(log)); } catch { /* private mode */ } }
const pick = (mix: number[]) => { let r = Math.random(); for (let i = 0; i < mix.length; i++) if ((r -= mix[i]) < 0) return i; return mix.length - 1; };
const pct = (p: number) => `${Math.round(p * 100)}%`;

export default function Lab() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [solution, setSolution] = useState<Map<string, Solution> | null>(null);
  const [state, setState] = useState<State>({ hp: defaultSettings.hp, progress: [0, 0] });
  const [turns, setTurns] = useState<Entry["turns"]>([]);
  const [last, setLast] = useState<Turn | null>(null);
  const [log, setLog] = useState<Entry[]>(readLog);
  const [rated, setRated] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    setSolution(null);
    // Let "Solving…" paint before the (up to a few seconds) solve.
    const id = setTimeout(() => setSolution(solveDuel(settings)), 30);
    return () => clearTimeout(id);
  }, [settings]);

  const restart = (s = settings) => { setState({ hp: s.hp, progress: [0, 0] }); setTurns([]); setLast(null); setRated(false); setNote(""); };
  const change = (patch: Partial<Settings>) => { const s = { ...settings, ...patch }; setSettings(s); restart(s); };
  const here = solution?.get(stateKey(state));
  const over = last?.winner != null;
  const result = last?.winner === 0 ? "You win" : last?.winner === 1 ? "You lose" : last?.winner === "draw" ? "Draw" : "";

  const play = (you: Choice) => {
    if (!here || over) return;
    const enemy = here.options[1][pick(here.mix[1])];
    const turn = resolve(settings, state, you, enemy);
    const all = [...turns, { you, enemy, text: turn.text }];
    setTurns(all); setLast(turn); setState(turn.state);
    if (turn.winner != null) {
      const entry: Entry = { at: new Date().toISOString(), settings, turns: all, result: turn.winner === 0 ? "win" : turn.winner === 1 ? "loss" : "draw" };
      const next = [...log, entry]; setLog(next); saveLog(next);
    } else if (all.length >= 30) {
      const entry: Entry = { at: new Date().toISOString(), settings, turns: all, result: "stalemate" };
      const next = [...log, entry]; setLog(next); saveLog(next); setLast({ ...turn, winner: "draw" });
    }
  };
  const rate = (rating: number) => {
    const next = log.map((e, i) => (i === log.length - 1 ? { ...e, rating, note: note || undefined } : e));
    setLog(next); saveLog(next); setRated(true);
  };
  const exportLog = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ experiment: "duel", entries: log }, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "chezz-lab-duel.json"; a.click(); URL.revokeObjectURL(url);
  };

  const grid = useMemo(() => {
    if (!solution) return null;
    return Array.from({ length: MAX_HP }, (_, i) => Array.from({ length: MAX_HP }, (_, j) => solution.get(stateKey({ hp: [MAX_HP - i, j + 1], progress: [0, 0] }))!));
  }, [solution]);

  return <main className="lab">
    <header className="lab-header"><div><p className="kicker">CHEZZ LAB · EXPERIMENT 1</p><h1>The Duel</h1>
      <p>One piece against one. Each turn you both pick secretly, then reveal. Change one rule at a time and notice whether a turn feels like reading your opponent or flipping a coin.</p></div>
      <a href="./" className="text-button">← Back to the game</a></header>

    <section className="lab-settings" aria-label="Rules">
      <Field label="Combat rule"><Seg value={settings.rule} set={rule => change({ rule: rule as Rule })} items={[["trade", "Always trade"], ["free", "Free hits"]]} /></Field>
      <Field label="Guard"><Seg value={settings.guard} set={guard => change({ guard: guard as Guard })} items={[["current", "As in game"], ["shield", "Full block"], ["none", "Off"]]} /></Field>
      <Field label="Gate race"><Seg value={String(settings.goal)} set={g => change({ goal: Number(g) })} items={[["0", "Off"], ["2", "2 steps"], ["3", "3 steps"]]} /></Field>
      <Field label="Your HP"><Seg value={String(settings.hp[0])} set={h => change({ hp: [Number(h), settings.hp[1]] })} items={[1, 2, 3, 4, 5].map(n => [String(n), String(n)])} /></Field>
      <Field label="Enemy HP"><Seg value={String(settings.hp[1])} set={h => change({ hp: [settings.hp[0], Number(h)] })} items={[1, 2, 3, 4, 5].map(n => [String(n), String(n)])} /></Field>
      <Field label="Sidestep"><label className="lab-check"><input type="checkbox" checked={settings.canFlee[0]} onChange={e => change({ canFlee: [e.target.checked, settings.canFlee[1]] })} /> You</label>
        <label className="lab-check"><input type="checkbox" checked={settings.canFlee[1]} onChange={e => change({ canFlee: [settings.canFlee[0], e.target.checked] })} /> Enemy</label></Field>
    </section>

    <div className="lab-layout">
      <section className="lab-arena" aria-label="Duel">
        <div className="duelists">
          {([0, 1] as const).map(side => <div key={side} className={`duelist ${side ? "black" : "white"}${last && last.damage[side] > 0 ? " hit" : ""}`}>
            <div className="duelist-art"><PieceArt kind="king" side={side ? "black" : "white"} /></div>
            <strong>{side ? "Enemy" : "You"}</strong>
            <span className="duel-hp" aria-label={`${side ? "Enemy" : "Your"} HP ${state.hp[side]}`}>{"♥".repeat(state.hp[side])}<em>{"♥".repeat(Math.max(0, settings.hp[side] - state.hp[side]))}</em> {state.hp[side]}</span>
            {settings.goal > 0 && <span className="duel-gate" aria-label={`${side ? "Enemy" : "Your"} gate progress ${state.progress[side]} of ${settings.goal}`}>{Array.from({ length: settings.goal }, (_, i) => <i key={i} className={i < state.progress[side] ? "done" : ""} />)} gate</span>}
            {last && <span className="duel-pick">{LABEL[side ? turns.at(-1)!.enemy : turns.at(-1)!.you]}</span>}
          </div>)}
        </div>
        <div className="duel-caption" aria-live="polite">{!solution ? "Solving this rule set…" : last ? last.text.map((t, i) => <p key={i}>{t}</p>) : <p>Pick your move. The enemy picks at the same time.</p>}</div>
        {over ? <div className="duel-over"><h2>{result}</h2>
          {!rated ? <><p>Did that duel feel like reading your opponent, or like flipping a coin?</p>
            <div className="rating" role="group" aria-label="Read or coin flip">{[1, 2, 3, 4, 5].map(n => <button key={n} onClick={() => rate(n)}>{n}</button>)}</div>
            <div className="rating-scale"><span>1 · coin flip</span><span>5 · I read them</span></div>
            <label className="feedback-label">Anything else? (optional)<textarea value={note} onChange={e => setNote(e.target.value)} /></label></>
            : <p>Thanks, saved.</p>}
          <button className="primary-button" onClick={() => restart()}>New duel</button></div>
          : <div className="duel-choices">{options(settings, 0).map(c => <button key={c} disabled={!here} onClick={() => play(c)}><strong>{LABEL[c]}</strong><small>{HINT[c]}</small></button>)}</div>}
        {turns.length > 0 && <ol className="duel-history">{turns.map((t, i) => <li key={i}>You {LABEL[t.you].toLowerCase()}, enemy {LABEL[t.enemy].toLowerCase()}.</li>)}</ol>}
      </section>

      <aside className="lab-side">
        <details className="plan-panel"><summary>Show the math</summary>
          {here && <><p>Best mix for this exact position, if both sides play perfectly. The enemy rolls from its mix each turn.</p>
            <table className="mix"><thead><tr><th /><th>You</th><th>Enemy</th></tr></thead><tbody>
              {here.options[0].map((c, i) => <tr key={c}><td>{LABEL[c]}</td><td>{pct(here.mix[0][i])}</td><td>{here.options[1].includes(c) ? pct(here.mix[1][here.options[1].indexOf(c)]) : "—"}</td></tr>)}
              {here.options[1].filter(c => !here.options[0].includes(c)).map(c => <tr key={c}><td>{LABEL[c]}</td><td>—</td><td>{pct(here.mix[1][here.options[1].indexOf(c)])}</td></tr>)}
            </tbody></table>
            <p>Your chances: {here.value > 0.05 ? "favoured" : here.value < -0.05 ? "unfavoured" : "even"} ({here.value.toFixed(2)} on a −1 to +1 scale).</p></>}
          {grid && <><p><strong>Every starting HP</strong>, gate at 0. Each cell shows your most likely pick. Dark cells mean one move is always right. Light cells mean real guessing.</p>
            <table className="hp-grid"><thead><tr><th>You \ Enemy</th>{grid[0].map((_, j) => <th key={j}>{j + 1}</th>)}</tr></thead><tbody>
              {grid.map((row, i) => <tr key={i}><th>{MAX_HP - i}</th>{row.map((cell, j) => {
                const top = Math.max(...cell.mix[0]), choice = cell.options[0][cell.mix[0].indexOf(top)];
                return <td key={j} className={top > 0.95 ? "pure" : top > 0.7 ? "lean" : "mixed"} title={`value ${cell.value.toFixed(2)}`}>{LABEL[choice]}<small>{pct(top)}</small></td>;
              })}</tr>)}</tbody></table></>}
        </details>
        <div className="plan-panel"><p className="kicker">YOUR LOG</p><p>{log.length} duel{log.length === 1 ? "" : "s"} recorded in this browser.</p>
          <button className="secondary-button" disabled={!log.length} onClick={exportLog}>Export log (JSON)</button>
          <button className="text-button" disabled={!log.length} onClick={() => { if (confirm("Clear the duel log?")) { setLog([]); saveLog([]); } }}>Clear log</button></div>
      </aside>
    </div>
  </main>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <fieldset className="lab-field"><legend>{label}</legend><div>{children}</div></fieldset>;
}
function Seg({ value, set, items }: { value: string; set: (v: string) => void; items: string[][] }) {
  return <>{items.map(([v, text]) => <button key={v} className={v === value ? "on" : ""} aria-pressed={v === value} onClick={() => set(v)}>{text}</button>)}</>;
}
