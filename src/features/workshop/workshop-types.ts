export type WorkshopPermission =
  | "Administrator"
  | "Manage organization"
  | "Manage roles"
  | "Manage members"
  | "Create invites"
  | "Manage teams"
  | "View all projects"
  | "Manage projects"
  | "Manage tasks"
  | "Edit ideation"

export type WorkshopRole = {
  id: string
  name: string
  color: string
  order: number
  permissions: WorkshopPermission[]
  isOwnerRole?: boolean
  isDefaultRole?: boolean
  memberCount?: number
}

export type WorkshopPresenceStatus = "online" | "away" | "dnd" | "invisible" | "offline"

export type WorkshopMember = {
  id: string
  name: string
  username: string
  initials: string
  avatarUrl?: string
  roleId: string
  roleIds?: string[]
  isOwner?: boolean
  teamIds: string[]
  online: boolean
  presenceStatus?: WorkshopPresenceStatus
  status?: string
}

export type WorkshopTeam = {
  id: string
  name: string
  description: string
  color: string
  leaderId: string
  memberIds: string[]
  memberCount?: number
}

export type WorkshopProject = {
  id: string
  name: string
  summary: string
  status: ProjectStatus
  teamIds: string[]
  leadUserId: string
  techStack: string[]
  repository: string
  sdlc: string
  database: string
  documentationUrl?: string
  designUrl?: string
  liveUrl?: string
  environments: string[]
  startDate?: string
  targetDate?: string
  updatedAt: string
}

export type ProjectStatus =
  | "Planning"
  | "In development"
  | "Review"
  | "On hold"
  | "Shipped"
  | "Archived"

export type WorkshopTaskStatus = "pending" | "progress" | "done"

export type WorkshopTask = {
  id: string
  projectId: string
  title: string
  description: string
  status: WorkshopTaskStatus
  priority: "Low" | "Medium" | "High"
  assigneeId?: string
  label: string
}

export type WorkshopOrganization = {
  id: string
  ownerUserId: string
  name: string
  description: string
  initials: string
  roles: WorkshopRole[]
  members: WorkshopMember[]
  teams: WorkshopTeam[]
  projects: WorkshopProject[]
  tasks: WorkshopTask[]
  memberCount?: number
  teamCount?: number
}

export type ApiOrganization = {
  id: string
  ownerUserId: string
  name: string
  description?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
  memberCount: number
  teamCount: number
}

export type ApiOrganizationInvite = {
  token: string
  expiresAtUtc: string
}

export type ApiOrganizationRole = {
  id: string
  name: string
  color: string
  position: number
  isOwnerRole: boolean
  isDefaultRole: boolean
  permissions: WorkshopPermission[]
  memberCount: number
}

export type ApiOrganizationMember = {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAtUtc: string
  username?: string
  dateOfBirth?: string | null
  avatarUrl?: string
  isOwner: boolean
  roleIds: string[]
}

export type SaveOrganizationRoleInput = {
  name: string
  color: string
  position: number
  permissions: WorkshopPermission[]
}

export type ApiTeam = {
  id: string
  organizationId: string
  leaderUserId: string
  name: string
  description?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
  memberCount: number
}

export type ApiProject = {
  id: string
  organizationId: string
  teamId: string
  leadUserId: string
  name: string
  summary: string
  status: ProjectStatus
  techStack: string[]
  repositoryUrl?: string | null
  documentationUrl?: string | null
  designUrl?: string | null
  liveUrl?: string | null
  sdlcMethod?: string | null
  databaseDetails?: string | null
  environments: string[]
  startDate?: string | null
  targetDate?: string | null
  createdAtUtc: string
  updatedAtUtc?: string | null
}

export type SaveProjectInput = {
  name: string
  summary: string
  status: ProjectStatus
  teamId: string
  leadUserId: string
  techStack: string[]
  repositoryUrl?: string
  documentationUrl?: string
  designUrl?: string
  liveUrl?: string
  sdlcMethod?: string
  databaseDetails?: string
  environments: string[]
  startDate?: string
  targetDate?: string
}
