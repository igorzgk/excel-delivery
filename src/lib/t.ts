// src/lib/t.ts
import { el } from "./i18n-el";

export function t(key: string): string {
  return el[key as keyof typeof el] ?? key;
}
