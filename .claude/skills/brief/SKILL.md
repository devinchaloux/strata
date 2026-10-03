---
description: Session start workflow — reads all project context, checks git state, presents a brief, and confirms scope before any work begins.
---

You are starting a new work session on the Strata project. Follow these steps exactly, in order, before doing anything else.

## Step 1 — Find the private notes

The handoff, build plan, backlog and specs live in the private `research` repo
under `strata/`, checked out as a sibling of this repo (see "Private notes" in
the maintainer instructions that `CLAUDE.md` imports). Locate it and bring it up to date in one Bash call:

```bash
STRATA_ROOT="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"
RESEARCH="$STRATA_ROOT/../research"
NOTES="$RESEARCH/strata"
echo "notes: $NOTES" && ls "$NOTES" && git -C "$RESEARCH" fetch origin && git -C "$RESEARCH" status -sb | head -1 && echo "---notes changes on origin/main not in this checkout---" && git -C "$RESEARCH" log --oneline HEAD..origin/main -- strata
```

The first line resolves the repo root, so this works from a worktree or a cloud
session as well as a plain checkout.

- **`$NOTES` doesn't exist:** stop and tell Devin. `research` isn't checked out
  beside this repo. Don't start without the brief.
- **The last command prints commits:** this checkout is behind on the notes. If
  `research` is on `main` with a clean tree, `git -C "$RESEARCH" pull --ff-only`.
  Otherwise don't touch its checkout. Read the current versions with
  `git -C "$RESEARCH" show origin/main:strata/<file>` and mention that you did.

## Step 2 — Read all session context

Read these files in order:

1. `$NOTES/handoff.md` — primary session brief
2. `$NOTES/build-plan.md` — current phase breakdown and tech stack
3. `docs/decisions.md` — its header and "Find a decision" index, then the last
   ten entries (the newest are at the bottom). Read further entries when the
   proposed scope touches their area. The whole log runs to thousands of lines;
   reading it all every session costs more than it tells you.

Read `docs/vision.md` only when the session touches the project's direction:
it is the original statement of intent and rarely changes.

Then use Glob to check for any other files in `$NOTES` (`*.md`) and read any you haven't already read.

Older docs refer to these files as `_private/<file>`. That was their location
before 2026-09-27, and the filenames are unchanged.

## Step 3 — Check git state

Run them in a single Bash call:

```
git fetch origin && git status && git log origin/main..HEAD --oneline && echo "---recent---" && git log --oneline -5
```

- `git fetch origin` — update all remote refs before any comparison
- `git status` — confirm current branch and any uncommitted changes
- `git log origin/main..HEAD --oneline` — commits on the current branch not yet in main; **if this is empty**, the recent log below explains why (already merged, or fresh branch)
- `git log --oneline -5` — last 5 commits on the current branch for context; always visible so an empty ahead-of-main result is immediately interpretable

**Reconcile the handoff against git — git is the source of truth.** Sessions push
their work to a session branch; Devin opens the PR and merges it, usually soon
after. So by the next session, a branch the handoff calls "pushed, awaiting PR" has
usually merged into `main`. Compare the handoff's git claims to actual `git log` /
`git status`: work that landed since is the expected, healthy case — report the
delta plainly and move on. Only flag a genuine problem (lost work, unexpected dirty
tree, surprising branch, a session branch that never merged). Report anything
unexpected.

The same applies to the notes. If an unmerged `research` branch holds a newer
handoff than `main`, a notes PR from the last session is still open. Say so in
the brief. Don't treat it as lost work.

## Step 4 — Present a session brief

Output a structured brief in exactly this format — concise, no filler:

---
**Current phase:** [phase name and number from build-plan.md]

**Last session:** [1–2 sentences — what was done, from handoff.md]

**Open blockers:** [list from handoff.md, or "none"]

**Proposed scope:** [what the handoff recommends as next work]

**Git state:** [branch name, any uncommitted changes]
---

## Step 5 — Confirm scope

After the brief, ask:

> "Does this match what you want to work on today, or do you want to adjust the scope?"

## Step 6 — Wait

Do not read any additional files, write any files, run any commands, or begin any work until Devin confirms the scope.

## Step 7 — Cut a feature branch (after scope confirmed)

Once Devin confirms scope, immediately run:

```bash
git checkout main && git pull origin main && git checkout -b feat/<short-description>
```

In a **worktree**, `main` may be checked out elsewhere, so cut from the remote
instead: `git fetch origin && git checkout -b feat/<short-description> origin/main`.

In a **cloud session**, you're handed a `claude/<slug>` branch. Work on it as
given and don't cut another. Confirm it starts from current `main` with
`git log --oneline -3`.

**Do this before touching any files.** No exceptions. Branch naming: `feat/<short-description>` (e.g. `feat/color-picker`, `feat/label-fix`).

This step exists because a session committed directly to the shared branch on 2026-06-30 — the brief confirmed scope but the branch was never cut. The branch cut is the first action of every work session, not an afterthought.

Branches are cut from `main`. There is no `dev` branch: it was retired in September 2026 because it drifted silently behind `main`, and CI on every pull request replaced it.
