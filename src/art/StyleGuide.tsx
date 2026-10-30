import { BLUSH, GOLD, GOLD_SH, INK, PATROL, PieceRig, REBEL, RIG_MS, SKIN, SKIN_SH, STEEL, STEEL_SH, WOOD, WOOD_SH } from "../components/PieceRig";
import type { Palette, RigAction } from "../components/PieceRig";
import exileCss from "../exile.css?raw";
import rigCss from "../rig.css?raw";
import hubCss from "../hub.css?raw";
import rigTsx from "../components/PieceRig.tsx?raw";
import hubTsx from "../components/Hub.tsx?raw";
import { KINDS } from "./Catalog";
import { useStudio } from "./kit";

const SOURCES: [string, string][] = [["exile.css", exileCss], ["rig.css", rigCss], ["hub.css", hubCss], ["PieceRig.tsx", rigTsx], ["Hub.tsx", hubTsx]];
const HEX = /#[0-9a-f]{3,8}\b/gi;
const where = (hex: string) => SOURCES.map(([f, src]) => [f, src.toLowerCase().split(hex.toLowerCase()).length - 1] as const).filter(([, n]) => n > 0);

function Swatch({ hex, name }: { hex: string; name: string }) {
  const found = where(hex);
  return <div className="swatch"><i style={{ background: hex }} /><b>{name}</b><code>{hex}</code>
    <small className={found.length ? "" : "missing"}>{found.length ? found.map(([f, n]) => `${f} ×${n}`).join(" · ") : "not found in source"}</small></div>;
}
const pal = (p: Palette, label: string): [string, string][] => [[p.main, `${label} main`], [p.mainSh, `${label} main shade`], [p.acc, `${label} accent`], [p.accSh, `${label} accent shade`], [p.cloth, `${label} cloth`], [p.clothSh, `${label} cloth shade`]];
const PALETTES: { title: string; colors: [string, string][] }[] = [
  { title: "Ink and paper", colors: [[INK, "Ink (all outlines, text)"], ["#f3ead7", "Parchment page"], ["#fbf6e8", "Panel"], ["#e6ddc2", "Arena"], ["#cabc9e", "Rule / border"], ["#766a58", "Muted text"]] },
  { title: "Board", colors: [["#e9d6ae", "Sand square"], ["#9aaf87", "Grass square"], ["#695c51", "Wall"], ["#675448", "Frame"], ["#483b34", "Frame shadow"], ["#e7b66d", "Impact"]] },
  { title: "Rebels", colors: pal(REBEL, "Rebel") },
  { title: "Patrol (blue, in game)", colors: pal(PATROL.blue, "Patrol") },
  { title: "Patrol (red, unused alt)", colors: pal(PATROL.red, "Red patrol").slice(0, 2) },
  { title: "Shared rig", colors: [[GOLD, "Gold"], [GOLD_SH, "Gold shade"], [STEEL, "Steel"], [STEEL_SH, "Steel shade"], [SKIN, "Skin"], [SKIN_SH, "Skin shade"], [BLUSH, "Blush"], [WOOD, "Wood"], [WOOD_SH, "Wood shade"]] },
  { title: "Signals", colors: [["#396c61", "Action teal"], ["#2d6755", "Move dot"], ["#c2493c", "Strike"], ["#a3271c", "Check"], ["#355f88", "Guard ring"], ["#2f5a82", "Guard chip"], ["#8d2c27", "Damage"], ["#fcf5de", "HP badge rebel"], ["#764950", "HP badge patrol"], ["#437d72", "Focus ring"]] },
  { title: "Banners", colors: [["#ffd34d", "Road cleared"], ["#7fd38c", "Victory"], ["#4b3f3a", "Defeat"], ["#a3271c", "Checkmate"]] },
  { title: "Hideout", colors: [["#a3b78f", "Grass alt"], ["#e3cfa3", "Path"], ["#b9a77f", "Lot"], ["#c4553f", "Flag / roof red"], ["#e8c784", "Straw"], ["#5b4a72", "Guild roof"]] },
];

function AllColours() {
  return <details className="all-colours"><summary>Every hex in the art sources</summary>
    {SOURCES.map(([f, src]) => {
      const counts = new Map<string, number>();
      for (const m of src.match(HEX) ?? []) counts.set(m.toLowerCase(), (counts.get(m.toLowerCase()) ?? 0) + 1);
      return <div key={f}><h5>{f} · {counts.size}</h5><div className="chips">{[...counts].sort((a, b) => b[1] - a[1]).map(([hex, n]) => <span key={hex} title={`${hex} ×${n}`}><i style={{ background: hex }} />{hex}<small>×{n}</small></span>)}</div></div>;
    })}
  </details>;
}

const TYPE: [string, string, string, string][] = [
  ["Display", "Georgia, serif", "clamp(29px,3vw,43px) · -1.5px", "Screen titles, banners, card titles"],
  ["Wordmark", "Georgia 900 · system-ui 700", "35px -2px · 9px +2px", "CHEZZ header"],
  ["Body", "DM Sans 400", "12–13px · 1.5", "Panels, captions"],
  ["Kicker", "DM Sans 800 · caps", "10px · +1.6px", "Section labels"],
  ["Numbers", "DM Sans 900", "13–22px", "HP badges, damage, ⚔ costs"],
];
const MOTION: [string, string][] = [
  ["Idle breathe", "1.4s ease-soft loop (patrol: stiff 2-step tick)"], ["Blink", "4.3s step-end loop"], ["Line boil", ".48s, 4 discrete seeds"],
  ["Rebel pawn jitter / dart", ".5s / 1.6s"], ["Piece slide between squares", ".7s cubic-bezier(.3,.05,.2,1)"], ["Knight lunge", ".34s"],
  ["Damage number float", ".7s"], ["Impact square", ".6s"], ["Banner pop / checkmate slam", ".5s / .45s"], ["Banner hold", "1.9s"],
  ["Strike tile pulse", "1.2s"], ["CHECK throb", ".9s"], ["Strike-from dot pulse", "1.1s"], ["Mate zoom", ".9s, scale 1.55"],
  ["Enemy step", "800ms · 250ms fast · 90ms reduced"], ["Hub walk", "190ms × spd per square"],
];
const EASE = rigCss.match(/--ease-[a-z]+:cubic-bezier\([^)]*\)/g) ?? [];
const SIDE_MARKERS: [string, string, string][] = [
  ["Body colour", "Teal / gold / brown (king: maroon robe)", "Royal blue + white + gold"],
  ["Badge", "Stitched patch, tilted −8°", "Gold stripe or tabard"],
  ["Ground shadow", "Ellipse", "Diamond"],
  ["Shield", "Round wooden buckler", "Blue kite shield, gold cross"],
  ["Boots", "Wood brown", "Ink black"],
  ["King's crown", "Tilted −16°, bent cross", "Upright"],
  ["HP badge", "Cream", "Plum"],
  ["Facing", "Right", "Left"],
  ["Idle", "Bouncy breathe", "Stiff tick"],
];
const A11Y: [string, string][] = [
  ["prefers-reduced-motion", "All CSS animations and transitions cut to .01ms (exile.css), except hit flash .3s and death fade .2s. Line boil off. Enemy step 90ms; JS timings ×0.1."],
  ["Side not by colour alone", "Shadow shape, shield shape, badge, boots, crown tilt, facing"],
  ["Flashing", "Hit flash: one brightness pulse per hit. Pulsing highlights (strike, CHECK, ⚔ dots): .9–1.2s"],
  ["Screen readers", "All art aria-hidden; squares carry aria-labels; banner text in a live region"],
  ["Focus", "3px #437d72 outline, 4px offset"],
];
const DOC_DIFFS = [
  "Rebels are teal / gold / brown, not ochre cloth with a teal sash",
  "Patrol HP badge is a plum pill, not a navy shield",
  "Characters are humans in costume (doc 3.3 superseded)",
  "Hit flash is brightness(2.4) on the rig, not a white silhouette copy",
  "Particles live inside each rig SVG, not a board overlay",
  "Outline 3.5 outer / 2.2 inner (doc: 4.5 / 2.5)",
  "Durations sit above the doc's targets (attack 560 vs ~520, death 900 vs 800)",
];

function Construction() {
  return <div className="construct">
    <PieceRig kind="king" side="white" />
    <svg viewBox="0 0 100 120" aria-hidden="true">
      <rect x="0" y="0" width="100" height="120" />
      <path d="M0 108H100M50 0V120" /><circle cx="50" cy="108" r="2.5" /><circle cx="50" cy="74" r="2.5" />
      <text x="2" y="105">feet y=108</text><text x="53" y="72">head pivot</text><text x="2" y="8">viewBox 100×120</text>
    </svg>
  </div>;
}

export function StyleGuide() {
  const { hue } = useStudio();
  return <div className="guide">
    <section className="group" id="palette"><h3>Palette</h3>
      {PALETTES.map(p => <div key={p.title} className="palette"><h4>{p.title}</h4><div className="swatches">{p.colors.map(([hex, name]) => <Swatch key={name} hex={hex} name={name} />)}</div></div>)}
      <AllColours />
    </section>

    <section className="group" id="type"><h3>Type</h3>
      <div className="type-specimens">
        <p style={{ fontFamily: "Georgia,serif", fontSize: 40, letterSpacing: -1.5, lineHeight: 1.1 }}>Georgia Aa</p>
        <p style={{ fontWeight: 400, fontSize: 28 }}>DM Sans 400 Aa</p>
        <p style={{ fontWeight: 600, fontSize: 28 }}>DM Sans 600 Aa</p>
        <p className="kicker">DM SANS 800 · KICKER</p>
      </div>
      <table className="spec"><thead><tr><th>Role</th><th>Face</th><th>Size</th><th>Use</th></tr></thead>
        <tbody>{TYPE.map(r => <tr key={r[0]}>{r.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody></table>
      <p className="fine">DM Sans files: <code>font-5.ttf</code> Regular (400), <code>font-7.ttf</code> SemiBold (mapped to 600–900; font-synthesis off, so 800/900 render SemiBold).</p>
    </section>

    <section className="group" id="construction"><h3>Construction</h3>
      <div className="construct-row">
        <Construction />
        <table className="spec"><tbody>
          <tr><th>Canvas</th><td>viewBox 0 0 100 120 · feet at (50, 108)</td></tr>
          <tr><th>Outline</th><td>{INK} · 3.5 outer · 2.2 features · round joins</td></tr>
          <tr><th>Arms</th><td>9 ink under 5 fill (capsule)</td></tr>
          <tr><th>Fills</th><td>Flat + one hard shade shape · no gradients</td></tr>
          <tr><th>Eyes</th><td>White toon eyes, ink pupils, 5 styles: beady · wide · lidded · sharp · small</td></tr>
          <tr><th>Layers</th><td>.flip › .hop › .squash › back · armBack · body · prop · armFront · head · shield</td></tr>
          <tr><th>Pivots</th><td>Body (50, 108) · head (50, 74) · prop per piece</td></tr>
          <tr><th>One prop</th><td>Each piece holds one weapon or tool</td></tr>
        </tbody></table>
      </div>
      <h4>Heights and silhouettes</h4>
      <div className="lineup">{KINDS.map(k => <div key={k}><PieceRig kind={k} side="white" /><PieceRig kind={k} side="black" hue={hue} facing={-1} /><small>{k}</small></div>)}</div>
      <div className="lineup silhouette">{KINDS.map(k => <div key={k}><PieceRig kind={k} side="white" /><PieceRig kind={k} side="black" hue={hue} facing={-1} /><small>{k}</small></div>)}</div>
    </section>

    <section className="group" id="sides"><h3>Side markers</h3>
      <table className="spec"><thead><tr><th>Channel</th><th>Rebel</th><th>Patrol</th></tr></thead>
        <tbody>{SIDE_MARKERS.map(r => <tr key={r[0]}>{r.map((c, i) => i ? <td key={i}>{c}</td> : <th key={i}>{c}</th>)}</tr>)}</tbody></table>
      <div className="lineup greyscale">{KINDS.slice(0, 3).map(k => <div key={k}><PieceRig kind={k} side="white" /><PieceRig kind={k} side="black" hue={hue} facing={-1} /><small>{k} · greyscale</small></div>)}</div>
    </section>

    <section className="group" id="timing"><h3>Timing</h3>
      <table className="spec bars"><thead><tr><th>Rig action</th><th>ms at 1x</th><th /></tr></thead>
        <tbody>{(Object.entries(RIG_MS) as [RigAction, number][]).filter(([, ms]) => ms).map(([a, ms]) => <tr key={a}><th>{a}</th><td>{ms}</td><td><i style={{ width: `${ms / 26}%` }} /></td></tr>)}</tbody></table>
      <p className="fine">Source: <code>RIG_MS</code> in PieceRig.tsx. All one-shots scale by <code>--spd</code>: 1 · 0.3 fast · 0.1 reduced motion.</p>
      <table className="spec"><thead><tr><th>Loop / UI</th><th>Timing</th></tr></thead><tbody>{MOTION.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      <table className="spec"><thead><tr><th>Easing token (rig.css)</th></tr></thead><tbody>{EASE.map(e => <tr key={e}><td><code>{e}</code></td></tr>)}</tbody></table>
    </section>

    <section className="group" id="a11y"><h3>Accessibility</h3>
      <table className="spec"><tbody>{A11Y.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
    </section>

    <section className="group" id="doc-diffs"><h3>Code vs docs/art-direction-exile.md</h3>
      <ul className="list">{DOC_DIFFS.map(d => <li key={d}>{d}</li>)}</ul>
    </section>
  </div>;
}
