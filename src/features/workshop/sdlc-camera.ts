export type RoadmapPoint = {x: number; y: number}
export type RoadmapCamera = RoadmapPoint & {zoom: number}
export const roadmapSize = {width: 1000, height: 900}
export const roadmapPositions = sdlcModels.waterfall.positions

export function fitRoadmap(viewport: {width: number; height: number}, readable = false): RoadmapCamera {
    // Leave room for labels, which retain a readable size when the scene is small.
    const padding = 32
    const zoom = Math.min(1.25, Math.max(readable ? .6 : .1, Math.min((viewport.width - padding * 2) / roadmapSize.width, (viewport.height - padding * 2) / roadmapSize.height)))
    return {zoom, x: (viewport.width - roadmapSize.width * zoom) / 2, y: (viewport.height - roadmapSize.height * zoom) / 2}
}

/** Small scenes stay centered; large scenes stop at their outer edges. */
export function boundRoadmap(camera: RoadmapCamera, viewport: {width: number; height: number}): RoadmapCamera {
    function axis(value: number, size: number, extent: number) {
        return extent <= size ? (size - extent) / 2 : Math.max(size - extent, Math.min(0, value))
    }
    return {...camera, x: axis(camera.x, viewport.width, roadmapSize.width * camera.zoom), y: axis(camera.y, viewport.height, roadmapSize.height * camera.zoom)}
}

/** Resistance approaches 72px, so even a long gesture cannot lose the roadmap. */
export function elasticRoadmap(camera: RoadmapCamera, viewport: {width: number; height: number}): RoadmapCamera {
    const edge = boundRoadmap(camera, viewport)
    function resist(value: number, bound: number) {
        const distance = value - bound
        return bound + Math.sign(distance) * 72 * (1 - Math.exp(-Math.abs(distance) / 180))
    }
    return {...camera, x: resist(camera.x, edge.x), y: resist(camera.y, edge.y)}
}
import {sdlcModels} from "./sdlc-models.ts"
