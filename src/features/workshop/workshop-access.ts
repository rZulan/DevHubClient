import type {
  WorkshopOrganization,
  WorkshopPermission,
  WorkshopRole,
} from "@/features/workshop/workshop-types"

export function hasWorkshopPermission(
  organization: WorkshopOrganization,
  userId: string | undefined,
  permission: WorkshopPermission,
) {
  const member = organization.members.find((candidate) => candidate.id === userId)
  if (!member) return false
  if (member.isOwner) return true

  return organization.roles.some((role) =>
    (member.roleIds ?? [member.roleId]).includes(role.id) &&
    (role.permissions.includes("Administrator") || role.permissions.includes(permission)),
  )
}

export function highestWorkshopRole(
  organization: WorkshopOrganization,
  userId: string | undefined,
) {
  const member = organization.members.find((candidate) => candidate.id === userId)
  if (!member) return undefined
  return organization.roles
    .filter((role) => (member.roleIds ?? [member.roleId]).includes(role.id))
    .sort((left, right) => left.order - right.order)[0]
}

export function canManageWorkshopRole(
  organization: WorkshopOrganization,
  userId: string | undefined,
  role: WorkshopRole,
) {
  const member = organization.members.find((candidate) => candidate.id === userId)
  if (member?.isOwner) return true
  const highest = highestWorkshopRole(organization, userId)
  return Boolean(
    highest &&
    !role.isOwnerRole &&
    hasWorkshopPermission(organization, userId, "Manage roles") &&
    highest.order < role.order,
  )
}

export function canManageWorkshopMember(
  organization: WorkshopOrganization,
  userId: string | undefined,
  targetUserId: string,
) {
  if (!userId || userId === targetUserId) return false
  const actor = organization.members.find((member) => member.id === userId)
  const target = organization.members.find((member) => member.id === targetUserId)
  if (!actor || !target || target.isOwner) return false
  if (actor.isOwner) return true
  const actorRole = highestWorkshopRole(organization, userId)
  const targetRole = highestWorkshopRole(organization, targetUserId)
  return Boolean(actorRole && targetRole && actorRole.order < targetRole.order)
}
