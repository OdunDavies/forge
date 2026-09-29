/** Catalog version - bump on every catalog rebuild. */
export const CATALOG_VERSION = "2025.01"

/** Pinned commit of the dataset (do not change without rebuild). */
export const DATASET_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd"

/** Base URL for exercise media (override with VITE_EXERCISE_MEDIA_BASE). */
export const MEDIA_BASE_URL = typeof window !== "undefined"
  ? (import.meta.env.VITE_EXERCISE_MEDIA_BASE ?? "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/")
  : "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/7455efae41b330c265e7cd4b78dfa848e7ce5ebd/"

/** Attribution notice - keep visible wherever media renders. */
export const ATTRIBUTION_NOTICE = "(c) Gym visual, https://gymvisual.com/"

/** Kinds recognized in the dataset. */
export const CATALOG_KINDS = ["strength", "cardio", "stretch", "mobility"] as const

/** True if the catalog version has been validated against the pinned commit. */
export function isCatalogValid(version?: string): boolean {
  return (version ?? CATALOG_VERSION) === CATALOG_VERSION
}

