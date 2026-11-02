export const workshopDefaults = {canvasWarningObjects: 1000, canvasMaximumObjects: 2000, savesPerMinute: 30}

export function retrySeconds(error: unknown) {
    const failure = error as {status?: number; data?: {retryAfterSeconds?: number}}
    if (failure?.status !== 429) return null
    const seconds = failure.data?.retryAfterSeconds
    return typeof seconds === "number" && Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 60
}

export function saveFailureDetail(error: unknown, fallback: string) {
    const detail = (error as {data?: {detail?: unknown}})?.data?.detail
    return typeof detail === "string" ? detail : fallback
}

export function canvasObjectCount(tool: string, document: unknown): number | null {
    const data = document as {layers?: unknown[]; diagrams?: {items: unknown[]}[]}
    return tool === "ideas" && Array.isArray(document) ? document.length
        : tool === "ui-editor" && Array.isArray(data?.layers) ? data.layers.length
        : tool === "uml" && Array.isArray(data?.diagrams) ? Math.max(0, ...data.diagrams.map(d => d.items.length)) : null
}

export function canGrowCanvas(previous: number, next: number, saved: number, maximum = workshopDefaults.canvasMaximumObjects) {
    return next <= previous || next <= Math.max(maximum, saved)
}
