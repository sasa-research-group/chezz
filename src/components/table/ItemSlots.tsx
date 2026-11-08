import bombIcon from "../../assets/items/bomb.webp";
import decoyIcon from "../../assets/items/decoy.webp";
import type { Item, Rules } from "../../game/turns";

/** Painted item icons (docs/art/PROPS.md). The decoy's icon is also its sprite on the board. */
export const ITEM_ICON: Record<Item, string> = { bomb: bombIcon, decoy: decoyIcon };
export const ITEM_NAME: Record<Item, string> = { bomb: "Bomb", decoy: "Decoy" };
/** The one number each item is about, shown on its slot. */
export const itemNumber = (r: Rules, item: Item) => item === "bomb" ? `−${r.items.bomb.damage}` : `♥${r.items.decoy.hp}`;

export const ItemIcon = ({ item }: { item: Item }) => <img className="item-icon" src={ITEM_ICON[item]} alt="" draggable={false} />;

/** Your team's bag, in your team bar: one slot per item, empty slots up to the bag's size. Tap an item to aim it. */
export function ItemSlots({ items, rules, aiming, locked, reasonOf, onPick }: { items: Item[]; rules: Rules; aiming: number | null; locked: boolean; reasonOf: (item: Item) => string; onPick: (index: number) => void }) {
  if (!rules.slots) return null;
  return <div className="item-slots" role="group" aria-label="Items">
    {Array.from({ length: rules.slots }, (_, i) => {
      const item = items[i];
      if (!item) return <span key={i} className="item-slot empty" aria-hidden="true" />;
      const why = locked ? "Not now" : reasonOf(item);
      return <button key={i} type="button" className={`item-slot ${aiming === i ? "aiming" : ""}`} aria-pressed={aiming === i} disabled={!!why && aiming !== i}
        aria-label={`${ITEM_NAME[item]} ${itemNumber(rules, item)}${why ? `: ${why}` : ""}`} title={why ? `${ITEM_NAME[item]}: ${why}` : ITEM_NAME[item]} onClick={() => onPick(i)}>
        <ItemIcon item={item} /><b className="item-num">{itemNumber(rules, item)}</b>
      </button>;
    })}
  </div>;
}
