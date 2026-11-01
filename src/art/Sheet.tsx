import { PieceRig, type ArtStyle, type RigAction, type RigKind, type RigSide } from "../components/PieceRig";

/** The judge sheet: `art.html?sheet=pawn.white,pawn.black` (append `.old` to a
 * rig for the old art). tools/art/shoot.mjs opens it, freezes every animation
 * at the `data-frac` of its cell and saves one PNG. */

type Spec = { kind: RigKind; side: RigSide; art: ArtStyle };
const KINDS: RigKind[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const SIZES = [48, 84, 192];
const ACTIONS: RigAction[] = ["move", "attack", "defend", "hit", "death", "cheer", "morph-out"];
const FRACS = [0, .2, .35, .5, .65, .85];

export function parseSheet(q: string): Spec[] {
  return q.split(",").map(s => s.split(".")).filter(([k, s]) => KINDS.includes(k as RigKind) && (s === "white" || s === "black"))
    .map(([kind, side, art]) => ({ kind: kind as RigKind, side: side as RigSide, art: art === "old" ? "old" : "new" }));
}

const facing = (side: RigSide) => side === "white" ? 1 : -1;
const name = (s: Spec) => `${s.side === "white" ? "Rebel" : "Patrol"} ${s.kind}${s.art === "old" ? " (old art)" : ""}`;

function Rig({ spec, px, action = "idle", frac = .25, wounded, defending, label }: { spec: Spec; px: number; action?: RigAction; frac?: number; wounded?: boolean; defending?: boolean; label?: string }) {
  return <figure className="sheet-cell" data-frac={frac} data-px={px}>
    <div style={{ width: px }}><PieceRig kind={spec.kind} side={spec.side} art={spec.art} facing={facing(spec.side)} action={action} wounded={wounded} defending={defending} seed="sheet" /></div>
    {label && <figcaption>{label}</figcaption>}
  </figure>;
}

function RigRows({ spec }: { spec: Spec }) {
  return <section className="sheet-rig">
    <h2>{name(spec)}</h2>
    <div className="sheet-row">
      {SIZES.map(px => <Rig key={px} spec={spec} px={px} label={`${px}px`} />)}
      <div className="sheet-sil"><Rig spec={spec} px={48} label="silhouette 48px" /></div>
      <div className="sheet-grey"><Rig spec={spec} px={84} label="greyscale" /></div>
    </div>
    <div className="sheet-row">
      <Rig spec={spec} px={84} label="idle" />
      <Rig spec={spec} px={84} wounded label="wounded" />
      <Rig spec={spec} px={84} defending label="guarding" />
    </div>
    {ACTIONS.map(a => <div key={a} className="sheet-row sheet-frames"><b>{a}</b>
      {FRACS.map(f => <Rig key={f} spec={spec} px={84} action={a} frac={f} label={`${Math.round(f * 100)}%`} />)}</div>)}
  </section>;
}

export function Sheet({ specs }: { specs: Spec[] }) {
  const sides = [...new Set(specs.map(s => s.side))];
  return <main id="sheet">
    {specs.map(s => <RigRows key={`${s.kind}${s.side}${s.art}`} spec={s} />)}
    <section className="sheet-rig"><h2>Next to the rest of the cast at 84px</h2>
      {sides.map(side => <div key={side} className="sheet-row sheet-cast">
        {specs.filter(s => s.side === side).map(s => <Rig key={s.kind + s.art} spec={s} px={84} label="new" />)}
        {KINDS.filter(k => !specs.some(s => s.side === side && s.kind === k)).map(k => <Rig key={k} spec={{ kind: k, side, art: "old" }} px={84} label={k} />)}
      </div>)}
    </section>
  </main>;
}
