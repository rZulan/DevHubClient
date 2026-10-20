const selectedOrganizationKey = "devhub.workshop.organization"
const selectedProjectPrefix = "devhub.workshop.project."
const workshopResumeKey = "devhub.workshop.resume"

type WorkshopResumeState = {
    userId: string
    path: string
}

export function getSelectedOrganizationId() {
    return localStorage.getItem(selectedOrganizationKey)
}

export function setSelectedOrganizationId(organizationId: string) {
    localStorage.setItem(selectedOrganizationKey, organizationId)
}

export function clearSelectedOrganizationId() {
    localStorage.removeItem(selectedOrganizationKey)
}

export function getSelectedProjectId(userId: string | undefined, organizationId: string) {
    if (!userId) return null
    const userKey = `${selectedProjectPrefix}${userId}.${organizationId}`
    const selectedProjectId = localStorage.getItem(userKey)
    if (selectedProjectId) return selectedProjectId

    // Preserve the existing selection once when upgrading from organization-only storage.
    const legacyKey = `${selectedProjectPrefix}${organizationId}`
    const legacyProjectId = localStorage.getItem(legacyKey)
    if (!legacyProjectId) return null
    localStorage.setItem(userKey, legacyProjectId)
    localStorage.removeItem(legacyKey)
    return legacyProjectId
}

export function setSelectedProjectId(userId: string | undefined, organizationId: string, projectId: string) {
    if (!userId) return
    localStorage.setItem(`${selectedProjectPrefix}${userId}.${organizationId}`, projectId)
}

export function getWorkshopResumePath(userId: string) {
    try {
        const stored = JSON.parse(localStorage.getItem(workshopResumeKey) ?? "null") as WorkshopResumeState | null
        if (stored?.userId !== userId || !stored.path.startsWith("/workshop") || stored.path.startsWith("//")) return null
        return stored.path
    } catch {
        return null
    }
}

export function setWorkshopResumePath(userId: string, path: string) {
    if (!path.startsWith("/workshop") || path.startsWith("//")) return
    try {
        localStorage.setItem(workshopResumeKey, JSON.stringify({userId, path} satisfies WorkshopResumeState))
    } catch {
        // Continuing without route restoration is safe when storage is unavailable.
    }
}

export function clearWorkshopResumePath() {
    try {
        localStorage.removeItem(workshopResumeKey)
    } catch {
        // Storage can be unavailable in privacy modes.
    }
}
