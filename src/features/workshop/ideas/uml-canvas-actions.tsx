import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {useRef, useState} from "react"
import {MoreHorizontal} from "lucide-react"
import {Button} from "@/components/ui/button"
import {validUmlLibrary, type UmlDiagram} from "../uml-library"
import type {CanvasItem} from "../shape-clipboard"
import {arrangeUmlItems, autoLayoutUml, type UmlArrangement} from "../uml-layout"
import {downloadUmlFile} from "./uml-download"
import {exportManager} from "@/features/exports/export-manager"
import {useExporting} from "@/features/exports/use-export-jobs"

const arrangements: [UmlArrangement,string][] = [
    ["left","Left"], ["center","Center"], ["right","Right"],
    ["top","Top"], ["middle","Middle"], ["bottom","Bottom"],
    ["distribute-x","Distribute horizontally"], ["distribute-y","Distribute vertically"],
]

export function UmlCanvasActions({diagram, selectedIds, canEdit, onItems}: {
    diagram: UmlDiagram
    selectedIds: string[]
    canEdit: boolean
    onItems: (items: CanvasItem[]) => void
}) {
    const [open,setOpen] = useState(false)
    const [error,setError] = useState("")
    const file = useRef<HTMLInputElement>(null)
    const base = diagram.name.replaceAll(/[^a-zA-Z0-9_-]/g,"-") || "uml"
    const exportKey = `uml-png:${diagram.id}`
    const exporting = useExporting(exportKey)

    async function exportImage(format: "svg" | "png") {
        if (format === "png") {
            void exportManager.run({key: exportKey, label: "UML · PNG", detail: diagram.name}, async context => {
                const {umlSvg, exportUmlPng} = await import("./uml-export")
                context.signal.throwIfAborted()
                await exportUmlPng(umlSvg(diagram), `${base}.png`, context)
            }).catch(() => {})
        } else {
            const {umlSvg} = await import("./uml-export")
            downloadUmlFile(`${base}.svg`,new Blob([umlSvg(diagram)],{type:"image/svg+xml"}))
        }
    }

    function action(label:string,run:()=>void|Promise<void>,disabled=false) {
        return <Button key={label} size="sm" variant="ghost" disabled={disabled} onClick={async()=>{
            try {
                setError("")
                await run()
                setOpen(false)
            } catch (e) {
                setError(e instanceof Error ? e.message : "Action failed")
            }
        }}>{label}</Button>
    }

    return <div className="uml-canvas-actions">
        <Button size="icon-sm" variant="ghost" aria-label="Diagram actions" aria-expanded={open} onClick={()=>setOpen(!open)}><MoreHorizontal/></Button>
        {open && <div className="uml-actions-popover" onKeyDown={event=>{
            if (event.key === "Escape") {event.stopPropagation();setOpen(false)}
        }}>
            <strong>Export</strong>
            {action("Export SVG",()=>exportImage("svg"))}
            {action("Export PNG",()=>exportImage("png"),exporting)}
            {action("Export canvas JSON",()=>downloadUmlFile(`${base}.json`,new Blob([JSON.stringify({version:1,diagram},null,2)],{type:"application/json"})))}
            {canEdit && <>
                <strong>Canvas</strong>
                {action("Import canvas JSON…",()=>file.current?.click())}
                {action("Auto arrange",()=>onItems(autoLayoutUml(diagram.items,diagram.type==="sequence"||diagram.type==="timing")))}
                <strong>Align selection</strong>
                {arrangements.map(([mode,label])=>action(label,()=>onItems(arrangeUmlItems(diagram.items,selectedIds,mode)),selectedIds.length<(mode.startsWith("distribute")?3:2)))}
            </>}
            {error && <WorkshopToast variant="error" onDismiss={() => setError("")}>{error}</WorkshopToast>}
        </div>}
        <input hidden type="file" ref={file} accept=".json,application/json" onChange={async event=>{
            const selected=event.target.files?.[0]
            event.target.value=""
            if (!canEdit || !selected) return
            try {
                if (selected.size > 4_000_000) throw new Error("File is too large")
                const parsed=JSON.parse(await selected.text())
                if (parsed.version!==1 || !validUmlLibrary({version:1,diagrams:[parsed.diagram]})) throw new Error("Choose a valid UML canvas JSON export")
                if (diagram.items.length && !window.confirm("Replace this diagram’s canvas with the imported canvas? You can undo this change.")) return
                onItems(parsed.diagram.items)
                setError("")
            } catch (e) {
                setOpen(true)
                setError(e instanceof Error ? e.message : "Could not import canvas")
            }
        }}/>
    </div>
}
