import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { EmbedApp } from '@/embed/EmbedApp'
import { parseEmbedParams } from '@/lib/embed'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// An embed (another page's iframe) gets the read-only player, not the editor.
const embed = parseEmbedParams(window.location.href)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TooltipProvider delayDuration={300}>
      <ErrorBoundary>
        {embed ? <EmbedApp params={embed} /> : <App />}
      </ErrorBoundary>
    </TooltipProvider>
  </StrictMode>
)
