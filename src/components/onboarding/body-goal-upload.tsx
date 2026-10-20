import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, ScanLine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compareBodyPhotos } from "@/lib/api/goal-scan";
import { compressImage } from "@/lib/share";
import type { BodyGoalScan } from "@/lib/body-goal";

type PhotoSlot = "current" | "goal";
const photoSlots = [
  { id: "current" as const, title: "Your current body", description: "A recent photo of you" },
  {
    id: "goal" as const,
    title: "Your dream body",
    description: "A reference for your training goals",
  },
];

export function BodyGoalUpload({
  value,
  onChange,
}: {
  value: BodyGoalScan | null;
  onChange: (scan: BodyGoalScan | null) => void;
}) {
  const [photos, setPhotos] = useState<Record<PhotoSlot, string | null>>({
    current: null,
    goal: null,
  });
  const [preparing, setPreparing] = useState<PhotoSlot | null>(null);
  const [fileError, setFileError] = useState<{ slot: PhotoSlot; message: string } | null>(null);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const scan = useMutation({
    mutationFn: () => {
      if (!photos.current || !photos.goal) throw new Error("Choose both photos first.");
      return compareBodyPhotos({ data: { currentImage: photos.current, goalImage: photos.goal } });
    },
    onSuccess: (result) => {
      if (!active.current) return;
      onChange(result);
      setPhotos({ current: null, goal: null });
    },
  });
  const busy = preparing !== null || scan.isPending;

  async function pickPhoto(slot: PhotoSlot, file?: File) {
    if (!file || busy) return;
    setFileError(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      setFileError({ slot, message: "Choose a JPEG, PNG, or WebP photo under 8 MB." });
      return;
    }
    onChange(null);
    scan.reset();
    setPreparing(slot);
    try {
      const image = await compressImage(file);
      if (active.current) setPhotos((previous) => ({ ...previous, [slot]: image }));
    } catch {
      if (active.current)
        setFileError({ slot, message: "We couldn't read this photo. Try a different image." });
    } finally {
      if (active.current) setPreparing(null);
    }
  }

  return (
    <div className="space-y-5" aria-busy={busy}>
      <p role="status" className="sr-only">{scan.isPending ? "Comparing your photos" : preparing ? "Preparing your photo" : ""}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Add a current photo and a goal reference. Forge will suggest training priorities, then build
        around your experience, equipment, and schedule.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {photoSlots.map(({ id, title, description }) => (
          <div key={id} className="min-w-0 space-y-2">
            <label htmlFor={`body-goal-${id}`} className="block text-sm font-semibold">
              {title}
            </label>
            <label className="relative flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-dashed border-primary/40 bg-card p-4 text-center focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
              {photos[id] ? (
                <img
                  src={photos[id]}
                  alt={description}
                  className="absolute inset-0 h-full w-full object-contain"
                />
              ) : (
                <>
                  {preparing === id ? (
                    <LoaderCircle className="size-8 animate-spin text-primary motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <ImagePlus className="size-8 text-primary" aria-hidden="true" />
                  )}
                  <span className="text-sm font-medium">
                    {preparing === id ? "Preparing photo…" : "Choose photo"}
                  </span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </>
              )}
              <input
                id={`body-goal-${id}`}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                aria-label={title}
                aria-invalid={fileError?.slot === id}
                aria-describedby={`body-goal-${id}-help`}
                className="sr-only"
                onChange={(event) => {
                  void pickPhoto(id, event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>
            <p id={`body-goal-${id}-help`} className="min-h-4 text-xs text-muted-foreground">
              {fileError?.slot === id ? (
                <span role="alert" className="text-destructive">
                  {fileError.message}
                </span>
              ) : (
                "JPEG, PNG or WebP · up to 8 MB"
              )}
            </p>
            {photos[id] && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 w-full"
                disabled={busy}
                onClick={() => {
                  setPhotos((previous) => ({ ...previous, [id]: null }));
                  onChange(null);
                  scan.reset();
                }}
              >
                <X className="size-4" aria-hidden="true" />
                Remove photo
              </Button>
            )}
          </div>
        ))}
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Photos are sent to our AI provider for analysis. Forge saves the training notes, not your
        photos. Use photos you have permission to share; a reference cannot guarantee an exact body
        shape or timeline.
      </p>
      <Button
        type="button"
        variant="outline"
        className="min-h-12 w-full rounded-xl"
        disabled={!photos.current || !photos.goal || busy}
        onClick={() => scan.mutate()}
      >
        {scan.isPending ? (
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : (
          <ScanLine className="size-4" aria-hidden="true" />
        )}
        {scan.isPending ? "Comparing your photos…" : "Analyze my photos"}
      </Button>
      {scan.isError && (
        <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {scan.error.message}
        </p>
      )}
      {value && (
        <section
          aria-label="Photo training direction"
          aria-live="polite"
          className="space-y-3 rounded-2xl border border-primary/25 bg-primary/5 p-5"
        >
          <h2 className="font-semibold">Your suggested training direction</h2>
          <p className="text-sm leading-relaxed">{value.summary}</p>
          <div className="flex flex-wrap gap-2">
            {value.focusMuscles.map((muscle) => (
              <span
                key={muscle}
                className="rounded-full bg-primary/10 px-3 py-1 text-sm capitalize text-primary"
              >
                {muscle}
              </span>
            ))}
          </div>
          <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
            {value.trainingNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-muted-foreground">{value.limitations}</p>
          <p className="text-sm font-medium">
            Continue to use this direction. You can add more priorities later.
          </p>
        </section>
      )}
    </div>
  );
}
