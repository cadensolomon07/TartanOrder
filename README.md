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

Playwright browser installation is a one-time setup; CI uses `npx playwright install --with-deps chromium`. Build before running production/e2e. All direct dependencies and the npm lockfile are pinned. No Tailwind, database, payment, authentication, or POS integration.

The [engineering explanation](docs/engineering.md) separates Gemini interpretation from deterministic validation. See [integration evidence](docs/integration.md), [setup and recovery](docs/runbook.md), and the [demo and human microphone protocol](docs/demo.md). Shared schemas are API 2 / `cmu-shortlist-2026-09-12`; older catalog logs are rejected rather than repriced. [Menu coverage and sources](docs/dining-data.md) describe unavailable configurations and older published prices. Wait estimates are explicitly simulated; accepting a suggested alternative is optional.

Live demo: **https://tartan-order.vercel.app**. The original ClearSky00 repository was transferred to cadensolomon07; its old address redirects to this same repository. No second repository was created.
