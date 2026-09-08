export function checkDrillMove(
  line: string[],
  ply: number,
  san: string
): { ok: true } | { ok: false; expected: string } {
  const norm = (s: string) => s.replace(/[+#?!]+$/, "");
  return norm(line[ply] ?? "") === norm(san) ? { ok: true } : { ok: false, expected: line[ply] };
}
