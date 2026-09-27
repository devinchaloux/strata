/**
 * Colour themes for the form diagram figure (./figure.tsx). Kept apart from the
 * components so the figure module exports components only.
 */

/** Every colour the figure uses that isn't the analyst's own span colour. */
export interface FigureTheme {
  ink: string
  inkSecondary: string
  inkFaint: string
  canvas: string
  marker: string
  markerFlagged: string
  ring: string
  caption: string
  captionSelected: string
}

/** In the app: CSS variables, so the figure follows the app's theme. */
export const EDITOR_THEME: FigureTheme = {
  ink: 'var(--ink-primary)',
  inkSecondary: '#475569',
  inkFaint: 'var(--ink-faint)',
  canvas: 'var(--canvas)',
  marker: 'hsl(var(--primary))',
  markerFlagged: 'hsl(var(--destructive))',
  ring: 'hsl(var(--ring))',
  caption: 'hsl(var(--muted-foreground))',
  captionSelected: 'hsl(var(--foreground))',
}

/** For export: literal colours, since a standalone SVG has no app stylesheet. */
export const PRINT_THEME: FigureTheme = {
  ink: '#334155',
  inkSecondary: '#475569',
  inkFaint: '#94a3b8',
  canvas: '#ffffff',
  marker: '#334155',
  markerFlagged: '#dc2626',
  ring: '#334155',
  caption: '#64748b',
  captionSelected: '#334155',
}

