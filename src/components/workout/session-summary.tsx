import { Camera, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { WorkoutSession } from "@/lib/api/types";
import { compressImage, sessionShareText, shareOrCopy } from "@/lib/share";
import { formatDuration, formatKg } from "@/lib/utils";

export function SessionSummary({
  session,
  units,
  isOwner,
  onPhoto,
}: {
  session: WorkoutSession;
  units: "metric" | "imperial";
  isOwner: boolean;
  onPhoto: (dataUrl: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const volume = formatKg(session.volumeKg, units);
  const duration = formatDuration(session.durationSec);
  const groups = new Map<string, { sets: number; top: string }>();
  for (const s of session.sets.filter((x) => x.completed)) {
    const prev = groups.get(s.exerciseName) ?? { sets: 0, top: "" };
    prev.sets += 1;
    prev.top = s.weightKg != null ? `${formatKg(s.weightKg, units)} × ${s.reps ?? "—"}` : `${s.reps ?? "—"} reps`;
    groups.set(s.exerciseName, prev);
  }

  const url = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
  const text = sessionShareText({
    title: session.title,
    setCount: session.setCount,
    volume,
    duration,
  });

  return (
    <section className="overflow-hidden rounded-2xl bg-card shadow-[var(--shadow-border)]">
      {session.photoUrl ? (
        <img src={session.photoUrl} alt="" className="aspect-[16/10] w-full object-cover" />
      ) : (
        <div className="flex aspect-[16/10] items-end bg-secondary px-5 py-4">
          <p className="display text-3xl font-semibold">{session.title}</p>
        </div>
      )}
      <div className="space-y-5 p-5">
        <dl className="grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Volume</dt>
            <dd className="display mt-1 text-xl tabular">{volume}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Sets</dt>
            <dd className="display mt-1 text-xl tabular">{session.setCount}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Time</dt>
            <dd className="display mt-1 text-xl tabular">{duration}</dd>
          </div>
        </dl>
        <ul className="space-y-2 text-sm">
          {[...groups.entries()].map(([name, g]) => (
            <li key={name} className="flex justify-between gap-3">
              <span className="truncate">{name}</span>
              <span className="tabular text-muted-foreground">
                {g.sets} · {g.top}
              </span>
            </li>
          ))}
        </ul>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  const data = await compressImage(file);
                  await onPhoto(data);
                  toast("Photo attached");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not add photo");
                } finally {
                  setUploading(false);
                }
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Camera className="size-4" />
              {uploading ? "Adding…" : session.photoUrl ? "Replace photo" : "Add photo"}
            </Button>
            <Button
              onClick={async () => {
                const result = await shareOrCopy({ title: `${session.title} · Forge`, text, url });
                if (result === "copied") toast("Share text copied");
              }}
            >
              <Share2 className="size-4" />
              Share
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                window.open(intent, "_blank", "noopener,noreferrer");
              }}
            >
              Post to X
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
