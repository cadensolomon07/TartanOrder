# TartanOrder

HackCMU 2026 prototype: conversational voice/text ordering with real Gemini interpretation, a deterministic reversible cart, and explicit review and simulated confirmation. The campus catalog contains eleven selected CMU dining locations: 237 orderable choices across eight venues, plus clearly unavailable previews where complete prices are missing. A separate **fictional Demo Counter** demonstrates optional meal budgets and persistent dietary requirements. Campus prices are transcribed from CMU-hosted menu snapshots, not a live register. **No real purchase or kitchen dispatch.**

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

At the default **Stack’d Underground**, try “a Smash’d Burger and fresh cut fries” → **$12.65**. Then “make the fresh cut fries two” → **$16.10**. Change **Order from** to try another venue; existing cart items stay in your order. Undo restores the prior cart. Review, then explicitly confirm a simulated ticket. Talk captures browser speech; press **Stop — I’m done** after the complete request. Typing follows the same interpretation path. Human microphone verification is separate from automated voice mocks; see the release evidence and demo instructions below.

## Try the meal and dietary demo

Select **Demo Counter · fictional recipes**. Say or type: “I have twelve dollars. Get me a main, a side, and a drink. Keep the fries and lemonade.” The deterministic meal builder selects Grilled Cheese + Fries + Lemonade for **$12.00**. “Actually, make it a chicken sandwich” proposes **$14.00** and keeps the accepted $12 order until you explicitly choose to increase the budget or keep it.

The **Your food requirements** controls also support manual budgets, required components, item locks, vegetarian/vegan preferences, allergies and dislikes. They apply to ordinary orders too. Known conflicts and unknown ingredient/preparation evidence block automatic recommendations and confirmation; preference exceptions never waive allergies. Campus prices do not establish dietary suitability. The small demo recipe dataset is explicitly fictional, including its preparation examples. No allergy-safety guarantee or staff contact is claimed.

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

The [engineering explanation](docs/engineering.md) separates Gemini interpretation from deterministic validation. See [integration evidence](docs/integration.md), [setup and recovery](docs/runbook.md), and the [demo and microphone evidence](docs/demo.md). Shared schemas are API 2 / `cmu-meal-2026-09-12`; older catalog logs are rejected rather than repriced. [Menu coverage and sources](docs/dining-data.md) describe unavailable configurations and older published prices. Wait estimates are explicitly simulated; accepting a suggested alternative is optional.

The meal/dietary milestone passed **697 default tests** with **29 opt-in cases skipped**, typecheck, lint and production build. Earlier in this integration, all 30 browser checks passed; the final relevant seven checks and an additional offline manual meal/dietary receipt check passed. Real Gemini evidence is separate: nine direct adapter cases and seven local production-browser requests passed, with all nine browser checkpoints, no fallback and no page errors. These are synthetic typed inputs, not new human microphone evidence.

Public URL: **https://tartan-order.vercel.app**. Before demonstrating the new journey there, verify that [health](https://tartan-order.vercel.app/api/health) reports `menuVersion: "cmu-meal-2026-09-12"` and consult the [release handoff](docs/integration.md) for the executed public result. The locally built application is the fallback. The original ClearSky00 repository was transferred to cadensolomon07; its old address redirects to this same repository. No second repository was created.
