import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPRITE_FIGURES, spriteFigure } from "../src/diorama/figures";

const dir = join(process.cwd(), "public/diorama");

describe("sprite figures", () => {
  it("maps the white king to the king sprite", () => expect(spriteFigure({ kind: "king", side: "white" })).toBe("king"));
  it("leaves every other piece to the 3D king or its card", () => {
    for (const pc of [{ kind: "king", side: "black" }, { kind: "pawn", side: "white" }, { kind: "knight", side: "white" }, { kind: "knight", side: "black" }])
      if (!(`${pc.side} ${pc.kind}` in SPRITE_FIGURES)) expect(spriteFigure(pc), `${pc.side} ${pc.kind}`).toBeNull();
    expect(spriteFigure({ kind: "king", side: "black" })).toBeNull();
    expect(spriteFigure({ kind: "pawn", side: "white" })).toBeNull();
    expect(spriteFigure({ kind: "knight", side: "white" })).toBeNull();
  });
  for (const figure of new Set(Object.values(SPRITE_FIGURES)))
    it(`${figure} has its still sheet installed`, () => {
      for (const f of [`${figure}8.json`, `${figure}8.webp`, `${figure}8-glow.png`]) expect(existsSync(join(dir, f)), f).toBe(true);
      const sheet = JSON.parse(readFileSync(join(dir, `${figure}8.json`), "utf8"));
      for (const k of ["quad", "right", "up", "fwd", "d0", "dq", "exposure", "glowK", "headings", "tiles", "S"]) expect(sheet, k).toHaveProperty(k);
    });
});
