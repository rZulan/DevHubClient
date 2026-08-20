import { useMemo, useState } from "react"
import {
  Crown,
  FolderKanban,
  LoaderCircle,
  Plus,
  Search,
  Users,
} from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { CreateTeamDialog } from "@/features/workshop/create-team-dialog"
import type {
  WorkshopMember,
  WorkshopOrganization,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import {
  useListOrganizationMembersQuery,
  useListTeamMembersQuery,
} from "@/services/api"

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function WorkshopTeamsPage() {
  const { organization } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const [query, setQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const isPersistedOrganization = guidPattern.test(organization.id)
  const isOwner = organization.ownerUserId === user?.id
    || (organization.ownerUserId === "current" && organization.id === "atlas-studio")
  const { data: apiMembers } = useListOrganizationMembersQuery(organization.id, {
    skip: !isPersistedOrganization,
  })

  const members = useMemo<WorkshopMember[]>(() => {
    if (!apiMembers) return organization.members

    return apiMembers.map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      username: member.username ?? member.email.split("@")[0],
      initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
      roleId: member.id === organization.ownerUserId ? "owner" : "member",
      teamIds: [],
      online: member.id === user?.id,
    }))
  }, [apiMembers, organization.members, organization.ownerUserId, user?.id])

  const filteredTeams = organization.teams.filter((team) =>
    `${team.name} ${team.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  const assignedMemberCount = new Set(organization.teams.flatMap((team) => team.memberIds)).size

  return (
    <div className="workshop-page workshop-teams-page">
      <section className="workshop-page-heading compact">
        <div>
          <span className="workshop-page-kicker">Team directory</span>
          <h2>Teams & ownership</h2>
          <p>See who leads each team, which projects they own, and where every member contributes.</p>
        </div>
        {isOwner && <Button className="workshop-page-action" onClick={() => setIsCreating(true)} type="button"><Plus /> Create team</Button>}
      </section>

      <div className="workshop-team-summary">
        <Card size="sm"><CardContent><Users /><span><strong>{organization.teams.length}</strong><small>Active teams</small></span></CardContent></Card>
        <Card size="sm"><CardContent><Crown /><span><strong>{organization.teams.length}</strong><small>Team leaders</small></span></CardContent></Card>
        <Card size="sm"><CardContent><FolderKanban /><span><strong>{organization.projects.length}</strong><small>Owned projects</small></span></CardContent></Card>
        <Card size="sm"><CardContent><Users /><span><strong>{isPersistedOrganization ? members.length : assignedMemberCount}</strong><small>Assigned people</small></span></CardContent></Card>
      </div>

      <div className="workshop-team-toolbar">
        <label><Search /><Input aria-label="Search teams" onChange={(event) => setQuery(event.target.value)} placeholder="Search teams" value={query} /></label>
        <Badge variant="outline">{filteredTeams.length} {filteredTeams.length === 1 ? "team" : "teams"}</Badge>
      </div>

      {filteredTeams.length > 0 ? (
        <div className="workshop-team-grid">
          {filteredTeams.map((team) => (
            <TeamCard
              isPersistedOrganization={isPersistedOrganization}
              key={team.id}
              members={members}
              organization={organization}
              team={team}
            />
          ))}
        </div>
      ) : (
        <section className="workshop-empty-panel">
          <Users />
          <h3>{organization.teams.length ? "No matching teams" : "Create your first team"}</h3>
          <p>{organization.teams.length ? "Try another name or description." : "Group members around clear ownership before creating projects."}</p>
          {isOwner && organization.teams.length === 0 && <Button onClick={() => setIsCreating(true)} type="button"><Plus /> Create team</Button>}
        </section>
      )}

      <CreateTeamDialog
        defaultLeaderId={user?.id ?? members[0]?.id}
        members={members}
        onOpenChange={setIsCreating}
        open={isCreating}
        organization={organization}
        teams={organization.teams}
      />
    </div>
  )
}

function TeamCard({
  isPersistedOrganization,
  members,
  organization,
  team,
}: {
  isPersistedOrganization: boolean
  members: WorkshopMember[]
  organization: WorkshopOrganization
  team: WorkshopTeam
}) {
  const { data: apiTeamMembers, isFetching } = useListTeamMembersQuery(
    { organizationId: organization.id, teamId: team.id },
    { skip: !isPersistedOrganization },
  )
  const teamMembers = apiTeamMembers
    ? apiTeamMembers.map((member) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      username: member.username ?? member.email.split("@")[0],
      initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
      online: false,
    }))
    : members.filter((member) => team.memberIds.includes(member.id))
  const leader = members.find((member) => member.id === team.leaderId)
    ?? teamMembers.find((member) => member.id === team.leaderId)
  const projects = organization.projects.filter((project) => project.teamIds.includes(team.id))
  const memberCount = team.memberCount ?? teamMembers.length

  return (
    <Card className="workshop-team-card" style={{ "--team-color": team.color } as React.CSSProperties}>
      <CardHeader>
        <span className="workshop-team-card-icon"><Users /></span>
        <Badge variant="outline">{memberCount} {memberCount === 1 ? "member" : "members"}</Badge>
        <div>
          <h3>{team.name}</h3>
          <p>{team.description || "No team description yet."}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="workshop-team-lead-row">
          <Crown />
          <Avatar size="sm"><AvatarFallback>{leader?.initials ?? "?"}</AvatarFallback></Avatar>
          <span><small>Team leader</small><strong>{leader?.name ?? "Assigned leader"}</strong></span>
        </div>
        <div className="workshop-team-project-row">
          <span><FolderKanban /> Projects</span>
          <div>{projects.length ? projects.map((project) => <Badge key={project.id} variant="secondary">{project.name}</Badge>) : <small>No projects yet</small>}</div>
        </div>
      </CardContent>
      <footer>
        {isFetching ? <LoaderCircle className="animate-spin" /> : (
          <AvatarGroup>
            {teamMembers.slice(0, 5).map((member) => <Avatar key={member.id} size="sm" title={member.name}><AvatarFallback>{member.initials}</AvatarFallback></Avatar>)}
            {memberCount > 5 && <AvatarGroupCount>+{memberCount - 5}</AvatarGroupCount>}
          </AvatarGroup>
        )}
        <small>{memberCount} total</small>
      </footer>
    </Card>
  )
}
