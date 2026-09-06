export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.72;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 380_000 && quality > 0.4) {
    quality -= 0.1;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 400_000) throw new Error("Photo is too large");
  return data;
}

export function sessionShareText(input: {
  title: string;
  setCount: number;
  volume: string;
  duration: string;
}) {
  return `${input.title} on Forge — ${input.setCount} sets, ${input.volume}, ${input.duration}.`;
}

export async function shareOrCopy(payload: { title: string; text: string; url: string }) {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
  return "copied";
}
