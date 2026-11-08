import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig, type RigKind } from "../src/components/PieceRig";
import { SKINS } from "../src/components/skins";
import { SPRITE_IDS } from "../src/components/SpriteRig";
import { inkBox } from "./ink-bounds";

/** The figure contract (docs/art-style.md section 9): at rest, every sprite keeps its ink,
 * outline included, inside x 18–82 and below the viewBox top, feet on y 108. The board's far rim
 * (`--rim` in exile.css) is sized so ink down to y 0 on the top row stays on the frame.
 * Sprites are trimmed to their ink, so a sprite's box is its ink. */
const BOUNDS = { left: 18, right: 82, top: 0 };

const CAST = [
  ...SPRITE_IDS.map(id => {
    const [side, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
    return { name: id, props: { kind, side: side === "rebel" ? "white" as const : "black" as const } };
  }),
  ...SKINS.map(s => ({ name: `skin ${s.id}`, props: { kind: s.kind, side: "white" as const, skin: s.id } })),
];

describe("painted sprites stay inside the figure contract", () => {
  it("covers every piece on both sides", () => expect(SPRITE_IDS.length).toBe(12));
  for (const { name, props } of CAST) it(name, () => {
    const html = renderToStaticMarkup(createElement(PieceRig, props));
    expect(html.match(/<image/g), "draws one whole sprite").toHaveLength(1);
    const ink = inkBox(html, { within: "flip", skip: [] });
    expect(ink.top, "topmost ink (a top-row crest would cross the board's frame)").toBeGreaterThanOrEqual(BOUNDS.top);
    expect(ink.left, "leftmost ink").toBeGreaterThanOrEqual(BOUNDS.left);
    expect(ink.right, "rightmost ink").toBeLessThanOrEqual(BOUNDS.right);
    expect(ink.bottom, "feet on the ground line").toBeCloseTo(108, -0.5);
  });
});

describe("inkBox", () => {
  const box = (svg: string) => inkBox(`<svg><g class="flip">${svg}</g></svg>`, { within: "flip", skip: ["hidden"] });
  it("counts half the stroke, transforms and arcs", () => {
    expect(box('<path d="M10 20 L30 20" stroke="#000" stroke-width="4"></path>')).toMatchObject({ top: 18, left: 8, right: 32 });
    expect(box('<g transform="translate(5 -3)"><path d="M10 20 L30 20" fill="#000"></path></g>').top).toBe(17);
    const ring = box('<path d="M40 50 A10 10 0 1 0 60 50 A10 10 0 1 0 40 50 Z" fill="#000"></path>');
    expect(ring.top).toBeCloseTo(40, 1);
    expect(ring.bottom).toBeCloseTo(60, 1);
    expect(box('<g transform="rotate(90 50 50)"><path d="M50 50 L70 50" fill="#000"></path></g>').bottom).toBeCloseTo(70, 5);
    expect(box('<image href="a.webp" x="20" y="30" width="10" height="40"></image>')).toMatchObject({ top: 30, left: 20, right: 30, bottom: 70 });
  });
  it("ignores clipped copies, hidden parts and parts outside the figure", () => {
    const html = '<path d="M0 0 L1 1" stroke="#000"></path><g class="flip"><path d="M10 20 L30 20" fill="#000"></path>'
      + '<g clip-path="url(#c)"><path d="M10 5 L30 5" fill="#000"></path></g><g class="hidden"><path d="M10 2 L30 2" fill="#000"></path></g></g>';
    expect(inkBox(`<svg>${html}</svg>`, { within: "flip", skip: ["hidden"] }).top).toBe(20);
  });
});
