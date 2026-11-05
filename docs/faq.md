# FAQ

Short answers to the questions music theorists are most likely to ask when they first see Strata.

## Using it

**Is it free? Do I need an account?**

Yes, it's free and open source under the MIT License. You don't need an account. Strata has no server: your analysis is a file on your own computer.

**What do I need?**

You need a browser on a laptop or desktop, plus a YouTube link or an audio file. In Chrome and Edge, you can save back to the same file. In other browsers, you download a new copy each time you save. Strata doesn't support phones or tablets yet.

**Does Strata find the sections for me?**

No. You mark what you hear. Strata doesn't analyze the audio. YouTube doesn't give it access to the audio anyway. Strata speeds up the mechanics instead: you tap boundaries while the music plays, lay out regular phrases from the tempo, and match a bar grid to the track with a click track.

**Can I use a recording that isn't on YouTube?**

Yes, you can use an audio file from your computer. Strata never uploads it. Anyone who opens your analysis needs the same audio file.

**Is it only for form?**

No. You build every analysis from points and spans of time, and you see them through widgets. The form diagram is the first widget and the best place to start. Commentary is the second. More widgets, such as an energy contour, will let you look at the same points and spans in other ways.

**Is it only for popular music?**

No. EDM was the first test case, but the vocabulary also covers common practice, Caplin's formal functions, Sonata Theory, jazz, and song form. You can stop the beat grid for rubato or unmetered passages. For a live performance, you can record the composer and the work.

## Analysis

**What makes Strata different?**

You keep every analysis as structured data. Each point and span has an exact time and a type from a shared vocabulary. Once you have many analyses in that form, you can ask questions across a whole corpus, such as how long the opening section of a recording usually lasts.

**Can I use more than one framework at once? What about elisions?**

Yes. You can give each layer its own focus, framework, or vocabulary. You keep them all in the same analysis, so you don't have to fit everything into one hierarchy. You can also mark a single boundary as elided, so the end of one section is the start of the next.

**Can I use my own terminology?**

Yes. Add your own types alongside the built-in ones. Make form letters (A, A′, B) as you go. Share a set of terms with others as a vocabulary pack. You can point a term to a broader one, so a search for transitions still finds a Caplin transition.

**What is the difference between a label and a type?**

The label is your own name for a section ("THE DROP"). The type is the shared category it belongs to (`drop`). You can write anything in a label. You use types to compare analyses.

**Can I show hierarchy, such as phrases within sections?**

Yes. Put each level on its own layer. Then group phrases into a section, or copy a span between layers. As you edit, Strata keeps the shared boundaries of linked spans together. It records the link but never forces strict nesting, because nesting is a theoretical choice for you to make.

**Can I record that an expected event doesn't happen?**

Yes. You can mark a point marker as absent, for an evaded cadence or a missing medial caesura. Strata saves the absence as data, so you can search for it.

**Are there bar numbers or a score?**

You get bar numbers from the beat grid. There is no score view: Strata works with recordings and clock time. Linking to an encoded score might come later. It isn't planned yet.

## Sharing and research

**How do I share or publish an analysis?**

Put the `.strata` file online (Dropbox, OneDrive, GitHub, or your own site). Then use **Share…** for a link that opens it in Strata's reading view. You can also embed it in a web page, focused on one section. For a paper or slides, export the diagram as an SVG or PNG figure.

**Can I use it for corpus studies?**

Yes. You keep every analysis as structured data with shared types. You can read a folder of `.strata` files with a short script or import them into a spreadsheet. The Corpus Builder, planned for version 2, will let you gather and query analyses inside Strata. [How the JSON is structured](json-structure.md) shows a short script that reads a folder of analyses.

**Can I use it in teaching?**

Yes. Show an analysis in the reading view with editing off, or send a link that opens it in one click. Students can make their own analyses and hand in the file.

**Can several people work on one analysis?**

Not at the same time. Send the file back and forth, or give each analyst their own layer.

**What about lyrics and copyright?**

Strata saves the lyrics you type in your file. Strata hosts nothing, so when you publish a file, you publish it under the same rules as quoting lyrics in a paper.

**Will my analyses keep working?**

Strata is in beta, so the format may change. Each file records its format version. When you open an older file, Strata upgrades it.

**How do I report a problem or suggest something?**

Click **Report an issue** in the app, or open an issue on GitHub.
