import {useId, useState, type CSSProperties, type ReactNode} from "react"
import {ChevronLeft, ChevronRight} from "lucide-react"
import {useCompactWorkshop} from "@/hooks/use-compact-workshop"
import {ResponsiveWorkshopPanel} from "./responsive-workshop-panel"

export function ErdPanel({side, title, detail, collapsed, onToggle, children, className = "", style}: {
    side: "left" | "right"; title: string; detail?: ReactNode; collapsed: boolean; onToggle: () => void; children: ReactNode; className?: string; style?: CSSProperties
}) {
    const contentId = useId()
    const compact = useCompactWorkshop()
    const [open, setOpen] = useState(false)
    const isCollapsed = !compact && collapsed
    const toggle = compact ? () => setOpen(false) : onToggle
    const Chevron = side === "left" ? isCollapsed ? ChevronRight : ChevronLeft : isCollapsed ? ChevronLeft : ChevronRight
    const panel = <aside style={style} className={`${side === "left" ? "tool-layer-panel" : "tool-inspector"} erd-side-panel ${isCollapsed ? "erd-panel-collapsed" : ""} ${className}`} aria-label={`${title} sidebar`}>
        <header className="erd-panel-heading">
            {!isCollapsed && <div><strong>{title}</strong>{detail !== undefined && <small>{detail}</small>}</div>}
            <button type="button" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${title} panel`} aria-expanded={!isCollapsed} aria-controls={contentId} onClick={toggle}><Chevron/></button>
        </header>
        {isCollapsed && <span className="erd-panel-rail-label" aria-hidden="true">{title}</span>}
        <div className="erd-panel-content" id={contentId} hidden={isCollapsed}>{children}</div>
    </aside>
    if (!compact) return panel
    return <>
        <button type="button" className={`tool-panel-launcher tool-panel-launcher-${side}`} aria-label={`Open ${title} panel`} aria-expanded={open} onClick={() => setOpen(true)}>{title}<Chevron/></button>
        <ResponsiveWorkshopPanel compact open={open} onOpenChange={setOpen} title={title} side={side}>{panel}</ResponsiveWorkshopPanel>
    </>
}
