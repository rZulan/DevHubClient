const selectedOrganizationKey = "devhub.workshop.organization"
const selectedProjectPrefix = "devhub.workshop.project."

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
