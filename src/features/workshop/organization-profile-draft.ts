export type OrganizationProfileDraft = {organizationId: string; name: string; description: string; savedName: string; savedDescription: string}
export function organizationProfileDraft(organizationId: string, name: string, description: string): OrganizationProfileDraft {
    return {organizationId, name, description, savedName: name, savedDescription: description}
}
export function syncOrganizationProfileDraft(draft: OrganizationProfileDraft, organizationId: string, name: string, description: string): OrganizationProfileDraft {
    if (draft.organizationId !== organizationId) return organizationProfileDraft(organizationId, name, description)
    return {...draft, name: draft.name === draft.savedName ? name : draft.name, description: draft.description === draft.savedDescription ? description : draft.description, savedName: name, savedDescription: description}
}
