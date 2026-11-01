const ART = import.meta.glob("../../docs/art/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
export const art = (name: string) => ART[`../../docs/art/${name}.webp`];

const PIECES = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;
const FACTIONS: { id: string; label: string; look: string; notes: string[] }[] = [
  { id: "rebel", label: "Rebels", look: "Patched, earthy, one dominant accent each", notes: ["Copper pot (saucepan in game), pitchfork, red bandana", "Rusty bucket helm, hobby horse", "Parchment mitre, hood void, crook", "Stonemason: tower great-helm, dot eyes in the slot, mallet", "Kettle helm + crown, frying pan", "Crown low on the brow, beard, sword"] },
  { id: "patrol", label: "Patrol", look: "Polished royal blue, gold trim on most", notes: ["Morion, moustache, pike (in game: kettle helm, no moustache)", "Plume, armoured horse, lance", "Gilded mitre helm, spectacles", "Keep great-helm, gold cross", "Towering wig, sceptre, no crown", "Crown over a sculpted mask"] },
  { id: "odd", label: "Oddballs", look: "Creatures that keep the crest", notes: ["Frog in the pot", "Empty suit on a wooden horse", "Goose in a mitre", "Haystack with battlements", "Melting candle, one flame", "Sleepy cat, big crown"] },
];

const RULES: { title: string; items: string[] }[] = [
  { title: "Armour does the talking", items: ["Headgear, armour and props carry personality", "Face budget: none → two dot eyes → small dot-eye face; patrol queen and king are the limit", "Humans: no irises; glowing dots or embers allowed in a dark void", "Creatures keep a simple cartoon face (frog, cat at most)", "Humans and armour: one prop or mount that is part of the joke", "Wear goes on the kit: dents, rust, patches, stitches"] },
  { title: "Outline and fill", items: ["Very thick, even, near-black outer outline", "Interior lines about half as thick", "Flat fills, no gradients", "One hard cel shadow per form", "Crisp white highlights on metal and glass"] },
  { title: "Proportions", items: ["Chunky, big-headed: head + headgear ≈ half the figure", "Headgear often as tall as the head", "Big chunky hands, blocky shoulders"] },
  { title: "Distinct designs", items: ["Never a palette swap", "Rebel vs patrol: different headgear, prop and build", "Oddballs may share a crest; the creature differs", "Every piece in a faction has its own headgear silhouette"] },
  { title: "Chess crest", items: ["Reads as its piece by silhouette at 48px", "Pawn: small round pot or morion", "Knight: a horse head in profile", "Bishop: tall pointed mitre", "Rook: battlements on top", "Queen: crown or tall crest (patrol queen needs one added)", "King: widest, highest-pointed crown"] },
  { title: "At game size (48–90px)", items: ["Keep: crest silhouette, dot-eye faces, one oversized prop, thick ink, flat fill + one shadow, one highlight tick, faction colour", "Drop: rivets, bricks, hay strands, rust, embroidery, chains, fingers, buckles", "No interior line shorter than ~6 viewBox units", "Hands become mitts; rigs' toon eyes and mouths go; rebel teal becomes earthy + one accent"] },
];

const REF_PALETTE: { title: string; colors: [string, string][] }[] = [
  { title: "Shared", colors: [["#000000", "Ink"], ["#f0be9a", "Skin"], ["#c6b393", "Tile ground"], ["#75c7d4", "Backdrop teal"], ["#526383", "Backdrop slate"]] },
  { title: "Rebels", colors: [["#9f7853", "Pot copper"], ["#896749", "Pot shadow"], ["#665136", "Beard brown"], ["#865637", "Leather"], ["#a57952", "Light leather"], ["#5f3f2c", "Dark leather"], ["#8d7e66", "Hood cloth"], ["#918b83", "Robe grey"], ["#e7d5ac", "Parchment"], ["#8a9094", "Rusty steel"], ["#a2a4a4", "Stone"], ["#869043", "Drab green"], ["#507b92", "Faded tunic blue"], ["#cd2a25", "Accent red"], ["#3275a9", "Accent blue"], ["#eecd02", "Accent yellow"], ["#d86929", "Accent orange"], ["#a62f42", "Accent crimson"], ["#f7c65d", "Crown gold"]] },
  { title: "Patrol", colors: [["#4b76cf", "Royal blue"], ["#577aba", "Royal blue mid"], ["#314e8f", "Blue shadow"], ["#2c3b77", "Blue deep"], ["#aac7e6", "Blue highlight"], ["#95b1c9", "Steel"], ["#617085", "Steel shadow"], ["#f0bf44", "Gold"], ["#cb8e24", "Gold shadow"], ["#744924", "Moustache"], ["#d5e5f9", "Wig white"]] },
  { title: "Oddballs", colors: [["#7cb04c", "Frog"], ["#a7d274", "Frog light"], ["#52883b", "Frog shadow"], ["#edf1f9", "Goose"], ["#b0b7cd", "Goose shadow"], ["#fe8a34", "Beak"], ["#ebbe52", "Hay"], ["#b2833d", "Hay shadow"], ["#f7e4b5", "Wax"], ["#e0c290", "Wax shadow"], ["#f9aa1f", "Flame"], ["#f19d43", "Cat"], ["#b7631e", "Cat shadow"], ["#9d2143", "Velvet"], ["#fbc635", "Crown gold"]] },
];

export function Reference() {
  return <>
    <section className="group" id="target"><h3>Target style: armour does the talking</h3>
      <p className="ref-status"><b>Target, not current.</b> This reference is what the art is moving to. The rigs in the catalog and the swatches under “Current in-game art” are the game today; only the pawns, rooks, knights and bishops are redrawn so far, behind <code>?art=new</code> (“New art” in the catalog).</p>
      <figure className="ref-sheet"><img src={art("sheet-armour-talks")} alt="Reference character sheet: 18 portraits, rebels, royal patrol and oddballs" width={2000} height={1342} />
        <figcaption>Chosen Oct 31 2026. Rules: <code>docs/art-style.md</code> · recipe: <code>docs/art/recipe.md</code></figcaption></figure>
    </section>

    <section className="group" id="ref-cast"><h3>Reference cast</h3>
      {FACTIONS.map(f => <div key={f.id} className="ref-row">
        <h4>{f.label} <span>{f.look}</span></h4>
        <div className="ref-grid">{PIECES.map((p, i) => <figure key={p} className={`ref-tile ${f.id}`}>
          <img src={art(`${f.id}-${p}`)} alt={`${f.label} ${p}`} loading="lazy" width={406} height={498} />
          <figcaption><b>{p}</b><span>{f.notes[i]}</span></figcaption></figure>)}</div>
      </div>)}
    </section>

    <section className="group" id="rules"><h3>Rules</h3>
      <div className="ref-rules">{RULES.map(r => <div key={r.title}><h4>{r.title}</h4><ul>{r.items.map(i => <li key={i}>{i}</li>)}</ul></div>)}</div>
    </section>

    <section className="group" id="ref-palette"><h3>Reference palette</h3>
      <p className="fine">Sampled from the sheet. Target values; not yet used in game code.</p>
      {REF_PALETTE.map(p => <div key={p.title} className="palette"><h4>{p.title}</h4><div className="swatches">{p.colors.map(([hex, name]) =>
        <div key={name} className="swatch"><i style={{ background: hex }} /><b>{name}</b><code>{hex}</code><small>sampled</small></div>)}</div></div>)}
    </section>
  </>;
}
