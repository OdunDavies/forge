export function track(event: string, props?: Record<string, unknown>) {
  if ((import.meta.env.VITE_ANALYTICS as string | undefined) !== "true") return;
  console.log(`[analytics] ${event}`, props ?? {});
}
