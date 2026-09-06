#!/usr/bin/env node
/**
 * Nitro bundles @electric-sql/pglite JS into
 * `.vercel/output/functions/__server.func/_libs/` but does not copy the
 * sibling wasm/data files the WASM loader expects (`pglite.data`,
 * `pglite.wasm`). Local `vite preview` has no DATABASE_URL, so PGLite
 * bootstraps and crashes without them.
 *
 * Deployed Vercel uses Neon (DATABASE_URL set) and never opens PGLite.
 */
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function copyPgliteAssets(root = ROOT) {
  const destDir = join(root, ".vercel/output/functions/__server.func/_libs");
  if (!existsSync(destDir)) return { copied: 0, destDir, skipped: true };
  const dist = join(root, "node_modules/@electric-sql/pglite/dist");
  let copied = 0;
  for (const name of FILES) {
    const src = join(dist, name);
    if (!existsSync(src)) continue;
    copyFileSync(src, join(destDir, name));
    copied += 1;
  }
  return { copied, destDir, skipped: false };
}

const invoked = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invoked) {
  const result = copyPgliteAssets();
  if (result.skipped) {
    console.log("[pglite] no vercel function output yet — skip");
  } else {
    console.log(`[pglite] copied ${result.copied} assets → ${result.destDir}`);
  }
}
