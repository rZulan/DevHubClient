export type LauncherPosition = {x: number; y: number}
export type LauncherSize = "phone" | "tablet" | "desktop"
export type LauncherPositions = Partial<Record<LauncherSize, LauncherPosition>>

export function launcherSize(width: number): LauncherSize {
    return width < 640 ? "phone" : width <= 1100 ? "tablet" : "desktop"
}
export function isLauncherPosition(value: unknown): value is LauncherPosition {
    return !!value && typeof value === "object" && "x" in value && "y" in value
        && typeof value.x === "number" && Number.isFinite(value.x)
        && typeof value.y === "number" && Number.isFinite(value.y)
}
export function readLauncherPositions(value: string | null): LauncherPositions {
    try {
        const saved: unknown = JSON.parse(value ?? "null")
        if (!saved || typeof saved !== "object") return {}
        return Object.fromEntries((["phone", "tablet", "desktop"] as const)
            .flatMap(size => size in saved && isLauncherPosition(saved[size as keyof typeof saved]) ? [[size, saved[size as keyof typeof saved]]] : []))
    } catch {return {}}
}
/** Clamping is only a display adjustment. Never replace the user's saved preference on resize. */
export function fitLauncherPosition(position: LauncherPosition, viewport: {width: number; height: number}, button: {width: number; height: number}): LauncherPosition {
    return {x: Math.max(8, Math.min(position.x, viewport.width - button.width - 8)), y: Math.max(8, Math.min(position.y, viewport.height - button.height - 8))}
}
