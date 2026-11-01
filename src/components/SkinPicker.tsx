import type { Meta } from "../game/meta";
import { PieceRig } from "./PieceRig";
import { SKINS, type Skin } from "./skins";

/** One portrait per rebel skin: a lock while locked, a tick while worn. Tap to wear or take off. */
export function SkinPicker({ meta, onEquip }: { meta: Meta; onEquip: (skin: Skin, on: boolean) => void }) {
  return <div className="skin-picker" role="group" aria-label="Skins">
    {SKINS.map(s => {
      const owned = meta.unlocked.includes(s.id), worn = meta.equipped[s.kind] === s.id;
      return <button key={s.id} className={`skin-pick ${owned ? "" : "locked"} ${worn ? "worn" : ""}`} disabled={!owned} aria-pressed={worn}
        aria-label={`${s.name} ${s.kind}${owned ? "" : ", locked"}`} data-testid={`skin-${s.id}`} onClick={() => onEquip(s, !worn)}>
        <PieceRig kind={s.kind} side="white" skin={s.id} seed={s.id} />
        {(worn || !owned) && <span className="skin-mark" aria-hidden="true">{owned ? "✓" : "🔒"}</span>}
      </button>;
    })}
  </div>;
}
