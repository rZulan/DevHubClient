const largePoolWaveSizes = [5, 6, 7, 6]

function waveSize(poolSize: number, waveNumber: number) {
    if (poolSize >= 70) return largePoolWaveSizes[waveNumber % largePoolWaveSizes.length]
    if (poolSize >= 40) return 4
    if (poolSize >= 20) return 3
    if (poolSize >= 8) return 2
    return 1
}

export function nextTravelerWave<T extends {id: string}>(
    profiles: readonly T[],
    activeIds: ReadonlySet<string>,
    nextIndex: number,
    waveNumber: number,
    hasMore: boolean,
) {
    if (!profiles.length) return null

    const size = waveSize(profiles.length, waveNumber)
    const endIndex = nextIndex + size
    if (hasMore && endIndex > profiles.length) return null

    const arrivals = Array.from({length: size}, (_, offset) => profiles[(nextIndex + offset) % profiles.length])
    if (arrivals.some(({id}) => activeIds.has(id))) return null

    return {arrivals, nextIndex: hasMore ? endIndex : endIndex % profiles.length}
}
