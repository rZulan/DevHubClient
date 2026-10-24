/** The reference drawing uses a broad headwater and three flowing drops. */
export const waterfallDrawing = {scale: 1.05, x: -20, y: 40}

// Alternating runs and drops repeat exactly, with point symmetry about the middle pair.
export const waterfallLandings = Array.from({length: 6}, (_, index) => ({
    x: (270 + index * 65 + (index % 2 ? 85 : 0)) * waterfallDrawing.scale + waterfallDrawing.x,
    y: (140 + index * 80) * waterfallDrawing.scale + waterfallDrawing.y,
}))

export function waterfallConnection(from: {x: number; y: number}, to: {x: number; y: number}) {
    return `M${from.x} ${from.y} L${to.x} ${to.y}`
}
