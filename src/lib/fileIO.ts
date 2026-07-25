import type { StrataDocument } from '@/types/strata'

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
 * Parses a raw string as a StrataDocument.
 * Throws a descriptive Error on any failure — callers should surface this to the user.
 */
export function parseStrataFile(raw: string): StrataDocument {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('File is not valid JSON.')
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('File is not a valid .strata document.')
  }
  const doc = parsed as Record<string, unknown>
  if (
    typeof doc.strataVersion !== 'string' ||
    typeof doc.fileFormatVersion !== 'number' ||
    typeof doc.title !== 'string' ||
    !Array.isArray(doc.layers)
  ) {
    throw new Error(
      'File is missing required fields (strataVersion, fileFormatVersion, title, layers).'
    )
  }
  return parsed as StrataDocument
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serialize(doc: StrataDocument): string {
  return JSON.stringify(doc, null, 2)
}

function suggestedFilename(doc: StrataDocument): string {
  return `${doc.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.strata`
}

// ---------------------------------------------------------------------------
// Open
// ---------------------------------------------------------------------------

/**
 * Opens a .strata file.
 * Chrome/Edge: uses showOpenFilePicker and returns a live file handle for in-place save.
 * Safari/Firefox: falls back to a hidden <input type="file">; handle is null.
 */
export async function openFile(): Promise<{
  doc: StrataDocument
  handle: FileSystemFileHandle | null
}> {
  if (supportsFileSystemAccess()) {
    const [handle] = await window.showOpenFilePicker!({
      types: STRATA_FILE_TYPES,
      multiple: false,
    })
    const file = await handle.getFile()
    const raw = await file.text()
    return { doc: parseStrataFile(raw), handle }
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
        resolve({ doc: parseStrataFile(await file.text()), handle: null })
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
  const blob = new Blob([serialize(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = suggestedFilename(doc)
  a.click()
  URL.revokeObjectURL(url)
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
    strataVersion: '0.1.0',
    fileFormatVersion: 1,
    createdAt: iso,
    updatedAt: iso,
    title: 'Untitled Analysis',
    artist: [],
    duration: 0,
    source: { type: 'youtube', url: '', sourceOffset: 0 },
    vocabulary: { spanTypes: [], pointMarkerTypes: [], modes: [] },
    sharedTimePoints: [],
    layers: [],
    pointMarkers: [],
  }
}
