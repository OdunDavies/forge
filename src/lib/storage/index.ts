/**
 * Photo storage abstraction.
 * - If S3/R2/BLOB env is set, uploads there (via presigned fetch in future).
 * - Otherwise stores compressed dataUrl in DB (current behavior) with 420k guard.
 * Keeps photo_url as either https://... or data:image/...
 */
export const MAX_DATA_URL = 420_000;

function hasObjectStore(): boolean {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.S3_BUCKET ||
      process.env.R2_BUCKET ||
      process.env.VERCEL_BLOB_URL
  );
}

export function isObjectStoreConfigured(): boolean {
  return hasObjectStore();
}

export async function storePhoto(
  _userId: string,
  _sessionId: number,
  dataUrlOrUrl: string | null
): Promise<string | null> {
  if (!dataUrlOrUrl) return null;
  if (dataUrlOrUrl.startsWith("http")) return dataUrlOrUrl;
  if (dataUrlOrUrl.length > MAX_DATA_URL) {
    throw new Error(`Photo too large (${Math.round(dataUrlOrUrl.length / 1024)}k), compress before upload`);
  }
  // TODO: when object store is configured, upload dataUrl and return https url
  // e.g. await putBlob(`${userId}/${sessionId}.jpg`, buffer, { access: 'public' })
  if (hasObjectStore()) {
    // placeholder: still returns dataUrl until Blob SDK is wired
    console.warn("[storage] object store env detected but upload not yet wired — storing dataUrl");
  }
  return dataUrlOrUrl;
}
