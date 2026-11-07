# Phish Thumbprint

A personal, profile-first reading of a Phish fan's concert history — "psychedelic modern," dark-only navy + cream, hand-crafted (no UI system). Story 1 scaffolds the Next.js foundation and design system.

## Stack

- Next.js 16 (App Router, Turbopack) + React 19
- TypeScript — pinned to **5.9.3**. The architecture spine names "TypeScript 7 (native compiler)"; the current ESLint toolchain (`typescript-eslint`) declares `typescript: ">=4.8.4 <6.0.0"`, so TS 7 is not yet installable with `next lint`. This is a deliberate, documented deviation.
- Drizzle ORM over Neon Postgres (`@neondatabase/serverless`)
- Better Auth (Apple provider) + `@better-auth/drizzle-adapter` + `jose` for the Apple client-secret JWT
- Bespoke CSS only — all design tokens live in `styles/tokens.css` as CSS custom properties; components reference them, never hard-code a hex/radius/spacing value.
- Tests: Node's built-in test runner via `tsx --test` (pure-logic, no live key/DB).

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (type-checks) |
| `npm run lint` | ESLint (Next core-web-vitals + typescript) |
| `npm test` | Run unit tests (resolve/upsert, Apple client-secret, env fail-fast) |
| `npm run db:generate` | Generate the Drizzle migration (offline) |
| `npm run db:migrate` | Apply migrations (needs `DATABASE_URL`) |

## Environment

Copy `.env.example` to `.env` (or set in Vercel):

- `PHISHNET_API_KEY` — phish.net v5 key (server-only; sent as the `X-API-KEY` header)
- `DATABASE_URL` — Neon Postgres connection string
- `BETTER_AUTH_SECRET` — Better Auth session-signing secret (server-only)
- `BETTER_AUTH_URL` — the app's own origin, used for auth callback/redirect URLs
- `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` — Apple Sign-in credentials (server-only; read lazily at sign-in)
- `BUST_OUT_GAP_THRESHOLD` — bust-out gap threshold (default 50)

Missing `PHISHNET_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `BETTER_AUTH_URL` fails fast at server start (`instrumentation.ts`). Apple credentials are optional at boot; a missing one surfaces a clear error at sign-in instead.
