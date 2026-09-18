import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"

import { useAppSelector } from "@/app/hooks"
import {
  buildColorSchemeCss,
  colorSchemeAttribute,
  colorSchemeStyleId,
  findColorScheme,
} from "@/features/workshop/appearance/color-schemes"
import type { ColorScheme } from "@/features/workshop/workshop-types"
import { useGetOrganizationAppearanceQuery } from "@/services/api"

const cachePrefix = "devhub.workshop.color-scheme."

function readCachedScheme(cacheKey: string): ColorScheme | undefined {
  try {
    const cached = localStorage.getItem(`${cachePrefix}${cacheKey}`)
    return cached ? JSON.parse(cached) as ColorScheme : undefined
  } catch {
    return undefined
  }
}

function writeCachedScheme(cacheKey: string, scheme: ColorScheme | undefined) {
  try {
    if (scheme) localStorage.setItem(`${cachePrefix}${cacheKey}`, JSON.stringify(scheme))
    else localStorage.removeItem(`${cachePrefix}${cacheKey}`)
  } catch {
    // The cache only avoids a flash of the default palette on the next visit.
  }
}

function applyColorSchemeCss(css: string) {
  const root = document.documentElement
  let style = document.getElementById(colorSchemeStyleId)
  if (!css) {
    style?.remove()
    root.removeAttribute(colorSchemeAttribute)
    return
  }

  if (!style) {
    style = document.createElement("style")
    style.id = colorSchemeStyleId
    document.head.append(style)
  }
  if (style.textContent !== css) style.textContent = css
  root.setAttribute(colorSchemeAttribute, "")
}

/**
 * Paints the workshop with the signed-in member's own color scheme. An unsaved preview (for
 * example while dragging a color picker) takes precedence and is applied directly to the
 * stylesheet so it never re-renders the workshop.
 */
export function useOrganizationColorScheme(organizationId: string, enabled: boolean) {
  const userId = useAppSelector((state) => state.auth.user?.id)
  // Schemes are personal, so the cache is keyed by viewer as well as organization.
  const cacheKey = `${userId ?? "guest"}.${organizationId}`
  const { data: appearance } = useGetOrganizationAppearanceQuery(organizationId, { skip: !enabled })
  const [cached, setCached] = useState(() => ({
    cacheKey,
    scheme: enabled ? readCachedScheme(cacheKey) : undefined,
  }))
  const previewCss = useRef<string | null>(null)
  const activeCssRef = useRef("")

  if (cached.cacheKey !== cacheKey) {
    setCached({ cacheKey, scheme: enabled ? readCachedScheme(cacheKey) : undefined })
  }

  const activeScheme = appearance ? findColorScheme(appearance, appearance.activeSchemeId) : cached.scheme
  const activeCss = useMemo(() => buildColorSchemeCss(activeScheme), [activeScheme])

  useLayoutEffect(() => {
    activeCssRef.current = activeCss
    applyColorSchemeCss(previewCss.current ?? activeCss)
  }, [activeCss])

  useEffect(() => {
    previewCss.current = null
    applyColorSchemeCss(activeCssRef.current)
  }, [organizationId])

  useEffect(() => () => applyColorSchemeCss(""), [])

  useEffect(() => {
    if (appearance) writeCachedScheme(cacheKey, activeCss ? activeScheme : undefined)
  }, [activeCss, activeScheme, appearance, cacheKey])

  const previewColorScheme = useCallback((scheme?: ColorScheme) => {
    previewCss.current = scheme ? buildColorSchemeCss(scheme) : null
    applyColorSchemeCss(previewCss.current ?? activeCssRef.current)
  }, [])

  return { appearance, activeScheme, previewColorScheme }
}
