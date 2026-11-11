import type {AuthUser} from "@/features/auth/auth-types"
import type {WorkshopOrganization, WorkshopProject, WorkshopTeam} from "./workshop-types"

export type DashboardDataContext = {
    organization: WorkshopOrganization
    project?: WorkshopProject
    user?: AuthUser | null
    userId: string
    displayName: string
    persisted: boolean
    now: Date
}

export const dashboardPlaceholders = {
    Organization: {
        org_name: "Current organization name",
        org_description: "Organization description",
        org_owner_name: "Organization owner’s display name",
        org_member_count: "Number of organization members",
        org_online_member_count: "Number of members shown as online",
        org_team_count: "Number of organization teams",
        org_project_count: "Number of projects visible to you",
    },
    Personal: {
        personal_username: "Your account username",
        personal_first_name: "Your first name",
        personal_display_name: "Your name in this organization",
        personal_role: "Your highest organization role",
        personal_roles: "All your organization roles",
        personal_presence: "Your presence status",
        personal_joined_date: "Date you joined the organization",
        personal_open_task_count: "Open tasks assigned to you in the organization",
        personal_time: "Your local time",
        utc_time: "Time in UTC",
        personal_current_project: "Your selected project",
    },
    "Personal team": {
        personal_team_name: "Name of the team shown in this widget",
        personal_team_names: "Names of all your teams",
        personal_team_count: "Number of teams you belong to",
        personal_team_description: "Description of the team shown in this widget",
        personal_team_leader_name: "That team’s leader",
        personal_team_member_count: "Number of members on that team",
    },
} as const

export function dashboardMemberTeams({organization, userId}: DashboardDataContext) {
    const member = organization.members.find(item => item.id === userId)
    return organization.teams.filter(team => team.memberIds.includes(userId) || member?.teamIds.includes(team.id))
}

export function dashboardWidgetTeam(teams: WorkshopTeam[], selectedId?: string) {
    return teams.find(team => team.id === selectedId) ?? (teams.length === 1 ? teams[0] : undefined)
}

export function dashboardPlaceholderValues(context: DashboardDataContext, teamId?: string, openTasks?: number): Record<string, string> {
    const {organization, user, userId, project, now, displayName} = context
    const {members, roles} = organization
    const member = members.find(item => item.id === userId)
    const roleIds = member?.roleIds ?? (member ? [member.roleId] : [])
    const userRoles = roles.filter(role => roleIds.includes(role.id) || member?.isOwner && role.isOwnerRole).sort((a, b) => a.order - b.order)
    const teams = dashboardMemberTeams(context), team = dashboardWidgetTeam(teams, teamId)
    const time = now.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})
    const online = String(members.filter(item => item.online).length)
    const noTeam = teams.length ? "Choose a team" : "No team"
    const presence = member?.presenceStatus ?? (member?.online ? "online" : "offline")
    return {
        org_name: organization.name,
        org_description: organization.description,
        org_owner_name: members.find(item => item.id === organization.ownerUserId)?.name ?? "",
        org_member_count: String(organization.memberCount ?? members.length),
        org_online_member_count: online,
        org_team_count: String(organization.teamCount ?? organization.teams.length),
        org_project_count: String(organization.projects.length),
        personal_username: user?.username ?? member?.username ?? "",
        personal_first_name: user?.firstName ?? member?.profileName?.split(" ")[0] ?? displayName.split(" ")[0],
        personal_display_name: member?.name || displayName,
        personal_role: userRoles[0]?.name ?? (member?.isOwner ? "Owner" : ""),
        personal_roles: userRoles.map(role => role.name).join(", ") || (member?.isOwner ? "Owner" : ""),
        personal_presence: {online: "Online", away: "Away", dnd: "Do Not Disturb", invisible: "Invisible", offline: "Offline"}[presence],
        personal_joined_date: member?.joinedAtUtc ? new Date(member.joinedAtUtc).toLocaleDateString() : "",
        personal_open_task_count: openTasks === undefined ? "—" : String(openTasks),
        personal_time: time,
        utc_time: now.toLocaleTimeString([], {hour: "numeric", minute: "2-digit", timeZone: "UTC"}) + " UTC",
        personal_current_project: project?.name ?? "No project selected",
        personal_team_name: team?.name ?? noTeam,
        personal_team_names: teams.map(item => item.name).join(", ") || "No team",
        personal_team_count: String(teams.length),
        personal_team_description: team?.description ?? "",
        personal_team_leader_name: members.find(item => item.id === team?.leaderId)?.name ?? "",
        personal_team_member_count: team ? String(team.memberCount ?? team.memberIds.length) : "—",
        time, username: displayName, organization: organization.name, project: project?.name ?? "your organization", online,
    }
}

export function resolveDashboardPlaceholders(content: string, values: Record<string, string>) {
    return content.replace(/%([a-z_]+)%/g, (token, key: string) => Object.hasOwn(values, key) ? values[key] : token)
}
