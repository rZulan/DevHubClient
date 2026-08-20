export type WorkshopPermission =
  | "Manage organization"
  | "Manage roles"
  | "Manage teams"
  | "Manage projects"
  | "Manage members"
  | "Edit ideation"
  | "Manage tasks"
  | "View all projects"

export type WorkshopRole = {
  id: string
  name: string
  color: string
  order: number
  permissions: WorkshopPermission[]
}

export type WorkshopMember = {
  id: string
  name: string
  username: string
  initials: string
  roleId: string
  teamIds: string[]
  online: boolean
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
