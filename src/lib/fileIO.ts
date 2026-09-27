import type { StrataDocument } from '@/types/strata'
import { readDocument, DocumentError, type LoadResult } from '@/lib/documentLoad'
import { FILE_FORMAT_VERSION } from '@/lib/migrations'
import { version as APP_VERSION } from '../../package.json'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STRATA_FILE_TYPES = [
  { description: 'Strata Analysis File', accept: { 'application/json': ['.strata'] } },
]

// ---------------------------------------------------------------------------
// Feature detection
// ---------------------------------------------------------------------------

export function supportsFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

// ---------------------------------------------------------------------------
// Parsing & validation
// ---------------------------------------------------------------------------

/**
 * Parses and reads a .strata file's text. Throws a DocumentError (with a
 * message written for the analyst) when the file can't be opened; returns any
 * non-blocking notices alongside the document. See lib/documentLoad.ts.
 */
export function readStrataFile(raw: string): LoadResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new DocumentError('This file is not valid JSON, so it is not a readable Strata analysis.')
  }
  return readDocument(parsed)
}

/** readStrataFile without the notices — for callers that only need the document. */
export function parseStrataFile(raw: string): StrataDocument {
  return readStrataFile(raw).doc
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

// Every save records which build of Strata wrote the file, so a problem found
// in a file later can be traced to the version that produced it.
function serialize(doc: StrataDocument): string {
  return JSON.stringify({ ...doc, strataVersion: APP_VERSION }, null, 2)
}

function suggestedFilename(doc: StrataDocument): string {
  return `${fileBaseName(doc)}.strata`
}

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/**
 * Opens a .strata file.
 * Chrome/Edge: uses showOpenFilePicker and returns a live file handle for in-place save.
 * Safari/Firefox: falls back to a hidden <input type="file">; handle is null.
 */
export async function openFile(): Promise<LoadResult & { handle: FileSystemFileHandle | null }> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker!({
      types: STRATA_FILE_TYPES,
      multiple: false,
    })
    const file = await handle.getFile()
    const raw = await file.text()
    return { ...readStrataFile(raw), handle }
  }

  return new Promise((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.strata,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) {
        reject(new Error('No file selected.'))
        return
      }
      try {
        resolve({ ...readStrataFile(await file.text()), handle: null })
      } catch (err) {
        reject(err)
      }
    }
    // oncancel fires in modern browsers when the picker is dismissed
    input.addEventListener('cancel', () => {
      const err = new DOMException('The user aborted a request.', 'AbortError')
      reject(err)
    })
    input.click()
  })
}

// ---------------------------------------------------------------------------
// Save
// ---------------------------------------------------------------------------

/**
 * Writes a document to an existing file handle (in-place save, Chrome/Edge).
 */
export async function writeToHandle(
  handle: FileSystemFileHandle,
  doc: StrataDocument
): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(serialize(doc))
  await writable.close()
}

/**
 * Downloads a document as a .strata file (fallback save for Safari/Firefox,
 * and the primary path when no file handle exists yet).
 */
export function downloadFile(doc: StrataDocument): void {
  downloadBlob(new Blob([serialize(doc)], { type: 'application/json' }), suggestedFilename(doc))
}

/** Hand the browser a file to save (the download fallback for every export). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  // Revoked on the next tick: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** A filesystem-safe base name from the document title. */
export function fileBaseName(doc: StrataDocument): string {
  return doc.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'strata'
}

/**
 * Shows the Save As picker (Chrome/Edge) or triggers a download (fallback).
 * Returns the chosen file handle, or null in fallback mode.
 */
export async function saveFileAs(doc: StrataDocument): Promise<FileSystemFileHandle | null> {
  if (supportsFileSystemAccess()) {
    const handle = await window.showSaveFilePicker!({
      suggestedName: suggestedFilename(doc),
      types: STRATA_FILE_TYPES,
    })
    await writeToHandle(handle, doc)
    return handle
  }
  downloadFile(doc)
  return null
}

// ---------------------------------------------------------------------------
// Audio file picking (source linking)
// ---------------------------------------------------------------------------

/**
 * Picks a local audio file for a source of type "local". Plain <input> picker
 * everywhere (no File System Access API) — the file is read-only media, so a
 * writable handle buys nothing. Resolves null on cancel.
 */
export function pickAudioFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'audio/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
}

// ---------------------------------------------------------------------------
// New document
// ---------------------------------------------------------------------------

/**
 * Creates a minimal empty document for "New file".
 * savedSnapshot is set equal to this document on load, so it starts not-dirty.
 */
export function createEmptyDocument(): StrataDocument {
  const iso = new Date().toISOString()
  return {
    strataVersion: APP_VERSION,
    fileFormatVersion: FILE_FORMAT_VERSION,
    createdAt: iso,
    updatedAt: iso,
    title: 'Untitled Analysis',
    artist: [],
    duration: 0,
    source: { type: 'youtube', url: '', sourceOffset: 0 },
    vocabulary: { spanTypes: [], pointMarkerTypes: [], modes: [] },
    sharedTimePoints: [],
    // One layer to start in, so Space marks a boundary straight away; a new
    // analysis with no layers had nowhere for the first boundary to go.
    layers: [
      {
        id: crypto.randomUUID(),
        type: 'form-diagram',
        label: 'Form',
        visibility: true,
        locked: false,
        fillColorDefault: '#ffffff',
        strokeColorDefault: '#475569',
        displayOrder: 0,
        data: { hierarchicalEnforcement: false, spans: [] },
      },
    ],
    pointMarkers: [],
  }
}
