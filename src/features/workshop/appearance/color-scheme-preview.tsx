import { useMemo, type CSSProperties } from "react"

import { paletteTokens } from "@/features/workshop/appearance/color-schemes"
import type { ColorSchemeMode, ColorSchemePalette } from "@/features/workshop/workshop-types"
import { cn } from "@/lib/utils"

/** A miniature workshop painted with the same token derivation as the real shell. */
export function ColorSchemePreview({
  className,
  mode,
  palette,
}: {
  className?: string
  mode: ColorSchemeMode
  palette: ColorSchemePalette
}) {
  const style = useMemo(() => paletteTokens(palette, mode) as CSSProperties, [mode, palette])

  return (
    <div aria-hidden="true" className={cn("workshop-scheme-preview", className)} style={style}>
      <span className="workshop-scheme-preview-sidebar">
        <b />
        <i className="active" />
        <i />
        <i />
      </span>
      <span className="workshop-scheme-preview-main">
        <span className="workshop-scheme-preview-topbar"><i /><em /></span>
        <span className="workshop-scheme-preview-body">
          <span className="workshop-scheme-preview-card"><i /><i /><em /></span>
          <span className="workshop-scheme-preview-card"><i /><i /><i /></span>
        </span>
      </span>
    </div>
  )
}
