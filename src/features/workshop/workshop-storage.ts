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

export function getSelectedProjectId(organizationId: string) {
  return localStorage.getItem(`${selectedProjectPrefix}${organizationId}`)
}

export function setSelectedProjectId(organizationId: string, projectId: string) {
  localStorage.setItem(`${selectedProjectPrefix}${organizationId}`, projectId)
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
    localStorage.setItem(workshopResumeKey, JSON.stringify({ userId, path } satisfies WorkshopResumeState))
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
