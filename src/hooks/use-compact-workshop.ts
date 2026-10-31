import {createContext, useCallback, useContext, useSyncExternalStore} from "react"

export const WorkshopContentWidthContext = createContext<number | null>(null)

export function useCompactWorkshop(maxWidth = 1100) {
    const query = `(max-width: ${maxWidth}px)`
    const subscribe = useCallback((listener: () => void) => {
        const media = window.matchMedia(query)
        media.addEventListener("change", listener)
        return () => media.removeEventListener("change", listener)
    }, [query])
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}

/** Tool panels respond to the space remaining after the workshop sidebars. */
export function useCompactWorkshopContent(maxWidth = 1100) {
    const width = useContext(WorkshopContentWidthContext)
    const compactViewport = useCompactWorkshop(maxWidth)
    return width === null ? compactViewport : width <= maxWidth
}
