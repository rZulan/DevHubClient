import type {CanvasView} from "./canvas-view"

export function canvasViewKey(userId: string, organizationId: string, projectId: string, tool: string, documentId?: string) {
    return `devhub.canvas-view:${JSON.stringify([userId, organizationId, projectId, tool, documentId ?? null])}`
}

export function readCanvasView(key?: string): CanvasView | undefined {
    if (!key) return
    try {
        const view = JSON.parse(localStorage.getItem(key) ?? "null")
        if (view && Number.isFinite(view.zoom) && view.zoom > 0 && Number.isFinite(view.pan?.x) && Number.isFinite(view.pan?.y)) {
            return {zoom: view.zoom, pan: {x: view.pan.x, y: view.pan.y}}
        }
    } catch { /* A blocked storage provider or invalid saved view uses the initial view. */ }
}

export function saveCanvasView(key: string | undefined, view: CanvasView) {
    if (!key || !Number.isFinite(view.zoom) || view.zoom <= 0 || !Number.isFinite(view.pan.x) || !Number.isFinite(view.pan.y)) return
    try {localStorage.setItem(key, JSON.stringify(view))} catch { /* Canvas navigation still works when storage is unavailable. */ }
}
