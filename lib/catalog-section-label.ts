/** PeopleSoft / merged catalog sometimes stores the same section label twice in one string. */
export function dedupeRepeatedSectionLabel(text: string): string {
  const t = String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  if (t.length < 4 || t.length % 2 !== 0) return t;
  const half = t.length / 2;
  const a = t.slice(0, half);
  const b = t.slice(half);
  return a === b ? a : t;
}
