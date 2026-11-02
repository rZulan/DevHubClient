import {designComponent, designStarter, framePresets, layerUnavailable, newDesignLayer, type DesignDocument} from "./design-document.ts"
import type {CanvasPoint, DesignPaletteElement} from "./canvas-palette.ts"

const contains = (box: {x: number; y: number; width: number; height: number}, point: CanvasPoint) => point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height
const coordinate = (value: number) => Math.max(-1e6, Math.min(1e6, value))

export function placeDesignElement(doc: DesignDocument, element: DesignPaletteElement, point: CanvasPoint) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return []
    const isScreen = element.source === "frame" || element.source === "starter" || element.source === "shape" && element.kind === "frame"
    const parent = isScreen ? undefined : [...doc.layers].reverse().find(l => l.kind === "frame" && !layerUnavailable(doc, l, "hidden") && contains(l, point))
    if (parent && layerUnavailable(doc, parent, "locked")) return []
    const preset = element.source === "frame" ? framePresets.find(p => p.name === element.kind) : undefined
    const layers = element.source === "starter" ? designStarter(element.kind, 0) : element.source === "component" ? designComponent(element.kind, 0, 0, parent?.id) :
        [newDesignLayer(element.source === "frame" ? "frame" : element.kind, {...(preset ? {...preset} : {}), parentId: parent?.id})]
    const left = Math.min(...layers.map(l => l.x)), top = Math.min(...layers.map(l => l.y))
    const width = Math.max(...layers.map(l => l.x + l.width)) - left, height = Math.max(...layers.map(l => l.y + l.height)) - top
    const x = coordinate(parent ? Math.max(parent.x, Math.min(point.x - width / 2, parent.x + parent.width - width)) : point.x - width / 2)
    const y = coordinate(parent ? Math.max(parent.y, Math.min(point.y - height / 2, parent.y + parent.height - height)) : point.y - height / 2)
    return layers.map(l => ({...l, x: coordinate(l.x + x - left), y: coordinate(l.y + y - top)}))
}
