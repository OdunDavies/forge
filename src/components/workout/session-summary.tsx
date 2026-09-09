import { Camera, Dumbbell, Share2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { WorkoutSession } from "@/lib/api/types";
import { compressImage, durationParts, renderShareCardPng, sessionShareText, shareOrCopy } from "@/lib/share";
import { formatKg } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
  const [sharing, setSharing] = useState(false);
  const volume = formatKg(session.volumeKg, units);
  const time = durationParts(session.durationSec);
  const groups = new Map<string, { sets: number; top: string }>();
  for (const s of session.sets.filter((x) => x.completed)) {
    const prev = groups.get(s.exerciseName) ?? { sets: 0, top: "" };
    prev.sets += 1;
    prev.top = s.weightKg != null ? `${formatKg(s.weightKg, units)} × ${s.reps ?? "—"}` : `${s.reps ?? "—"} reps`;
    groups.set(s.exerciseName, prev);
  }
  const topLift = [...groups.entries()][0];

  const url = typeof window !== "undefined" ? window.location.href.split("?")[0] : "";
  const text = sessionShareText({
    title: session.title,
    setCount: session.setCount,
    volume,
    duration: time.secondary ? `${time.primary} ${time.secondary}` : time.primary,
  });

  async function onPick(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const data = await compressImage(file);
      await onPhoto(data);
      toast("Photo on your card");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className="space-y-4">
      <button
        type="button"
        disabled={!isOwner || uploading}
        onClick={() => isOwner && fileRef.current?.click()}
        className="block w-full text-left disabled:cursor-default"
        aria-label={isOwner ? (session.photoUrl ? "Replace workout photo" : "Add workout photo") : session.title}
      >
        <ShareCardFace
          title={session.title}
          volume={volume}
          time={time}
          setCount={session.setCount}
          photoUrl={session.photoUrl}
          topLift={topLift ? `${topLift[0]}  ${topLift[1].top}` : null}
          emptyHint={isOwner && !session.photoUrl}
        />
      </button>

      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              await onPick(file);
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Camera className="size-4" />
            {uploading ? "Adding…" : session.photoUrl ? "Change photo" : "Add your photo"}
          </Button>
          <Button
            disabled={sharing}
            onClick={async () => {
              setSharing(true);
              try {
                const blob = await renderShareCardPng({
                  title: session.title,
                  volume,
                  durationSec: session.durationSec,
                  setCount: session.setCount,
                  photoUrl: session.photoUrl,
                  topLift: topLift ? `${topLift[0]} ${topLift[1].top}` : null,
                });
                const file = new File([blob], `${session.title}-forge.png`, { type: "image/png" });
                const result = await shareOrCopy({
                  title: `${session.title} · Forge`,
                  text,
                  url,
                  file,
                });
                if (result === "copied") toast("Share text copied");
                if (result === "downloaded") toast("Card saved — attach it in your post");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not share");
              } finally {
                setSharing(false);
              }
            }}
          >
            <Share2 className="size-4" />
            {sharing ? "Preparing…" : "Share card"}
          </Button>
        </div>
      )}

      {groups.size > 0 && (
        <ul className="space-y-2 text-sm">
          {[...groups.entries()].map(([name, g]) => (
            <li key={name} className="flex justify-between gap-3 rounded-md bg-card px-3 py-2">
              <span className="truncate">{name}</span>
              <span className="tabular text-muted-foreground">
                {g.sets} · {g.top}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShareCardFace({
  title,
  volume,
  time,
  setCount,
  photoUrl,
  topLift,
  emptyHint,
  className,
}: {
  title: string;
  volume: string;
  time: { primary: string; secondary: string | null };
  setCount: number;
  photoUrl: string | null;
  topLift?: string | null;
  emptyHint?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-none bg-[#070708] aspect-[9/16] w-full max-h-[78vh]",
        className,
      )}
    >
      {photoUrl ? (
        <img src={photoUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 700px at 60% 32%, rgb(22 22 24) 0%, #070708 70%), repeating-linear-gradient(0deg, transparent, transparent 47px, rgb(201 212 220 / 0.05) 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, rgb(201 212 220 / 0.05) 48px)",
          }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#070708] via-[#070708]/45 to-black/15" />

      <p className="absolute right-5 top-[46%] display text-[1.35rem] font-semibold uppercase tracking-[0.22em] text-white">
        FORGE
      </p>

      <div className="absolute inset-x-0 bottom-0 px-5 pb-7 pt-16">
        <Dumbbell className="mb-3 size-10 text-white" strokeWidth={1.75} />
        <h2 className="display text-[2.15rem] font-semibold leading-[1.05] text-white">{title}</h2>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 text-white">
          <div>
            <dt className="text-[13px] text-white/70">Volume</dt>
            <dd className="display mt-1 text-[2rem] font-semibold tabular leading-none">{volume}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-white/70">Time</dt>
            <dd className="display mt-1 text-[2rem] font-semibold tabular leading-none">
              {time.primary}
              {time.secondary ? (
                <span className="mt-1 block text-[1.65rem] leading-none">{time.secondary}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-white/70">Sets</dt>
            <dd className="display mt-1 text-[2rem] font-semibold tabular leading-none">{setCount}</dd>
          </div>
          {topLift ? (
            <div>
              <dt className="text-[13px] text-white/70">Top set</dt>
              <dd className="mt-1 text-lg font-medium leading-tight">{topLift}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {emptyHint && (
        <div className="absolute inset-x-0 top-[28%] flex flex-col items-center gap-2 text-center text-white/80">
          <Camera className="size-8" />
          <p className="text-sm font-medium">Tap to add your photo</p>
        </div>
      )}
    </div>
  );
}
