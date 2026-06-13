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

const AUTO_SAVE_MS = 30_000

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
      const { doc, handle } = await _openFile()
      setFileHandle(handle)
      loadDocument(doc)
      useDocumentStore.temporal.getState().clear()
      // loadDocument sets savedSnapshot, so no explicit markSaved needed.
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.error('Failed to open file:', err)
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
      console.error('Failed to save file:', err)
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
      console.error('Failed to save file:', err)
    }
  }, [markSaved])

  const restoreRecovery = useCallback(() => {
    if (!pendingRecovery) return
    loadDocument(pendingRecovery.doc)
    useDocumentStore.temporal.getState().clear()
    clearRecovery()
    setPendingRecovery(null)
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
