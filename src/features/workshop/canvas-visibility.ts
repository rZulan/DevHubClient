import {axisAlignedBounds, type Bounds, type CanvasView} from "./canvas-view.ts"

export function canvasViewport(view: CanvasView, size: {width: number; height: number}, overscan = 192): Bounds | undefined {
    if (size.width <= 0 || size.height <= 0 || !Number.isFinite(view.zoom) || view.zoom <= 0) return
    return {x: (-view.pan.x - overscan) / view.zoom, y: (-view.pan.y - overscan) / view.zoom,
        width: (size.width + overscan * 2) / view.zoom, height: (size.height + overscan * 2) / view.zoom}
}

export function intersectsViewport(item: Bounds, viewport?: Bounds) {
    if (!viewport) return true
    const bounds = axisAlignedBounds(item)
    return bounds.x <= viewport.x + viewport.width && bounds.x + bounds.width >= viewport.x
        && bounds.y <= viewport.y + viewport.height && bounds.y + bounds.height >= viewport.y
}
