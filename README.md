# Solar Drift

How far your clock drifts from the sun. A small Astro web tool that shows, for a
given city, how much the official wall-clock time deviates from true (apparent)
solar time — driven by longitude offset within the time zone, the equation of
time, and DST.

> ⚠️ Pre-release: the site ships with `noindex` until it's production-ready.

## Quick Start

```sh
git clone https://github.com/vik8174/solar-time.git
cd solar-time
npm install
npm run dev        # local dev server at localhost:4321
```

## Tech Stack

- **Astro 7** — static site generation (SSG)
- **TypeScript** (strict) — pure, DOM-free domain logic
- **Vitest** — unit tests with a coverage gate
- **ESLint** (`strictTypeChecked`) + **Prettier**
- **Firebase Hosting** — stage & prod

## Prerequisites

- **Node.js >= 22.12.0** (see `engines` in `package.json`)
- For deploys: **Firebase CLI authenticated on `vik8174@gmail.com`** (the personal
  account, not a work account). `firebase-tools` is bundled as a devDependency, so
  the deploy scripts use the local `firebase` binary — no global install needed.
  You only need to log in once: `npx firebase login`.

## Scripts

All commands run from the project root:

| Command                 | Action                                                  |
| :---------------------- | :------------------------------------------------------ |
| `npm run dev`           | Start local dev server at `localhost:4321`              |
| `npm run build`         | Build the production site to `./dist/`                  |
| `npm run preview`       | Preview the build locally before deploying              |
| `npm run build:cities`  | Regenerate the city dataset from GeoNames (see below)   |
| `npm run typecheck`     | Type-check with `astro check`                           |
| `npm run lint`          | Lint with ESLint                                        |
| `npm run format`        | Format all files with Prettier                          |
| `npm run format:check`  | Verify formatting without writing                       |
| `npm test`              | Run unit tests once (Vitest)                            |
| `npm run test:watch`    | Run tests in watch mode                                 |
| `npm run test:coverage` | Run tests with coverage (enforces the coverage gate)    |
| `npm run deploy:stage`  | Build and deploy hosting to the **stage** project       |
| `npm run deploy:prod`   | Build and deploy hosting to the **prod** (live) project |
| `npm run astro ...`     | Run Astro CLI commands (`astro add`, `astro check`, …)  |

## Project Structure

```text
solar-time/
├── public/            # Static assets served as-is
├── scripts/           # Build-time tooling (GeoNames city dataset generator)
├── src/
│   ├── domain/        # Pure astronomy logic (solar-time deviation, SSOT)
│   ├── lib/           # View models, formatting, scale geometry helpers
│   ├── components/    # Astro UI components
│   ├── data/          # Generated ~1000-city dataset (cities.json + loader)
│   ├── pages/         # Routes (index + [city] dynamic route)
│   ├── scripts/       # Client entries (deferredInit: lazy analytics + Sentry)
│   └── styles/        # Design tokens
├── docs/              # Durable project history (see below)
└── handoffs/          # Disposable coordinator → worker handoffs (git-ignored)
```

### Regenerating the city dataset

The city list in `src/data` is generated from the [GeoNames](https://www.geonames.org/)
dataset (CC-BY 4.0) by `scripts/buildCities.ts`:

```sh
npm run build:cities
```

## Configuration

Client analytics + error monitoring (ADR D-008) are configured through `PUBLIC_*`
env vars, split across two git-ignored files (copy [`.env.example`](.env.example)):

| File        | Used by                    | Firebase project   |
| :---------- | :------------------------- | :----------------- |
| `.env`      | local dev + `deploy:stage` | `solar-time-stage` |
| `.env.prod` | `deploy:prod` only         | `solar-time-prod`  |

| Variable                         | Service            | Notes                                            |
| :------------------------------- | :----------------- | :----------------------------------------------- |
| `PUBLIC_FIREBASE_API_KEY`        | Firebase Analytics | Required to boot Analytics                       |
| `PUBLIC_FIREBASE_PROJECT_ID`     | Firebase Analytics | Required                                         |
| `PUBLIC_FIREBASE_APP_ID`         | Firebase Analytics | Required                                         |
| `PUBLIC_FIREBASE_MEASUREMENT_ID` | Firebase Analytics | Required (`G-…`); needs GA linked to the project |
| `PUBLIC_FIREBASE_AUTH_DOMAIN`    | Firebase Analytics | Optional                                         |
| `PUBLIC_SENTRY_DSN`              | Sentry             | Enables the error monitor when set               |

**Why two files, not `.env` + `.env.production`:** every `astro build` runs in
Vite's `production` mode, so a `.env.production` would be auto-loaded for the
**stage** deploy too. The stage/prod split is driven by `SITE_ENV` instead — so
`deploy:prod` loads `.env.prod` explicitly via `dotenv-cli`, and those values
take precedence over the auto-loaded `.env`. `.env.prod` is a non-magic name, so
it is never auto-loaded elsewhere. Grab a project's config with
`firebase apps:sdkconfig WEB <appId> --project <project>`; `measurementId` only
appears once Google Analytics is linked (console → Integrations).

These are **not secrets** — Astro inlines them into the client bundle, and both
the Firebase web config and the Sentry DSN are safe to expose. Any group left
unset simply turns that SDK **off**, so local dev, CI, and the build all run
green without real keys. Both SDKs load lazily after `requestIdleCallback`
(shared `deferredInit`), so they never block first paint; Analytics is cookieless
(zero cookies), and Sentry is error-only with GPS coordinates scrubbed from every
event. The Sentry `environment` tag (`staging` / `production`) is derived from
`SITE_ENV` at build time (see `src/config/site.ts`), not from an env var.

## Deployment

Deploys go to Firebase Hosting. Project aliases are defined in `.firebaserc`:

| Alias   | Firebase project   | Command                |
| :------ | :----------------- | :--------------------- |
| `stage` | `solar-time-stage` | `npm run deploy:stage` |
| `prod`  | `solar-time-prod`  | `npm run deploy:prod`  |

Both scripts run `npm run build` first, then `firebase deploy --only hosting -P <alias>`.
`deploy:prod` sets `SITE_ENV=prod` (which drives indexing/robots/sitemap, D-020,
and the Sentry `environment` tag, D-008) and loads `.env.prod` via `dotenv-cli`
so the prod Firebase/Sentry keys are used instead of the stage `.env`.

> `deploy:prod` hits the **live production** project. It's a deliberate manual
> action — there is no CI auto-deploy on merge.

## Documentation

Durable project history and rationale live in [`docs/`](docs/):

- [`docs/PROGRESS.md`](docs/PROGRESS.md) — what shipped per slice
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — key decisions + assumptions (ADR-lite)
- [`docs/RISKS.md`](docs/RISKS.md) — known risks and things to watch
