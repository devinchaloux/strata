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

**This workflow has two layers:**

- **Claude Chat** is the strategy and reasoning layer. Architecture decisions,
  schema design, widget specs, doc authoring — all happen there.
- **Claude Code (you)** is the execution layer. You implement, write to files,
  and iterate on what's already been decided. You do not redesign, re-scope, or
  make strategic calls.

When you encounter ambiguity, a design question, or a decision that wasn't
covered in the handoff, **stop and surface it**. Don't guess. Don't extrapolate.
Pause, explain what you found, and wait. A short pause beats hours of unwinding
bad assumptions.

---

## Session Start — Always Do This First

1. Read `_private/handoff.md` — this is your brief for the session.
2. Confirm the session goal with Devin before writing anything.
3. If the handoff is missing, incomplete, or contradicts itself, ask before
   starting.
4. Check for any listed prerequisites and verify they're met before proceeding.

Then run:

```bash
git checkout dev
git pull origin dev
git checkout -b feat/<branch-name>
```

If any of these commands fails, stop and surface it before continuing.

---

## Project Structure

```
strata/
├── CLAUDE.md
├── .gitignore
├── README.md
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

**Design phase — no application code yet.**

Work in this phase is entirely in `docs/`, `schema/`, and `widgets/`. There is
no `src/` directory, no `package.json`, no dev server, no database. Do not
scaffold application code until explicitly asked.

The goal of this phase is to produce:
1. A formal, validated `.strata` JSON schema
2. A realistic example `.strata` file that stress-tests the schema
3. A widget contract specification for the form diagram widget
4. A clean, complete decisions log

---

## Hard Rules — Never Override

1. **Never commit without being asked.** Edit files freely. Run no `git add`,
   `git commit`, or `git push` until Devin explicitly says to. When he does,
   propose a commit message in the format below and wait for confirmation.

2. **Never push to `main`.** `main` only receives changes via pull request,
   which Devin opens and merges on GitHub.

3. **Ask before any destructive action.** File deletions, git resets, anything
   irreversible. When in doubt, ask. The cost of asking is low.

4. **Separate private from committed.** Anything operational, sensitive, or not
   part of the permanent project record goes in `_private/`. If uncertain,
   default to `_private/`.

---

## Git

- Always work on a feature branch cut from `dev`.
- Branch naming: `feat/<short-description>`
  (e.g. `feat/strata-schema-draft`, `feat/form-diagram-widget-spec`)
- When a task is complete, merge the feature branch into `dev` and push to
  `origin/dev`. Never push to `main`.
- Never commit directly to `dev` or `main`.

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
- `docs/decisions.md` — when a decision made in the handoff needs to be
  propagated to the permanent record.
- Any `schema/` or `widgets/` file that was the target of the session.

**Let Chat own these — flag changes rather than making them:**
- `docs/vision.md` — strategy document, maintained in Chat.
- `README.md` — updated at milestone moments, not mid-session.

If you think a Chat-owned doc needs a change, flag it in your session summary.

---

## How to Handle Ambiguity

When the handoff doesn't cover something you need:

1. Stop.
2. State the specific point of ambiguity in plain English.
3. Offer your best guess, framed as a guess.
4. Recommend the right next step — usually "take this back to Chat."
5. Wait.

Do not extrapolate and keep going. The separation of Chat (strategy) and CC
(execution) exists for a reason. Pulling strategy into the execution environment
is the failure mode this workflow is designed to prevent.

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

*This file is maintained in Claude Chat. Propose edits via the session friction
log rather than editing directly unless Devin asks.*
