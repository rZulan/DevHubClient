export type WorkshopNotification = {
    id: number; kind: string; title: string; actorName: string; projectId: string | null; projectName: string | null;
    contextId: string; targetId: string; createdAtUtc: string; readAtUtc: string | null
}
export type NotificationPage = {items: WorkshopNotification[]; unreadCount: number; nextCursor: number | null; latestId: number}

export function notificationAction(kind: string) {
    if (kind === "task-assigned") return "assigned you a task"
    if (kind === "team-member-added") return "added a team member"
    if (kind === "team-member-removed") return "removed a team member"
    if (kind.endsWith("-created")) return "created"
    if (kind.endsWith("-deleted")) return "deleted"
    return "updated"
}
export function notificationHref(organizationId: string, notification: WorkshopNotification) {
    const base = `/workshop/${encodeURIComponent(organizationId)}`
    if (notification.kind.startsWith("team-")) return `${base}/teams`
    if (notification.kind === "project-deleted") return `${base}/projects`
    if (notification.kind.startsWith("project-")) return `${base}/projects/${encodeURIComponent(notification.targetId)}`
    const params = new URLSearchParams()
    if (notification.projectId) params.set("project", notification.projectId)
    let page = "projects"
    if (notification.kind.startsWith("task-") || notification.kind.startsWith("todo-")) {
        page = "todo"; params.set("todoProject", notification.projectId ?? ""); params.set("todo", notification.contextId)
        if (notification.kind.startsWith("task-") && notification.kind !== "task-deleted") params.set("task", notification.targetId)
    } else if (notification.kind.startsWith("bug-")) {
        page = "bug-reports"
        if (notification.kind !== "bug-settings") params.set("report", notification.targetId)
    }
    return `${base}/${page}${params.size ? `?${params}` : ""}`
}
