import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, ScanLine } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/share";
import { listGoalScans, scanGoalBody } from "@/lib/api/goal-scan";
import { getMyProfile, upsertMyProfile } from "@/lib/api/profile";
import { generateFirstPlan } from "@/lib/api/plan";

export const Route = createFileRoute("/_app/goal-scan")({ component: GoalScanPage });

function GoalScanPage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["me"], queryFn: () => getMyProfile() });
  const scans = useQuery({ queryKey: ["goal-scans"], queryFn: () => listGoalScans() });
  const [image, setImage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const scan = useMutation({
    mutationFn: () => scanGoalBody({ data: { image: image! } }),
    onSuccess: (result) => {
      setSelectedId(result.id);
      setImage(null);
      setPreview(null);
      void qc.invalidateQueries({ queryKey: ["goal-scans"] });
      toast.success("Reference scan saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const selected = scans.data?.find((item) => item.id === selectedId) ?? scans.data?.[0];
  const apply = useMutation({
    mutationFn: async () => {
      if (!selected || !profile.data) throw new Error("Your profile is still loading.");
      await upsertMyProfile({ data: { displayName: profile.data.displayName, focusMuscles: selected.focusMuscles } });
      return generateFirstPlan({ data: { goalScanId: selected.id } });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["plan"] });
      toast.success("Training focus and plan updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function pickFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8_000_000) {
      toast.error("Choose a JPEG, PNG, or WebP photo under 8 MB.");
      return;
    }
    setProcessing(true);
    try {
      const compressed = await compressImage(file);
      setImage(compressed);
      setPreview(compressed);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not read this photo.");
    } finally {
      setProcessing(false);
    }
  }

  return <div className="mx-auto max-w-3xl space-y-7">
    <header>
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Training goals</p>
      <h1 className="display mt-1 text-3xl font-semibold">Scan a goal physique</h1>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Upload a reference photo. Forge will suggest muscle groups to emphasize and practical training notes. Results are guidance, not a prediction of how your body will look.</p>
    </header>
    <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-secondary/40 p-5 text-center focus-within:ring-2 focus-within:ring-primary">
        {preview ? <img src={preview} alt="Selected goal physique reference" className="max-h-72 rounded-lg object-contain" /> : <ImagePlus className="size-10 text-primary" aria-hidden="true" />}
        <span className="text-sm font-medium">{preview ? "Choose a different photo" : "Choose a reference photo"}</span>
        <span className="text-xs text-muted-foreground">JPEG, PNG, or WebP, up to 8 MB. The photo is sent for analysis and is not saved in your scan history.</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => void pickFile(event.target.files?.[0])} />
      </label>
      <Button className="mt-4 w-full" disabled={!image || processing || scan.isPending} onClick={() => scan.mutate()}>
        <ScanLine className="size-4" aria-hidden="true" /> {scan.isPending ? "Analyzing photo…" : processing ? "Preparing photo…" : "Analyze reference"}
      </Button>
      <p className="mt-3 text-xs text-muted-foreground">Use a photo you have permission to upload. Avoid identifiable faces and sensitive images.</p>
    </section>

    {scans.isError && <p role="alert" className="text-sm text-destructive">Could not load past scans. Try refreshing.</p>}
    {selected && <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]" aria-live="polite">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Latest analysis</p>
      <h2 className="display mt-2 text-xl font-semibold">Training direction</h2>
      <p className="mt-3 text-sm leading-relaxed">{selected.summary}</p>
      {selected.focusMuscles.length > 0 && <>
        <h3 className="mt-5 text-sm font-semibold">Suggested focus</h3>
        <div className="mt-2 flex flex-wrap gap-2">{selected.focusMuscles.map((muscle) => <span key={muscle} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">{muscle}</span>)}</div>
      </>}
      {selected.trainingNotes.length > 0 && <ul className="mt-5 list-disc space-y-2 pl-5 text-sm">{selected.trainingNotes.map((note, index) => <li key={index}>{note}</li>)}</ul>}
      <p className="mt-5 text-xs text-muted-foreground">{selected.limitations}</p>
      {selected.focusMuscles.length > 0 && <Button className="mt-5" onClick={() => apply.mutate()} disabled={apply.isPending || !profile.data}>{apply.isPending ? "Updating plan…" : "Use this focus and rebuild plan"}</Button>}
    </section>}
    {scans.data && scans.data.length > 1 && <section>
      <h2 className="display text-lg font-semibold">Previous scans</h2>
      <div className="mt-3 space-y-2">{scans.data.map((item) => <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className="w-full rounded-lg bg-card p-3 text-left text-sm shadow-[var(--shadow-border)]"><span className="block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleDateString()}</span>{item.summary}</button>)}</div>
    </section>}
    <Button asChild variant="ghost"><Link to="/profile">Back to profile</Link></Button>
  </div>;
}
