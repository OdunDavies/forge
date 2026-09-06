export function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string") {
    const t = v.trim();
    if (!t || t === "{}") return [];
    return t
      .replace(/^{|}$/g, "")
      .split(",")
      .map((s) => s.replace(/^"+|"+$/g, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function asNumberArray(v: unknown): number[] {
  return asStringArray(v)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function num0(v: unknown): number {
  return num(v) ?? 0;
}
