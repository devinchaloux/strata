---
description: Session start workflow — reads all project context, checks git state, presents a brief, and confirms scope before any work begins.
---

You are starting a new work session on the Strata project. Follow these steps exactly, in order, before doing anything else.

## Step 1 — Read all session context

Read these files in order:

1. `_private/handoff.md` — primary session brief
2. `_private/build-plan.md` — current phase breakdown and tech stack
3. `docs/decisions.md` — architectural decisions log
4. `docs/vision.md` — full project vision

Then use Glob to check for any other files in `_private/` (`_private/*.md`) and read any you haven't already read.

## Step 2 — Check git state

Run these commands in order:

Run all three in a single Bash call:

```
git fetch origin && git status && git log origin/main..HEAD --oneline && echo "---recent---" && git log --oneline -5
```

- `git fetch origin` — update all remote refs before any comparison
- `git status` — confirm current branch and any uncommitted changes
- `git log origin/main..HEAD --oneline` — commits on the current branch not yet in main; **if this is empty**, the recent log below explains why (already merged, or fresh branch)
- `git log --oneline -5` — last 5 commits on the current branch for context; always visible so an empty ahead-of-main result is immediately interpretable

**Reconcile the handoff against git — git is the source of truth.** The handoff is
written *before* Devin commits, so its "uncommitted work / proposed commit" section
describes a state that is about to change. By the next session, that work has
usually been committed and merged by Devin (he creates a PR, merges it, and closes
it immediately). Do not treat the handoff's git claims as current: compare them to
actual `git log` / `git status`, and if the handoff says work is uncommitted but
git shows it landed, that is the expected, healthy case — report the delta plainly
and move on. Only flag a genuine problem (lost work, unexpected dirty tree,
surprising branch). Report anything unexpected.

## Step 3 — Present a session brief

Output a structured brief in exactly this format — concise, no filler:

---
**Current phase:** [phase name and number from build-plan.md]

**Last session:** [1–2 sentences — what was done, from handoff.md]

**Open blockers:** [list from handoff.md, or "none"]

**Proposed scope:** [what the handoff recommends as next work]

**Git state:** [branch name, any uncommitted changes]
---

## Step 4 — Confirm scope

After the brief, ask:

> "Does this match what you want to work on today, or do you want to adjust the scope?"

## Step 5 — Wait

Do not read any additional files, write any files, run any commands, or begin any work until Devin confirms the scope.

## Step 6 — Cut a feature branch (after scope confirmed)

Once Devin confirms scope, immediately run:

```bash
git checkout dev && git pull origin dev && git checkout -b feat/<short-description>
```

**Do this before touching any files.** No exceptions. Branch naming: `feat/<short-description>` (e.g. `feat/color-picker`, `feat/label-fix`).

This step exists because a session committed directly to `dev` on 2026-06-30 — the brief confirmed scope but the branch was never cut. The branch cut is the first action of every work session, not an afterthought.
