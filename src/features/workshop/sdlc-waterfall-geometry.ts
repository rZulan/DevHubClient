const artworkOrigin = {x: 124, y: 90}
export const waterfallArtworkScale = 6.2

export const waterfallArtworkTransform = `translate(${artworkOrigin.x} ${artworkOrigin.y}) scale(${waterfallArtworkScale})`

// The phases trace a central stream through all three terraces.
export const waterfallLandings = [
    {x: 48.7, y: 16.5},
    {x: 54.1, y: 40.3},
    {x: 64.3, y: 47.5},
    {x: 66.6, y: 64.5},
    {x: 75.3, y: 71.3},
    {x: 76.4, y: 88.7},
].map(({x, y}) => ({
    x: artworkOrigin.x + x * waterfallArtworkScale,
    y: artworkOrigin.y + y * waterfallArtworkScale,
}))

export function waterfallFeedbackConnection() {
    const [, , implementation, verification] = waterfallLandings
    const cornerX = verification.x + 74
    const cornerY = (verification.y + implementation.y) / 2
    return `M${verification.x + 15} ${verification.y - 12}L${cornerX} ${cornerY}L${implementation.x + 15} ${implementation.y + 12}`
}
