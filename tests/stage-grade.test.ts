import { describe, expect, it } from "vitest";
import { gradeFwd, gradeInv, GRADE_GLSL, STAGE_GRADE } from "../src/diorama/stageGrade";

describe("stage grade", () => {
  it("undoes itself for colours the saturation boost doesn't clip", () => {
    for (const c of [[0.2, 0.5, 0.1], [0.05, 0.3, 0.02], [0.8, 0.7, 0.6], [0.4, 0.4, 0.4]]) {
      const back = gradeFwd(gradeInv(c));
      back.forEach((v, i) => expect(v).toBeCloseTo(c[i], 4));
    }
  });
  it("adds saturation to the ooze green, as the stage's 1.4 does", () => {
    const [r, g, b] = gradeFwd([0.2, 0.6, 0.15]);
    expect(g).toBeGreaterThan(r);
    expect(b / g).toBeLessThan(0.15 / 0.6);
  });
  it("leaves black near black and never goes negative", () => {
    const out = gradeFwd([0, 0, 0]);
    out.forEach(v => { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(0.02); });
    gradeFwd([0.01, 0.9, 0.0]).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
  });
  it("carries the stage's numbers and the shader's functions", () => {
    expect(STAGE_GRADE.sat).toBe(1.4);
    expect(STAGE_GRADE.slope).toEqual([1.04, 1.0, 0.95]);
    for (const f of ["gradeFwd", "gradeInv", "satBy"]) expect(GRADE_GLSL).toContain(f);
  });
});
