import { useEffect, useState } from "react";
import { Cast } from "./Cast";
import { Levels } from "./Levels";
import { ENCOUNTERS } from "../game/turns";
import { Mechanics } from "./Mechanics";
import { Stage, isSprite, type SpriteId } from "./Stage";
import { StyleGuide } from "./StyleGuide";

const AREAS = [
  { id: "cast", label: "Cast", toc: [] },
  { id: "stage", label: "Stage", toc: [] },
  { id: "levels", label: "Levels", toc: [] },
  { id: "guide", label: "Style guide", toc: [["target", "Target style"], ["ref-cast", "Reference cast"], ["rules", "Rules"], ["ref-palette", "Reference palette"], ["palette", "UI palette"], ["type", "Type"], ["construction", "Construction"], ["sides", "Side markers"], ["timing", "Timing"], ["a11y", "Accessibility"]] },
  { id: "mechanics", label: "Mechanics", toc: [["stats", "Stats"], ["turn", "Turn"], ["pieces", "Pieces"], ["check", "Check"], ["strike", "Tap to strike"], ["strikeback", "Strike back"], ["knight", "Knight"], ["enemy", "Enemy"], ["battles", "Battles"], ["hideout", "Hideout"], ["gold", "Gold"], ["run", "Run"]] },
] as const;
type AreaId = typeof AREAS[number]["id"];
const areaOf = (hash: string): AreaId => hash.startsWith("#stage") ? "stage" : hash.startsWith("#levels") ? "levels" : AREAS.find(a => hash === `#${a.id}` || a.toc.some(([id]) => hash === `#${id}`))?.id ?? "cast";
const levelOf = (hash: string) => hash.startsWith("#levels/") ? Math.min(ENCOUNTERS.length - 1, Math.max(0, (parseInt(hash.split("/")[1]) || 1) - 1)) : 0;
const pieceOf = (hash: string): SpriteId | undefined => { const id = hash.split("/")[1]; return id && isSprite(id) ? id : undefined; };

export default function Studio() {
  const [area, setArea] = useState<AreaId>(() => areaOf(location.hash));
  const [piece, setPiece] = useState<SpriteId>(() => pieceOf(location.hash) ?? "rebel-king");
  const [level, setLevel] = useState(() => levelOf(location.hash));
  useEffect(() => {
    const sync = () => { setArea(areaOf(location.hash)); setLevel(levelOf(location.hash)); const p = pieceOf(location.hash); if (p) setPiece(p); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  useEffect(() => {
    if (area === "stage" || area === "cast" || area === "levels") scrollTo(0, 0);
    else if (location.hash.length > 1) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  }, [area]);
  const current = AREAS.find(a => a.id === area)!;
  return <div className="studio">
    <header className="studio-head">
      <a className="studio-brand" href="./">CHEZZ<span>STUDIO</span></a>
      <nav aria-label="Studio areas">{AREAS.map(a => <a key={a.id} href={a.id === "stage" ? `#stage/${piece}` : a.id === "levels" ? `#levels/${level + 1}` : `#${a.id}`} aria-current={a.id === area ? "page" : undefined}>{a.label}</a>)}</nav>
    </header>
    {current.toc.length > 0 && <nav className="studio-toc" aria-label={`${current.label} sections`}>{current.toc.map(([id, l]) => <a key={id} href={`#${id}`}>{l}</a>)}</nav>}
    <main className="studio-main" id={area}>
      <h2 className="area-title">{current.label}</h2>
      {area === "cast" ? <Cast /> : area === "stage" ? <Stage id={piece} onPick={id => { location.hash = `#stage/${id}`; }} /> : area === "levels" ? <Levels index={level} onPick={i => { location.hash = `#levels/${i + 1}`; setLevel(i); }} /> : area === "mechanics" ? <Mechanics /> : <StyleGuide />}
    </main>
  </div>;
}
