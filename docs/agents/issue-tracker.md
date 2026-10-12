# Issue tracker: Local Markdown

Repo: `enka-cookbook-mig` (branche `mig/pocketbase`).

Issues and specs (you may know a spec as a PRD) for this repo live as markdown files in `.scratch/tracker/` — the one committed part of `.scratch/` (everything else there is transient and gitignored).

## Conventions

- `.scratch/*` is gitignored except `!.scratch/tracker/` — the tracker stays committed
- Feature directories are date-prefixed: `.scratch/tracker/<YY-MM-DD>_<feature>/`
- The spec is `.scratch/tracker/<YY-MM-DD>_<feature>/spec.md`
- The orchestrator's run report is `.scratch/tracker/<YY-MM-DD>_<feature>/run.md` — committed for the trace but disposable: the git history is its archive, and anything that must outlive it belongs in `docs/` (ADR, domain doc)
- The deferred backlog is `.scratch/tracker/backlog.md` — one `- [ ]` line per discovery, `[tag] <date> · <source> · <file:line> — <what>`, tag among `bug`/`typo`/`debt`. Committed, and it is not a ticket: nobody works it automatically. **The maintainer is its reader** — they hand a line to an agent when they want it done. Exits: promoted (line checked, pointer to the ticket that took it), rejected (line deleted; an ADR only when the refusal itself is architectural), stale (pruned).
- Implementation issues are one file per ticket at `.scratch/tracker/<YY-MM-DD>_<feature>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/tracker/<YY-MM-DD>_<feature>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/tracker/<YY-MM-DD>_<effort>/map.md` — the Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/tracker/<YY-MM-DD>_<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/tracker/<YY-MM-DD>_<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.
