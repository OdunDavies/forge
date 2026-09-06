import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function toPgArray(values: string[] | number[]): string {
  if (!values.length) return "{}";
  return `{${values
    .map((v) => `"${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",")}}`;
}

export function slugifyHandle(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 16);
  return base || "athlete";
}

export function epley1rm(weightKg: number, reps: number) {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export function formatKg(kg: number | null | undefined, units: "metric" | "imperial" = "metric") {
  if (kg == null || Number.isNaN(Number(kg))) return "—";
  const n = Number(kg);
  if (units === "imperial") return `${Math.round(n * 2.20462 * 10) / 10} lb`;
  return `${Math.round(n * 10) / 10} kg`;
}

export function kgFromInput(value: number, units: "metric" | "imperial") {
  return units === "imperial" ? value / 2.20462 : value;
}

export function displayWeight(kg: number, units: "metric" | "imperial") {
  return units === "imperial" ? Math.round(kg * 2.20462 * 4) / 4 : Math.round(kg * 4) / 4;
}

export function weekdayName(day: number) {
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day] ?? "";
}

export function todayIso(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDuration(sec: number | null | undefined) {
  if (!sec || sec < 0) return "0m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

export function relativeTime(iso: string | Date) {
  const t = typeof iso === "string" ? new Date(iso).getTime() : iso.getTime();
  const diff = Date.now() - t;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(t).toLocaleDateString();
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? "G").trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "G";
}
