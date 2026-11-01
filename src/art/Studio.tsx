import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { PatrolHue } from "../components/PieceRig";
import { Catalog } from "./Catalog";
import { Mechanics } from "./Mechanics";
import { StyleGuide } from "./StyleGuide";
import { Tooling } from "./Tooling";
import { Studio as StudioCtx } from "./kit";

const AREAS = [
  { id: "catalog", label: "Art catalog", toc: [["pilot", "New art"], ["skins", "Skins"], ["cast","Cast × state"], ["cast-pairs", "Pairs"], ["sequences", "Sequences"], ["board", "Board"], ["markers", "Markers"], ["effects", "Effects"], ["banners", "Banners"], ["hub", "Hideout"], ["table", "Table HUD"], ["ui", "UI"], ["icons", "Icons"], ["legacy", "Legacy"]] },
  { id: "mechanics", label: "Mechanics", toc: [["turn", "Turn"], ["pieces", "Pieces"], ["check", "Check"], ["strike", "Tap to strike"], ["knight", "Knight"], ["promotion", "Promotion"], ["enemy", "Enemy"], ["battles", "Battles"], ["hideout", "Hideout"], ["gold", "Gold"], ["run", "Run"]] },
  { id: "guide", label: "Style guide", toc: [["target", "Target style"], ["ref-cast", "Reference cast"], ["rules", "Rules"], ["ref-palette", "Reference palette"], ["palette", "Current palette"], ["type", "Type"], ["construction", "Construction"], ["sides", "Side markers"], ["timing", "Timing"], ["a11y", "Accessibility"], ["doc-diffs", "vs doc"]] },
  { id: "tooling", label: "Tooling", toc: [["made", "How it's made"], ["fonts", "Fonts"], ["not-used", "Not used"], ["adding", "Adding art"]] },
] as const;
type AreaId = typeof AREAS[number]["id"];
const areaOf = (hash: string): AreaId => AREAS.find(a => hash === `#${a.id}` || a.toc.some(([id]) => hash === `#${id}`))?.id ?? "catalog";
const SPEEDS: [number, string][] = [[1, "1×"], [.3, "Fast"], [2.5, "Slow"]];

export default function Studio() {
  const [area, setArea] = useState<AreaId>(() => areaOf(location.hash));
  const [spd, setSpd] = useState(1);
  const [hue, setHue] = useState<PatrolHue>("blue");
  useEffect(() => {
    const sync = () => setArea(areaOf(location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => { if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView(); }, [area]);
  const current = AREAS.find(a => a.id === area)!;
  return <StudioCtx.Provider value={{ spd, hue }}>
    <div className="studio" style={{ "--spd": spd } as CSSProperties}>
      <header className="studio-head">
        <a className="studio-brand" href="./">CHEZZ<span>STUDIO</span></a>
        <nav aria-label="Studio areas">{AREAS.map(a => <a key={a.id} href={`#${a.id}`} aria-current={a.id === area ? "page" : undefined}>{a.label}</a>)}</nav>
        <div className="studio-controls">
          <span role="group" aria-label="Speed">{SPEEDS.map(([v, l]) => <button key={l} aria-pressed={spd === v} onClick={() => setSpd(v)}>{l}</button>)}</span>
          <span role="group" aria-label="Patrol colour">{(["blue", "red"] as const).map(h => <button key={h} aria-pressed={hue === h} onClick={() => setHue(h)}>{h === "blue" ? "Blue patrol" : "Red (alt)"}</button>)}</span>
        </div>
      </header>
      <nav className="studio-toc" aria-label={`${current.label} sections`}>{current.toc.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>
      <main className="studio-main" id={area}>
        <h2 className="area-title">{current.label}</h2>
        {area === "catalog" ? <Catalog /> : area === "mechanics" ? <Mechanics /> : area === "guide" ? <StyleGuide /> : <Tooling />}
      </main>
    </div>
  </StudioCtx.Provider>;
}
