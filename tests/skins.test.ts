import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PieceRig, hasNewArt } from "../src/components/PieceRig";
import { SKINS } from "../src/components/skins";

/** Each render numbers its line-boil filter; drop the number so renders compare. */
const rig = (props: Parameters<typeof PieceRig>[0]) => renderToStaticMarkup(createElement(PieceRig, props)).replace(/boil-\d+/g, "boil");
/** The groups rig.css animates; a skin that drops one breaks an action. */
const SLOTS = ["flip", "hop", "squash", "prop", "head-tilt", "head", "face", "eyes", "pupil", "ko-eyes", "mouth-yell", "shield"];
const hasClass = (html: string, c: string) => new RegExp(`class="(?:[^"]* )?${c}(?: [^"]*)?"`).test(html);

describe("skin registry", () => {
  it("has unique ids", () => expect(new Set(SKINS.map(s => s.id)).size).toBe(SKINS.length));
  for (const skin of SKINS) describe(skin.id, () => {
    it("dresses a piece that has a shape-kit build", () => expect(hasNewArt(skin.kind)).toBe(true));
    it("keeps every animated group", () => {
      const html = rig({ kind: skin.kind, side: "white", skin: skin.id });
      for (const c of SLOTS) expect(hasClass(html, c), c).toBe(true);
      expect(hasClass(html, `skin-${skin.id}`)).toBe(true);
      if (skin.quirk) expect(hasClass(html, skin.quirk)).toBe(true);
    });
    it("changes the art, and only for the rebel version of its own piece", () => {
      const base = rig({ kind: skin.kind, side: "white", art: "new", seed: 1 });
      expect(rig({ kind: skin.kind, side: "white", art: "new", seed: 1, skin: skin.id })).not.toBe(base);
      const patrol = rig({ kind: skin.kind, side: "black", art: "new", seed: 1 });
      expect(rig({ kind: skin.kind, side: "black", art: "new", seed: 1, skin: skin.id })).toBe(patrol);
      const other = skin.kind === "king" ? "queen" : "king";
      expect(rig({ kind: other, side: "white", seed: 1, skin: skin.id })).toBe(rig({ kind: other, side: "white", seed: 1 }));
    });
  });
});
