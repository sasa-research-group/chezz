import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig, type PatrolHue, type RigKind } from "../src/components/PieceRig";
import { SKINS } from "../src/components/skins";
import { SPRITE_IDS } from "../src/components/SpriteRig";
import { inkBox } from "./ink-bounds";

/** The figure contract (docs/art-style.md section 9): at rest, every shape-kit figure keeps its ink,
 * outline included, inside x 18–82 and below the viewBox top. The board's far rim (`--rim` in
 * exile.css) is sized so ink down to y 0 on the top row stays on the frame. */
const BOUNDS = { left: 18, right: 82, top: 0 };
/** Parts that are hidden at rest: the defend shield, the sweat drop and the strike smear. */
const AT_REST_HIDDEN = ["shield", "sweat", "fx-smear"];

const KINDS: RigKind[] = ["pawn", "rook", "knight", "bishop", "queen", "king"];
const CAST = [
  ...KINDS.flatMap(kind => [
    { name: `rebel ${kind}`, props: { kind, side: "white" as const } },
    ...(["blue", "red"] as PatrolHue[]).map(hue => ({ name: `patrol ${kind} (${hue})`, props: { kind, side: "black" as const, hue } })),
  ]),
  ...SKINS.map(s => ({ name: `${s.id} skin`, props: { kind: s.kind, side: "white" as const, skin: s.id } })),
];

describe("shape-kit figures stay inside the figure contract", () => {
  for (const { name, props } of CAST) it(name, () => {
    const ink = inkBox(renderToStaticMarkup(createElement(PieceRig, { ...props, art: "new" })), { within: "flip", skip: AT_REST_HIDDEN });
    expect(ink.top, "topmost ink (a top-row crest would cross the board's frame)").toBeGreaterThanOrEqual(BOUNDS.top);
    expect(ink.left, "leftmost ink").toBeGreaterThanOrEqual(BOUNDS.left);
    expect(ink.right, "rightmost ink").toBeLessThanOrEqual(BOUNDS.right);
  });
});

/** Painted sprites: one image per piece, trimmed to its ink, so its box is its ink. */
describe("painted sprites stay inside the figure contract", () => {
  it("covers every piece on both sides", () => expect(SPRITE_IDS.length).toBe(12));
  for (const id of SPRITE_IDS) it(id, () => {
    const [side, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
    const html = renderToStaticMarkup(createElement(PieceRig, { kind, side: side === "rebel" ? "white" : "black", art: "paint" }));
    expect(html.match(/<image/g), "draws one whole sprite, not the fallback").toHaveLength(1);
    const ink = inkBox(html, { within: "flip", skip: AT_REST_HIDDEN });
    expect(ink.top, "topmost ink").toBeGreaterThanOrEqual(BOUNDS.top);
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
