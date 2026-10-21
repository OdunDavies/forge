# Exercise demonstrations

The library opens with **Only show video demonstrations** enabled. Turning it off keeps the entire existing catalog searchable. Saved exercise IDs, workouts, and plans are unchanged.

`src/data/exercise-media.json` contains explicit matches for 199 existing exercise IDs, using 95 distinct demonstrations. Matching uses exact names or reviewed aliases, never a fuzzy match between different lifts. Tempo and pause variants identify the base movement in the player; other unsupported variations keep their instructions and existing photos.

Videos use the browser's native player, with play/pause, seeking, volume, and fullscreen controls. Playback starts on request. If the primary video fails, the player tries an alternative demonstration when available. If both fail, it shows a retry action and a photo option where available. Missing media is never silently hidden.

Primary videos are bundled in `public/exercise-demos/` and served directly by Forge. The manifest's `sources` field records their original download URLs. External videos are only used as alternatives.

## Source and maintenance

Do not ingest provider aliases automatically. Some incorrectly equate different lifts, including the flat dumbbell bench press and seated shoulder press. Keep these exercises unmatched until a correct demonstration is available.

Demonstration URLs and names are from [Free Exercise DB with Videos](https://github.com/luisaraujoc/free-exercise-db-api), licensed under MIT. The required copyright and license notice is retained in [exercise-videos-MIT.txt](licenses/exercise-videos-MIT.txt). Existing photos remain sourced from [Free Exercise DB](https://github.com/yuhonas/free-exercise-db).

Run `node scripts/check-exercise-media.mjs` to check all bundled MP4 assets and remote alternatives. Remote checks use real MP4 byte-range responses; the media host rejects HEAD requests even when GET and browser playback work. Rerun this check when updating the manifest. No API key or paid service is required.
