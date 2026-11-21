import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPRITE_FIGURES, playsStrike, spriteFigure } from "../src/diorama/figures";

const dir = join(process.cwd(), "public/diorama");

describe("sprite figures", () => {
  it("maps the white king to the king sprite", () => expect(spriteFigure({ kind: "king", side: "white" })).toBe("king"));
  it("maps the enemy pawn to the patrol guard", () => expect(spriteFigure({ kind: "pawn", side: "black" })).toBe("guard"));
  it("the guard has a walk and a strike sheet for all 8 headings", () => {
    for (const name of ["walk", "strike"]) {
      const info = JSON.parse(readFileSync(join(dir, `guard-${name}.json`), "utf8"));
      expect(info.have, name).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
      for (const k of info.have) for (const f of [`guard-${name}${k}.webp`, `guard-${name}${k}-glow.webp`]) expect(existsSync(join(dir, f)), f).toBe(true);
    }
  });
  it("plays a capture attack for the king and the guard only", () => {
    expect(playsStrike({ kind: "king", side: "white" })).toBe(true);
    expect(playsStrike({ kind: "pawn", side: "black" })).toBe(true);
    expect(playsStrike({ kind: "pawn", side: "white" })).toBe(false);
    expect(playsStrike({ kind: "rook", side: "black" })).toBe(false);
  });
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
