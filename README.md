# TartanOrder

HackCMU 2026 prototype: a menu-valid, reversible food order with explicit review and simulated confirmation. **No real purchase or kitchen dispatch.**

## Run it

Use Node **22.23.2** (the exact version in `.nvmrc`) and npm.

```sh
git clone https://github.com/ClearSky00/TartanOrder.git
cd TartanOrder
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). If `nvm` is unavailable, install Node 22.23.2 from [nodejs.org](https://nodejs.org/en/download/archive/v22.23.2) first. Do not paste API keys into chat or commit them.

The starter uses a **small real local rules parser** and a temporary text/menu kiosk. Try `a burger, fries and lemonade` → $13.50; `make the burger a double` → $16.00; `undo` → $13.50. Review, then explicitly confirm the simulated order. The fuller parser and voice interface belong to C and B respectively.

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

See [integration instructions](docs/integration.md) for ownership and exports, and the [runbook](docs/runbook.md) for the demo/deadline plan.
