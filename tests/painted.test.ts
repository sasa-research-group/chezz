import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig, type RigKind } from "../src/components/PieceRig";
import { PAINTED } from "../src/components/paint/specs";

/** A painted character is a recipe, its cut parts and a spec entry; they must name the same parts. */
const root = process.cwd();
describe("painted characters", () => {
  for (const [id, spec] of Object.entries(PAINTED)) describe(id, () => {
    const recipe = JSON.parse(readFileSync(join(root, `docs/art/recipes/paint-${id}.json`), "utf8"));
    const sizes = JSON.parse(readFileSync(join(root, `src/assets/paint/${id}/sizes.json`), "utf8"));
    it("cuts every part the spec places", () => {
      expect(Object.keys(recipe.parts).sort()).toEqual(Object.keys(spec.parts).sort());
      expect(Object.keys(sizes).sort()).toEqual(Object.keys(spec.parts).sort());
      for (const part of Object.keys(spec.parts)) expect(existsSync(join(root, `src/assets/paint/${id}/${part}.webp`)), part).toBe(true);
    });
    it("draws every rig group the animations move", () => {
      const [side, kind] = id.split("-") as ["rebel" | "patrol", RigKind];
      const html = renderToStaticMarkup(createElement(PieceRig, { kind, side: side === "rebel" ? "white" : "black", art: "paint" }));
      for (const group of ["art-paint", "arm-front", "arm-back", "prop", "head-tilt", "ko-eyes", ...(kind === "rook" ? ["door"] : [])])
        expect(html, group).toContain(group);
      expect(html).toContain("--prop-origin");
    });
  });
  it("leaves the red patrol and skins on the drawn rig", () => {
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "black", hue: "red", art: "paint" }))).not.toContain("<image");
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "white", skin: "frog-pot", art: "paint" }))).not.toContain("<image");
  });
});
