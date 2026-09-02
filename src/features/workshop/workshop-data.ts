import type { AuthUser } from "@/features/auth/auth-types"
import type {
  ApiProject,
  ApiOrganization,
  WorkshopOrganization,
  WorkshopPermission,
  WorkshopRole,
} from "@/features/workshop/workshop-types"

const ownerPermissions: WorkshopPermission[] = [
  "Manage organization",
  "Manage roles",
  "Manage teams",
  "Manage projects",
  "Manage members",
  "Edit ideation",
  "Manage tasks",
  "View all projects",
]

export const seedOrganizations: WorkshopOrganization[] = [
  {
    id: "atlas-studio",
    ownerUserId: "current",
    name: "Atlas Studio",
    description: "A small product studio building tools that help remote teams think together.",
    initials: "AS",
    roles: [
      { id: "owner", name: "Studio Lead", color: "#f5b942", order: 0, permissions: ownerPermissions },
      {
        id: "staff",
        name: "Product Staff",
        color: "#a78bfa",
        order: 1,
        permissions: ["Manage teams", "Manage projects", "Edit ideation", "Manage tasks", "View all projects"],
      },
      {
        id: "lead",
        name: "Team Leads",
        color: "#38bdf8",
        order: 2,
        permissions: ["Manage projects", "Edit ideation", "Manage tasks"],
      },
      {
        id: "member",
        name: "Makers",
        color: "#34d399",
        order: 3,
        permissions: ["Edit ideation", "Manage tasks"],
      },
    ],
    teams: [
      { id: "product", name: "Product & Design", description: "Research, product direction, and interface design.", color: "#a78bfa", leaderId: "maya", memberIds: ["current", "maya", "jo"] },
      { id: "platform", name: "Platform", description: "APIs, infrastructure, and integrations.", color: "#38bdf8", leaderId: "eli", memberIds: ["current", "eli", "sam"] },
      { id: "growth", name: "Growth", description: "Launches, content, and customer feedback.", color: "#fb7185", leaderId: "nia", memberIds: ["nia", "lina"] },
    ],
    projects: [
      {
        id: "northstar",
        name: "Northstar",
        summary: "A shared planning space that turns team discussions into a living product map.",
        status: "In development",
        teamIds: ["product", "platform"],
        leadUserId: "maya",
        techStack: ["React", ".NET", "TypeScript", "Tailwind"],
        repository: "atlas-studio/northstar",
        sdlc: "Agile · 2-week sprints",
        database: "SQL Server",
        documentationUrl: "https://docs.example.com/northstar",
        designUrl: "https://www.figma.com/",
        liveUrl: "https://northstar.example.com",
        environments: ["Development", "Staging", "Production"],
        startDate: "2026-06-02",
        targetDate: "2026-10-30",
        updatedAt: "12 minutes ago",
      },
      {
        id: "signal",
        name: "Signal Inbox",
        summary: "A lightweight customer-feedback inbox with automatic themes and follow-ups.",
        status: "Planning",
        teamIds: ["product", "growth"],
        leadUserId: "nia",
        techStack: ["React", "Node.js", "Postgres"],
        repository: "atlas-studio/signal-inbox",
        sdlc: "Dual-track discovery",
        database: "PostgreSQL",
        documentationUrl: "https://docs.example.com/signal",
        environments: ["Development"],
        startDate: "2026-08-10",
        targetDate: "2026-12-12",
        updatedAt: "Yesterday",
      },
      {
        id: "relay",
        name: "Relay API",
        summary: "A durable event bridge for the studio's products and internal automations.",
        status: "Review",
        teamIds: ["platform"],
        leadUserId: "eli",
        techStack: [".NET", "Redis", "Docker"],
        repository: "atlas-studio/relay",
        sdlc: "Kanban",
        database: "SQL Server + Redis",
        documentationUrl: "https://docs.example.com/relay",
        liveUrl: "https://relay.example.com",
        environments: ["Development", "Staging", "Production"],
        startDate: "2026-04-14",
        targetDate: "2026-08-28",
        updatedAt: "3 days ago",
      },
    ],
    members: [
      { id: "current", name: "You", username: "current-user", initials: "YO", roleId: "owner", teamIds: ["product", "platform"], online: true, status: "Working in Northstar" },
      { id: "maya", name: "Maya Chen", username: "mayac", initials: "MC", roleId: "staff", teamIds: ["product"], online: true, status: "Reviewing flows" },
      { id: "eli", name: "Eli Brooks", username: "elib", initials: "EB", roleId: "lead", teamIds: ["platform"], online: true, status: "API planning" },
      { id: "nia", name: "Nia Flores", username: "niaf", initials: "NF", roleId: "lead", teamIds: ["growth"], online: false },
      { id: "jo", name: "Jo Rivera", username: "jorivera", initials: "JR", roleId: "member", teamIds: ["product"], online: true, status: "On the ideation board" },
      { id: "sam", name: "Sam Okafor", username: "samok", initials: "SO", roleId: "member", teamIds: ["platform"], online: false },
      { id: "lina", name: "Lina Park", username: "linap", initials: "LP", roleId: "member", teamIds: ["growth"], online: true, status: "Writing launch notes" },
    ],
    tasks: [
      { id: "task-1", projectId: "northstar", title: "Finalize workspace navigation", description: "Lock the information architecture for the first product workspace.", status: "pending", priority: "High", assigneeId: "maya", label: "Design" },
      { id: "task-2", projectId: "northstar", title: "Invite link expiration", description: "Add configurable expiration and usage limits to organization invites.", status: "pending", priority: "Medium", assigneeId: "eli", label: "Backend" },
      { id: "task-3", projectId: "northstar", title: "Project permission matrix", description: "Map role permissions against project and team visibility.", status: "progress", priority: "High", assigneeId: "current", label: "Product" },
      { id: "task-4", projectId: "northstar", title: "Ideation canvas gestures", description: "Polish pan, zoom, and card dragging for mouse and touch.", status: "progress", priority: "Medium", assigneeId: "jo", label: "Frontend" },
      { id: "task-5", projectId: "northstar", title: "Organization selector", description: "Remember the last active organization on each device.", status: "done", priority: "Medium", assigneeId: "current", label: "Frontend" },
      { id: "task-6", projectId: "northstar", title: "Workshop shell prototype", description: "Build the first standalone Workshop layout.", status: "done", priority: "High", assigneeId: "jo", label: "Design" },
      { id: "task-7", projectId: "signal", title: "Interview five customers", description: "Validate how feedback is triaged today.", status: "pending", priority: "High", assigneeId: "nia", label: "Research" },
    ],
  },
]

export function createWorkshopOrganization(
  organization: ApiOrganization,
  user?: AuthUser | null,
): WorkshopOrganization {
  const ownerRole: WorkshopRole = {
    id: "owner",
    name: "Org Owner",
    color: "#f5b942",
    order: 0,
    permissions: ownerPermissions,
  }

  const displayName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "You"
  const initials = organization.name
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return {
    id: organization.id,
    ownerUserId: organization.ownerUserId,
    name: organization.name,
    description: organization.description ?? "A new organization ready for teams and projects.",
    initials,
    roles: [
      ownerRole,
      { id: "member", name: "Member", color: "#34d399", order: 1, permissions: ["Edit ideation", "Manage tasks"] },
    ],
    members: [
      {
        id: user?.id ?? "current",
        name: displayName || "You",
        username: user?.username ?? "current-user",
        initials: displayName
          .split(/\s+/)
          .map((word) => word[0])
          .join("")
          .slice(0, 2)
          .toUpperCase() || "YO",
        roleId: organization.ownerUserId === user?.id ? "owner" : "member",
        teamIds: [],
        online: true,
        status: "Setting up the workshop",
      },
    ],
    teams: [],
    projects: [],
    tasks: [],
    memberCount: organization.memberCount,
    teamCount: organization.teamCount,
  }
}

export function mapApiProject(project: ApiProject) {
  return {
    id: project.id,
    name: project.name,
    summary: project.summary,
    status: project.status,
    teamIds: [project.teamId],
    leadUserId: project.leadUserId,
    techStack: project.techStack,
    repository: project.repositoryUrl ?? "Not linked",
    sdlc: project.sdlcMethod ?? "Not specified",
    database: project.databaseDetails ?? "Not specified",
    documentationUrl: project.documentationUrl ?? undefined,
    designUrl: project.designUrl ?? undefined,
    liveUrl: project.liveUrl ?? undefined,
    environments: project.environments,
    startDate: project.startDate ?? undefined,
    targetDate: project.targetDate ?? undefined,
    updatedAt: formatProjectDate(project.updatedAtUtc ?? project.createdAtUtc),
  }
}

function formatProjectDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value))
}

export function canViewProject(
  organization: WorkshopOrganization,
  userId: string,
  projectTeamIds: string[],
) {
  const member = organization.members.find((candidate) => candidate.id === userId)
  const role = organization.roles.find((candidate) => candidate.id === member?.roleId)

  return Boolean(
    role?.permissions.includes("View all projects") ||
      member?.teamIds.some((teamId) => projectTeamIds.includes(teamId)),
  )
}
