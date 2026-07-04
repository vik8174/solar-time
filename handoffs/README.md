# Handoffs (untracked)

Temporary coordinator → worker handoff documents. **Git-ignored on purpose** —
everything here except this README is excluded from history.

## Model

Work on Solar Time runs as **coordinator + workers**:

- **Coordinator** — holds overall state, plans, writes handoffs, reviews results,
  updates the committed docs in [`../docs/`](../docs/).
- **Worker** — a fresh agent session that implements one ticket (slice) from a
  clean context. It reads the latest handoff here, does the work, and reports back.

A handoff is the **interface** between them: a compressed snapshot so a worker can
start in the "smart zone" of its context window without inheriting a bloated session.

## Convention

- File name: `handoff-YYYY-MM-DD-<focus>.md` (e.g. `handoff-2026-07-04-slice4-start.md`).
- Contents: current state, hot next actions, pointers (not duplication), suggested skills.
- These are **disposable**. Durable knowledge — decisions, assumptions, risks, progress —
  belongs in the committed docs under [`../docs/`](../docs/), not here.
