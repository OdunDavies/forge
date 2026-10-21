import { open, readFile } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile(new URL("../src/data/exercise-media.json", import.meta.url), "utf8"),
);
const urls = [...new Set(Object.values(manifest.demos).flatMap((demo) => demo.videos))];
const failures = [];
let checked = 0;
async function worker() {
  for (;;) {
    const url = urls.pop();
    if (!url) return;
    try {
      if (url.startsWith("/exercise-demos/")) {
        if (!/^\/exercise-demos\/[A-Za-z0-9_-]+\.mp4$/.test(url))
          throw new Error("Invalid asset path");
        const file = await open(new URL(`../public${url}`, import.meta.url));
        try {
          const header = Buffer.alloc(40);
          const { bytesRead } = await file.read(header, 0, header.length, 0);
          if (!header.subarray(0, bytesRead).includes(Buffer.from("ftyp")))
            throw new Error("Not an MP4 asset");
        } finally {
          await file.close();
        }
        checked++;
        continue;
      }
      // This host rejects HEAD. Validate actual byte-range delivery and MP4 bytes.
      const response = await fetch(url, {
        headers: { Range: "bytes=0-127" },
        signal: AbortSignal.timeout(20000),
      });
      if (
        ![200, 206].includes(response.status) ||
        !response.headers.get("content-type")?.includes("video/mp4")
      )
        throw new Error(`HTTP ${response.status}`);
      const reader = response.body.getReader();
      const { value } = await reader.read();
      await reader.cancel();
      if (!value || !Buffer.from(value).subarray(0, 40).includes(Buffer.from("ftyp")))
        throw new Error("Not an MP4 stream");
      checked++;
    } catch (error) {
      failures.push({ url, error: String(error) });
    }
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log(`${checked} valid video sources; ${failures.length} failures.`);
if (failures.length) {
  console.error(failures);
  process.exitCode = 1;
}
