import { PieceRig, type ArtStyle, type RigAction, type RigKind, type RigSide } from "../components/PieceRig";
import { PAINTED } from "../components/paint/specs";
import { Group, LoopRig } from "./kit";

const REF = import.meta.glob("../../docs/art/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const SIZES = [48, 84, 192];
const ACTIONS: RigAction[] = ["idle", "move", "attack", "defend", "hit", "death", "cheer"];
const ARTS: [ArtStyle, string][] = [["paint", "Painted"], ["new", "SVG kit"]];

/** Painted sprites (`?art=paint`) beside the SVG kit and the reference crop: each
 * character at game sizes, then every action looping in both styles. */
function Character({ id }: { id: string }) {
  const [faction, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
  const side: RigSide = faction === "rebel" ? "white" : "black";
  return <section className="paint-char" data-paint={id}>
    <h4>{faction === "rebel" ? "Rebel" : "Patrol"} {kind}</h4>
    <div className="paint-sizes">
      <figure><img src={REF[`../../docs/art/${id}.webp`]} alt={`Reference crop: ${faction} ${kind}`} width={156} height={192} /><figcaption>reference</figcaption></figure>
      {ARTS.map(([art, label]) => SIZES.map(px => <figure key={art + px}>
        <div style={{ width: px }}><PieceRig kind={kind} side={side} art={art} seed="paint" /></div>
        <figcaption>{label} {px}px</figcaption>
      </figure>))}
    </div>
    <div className="paint-actions" role="table" aria-label={`${faction} ${kind} actions`}>
      {ARTS.map(([art, label]) => <div key={art} role="row"><b role="rowheader">{label}</b>
        {ACTIONS.map(a => <figure key={a} role="cell"><LoopRig kind={kind} side={side} action={a} art={art} /><figcaption>{a}</figcaption></figure>)}
      </div>)}
    </div>
  </section>;
}

export function Painted() {
  return <Group id="painted" title="Painted sprites" intro={<>Image-generated parts hung on the same rig (<code>?art=paint</code>), beside the SVG kit and the reference. Parts: <code>docs/art/recipes/paint-*.json</code> → <code>tools/art/cut-parts.mjs</code> → <code>src/assets/paint/</code>; placement: <code>components/paint/specs.ts</code>. Guide: <code>docs/art/PAINTED.md</code>.</>}>
    {Object.keys(PAINTED).map(id => <Character key={id} id={id} />)}
  </Group>;
}
