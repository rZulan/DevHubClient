import type {Bounds} from "./canvas-view.ts"

export function connectionTargetAt<T extends Bounds & {id: string}>(nodes: T[], point: {x: number; y: number}, sourceId: string, tolerance = 0): T | undefined {
    return [...nodes].reverse().find(node => node.id !== sourceId && point.x >= node.x - tolerance && point.x <= node.x + node.width + tolerance
        && point.y >= node.y - tolerance && point.y <= node.y + node.height + tolerance)
}
