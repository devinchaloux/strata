# For developers

This page shows you how to run Strata, how to get a change in, and how to open Strata from another page or tool.

## Run it locally

Strata is a React, TypeScript, and Vite app. You need Node 24, the version CI uses.

```bash
npm ci           # install exactly what package-lock.json pins
npm run dev      # start the dev server at http://localhost:5173
npm run lint     # ESLint
npm run test:run # the Vitest suite, once
npm run build    # typecheck + production build
```

**Tech stack:** React 18 · Vite · TypeScript · Zustand + zundo (undo/redo) · Tailwind CSS · Radix · react-markdown · lucide-react · dnd-kit · Vitest · Ajv (tests only) · File System Access API.

## How changes get in

- **Work on a branch and open a pull request into `main`.** Never push to `main` directly.
- **Run `npm run publish-check` before every push.** The repository is public, so every push is a publication. The check stops new content files (analyses, images, audio), secrets, and personal data before you publish them by accident.
- **Expect CI to run lint, the test suite, and a production build** on every push and pull request. CI fails on any comment marked `TEMPORARY`.
- **Ask before you add a dependency.** Every dependency is a decision.
- **Update the docs in the same change.** When you change the format, update the JSON Schema, the TypeScript types, and the plain-language guide together. Record every design decision in `docs/decisions.md` with its reason.
- **Write commit messages as Conventional Commits:** `feat(schema): …`, `fix(editor): …`.

[`CLAUDE.md`](../CLAUDE.md) sets out the same workflow. It doubles as the instructions for Claude Code.

## Opening Strata from another page or tool

| To | Address | Notes |
| --- | --- | --- |
| Embed an analysis in a web page | `https://strata.devinchaloux.com/?embed&src=<file address>` | The embed is read-only and sits in an iframe. Add `&focus=<slug>` or `&focus=m:ss-m:ss` to open on one span or stretch. Add `&layers=<name>,<name>` to show only those layers, or `&bare` to drop the title line. Your page can also drive the embed with window messages. |
| Start a new analysis with its details filled in | `https://strata.devinchaloux.com/?new&title=…&artist=…&video=…&bpm=…` | You can also pass `&key=`, `&mode=`, and `&author=`. Every field is optional. The analyst checks the details in the New analysis dialog. Strata saves nothing until they save. |
| Share a link that opens a file in the reading view | Click **Share…** in the app | Put the file online first (Dropbox, OneDrive, GitHub, or any web address). |

For the full details, see "Embedding an Analysis" and "Starting an Analysis from a Link" in [`docs/decisions.md`](decisions.md).

## Where things are documented

- [`schema/`](../schema): the `.strata` JSON Schema, [the plain-language guide to the file](../schema/strata-schema-reference.md), and an example file.
- [How the JSON is structured](json-structure.md): the shape of the data and the reasons behind it.
- [`widgets/`](../widgets): the contract every kind of layer follows, and each widget's spec.
- [`docs/decisions.md`](decisions.md): every design decision and its reason. It is binding: if another doc disagrees with it, follow the decisions log.
- [`docs/vision.md`](vision.md): the original statement of intent, written before the code.
