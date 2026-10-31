export const waterfallMarble = {x: 500, y: 450, radius: 390}
export const waterfallRotation = 0

function rotateWaterfallPoint(point: {x: number; y: number}) {
    const angle = waterfallRotation * Math.PI / 180, dx = point.x - waterfallMarble.x, dy = point.y - waterfallMarble.y
    return {x: waterfallMarble.x + dx * Math.cos(angle) - dy * Math.sin(angle), y: waterfallMarble.y + dx * Math.sin(angle) + dy * Math.cos(angle)}
}

// Angled entry and exit links frame the waterfall's descending stages.
const landings = [
    {x: 300, y: 183},
    {x: 420, y: 215},
    {x: 420, y: 395},
    {x: 635, y: 435},
    {x: 635, y: 620},
    {x: 745, y: 650},
]
// Move the stars themselves so labels, hit targets and camera focus stay aligned
// without rotating the label text.
export const waterfallLandings = landings.map(rotateWaterfallPoint)

export function waterfallConnection(from: {x: number; y: number}, to: {x: number; y: number}) {
    return `M${from.x} ${from.y} L${to.x} ${to.y}`
}

export function waterfallFeedbackConnection() {
    const from = rotateWaterfallPoint({x: landings[3].x - 20, y: landings[3].y})
    const control = rotateWaterfallPoint({x: landings[2].x - 110, y: landings[3].y})
    const to = rotateWaterfallPoint({x: landings[2].x - 20, y: landings[2].y})
    return `M${from.x} ${from.y}Q${control.x} ${control.y} ${to.x} ${to.y}`
}
