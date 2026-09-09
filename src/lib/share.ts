export async function compressImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let quality = 0.74;
  let data = canvas.toDataURL("image/jpeg", quality);
  while (data.length > 380_000 && quality > 0.38) {
    quality -= 0.08;
    data = canvas.toDataURL("image/jpeg", quality);
  }
  if (data.length > 400_000) throw new Error("Photo is too large — try a smaller image");
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

export function durationParts(sec: number | null | undefined) {
  const total = Math.max(0, Math.round(sec ?? 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return { primary: `${h}h ${m}m`, secondary: s ? `${String(s).padStart(2, "0")}s` : null };
  return { primary: `${m}m`, secondary: s ? `${String(s).padStart(2, "0")}s` : null };
}

export type ShareCardStats = {
  title: string;
  volume: string;
  durationSec: number | null;
  setCount: number;
  photoUrl: string | null;
  topLift?: string | null;
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load photo"));
    img.src = src;
  });
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.width / img.height;
  const cr = w / h;
  let dw: number;
  let dh: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export async function renderShareCardPng(stats: ShareCardStats): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw share card");

  ctx.fillStyle = "#070708";
  ctx.fillRect(0, 0, W, H);

  if (stats.photoUrl) {
    try {
      const img = await loadImage(stats.photoUrl);
      drawCover(ctx, img, W, H);
    } catch {
      // keep steel fallback
    }
  } else {
    const g = ctx.createRadialGradient(W * 0.55, H * 0.35, 40, W * 0.55, H * 0.35, W);
    g.addColorStop(0, "#161618");
    g.addColorStop(1, "#070708");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(201,212,220,0.08)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc(W * 0.5, H * 0.38, 80 + i * 90, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const overlay = ctx.createLinearGradient(0, H * 0.28, 0, H);
  overlay.addColorStop(0, "rgba(7,7,8,0)");
  overlay.addColorStop(0.45, "rgba(7,7,8,0.35)");
  overlay.addColorStop(1, "rgba(7,7,8,0.92)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#F2F2F0";
  ctx.font = "600 42px 'Space Grotesk', 'IBM Plex Sans', sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("FORGE", W - 72, H * 0.52);
  ctx.textAlign = "left";

  const time = durationParts(stats.durationSec);
  let y = H - 280;
  ctx.font = "700 92px 'Space Grotesk', 'IBM Plex Sans', sans-serif";
  wrapText(ctx, stats.title, 72, y, W - 144, 96);
  y += 130;

  const col = (W - 144) / 2;
  drawStat(ctx, "Volume", stats.volume, 72, y);
  drawStat(ctx, "Time", time.secondary ? `${time.primary} ${time.secondary}` : time.primary, 72 + col, y);
  y += 150;
  drawStat(ctx, "Sets", String(stats.setCount), 72, y);
  if (stats.topLift) drawStat(ctx, "Top set", stats.topLift, 72 + col, y);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export card");
  return blob;
}

function drawStat(ctx: CanvasRenderingContext2D, label: string, value: string, x: number, y: number) {
  ctx.fillStyle = "rgba(242,242,240,0.62)";
  ctx.font = "500 28px 'IBM Plex Sans', sans-serif";
  ctx.fillText(label, x, y);
  ctx.fillStyle = "#F2F2F0";
  ctx.font = "600 64px 'Space Grotesk', 'IBM Plex Sans', sans-serif";
  ctx.fillText(value, x, y + 72);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(" ");
  let line = "";
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

export async function shareOrCopy(payload: {
  title: string;
  text: string;
  url: string;
  file?: File;
}) {
  if (payload.file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [payload.file] })) {
    try {
      await navigator.share({ title: payload.title, text: payload.text, files: [payload.file] });
      return "shared" as const;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled" as const;
    }
  }
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      return "shared" as const;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled" as const;
    }
  }
  if (payload.file) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(payload.file);
    a.download = `${payload.title.replace(/[^\w]+/g, "-")}-forge.png`;
    a.click();
    URL.revokeObjectURL(a.href);
    return "downloaded" as const;
  }
  await navigator.clipboard.writeText(`${payload.text} ${payload.url}`);
  return "copied" as const;
}
