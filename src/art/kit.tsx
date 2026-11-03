import type { CSSProperties, ReactNode } from "react";
import { INK } from "../components/PieceRig";
import type { RigKind, RigSide } from "../components/PieceRig";
import { spriteBox } from "../components/SpriteRig";

export const KINDS: RigKind[] = ["king", "queen", "rook", "bishop", "knight", "pawn"];

/** A painted sprite as one still image, placed and sized exactly as the game draws it (feet on
 * y 108, patrol mirrored), with its side's ground marker. No animation, so it costs nothing to show. */
export function SpriteStill({ kind, side, skin, className = "" }: { kind: RigKind; side: RigSide; skin?: string; className?: string }) {
  const rebel = side === "white", box = spriteBox(kind, rebel, skin);
  return <svg className={`sprite-still ${className}`} viewBox="0 0 100 120" aria-hidden="true">
    {rebel ? <ellipse cx="50" cy="108" rx="28" ry="6" fill={INK} opacity=".22" /> : <path d="M22 108 L50 102 L78 108 L50 114 Z" fill={INK} opacity=".22" />}
    {box && <image href={box.href} x={box.x} y={box.y} width={box.w} height={box.h} preserveAspectRatio="none" transform={rebel ? undefined : "matrix(-1 0 0 1 100 0)"} />}
  </svg>;
}

/** A labelled specimen: what it is, where it lives, and the art itself. */
export function Entry({ name, src, note, wide, children }: { name: string; src: string; note?: ReactNode; wide?: boolean; children: ReactNode }) {
  return <figure className={`entry ${wide ? "wide" : ""}`}>
    <div className="entry-art">{children}</div>
    <figcaption><b>{name}</b><code>{src}</code>{note && <span>{note}</span>}</figcaption>
  </figure>;
}
export function Group({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section className="group" id={id} aria-labelledby={`${id}-h`}>
    <h3 id={`${id}-h`}>{title}</h3>
    <div className="entries">{children}</div>
  </section>;
}

export type Piece = { kind: RigKind; side: RigSide; x: number; y: number; cls?: string; hp?: number; max?: number; extra?: ReactNode };
export type Cell = { cls?: string; dot?: ReactNode };
/** A small board built from the game's own board classes (exile.css), tilt and all, with still sprites. */
export function MiniBoard({ cols, rows, cells = {}, pieces = [], style, overlay }: { cols: number; rows: number; cells?: Record<string, Cell>; pieces?: Piece[]; style?: CSSProperties; overlay?: ReactNode }) {
  return <div className="board-camera" style={{ "--cols": cols, "--rows": rows, ...style } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${cols}/${rows}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = i % cols, y = Math.floor(i / cols), c = cells[`${x},${y}`];
          return <div key={i} className={`exile-cell ${(x + y) % 2 ? "grass" : "sand"} ${c?.cls ?? ""}`}>{c?.dot}</div>;
        })}
      </div>
      {overlay}
      <div className="piece-layer">{pieces.map((p, i) =>
        <div key={i} className={`exile-piece ${p.side} ${p.cls ?? ""}`} style={{ left: `${(p.x + .5) / cols * 100}%`, top: `${(p.y + .5) / rows * 100}%`, width: `${92 / cols}%`, zIndex: Math.round(p.y * 10 + 30) }}>
          <SpriteStill kind={p.kind} side={p.side} className="rig" />
          {p.extra}
          {p.hp !== undefined && <span className="piece-health">{p.hp}<small> / {p.max}</small></span>}
        </div>)}</div>
    </div>
  </div>;
}
