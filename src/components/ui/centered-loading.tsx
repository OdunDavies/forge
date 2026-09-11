import { useEffect, useState } from "react";

const DEFAULT_STEPS = ["Reading your goals", "Balancing muscle groups", "Writing your first block"];

export function CenteredLoading({
  steps = DEFAULT_STEPS,
  intervalMs = 900,
  overlay = true,
  label,
}: {
  steps?: string[];
  intervalMs?: number;
  overlay?: boolean;
  label?: string;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (steps.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % steps.length), intervalMs);
    return () => clearInterval(id);
  }, [steps.length, intervalMs]);

  const copy = label ?? steps[idx];

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        overlay
          ? "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-6"
          : "fixed inset-0 z-50 flex items-center justify-center bg-background px-6"
      }
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="size-8 animate-spin rounded-full border-2 border-secondary border-t-foreground" aria-hidden />
        <p className="text-sm font-medium tracking-wide text-foreground">{copy}</p>
      </div>
    </div>
  );
}
