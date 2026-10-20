import {useCallback, useSyncExternalStore} from "react"

export function useCompactWorkshop(maxWidth = 1100) {
    const query = `(max-width: ${maxWidth}px)`
    const subscribe = useCallback((listener: () => void) => {
        const media = window.matchMedia(query)
        media.addEventListener("change", listener)
        return () => media.removeEventListener("change", listener)
    }, [query])
    return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
}
