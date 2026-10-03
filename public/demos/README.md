# Example analyses

The `.strata` files in this folder are the example analyses Strata opens from
its first screen. The app serves them at `/demos/<file>`, so each can also be
linked to directly, for example:

```
https://strata.devinchaloux.com/?src=https://strata.devinchaloux.com/demos/alive.strata
```

or embedded in a web page, focused on one span by its slug:

```
https://strata.devinchaloux.com/?embed&src=https://strata.devinchaloux.com/demos/alive.strata&focus=drop
```

The files keep their slugs (`drop`, `chorus-2` …) saved, because links and
embeds point at them: a slug that changed would break them. Embedding is
described in `docs/decisions.md`, "Embedding an Analysis".

## Licence

These analyses are © 2026 Devin Chaloux and licensed under
[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
You may share and adapt them, including commercially, as long as you credit the
author and say whether you changed them.

This licence covers the analyses only. The rest of the repository, the app's
code, is MIT (see `LICENSE` at the root). The music they analyse belongs to its
rights holders: a file links to a published recording and contains none of it.

## Adding one

1. Open the analysis in Strata and save it once, so its slugs are written into
   the file (Strata makes them from the labels when it opens a file without
   them).
2. Put the file here and add a line to `EXAMPLES` in `src/lib/examples.ts`. A
   test checks that every listed example exists and opens cleanly.
