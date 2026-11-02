import { PieceRig, RIG_MS, type ArtStyle, type RigAction, type RigKind, type RigSide } from "../components/PieceRig";
import { skinById } from "../components/skins";
import { hasSprite } from "../components/SpriteRig";

/** The judge sheet: `art.html?sheet=pawn.white,pawn.black` (the SVG shape kit; append
 * `.paint` for the painted sprites, or a skin id such as
 * `.frog-pot` for a skin).
 * tools/art/shoot.mjs opens it, freezes every animation at the `data-frac` of
 * its cell and saves one PNG. */

type Spec = { kind: RigKind; side: RigSide; art: ArtStyle; skin?: string };
const KINDS: RigKind[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const SIZES = [48, 84, 192];
const ACTIONS: RigAction[] = ["move", "attack", "defend", "hit", "death", "cheer", "morph-out"];
const KNIGHT_ACTIONS: RigAction[] = ["leap", "leap-back"];
/** Queens are what pawns promote into, so their sheet shows the morph-in too. */
const QUEEN_ACTIONS: RigAction[] = ["morph-in"];
/** Only kings play the checkmate finale, which throws the crown off. */
const KING_ACTIONS: RigAction[] = ["mate"];
const FRACS = [0, .2, .35, .5, .65, .85];

export function parseSheet(q: string): Spec[] {
  return q.split(",").map(s => s.split(".")).filter(([k, s]) => KINDS.includes(k as RigKind) && (s === "white" || s === "black"))
    .map(([kind, side, extra]) => {
      const skin = skinById(extra);
      return { kind: kind as RigKind, side: side as RigSide, art: extra === "paint" && hasSprite(kind as RigKind, side === "white") ? "paint" : "new", skin: skin?.kind === kind && side === "white" ? skin.id : undefined };
    });
}

const facing = (side: RigSide) => side === "white" ? 1 : -1;
const name = (s: Spec) => `${s.side === "white" ? "Rebel" : "Patrol"} ${s.kind}${s.skin ? ` · skin: ${skinById(s.skin)!.name}` : s.art === "paint" ? " (painted sprite)" : ""}`;

function Rig({ spec, px, action = "idle", frac = .25, wounded, defending, label }: { spec: Spec; px: number; action?: RigAction; frac?: number; wounded?: boolean; defending?: boolean; label?: string }) {
  return <figure className="sheet-cell" data-frac={frac} data-ms={RIG_MS[action] || 1000} data-px={px}>
    <div style={{ width: px }}><PieceRig kind={spec.kind} side={spec.side} art={spec.art} facing={facing(spec.side)} action={action} wounded={wounded} defending={defending ?? action === "defend"} seed="sheet" skin={spec.skin} /></div>
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
    {[...ACTIONS, ...(spec.kind === "knight" ? KNIGHT_ACTIONS : []), ...(spec.kind === "queen" ? QUEEN_ACTIONS : []), ...(spec.kind === "king" ? KING_ACTIONS : [])].map(a => <div key={a} className="sheet-row sheet-frames"><b>{a}</b>
      {FRACS.map(f => <Rig key={f} spec={spec} px={84} action={a} frac={f} label={`${Math.round(f * 100)}%`} />)}</div>)}
  </section>;
}

export function Sheet({ specs }: { specs: Spec[] }) {
  const sides = [...new Set(specs.map(s => s.side))];
  return <main id="sheet">
    {specs.map(s => <RigRows key={`${s.kind}${s.side}${s.art}${s.skin ?? ""}`} spec={s} />)}
    <section className="sheet-rig"><h2>Next to the rest of the cast at 84px</h2>
      {sides.map(side => <div key={side} className="sheet-row sheet-cast">
        {specs.filter(s => s.side === side).map(s => <Rig key={s.kind + s.art + (s.skin ?? "")} spec={s} px={84} label={s.skin ?? `${s.kind} · ${s.art}`} />)}
        {KINDS.filter(k => !specs.some(s => s.side === side && s.kind === k)).map(k => <Rig key={k} spec={{ kind: k, side, art: "paint" }} px={84} label={k} />)}
      </div>)}
    </section>
  </main>;
}
