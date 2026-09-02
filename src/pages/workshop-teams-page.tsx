import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Crown,
  FolderKanban,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { CreateTeamDialog } from "@/features/workshop/create-team-dialog"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import type {
  WorkshopMember,
  WorkshopOrganization,
  WorkshopTeam,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import {
  useListOrganizationMembersQuery,
  useListTeamMembersQuery,
  useAddTeamMemberMutation,
  useDeleteTeamMutation,
  useRemoveTeamMemberMutation,
  useUpdateTeamMutation,
} from "@/services/api"

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function WorkshopTeamsPage() {
  const { organization } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const [query, setQuery] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [editingTeam, setEditingTeam] = useState<WorkshopTeam | null>(null)
  const isPersistedOrganization = guidPattern.test(organization.id)
  const canManageTeams = hasWorkshopPermission(
    organization,
    user?.id ?? "current",
    "Manage teams",
  )
  const { data: apiMembers } = useListOrganizationMembersQuery(organization.id, {
    skip: !isPersistedOrganization,
  })

  const members = useMemo<WorkshopMember[]>(() => {
    if (!apiMembers) return organization.members
    return apiMembers.map((member) => ({
      ...organization.members.find((candidate) => candidate.id === member.id),
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      username: member.username ?? member.email.split("@")[0],
      initials: `${member.firstName[0] ?? ""}${member.lastName[0] ?? ""}`.toUpperCase(),
      avatarUrl: member.avatarUrl,
      roleId: organization.members.find((candidate) => candidate.id === member.id)?.roleId ?? "member",
      teamIds: [],
      online: organization.members.find((candidate) => candidate.id === member.id)?.online ?? false,
      presenceStatus: organization.members.find((candidate) => candidate.id === member.id)?.presenceStatus ?? "offline",
    }))
  }, [apiMembers, organization.members])

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
        {canManageTeams && <Button className="workshop-page-action" onClick={() => setIsCreating(true)} type="button"><Plus /> Create team</Button>}
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
              canManage={canManageTeams || team.leaderId === user?.id}
              members={members}
              onManage={() => setEditingTeam(team)}
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
          {canManageTeams && organization.teams.length === 0 && <Button onClick={() => setIsCreating(true)} type="button"><Plus /> Create team</Button>}
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
      {editingTeam && (
        <ManageTeamDialog
          canChangeLeader={canManageTeams}
          members={members}
          onOpenChange={(open) => { if (!open) setEditingTeam(null) }}
          open
          organization={organization}
          team={editingTeam}
        />
      )}
    </div>
  )
}

function TeamCard({
  canManage,
  isPersistedOrganization,
  members,
  organization,
  onManage,
  team,
}: {
  canManage: boolean
  isPersistedOrganization: boolean
  members: WorkshopMember[]
  organization: WorkshopOrganization
  onManage: () => void
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
      avatarUrl: member.avatarUrl,
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
          <Avatar size="sm">{leader?.avatarUrl && <AvatarImage alt={leader.name} src={leader.avatarUrl} />}<AvatarFallback>{leader?.initials ?? "?"}</AvatarFallback></Avatar>
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
            {teamMembers.slice(0, 5).map((member) => <Avatar key={member.id} size="sm" title={member.name}>{member.avatarUrl && <AvatarImage alt={member.name} src={member.avatarUrl} />}<AvatarFallback>{member.initials}</AvatarFallback></Avatar>)}
            {memberCount > 5 && <AvatarGroupCount>+{memberCount - 5}</AvatarGroupCount>}
          </AvatarGroup>
        )}
        <small>{memberCount} total</small>
        {canManage && isPersistedOrganization && <Button aria-label={`Manage ${team.name}`} onClick={onManage} size="icon-sm" type="button" variant="ghost"><Pencil /></Button>}
      </footer>
    </Card>
  )
}

function ManageTeamDialog({
  canChangeLeader,
  members,
  onOpenChange,
  open,
  organization,
  team,
}: {
  canChangeLeader: boolean
  members: WorkshopMember[]
  onOpenChange: (open: boolean) => void
  open: boolean
  organization: WorkshopOrganization
  team: WorkshopTeam
}) {
  const { data: apiTeamMembers } = useListTeamMembersQuery({ organizationId: organization.id, teamId: team.id })
  const [selectedLeaderId, setSelectedLeaderId] = useState(team.leaderId)
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(() => new Set([team.leaderId]))
  const [error, setError] = useState("")
  const [updateTeam, { isLoading: isUpdating }] = useUpdateTeamMutation()
  const [deleteTeam, { isLoading: isDeleting }] = useDeleteTeamMutation()
  const [addTeamMember] = useAddTeamMemberMutation()
  const [removeTeamMember] = useRemoveTeamMemberMutation()

  useEffect(() => {
    if (!apiTeamMembers) return
    setSelectedMemberIds(new Set([...apiTeamMembers.map((member) => member.id), selectedLeaderId]))
  }, [apiTeamMembers, selectedLeaderId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    const description = String(form.get("description") ?? "").trim()
    const existingIds = new Set(apiTeamMembers?.map((member) => member.id) ?? [team.leaderId])
    const desiredIds = new Set(selectedMemberIds)
    desiredIds.add(selectedLeaderId)

    try {
      await updateTeam({
        organizationId: organization.id,
        teamId: team.id,
        name,
        description,
        leaderUserId: selectedLeaderId,
      }).unwrap()
      await Promise.all([
        ...[...desiredIds].filter((id) => !existingIds.has(id)).map((userId) =>
          addTeamMember({ organizationId: organization.id, teamId: team.id, userId }).unwrap()),
        ...[...existingIds].filter((id) => !desiredIds.has(id) && id !== selectedLeaderId).map((userId) =>
          removeTeamMember({ organizationId: organization.id, teamId: team.id, userId }).unwrap()),
      ])
      onOpenChange(false)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  async function remove() {
    setError("")
    try {
      await deleteTeam({ organizationId: organization.id, teamId: team.id }).unwrap()
      onOpenChange(false)
    } catch (submitError) {
      setError(getApiErrorMessage(submitError))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="workshop-modal workshop-team-modal sm:max-w-lg">
        <span className="workshop-modal-icon"><Users /></span>
        <DialogHeader>
          <DialogTitle>Manage {team.name}</DialogTitle>
          <DialogDescription>Update the team name and membership{canChangeLeader ? ", or choose a new leader" : ""}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save}>
          <Label>Team name<Input autoFocus defaultValue={team.name} maxLength={150} name="name" required /></Label>
          <Label>Description <span>Optional</span><Textarea defaultValue={team.description} maxLength={1000} name="description" rows={2} /></Label>
          <Label>Team leader<Select disabled={!canChangeLeader} name="leaderId" onValueChange={(id) => { setSelectedLeaderId(id); setSelectedMemberIds((current) => new Set(current).add(id)) }} value={selectedLeaderId}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name} · @{member.username}</SelectItem>)}</SelectContent></Select></Label>
          <fieldset className="workshop-member-picker">
            <legend>Team members</legend>
            {members.filter((member) => member.id !== selectedLeaderId).map((member) => (
              <Label key={member.id}>
                <Checkbox checked={selectedMemberIds.has(member.id)} onCheckedChange={(checked) => setSelectedMemberIds((current) => { const next = new Set(current); if (checked === true) next.add(member.id); else next.delete(member.id); return next })} />
                <span><Users /></span><span><strong>{member.name}</strong><small>@{member.username}</small></span>
              </Label>
            ))}
          </fieldset>
          {error && <p className="workshop-form-error">{error}</p>}
          <div className="workshop-role-dialog-actions">
            {canChangeLeader && <Button disabled={isDeleting || isUpdating} onClick={() => void remove()} type="button" variant="destructive"><Trash2 /> Delete team</Button>}
            <Button className="workshop-primary-action" disabled={isDeleting || isUpdating} type="submit">{isUpdating ? <LoaderCircle className="animate-spin" /> : <Pencil />} Save changes</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
