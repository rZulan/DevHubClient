import { useEffect, useState } from "react"

import type { ColorSchemeMode } from "@/features/workshop/workshop-types"

/** Tracks the light/dark class the theme provider toggles on the document root. */
export function useResolvedColorMode(): ColorSchemeMode {
  const [mode, setMode] = useState<ColorSchemeMode>(() =>
    document.documentElement.classList.contains("dark") ? "dark" : "light")

  useEffect(() => {
    const root = document.documentElement
    const sync = () => setMode(root.classList.contains("dark") ? "dark" : "light")
    // The theme provider may toggle the class in a layout effect before this observer attaches.
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  return mode
}
