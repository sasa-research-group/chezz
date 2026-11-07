import type { ReactNode } from "react";
const MADE: [string, string, string][] = [
  ["Sprite cast (18 portraits, current look)", "PNGs sliced from Wesley's character-select sheet; CSS keyframes on the <img> with the rig's action names", "public/art/cast · src/components/PieceSprite.tsx · src/sprite.css"],
  ["Cast (12 characters, SVG rig)", "Hand-written SVG paths in React; one function per piece, palette per side", "src/components/PieceRig.tsx"],
  ["Cast animation", "CSS keyframes on nested <g> groups; class act-<action>; --spd scales time", "src/rig.css"],
  ["Line boil", "SVG feTurbulence + feDisplacementMap, SMIL-animated seed", "PieceRig.tsx <defs>"],
  ["Effects (dust, stars, smoke…)", "SVG groups inside each rig, shown by keyframes", "PieceRig.tsx · rig.css"],
  ["Board, tiles, overlays, badges", "CSS on DOM squares; 3D tilt via rotateX/rotateZ", "src/exile.css · App.tsx Board"],
  ["Banners, guard chip", "React + CSS", "src/components/BoardArt.tsx · exile.css"],
  ["Choreography (knight leap, mate, promotion)", "setTimeout timelines over rig actions", "App.tsx perform() and outro"],
  ["Hideout buildings", "Hand-written SVG, one per building", "src/components/Hub.tsx PlaceArt"],
  ["Hideout map", "CSS grid + container-query signs", "src/hub.css"],
  ["Icons", "Unicode glyphs + one inline SVG shield", "App.tsx · Hub.tsx · BoardArt.tsx"],
  ["Favicon", "Static SVG", "public/favicon.svg"],
  ["Legacy pieces", "SVG, lab Duel only", "src/components/PieceArt.tsx"],
];
const FONTS: [string, string, string, string][] = [
  ["DM Sans Regular", "public/fonts/font-5.ttf", "SIL OFL 1.1", "public/fonts/dmsans-OFL.txt"],
  ["DM Sans SemiBold", "public/fonts/font-7.ttf", "SIL OFL 1.1", "public/fonts/dmsans-OFL.txt"],
  ["Georgia", "System font (not shipped)", "OS-licensed", "—"],
  ["system-ui", "System font (not shipped)", "OS-licensed", "—"],
];
const NOT_USED = ["Runtime sprite sheets or atlases (the character-select sheet is sliced offline into one PNG per piece)", "Per-frame raster animation (sprites are single images moved by CSS)", "Animation libraries (no GSAP, Lottie, Spine)", "Canvas or WebGL", "Third-party art or icon packs"];
const ADD = [
  "A new piece portrait: add a tile to the character-select sheet and re-run the slicer (Sprite cast pipeline below); everything else is still drawn in code",
  "Draw in code: SVG in a component, viewBox 0 0 100 120 for characters, ink #382f2e outlines (3.5 / 2.2)",
  "Use palette constants from PieceRig.tsx or the hexes listed in the style guide",
  "Animate with CSS keyframes keyed off a class; multiply durations by var(--spd,1)",
  "Add the duration to RIG_MS when the game must wait for it",
  "Add a reduced-motion rule",
  "Mark the art aria-hidden; put meaning in labels",
  "Add an entry to this studio (src/art/Catalog.tsx) with name and source file",
  "Check at phone width (390px) and in greyscale",
];

/** The sheet the slicer expects, as the reference sheet (2528 × 1696) lays it out. */
const SHEET: [string, string][] = [
  ["Title band", "“CHARACTER SELECT” in chunky white block capitals with a dark outline across the top (~230 px) of a blue-teal castle-silhouette background; the backdrop between tiles is that same scene"],
  ["Grid", "3 rows × 6 columns of tiles on a regular pitch: 415 px between columns (tiles 378 px wide, the first one 39 px from the left edge), about 497 px between rows"],
  ["Tile", "A flat beige square (#c6b392, 378 wide by about 398 tall) inside a dark rounded frame ~14 px thick; the character fills it from the bottom edge, drawn mostly facing right, and is cropped by the frame at the feet. The slicer ends a row where the beige thins out, which the label boxes and the wide misfits push up, so it keeps 372 / 367 / 358 px of the rebel / royal / misfit rows (PNGs 252 / 249 / 242 px tall at 256 wide): royals and misfits are cut a few px higher at the feet than rebels"],
  ["Label box", "A white rounded box with the kind in black capitals straddles the frame's bottom edge; its top 26 px overlap the beige, so the slicer drops that sliver"],
  ["Rows", "One variant per row, top to bottom: rebels (the player's exiles), royals (the patrol), misfits (odd recruits)"],
  ["Columns", "One kind per column, left to right: pawn, knight, bishop, rook, queen, king"],
];
const SLICE_STEPS: ReactNode[] = [
  "Generate or draw the sheet in this layout (same tile size, pitch and label boxes; keep the title band and the first tile where they are, because the slicer samples the backdrop colour from an empty patch at the top of the first tile)",
  <>Check the tools: <code>python3 -c "import PIL, numpy"</code> (python3 with Pillow and numpy)</>,
  <>Run: <code>python3 scripts/slice-cast.py &lt;sheet.png&gt; public/art/cast</code>. Only the 18 portraits land in the output directory (vite ships everything under <code>public/</code>); the inspection aids go to a fresh temporary directory whose path is printed at the end, or to <code>--aids-dir DIR</code>. A sheet that does not detect as the expected rows and columns stops before anything is written</>,
  <>Open <code>_sheet.png</code> in the printed aids directory: every cut-out on a teal ground; a character with a hole or a missing edge means the flood fill got in, so fix the sheet (close the outline, keep interior beige away from the edge) and re-run</>,
  "Open the studio (Art catalog › Character select) and the game: the 18 files are picked up by name, nothing else to register",
];
const NAMES: [string, string][] = [
  ["<variant>-<kind>.png", "The cut-out, RGBA, 256 px wide (the height follows the tile), LANCZOS-resized. Row index → variant (rebel, royal, misfit), column index → kind (pawn, knight, bishop, rook, queen, king). PieceSprite.tsx loads it by this name: spriteSrc(variant, kind)."],
  ["<variant>-<kind>-token.png", "Inspection aid: the framed tile, uncut (goes to the aids directory, never public/art/cast, and is not committed)"],
  ["_sheet.png · _meta.json", "Inspection aids (aids directory): a contact sheet of the cut-outs, and each tile's box on the sheet plus the fraction of pixels kept (0.35 for the goose, 0.82 for the royal rook)"],
];
const FOURTH = [
  "Draw the sheet with a fourth row in the same layout (same tile size, pitch and label boxes), say “wild”",
  "Run the slicer with --variants rebel,royal,misfit,wild (rows top to bottom; the row count must match, or it stops before writing)",
  "Add “wild” to Variant and VARIANTS in src/game/abilities.ts and give its six characters abilities there (name, ability, sentence); PieceSprite.tsx needs no change",
  "Give it a label in src/art/Catalog.tsx VARIANT_LABEL (a Record<Variant, string>, so tsc fails until it has one) and a row shade in src/art/art.css beside tr.rebel / tr.royal / tr.misfit",
  "The studio grid and matrix pick the new row up from VARIANTS; bump both 18s in tests/browser/studio.spec.ts (portraits and matrix rows) to 24",
  "Let the game offer the variant: recruit offers in the barracks and encounter spawns name a variant (turns.ts Encounter.spawns)",
];

export function Tooling() {
  return <div className="tooling">
    <section className="group" id="made"><h3>How the art is made</h3>
      <table className="spec"><thead><tr><th>Art</th><th>Technique</th><th>Lives in</th></tr></thead>
        <tbody>{MADE.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td><code>{r[2]}</code></td></tr>)}</tbody></table>
    </section>
    <section className="group" id="sprites"><h3>Sprite cast pipeline</h3>
      <p className="fine">The current look is a character-select sheet (an image in this style), sliced once into <code>public/art/cast/&lt;variant&gt;-&lt;kind&gt;.png</code> by <code>scripts/slice-cast.py</code>. The game never loads the sheet: <code>src/components/PieceSprite.tsx</code> loads one PNG per piece and <code>src/sprite.css</code> animates it with the rig's action names (idle, move, attack, defend, hit, death, cheer, leap, leap-back, mate, morph-out, morph-in), scaled by <code>--spd</code>.</p>
      <h4>The sheet</h4>
      <table className="spec"><thead><tr><th>Part</th><th>Layout</th></tr></thead>
        <tbody>{SHEET.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td></tr>)}</tbody></table>
      <h4>Slicing it</h4>
      <ol className="list">{SLICE_STEPS.map((n, i) => <li key={i}>{n}</li>)}</ol>
      <p className="fine">How it finds the tiles: the backdrop colour is the median of an empty patch at the top of the first tile; rows are runs of sheet rows that are mostly that beige (minus the label sliver); the first two beige column runs give the pitch for all six columns. Inside a tile, backdrop pixels reachable from the tile's edge are flood-filled to transparent, so an enclosed patch of beige inside a character stays.</p>
      <h4>How the names map</h4>
      <table className="spec"><thead><tr><th>File</th><th>What it is</th></tr></thead>
        <tbody>{NAMES.map(r => <tr key={r[0]}><th><code>{r[0]}</code></th><td>{r[1]}</td></tr>)}</tbody></table>
      <h4>Adding a fourth variant</h4>
      <ol className="list">{FOURTH.map(n => <li key={n}>{n}</li>)}</ol>
    </section>
    <section className="group" id="fonts"><h3>Fonts and licences</h3>
      <table className="spec"><thead><tr><th>Font</th><th>File</th><th>Licence</th><th>Licence text</th></tr></thead>
        <tbody>{FONTS.map(r => <tr key={r[0]}><th>{r[0]}</th><td><code>{r[1]}</code></td><td>{r[2]}</td><td><code>{r[3]}</code></td></tr>)}</tbody></table>
      <p className="fine">All other art is original code in this repo.</p>
    </section>
    <section className="group" id="not-used"><h3>Not in the pipeline</h3><ul className="list">{NOT_USED.map(n => <li key={n}>{n}</li>)}</ul></section>
    <section className="group" id="adding"><h3>Adding new art</h3><ol className="list">{ADD.map(n => <li key={n}>{n}</li>)}</ol></section>
  </div>;
}
