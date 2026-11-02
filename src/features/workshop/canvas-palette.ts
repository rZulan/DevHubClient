import type {DragEvent} from "react"
import type {ComponentPreset, DesignKind} from "./design-document"

export type CanvasPoint = {x: number; y: number}
export type DesignPaletteElement = {tool: "ui-editor"} & (
    {source: "shape"; kind: DesignKind} | {source: "component"; kind: ComponentPreset} |
    {source: "frame"; kind: "Phone" | "Tablet" | "Desktop"} | {source: "starter"; kind: "onboarding" | "dashboard"}
)
export type PaletteElement = DesignPaletteElement
export type PaletteTool = PaletteElement["tool"]
const mime = (tool: PaletteTool) => `application/x-zevont-${tool}-element`
const kinds = {
    shape: ["frame", "rectangle", "ellipse", "text", "button"], component: ["button", "input", "card", "badge", "toggle", "checkbox"],
    frame: ["Phone", "Tablet", "Desktop"], starter: ["onboarding", "dashboard"],
}

export function paletteDragProps(element: PaletteElement, enabled: boolean) {
    return {draggable: enabled, onDragStart(event: DragEvent<HTMLElement>) {
        if (!enabled) {event.preventDefault(); return}
        event.dataTransfer.setData(mime(element.tool), JSON.stringify(element))
        event.dataTransfer.effectAllowed = "copy"
    }}
}
export function readPaletteElement(data: Pick<DataTransfer, "getData">, tool: PaletteTool): PaletteElement | null {
    try {
        const text = data.getData(mime(tool))
        if (text.length > 256) return null
        const value: unknown = JSON.parse(text)
        if (!value || typeof value !== "object" || !("tool" in value) || value.tool !== tool || !("kind" in value) || typeof value.kind !== "string") return null
        if (tool === "ui-editor" && "source" in value && typeof value.source === "string" && ["shape", "component", "frame", "starter"].includes(value.source) && kinds[value.source as keyof typeof kinds].includes(value.kind)) return {tool, source: value.source, kind: value.kind} as DesignPaletteElement
    } catch { /* Other drags and malformed payloads do not create elements. */ }
    return null
}
export function canvasDropPoint(client: {clientX: number; clientY: number}, bounds: {left: number; top: number}, pan: CanvasPoint, zoom: number): CanvasPoint {
    return {x: (client.clientX - bounds.left - pan.x) / zoom, y: (client.clientY - bounds.top - pan.y) / zoom}
}
export function paletteDropHandlers(tool: PaletteTool, enabled: boolean, onActive: (active: boolean) => void, onDrop: (element: PaletteElement, event: DragEvent<HTMLDivElement>) => void) {
    const accepts = (event: DragEvent) => enabled && Array.from(event.dataTransfer.types).includes(mime(tool))
    return {
        onDragOver(event: DragEvent<HTMLDivElement>) {
            if (!accepts(event)) {onActive(false); return}
            event.preventDefault(); event.dataTransfer.dropEffect = "copy"; onActive(true)
        },
        onDragLeave(event: DragEvent<HTMLDivElement>) {
            if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) onActive(false)
        },
        onDrop(event: DragEvent<HTMLDivElement>) {
            onActive(false)
            if (!accepts(event)) return
            event.preventDefault(); event.stopPropagation()
            const element = readPaletteElement(event.dataTransfer, tool)
            if (element && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) onDrop(element, event)
        },
    }
}
