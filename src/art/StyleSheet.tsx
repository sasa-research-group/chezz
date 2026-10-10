import { useState } from "react";
import { PieceRig } from "../components/PieceRig";
import type { PatrolHue, RigAction, RigKind } from "../components/PieceRig";

const KINDS: { kind: RigKind; name: string; beat: string }[] = [
  { kind: "king", name: "King", beat: "Faded dignity. Crown askew, cape too long." },
  { kind: "queen", name: "Queen", beat: "Clearly in charge. Attacks with a backhand slap." },
  { kind: "rook", name: "Rook", beat: "A walking wall. Defends by shutting a brick door." },
  { kind: "bishop", name: "Bishop", beat: "Smug and pious. Blesses things that don't need it." },
  { kind: "knight", name: "Knight", beat: "An overexcited horse. Big L-shaped hops." },
  { kind: "pawn", name: "Pawn", beat: "Terrified conscript. Eyes dart; amazed when it wins." },
];
const ACTIONS: { action: RigAction; label: string }[] = [
  { action: "idle", label: "Idle" }, { action: "move", label: "Move" }, { action: "attack", label: "Attack" },
  { action: "defend", label: "Defend" }, { action: "hit", label: "Hit" }, { action: "death", label: "Death" },
];

export default function StyleSheet() {
  const [hue, setHue] = useState<PatrolHue>("blue");
  const [action, setAction] = useState<RigAction>("idle");
  const [run, setRun] = useState(0);
  const [wounded, setWounded] = useState(false);
  const play = (a: RigAction) => { setAction(a); setRun(r => r + 1); };
  return <main className="art">
    <header className="art-header"><div><p className="kicker">CHEZZ · STYLE SHEET</p><h1>Rebel puppets</h1>
      <p>Chess tokens that grew faces and stubby arms. Each head is its chess crest. Your rebels (left) wear ochre and teal with patches and tilted crests; the royal patrol (right) stands upright with a stripe and a plume.</p></div></header>
    <section className="art-controls" aria-label="Controls">
      <div><span>Play</span>{ACTIONS.map(a => <button key={a.action} className={action === a.action ? "on" : ""} aria-pressed={action === a.action} onClick={() => play(a.action)}>{a.label}</button>)}</div>
      <div><span>Patrol colour</span>{(["blue", "red"] as const).map(h => <button key={h} className={hue === h ? "on" : ""} aria-pressed={hue === h} onClick={() => setHue(h)}>{h === "blue" ? "Royal blue" : "Red (current)"}</button>)}</div>
      <div><span>State</span><button className={wounded ? "on" : ""} aria-pressed={wounded} onClick={() => setWounded(w => !w)}>Wounded</button></div>
    </section>
    <section className="art-grid">
      {KINDS.map(({ kind, name, beat }, i) => <article key={kind} className="art-card">
        <div className="art-pair">
          {(["white", "black"] as const).map((side, j) => <div key={side} className="art-tile">
            <PieceRig key={`${run}-${side}`} kind={kind} side={side} hue={hue} action={action} defending={action === "defend"} facing={side === "white" ? 1 : -1} seed={i * 2 + j} wounded={wounded} />
            <small>{side === "white" ? "Rebel" : "Patrol"}</small>
          </div>)}
        </div>
        <h2>{name}</h2><p>{beat}</p>
      </article>)}
    </section>
    <section className="art-board" aria-label="On the board">
      <p className="kicker">ON THE BOARD, AT GAME SIZE</p>
      <div className="art-strip">{KINDS.map(({ kind }, i) => <div key={kind} className={`art-sq ${i % 2 ? "grass" : "sand"}`}><PieceRig key={`b${run}-${kind}`} kind={kind} side={i % 2 ? "black" : "white"} hue={hue} action={action} defending={action === "defend"} facing={i % 2 ? -1 : 1} seed={i + 5} wounded={wounded} /></div>)}</div>
    </section>
  </main>;
}
