import { describe, expect, it } from "vitest";
import { fileSize } from "./format";
describe("formatting", () => {
  it("formats sizes clearly", () => {
    expect(fileSize(1024)).toBe("1 KB");
    expect(fileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
