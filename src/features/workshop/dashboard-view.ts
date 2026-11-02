export type DashboardView = "personal" | "organization"

const key = (userId: string, organizationId: string) => `devhub.dashboard-view:${userId}:${organizationId}`

export function getDashboardView(userId: string, organizationId: string, requested?: string | null): DashboardView {
    if (requested === "personal" || requested === "organization") return requested
    try {
        return localStorage.getItem(key(userId, organizationId)) === "personal" ? "personal" : "organization"
    } catch {
        return "organization"
    }
}

export function setDashboardView(userId: string, organizationId: string, view: DashboardView) {
    try {localStorage.setItem(key(userId, organizationId), view)}
    catch { /* Navigation still works when browser storage is unavailable. */ }
}
