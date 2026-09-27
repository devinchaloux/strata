/**
 * Rendered inside every modal's content, which Radix mounts only while the
 * modal is open (or animating closed). Counting mounts here means any dialog
 * built on DialogContent or AlertDialogContent covers the YouTube player
 * without having to be listed anywhere; see PlayerDock's videoPanel curtain.
 */
import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'

export function CountsAsModal() {
  useEffect(() => {
    const { modalOpened, modalClosed } = useUIStore.getState()
    modalOpened()
    return modalClosed
  }, [])
  return null
}
