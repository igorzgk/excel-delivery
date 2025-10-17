// src/lib/files-validate.ts
import { extname } from "node:path";

export const ALLOWED_EXT = new Set([".xlsx", ".xlsm", ".xls"]);
export const MAX_BYTES = 50 * 1024 * 1024; // 50MB

export function checkExt(name: string) {
  const ext = extname(name || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) throw new Error("Unsupported file type");
  return ext;
}
