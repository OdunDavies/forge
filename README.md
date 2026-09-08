# Forge

AI training OS for lifting. Log sessions in a few taps, follow a plan biased to the muscles you want to grow, and share recap cards when you finish.

## Stack

- TanStack Start + React 19
- Postgres (Neon in production, embedded PGLite in local preview)
- Better Auth (email/password, Google, X)
- Gemini for the coach

## Local

```bash
npm install
npm run dev
```

App runs on port 8080.

## Deploy (Vercel)

Build is already set for Vercel (`nitro` vercel preset). Set these environment variables on the project:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string (Neon, Supabase, or any Postgres) |
| `BETTER_AUTH_SECRET` | yes | Session signing secret |
| `BETTER_AUTH_URL` | yes | Public site URL, e.g. `https://forgexyx.vercel.app` |
| `GEMINI_API_KEY` | for AI coach | Google Gemini (AI Studio) |
| `GOOGLE_CLIENT_ID` | for Google login | Google Cloud OAuth web client |
| `GOOGLE_CLIENT_SECRET` | for Google login | Google Cloud OAuth web client |
| `VITE_AUTH_ENABLED` | recommended | Set to `true` |

Google login on Vercel is **native Google OAuth** (not the Grok broker). Create a Web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

- Authorized JavaScript origins: `https://forgexyx.vercel.app`
- Authorized redirect URIs: `https://forgexyx.vercel.app/api/auth/callback/google`

Email/password works without Google keys. The Grok broker (`GROK_AUTH_*`) is only for the sandbox live preview.


Migrations in `migrations/` apply automatically during `npm run build` when `DATABASE_URL` is set.
