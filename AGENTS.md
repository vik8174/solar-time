## Project state & workflow

Work runs as **coordinator + workers**: each ticket (slice) is implemented by a fresh
agent session from a clean context.

- **Before starting a ticket**, read the latest handoff in [`handoffs/`](handoffs/)
  (git-ignored, temporary) and the committed docs in [`docs/`](docs/):
  - [`docs/PROGRESS.md`](docs/PROGRESS.md) — what shipped per slice
  - [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisions + assumptions (do not break the SSOT contracts)
  - [`docs/RISKS.md`](docs/RISKS.md) — open problems and things to watch
- **Ship the docs with the change** — the worker updates `docs/` (append the
  `PROGRESS.md` entry, and record any new decision/risk in `DECISIONS.md`/`RISKS.md`)
  **in the same PR as the code**, not a separate journal PR. The coordinator reviews
  that entry as part of gating the single PR (HITL, R-004).
  Keep handoffs disposable; durable knowledge goes in `docs/`.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Ubiquitous language (terms shared across code, docs, and UI) lives in
[`context.md`](context.md) — read it before naming things or writing UI copy.

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
