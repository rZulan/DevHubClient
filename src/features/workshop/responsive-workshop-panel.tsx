import {useEffect, useRef, type ReactNode} from "react"
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog"

/** Shares desktop content with a focus-trapped, dismissible drawer on smaller screens. */
export function ResponsiveWorkshopPanel({compact, open, onOpenChange, title, side, children}: {
    compact: boolean; open: boolean; onOpenChange: (open: boolean) => void
    title: string; side: "left" | "right"; children: ReactNode
}) {
    const opener = useRef<HTMLElement | null>(null)
    useEffect(() => {
        if (!compact && open) onOpenChange(false)
    }, [compact, open, onOpenChange])
    if (!compact) return children
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`workshop-drawer workshop-drawer-${side}`} aria-describedby={undefined}
        onOpenAutoFocus={() => {opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null}}
        onCloseAutoFocus={event => {
            if (opener.current?.isConnected) {
                event.preventDefault()
                opener.current.focus({preventScroll: true})
            }
        }} onEscapeKeyDown={event => {
            // Let an expanded inline combobox consume Escape before dismissing the drawer.
            if (event.target instanceof Element && event.target.closest('[role="combobox"][aria-expanded="true"]')) event.preventDefault()
        }}>
            <DialogTitle className="workshop-drawer-title">{title}</DialogTitle>
            {children}
        </DialogContent>
    </Dialog>
}
