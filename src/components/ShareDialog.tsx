/**
 * ShareDialog — make a link that opens this analysis in the reading view.
 *
 * Strata stores nothing on a server, so the analyst puts the .strata file
 * online first (their site, a GitHub repository or a Gist) and pastes its
 * address here; the link carries that address (lib/shareLink.ts). Lyrics are
 * someone else's text: readers see them only if they turn them on, and the
 * analyst can download a copy without them to share instead.
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { inputClass } from '@/components/Field'
import { downloadBlob, fileBaseName } from '@/lib/fileIO'
import { hasLyrics, shareUrl, withoutLyrics } from '@/lib/shareLink'
import { version as APP_VERSION } from '../../package.json'

export function ShareDialog() {
  const open = useUIStore((s) => s.shareOpen)
  const setOpen = useUIStore((s) => s.setShareOpen)
  const sharedFrom = useUIStore((s) => s.sharedFrom)
  const doc = useDocumentStore((s) => s.document)
  const [address, setAddress] = useState('')
  const [copied, setCopied] = useState(false)
  if (!doc) return null

  const fileUrl = address.trim() || sharedFrom || ''
  const valid = /^https?:\/\/\S+$/.test(fileUrl)
  const link = valid ? shareUrl(fileUrl, window.location.href) : ''
  const lyrics = hasLyrics(doc)

  function copy() {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function downloadWithoutLyrics() {
    const copyDoc = { ...withoutLyrics(doc!), strataVersion: APP_VERSION }
    downloadBlob(new Blob([JSON.stringify(copyDoc, null, 2)], { type: 'application/octet-stream' }), `${fileBaseName(doc!)}.strata`)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setCopied(false)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share as a link</DialogTitle>
          <DialogDescription>
            Put the saved .strata file online where browsers can read it, such as your own site, a GitHub repository or a
            Gist, then paste its address. The link opens it in the reading view.
          </DialogDescription>
        </DialogHeader>

        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          The file’s address
          <input
            className={inputClass}
            value={address}
            placeholder={sharedFrom ?? 'https://…/alive.strata'}
            onChange={(e) => setAddress(e.target.value)}
          />
        </label>

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          Link to share
          <div className="flex gap-2">
            <input className={`${inputClass} text-muted-foreground`} readOnly value={link} aria-label="Link to share" placeholder="Paste the file’s address above" />
            <button
              type="button"
              disabled={!valid}
              onClick={copy}
              className="shrink-0 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {lyrics && (
          <div className="rounded-md border border-border bg-muted/50 p-3 text-xs leading-relaxed text-foreground">
            This analysis includes lyrics, which are someone else’s text. Readers of a shared link see them only if they
            turn them on. To leave them out of the file entirely, share a copy without them.
            <button
              type="button"
              onClick={downloadWithoutLyrics}
              className="mt-2 block rounded border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
            >
              Download a copy without lyrics
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
