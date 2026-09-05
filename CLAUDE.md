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

1. Reads `_private/handoff.md`, `_private/build-plan.md`, `docs/decisions.md`,
   `docs/vision.md`, and any other files in `_private/`
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

If the handoff is missing, contradicts itself, or the git state is unexpected,
surface it and ask before continuing.

---

## Project Structure

```
strata/
├── CLAUDE.md
├── .gitignore
├── README.md
├── .claude/
│   └── skills/
│       └── brief/
│           └── SKILL.md    ← /brief — session start workflow
├── docs/
│   ├── vision.md           ← full project vision (distilled from ideation)
│   └── decisions.md        ← architectural decisions log, living document
├── schema/
│   ├── strata.schema.json  ← formal JSON schema spec — most important file
│   └── example.strata      ← hand-authored realistic example file
└── widgets/
    └── form-diagram.md     ← widget contract spec for the form diagram widget
```

`_private/` exists locally but is gitignored — never commit anything from it.

---

## Current Phase

**Pre-build: design sessions and schema work.**

Design decisions, schema, and widget contract specs are being finalized before
application code is written. See `_private/build-plan.md` for the full phase
breakdown and what gates each phase.

The immediate goals (Phase 0) are:
1. Formal TypeScript types and JSON schema (`schema/strata.schema.json`)
2. Widget contract specification (`widgets/_contract.md`)
3. Form diagram editor UX spec
4. Merge UX spec
5. Player chrome spec

Once Phase 0 is complete, Phase 1 scaffolds the Vite + React + TypeScript
application.

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
   part of the permanent project record goes in `_private/`. If uncertain,
   default to `_private/`.

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
- `_private/handoff.md` — at session end, always. Write what happened, what's
  left, what the next session needs to know.
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
2. ✅ `_private/handoff.md` updated — next session has everything it needs
3. ✅ Any new decisions propagated to `docs/decisions.md`
4. ✅ Summary written: what changed, why, what's open
5. ✅ Commit message proposed (if Devin wants to commit)
6. ✅ Nothing committed or pushed without explicit instruction

---

*Propose edits to this file in conversation with Devin before making them.*
