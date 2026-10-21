# Forge

AI training OS for lifting. Log sessions in a few taps, follow a plan biased to the muscles you want to grow, and share recap cards when you finish.

## Stack

- TanStack Start + React 19
- Postgres (Neon in production, embedded PGLite in local preview)
- Better Auth (email/password, Google, X)
- NVIDIA NIM or Gemini for coaching and photo analysis

## Local

```bash
npm ci
npm run dev
```

App runs on port 8080.

## Deploy (Vercel)

Build is already set for Vercel (`nitro` vercel preset). Set these environment variables on the project:

| Variable               | Required                               | Purpose                                                                    |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| `DATABASE_URL`         | yes                                    | Postgres connection string (Neon, Supabase, or any Postgres)               |
| `BETTER_AUTH_SECRET`   | yes                                    | Session signing secret                                                     |
| `BETTER_AUTH_URL`      | yes                                    | Canonical public site URL, e.g. `https://forge.example.com`                |
| `NVIDIA_API_KEY`       | for NVIDIA coaching and photo analysis | NVIDIA Build API key (server only)                                         |
| `NVIDIA_MODEL`         | optional                               | Text model; defaults to `nvidia/nemotron-3.5-lightning-30b-a3b`            |
| `NVIDIA_VISION_MODEL`  | optional                               | Photo model; defaults to `google/gemma-4-31b-it`                           |
| `AI_PROVIDER`          | optional                               | `nvidia` or `gemini`; otherwise detected from configured key               |
| `GEMINI_API_KEY`       | alternative / legacy                   | Gemini key, or existing NVIDIA `nvapi-` key automatically routed to NVIDIA |
| `GEMINI_MODEL`         | optional                               | Gemini model override; defaults to `gemini-3.8-flash`                      |
| `GOOGLE_CLIENT_ID`     | for Google login                       | Google Cloud OAuth web client                                              |
| `GOOGLE_CLIENT_SECRET` | for Google login                       | Google Cloud OAuth web client                                              |
| `VITE_AUTH_ENABLED`    | recommended                            | Set to `true`                                                              |

Google login on Vercel is **native Google OAuth** (not the Grok broker). Create a Web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

- Authorized JavaScript origins: your exact `BETTER_AUTH_URL`
- Authorized redirect URI: `<BETTER_AUTH_URL>/api/auth/callback/google`

Email/password works without Google keys. The Grok broker (`GROK_AUTH_*`) is only for the sandbox live preview.

Migrations in `migrations/` apply automatically during `npm run build` when `DATABASE_URL` is set.

Onboarding offers **Use my photos** alongside preset goals. Users can upload a current photo and a goal reference, review suggested training priorities, and use that analysis when generating their first plan. Photos are compressed in the browser and sent to the configured AI provider; only the derived notes and priorities are stored in `goal_scans`. Migration `0011_body_goal_comparisons.sql` adds comparison metadata. Photo analysis requires a configured NVIDIA or Gemini key; users can continue with a preset goal when analysis is unavailable.

## Exercise demonstrations

The library includes bundled video demos with playback controls and recovery options. See [Exercise media](docs/EXERCISE_MEDIA.md) for supported movements, validation commands, and source notices.

## Release checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:regression
npm run build
```

Production fails closed when `DATABASE_URL` or `BETTER_AUTH_SECRET` is missing. Generate the auth secret independently; do not derive it from the database URL. Forge is entirely free. There are no paid tiers, checkout flows, or membership limits. See [Product context](docs/PRODUCT_CONTEXT.md) for persistent product decisions.

### Verify AI connectivity

Run `npm run check:ai` with server-side credentials loaded. It makes a small structured-text request and, for NVIDIA, a synthetic image request; no personal photos are used and no key or model response is printed. For Vercel configuration, use `vercel env run -e production -- npm run check:ai` (Secret variables may not be available outside deployments). NVIDIA keys previously saved under `GEMINI_API_KEY` continue to work; prefer `NVIDIA_API_KEY` for new configuration. Keep keys out of `VITE_*` variables and Git.
