import type {WorkshopPermission} from "./workshop-types"

export const permissionGroups: {title: string; permissions: WorkshopPermission[]}[] = [
    {title: "Administration", permissions: ["Administrator", "Manage organization", "Manage dashboard", "Manage roles", "Manage members", "Change nicknames"]},
    {title: "Invitations & teams", permissions: ["Create invites", "Manage invites", "Manage teams"]},
    {title: "Projects & tasks", permissions: ["View all projects", "Manage projects", "Manage tasks"]},
    {title: "Project tools", permissions: ["Edit ERD", "Edit UI designs", "Manage notes", "Manage wiki", "Manage bug reports", "Manage roadmap"]},
    {title: "Legacy access", permissions: ["Edit ideation"]},
]
export const availablePermissions = permissionGroups.flatMap(group => group.permissions)
export const permissionLabels: Partial<Record<WorkshopPermission, string>> = {"Edit ideation": "Legacy project editing"}
export const permissionDescriptions: Record<WorkshopPermission, string> = {
    Administrator: "All regular permissions. Role hierarchy and owner-only actions still apply.",
    "Manage organization": "Edit the organization profile and manage its dashboard.",
    "Manage dashboard": "Customize and publish the organization dashboard without changing its profile.",
    "Manage roles": "Create roles and assign roles to members below your highest role. You can only grant permissions you hold.",
    "Manage members": "Remove members below your highest role. Team leadership must be reassigned first.",
    "Change nicknames": "Set organization-specific display names for members.",
    "Create invites": "Create invitation links and view or revoke links you created.",
    "Manage invites": "Create invitations and view or revoke any active organization invitation link.",
    "Manage teams": "Create, rename, delete, and change team membership or leadership.",
    "View all projects": "See projects belonging to teams you have not joined. Editing still needs its own permission.",
    "Manage projects": "Create, edit, move, archive, and delete projects, and update their roadmaps.",
    "Manage tasks": "Customize TODO boards and create, assign, move, edit, and delete their tasks.",
    "Edit ERD": "Edit database diagrams and apply SQL or imported drafts to accessible projects.",
    "Edit UI designs": "Edit screens, layers, components, and prototype interactions in accessible projects.",
    "Manage notes": "Create, edit, and delete notes in accessible projects.",
    "Manage wiki": "Create, edit, restore, and delete wiki pages in accessible projects.",
    "Manage bug reports": "Submit and triage bug reports, manage categories, and enable, disable, or replace the public submission link.",
    "Manage roadmap": "Update phases, ownership, deliverables, and cycle or release progress without managing project details.",
    "Edit ideation": "Existing broad access to ERD, UI/UX, Notes, and archived Playground content. Use individual tool permissions for narrower access.",
}
export const impliedPermissionSources: Partial<Record<WorkshopPermission, WorkshopPermission[]>> = {
    "Edit ERD": ["Edit ideation"], "Edit UI designs": ["Edit ideation"], "Manage notes": ["Edit ideation"],
    "Manage roadmap": ["Manage projects"], "Manage dashboard": ["Manage organization"], "Create invites": ["Manage invites"],
}
export function grantsWorkshopPermission(permissions: readonly WorkshopPermission[], permission: WorkshopPermission) {
    return permissions.includes("Administrator") || permissions.includes(permission) || (impliedPermissionSources[permission] ?? []).some(source => permissions.includes(source))
}
