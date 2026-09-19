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

export function sessionShareText(_input: {
  title: string;
  setCount: number;
  volume: string;
  duration: string;
}) {
  return "Forge";
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

export function formatDurationLine(sec: number | null | undefined) {
  const time = durationParts(sec);
  return time.secondary ? `${time.primary} ${time.secondary}` : time.primary;
}

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  await Promise.all([
    document.fonts.load("700 72px 'Space Grotesk'"),
    document.fonts.load("600 48px 'Space Grotesk'"),
    document.fonts.load("500 24px 'IBM Plex Sans'"),
  ]).catch(() => {});
}

function fitSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  style: string,
) {
  let size = start;
  ctx.font = style.replace("SIZE", String(size));
  while (size > min && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = style.replace("SIZE", String(size));
  }
  return size;
}

export async function renderShareCardPng(stats: ShareCardStats): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  await ensureFonts();
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

  const overlay = ctx.createLinearGradient(0, 0, 0, H);
  overlay.addColorStop(0, "rgba(7,7,8,0.18)");
  overlay.addColorStop(0.36, "rgba(7,7,8,0.78)");
  overlay.addColorStop(0.64, "rgba(7,7,8,0.78)");
  overlay.addColorStop(1, "rgba(7,7,8,0.22)");
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#F2F2F0";
  ctx.textAlign = "right";
  ctx.font = "600 36px 'Space Grotesk', 'IBM Plex Sans', sans-serif";
  ctx.fillText("FORGE", W - 72, 110);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  const pad = 72;
  const maxW = W - pad * 2;
  let y = Math.round(H * 0.4);

  ctx.fillStyle = "#F2F2F0";
  const titleSize = fitSize(
    ctx,
    stats.title,
    maxW,
    68,
    40,
    "700 SIZEpx 'Space Grotesk', 'IBM Plex Sans', sans-serif",
  );
  ctx.font = `700 ${titleSize}px 'Space Grotesk', 'IBM Plex Sans', sans-serif`;
  y = wrapText(ctx, stats.title, pad, y, maxW, titleSize + 10, 2);

  const time = formatDurationLine(stats.durationSec);
  const cols = [
    { label: "Volume", value: stats.volume },
    { label: "Time", value: time },
    { label: "Sets", value: String(stats.setCount) },
  ];
  const colW = maxW / 3;
  y += 56;
  cols.forEach((col, i) => {
    const x = pad + i * colW;
    ctx.fillStyle = "rgba(242,242,240,0.62)";
    ctx.font = "500 22px 'IBM Plex Sans', sans-serif";
    ctx.fillText(col.label, x, y);
    const size = fitSize(
      ctx,
      col.value,
      colW - 24,
      52,
      28,
      "600 SIZEpx 'Space Grotesk', 'IBM Plex Sans', sans-serif",
    );
    ctx.fillStyle = "#F2F2F0";
    ctx.font = `600 ${size}px 'Space Grotesk', 'IBM Plex Sans', sans-serif`;
    ctx.fillText(col.value, x, y + 58);
  });

  if (stats.topLift) {
    y += 150;
    ctx.fillStyle = "rgba(242,242,240,0.62)";
    ctx.font = "500 22px 'IBM Plex Sans', sans-serif";
    ctx.fillText("Top set", pad, y);
    const size = fitSize(
      ctx,
      stats.topLift,
      maxW,
      36,
      22,
      "600 SIZEpx 'Space Grotesk', 'IBM Plex Sans', sans-serif",
    );
    ctx.fillStyle = "#F2F2F0";
    ctx.font = `600 ${size}px 'Space Grotesk', 'IBM Plex Sans', sans-serif`;
    wrapText(ctx, stats.topLift, pad, y + 46, maxW, size + 8, 2);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not export card");
  return blob;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 3,
) {
  const words = text.split(" ").filter(Boolean);
  let line = "";
  let yy = y;
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      lines += 1;
      if (lines >= maxLines) return yy;
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) {
    let draw = line;
    if (ctx.measureText(draw).width > maxWidth) {
      while (draw.length > 1 && ctx.measureText(`${draw}…`).width > maxWidth) draw = draw.slice(0, -1);
      draw = `${draw}…`;
    }
    ctx.fillText(draw, x, yy);
  }
  return yy;
}

export async function shareOrCopy(payload: {
  title: string;
  text?: string;
  url?: string;
  file?: File;
}) {
  if (payload.file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [payload.file] })) {
    try {
      await navigator.share({ title: payload.title, files: [payload.file] });
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
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: payload.title });
      return "shared" as const;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled" as const;
    }
  }
  return "copied" as const;
}
