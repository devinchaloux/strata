# CLAUDE.md

This file is your context for every session on this repo. Read it before doing
anything else.

If something here conflicts with what Devin is asking for in the moment, stop
and ask. Don't silently override these rules.

---

## What This Project Is

**Strata** is a web-based, open-source music analysis tool built around a unified
analysis document. Analysts link a YouTube video, then build layered analytical
views — called widgets — synchronized to the same playback timeline and saved
into a single portable `.strata` file (JSON).

The core design bets:
- Analysis is data. Formal annotations are structured, queryable records — not
  just display artifacts.
- Overlapping time spans are valid. Multiple analytical frameworks can apply
  simultaneously to the same passage.
- The file format is the invention. The editor UI is downstream of getting the
  schema right.

Read `docs/vision.md` for the full project vision. Read `docs/decisions.md` for
the architectural decisions log. These are the two most important documents in
the repo.

---

## Repo contract

| | |
|---|---|
| **Visibility** | **public** — anything pushed here is published, permanently |
| **Owns** | Strata itself: the `.strata` format, the editor, the widgets |
| **May read** | `research/strata/` — its own private working notes, and nothing else in `research` |
| **May write** | itself, and `research/strata/` for those notes |
| **Never contains** | anything that is not part of this project |

**Strata integrates as a published artifact, not as source.** Other projects embed
a *built* component, or read `.strata` files it produces. Nothing vendors this
code, and this repo depends on nothing outside itself — the private notes are
for sessions, not for the code, and nothing in the build, tests or CI reads
them. If a task seems to need
Strata source inside another codebase, the integration boundary is wrong — that is
a reason to fix the boundary, not to merge the repos.

**Provenance matters, because this repo is public and its history is permanent.**
Anything committed is published, including anything committed by mistake, and
deleting it later does not remove it from the history. Analysis files, notes,
corpus data and sample documents often arrive from somewhere else — **if you did
not create it here and its licence and origin are not clear, ask before committing
it.** That applies to fixtures and test data as much as to documentation.

**Do not propose a monorepo.** Visibility is per-repo, and this project is
open-source while some of the work that uses it is not. Merging repos would force
one visibility on both.

---

## Who You Are in This Workflow

Claude Code (you) handles this project end to end — strategy, design, and
execution. Architecture decisions, schema design, widget specs, doc authoring,
and implementation all happen here.

When you encounter a major design question or ambiguity that genuinely requires
Devin's input — a scope call, a user preference, a constraint you don't have
enough context to resolve — surface it clearly and wait. For design decisions
within the established architecture, make a recommendation and proceed. Note
every decision you make so it can be propagated to `docs/decisions.md`.

---

## Session Start — Always Do This First

**Run `/brief` to begin any session.** This command reads all session
context, checks git state, presents a structured brief, and asks for scope
confirmation before any work begins.

**Never start work until Devin confirms the scope.**

### What `/brief` does

1. Reads `handoff.md` and `build-plan.md` from the private notes (see
   "Private Notes" below), `docs/decisions.md`, `docs/vision.md`, and any other
   notes files
2. Checks `git status` and `git branch`
3. Outputs a structured brief: current phase, last session summary, open
   blockers, proposed scope, git state
4. Asks: "Does this match what you want to work on today?"
5. Waits for confirmation before proceeding

### After scope is confirmed

```bash
git checkout main
git pull origin main
git checkout -b feat/<branch-name>
```

**Cloud session:** the session is handed a `claude/<slug>` branch. Work on it as
given; don't re-cut or rename it. This matches `research`.

If the handoff is missing, contradicts itself, or the git state is unexpected,
surface it and ask before continuing.

---

## Private Notes

This repo is public, so the handoff, build plan, UX specs, backlog and open
questions live in the **private `research` repo, under `strata/`**. Until
2026-09-27 they were in a gitignored `_private/` folder here. It had no backup
and no history, and worktree sessions couldn't see it, so the notes moved.
**Older docs that say `_private/<file>` mean `research/strata/<file>`.** The
filenames didn't change, and those references are historical, like "merged to
`dev`".

**Finding the notes.** `research` is checked out as a sibling of this repo. A
worktree isn't at the repo root, so resolve the root first:

```bash
STRATA_ROOT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
NOTES="$STRATA_ROOT/../research/strata"
```

That works from a local checkout, a worktree or a cloud session. **If `research`
isn't checked out beside this repo, stop and say so.** Don't work without the
brief.

**Writing the notes.** `research`'s own rules govern it: commit freely on that
repo's session branch, push, and never commit to its `main`. Devin merges the
notes PR alongside this repo's PR. Until it merges, `research`'s `main` still
has the previous handoff. Rule 1 below (never commit without being asked) is
this repo's rule and doesn't carry over to `research`. `research`'s freedom to
commit doesn't carry over here either.

**Read `strata/` and nothing else in `research`.** Being checked out beside
Sylloge doesn't make its schema, vault or capture layer Strata's business, and
nothing from there ever lands in this public repo.

---

## Current Phase

`build-plan.md` in the private notes has the phase breakdown and what gates each
phase; `handoff.md` has where the last session left off. Read both at brief
time rather than trusting a summary here — a phase written into this file goes
stale the moment the phase advances.

---

## Hard Rules — Never Override

1. **Never commit without being asked.** Edit files freely. Run no `git add`,
   `git commit`, or `git push` until Devin explicitly says to. When he does,
   propose a commit message in the format below and wait for confirmation.

2. **Never push to `main`.** `main` is the trunk and only receives changes via
   pull request, which Devin opens and merges on GitHub. Pushing your own
   `feat/*` branch to `origin` is how work gets reviewed — that is not a push
   to `main`, and rule 1 still governs when it happens.

3. **Ask before any destructive action.** File deletions, git resets, anything
   irreversible. When in doubt, ask. The cost of asking is low.

4. **Separate private from committed.** Anything operational, sensitive, or not
   part of the permanent project record goes in the private notes
   (`research/strata/`). If uncertain, default to the private notes.

---

## Git

- Always work on a feature branch cut from `main`.
- Branch naming: `feat/<short-description>`
  (e.g. `feat/strata-schema-draft`, `feat/form-diagram-widget-spec`)
- When a task is complete, push the branch to `origin` and open a PR into
  `main`. Devin reviews and merges. Never push to `main` directly.
- Never commit directly to `main`.
- Green CI is the gate. `.github/workflows/ci.yml` runs lint, the Vitest suite,
  and a production build (which is `tsc && vite build`, so it type-checks too)
  on every push and every PR into `main`.

### There is no `dev` branch

Retired September 2026. The old `feat/* -> dev -> PR -> main` flow broke
silently: merging the `dev -> main` PR left the merge commit on `main` with
nothing carrying it back, so `dev` drifted 22 commits behind `main` while still
looking like a valid base. Every one of those 22 was a `Merge pull request from
dev` bubble — the trees were identical, so no work was ever lost, but the base
was a lie and would eventually have produced a real conflict.

CI now does the job `dev` was supposed to do, and does it on every push.

Older docs and commit messages still say things were "merged to `dev`". Those
are historical statements about what happened, not instructions.

---

## Commit Message Format

Use Conventional Commits style:

```
<type>(<scope>): <short summary>

<optional body — what changed and why, if not obvious from the summary>
```

**Types:** `feat` · `fix` · `refactor` · `docs` · `chore`

**Scope:** primary area changed (e.g. `schema`, `docs`, `widgets`, `example`)

**Example:**
```
docs(schema): initial draft of strata.schema.json with core span model

Covers file-level metadata, layer structure, span primitive, and point
markers. Vocabulary system stubbed — v1 ships global built-ins only.
```

Propose commit messages as a code block so Devin can copy them directly.

---

## Documentation — What You Update vs. What You Don't

**Update freely:**
- `handoff.md` in the private notes — at session end, always. Write what
  happened, what's left, what the next session needs to know.
- `docs/decisions.md` — propagate every decision made during the session.
- Any `schema/` or `widgets/` file that was the target of the session.
- `docs/vision.md` — update when design decisions require it. Propose the
  change in plain language before writing if the scope is large.

**Update at milestone moments only:**
- `README.md` — not mid-session. Update when a meaningful milestone ships.

---

## How to Handle Ambiguity

When the handoff doesn't cover something you need:

1. State the specific ambiguity in plain English.
2. Make a recommendation with your reasoning.
3. If it's a scope call, user preference, or something with a constraint you
   don't have context to resolve — ask Devin and wait.
4. If it's a design decision within the established architecture — make the call,
   proceed, and log it in `docs/decisions.md`.

Measure twice before any destructive or hard-to-reverse action. Everything else:
make a call and keep moving.

---

## Session-End Checklist

Before telling Devin a session is done:

1. ✅ Target files updated and in good shape
2. ✅ `handoff.md` in the private notes updated, committed and pushed on
   `research`'s session branch — next session has everything it needs
3. ✅ Any new decisions propagated to `docs/decisions.md`
4. ✅ Summary written: what changed, why, what's open — including that a
   `research` notes PR is waiting, if there is one
5. ✅ Commit message proposed (if Devin wants to commit)
6. ✅ Nothing committed or pushed **in this repo** without explicit instruction

---

*Propose edits to this file in conversation with Devin before making them.*
