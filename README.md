# Strata

Strata is a free, open-source web app for marking points and spans of time in a recording and saving them as structured, queryable data. Music theorists, musicologists, teachers, and students use it to build analyses they can share, cite, and compare across a corpus.

When you keep your analyses as data, you can ask questions across many recordings at once. For example: across a hundred recordings, how long does the opening section last, and what kind of section usually follows it?

**Open it at [strata.devinchaloux.com](https://strata.devinchaloux.com).** Strata runs in your browser on a laptop or desktop. You don't need to install anything and do not need an account.

> **Strata is in beta.** You can use it from start to finish, but the file format may still change. When you open a file made by an older version, Strata upgrades it. Save often.

## Points, spans, and widgets

You build an analysis in Strata from **points** (a cadence at 1:04, a key change, a new instrument entering) and **spans** (a verse from 0:30 to 1:00, a four-bar phrase, a development section). You see and work with them through **widgets**. You add the widgets each analysis needs.

Strata has two widgets today. Start with the **form diagram**: you draw spans as brackets and arrange them in layers. You can give each layer its own focus, its own framework, or its own vocabulary. You keep all of them in the same analysis. You don't have to fit every observation into one hierarchy. If you hear a passage one way in one framework and another way in a second, you can record both readings side by side.

With **commentary**, you write about a passage. Strata shows your writing while that passage plays.

You'll be able to add more widgets later. An energy contour, for example, will let you trace how intensity rises and falls across the same stretch of music. You'll add it only to the analyses that need it. See the [Roadmap](docs/roadmap.md) for what's planned.

## What you can do with the data

Because each analysis is data, you can ask questions across many of them:

- You can call a section whatever you like ("Verse 1", "First verse") and give it a type from the vocabulary (`verse`). When you search for `verse`, you find both.
- You can measure where things happen as well as what they are, because Strata records every point and span in seconds from the start of the music.
- You can mark an expected event as absent, such as an evaded cadence. Then you can search for absences too.
- You can read a folder of `.strata` files with a short script or import them into a spreadsheet. In version 2, the Corpus Builder will let you gather and query analyses inside Strata.

## See one first

On Strata's first screen, under **Or explore an example**, open **Alive** by Krewella. Strata opens it in the reading view, the way your readers will see it. Click **Edit a copy** to make your own version.

## What you can do

- **Mark spans and points as it plays.** Press Space to play, B at each boundary you hear, and M at each moment you want to mark. Or set the tempo, let Strata lay out a span every four or eight bars, and then fix the exceptions.
- **Link the levels.** Group phrases into a section on the layer above, or copy a span to another layer. Once you've linked spans, you move their shared boundaries together in one go.
- **Name what each span is.** Give it a free-text label ("Verse 1") and a type from the vocabulary (verse, exposition, presentation).
- **Use the vocabulary of your field.** Choose from built-in libraries for general terms, pop and rock, song form, EDM, common practice, jazz, and form letters. Add packs for Caplin's formal functions, Sonata Theory, and more. Add your own terms and share them as packs.
- **Number the bars.** Tap along to the beat or type the tempo, then check it against a click track that plays over the recording. Stop the grid for a free passage and pick it up again after.
- **Write about the music.** Attach commentary to a span to read it while that passage plays. Link to any span or point by name.
- **Share and publish.** Share a link that opens your analysis in the reading view, embed it in a web page, or export the diagram as an SVG or PNG figure. Export the commentary as a web page or Markdown.

Press **?** in the app for a short guide and every keyboard shortcut.

## Your first analysis

For a step-by-step walkthrough, read [Getting started](docs/getting-started.md). In short:

1. Click **New analysis**, name the track, and link a YouTube video or an audio file on your computer.
2. Press Space to play and B at each boundary you hear.
3. Click a span. In the Inspector, the panel on the right, give it a label and a type.
4. Click **+** to add a layer for another level of form.
5. Save. In Chrome or Edge, click **Save As** to choose a file, then **Save** to write back to it. In other browsers, click **Download** to save a new copy each time.

## Your analysis is one file

You save each analysis as a single `.strata` file. It holds the link to the recording; every layer, span, and point; the beat grid; your commentary; and the vocabulary you used. Strata stores nothing on a server, so the file is yours.

To learn the format, read [The Strata file, explained](schema/strata-schema-reference.md). For its structure as JSON, read [How the JSON is structured](docs/json-structure.md).

## Status and plans

Strata is in beta. See the [Roadmap](docs/roadmap.md) for what comes next, including the energy contour and the Corpus Builder in version 2. The [FAQ](docs/faq.md) answers the questions analysts ask most.

Found a problem, or have an idea? Click **Report an issue** in the app, or open an issue on GitHub.

## For developers

Strata is a React, TypeScript, and Vite app. To run it locally, contribute a change, or embed Strata in a page, read [For developers](docs/developers.md).

## License

You can use the code under the [MIT License](LICENSE). You can use the example analyses in [`public/demos/`](public/demos/) under CC BY 4.0.
