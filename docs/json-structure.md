# How the JSON is structured

This page describes how a `.strata` file is structured, for developers and technically minded scholars. [The Strata file, explained](../schema/strata-schema-reference.md) says what each part *means* to an analyst. This page shows the shape of the data and the reasons behind it.

## In brief

Each analysis is one JSON document, checked against a JSON Schema. At the top, it holds metadata about the recording: the title, the artist, the YouTube link, and an offset that lines up the video's clock with the music. Then comes an array of **layers**. Every layer has the same envelope (id, name, colors, order) plus a `data` payload. The payload's shape depends on the layer's `type`. A form-diagram layer's data is a **flat list of spans**. Each span has a start and end time in seconds, a free-text label, and a `type` from a controlled vocabulary. Hierarchy doesn't come from nesting: a phrase points at its section with a `parentId`. Single moments, like cadences, live in a separate top-level `pointMarkers` array, because they belong to the recording rather than to one layer. Every format change bumps a version number. Strata migrates old files when it loads them.

In one line: **points and spans with vocabulary types, arranged in layers, cross-referenced by id instead of nested, in one self-contained file.**

## The shape

A `*` marks a required key. You can leave out every other key when it holds the default.

```text
StrataDocument
├── strataVersion*, fileFormatVersion*, createdAt*, updatedAt*
├── title*, artist*[], duration*, context, composer, work, derivativeOf
├── notes, project, analysisAuthor, homeKey {tonic, mode}
├── bpm, timeSignature {numerator, denominator}   ← starting values only
├── beatGrid[]            GridSegment {id, start, end?, bpm, beatsPerBar, beatUnit?, firstBar?}
├── source*               {type: youtube|local, url | filename, sourceOffset}
├── vocabulary*           {spanTypes[], pointMarkerTypes[], modes[]}  of VocabTerm {id, label, broader[]…}
├── layers*[]             Layer = envelope + typed payload
│   ├── id, type, label, visibility, locked, displayOrder, color defaults, display settings
│   └── data
│       ├── type "form-diagram"     → { spans[] }
│       │   └── Span {id, startTime, endTime, label, slug, type,
│       │            annotation, notes, lyrics, keyArea,
│       │            start/endBoundaryType, parentId, mergedFrom,
│       │            drawing: startCap, endCap, lineStyle, fillColor, …}
│       └── type "written-analysis" → { blocks[] }
│           └── AnalysisBlock {id, anchor: {spanId} | {start, end}, text}
├── pointMarkers*[]       PointMarker {id, timestamp, label, slug, type, harmonicContext,
│                                      absent, flagged, notes, kind}
└── showCadenceCaptions
```

Three arrays hold the analysis: `layers`, the spans inside them, and `pointMarkers`. The rest of the document gives context.

## A complete small file

This is a real file that passes the schema: one short stretch of Krewella's "Alive" with two levels of form, a comment, and a cadence. Notice how the two phrases point at their section by `parentId`. The comment points at the section by `spanId` and at the cadence by its slug.

```json
{
  "strataVersion": "0.1.0",
  "fileFormatVersion": 2,
  "createdAt": "2026-11-05T10:00:00.000Z",
  "updatedAt": "2026-11-05T10:42:00.000Z",
  "title": "Alive",
  "artist": ["Krewella"],
  "duration": 290.4,
  "bpm": 128,
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "beatGrid": [
    { "id": "g1", "start": 0.42, "bpm": 128, "beatsPerBar": 4 }
  ],
  "homeKey": { "tonic": "A", "mode": "minor" },
  "source": { "type": "youtube", "url": "https://www.youtube.com/watch?v=...", "sourceOffset": 0 },
  "vocabulary": {
    "spanTypes": [
      { "id": "beat-match-intro", "label": "Beat-match intro", "kind": "span", "broader": ["intro"] }
    ],
    "pointMarkerTypes": [],
    "modes": []
  },
  "layers": [
    {
      "id": "5c1f6a2e-0b7d-4c41-9e1a-2f4b8d3c6a10",
      "type": "form-diagram",
      "label": "Sections",
      "visibility": true,
      "locked": false,
      "fillColorDefault": "#ffffff",
      "strokeColorDefault": "#475569",
      "displayOrder": 1,
      "data": {
        "spans": [
          {
            "id": "a3e9c0d2-7f41-4b8a-9d26-1c5e7f9a0b31",
            "startTime": 30.42,
            "endTime": 60.42,
            "label": "Verse 1",
            "slug": "verse-1",
            "type": "verse"
          }
        ]
      }
    },
    {
      "id": "8d2b4e6f-1a3c-4e5b-8f7a-9c0d1e2f3a40",
      "type": "form-diagram",
      "label": "Phrases",
      "visibility": true,
      "locked": false,
      "fillColorDefault": "#ffffff",
      "strokeColorDefault": "#475569",
      "displayOrder": 0,
      "data": {
        "spans": [
          { "id": "b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d50", "startTime": 30.42, "endTime": 45.42, "type": "presentation", "parentId": "a3e9c0d2-7f41-4b8a-9d26-1c5e7f9a0b31" },
          { "id": "c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e60", "startTime": 45.42, "endTime": 60.42, "type": "continuation", "endBoundaryType": "elided", "parentId": "a3e9c0d2-7f41-4b8a-9d26-1c5e7f9a0b31" }
        ]
      }
    },
    {
      "id": "e4f5a6b7-c8d9-4e0f-8a1b-2c3d4e5f6a70",
      "type": "written-analysis",
      "label": "Commentary",
      "visibility": true,
      "locked": false,
      "fillColorDefault": "#ffffff",
      "strokeColorDefault": "#475569",
      "displayOrder": 2,
      "data": {
        "blocks": [
          {
            "id": "f5a6b7c8-d9e0-4f1a-9b2c-3d4e5f6a7b80",
            "anchor": { "spanId": "a3e9c0d2-7f41-4b8a-9d26-1c5e7f9a0b31" },
            "text": "The verse closes on a half cadence, [[hc]], elided into what follows."
          }
        ]
      }
    }
  ],
  "pointMarkers": [
    {
      "id": "0a1b2c3d-4e5f-4a6b-8c7d-8e9f0a1b2c90",
      "timestamp": 60.42,
      "label": "HC",
      "slug": "hc",
      "type": "half-cadence",
      "harmonicContext": "V",
      "kind": "cadence"
    }
  ]
}
```

## The design choices and why

These are the questions a developer usually asks next, with the reasoning behind each answer.

| Choice | Why |
| --- | --- |
| **Spans are a flat list per layer, linked by `parentId`, not nested** | Analysts often hold several frameworks at once. A strict tree would force one reading. With references, a phrase can belong to a section on another layer without either layer owning the other. A corpus query can scan every span without walking a tree. Within one layer, spans never overlap. The app enforces that, because JSON Schema can't express it. When you open a file that breaks it, the app warns you. |
| **Every layer is an envelope plus a typed `data` payload** | The envelope (id, name, visibility, order, colors) is the same for every layer, so the app can list, hide, and reorder any layer. Only `data` changes with `type`. When the app meets a layer type it doesn't know, it keeps the layer byte for byte and saves it back unchanged. Newer files survive older apps. |
| **A span has three identifiers plus a label** | `id` is a UUID that never changes. The app uses it for every internal reference. `slug` is a readable name (`verse-1`) for links in commentary and embeds. It is unique across the file and stays fixed once you save, so renaming a span doesn't break links. `type` is a vocabulary id for queries. `label` is free text for people. |
| **Types are vocabulary ids, not strings to match** | Built-in terms ship with the app. Files refer to them by id. Custom terms live in the file, so it opens anywhere. `broader` links a specific term to a general one, as in SKOS. A query for transitions then finds Caplin's too. |
| **Times are float seconds in recording time** | Every time counts from the start of the music, not the video. `source.sourceOffset` maps between the two. To swap a dead YouTube link for a new upload, you change one field. |
| **The beat grid is a list of segments** | A segment holds a downbeat, a tempo, and a meter. The app derives beats and bars. A tempo correction is one edit. A gap between segments means "no grid". The file stays small. `bpm` and `timeSignature` at the top are only starting values for a new segment. |
| **Analytical and visual fields are separate** | `startBoundaryType` says what the music does. `startCap`, `lineStyle`, and the colors say how you draw it. A query never has to guess whether a dashed line means something. |
| **Point markers are top-level** | A cadence happens once in the recording. No layer owns it. Every layer sees it. |
| **Commentary points at spans by id, or at a time range** | When you delete a span, its commentary becomes a time-range block. When you merge spans, their commentary moves to the merged span. Nobody loses writing. |
| **Defaults are left out** | No `startBoundaryType` means a clean cut. No `flagged` means false. A file records only what differs from the ordinary case. |
| **Versioned, with migrations** | `fileFormatVersion` is an integer. Adding an optional field doesn't change it. A change that older files need upgrading for bumps it and adds a migration, a pure JSON-to-JSON function. The app upgrades files step by step when it loads them. When it opens a file from a newer version, it warns you and never downgrades the file. |
| **Self-contained, no media** | The file links to the recording but never contains it. It needs no server or account. Anything that reads JSON can read it. |

## Reading files from code

You don't need a library: a folder of `.strata` files is a folder of JSON. This script counts every section type across the analyses in a folder called `analyses`. It uses only Python's standard library:

```python
import json
from collections import Counter
from pathlib import Path

counts = Counter()
for path in Path("analyses").glob("*.strata"):
    doc = json.loads(path.read_text())
    for layer in doc["layers"]:
        if layer["type"] != "form-diagram":
            continue
        for span in layer["data"]["spans"]:
            counts[span.get("type") or "(untyped)"] += 1

for span_type, n in counts.most_common():
    print(f"{n:4}  {span_type}")
```

On the bundled "Alive" demo and the example above, the script prints 16 d-sections; 3 each of verse, chorus, drop, and rotation; and a few more. For questions about timing, such as how far into a track the first drop lands, read `startTime` the same way. For questions across layers, follow `parentId`.

## Where the spec lives

| File | What it is |
| --- | --- |
| [`schema/strata.schema.json`](../schema/strata.schema.json) | The published contract: a JSON Schema (draft-07) that rejects unknown keys (`additionalProperties: false`), with a description on every field |
| [`src/types/strata.ts`](../src/types/strata.ts) | The TypeScript types the app's code uses, which mirror the schema |
| [`src/lib/documentLoad.ts`](../src/lib/documentLoad.ts) | The single way in. The app migrates, checks, and normalizes every file here, whether you opened it, followed a share link to it, or recovered it |
| [`src/lib/migrations.ts`](../src/lib/migrations.ts) | The version policy and each step's migration |
| [`src/test/schemaConformance.test.ts`](../src/test/schemaConformance.test.ts) | A test that validates the bundled files and what the app itself writes after real edits, so the app can't drift from the schema |
| [`widgets/_contract.md`](../widgets/_contract.md) | What a new kind of layer must provide, for anyone adding one |

A format change updates the schema, the types, and the plain-language guide in the same commit. [`docs/decisions.md`](decisions.md) records the reason for it.
