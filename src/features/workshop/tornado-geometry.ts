export type Point3 = {x: number; y: number; z: number}
export type TornadoCamera = {yaw: number; pitch: number; zoom: number; panX: number; panY: number}
export type TornadoViewport = {width: number; height: number}
export type TornadoLayer = {cycle: number; hue: number; points: Point3[]; phases: Point3[]}
export type TornadoScene = {layers: TornadoLayer[]; guides: Point3[][]; height: number}
export const defaultTornadoCamera: TornadoCamera = {yaw: -.55, pitch: -.22, zoom: 1, panX: 0, panY: 0}
const layerHeight = 170
const tau = Math.PI * 2

/** The golden angle keeps adjacent iterations distinct without recycling a short palette. */
export function tornadoHue(cycle: number) {return (265 + (cycle - 1) * 137.508) % 360}
function axis(height: number) {return {x: Math.sin(height / 250) * 13, z: Math.sin(height / 300) * 10}}
function radius(height: number) {return 12 + height * .32}
export function tornadoPoint(cycle: number, progress: number): Point3 {
    const height = (cycle - 1) * layerHeight + 8 + progress * 148
    const angle = progress * tau * 2 - Math.PI / 2
    const center = axis(height), r = radius(height)
    return {x: center.x + Math.cos(angle) * r, y: height, z: center.z + Math.sin(angle) * r}
}

export function createTornadoScene(count: number, phaseCount = 6): TornadoScene {
    const cycles = Math.max(1, Math.min(1001, Math.trunc(count)))
    // Keep the complete history visible while bounding geometry cost for long-running projects.
    const samples = Math.max(12, Math.min(96, Math.floor(3600 / cycles)))
    const layers = Array.from({length: cycles}, (_, index): TornadoLayer => ({
        cycle: index + 1, hue: tornadoHue(index + 1),
        points: Array.from({length: samples + 1}, (_, point) => tornadoPoint(index + 1, point / samples)),
        phases: Array.from({length: phaseCount}, (_, phase) => tornadoPoint(index + 1, phase / Math.max(1, phaseCount - 1))),
    }))
    const height = cycles * layerHeight
    const guides = Array.from({length: 4}, (_, side) => Array.from({length: 41}, (_, index) => {
        const y = index / 40 * (height - 14) + 4, r = radius(y), center = axis(y)
        const angle = side / 4 * tau + Math.sin(y / 180) * .08
        return {x: center.x + Math.cos(angle) * r, y, z: center.z + Math.sin(angle) * r}
    }))
    guides.push(Array.from({length: 65}, (_, index) => {
        const y = height - 14, r = radius(y), center = axis(y), angle = index / 64 * tau
        return {x: center.x + Math.cos(angle) * r, y, z: center.z + Math.sin(angle) * r}
    }))
    return {layers, guides, height}
}

export function boundTornadoCamera(camera: TornadoCamera, viewport: TornadoViewport): TornadoCamera {
    const zoom = Math.max(.45, Math.min(5, camera.zoom))
    return {...camera, zoom, yaw: Math.atan2(Math.sin(camera.yaw), Math.cos(camera.yaw)),
        pitch: Math.max(-1.32, Math.min(1.32, camera.pitch)),
        panX: Math.max(-viewport.width * .65 * zoom, Math.min(viewport.width * .65 * zoom, camera.panX)),
        panY: Math.max(-viewport.height * .65 * zoom, Math.min(viewport.height * .65 * zoom, camera.panY))}
}
export function elasticTornadoCamera(camera: TornadoCamera, viewport: TornadoViewport): TornadoCamera {
    const bound = boundTornadoCamera(camera, viewport)
    const resist = (value: number, edge: number) => edge + Math.sign(value - edge) * 64 * (1 - Math.exp(-Math.abs(value - edge) / 180))
    return {...bound, panX: resist(camera.panX, bound.panX), panY: resist(camera.panY, bound.panY)}
}

/** Real world-space rotation and perspective; the SVG is a depth-sorted view of this 3D scene. */
export function tornadoProjection(scene: TornadoScene, camera: TornadoCamera, viewport: TornadoViewport) {
    const yawCos = Math.cos(camera.yaw), yawSin = Math.sin(camera.yaw)
    const pitchCos = Math.cos(camera.pitch), pitchSin = Math.sin(camera.pitch)
    const distance = scene.height * 3
    function view(point: Point3) {
        const x = point.x * yawCos + point.z * yawSin
        const z = -point.x * yawSin + point.z * yawCos
        const y = point.y - scene.height / 2
        const depth = y * pitchSin + z * pitchCos
        const perspective = distance / (distance - depth)
        return {x: x * perspective, y: -(y * pitchCos - z * pitchSin) * perspective, depth, perspective}
    }
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
    for (const points of [...scene.layers.map(layer => layer.points), ...scene.guides]) for (const point of points) {
        const projected = view(point)
        left = Math.min(left, projected.x); right = Math.max(right, projected.x)
        top = Math.min(top, projected.y); bottom = Math.max(bottom, projected.y)
    }
    const paddingX = Math.min(110, viewport.width * .23), paddingY = Math.min(64, viewport.height * .17)
    const scale = Math.min(Math.max(1, viewport.width - paddingX * 2) / Math.max(1, right - left), Math.max(1, viewport.height - paddingY * 2) / Math.max(1, bottom - top)) * camera.zoom
    const centerX = (left + right) / 2, centerY = (top + bottom) / 2
    return (point: Point3) => {
        const projected = view(point)
        return {...projected, x: viewport.width / 2 + camera.panX + (projected.x - centerX) * scale,
            y: viewport.height / 2 + camera.panY + (projected.y - centerY) * scale}
    }
}

/** Labels stay readable as the camera rotates; leaders preserve their connection to the stars. */
export function tornadoLabels(points: {x: number; y: number}[], viewport: TornadoViewport) {
    const result = points.map((point, index) => ({index, x: point.x, y: point.y, side: point.x < viewport.width / 2 ? -1 : 1, labelY: point.y}))
    for (const side of [-1, 1]) {
        const column = result.filter(label => label.side === side).sort((a, b) => a.y - b.y)
        for (let index = 0; index < column.length; index++) column[index].labelY = Math.max(50, column[index].y, index ? column[index - 1].labelY + 28 : 0)
        if (column.length && column.at(-1)!.labelY > viewport.height - 42) {
            column.at(-1)!.labelY = viewport.height - 42
            for (let index = column.length - 2; index >= 0; index--) column[index].labelY = Math.min(column[index].labelY, column[index + 1].labelY - 28)
        }
    }
    return result
}
