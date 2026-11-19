import type {Point} from "./connection-graph-layout"

export type GraphFrame = {center: Point; width: number; height: number}
export type GraphViewport = {width: number; height: number}

export function graphFrame(nodes: Point[]): GraphFrame {
    if (!nodes.length) return {center: {x: 0, y: 0}, width: 580, height: 372}
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const {x, y} of nodes) {
        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
    }
    return {
        center: {x: (minX + maxX) / 2, y: (minY + maxY) / 2},
        width: Math.max(580, maxX - minX + 230),
        height: Math.max(372, maxY - minY + 156),
    }
}

export function graphScale(frame: GraphFrame, viewport: GraphViewport, zoom: number) {
    return Math.min(viewport.width / frame.width, viewport.height / frame.height) * zoom
}
