import { api } from "../shared/api";
import type { Job, Mode } from "./types";

export async function validatePdf(file: File): Promise<string | null> {
  if (file.size === 0 || file.size > 25 * 1024 * 1024)
    return "PDFは1ファイル25MB以内にしてください。";
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "PDFファイルを選択してください。";
  const header = await file.slice(0, 5).text();
  return header === "%PDF-"
    ? null
    : "このファイルは有効なPDFではありません。";
}
export function submit(
  original: File,
  revised: File,
  mode: Mode,
  ignoreWhitespace: boolean,
  normalizeWidth: boolean,
) {
  const form = new FormData();
  form.append("original", original);
  form.append("revised", revised);
  form.append("mode", mode);
  form.append("ignoreWhitespace", String(ignoreWhitespace));
  form.append("normalizeWidth", String(normalizeWidth));
  return api<Job>("/comparisons", { method: "POST", body: form });
}
