const MADE: [string, string, string][] = [
  ["Cast (12 characters)", "Hand-written SVG paths in React; one function per piece, palette per side", "src/components/PieceRig.tsx"],
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
const NOT_USED = ["Raster images or sprite sheets", "Image editors or exported assets", "Animation libraries (no GSAP, Lottie, Spine)", "Canvas or WebGL", "Third-party art or icon packs"];
const ADD = [
  "Draw in code: SVG in a component, viewBox 0 0 100 120 for characters, ink #382f2e outlines (3.5 / 2.2)",
  "Use palette constants from PieceRig.tsx or the hexes listed in the style guide",
  "Animate with CSS keyframes keyed off a class; multiply durations by var(--spd,1)",
  "Add the duration to RIG_MS when the game must wait for it",
  "Add a reduced-motion rule",
  "Mark the art aria-hidden; put meaning in labels",
  "Add an entry to this studio (src/art/Catalog.tsx) with name and source file",
  "Check at phone width (390px) and in greyscale",
];

export function Tooling() {
  return <div className="tooling">
    <section className="group" id="made"><h3>How the art is made</h3>
      <table className="spec"><thead><tr><th>Art</th><th>Technique</th><th>Lives in</th></tr></thead>
        <tbody>{MADE.map(r => <tr key={r[0]}><th>{r[0]}</th><td>{r[1]}</td><td><code>{r[2]}</code></td></tr>)}</tbody></table>
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
