import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8", className)}
      role="img"
      aria-label="Forge"
    >
      <rect width="32" height="32" rx="7" fill="#070708" />
      <circle cx="16" cy="16" r="8.2" fill="none" stroke="#C9D4DC" strokeWidth="3.2" />
      <rect x="16" y="14.4" width="9.2" height="3.2" fill="#070708" />
      <rect x="18.4" y="14.4" width="6.2" height="3.2" fill="#C9D4DC" />
      <rect x="22.8" y="14.4" width="2.2" height="3.2" fill="#C45C4A" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("display inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <Mark className="size-7" />
      <span className="text-[1.05rem] uppercase tracking-[0.18em]">Forge</span>
    </span>
  );
}
