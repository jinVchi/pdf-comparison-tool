import { describe, expect, it } from "vitest";
import { fileSize, validatePdf } from "./api";
describe("PDF upload validation", () => {
  it("accepts PDF files by extension and header", async () => {
    expect(
      await validatePdf(
        new File(["%PDF-1.7\n"], "見積書.PDF", {
          type: "application/pdf",
        }),
      ),
    ).toBeNull();
  });
  it("rejects disguised and empty files", async () => {
    expect(
      await validatePdf(new File(["not a PDF"], "fake.pdf")),
    ).toContain("有効なPDF");
    expect(await validatePdf(new File(["%PDF-"], "script.html"))).toContain(
      "PDFファイル",
    );
    expect(await validatePdf(new File([], "empty.pdf"))).toContain("25MB");
  });
  it("rejects files larger than 25MB", async () => {
    expect(
      await validatePdf(
        new File([new Uint8Array(25 * 1024 * 1024 + 1)], "large.pdf"),
      ),
    ).toContain("25MB");
  });
  it("formats sizes clearly", () => {
    expect(fileSize(1024)).toBe("1 KB");
    expect(fileSize(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
