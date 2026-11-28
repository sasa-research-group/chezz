import { describe, expect, it } from "vitest";
// @ts-expect-error plain .mjs helper
import { stillUrl } from "../tools/art/diorama/stillUrl.mjs";

describe("stillUrl", () => {
  it("adds still when it is missing", () => {
    const u = new URL(stillUrl("http://127.0.0.1:5199/live-sludge.html?dir=live-proof/L9/&crease=12"));
    expect(u.searchParams.has("still")).toBe(true);
    expect(u.searchParams.get("dir")).toBe("live-proof/L9/");
    expect(u.searchParams.get("crease")).toBe("12");
  });
  it("keeps a URL that already has still", () => {
    const u = new URL(stillUrl("http://127.0.0.1:5199/live-sludge.html?still&flat&dir=x/"));
    expect(u.searchParams.has("still")).toBe(true);
    expect(u.searchParams.has("flat")).toBe(true);
  });
});
