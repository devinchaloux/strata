# CLAUDE.md

Instructions for Claude Code in this repository. They apply to anyone working
on Strata with Claude; the maintainer's own session instructions load from a
private file through the import at the end.

---

## What this project is

**Strata** is a web-based, open-source music analysis tool built around a unified
analysis document. Analysts link a YouTube video, then build layered analytical
views — called widgets — synchronized to the same playback timeline and saved
into a single portable `.strata` file (JSON).

The core design bets:
- **Analysis is data.** Formal annotations are structured, queryable records —
  not just display artifacts.
- **Overlapping frameworks are valid.** Several analytical frameworks can apply
  to the same passage at once, each on its own layer.
- **The file format is the invention.** The editor UI is downstream of getting
  the schema right.

Read `docs/decisions.md` before changing anything architectural: it is binding,
and its "Find a decision" index leads to the area you're touching.
`docs/vision.md` is the original statement of intent, written before the code.
The schema lives in `schema/` (`strata.schema.json`, with a plain-language
guide in `schema/strata-schema-reference.md`); widget specs live in `widgets/`.

**Analytical concepts are the maintainer's call.** What a field means, which
distinctions the format makes, and how notation is written are music-theory
decisions. Raise them; don't settle them in code.

---

## Architecture in brief

- React 18 + Vite + TypeScript. Zustand for state, with zundo for undo/redo.
  Tailwind and Radix (shadcn/ui) for UI. Vitest for tests.
- `src/types/strata.ts` mirrors the JSON Schema. A format change updates both,
  plus the schema reference.
- `src/main.tsx` starts the editor (`src/App.tsx`) or, for an address with
  `?embed` and a file to show, the read-only embed (`src/embed/EmbedApp.tsx`, contract in
  `src/lib/embed.ts`).
- Every document enters the app through `src/lib/documentLoad.ts`, which
  validates and normalizes it.
- Document edits go through actions in `src/store/documentStore.ts`. The store
  enforces the format's invariants, for example that spans within one layer
  never overlap.
- Pure logic lives in `src/lib/` and is unit-tested in `src/test/`.

---

## Working in this repo

**This repo is public, and a push is a publication.** Anything pushed to any
branch is readable at once and can't be taken back: a deleted branch stays
reachable through pull-request refs, forks and clones.

1. **Work on a branch and open a pull request into `main`.** Never push to
   `main`.
2. **Run the publish check before every push.** `npm run publish-check` inspects
   the commits about to be pushed. A `PreToolUse` hook in `.claude/settings.json`
   runs it automatically before `git push`. When it flags something, stop and ask
   rather than working around it. It flags:
   - **new files outside the source tree:** anything not under `src/`, `schema/`,
     `docs/`, `widgets/`, `public/`, `.github/`, `.claude/`, `scripts/` or the
     root config files;
   - **content files:** added or changed `.strata` files, images, PDFs, audio or
     data files. Fixtures and sample analyses need a clear origin and licence
     before they're published, and a `lyrics` field holds someone else's
     copyrighted text;
   - **secrets and personal data:** email addresses, and anything shaped like a
     key or token.
3. **Ask before adding a dependency.** A dependency is a decision.
4. **If you didn't create a file and its origin and licence aren't clear, don't
   commit it.**

### Checks

CI (`.github/workflows/ci.yml`) runs lint, a guard against `TEMPORARY` markers,
the test suite and a production build (`tsc && vite build`) on every push and
pull request. Run the same locally before pushing:

```bash
npm run lint && npm run test:run && npm run build
```

A comment marked `TEMPORARY` is a merge blocker; CI fails on one.

### Commit messages

Conventional Commits: `<type>(<scope>): <summary>`, then an optional body saying
why. Types: `feat`, `fix`, `refactor`, `docs`, `chore`. Scope is the area
(`schema`, `widgets`, `docs` …). Write them for a stranger reading the history.

---

## Docs are part of the change

A doc that describes something the code no longer does is worse than no doc. Docs
land in the same commit as the change that invalidates them:

- a format change updates `schema/strata.schema.json`, `src/types/strata.ts` and
  `schema/strata-schema-reference.md` together;
- every design decision gets an entry in `docs/decisions.md` with its reason;
- a behavior change updates the `widgets/` spec it touches.

Before committing, grep for what the change invalidates:

```bash
grep -rn "<the identifier>" docs/ schema/ widgets/ CLAUDE.md --include="*.md"
```

A historical record stays; a live instruction that is now wrong gets rewritten.
Older docs mention a `dev` branch; it was retired in September 2026.

---

## Maintainer instructions

These load from the maintainer's private notes, checked out beside this repo.
In a cloud environment that holds only this repo the import below loads empty;
the maintainer's `/brief` attaches the notes and reads it.

@../research/strata/maintainer.md
