/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** A browser Google API key, restricted to Strata's sites: opens Google Drive share links (lib/shareLink.ts). */
  readonly VITE_GOOGLE_API_KEY?: string
}
