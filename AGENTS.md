## Project state & workflow

Work runs as **coordinator + workers**: each ticket (slice) is implemented by a fresh
agent session from a clean context.

- **Before starting a ticket**, read the latest handoff in [`handoffs/`](handoffs/)
  (git-ignored, temporary) and the committed docs in [`docs/`](docs/):
  - [`docs/PROGRESS.md`](docs/PROGRESS.md) — what shipped per slice
  - [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisions + assumptions (do not break the SSOT contracts)
  - [`docs/RISKS.md`](docs/RISKS.md) — open problems and things to watch
- **When a slice merges**, update `docs/` (append progress, record any new decision/risk).
  Keep handoffs disposable; durable knowledge goes in `docs/`.

## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
