type Point = [number, number]
const nx = .45, ny = Math.sqrt(1 - nx * nx)
const perspective = 1000
export const notePeelDuration = 300
export const noteSettleDuration = 480
export const noteHoverProgress = .13

function clip(points: Point[], boundary: number, above: boolean): Point[] {
    const result: Point[] = []
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        const da = nx * a[0] + ny * a[1] - boundary, db = nx * b[0] + ny * b[1] - boundary
        const insideA = above ? da >= 0 : da <= 0, insideB = above ? db >= 0 : db <= 0
        if (insideA) result.push(a)
        if (insideA !== insideB) {
            const t = da / (da - db)
            result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t])
        }
    }
    return result
}

function bend(width: number, height: number, progress: number) {
    const p = Math.max(0, Math.min(1, progress)), travel = p * p * (3 - 2 * p)
    const radius = Math.min(width, height) * .22 * (.003 + .997 * Math.min(1, travel / .7))
    return {p, radius, crease: (nx * width + ny * height) * (1 - travel) - radius * .4 * travel}
}

/** Project the paper's continuous cylindrical curl into the scene's perspective. */
export function projectNotePoint(width: number, height: number, point: Point, progress: number): Point {
    const {p, radius, crease} = bend(width, height, progress)
    const position = nx * point[0] + ny * point[1], distance = Math.max(0, position - crease)
    const angle = Math.min(distance / radius, Math.PI * .78), tail = Math.max(0, distance - radius * angle)
    const rolled = distance === 0 ? position : crease + radius * Math.sin(angle) + tail * Math.cos(angle)
    const z = radius * (1 - Math.cos(angle)) + tail * Math.sin(angle) + Math.max(0, (p - .88) / .12) * 16
    // Anchor perspective at the lifted corner so the curl retreats into the paper
    // instead of magnifying past its original right and bottom edges.
    const scale = perspective / (perspective - z), ox = width, oy = height
    return [ox + (point[0] + nx * (rolled - position) - ox) * scale, oy + (point[1] + ny * (rolled - position) - oy) * scale]
}

function path(points: Point[], width: number, height: number, progress: number): string {
    if (points.length < 3) return ""
    const projected: Point[] = []
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length]
        const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 3))
        for (let step = 0; step < steps; step++) {
            const t = step / steps
            projected.push(projectNotePoint(width, height, [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], progress))
        }
    }
    return projected.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(3)},${y.toFixed(3)}`).join(" ") + " Z"
}

/** One connected path per face avoids the independent strips that caused loose fragments. */
export function notePeelShape(width: number, height: number, progress: number, cornerRadius = 5) {
    const {p, radius, crease} = bend(width, height, progress)
    const r = Math.min(cornerRadius, width / 2, height / 2)
    const rectangle: Point[] = []
    // Match the real rounded paper, so the curl never invents a square tip outside it.
    for (const [cx, cy, start] of [[width - r, r, -Math.PI / 2], [width - r, height - r, 0], [r, height - r, Math.PI / 2], [r, r, Math.PI]]) {
        for (let step = 0; step <= 8; step++) {
            const angle = start + step / 8 * Math.PI / 2
            rectangle.push([cx + r * Math.cos(angle), cy + r * Math.sin(angle)])
        }
    }
    const flat = clip(rectangle, crease, false)
    // Perspective moves the visible silhouette before the cylinder's 90° turn.
    // Split both faces at that tangent so the light front cannot protrude around
    // the dark underside near the end of the peel.
    const cameraAlongCurl = nx * width + ny * height - crease
    const cameraAboveCurl = perspective - radius - Math.max(0, (p - .88) / .12) * 16
    const tangent = Math.atan2(cameraAboveCurl, cameraAlongCurl) + Math.asin(radius / Math.hypot(cameraAlongCurl, cameraAboveCurl))
    const turn = crease + radius * tangent
    const curledFront = clip(clip(rectangle, crease, true), turn, false)
    const curledBack = clip(rectangle, turn, true)
    return {
        flatClip: p === 0 ? "none" : flat.length < 3 ? "polygon(0 0, 0 0, 0 0)" : `polygon(${flat.map(([x, y]) => `${x}px ${y}px`).join(",")})`,
        frontPath: p === 0 ? "" : path(curledFront, width, height, p),
        backPath: p === 0 ? "" : path(curledBack, width, height, p),
    }
}
