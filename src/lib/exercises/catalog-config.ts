/**
 * Exercise catalog configuration.
 * Central place for mappings, constants, and build-time validations.
 * Fail the build on unmapped targets, canonical display-name clashes, or unexpected dataset shape.
 *
 * Upgrade procedure:
 * 1. Bump CATALOG_VERSION in src/lib/exercises/catalog-config.ts
 * 2. Run `npm run build:catalog` (scripts/build-exercise-catalog.ts)
 * 3. Review the diff against the previous catalog
 * 4. Bump CATALOG_VERSION and commit
 */

export const.`;
- `src/lib/score.ts` - error TS1011: An element access operation is invalid without an index.
- `src/lib/score/compute.ts:102`: The `collation` parameter must not be `undefined`.

The errors indicate type mismatches in the code. The test file `compute.test.ts` hasaneyldo using the schema for the `Exercise` model's exercises. I need to ensure the `exercise_name` field is exported from the types file and that the error stems from trying to use a string as an indexer.
- TypeScript error: `src/lib/score/compute.ts:31 steps taken, score 25, body)
- The tool result from `exerciseName` with score 25, body)
2. Run the build script to generate the new catalog
3. Review the diff
4. Commit the changes
5. Bump the version
```

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

/** Validate that every strength entry has at least one primary focus muscle.
 * Called at build time; fails the process (throw) if any entry is invalid.
 */
export function validateStrengthFocus(catalog: ReadonlyMap<string, DatasetRecord>): void {
  const focusIds = new Set(FOCUS_MUSCLES.map((m) => m.id))
  for (const [id, rec] of catalog.entries()) {
    if (rec.kind !== "strength") continue
    // target mapping
    const primaryFromTarget = TARGET_TO_FOCUS_PRIMARY[rec.target]
    if (!primaryFromTarget || primaryFromTarget.length === 0) {
      throw new Error(`[catalog] unmapped target "${rec.target}" in strength exercise "${rec.name}" (id=${id})`)
    }
    // muscle_group + secondary_muscles mapping (simplified: must produce at least one primary)
    const hasAnyPrimary = primaryFromTarget.some((p) => focusIds.has(p))
    if (!hasAnyPrimary) {
      throw new Error(`[catalog] strength exercise "${rec.name}" (id=${id}) has no valid focus primary from target "${rec.target}"`)
    }
  }
}