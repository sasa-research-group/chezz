import type { RigSide } from "../components/PieceRig";
import { SKINS } from "../components/skins";
import { KINDS, SpriteStill } from "./kit";
import { art } from "./Reference";

const SIDES: { side: RigSide; faction: string; title: string }[] = [
  { side: "white", faction: "rebel", title: "Friendly" },
  { side: "black", faction: "patrol", title: "Enemy" },
];

/** The landing sheet: every painted sprite as a still; a click opens it on the stage. */
export function Cast() {
  return <div className="cast">
    {SIDES.map(({ side, faction, title }) => <section key={side} className="cast-group" aria-labelledby={`cast-${faction}`}>
      <h3 id={`cast-${faction}`}>{title}</h3>
      <div className="cast-grid">{KINDS.map(kind => <a key={kind} className={`cast-tile ${faction}`} href={`#stage/${faction}-${kind}`} data-sprite={`${faction}-${kind}`}>
        <SpriteStill kind={kind} side={side} /><span>{kind}</span>
      </a>)}</div>
    </section>)}
    <section className="cast-group" aria-labelledby="cast-skins">
      <h3 id="cast-skins">Skins</h3>
      <div className="cast-grid">{SKINS.map(s => <div key={s.id} className="cast-tile unpainted" data-skin={s.id}>
        {s.ref && <img src={art(s.ref)} alt="" width={406} height={498} loading="lazy" />}
        <span>{s.name}</span><small>Not painted yet</small>
      </div>)}</div>
    </section>
  </div>;
}
