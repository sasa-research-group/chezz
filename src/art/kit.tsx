import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { PieceRig, RIG_MS } from "../components/PieceRig";
import type { PatrolHue, RigAction, RigKind, RigSide } from "../components/PieceRig";

/** Studio-wide playback: the speed scale the game uses (--spd) and the patrol colour. */
export const Studio = createContext<{ spd: number; hue: PatrolHue }>({ spd: 1, hue: "blue" });
export const useStudio = () => useContext(Studio);

/** Which phase of a looping timeline is showing. Marks are ms at 1x; it only runs while on screen. */
export function usePhase(marks: number[], period: number) {
  const { spd } = useStudio();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState({ phase: 0, cycle: 0 });
  const cycles = useRef(0);
  const key = marks.join() + period;
  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    const stop = () => { timers.forEach(clearTimeout); timers = []; };
    const run = () => {
      stop(); const cycle = ++cycles.current;
      marks.forEach((at, phase) => timers.push(setTimeout(() => setState({ phase, cycle }), at * spd)));
      if (Number.isFinite(period)) timers.push(setTimeout(run, period * spd));
    };
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) run(); else stop(); });
    if (ref.current) io.observe(ref.current);
    return () => { io.disconnect(); stop(); };
  }, [key, spd]);
  return { ref, ...state };
}

/** Actions whose last frame is empty or squashed flat: the loop freezes on a readable pose this far in instead. */
const HOLD: Partial<Record<RigAction, number>> = { death: .5, mate: .3, "morph-out": .35 };
/** One rig replaying an action on a loop. */
export function LoopRig({ kind, side, action, wounded, defending, pause = 700, facing }: { kind: RigKind; side: RigSide; action: RigAction; wounded?: boolean; defending?: boolean; pause?: number; facing?: 1 | -1 }) {
  const { hue } = useStudio();
  const hold = HOLD[action] && RIG_MS[action] * HOLD[action]!;
  const { ref, cycle, phase } = usePhase(hold ? [0, hold] : [0], action === "idle" ? Infinity : hold ? hold + 1200 : RIG_MS[action] + pause);
  return <div ref={ref} className={`loop-rig ${hold && phase ? "held" : ""}`}><PieceRig key={cycle} kind={kind} side={side} hue={hue} action={action} wounded={wounded} defending={defending ?? action === "defend"} facing={facing ?? (side === "white" ? 1 : -1)} seed={`${kind}${side}${action}`} /></div>;
}

/** A labelled specimen: what it is, where it lives, and the art itself. */
export function Entry({ name, src, note, wide, children }: { name: string; src: string; note?: ReactNode; wide?: boolean; children: ReactNode }) {
  return <figure className={`entry ${wide ? "wide" : ""}`}>
    <div className="entry-art">{children}</div>
    <figcaption><b>{name}</b><code>{src}</code>{note && <span>{note}</span>}</figcaption>
  </figure>;
}
export function Group({ id, title, intro, children }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return <section className="group" id={id} aria-labelledby={`${id}-h`}>
    <h3 id={`${id}-h`}>{title}</h3>{intro && <p className="group-intro">{intro}</p>}
    <div className="entries">{children}</div>
  </section>;
}

export type Piece = { kind: RigKind; side: RigSide; x: number; y: number; cls?: string; action?: RigAction; actionKey?: number; defending?: boolean; wounded?: boolean; hp?: number; max?: number; facing?: 1 | -1; extra?: ReactNode };
export type Cell = { cls?: string; dot?: ReactNode };
/** A small board built from the game's own board classes (exile.css), tilt and all. */
export function MiniBoard({ cols, rows, cells = {}, pieces = [], camera = "", style, coords }: { cols: number; rows: number; cells?: Record<string, Cell>; pieces?: Piece[]; camera?: string; style?: CSSProperties; coords?: boolean }) {
  const { spd, hue } = useStudio();
  return <div className={`board-camera ${camera}`} style={{ "--aspect": cols / rows, ...style } as CSSProperties}>
    <div className="board-plane" style={{ aspectRatio: `${cols}/${rows}` }}>
      <div className="exile-grid" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {Array.from({ length: cols * rows }, (_, i) => {
          const x = i % cols, y = Math.floor(i / cols), c = cells[`${x},${y}`];
          return <div key={i} className={`exile-cell ${(x + y) % 2 ? "grass" : "sand"} ${c?.cls ?? ""}`}>{coords && <span className="tile-coord">{"abcdefgh"[x]}{rows - y}</span>}{c?.dot}</div>;
        })}
      </div>
      <div className="piece-layer" style={{ "--spd": spd } as CSSProperties}>{pieces.map((p, i) =>
        <div key={i} className={`exile-piece ${p.side} ${p.cls ?? ""}`} style={{ left: `${(p.x + .5) / cols * 100}%`, top: `${(p.y + .5) / rows * 100}%`, width: `${92 / cols}%`, zIndex: Math.round(p.y * 10 + 30) }}>
          <PieceRig key={`rig${p.actionKey ?? 0}`} kind={p.kind} side={p.side} hue={hue} action={p.action ?? "idle"} defending={!!p.defending} wounded={p.wounded} facing={p.facing ?? (p.side === "white" ? 1 : -1)} seed={`${p.kind}${i}`} />
          {p.extra}
          {p.hp !== undefined && <span className="piece-health">{p.hp}<small> / {p.max}</small></span>}
        </div>)}</div>
    </div>
  </div>;
}
