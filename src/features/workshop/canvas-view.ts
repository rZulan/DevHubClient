export type Bounds = { x: number; y: number; width: number; height: number; rotation?: number }
export type CanvasView = {zoom: number; pan: {x: number; y: number}}

/** Thin the world grid in powers of two before its dots get closer than 16 screen pixels. */
export function canvasGridBackground(zoom: number, pan: {x: number; y: number}, baseSpacing = 24) {
    const scale = Number.isFinite(zoom) && zoom > 0 ? zoom : 1
    const projected = baseSpacing * scale
    let spacing = projected
    if (projected < 16) {
        const level = Math.ceil(Math.log2(16) - Math.log2(projected))
        spacing = Math.max(16, level <= 1023 ? projected * 2 ** level : 2 ** (Math.log2(projected) + level))
    }
    if (!Number.isFinite(spacing)) spacing = baseSpacing
    return {
        backgroundSize: `${spacing}px ${spacing}px`,
        // A radial gradient's center is half a tile from its origin. Keep a dot at world (0, 0).
        backgroundPosition: `${pan.x - spacing / 2}px ${pan.y - spacing / 2}px`,
    }
}

export function pinchView(view: CanvasView, start: [{x: number; y: number}, {x: number; y: number}], current: typeof start): CanvasView {
    const distance = (points: typeof start) => Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)
    const midpoint = (points: typeof start) => ({x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2})
    const initialDistance = distance(start), nextDistance = distance(current)
    if (initialDistance < 1 || nextDistance < 1) return view
    const zoom = view.zoom * nextDistance / initialDistance, from = midpoint(start), to = midpoint(current)
    const pan = {x: to.x - (from.x - view.pan.x) * zoom / view.zoom, y: to.y - (from.y - view.pan.y) * zoom / view.zoom}
    return Number.isFinite(zoom) && zoom > 0 && Number.isFinite(pan.x) && Number.isFinite(pan.y) ? {zoom, pan} : view
}

export function axisAlignedBounds(item: Bounds): Bounds {
    const radians = (item.rotation ?? 0) * Math.PI / 180
    if (radians === 0) return {x: item.x, y: item.y, width: item.width, height: item.height}
    const cosine = Math.abs(Math.cos(radians))
    const sine = Math.abs(Math.sin(radians))
    const width = item.width * cosine + item.height * sine
    const height = item.width * sine + item.height * cosine
    return {
        x: item.x + (item.width - width) / 2,
        y: item.y + (item.height - height) / 2,
        width,
        height,
    }
}

export function combinedBounds(items: Bounds[]): Bounds {
    if (!items.length) return {x: -100, y: -100, width: 200, height: 200}
    const rectangles = items.map(axisAlignedBounds)
    const x = Math.min(...rectangles.map((item) => item.x))
    const y = Math.min(...rectangles.map((item) => item.y))
    return {
        x,
        y,
        width: Math.max(...rectangles.map((item) => item.x + item.width)) - x,
        height: Math.max(...rectangles.map((item) => item.y + item.height)) - y
    }
}

export function zoomAt(zoom: number, pan: { x: number; y: number }, next: number, anchor: { x: number; y: number }) {
    return {x: anchor.x - (anchor.x - pan.x) * next / zoom, y: anchor.y - (anchor.y - pan.y) * next / zoom}
}

export function fitBounds(bounds: Bounds, viewport: { width: number; height: number }, rightInset = 0) {
    const width = Math.max(1, viewport.width - rightInset)
    const height = Math.max(1, viewport.height)
    const zoom = Math.min(Math.max(1, width - 96) / Math.max(1, bounds.width), Math.max(1, height - 160) / Math.max(1, bounds.height))
    return {
        zoom,
        pan: {
            x: width / 2 - (bounds.x + bounds.width / 2) * zoom,
            y: height / 2 - (bounds.y + bounds.height / 2) * zoom
        }
    }
}
