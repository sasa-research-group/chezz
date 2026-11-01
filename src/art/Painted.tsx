import { useLayoutEffect, useRef } from "react";
import { PieceRig, RIG_MS, type RigAction, type RigKind, type RigSide } from "../components/PieceRig";
import { SPRITE_IDS } from "../components/SpriteRig";
import { Group } from "./kit";

const REF = import.meta.glob("../../docs/art/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const SIZES = [48, 84, 192];
const ACTIONS: RigAction[] = ["move", "attack", "defend", "hit", "death", "cheer", "morph-out", "morph-in"];
const EXTRA: Partial<Record<RigKind, RigAction[]>> = { knight: ["leap", "leap-back"], king: ["mate"] };
const FRACS = [0, .2, .35, .5, .65, .85];

/** One frame of an action, frozen: every animation in the cell paused at `frac` of the take. */
function Frame({ kind, side, action, frac }: { kind: RigKind; side: RigSide; action: RigAction; frac: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    for (const a of ref.current?.getAnimations({ subtree: true }) ?? []) { a.pause(); a.currentTime = frac * RIG_MS[action]; }
  }, [action, frac]);
  return <figure role="cell"><div ref={ref} style={{ width: 56 }}>
    <PieceRig kind={kind} side={side} art="paint" action={action} defending={action === "defend"} facing={side === "white" ? 1 : -1} seed="sprite" />
  </div><figcaption>{Math.round(frac * 100)}%</figcaption></figure>;
}

function Character({ id }: { id: string }) {
  const [faction, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
  const side: RigSide = faction === "rebel" ? "white" : "black";
  return <section className="paint-char" data-paint={id}>
    <h4>{faction === "rebel" ? "Rebel" : "Patrol"} {kind}</h4>
    <div className="paint-sizes">
      <figure><img src={REF[`../../docs/art/${id}.webp`]} alt={`Reference crop: ${faction} ${kind}`} width={156} height={192} /><figcaption>reference</figcaption></figure>
      {SIZES.map(px => <figure key={px}>
        <div style={{ width: px }}><PieceRig kind={kind} side={side} art="paint" seed="sprite" /></div>
        <figcaption>{px}px</figcaption>
      </figure>)}
    </div>
    <div className="paint-actions" role="table" aria-label={`${faction} ${kind} action frames`}>
      {[...ACTIONS, ...(EXTRA[kind] ?? [])].map(a => <div key={a} role="row"><b role="rowheader">{a}</b>
        {FRACS.map(f => <Frame key={f} kind={kind} side={side} action={a} frac={f} />)}
      </div>)}
    </div>
  </section>;
}

export function Painted() {
  return <Group id="painted" title="Sprites" intro={<>One painted image per piece, eyes painted in (<code>?art=paint</code>); every action moves the whole sprite plus effects. Recipes <code>docs/art/recipes/paint-*.json</code> → <code>tools/art/sprite.mjs</code> → <code>src/assets/sprites/</code>; renderer <code>components/SpriteRig.tsx</code>, keyframes <code>src/sprite.css</code>. Guide: <code>docs/art/PAINTED.md</code>.</>}>
    {SPRITE_IDS.map(id => <Character key={id} id={id} />)}
  </Group>;
}
