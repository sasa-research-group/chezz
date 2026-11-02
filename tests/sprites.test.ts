import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig } from "../src/components/PieceRig";
import { PAINTED_SKINS, SPRITE_IDS } from "../src/components/SpriteRig";
import { skinById } from "../src/components/skins";

/** A painted sprite is a single-image recipe and one installed webp; it draws no rig parts. */
const root = process.cwd();
function expectRecipeAndImage(id: string) {
  const recipe = JSON.parse(readFileSync(join(root, `docs/art/recipes/paint-${id}.json`), "utf8"));
  expect(recipe.steps.map((s: { name: string }) => s.name)).toEqual(["pose", "cutout"]);
  expect(existsSync(join(root, `src/assets/sprites/${id}.webp`))).toBe(true);
}
const href = (html: string) => html.match(/<image[^>]*href="([^"]*)"/)?.[1];

describe("painted sprites", () => {
  for (const id of SPRITE_IDS) it(`${id} has its recipe and image`, () => expectRecipeAndImage(id));
  for (const id of PAINTED_SKINS) it(`skin ${id} is registered and has its recipe and image`, () => {
    expect(skinById(id), id).toBeDefined();
    expectRecipeAndImage(`skin-${id}`);
  });
  it("moves only the root groups", () => {
    const html = renderToStaticMarkup(createElement(PieceRig, { kind: "king", side: "white", art: "paint" }));
    for (const group of ["art-sprite", "flip", "hop", "squash", "shield", "fx-crown"]) expect(html, group).toContain(group);
    for (const part of ["arm-front", "arm-back", 'class="prop', "head-tilt", "eyes"]) expect(html, part).not.toContain(part);
  });
  it("leaves the red patrol on the drawn rig", () => {
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "black", hue: "red", art: "paint" }))).not.toContain("<image");
  });
  it("draws a painted skin in place of the rebel's sprite, and on the kit with art new", () => {
    const skin = renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "white", skin: "frog-pot", art: "paint" }));
    expect(skin).toContain("skin-frog-pot");
    expect(href(skin)).toBeTruthy();
    expect(href(skin)).not.toBe(href(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "white", art: "paint" }))));
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "pawn", side: "white", skin: "frog-pot", art: "new" }))).not.toContain("<image");
  });
  it("gives a painted king skin the checkmate crown particle", () => {
    expect(renderToStaticMarkup(createElement(PieceRig, { kind: "king", side: "white", skin: "cat-king", art: "paint" }))).toContain("fx-crown");
  });
});
