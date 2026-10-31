import type {WorkshopMember, WorkshopOrganization, WorkshopTeam} from "./workshop-types"

// Team membership is supplied by the teams endpoint. Member.teamIds is not hydrated by the API.
export function directoryTeamMembers(organization: WorkshopOrganization, team: WorkshopTeam) {
    const ids = new Set([...team.memberIds, team.leaderId])
    return organization.members.filter(member => ids.has(member.id)).sort((a, b) =>
        Number(b.id === team.leaderId) - Number(a.id === team.leaderId) || a.name.localeCompare(b.name))
}

export function directoryMemberTeams(organization: WorkshopOrganization, memberId: string) {
    return organization.teams.filter(team => team.leaderId === memberId || team.memberIds.includes(memberId))
}

export function directoryStats(organization: WorkshopOrganization) {
    const people = new Set(organization.members.map(member => member.id))
    const teams = new Set(organization.teams.map(team => team.id))
    const assigned = new Set(organization.teams.flatMap(team => [...team.memberIds, team.leaderId]).filter(id => people.has(id)))
    return {
        teams: teams.size,
        leaders: new Set(organization.teams.map(team => team.leaderId).filter(id => people.has(id))).size,
        assigned: assigned.size,
        unassigned: people.size - assigned.size,
        projects: organization.projects.filter(project => project.teamIds.some(id => teams.has(id))).length,
    }
}

export function directoryRoleGroups(organization: WorkshopOrganization) {
    const roles = [...organization.roles].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    const groups = roles.map(role => ({id: role.id, name: role.name, color: role.color, members: [] as WorkshopMember[]}))
    const other = {id: "directory-other", name: "Other members", color: "var(--muted-foreground)", members: [] as WorkshopMember[]}
    for (const member of organization.members) {
        const memberRoles = new Set([member.roleId, ...member.roleIds ?? []])
        const role = (member.isOwner ? roles.find(role => role.isOwnerRole) : undefined)
            ?? roles.find(role => memberRoles.has(role.id))
        const group = groups.find(group => group.id === role?.id) ?? other
        group.members.push(member)
    }
    return [...groups, other].filter(group => group.members.length).map(group => ({
        ...group, members: group.members.sort((a, b) => a.name.localeCompare(b.name)),
    }))
}

export function directoryMemberMatches(member: WorkshopMember, query: string) {
    return `${member.name} ${member.username} ${member.nickname ?? ""} ${member.profileName ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
}
