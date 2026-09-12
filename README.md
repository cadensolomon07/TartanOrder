# TartanOrder

HackCMU 2026 prototype: conversational voice/text ordering with real Gemini interpretation, a deterministic reversible cart, and explicit review and simulated confirmation. The public catalog contains eleven selected CMU dining locations: 237 orderable choices across eight venues, plus clearly unavailable previews where complete prices are missing. Prices are transcribed from CMU-hosted menu snapshots, not a live register. **No real purchase or kitchen dispatch.**

## Run it

Use Node **22.23.2** (the exact version in `.nvmrc`) and npm.

```sh
git clone https://github.com/cadensolomon07/TartanOrder.git
cd TartanOrder
nvm install
nvm use
npm ci
[ -e .env.local ] || cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). If `nvm` is unavailable, install Node 22.23.2 from [nodejs.org](https://nodejs.org/en/download/archive/v22.23.2) first. Do not paste API keys into chat or commit them.

For Gemini, enter your key after `GEMINI_API_KEY=` in the ignored `.env.local` file and save. The verified model is `gemini-3.6-flash`. Online interpretation is the default; the engineering panel's **Local only** option runs a narrower rules parser without HTTP. Never describe fallback or fixture results as Gemini understanding.

The menu catalog and every simulated order are stored in the Supabase project **TartanOrder** (organization TartanHacks). Set three variables in `.env.local`: `SUPABASE_URL` (the project's `https://….supabase.co` API URL), `SUPABASE_PUBLISHABLE_KEYS` (an `sb_publishable_…` key; the server reads the public catalog with it under Row Level Security) and `SUPABASE_SECRET_KEYS` (an `sb_secret_…` key; the server writes orders with it). Both come from the project's **Settings → API Keys** page; only the current key formats are accepted, and the legacy `anon`/`service_role` JWT keys are refused at startup. The browser never talks to Supabase. Two mode variables mirror the parser and wait modes: `CATALOG_SOURCE=supabase|bundled` (default `supabase`; `bundled` serves the in-repo catalog and is labelled as a fallback in the kiosk header and `/api/health`) and `ORDER_PERSISTENCE=supabase|off`. No Docker or local database is needed; the hosted project is the only database.

At the default **Stack’d Underground**, try “a Smash’d Burger and fresh cut fries” → **$12.65**. Then “make the fresh cut fries two” → **$16.10**. Change **Order from** to try another venue; existing cart items stay in your order. Undo restores the prior cart. Review, then explicitly confirm a simulated ticket. Talk captures browser speech; press **Stop — I’m done** after the complete request. Typing follows the same interpretation path. Human microphone verification is separate from automated voice mocks; see the release evidence and trial protocol below.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run start
```

Playwright browser installation is a one-time setup; CI uses `npx playwright install --with-deps chromium`. Build before running production/e2e. `npm run test:e2e` runs keyless against the labelled bundled catalog with server saving off, which is what CI does. With `.env.local` configured, `npm run db:verify` checks the deployed catalog counts through the publishable key, `npm run test:db:live` writes and deletes one `e2e-` session on the project and proves its export replays to the identical view, and `npm run test:e2e:live` runs the browser suite against the project. All direct dependencies and the npm lockfile are pinned. No Tailwind, payment, authentication, or POS integration.

The [engineering explanation](docs/engineering.md) separates Gemini interpretation from deterministic validation. See [integration evidence](docs/integration.md), [setup and recovery](docs/runbook.md), and the [demo and human microphone protocol](docs/demo.md). Shared schemas are API 3; the served catalog version is `cmu-shortlist-2026-09-12`, loaded from Supabase and reported by `/api/health`. Exports and replays are bound to that version: V1, V2 and other-version logs are rejected rather than repriced. Orders are saved to the server behind the engine; a failed save is shown in the kiosk and never changes the cart. See the [persistence notes](docs/engineering.md#persistence) and [setup and recovery](docs/runbook.md#supabase-persistence). [Menu coverage and sources](docs/dining-data.md) describe unavailable configurations and older published prices. Wait estimates are explicitly simulated; accepting a suggested alternative is optional.

Live demo: **https://tartan-order.vercel.app**. The original ClearSky00 repository was transferred to cadensolomon07; its old address redirects to this same repository. No second repository was created.
