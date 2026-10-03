/**
 * ShareDialog — make a link that opens this analysis in the reading view.
 *
 * Strata stores nothing on a server, so the analyst puts the .strata file
 * online first (their site, GitHub, Dropbox or OneDrive) and pastes its address or share link here; the link carries that
 * address (lib/shareLink.ts). Opened from the toolbar or the reading view.
 */
import { useState } from 'react'
import { useDocumentStore } from '@/store/documentStore'
import { useUIStore } from '@/store/uiStore'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { inputClass } from '@/components/Field'
import { fileHost, hostSupported, shareUrl, type FileHost } from '@/lib/shareLink'

// What the dialog says about a recognised share link, under the address.
const HOST_NOTE: Record<FileHost, string> = {
  github: 'GitHub: paste the file’s page link.',
  dropbox: 'Dropbox: works with a share link.',
  onedrive: 'OneDrive: share it with “Anyone with the link”. Work and school accounts may not allow it.',
  gdrive: '',
  web: '',
}

export function ShareDialog() {
  const open = useUIStore((s) => s.shareOpen)
  const setOpen = useUIStore((s) => s.setShareOpen)
  const sharedFrom = useUIStore((s) => s.sharedFrom)
  const doc = useDocumentStore((s) => s.document)
  const [address, setAddress] = useState('')
  const [copied, setCopied] = useState(false)
  if (!doc) return null

  const fileUrl = address.trim() || sharedFrom || ''
  const host = fileHost(fileUrl)
  // A link Strata can't open (Google Drive) isn't offered.
  const valid = /^https?:\/\/\S+$/.test(fileUrl) && hostSupported(host)
  const link = valid ? shareUrl(fileUrl, window.location.href) : ''
  const note = hostSupported(host)
    ? HOST_NOTE[host]
    : 'Google Drive doesn’t let other sites read its files, so Strata can’t open Drive links. Dropbox, OneDrive and GitHub work.'

  function copy() {
    navigator.clipboard?.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
            Put the .strata file online (Dropbox, OneDrive, GitHub or your own site) and paste its share link here. The link below opens it in Strata’s reading view.
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
          {note && <span className={hostSupported(host) ? '' : 'text-destructive'}>{note}</span>}
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

      </DialogContent>
    </Dialog>
  )
}
