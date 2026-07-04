# Solar Time — Project Docs

Committed project history and knowledge. Unlike the throwaway handoffs in
[`../handoffs/`](../handoffs/), everything here lives in git history and is the
durable source of truth for **how** and **why** the project evolved.

| Doc                          | Purpose                                                   |
| ---------------------------- | --------------------------------------------------------- |
| [PROGRESS.md](PROGRESS.md)   | Chronological log — what shipped per slice, PRs, outcomes |
| [DECISIONS.md](DECISIONS.md) | Key decisions + assumptions, with rationale (ADR-lite)    |
| [RISKS.md](RISKS.md)         | Known risks, open problems, things to watch               |

## How to keep these updated

- **PROGRESS.md** — append an entry when a slice merges. Newest on top.
- **DECISIONS.md** — add an entry the moment a hard-to-reverse choice is made.
  Never rewrite history; supersede an old decision with a new one and link them.
- **RISKS.md** — add when a risk is spotted; mark resolved/accepted rather than deleting.

The PRD (GitHub issue #1) and per-slice tickets (#2–#13) remain the requirement
source; these docs record the _journey_, not the spec.
