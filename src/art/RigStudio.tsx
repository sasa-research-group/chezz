import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { PieceRig, RIG_MS } from "../components/PieceRig";
import type { ArtStyle, RigAction, RigKind, RigSide } from "../components/PieceRig";
import { SKINS, skinById } from "../components/skins";
import { useStudio } from "./kit";
import { apply, chain, classesOf, compounds, corners, groupName, isFx, labelStacks, parsePivot, splitList, takeLength, targetClasses, unsetPivot } from "./rigModel";
import type { Box, Pt, Sample, Skeleton } from "./rigModel";
import "./rig-studio.css";

/* The Rig area: every rig group, its pivot and its bones, read from the live
   DOM and the stylesheets, so any art style that keeps the group names works. */

const KINDS: RigKind[] = ["pawn", "knight", "bishop", "rook", "queen", "king"];
const SIDES: [RigSide, string][] = [["white", "Rebel"], ["black", "Patrol"]];
const ARTS: [string, string][] = [["old", "Old"], ["new", "SVG kit"], ["paint", "Sprite"]];
const SPEEDS = [.25, .5, 1, 1.5, 2];
const FRAME = 1000 / 30;
const GHOSTS = [1, 2, 3, 4];
const SVGNS = "http://www.w3.org/2000/svg";

type Spec = { kind: RigKind; side: RigSide; art: string; skin?: string };
type Clip = { id: string; label: string; action: RigAction; defending?: boolean; wounded?: boolean; quirk?: boolean };
const BASE_CLIPS: Clip[] = [
  { id: "idle", label: "idle", action: "idle" },
  { id: "wounded", label: "wounded", action: "idle", wounded: true },
  { id: "guarding", label: "guarding", action: "idle", defending: true },
  ...(Object.keys(RIG_MS) as RigAction[]).filter(a => a !== "idle").map(a => ({ id: a, label: a, action: a, defending: a === "defend" })),
];

/** What each group is for. Unknown groups still show; they just get no note. */
const MEANING: Record<string, string> = {
  rig: "whole figure · idle breathe",
  flip: "facing mirror · death fade",
  hop: "jump height · knight flips",
  squash: "body · squash, lean, lunge",
  "arm-back": "back arm · cheer",
  "arm-front": "front arm · cheer, slap",
  prop: "weapon · swings at the hand",
  "head-tilt": "head pop · death",
  head: "head · skin hover, peck",
  eyes: "blink · bulge",
  pupil: "look · dart, shrink",
  crown: "crown · flies off on mate",
  door: "rook's guard door",
  shield: "guard shield",
  "quirk-bit": "skin extra · croak, mitre",
};

type Rule = { selectors: string[]; style: CSSStyleDeclaration };
/** Every plain style rule that styles a `.rig …` group (media rules are skipped). */
function rigRules(): Rule[] {
  const out: Rule[] = [];
  for (const sheet of [...document.styleSheets]) {
    let rules: CSSRuleList;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const r of [...rules]) if (r instanceof CSSStyleRule) {
      const selectors = splitList(r.selectorText).filter(s => targetClasses(s));
      if (selectors.length) out.push({ selectors, style: r.style });
    }
  }
  return out;
}
/** Class names the stylesheets animate, transform or pivot: the rig's groups. */
function rigGroups(): Set<string> {
  const names = new Set<string>();
  for (const { selectors, style } of rigRules()) {
    const moves = (style.animationName && style.animationName !== "none") || style.transform || style.transformOrigin;
    if (moves) selectors.forEach(s => targetClasses(s)!.forEach(c => names.add(c)));
  }
  return names;
}
/** Skin quirk takes: the actions a `.quirk-*` class has rules for. */
function quirkClips(quirk?: string): Clip[] {
  if (!quirk) return [];
  const acts = new Set<string>();
  for (const { selectors } of rigRules()) for (const s of selectors) {
    const first = classesOf(compounds(s)![0]);
    if (first.includes(quirk)) first.filter(c => c.startsWith("act-")).forEach(c => acts.add(c.slice(4)));
  }
  const name = quirk.replace(/^quirk-/, "");
  return [...acts].filter(a => a in RIG_MS).map(a => ({ id: `${quirk}:${a}`, label: name, action: a as RigAction, quirk: true }));
}

type El = { el: SVGGraphicsElement; id: string; name: string; fx: boolean };
function rigEls(svg: SVGSVGElement, groups: Set<string>, withFx: boolean): El[] {
  const count = new Map<string, number>();
  return [svg, ...svg.querySelectorAll("*")].flatMap(el => {
    const name = groupName([...el.classList], groups);
    if (!name || !(el instanceof SVGGraphicsElement) || (!withFx && isFx(name))) return [];
    const n = (count.get(name) ?? 0) + 1; count.set(name, n);
    return [{ el, name, id: n > 1 ? `${name}#${n}` : name, fx: isFx(name) }];
  });
}
function parentId(e: El, all: El[], svg: SVGSVGElement) {
  for (let p: Element | null = e.el.parentElement; p && p !== svg.parentElement; p = p.parentElement) {
    const hit = all.find(o => o.el === p && !o.fx);
    if (hit) return hit.id;
  }
  return null;
}
/** The root's pivot is in CSS pixels of its layout box; this puts it in viewBox units. */
function rootPivot(svg: SVGSVGElement, cs: CSSStyleDeclaration): Pt {
  const [ox, oy] = cs.transformOrigin.split(/\s+/).map(parseFloat), vb = svg.viewBox.baseVal;
  return { x: vb.x + ox / parseFloat(cs.width) * vb.width, y: vb.y + oy / parseFloat(cs.height) * vb.height };
}
const bboxOf = (el: SVGGraphicsElement): Box => { try { const b = el.getBBox(); return { x: b.x, y: b.y, width: b.width, height: b.height }; } catch { return { x: 0, y: 0, width: 0, height: 0 }; } };
const flat = (m: DOMMatrix) => Math.abs(m.a * m.d - m.b * m.c) < 1e-3;
const ctm = (el: Element | null) => el instanceof SVGGraphicsElement ? el.getScreenCTM() : null;

/** Every group's pivot, parent and box this frame, in the overlay's viewBox units. */
function sample(svg: SVGSVGElement, overlay: SVGSVGElement, groups: Set<string>): Sample[] {
  const toOverlay = overlay.getScreenCTM()?.inverse();
  if (!toOverlay) return [];
  const els = rigEls(svg, groups, false);
  return els.map(e => {
    const { el, id, name } = e, root = el === svg, cs = getComputedStyle(el);
    const own = el.getScreenCTM(), par = root ? own : ctm(el.parentElement);
    const parent = parentId(e, els, svg), bbox = bboxOf(el);
    if (!own || !par) return { id, name, parent, pivot: { x: 0, y: 0 }, parentM: new DOMMatrix(), m: new DOMMatrix(), bbox, hidden: true, unset: true };
    const m = toOverlay.multiply(own);
    const hidden = cs.display === "none" || +cs.opacity === 0 || flat(m);
    return { id, name, parent, pivot: root ? rootPivot(svg, cs) : parsePivot(cs.transformOrigin, cs.transformBox, bbox), parentM: toOverlay.multiply(par), m, bbox, hidden, unset: !root && unsetPivot(cs.transformOrigin, cs.transformBox) };
  });
}

type Part = {
  id: string; name: string; parent: string | null; fx: boolean; boxKind: string; pivot: Pt | null;
  rest: string | null; mini: string | null;
  anims: { name: string; clips: string[] }[]; overrides: { at: Pt; clips: string[] }[];
};
const fmt = (p: Pt | null) => !p ? "unset" : `${+p.x.toFixed(1)}, ${+p.y.toFixed(1)}`;
const mat = (m: DOMMatrix) => `matrix(${[m.a, m.b, m.c, m.d, m.e, m.f].map(v => +v.toFixed(3)).join(" ")})`;

/** Clones the rig off-screen, freezes it at rest and cuts every group out on its own
 * (child groups removed), then steps the clone through each take to read which
 * keyframes and pivots the cascade gives each group. */
function probe(svg: SVGSVGElement, groups: Set<string>, clips: Clip[]): Part[] {
  const host = document.createElement("div");
  host.className = "rs-probe rest";
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[id]").forEach(e => e.removeAttribute("id"));
  clone.style.setProperty("--face", "1");
  const base = [...svg.classList].filter(c => !/^(act-|is-)/.test(c));
  const dress = (c?: Clip) => clone.setAttribute("class", [...base, `act-${c?.action ?? "idle"}`, c?.defending ? "is-defending" : "", c?.wounded ? "is-wounded" : ""].filter(Boolean).join(" "));
  dress();
  host.append(clone);
  document.body.append(host);
  try {
    const toRoot = clone.getScreenCTM()!.inverse();
    const els = rigEls(clone, groups, true);
    const rest = els.map(e => {
      const { el, fx } = e, root = el === clone, cs = getComputedStyle(el);
      const P = root ? new DOMMatrix() : toRoot.multiply(ctm(el.parentElement) ?? new DOMMatrix());
      const pivot = root ? rootPivot(clone, cs) : unsetPivot(cs.transformOrigin, cs.transformBox) ? null : apply(P,parsePivot(cs.transformOrigin, cs.transformBox, bboxOf(el)));
      const own = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
      const why = cs.display === "none" ? "display: none" : +cs.opacity === 0 ? "opacity 0 at rest" : flat(own) ? "scale 0 at rest" : null;
      return { ...e, P, pivot, rest: why, mini: fx ? null : cutOut(el, root, P, own, cs, pivot) };
    });
    function cutOut(el: SVGGraphicsElement, root: boolean, P: DOMMatrix, own: DOMMatrix, cs: CSSStyleDeclaration, pivot: Pt | null) {
      const piece = root ? document.createElementNS(SVGNS, "g") : el.cloneNode(true) as SVGGraphicsElement;
      if (root) for (const ch of [...el.children]) piece.append(ch.cloneNode(true));
      piece.querySelectorAll("*").forEach(d => { if (groupName([...d.classList], groups)) d.remove(); });
      if (!root) Object.assign(piece.style, { transform: flat(own) ? "none" : cs.transform, transformOrigin: cs.transformOrigin, transformBox: cs.transformBox, opacity: "1", display: "inline", filter: "none" });
      (root ? clone : el.parentElement!).append(piece);
      const b = bboxOf(piece), M = toRoot.multiply(piece.getScreenCTM() ?? new DOMMatrix());
      piece.remove();
      if (b.width + b.height === 0) return null;
      const pts = [...corners(b).map(p => apply(M, p)), ...(pivot ? [pivot] : [])], pad = 3;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const [x0, y0] = [Math.min(...xs) - pad, Math.min(...ys) - pad], [w, h] = [Math.max(...xs) + pad - x0, Math.max(...ys) + pad - y0];
      return `<svg xmlns="${SVGNS}" class="${base.join(" ")} rs-part-svg" viewBox="${x0} ${y0} ${w} ${h}" style="${clone.getAttribute("style") ?? ""}"><g transform="${mat(P)}">${piece.outerHTML}</g>${pivot ? `<circle class="rs-mini-pivot" cx="${pivot.x}" cy="${pivot.y}" r="${Math.max(w, h) / 40 + .8}"/>` : ""}</svg>`;
    }
    host.classList.remove("rest");
    const anims = els.map(() => new Map<string, string[]>()), moved = els.map(() => new Map<string, { at: Pt; clips: string[] }>());
    for (const c of clips) {
      dress(c);
      rest.forEach((r, i) => {
        const cs = getComputedStyle(r.el);
        const names = cs.animationName.split(",").map(s => s.trim()).filter(n => n && n !== "none");
        for (const n of names) anims[i].set(n, [...(anims[i].get(n) ?? []), c.label]);
        if (!names.length) return;
        const at =r.el === clone ? rootPivot(clone, cs) : unsetPivot(cs.transformOrigin, cs.transformBox) ? null : apply(r.P, parsePivot(cs.transformOrigin, cs.transformBox, bboxOf(r.el)));
        if (at && (!r.pivot || Math.hypot(at.x - r.pivot.x, at.y - r.pivot.y) > .5)) {
          const k = fmt(at), o = moved[i].get(k) ?? { at, clips: [] };
          o.clips.push(c.label); moved[i].set(k, o);
        }
      });
    }
    return rest.map((r, i) => ({
      id: r.id, name: r.name, fx: r.fx, parent: r.fx ? null : parentId(r, els, clone), boxKind: getComputedStyle(r.el).transformBox,
      pivot: r.pivot, rest: r.rest, mini: r.mini,
      anims: [...anims[i]].map(([name, clips]) => ({ name, clips: [...new Set(clips)] })), overrides: [...moved[i].values()],
    }));
  } finally { host.remove(); }
}

/** The stylesheets' reduced-motion blocks switch the rig's animations off, so the
 * player could not step through them. While this area is open they are lifted;
 * the player starts paused instead and only moves when asked. */
function useSteppableUnderReducedMotion(reduced: boolean) {
  useLayoutEffect(() => {
    if (!reduced) return;
    const lifted: [MediaList, string][] = [];
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const r of [...rules]) if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.media.mediaText)) { lifted.push([r.media, r.media.mediaText]); r.media.mediaText = "not all"; }
    }
    return () => lifted.forEach(([m, text]) => { m.mediaText = text; });
  }, [reduced]);
}

/** Whether PieceRig draws a painted sprite for this piece: `art="paint"` falls back to the SVG kit (`art="new"`) where it has none. */
const PaintProbe = memo(function PaintProbe({ kind, side, onResult }: { kind: RigKind; side: RigSide; onResult: (ready: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const [a, b] = [...ref.current!.querySelectorAll("svg")].map(s => s.outerHTML.replace(/boil-\d+/g, ""));
    onResult(a !== b);
  }, [kind, side, onResult]);
  return <div ref={ref} className="rs-offstage" aria-hidden="true">
    <PieceRig kind={kind} side={side} art={"paint" as ArtStyle} seed={0} />
    <PieceRig kind={kind} side={side} art="new" seed={0} />
  </div>;
});

function Seg<T extends string | number>({ label, value, options, onPick, disabled }: { label: string; value: T; options: [T, string][]; onPick: (v: T) => void; disabled?: (v: T) => string | undefined }) {
  return <div className="rs-seg" role="group" aria-label={label}><span>{label}</span><div>
    {options.map(([v, l]) => { const off = disabled?.(v); return <button key={String(v)} type="button" aria-pressed={value === v} disabled={!!off} title={off} onClick={() => onPick(v)}>{l}</button>; })}
  </div></div>;
}
const Toggle = ({ on, set, children }: { on: boolean; set: (v: boolean) => void; children: string }) =>
  <button type="button" className="rs-toggle" aria-pressed={on} onClick={() => set(!on)}>{children}</button>;

const BonesLayer = memo(function BonesLayer({ skel, hl, labels }: { skel: Skeleton; hl: string | null; labels: boolean }) {
  const off = new Set(skel.joints.filter(j => j.hidden).map(j => j.id));
  return <>
    {skel.boxes.map(b => <polygon key={b.id} className={`rs-box ${hl === b.id ? "on" : ""}`} points={b.pts.map(p => `${p.x},${p.y}`).join(" ")} />)}
    {skel.links.map(l => <line key={l.to} className={`rs-link ${off.has(l.to) ? "off" : ""}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} />)}
    {skel.joints.map(j => <circle key={j.id} data-part={j.id} className={`rs-joint ${j.hidden ? "off" : ""} ${hl === j.id ? "on" : ""}`} cx={j.at.x} cy={j.at.y} r={hl === j.id ? 2.4 : 1.5} />)}
    {labels && labelStacks(skel.joints).map((s, i) => <text key={i}className="rs-label" x={s.at.x + 2.4} y={s.at.y - 1.8}>{s.names.join(" · ")}</text>)}
  </>;
});

const PartsGrid = memo(function PartsGrid({ parts, hl, onHl }: { parts: Part[]; hl: string | null; onHl: (id: string | null) => void }) {
  return <div className="rs-parts">{parts.filter(p => !p.fx).map(p =>
    <button key={p.id} type="button" className={`rs-part ${hl === p.id ? "on" : ""}`} data-part={p.id} onMouseEnter={() => onHl(p.id)} onMouseLeave={() => onHl(null)} onFocus={() => onHl(p.id)} onBlur={() => onHl(null)} onClick={() => onHl(p.id)}>
      {p.mini ? <span className="rs-mini" dangerouslySetInnerHTML={{ __html: p.mini }} /> : <span className="rs-mini empty">no art<br />moves children</span>}
      <b>{p.id}</b>
      <small>{p.parent ? `in ${p.parent}` : "root"}{p.rest ? ` · ${p.rest}` : ""}</small>
    </button>)}</div>;
});

const DataTable = memo(function DataTable({ parts, hl, onHl }: { parts: Part[]; hl: string | null; onHl: (id: string | null) => void }) {
  return <div className="rs-table-wrap"><table className="rs-table">
    <thead><tr><th scope="col">Group</th><th scope="col">Parent</th><th scope="col">Pivot</th><th scope="col">Keyframes</th></tr></thead>
    <tbody>{[...parts].sort((a, b) => +a.fx - +b.fx).map(p => <tr key={p.id} className={`${p.fx ? "fx" : ""} ${hl === p.id ? "on" : ""}`} onMouseEnter={() => p.fx || onHl(p.id)} onMouseLeave={() => onHl(null)}>
      <th scope="row"><code>.{p.name}</code>{p.id !== p.name && <small> {p.id.split("#")[1]}</small>}{p.fx && <span className="tag">fx</span>}</th>
      <td>{p.fx ? "—" : p.parent ?? "root"}</td>
      <td><code>{fmt(p.pivot)}</code>{p.boxKind === "fill-box" && <small> fill-box</small>}
        {p.overrides.map(o => <div key={fmt(o.at)} className="rs-override"><code>{fmt(o.at)}</code> <small>{o.clips.join(", ")}</small></div>)}</td>
      <td>{p.anims.length ? p.anims.map(a => <div key={a.name} className="rs-kf"><code>{a.name}</code> <small>{a.clips.join(", ")}</small></div>) : <small>none</small>}</td>
    </tr>)}</tbody>
  </table></div>;
});

export function RigStudio() {
  const { hue } = useStudio();
  const reduced = useMemo(() => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  useSteppableUnderReducedMotion(reduced);
  const [spec, setSpec] = useState<Spec>({ kind: "rook", side: "white", art: "new" });
  const [clipId, setClipId] = useState("attack");
  const [playing, setPlaying] = useState(!reduced);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(true);
  const [bones, setBones] = useState(true);
  const [bonesOnly, setBonesOnly] = useState(false);
  const [onion, setOnion] = useState(false);
  const [labels, setLabels] = useState(true);
  const [paintReady, setPaintReady] = useState(false);
  const [t, setT] = useState(0);
  const [len, setLen] = useState(1000);
  const [skel, setSkel] = useState<Skeleton>({ joints: [], links: [], boxes: [] });
  const [parts, setParts] = useState<Part[]>([]);
  const [hl, setHl] = useState<string | null>(null);
  const groups = useMemo(rigGroups, []);
  const skin = skinById(spec.skin);
  const clips = useMemo(() => [...BASE_CLIPS, ...quirkClips(skin?.quirk)], [skin?.quirk]);
  const clip = clips.find(c => c.id === clipId) ?? clips[0];
  const art = spec.skin || (spec.art === "paint" && !paintReady) ? "new" : spec.art;

  const figRef = useRef<HTMLDivElement>(null), overlayRef = useRef<SVGSVGElement>(null), ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const clock = useRef({ t: 0, len: 1000, playing, speed, loop, dirty: true, anims: [] as Animation[], ghosts: [] as Animation[][], svgs: [] as SVGSVGElement[] });
  Object.assign(clock.current, { playing, speed, loop });

  const rigKey = `${spec.kind}.${spec.side}.${art}.${spec.skin ?? ""}.${clip.id}.${hue}`;
  const specKey = `${spec.kind}.${spec.side}.${art}.${spec.skin ?? ""}.${hue}`;
  const figure = (k: string) => <PieceRig key={k} kind={spec.kind} side={spec.side} art={art as ArtStyle} skin={spec.skin} hue={hue} facing={spec.side === "white" ? 1 : -1} action={clip.action} defending={!!clip.defending} wounded={clip.wounded} seed={0} />;
  // rigKey covers every prop the figures take; memoising keeps the per-frame clock from re-rendering them.
  const main = useMemo(() => figure(rigKey), [rigKey]);
  const ghosts = useMemo(() => GHOSTS.map(k => figure(`${rigKey}.g${k}`)), [rigKey]);

  useLayoutEffect(() => {
    const c = clock.current, svg = figRef.current?.querySelector("svg");
    c.anims = svg ? svg.getAnimations({ subtree: true }) : [];
    c.ghosts = onion ? ghostRefs.current.slice(0, GHOSTS.length).map(d => d?.querySelector("svg")?.getAnimations({ subtree: true }) ?? []) : [];
    c.svgs = [...(figRef.current?.parentElement?.querySelectorAll<SVGSVGElement>("svg.rig") ?? [])];
    [...c.anims, ...c.ghosts.flat()].forEach(a => a.pause());
    c.len = takeLength(c.anims.map(a => { const tm = a.effect!.getComputedTiming(); return { delay: Number(tm.delay ?? 0), duration: Number(tm.duration) || 0, iterations: Number(tm.iterations ?? 1) }; }));
    c.t = Math.min(c.t, c.len); c.dirty = true;
    setLen(c.len);
  }, [rigKey, onion]);

  useLayoutEffect(() => {
    const svg = figRef.current?.querySelector("svg");
    if (svg) setParts(probe(svg, groups, clips));
  }, [specKey, clips, groups]);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const c = clock.current, dt = Math.min(now - last, 100);
      last = now;
      if (c.playing) {
        c.t += dt * c.speed; c.dirty = true;
        if (c.t >= c.len) { if (c.loop) c.t %= c.len; else { c.t = c.len; c.playing = false; setPlaying(false); } }
      }
      c.svgs.forEach(s => c.playing ? s.unpauseAnimations() : s.pauseAnimations());
      if (c.dirty) {
        c.dirty = false;
        c.anims.forEach(a => { a.currentTime = c.t; });
        c.ghosts.forEach((g, i) => {
          const at = c.t - (i + 1) * c.len / 8, wrapped = c.loop ? ((at % c.len) + c.len) % c.len : Math.max(0, at);
          g.forEach(a => { a.currentTime = wrapped; });
        });
        const svg = figRef.current?.querySelector("svg"), overlay = overlayRef.current;
        if (svg && overlay) setSkel(chain(sample(svg, overlay, groups)));
        setT(c.t);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [groups]);

  const seek = (ms: number) => { const c = clock.current; c.t = Math.max(0, Math.min(c.len, ms)); c.dirty = true; c.playing = false; setPlaying(false); };
  const play = () => { const c = clock.current; if (!playing && c.t >= c.len) c.t = 0; c.playing = !playing; setPlaying(!playing); };
  const pick = (id: string) => { setClipId(id); clock.current.t = 0; clock.current.dirty = true; if (!reduced) setPlaying(true); };
  const setKind = (kind: RigKind) => setSpec(s => ({ ...s, kind, skin: skinById(s.skin)?.kind === kind ? s.skin : undefined }));
  const skins: [string, string][] = [["", "None"], ...SKINS.filter(s => s.kind === spec.kind).map(s => [s.id, s.name] as [string, string])];
  const frames = Math.max(1, Math.round(len / FRAME));

  return <div className={`rig-studio ${reduced ? "rs-calm" : ""}`} style={{ "--spd": 1 } as CSSProperties}>
    <PaintProbe kind={spec.kind} side={spec.side} onResult={setPaintReady} />
    <section className="group" id="rig-stage" aria-labelledby="rig-stage-h">
      <h3 id="rig-stage-h">Player</h3>
      <div className="rs-picker">
        <Seg label="Piece" value={spec.kind} options={KINDS.map(k => [k, k])} onPick={setKind} />
        <Seg label="Side" value={spec.side} options={SIDES} onPick={side => setSpec(s => ({ ...s, side, skin: side === "white" ? s.skin : undefined }))} />
        <Seg label="Art" value={art} options={ARTS} onPick={a => setSpec(s => ({ ...s, art: a }))} disabled={a => a === "paint" && !paintReady ? "not built yet" : spec.skin ? "skins draw on the kit" : undefined} />
        <Seg label="Skin" value={spec.skin ?? ""} options={skins} onPick={id => { setSpec(s => ({ ...s, skin: id || undefined })); if (clip.quirk) setClipId("idle"); }} disabled={id => id && spec.side === "black" ? "rebels only" : undefined} />
      </div>
      <div className="rs-main">
        <div className="rs-frame">
          <div className="rs-stage">
            {onion && GHOSTS.map(k => <div key={k} className="rs-ghost" style={{ opacity: .34 - k * .06 }} ref={d => { ghostRefs.current[k - 1] = d; }}>{ghosts[k - 1]}</div>)}
            <div ref={figRef} className="rs-fig" style={{ opacity: bonesOnly ? 0 : 1 }}>{main}</div>
            <svg ref={overlayRef} className={`rs-bones ${bones || bonesOnly ? "" : "hide"}`} viewBox="0 0 100 120" role="img" aria-label="Bones">
              <BonesLayer skel={skel} hl={hl} labels={labels} />
            </svg>
          </div>
        </div>
        <div className="rs-side">
          <div className="rs-clips" role="group" aria-label="Action">
            {clips.map(c => <button key={c.id} type="button" className={c.quirk ? "quirk" : ""} aria-pressed={c.id === clip.id} onClick={() => pick(c.id)}>
              {c.label}{c.quirk && <small> {c.action}</small>}</button>)}
          </div>
          <div className="rs-transport">
            <button type="button" className="rs-play" onClick={play}>{playing ? "❚❚ Pause" : "▶ Play"}</button>
            <button type="button" onClick={() => seek(clock.current.t - FRAME)} aria-label="Previous frame">‹</button>
            <button type="button" onClick={() => seek(clock.current.t + FRAME)} aria-label="Next frame">›</button>
            <output>{Math.round(t)} / {len} ms · f{Math.min(frames, Math.round(t / FRAME))}/{frames}</output>
          </div>
          <input className="rs-scrub" type="range" min={0} max={len} step={1} value={Math.round(t)} aria-label="Scrub" onChange={e => seek(+e.target.value)} />
          <Seg label="Speed" value={speed} options={SPEEDS.map(v => [v, `${v}×`])} onPick={setSpeed} />
          <div className="rs-toggles" role="group" aria-label="View">
            <Toggle on={loop} set={setLoop}>Loop</Toggle>
            <Toggle on={bones} set={setBones}>Bones</Toggle>
            <Toggle on={bonesOnly} set={setBonesOnly}>Bones only</Toggle>
            <Toggle on={onion} set={setOnion}>Onion skin</Toggle>
            <Toggle on={labels} set={setLabels}>Labels</Toggle>
          </div>
          <ul className="rs-legend" aria-label="Legend">
            <li><i className="dot" />pivot</li><li><i className="bone" />parent → child</li><li><i className="box" />part box</li><li><i className="dot off" />hidden now</li>
          </ul>
          {reduced && <p className="fine">Reduced motion: paused. Step or scrub.</p>}
        </div>
      </div>
    </section>
    <section className="group" id="rig-parts" aria-labelledby="rig-parts-h">
      <h3 id="rig-parts-h">Parts</h3>
      <p className="fine">Each group cut out alone, child groups removed. Red dot: pivot. Hover to find it on the figure.</p>
      <PartsGrid parts={parts} hl={hl} onHl={setHl} />
    </section>
    <section className="group" id="rig-data" aria-labelledby="rig-data-h">
      <h3 id="rig-data-h">Rig data</h3>
      <p className="fine">Pivot in viewBox units at rest; extra rows where a take moves it. Keyframes per take, read from the cascade.</p>
      <DataTable parts={parts} hl={hl} onHl={setHl} />
    </section>
    <section className="group" id="rig-contract" aria-labelledby="rig-contract-h">
      <h3 id="rig-contract-h">Rig contract</h3>
      <ul className="rs-rules">
        <li><b>Canvas</b> viewBox 100×120 · feet 50, 108 · facing right</li>
        <li><b>Nest</b> rig › flip › hop › squash › parts</li>
        <li><b>Head</b> head-tilt › head › face › eyes › pupil</li>
        <li><b>Head extras</b> .ko-eyes · .mouth-yell · .mouth-ouch</li>
        <li><b>Prop pivot</b> the front hand (<code>propOrigin</code>)</li>
        <li><b>Pivots</b> viewBox px; fill-box = own box</li>
        <li><b>Skins</b> same groups, same pivots</li>
        <li><b>Sprites</b> one image in <code>.squash</code>, no parts: only the root groups move</li>
        <li><b>Doc</b> <code>docs/art/RIG.md</code></li>
      </ul>
      <dl className="rs-contract">{parts.filter(p => !p.fx && !p.id.includes("#")).map(p => <div key={p.id}>
        <dt><code>.{p.name}</code></dt><dd>{MEANING[p.name] ?? "—"}<small>{fmt(p.pivot)}{p.boxKind === "fill-box" ? " · fill-box" : ""}</small></dd>
      </div>)}</dl>
    </section>
  </div>;
}
