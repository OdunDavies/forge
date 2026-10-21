import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { ExerciseDemo as Demo } from "@/lib/exercises/media";

export function ExerciseDemo({
  name,
  demo,
  imageUrl,
}: {
  name: string;
  demo?: Demo | null;
  imageUrl: string | null;
}) {
  const [mode, setMode] = useState<"video" | "photo">(demo ? "video" : "photo");
  const [sourceIndex, setSourceIndex] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const videoUrl = demo?.videos[sourceIndex];
  if (!demo && !imageUrl) return null;

  return (
    <section aria-label="Exercise demonstration" className="space-y-3">
      {demo && imageUrl && (
        <div role="group" aria-label="Demonstration format" className="flex gap-2">
          <Button
            variant={mode === "video" ? "default" : "outline"}
            aria-pressed={mode === "video"}
            onClick={() => setMode("video")}
          >
            Video
          </Button>
          <Button
            variant={mode === "photo" ? "default" : "outline"}
            aria-pressed={mode === "photo"}
            onClick={() => setMode("photo")}
          >
            Photo
          </Button>
        </div>
      )}
      <div className="grid aspect-video place-items-center overflow-hidden rounded-xl bg-secondary">
        {mode === "video" && videoUrl ? (
          <video
            key={`${sourceIndex}-${retry}`}
            src={videoUrl}
            poster={demo?.poster ?? undefined}
            controls
            playsInline
            muted
            preload="metadata"
            aria-label={`${demo?.name ?? name} demonstration`}
            className="size-full object-contain"
            onError={() => setSourceIndex((index) => index + 1)}
          />
        ) : mode === "photo" && imageUrl && !imageFailed ? (
          <img
            key={retry}
            src={imageUrl}
            alt={`${name} exercise position`}
            className="size-full object-contain"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="space-y-3 p-5 text-center">
            <p role="alert" className="text-sm text-muted-foreground">
              This demonstration couldn&apos;t load. Try again or follow the steps below.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                setSourceIndex(0);
                setImageFailed(false);
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
            {mode === "video" && imageUrl && (
              <Button variant="ghost" onClick={() => setMode("photo")}>
                View photo
              </Button>
            )}
          </div>
        )}
      </div>
      {mode === "video" && demo?.baseExercise && (
        <p className="text-xs text-muted-foreground">
          Base movement: {demo.baseExercise}. Follow the tempo or pause prescribed in your plan.
        </p>
      )}
    </section>
  );
}
