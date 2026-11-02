import { INK, RIG_MS } from "../components/PieceRig";
import type { RigAction } from "../components/PieceRig";
import exileCss from "../exile.css?raw";
import rigCss from "../rig.css?raw";
import spriteCss from "../sprite.css?raw";
import hubCss from "../hub.css?raw";
import tableCss from "../table.css?raw";
import hubTsx from "../components/Hub.tsx?raw";
import lanternTsx from "../components/table/Lantern.tsx?raw";
import { KINDS, SpriteStill } from "./kit";
import { Reference } from "./Reference";

const SOURCES: [string, string][] = [["exile.css", exileCss], ["hub.css", hubCss], ["table.css", tableCss], ["Hub.tsx", hubTsx], ["Lantern.tsx", lanternTsx]];
const where = (hex: string) => SOURCES.map(([f, src]) => [f, src.toLowerCase().split(hex.toLowerCase()).length - 1] as const).filter(([, n]) => n > 0);

function Swatch({ hex, name }: { hex: string; name: string }) {
  const found = where(hex);
  return <div className="swatch"><i style={{ background: hex }} /><b>{name}</b><code>{hex}</code>
    <small className={found.length ? "" : "missing"}>{found.length ? found.map(([f, n]) => `${f} ×${n}`).join(" · ") : "not found in source"}</small></div>;
}
const PALETTES: { title: string; colors: [string, string][] }[] = [
  { title: "Ink and paper", colors: [[INK, "Ink"], ["#f3ead7", "Parchment page"], ["#fbf6e8", "Panel"], ["#cabc9e", "Rule / border"], ["#766a58", "Muted text"]] },
  { title: "Table", colors: [["#8a6a50", "Table light"], ["#5a4434", "Table mid"], ["#3a2b22", "Table edge"], ["#2b201b", "Plaque"], ["#a8865f", "Brass rim"], ["#f6e3b4", "Plaque text"], ["#7a5c44", "Board frame (game)"], ["#e2a92a", "Bell brass"], ["#cfe2f3", "Shield token"], ["#ffb21f", "Lantern flame"]] },
  { title: "Board", colors: [["#e9d6ae", "Sand square"], ["#9aaf87", "Grass square"], ["#695c51", "Wall"], ["#675448", "Frame"], ["#483b34", "Frame shadow"], ["#e7b66d", "Impact"]] },
  { title: "Signals", colors: [["#396c61", "Action teal"], ["#2d6755", "Move dot"], ["#c2493c", "Strike"], ["#a3271c", "Check"], ["#355f88", "Guard ring"], ["#2f5a82", "Guard chip"], ["#8d2c27", "Damage"], ["#fcf5de", "HP badge rebel"], ["#764950", "HP badge patrol"], ["#437d72", "Focus ring"]] },
  { title: "Banners", colors: [["#ffd34d", "Battle won"], ["#7fd38c", "Victory"], ["#4b3f3a", "Defeat"], ["#a3271c", "Checkmate"]] },
  { title: "Hideout", colors: [["#a3b78f", "Grass alt"], ["#e3cfa3", "Path"], ["#b9a77f", "Lot"], ["#c4553f", "Flag / roof red"], ["#e8c784", "Straw"], ["#5b4a72", "Guild roof"]] },
];

const TYPE: [string, string, string, string][] = [
  ["Display", "Georgia, serif", "clamp(29px,3vw,43px) · -1.5px", "Screen titles, banners, card titles"],
  ["Body", "DM Sans 400", "12–13px · 1.5", "Panels, captions"],
  ["Kicker", "DM Sans 800 · caps", "10px · +1.6px", "Section labels"],
  ["Numbers", "DM Sans 900", "13–22px", "HP badges, damage, strike costs"],
];
const FONTS: [string, string, string][] = [
  ["DM Sans Regular", "public/fonts/font-5.ttf", "SIL OFL 1.1"],
  ["DM Sans SemiBold", "public/fonts/font-7.ttf", "SIL OFL 1.1"],
  ["Georgia, system-ui", "System fonts, not shipped", "OS"],
];
const MOTION: [string, string][] = [
  ["Idle breathe", `${spriteCss.match(/sprite-breathe ([\d.]+s)/)?.[1]} loop`], ["Piece slide between squares", ".7s cubic-bezier(.3,.05,.2,1)"],
  ["Damage number float", ".7s"], ["Impact square", ".6s"], ["Banner pop / checkmate slam", ".5s / .45s"], ["Banner hold", "1.9s"],
  ["Strike tile pulse", "1.2s"], ["CHECK throb", ".9s"], ["Strike-from dot pulse", "1.1s"], ["Mate zoom", ".9s, scale 1.55"],
  ["Enemy step", "800ms · 250ms fast · 90ms reduced"], ["Hub walk", "190ms × spd per square"],
];
const EASE = rigCss.match(/--ease-[a-z]+:cubic-bezier\([^)]*\)/g) ?? [];
const SIDE_MARKERS: [string, string, string][] = [
  ["Colours", "Earthy, patched, one accent", "Royal blue, white, gold"],
  ["Ground shadow", "Ellipse", "Diamond"],
  ["Shield", "Round wooden buckler", "Blue kite shield, gold cross"],
  ["HP badge", "Cream", "Plum"],
  ["Facing", "Right", "Left (mirrored)"],
];
const CONSTRUCTION: [string, string][] = [
  ["Source", "One painted webp per piece, 480px tall, 12px ink outline · src/assets/sprites/"],
  ["Canvas", "viewBox 0 0 100 120 · feet on y 108 · inside x 18–82"],
  ["Height", "Pawn 84 · knight, rook 98 · bishop, queen, king 102 (viewBox units)"],
  ["Groups", ".flip › .hop › .squash › image.sprite + .shield"],
  ["Moves", "Whole sprite only: hop, squash, lean, flip, fade"],
  ["Effects", "Dust, lines, burst, stars, smoke, pop, crown"],
  ["Facing", "Painted right; the patrol is mirrored"],
];
const A11Y: [string, string][] = [
  ["prefers-reduced-motion", "Animations and transitions cut to .01ms, except hit flash .3s and death fade .2s. Enemy step 90ms; JS timings ×0.1."],
  ["Side not by colour alone", "Shadow shape, shield shape, HP badge, facing"],
  ["Flashing", "Hit flash: one brightness pulse per hit. Pulsing highlights (strike, CHECK, strike dots): .9–1.2s"],
  ["Screen readers", "All art aria-hidden; squares carry aria-labels; banner text in a live region"],
  ["Focus", "3px #437d72 outline, 4px offset"],
];

function Construction() {
  return <div className="construct">
    <SpriteStill kind="king" side="white" />
    <svg viewBox="0 0 100 120" aria-hidden="true">
      <rect x="0" y="0" width="100" height="120" /><rect className="box" x="18" y="0" width="64" height="108" />
      <path d="M0 108H100M50 0V120" /><circle cx="50" cy="108" r="2.5" />
      <text x="2" y="105">feet y=108</text><text x="20" y="6">x 18–82</text><text x="2" y="118">viewBox 100×120</text>
    </svg>
  </div>;
}

export function StyleGuide() {
  return <div className="guide">
    <Reference />

    <section className="group" id="palette"><h3>UI palette</h3>
      {PALETTES.map(p => <div key={p.title} className="palette"><h4>{p.title}</h4><div className="swatches">{p.colors.map(([hex, name]) => <Swatch key={name} hex={hex} name={name} />)}</div></div>)}
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
      <table className="spec"><thead><tr><th>Font</th><th>File</th><th>Licence</th></tr></thead>
        <tbody>{FONTS.map(r => <tr key={r[0]}><th>{r[0]}</th><td><code>{r[1]}</code></td><td>{r[2]}</td></tr>)}</tbody></table>
    </section>

    <section className="group" id="construction"><h3>Construction</h3>
      <div className="construct-row">
        <Construction />
        <table className="spec"><tbody>{CONSTRUCTION.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      </div>
      <h4>Heights</h4>
      <div className="lineup">{KINDS.map(k => <div key={k}><SpriteStill kind={k} side="white" /><SpriteStill kind={k} side="black" /><small>{k}</small></div>)}</div>
      <h4>Silhouettes</h4>
      <div className="lineup silhouette">{KINDS.map(k => <div key={k}><SpriteStill kind={k} side="white" /><SpriteStill kind={k} side="black" /><small>{k}</small></div>)}</div>
    </section>

    <section className="group" id="sides"><h3>Side markers</h3>
      <table className="spec"><thead><tr><th>Channel</th><th>Rebel</th><th>Patrol</th></tr></thead>
        <tbody>{SIDE_MARKERS.map(r => <tr key={r[0]}>{r.map((c, i) => i ? <td key={i}>{c}</td> : <th key={i}>{c}</th>)}</tr>)}</tbody></table>
    </section>

    <section className="group" id="timing"><h3>Timing</h3>
      <table className="spec bars"><thead><tr><th>Action</th><th>ms at 1×</th><th /></tr></thead>
        <tbody>{(Object.entries(RIG_MS) as [RigAction, number][]).filter(([, ms]) => ms).map(([a, ms]) => <tr key={a}><th>{a}</th><td>{ms}</td><td><i style={{ width: `${ms / 26}%` }} /></td></tr>)}</tbody></table>
      <p className="fine"><code>RIG_MS</code> · durations × <code>--spd</code>: 1 · 0.3 fast · 0.1 reduced motion</p>
      <table className="spec"><thead><tr><th>Loop / UI</th><th>Timing</th></tr></thead><tbody>{MOTION.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
      <table className="spec"><thead><tr><th>Easing (rig.css)</th></tr></thead><tbody>{EASE.map(e => <tr key={e}><td><code>{e}</code></td></tr>)}</tbody></table>
    </section>

    <section className="group" id="a11y"><h3>Accessibility</h3>
      <table className="spec"><tbody>{A11Y.map(([a, b]) => <tr key={a}><th>{a}</th><td>{b}</td></tr>)}</tbody></table>
    </section>
  </div>;
}
