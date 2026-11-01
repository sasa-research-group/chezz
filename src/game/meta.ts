import type { Kind, Run } from "./turns";

/** Progress that outlives a run: unlocked and equipped skins. Kept under its own
 * key, apart from the run autosave, which a new run overwrites. No DOM: storage
 * is passed in, and every function returns a new Meta. */
export const META_KEY = "chezz.meta.v1";

export type SkinRef = { id: string; kind: Kind };
export type Meta = {
  version: 1;
  unlocked: string[];
  /** At most one skin per piece kind. */
  equipped: Partial<Record<Kind, string>>;
  /** Fingerprint of the last won run already credited, so reloading its victory screen unlocks nothing more. */
  lastWin?: string;
};

export const emptyMeta = (): Meta => ({ version: 1, unlocked: [], equipped: {} });

/** Parses a saved Meta. Bad JSON or a wrong shape gives an empty Meta; unknown skin ids are dropped. */
export function readMeta(raw: string | null, skins: SkinRef[]): Meta {
  let m: unknown;
  try { m = raw ? JSON.parse(raw) : null; } catch { return emptyMeta(); }
  if (!m || typeof m !== "object") return emptyMeta();
  const { version, unlocked, equipped, lastWin } = m as Record<string, unknown>;
  if (version !== 1 || !Array.isArray(unlocked) || !equipped || typeof equipped !== "object" || Array.isArray(equipped)) return emptyMeta();
  const known = new Set(skins.map(s => s.id));
  const owned = [...new Set(unlocked.filter((id): id is string => typeof id === "string" && known.has(id)))];
  const worn: Meta["equipped"] = {};
  for (const [kind, id] of Object.entries(equipped)) {
    if (skins.some(s => s.id === id && s.kind === kind) && owned.includes(id as string)) worn[kind as Kind] = id as string;
  }
  return { version: 1, unlocked: owned, equipped: worn, ...(typeof lastWin === "string" ? { lastWin } : {}) };
}

/** A short hash of the whole run, history included: two different won runs never share it in practice. */
export function runPrint(run: Run): string {
  let h = 5381;
  for (const ch of JSON.stringify(run)) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
}

/** A won run unlocks the first skin not yet owned, once per run. */
export function creditWin(meta: Meta, run: Run, skins: SkinRef[]): { meta: Meta; unlocked?: string } {
  const print = runPrint(run);
  if (run.phase !== "victory" || meta.lastWin === print) return { meta };
  const next = skins.find(s => !meta.unlocked.includes(s.id));
  return { meta: { ...meta, lastWin: print, unlocked: next ? [...meta.unlocked, next.id] : meta.unlocked }, unlocked: next?.id };
}

/** Wears an unlocked skin on its piece, or takes it off. Locked or unknown skins change nothing. */
export function equip(meta: Meta, skin: SkinRef, on: boolean): Meta {
  if (!meta.unlocked.includes(skin.id)) return meta;
  const equipped = { ...meta.equipped };
  if (on) equipped[skin.kind] = skin.id;
  else if (equipped[skin.kind] === skin.id) delete equipped[skin.kind];
  else return meta;
  return { ...meta, equipped };
}

/** A getter, because merely reading `localStorage` throws when site data is blocked. */
type Store = () => Pick<Storage, "getItem" | "setItem">;
export function loadMeta(store: Store, skins: SkinRef[]): Meta {
  try { return readMeta(store().getItem(META_KEY), skins); } catch { return emptyMeta(); }
}
/** False when storage refuses the write (blocked, private mode, quota). */
export function saveMeta(store: Store, meta: Meta): boolean {
  try { store().setItem(META_KEY, JSON.stringify(meta)); return true; } catch { return false; }
}
