import type {ReactNode} from "react"
import {Dialog, DialogContent, DialogTitle} from "@/components/ui/dialog"

/** Shares desktop content with a focus-trapped, dismissible drawer on smaller screens. */
export function ResponsiveWorkshopPanel({compact, open, onOpenChange, title, side, children}: {
    compact: boolean; open: boolean; onOpenChange: (open: boolean) => void
    title: string; side: "left" | "right"; children: ReactNode
}) {
    if (!compact) return children
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`workshop-drawer workshop-drawer-${side}`} aria-describedby={undefined}>
            <DialogTitle className="workshop-drawer-title">{title}</DialogTitle>
            {children}
        </DialogContent>
    </Dialog>
}
