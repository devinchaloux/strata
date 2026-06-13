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

Run `git status` and `git branch` to confirm the current branch and whether there are uncommitted changes from a prior session. Report anything unexpected.

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
