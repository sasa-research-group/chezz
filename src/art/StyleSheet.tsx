import { useState } from "react";
import { PieceRig } from "../components/PieceRig";
import type { PatrolHue, RigAction, RigKind } from "../components/PieceRig";

const KINDS: { kind: RigKind; name: string; rebel: string; patrol: string }[] = [
  { kind: "king", name: "King", rebel: "Old Aldric. Deposed, paunchy, beard full of crumbs. Crown slipping, robe dragging, sword chipped.", patrol: "The usurper. Waxed moustache, perfect posture, ruby sceptre." },
  { kind: "queen", name: "Queen", rebel: "Margery. Tall, scarred, fed up. Breastplate over her gown and a frying pan she knows how to use.", patrol: "The duchess. Towering powdered hair and a jewelled sceptre." },
  { kind: "rook", name: "Rook", rebel: "Brick. A stonemason the size of a wall, with a tiny tower helmet and a huge mallet.", patrol: "A plated brute with a halberd and a helmet like a keep." },
  { kind: "bishop", name: "Bishop", rebel: "Brother Slant. Gaunt, smug, long nose. Only ever walks diagonally.", patrol: "The inquisitor. Spectacles, a frown and a gilded crook." },
  { kind: "knight", name: "Knight", rebel: "Pip. An eager squire on a hobby horse, bucket helmet over his eyes.", patrol: "A proper little knight on a plated hobby horse, plume and lance." },
  { kind: "pawn", name: "Pawn", rebel: "Village kids with pot helmets and pitchforks. Terrified, then amazed.", patrol: "Guards in crested helmets, moustaches and pikes twice their height." },
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
    <header className="art-header"><div><p className="kicker">CHEZZ · STYLE SHEET</p><h1>The cast</h1>
      <p>A band of misfits against the royal patrol. Each piece is its own character, and every costume echoes its chess shape. Your rebels (left) are patched and scrappy; the patrol (right) wears matching uniforms with gold trim.</p></div></header>
    <section className="art-controls" aria-label="Controls">
      <div><span>Play</span>{ACTIONS.map(a => <button key={a.action} className={action === a.action ? "on" : ""} aria-pressed={action === a.action} onClick={() => play(a.action)}>{a.label}</button>)}</div>
      <div><span>Patrol colour</span>{(["blue", "red"] as const).map(h => <button key={h} className={hue === h ? "on" : ""} aria-pressed={hue === h} onClick={() => setHue(h)}>{h === "blue" ? "Royal blue" : "Red (current)"}</button>)}</div>
      <div><span>State</span><button className={wounded ? "on" : ""} aria-pressed={wounded} onClick={() => setWounded(w => !w)}>Wounded</button></div>
    </section>
    <section className="art-grid">
      {KINDS.map(({ kind, name, rebel, patrol }, i) => <article key={kind} className="art-card">
        <div className="art-pair">
          {(["white", "black"] as const).map((side, j) => <div key={side} className="art-tile">
            <PieceRig key={`${run}-${side}`} kind={kind} side={side} hue={hue} action={action} defending={action === "defend"} facing={side === "white" ? 1 : -1} seed={i * 2 + j} wounded={wounded} />
            <small>{side === "white" ? "Rebel" : "Patrol"}</small>
          </div>)}
        </div>
        <h2>{name}</h2><p><b>Rebel:</b> {rebel}</p><p><b>Patrol:</b> {patrol}</p>
      </article>)}
    </section>
    <section className="art-board" aria-label="On the board">
      <p className="kicker">ON THE BOARD, AT GAME SIZE</p>
      <div className="art-strip">{KINDS.map(({ kind }, i) => <div key={kind} className={`art-sq ${i % 2 ? "grass" : "sand"}`}><PieceRig key={`b${run}-${kind}`} kind={kind} side={i % 2 ? "black" : "white"} hue={hue} action={action} defending={action === "defend"} facing={i % 2 ? -1 : 1} seed={i + 5} wounded={wounded} /></div>)}</div>
    </section>
  </main>;
}
