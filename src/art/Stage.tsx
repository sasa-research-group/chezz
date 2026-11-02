import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PieceRig, RIG_MS } from "../components/PieceRig";
import type { RigAction, RigKind, RigSide } from "../components/PieceRig";
import { KINDS } from "./kit";

export type SpriteId = `${"rebel" | "patrol"}-${RigKind}`;
export const SPRITES: SpriteId[] = (["rebel", "patrol"] as const).flatMap(f => KINDS.map(k => `${f}-${k}` as SpriteId));
export const isSprite = (id: string): id is SpriteId => (SPRITES as string[]).includes(id);

/** Each button's take: actions and their start times in ms at 1×, timed as App.tsx plays them. */
type Take = { id: string; label: string; steps: [RigAction, number][]; only?: RigKind };
const LEAP_HOME = RIG_MS.leap + 380;
const TAKES: Take[] = [
  { id: "idle", label: "Idle", steps: [] },
  { id: "move", label: "Move", steps: [["move", 0]] },
  { id: "attack", label: "Attack", steps: [["attack", 0]] },
  { id: "defend", label: "Defend", steps: [["defend", 0]] },
  { id: "hit", label: "Hit", steps: [["hit", 0]] },
  { id: "death", label: "Death", steps: [["death", 0]] },
  { id: "cheer", label: "Cheer", steps: [["cheer", 0]] },
  { id: "promote", label: "Promote", steps: [["morph-out", 0], ["morph-in", RIG_MS["morph-out"]]] },
  { id: "leap", label: "Leap", only: "knight", steps: [["leap", 0], ["attack", RIG_MS.leap], ["leap-back", LEAP_HOME]] },
  { id: "mate", label: "Checkmate", only: "king", steps: [["mate", 0]] },
];
/** Takes that end on the floor stay down this long (ms, real time) before the piece gets up. */
const REST: Partial<Record<RigAction, number>> = { death: 1200, mate: 1200 };
const SPEEDS = [1, .5, .25, .1];
const SPEED_LABEL: Record<number, string> = { 1: "1×", .5: "0.5×", .25: "0.25×", .1: "0.1×" };

function Segmented<T extends string | number>({ label, value, options, onPick, name = String }: { label: string; value: T; options: T[]; onPick: (v: T) => void; name?: (v: T) => string }) {
  return <div className="stage-field"><span>{label}</span><div className="seg" role="group" aria-label={label}>
    {options.map(o => <button key={o} type="button" aria-pressed={o === value} onClick={() => onPick(o)}>{name(o)}</button>)}
  </div></div>;
}

export function Stage({ id, onPick }: { id: SpriteId; onPick: (id: SpriteId) => void }) {
  const [faction, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
  const side: RigSide = faction === "rebel" ? "white" : "black";
  const [anim, setAnim] = useState<{ action: RigAction; key: number; take: string }>({ action: "idle", key: 0, take: "idle" });
  const [speed, setSpeed] = useState(1);
  const [facing, setFacing] = useState<1 | -1>(side === "white" ? 1 : -1);
  const [large, setLarge] = useState(true);
  const [wounded, setWounded] = useState(false);
  const [guarding, setGuarding] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const keys = useRef(0);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; };
  useEffect(() => { stop(); setAnim({ action: "idle", key: ++keys.current, take: "idle" }); setFacing(side === "white" ? 1 : -1); }, [id]);
  useEffect(() => stop, []);

  // Slow modes stretch time the way the game's own speed does: every keyframe runs for ms × --spd.
  const spd = 1 / speed;
  const play = (take: Take) => {
    stop();
    if (!take.steps.length) { setAnim({ action: "idle", key: ++keys.current, take: take.id }); return; }
    for (const [action, at] of take.steps) {
      const show = () => setAnim({ action, key: ++keys.current, take: take.id });
      if (at) timers.current.push(setTimeout(show, at * spd)); else show();
    }
    const [last, at] = take.steps[take.steps.length - 1];
    timers.current.push(setTimeout(() => setAnim({ action: "idle", key: ++keys.current, take: "idle" }), (at + RIG_MS[last]) * spd + (REST[last] ?? 0)));
  };

  const takes = TAKES.filter(t => !t.only || t.only === kind);
  return <div className="stage-area">
    <div className={`stage-canvas ${large ? "large" : "board"}`} style={{ "--spd": spd } as CSSProperties} data-take={anim.take}>
      <div className="stage-board" aria-hidden="true">{Array.from({ length: 25 }, (_, i) => <i key={i} className={(i % 5 + Math.floor(i / 5)) % 2 ? "grass" : "sand"} />)}</div>
      <div className="stage-piece">
        <PieceRig key={anim.key} kind={kind} side={side} action={anim.action} facing={facing} wounded={wounded} defending={guarding || anim.action === "defend"} seed="stage" art="paint" />
      </div>
    </div>
    <div className="stage-controls">
      <label className="stage-field"><span>Piece</span>
        <select value={id} onChange={e => onPick(e.target.value as SpriteId)}>
          {(["rebel", "patrol"] as const).map(f => <optgroup key={f} label={f === "rebel" ? "Friendly" : "Enemy"}>
            {KINDS.map(k => <option key={k} value={`${f}-${k}`}>{f === "rebel" ? "Rebel" : "Patrol"} {k}</option>)}
          </optgroup>)}
        </select>
      </label>
      <div className="stage-field"><span>Animation</span><div className="takes" role="group" aria-label="Animation">
        {takes.map(t => <button key={t.id} type="button" className={anim.take === t.id ? "playing" : ""} onClick={() => play(t)}>{t.label}</button>)}
      </div></div>
      <div className="stage-field"><span>State</span><div className="seg" role="group" aria-label="State">
        <button type="button" aria-pressed={wounded} onClick={() => setWounded(w => !w)}>Wounded</button>
        <button type="button" aria-pressed={guarding} onClick={() => setGuarding(g => !g)}>Guarding</button>
      </div></div>
      <Segmented label="Speed" value={speed} options={SPEEDS} onPick={v => { stop(); setAnim({ action: "idle", key: ++keys.current, take: "idle" }); setSpeed(v); }} name={v => SPEED_LABEL[v]} />
      <Segmented label="Facing" value={facing} options={[-1, 1] as (1 | -1)[]} onPick={setFacing} name={v => v === 1 ? "Right" : "Left"} />
      <Segmented label="Size" value={large ? "Large" : "Board"} options={["Board", "Large"]} onPick={v => setLarge(v === "Large")} />
    </div>
  </div>;
}
