// The glowing discs the live sludge's shiny layers mirror exactly (liveSludge.ts's shine()): the pings just over the
// ooze, then the room's own lamps and bulbs (live_plate.py lights()). Kept apart from the page so it can be tested.
export type Ping = { sheet: number; at: number[]; size: number; power: number; color: number[] };
export type Lamp = { sheet: number; name: string; at: number[]; radius: number; radiance: number; color: number[] };
/** where, the disc's radius, its radiance (linear, per colour channel times L), and the sheet it lights (-1: all) */
export type Glint = { at: number[]; r: number; L: number; color: number[]; sheet: number };

const inside = (p: number[], lo: number[], hi: number[]) => p.every((x, i) => x >= lo[i] && x <= hi[i]);

/**
 * The list, pings first. A ping outside the room's box is behind a wall (Cycles' coat never shows it); the lamps are
 * all kept, as the lantern and fills hang in front of the open box. A ping is Cycles' square area light: radiance
 * power / (pi size^2), drawn as a disc of the same area. gain scales the lamps; skip drops lamps by name prefix.
 */
export function glintList(pings: Ping[], lamps: Lamp[], box: [number[], number[]],
  { gain = 1, skip = [] as string[], max = 32 } = {}): { list: Glint[]; nPings: number; dropped: number } {
  const ps = pings.filter(g => inside(g.at, box[0], box[1])).map(g => ({
    at: g.at, r: g.size / Math.sqrt(Math.PI), L: g.power / (Math.PI * g.size * g.size), color: g.color, sheet: g.sheet,
  }));
  // a lamp listed once per sheet, the same on each, is one glint every sheet mirrors (sheet -1): the 21 lamps of
  // three pools then fit the list, where 63 copies once pushed the bulbs, the moon and the fills off its end
  const kept = lamps.filter(g => !skip.some(n => n && g.name.startsWith(n)));
  const sheets = new Set([...kept, ...pings].map(g => g.sheet));
  const ls: Glint[] = [];
  const seen = new Set<string>();
  for (const g of kept) {
    const same = kept.filter(h => h.name === g.name && h.at.every((x, i) => x === g.at[i]) && h.radius === g.radius
      && h.radiance === g.radiance && h.color.every((x, i) => x === g.color[i]));
    const everywhere = new Set(same.map(h => h.sheet)).size === sheets.size;
    if (everywhere && seen.has(g.name)) continue;
    if (everywhere) seen.add(g.name);
    ls.push({ at: g.at, r: g.radius, L: g.radiance * gain, color: g.color, sheet: everywhere ? -1 : g.sheet });
  }
  const all = [...ps, ...ls];
  return { list: all.slice(0, max), nPings: Math.min(ps.length, max), dropped: Math.max(all.length - max, 0) };
}
