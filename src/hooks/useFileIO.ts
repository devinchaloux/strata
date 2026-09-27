import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore, selectIsDirty } from '@/store/documentStore'
import {
  openFile as _openFile,
  saveFileAs as _saveFileAs,
  writeToHandle,
  downloadFile,
  createEmptyDocument,
} from '@/lib/fileIO'
import { saveRecovery, loadRecovery, clearRecovery } from '@/lib/crashRecovery'
import type { RecoveryEntry } from '@/lib/crashRecovery'
import { readDocument, DocumentError, type LoadResult } from '@/lib/documentLoad'
import { useUIStore } from '@/store/uiStore'

const AUTO_SAVE_MS = 30_000

/** The analyst-facing text for an error, whatever threw it. */
function describe(err: unknown): string {
  if (err instanceof DocumentError) return err.message
  if (err instanceof Error && err.message) return err.message
  return 'Something went wrong. The browser gave no details.'
}

/** Load a read document and, if it came with notices, show them. */
function adopt(result: LoadResult, load: (doc: LoadResult['doc']) => void) {
  load(result.doc)
  useDocumentStore.temporal.getState().clear()
  if (result.notices.length > 0) {
    useUIStore.getState().showAppMessage('Opened with warnings', result.notices)
  }
}

export function useFileIO() {
  const { document: strataDoc, loadDocument, markSaved } = useDocumentStore()
  const isDirty = useDocumentStore(selectIsDirty)

  // Use state so the toolbar reactively reflects whether in-place save is available.
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)

  // Refs let the auto-save interval read current values without re-registering.
  const strataDocRef = useRef(strataDoc)
  strataDocRef.current = strataDoc
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  // Crash recovery: check on mount, expose pending entry for the UI to render.
  const [pendingRecovery, setPendingRecovery] = useState<RecoveryEntry | null>(null)
  useEffect(() => {
    const entry = loadRecovery()
    if (entry) setPendingRecovery(entry)
  }, [])

  // Auto-save to localStorage every 30 s when dirty.
  useEffect(() => {
    const id = setInterval(() => {
      if (strataDocRef.current && isDirtyRef.current) {
        saveRecovery(strataDocRef.current)
      }
    }, AUTO_SAVE_MS)
    return () => clearInterval(id)
  }, [])

  // Closing or reloading the tab with unsaved changes asks first. Browsers show
  // their own generic wording; the page can only ask for the prompt. Autosave
  // runs every 30 s, so without this up to 30 s of work vanished silently.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return
      e.preventDefault()
      e.returnValue = '' // still required by Chrome and Edge to show the prompt
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Window title dirty indicator: "• Title" when dirty, "Title" when clean.
  useEffect(() => {
    const name = strataDoc?.title ?? 'Strata'
    window.document.title = isDirty ? `• ${name}` : name
  }, [strataDoc?.title, isDirty])

  // ── Actions ────────────────────────────────────────────────────────────────

  const newFile = useCallback(() => {
    setFileHandle(null)
    const doc = createEmptyDocument()
    loadDocument(doc)
    useDocumentStore.temporal.getState().clear()
    // loadDocument already sets savedSnapshot = doc, so the new file is not dirty.
  }, [loadDocument])

  const openFile = useCallback(async () => {
    try {
      const { handle, ...result } = await _openFile()
      setFileHandle(handle)
      // loadDocument sets savedSnapshot, so no explicit markSaved needed.
      adopt(result, loadDocument)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      useUIStore.getState().showAppMessage("Couldn't open this file", [describe(err)])
    }
  }, [loadDocument])

  const saveFile = useCallback(async () => {
    if (!strataDocRef.current) return
    try {
      if (fileHandle) {
        await writeToHandle(fileHandle, strataDocRef.current)
      } else {
        downloadFile(strataDocRef.current)
      }
      markSaved()
      clearRecovery()
    } catch (err) {
      useUIStore.getState().showAppMessage("Couldn't save", [
        describe(err),
        'Your work is still open here. Try Save As to write it somewhere else.',
      ])
    }
  }, [fileHandle, markSaved])

  const saveFileAs = useCallback(async () => {
    if (!strataDocRef.current) return
    try {
      const handle = await _saveFileAs(strataDocRef.current)
      if (handle) setFileHandle(handle)
      markSaved()
      clearRecovery()
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      useUIStore.getState().showAppMessage("Couldn't save", [
        describe(err),
        'Your work is still open here.',
      ])
    }
  }, [markSaved])

  const restoreRecovery = useCallback(() => {
    if (!pendingRecovery) return
    setPendingRecovery(null)
    try {
      adopt(readDocument(pendingRecovery.doc), loadDocument)
      clearRecovery()
    } catch (err) {
      // Keep the entry in storage: a later build may be able to read it.
      useUIStore.getState().showAppMessage("Couldn't restore the recovered session", [describe(err)])
    }
  }, [pendingRecovery, loadDocument])

  const dismissRecovery = useCallback(() => {
    clearRecovery()
    setPendingRecovery(null)
  }, [])

  return {
    doc: strataDoc,
    isDirty,
    hasHandle: fileHandle !== null,
    newFile,
    openFile,
    saveFile,
    saveFileAs,
    pendingRecovery,
    restoreRecovery,
    dismissRecovery,
  }
}
