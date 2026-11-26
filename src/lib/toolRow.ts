/**
 * The look of a block's tool row (docs/decisions.md, "Where Controls Live"):
 * menus named for the job open from chips with a ▾, so they read apart from
 * the buttons pressed constantly (Boundary, Marker).
 */
export const MENU_TRIGGER =
  'flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[11px] text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent'
