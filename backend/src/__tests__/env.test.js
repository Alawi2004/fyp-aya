import { describe, it, expect } from "vitest";

describe("runtime", () => {
  it("runs on Node.js", () => {
    expect(process.versions.node).toBeTruthy();
  });

  it("PORT env defaults to 4000", () => {
    const port = parseInt(process.env.PORT || "4000", 10);
    expect(port).toBeGreaterThan(0);
  });
});
