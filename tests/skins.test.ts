import { existsSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig } from "../src/components/PieceRig";
import { SKINS } from "../src/components/skins";
import { PAINTED_SKINS } from "../src/components/SpriteRig";

const rig = (props: Parameters<typeof PieceRig>[0]) => renderToStaticMarkup(createElement(PieceRig, props));
const href = (html: string) => html.match(/<image[^>]*href="([^"]*)"/)?.[1];

describe("skin registry", () => {
  it("has unique ids", () => expect(new Set(SKINS.map(s => s.id)).size).toBe(SKINS.length));
  it("paints every skin, and nothing else", () => expect([...PAINTED_SKINS].sort()).toEqual(SKINS.map(s => s.id).sort()));
  for (const skin of SKINS) describe(skin.id, () => {
    it("names a reference crop that exists", () => expect(existsSync(join(process.cwd(), `docs/art/${skin.ref}.webp`))).toBe(true));
    it("replaces the sprite, and only for the rebel version of its own piece", () => {
      const worn = rig({ kind: skin.kind, side: "white", seed: 1, skin: skin.id });
      expect(worn).toContain(`skin-${skin.id}`);
      expect(href(worn)).not.toBe(href(rig({ kind: skin.kind, side: "white", seed: 1 })));
      expect(rig({ kind: skin.kind, side: "black", seed: 1, skin: skin.id })).toBe(rig({ kind: skin.kind, side: "black", seed: 1 }));
      const other = skin.kind === "king" ? "queen" : "king";
      expect(rig({ kind: other, side: "white", seed: 1, skin: skin.id })).toBe(rig({ kind: other, side: "white", seed: 1 }));
    });
  });
  it("gives a king skin the checkmate crown particle", () => {
    for (const s of SKINS.filter(s => s.kind === "king")) expect(rig({ kind: "king", side: "white", skin: s.id })).toContain("fx-crown");
  });
});
