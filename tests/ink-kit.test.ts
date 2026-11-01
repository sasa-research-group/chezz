import { readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Part } from "../src/components/inkKit";

const SRC = join(__dirname, "../src");
const KIT = join(SRC, "components/inkKit.tsx");
/** New art: every source file that imports the shape kit. */
const newArt = (readdirSync(SRC, { recursive: true }) as string[]).filter(f => f.endsWith(".tsx")).map(f => join(SRC, f))
  .filter(f => f !== KIT && /from ["'][^"']*inkKit(\.tsx)?["']/.test(readFileSync(f, "utf8")));

const BANNED: [RegExp, string][] = [
  [/\bstroke([A-Z]\w*)?=/, "stroke attributes (use Part, Pole or Ink)"],
  [/<(path|circle|rect|ellipse|polygon|polyline|line)\b/, "raw SVG shapes (use Part, Pole, Ink, Dot or Flat)"],
  [/clipPath|<mask|Gradient/, "hand-made clips, masks or gradients"],
  [/["'`]#[0-9a-fA-F]{3,8}["'`]|\brgba?\(|\bhsla?\(|\bfill=["']|\bfill:\s*["']/, "colour literals (use a TONES entry)"],
  [/opacity/i, "opacity (flat fills only)"],
];

describe("new art draws only with the shape kit", () => {
  it("finds the new-art files", () => expect(newArt.map(f => basename(f))).toContain("ArmourPawns.tsx"));
  for (const file of newArt) for (const [re, what] of BANNED) it(`${basename(file)}: no ${what}`, () => {
    const hits = readFileSync(file, "utf8").split("\n").map((l, i) => [i + 1, l] as const).filter(([, l]) => re.test(l));
    expect(hits.map(([n, l]) => `${basename(file)}:${n}: ${l.trim().slice(0, 80)}`)).toEqual([]);
  });
});

const svg = (el: ReturnType<typeof createElement>) => renderToStaticMarkup(createElement("svg", null, el));

describe("Part", () => {
  it("clips shading and highlight to its own path and paints the outline last", () => {
    const html = svg(createElement(Part, { d: "M0 0 L10 0 L10 10 Z", tone: { fill: "#111111", shade: "#222222" }, highlight: "M2 2 L4 4" }));
    const id = html.match(/<clipPath id="([^"]+)"/)![1];
    const outline = html.match(/<path [^>]*stroke="#1f1a19"[^>]*><\/path><\/g><\/svg>$/);
    expect(outline, "the outline is the part's last element").not.toBeNull();
    const clipped = html.slice(html.indexOf(`<g clip-path="url(#${id})">`), outline!.index);
    expect(html.indexOf('fill="#111111"')).toBeLessThan(html.indexOf("<clipPath"));
    expect(clipped).toContain('fill="#222222"');
    expect(clipped).toContain('stroke="#fffaf0"');
    expect(html.split('fill="#222222"').length - 1, "shade appears only inside the clip").toBe((clipped.split('fill="#222222"').length - 1));
  });
  it("gives every instance its own clip id", () => {
    const one = createElement(Part, { d: "M0 0 L1 1 Z", tone: { fill: "#111111", shade: "#222222" } });
    const ids = svg(createElement("g", null, one, one)).match(/clipPath id="([^"]+)"/g)!;
    expect(new Set(ids).size).toBe(2);
  });
});
