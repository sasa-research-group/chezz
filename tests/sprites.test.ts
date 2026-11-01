import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig } from "../src/components/PieceRig";
import { SPRITE_IDS } from "../src/components/SpriteRig";

/** A painted sprite is a single-image recipe and one installed webp; it draws no rig parts. */
const root = process.cwd();
describe("painted sprites", () => {
  for (const id of SPRITE_IDS) it(`${id} has its recipe and image`, () => {
    const recipe = JSON.parse(readFileSync(join(root, `docs/art/recipes/paint-${id}.json`), "utf8"));
    expect(recipe.steps.map((s: { name: string }) => s.name)).toEqual(["pose", "cutout"]);
    expect(existsSync(join(root, `src/assets/sprites/${id}.webp`))).toBe(true);
  });
  it("moves only the root groups", () => {
    const html = renderToStaticMarkup(createElement(PieceRig, { kind: "king", side: "white", art: "paint" }));
    for (const group of ["art-sprite", "flip", "hop", "squash", "shield", "fx-crown"]) expect(html, group).toContain(group);
    for (const part of ["arm-front", "arm-back", 'class="prop', "head-tilt", "eyes"]) expect(html, part).not.toContain(part);
  });
  it("leaves the red patrol and skins on the drawn rig", () => {
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "black", hue: "red", art: "paint" }))).not.toContain("<image");
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "white", skin: "frog-pot", art: "paint" }))).not.toContain("<image");
  });
});
