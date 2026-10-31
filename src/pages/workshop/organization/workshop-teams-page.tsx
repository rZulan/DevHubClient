import {type CSSProperties, type FormEvent, useState} from "react"
import {ArrowRight, Check, Crown, FolderKanban, LoaderCircle, Pencil, Plus, Trash2, Users} from "lucide-react"
import {Link, useOutletContext} from "react-router-dom"
import {useAppSelector} from "@/app/hooks"
import {AvatarGroup, AvatarGroupCount} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {CreateTeamDialog} from "@/features/workshop/create-team-dialog"
import {directoryMemberMatches, directoryTeamMembers} from "@/features/workshop/organization-directory"
import {DirectoryAvatar, DirectoryEmpty, DirectoryHeading, DirectoryPerson, DirectoryPersonDialog, DirectorySearch, DirectorySummary} from "@/features/workshop/organization-directory-ui"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useOrganizationDirectoryData} from "@/features/workshop/use-organization-directory-data"
import type {WorkshopMember, WorkshopOrganization, WorkshopTeam} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {useAddTeamMemberMutation, useDeleteTeamMutation, useRemoveTeamMemberMutation, useUpdateTeamMutation, useSetTeamAvatarMutation} from "@/services/api"
import {WorkspaceAvatar} from "@/features/workshop/workspace-avatar"
import {WorkspaceAvatarEditor} from "@/features/workshop/workspace-avatar-editor"

export function WorkshopTeamsPage() {
    const {organization, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const [query, setQuery] = useState("")
    const [scope, setScope] = useState("all")
    const [sort, setSort] = useState("name")
    const [isCreating, setIsCreating] = useState(false)
    const [viewingId, setViewingId] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [person, setPerson] = useState<WorkshopMember | null>(null)
    const directoryData = useOrganizationDirectoryData(organization.id, isPersistedOrganization)
    const canManage = hasWorkshopPermission(organization, userId, "Manage teams")
    const search = query.trim().toLowerCase()
    const filteredTeams = organization.teams.filter(team => {
        const roster = directoryTeamMembers(organization, team)
        return (scope === "all" || roster.some(member => member.id === userId)) &&
            (!search || `${team.name} ${team.description}`.toLowerCase().includes(search) || roster.some(member => directoryMemberMatches(member, search)))
    }).sort((a, b) => (sort === "members" ? directoryTeamMembers(organization, b).length - directoryTeamMembers(organization, a).length : 0) || a.name.localeCompare(b.name))
    const viewing = organization.teams.find(team => team.id === viewingId)
    const editing = organization.teams.find(team => team.id === editingId)
    const clearFilters = () => {setQuery(""); setScope("all")}

    return <div className="workshop-page organization-directory">
        <DirectoryHeading organization={organization}>{canManage && <Button onClick={() => setIsCreating(true)}><Plus/> Create team</Button>}</DirectoryHeading>
        <DirectorySummary organization={organization}/>
        <div className="directory-toolbar">
            <div className="directory-segment" aria-label="Filter teams">
                <button type="button" aria-pressed={scope === "all"} onClick={() => setScope("all")}>All teams <span>{organization.teams.length}</span></button>
                <button type="button" aria-pressed={scope === "mine"} onClick={() => setScope("mine")}>My teams</button>
            </div>
            <DirectorySearch label="Search teams" placeholder="Search teams or people…" value={query} onChange={setQuery}/>
            <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Sort teams"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="name">Name A–Z</SelectItem><SelectItem value="members">Most members</SelectItem></SelectContent></Select>
        </div>
        <div className="directory-section-caption"><h3>Team directory</h3><span role="status">{filteredTeams.length} of {organization.teams.length} teams</span></div>
        {directoryData.isError && <div className="directory-error" role="alert">Some team or member data could not be refreshed. <Button variant="outline" size="sm" onClick={directoryData.retry}>Try again</Button></div>}
        {directoryData.isLoading ? <div className="directory-loading" role="status"><LoaderCircle className="animate-spin"/> Loading teams…</div> : filteredTeams.length ? <div className="directory-team-grid">
            {filteredTeams.map(team => {
                const roster = directoryTeamMembers(organization, team)
                const leader = roster.find(member => member.id === team.leaderId)
                const projects = organization.projects.filter(project => project.teamIds.includes(team.id))
                return <article className="directory-team-card" key={team.id} style={{"--directory-color": team.color} as CSSProperties}>
                    <header><WorkspaceAvatar className="directory-team-symbol" name={team.name} avatarUrl={team.avatarUrl} fallback={<Users/>}/><span className="directory-count">{roster.length} {roster.length === 1 ? "member" : "members"}</span>
                        {isPersistedOrganization && (canManage || team.leaderId === userId) && <Button variant="ghost" size="icon-sm" aria-label={`Manage ${team.name}`} onClick={() => setEditingId(team.id)}><Pencil/></Button>}
                    </header>
                    <div className="directory-team-intro"><h3><button type="button" onClick={() => setViewingId(team.id)}>{team.name}</button></h3><p>{team.description || "This team hasn’t added a description yet."}</p></div>
                    <div className="directory-team-owner"><DirectoryAvatar member={leader}/><div><small><Crown/> Team leader</small><strong>{leader?.name ?? "Leader unavailable"}</strong></div></div>
                    <div className="directory-team-projects"><FolderKanban/><span>{projects.length} {projects.length === 1 ? "project" : "projects"}</span><small title={projects.map(project => project.name).join(", ")}>{projects.length ? projects.map(project => project.name).join(", ") : "Ready for something new"}</small></div>
                    <footer><AvatarGroup>{roster.slice(0, 4).map(member => <DirectoryAvatar member={member} small key={member.id}/>)}{roster.length > 4 && <AvatarGroupCount>+{roster.length - 4}</AvatarGroupCount>}</AvatarGroup><button className="directory-text-link" onClick={() => setViewingId(team.id)} type="button">View team <ArrowRight/></button></footer>
                </article>
            })}
            {canManage && !query && scope === "all" && <button className="directory-create-card" type="button" onClick={() => setIsCreating(true)}><span><Plus/></span><strong>Make room for a new team</strong><small>Bring people together around a shared goal.</small><b>Create team <ArrowRight/></b></button>}
        </div> : !directoryData.isError && <DirectoryEmpty title={organization.teams.length ? "No teams found" : "Great work starts with a team"} action={organization.teams.length ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : canManage ? <Button onClick={() => setIsCreating(true)}><Plus/> Create your first team</Button> : undefined}>{organization.teams.length ? "Try a different team name or person, or switch to all teams." : "Group people around shared responsibilities, then connect their projects."}</DirectoryEmpty>}
        <CreateTeamDialog defaultLeaderId={userId} members={organization.members} onOpenChange={setIsCreating} open={isCreating} organization={organization} teams={organization.teams}/>
        {viewing && <Dialog open onOpenChange={open => {if (!open) setViewingId(null)}}><DialogContent className="workshop-modal directory-modal directory-roster">
            <WorkspaceAvatar className="directory-team-symbol" name={viewing.name} avatarUrl={viewing.avatarUrl} fallback={<Users/>}/>
            <DialogHeader><DialogTitle>{viewing.name}</DialogTitle><DialogDescription>{viewing.description || "Team members and shared projects."}</DialogDescription></DialogHeader>
            <section><h3>People <span>{directoryTeamMembers(organization, viewing).length}</span></h3><div className="directory-roster-people">{directoryTeamMembers(organization, viewing).map(member => <DirectoryPerson key={member.id} member={member} organization={organization} leader={member.id === viewing.leaderId} onClick={() => setPerson(member)}/>)}</div></section>
            <section><h3>Projects</h3><div className="directory-roster-projects">{organization.projects.filter(project => project.teamIds.includes(viewing.id)).map(project => <Link key={project.id} to={`/workshop/${organization.id}/projects/${project.id}`}><FolderKanban/><strong>{project.name}</strong><small>{project.status}</small><ArrowRight/></Link>)}{!organization.projects.some(project => project.teamIds.includes(viewing.id)) && <p>No projects assigned yet.</p>}</div></section>
            {isPersistedOrganization && (canManage || viewing.leaderId === userId) && <Button onClick={() => {setViewingId(null); setEditingId(viewing.id)}}><Pencil/> Manage team</Button>}
        </DialogContent></Dialog>}
        {editing && <ManageTeamDialog key={editing.id} organization={organization} team={editing} canChangeLeader={canManage} onClose={() => setEditingId(null)}/>}
        <DirectoryPersonDialog member={person} organization={organization} onClose={() => setPerson(null)}/>
    </div>
}

function ManageTeamDialog({organization, team, canChangeLeader, onClose}: {organization: WorkshopOrganization; team: WorkshopTeam; canChangeLeader: boolean; onClose: () => void}) {
    const [leaderId, setLeaderId] = useState(team.leaderId)
    const [selectedIds, setSelectedIds] = useState(() => new Set([...team.memberIds, team.leaderId]))
    const [query, setQuery] = useState("")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [confirmation, setConfirmation] = useState("")
    const [updateTeam] = useUpdateTeamMutation()
    const [setTeamAvatar] = useSetTeamAvatarMutation()
    const [deleteTeam] = useDeleteTeamMutation()
    const [addMember] = useAddTeamMemberMutation()
    const [removeMember] = useRemoveTeamMemberMutation()
    const roster = organization.members.filter(member => directoryMemberMatches(member, query))

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        const form = new FormData(event.currentTarget)
        const name = String(form.get("name") ?? "").trim()
        if (name.length < 2) {setError("Use at least 2 characters for the team name."); return}
        setBusy(true); setError("")
        try {
            const saved = await updateTeam({organizationId: organization.id, teamId: team.id, name, description: String(form.get("description") ?? "").trim(), leaderUserId: leaderId}).unwrap()
            const savedIds = new Set([...saved.memberIds, leaderId])
            const desired = new Set(selectedIds).add(leaderId)
            const results = await Promise.allSettled([
                ...[...desired].filter(id => !savedIds.has(id)).map(userId => addMember({organizationId: organization.id, teamId: team.id, userId}).unwrap()),
                ...[...savedIds].filter(id => !desired.has(id)).map(userId => removeMember({organizationId: organization.id, teamId: team.id, userId}).unwrap()),
            ])
            const failed = results.find(result => result.status === "rejected")
            if (failed?.status === "rejected") setError(`Team details saved, but some membership changes failed. ${getApiErrorMessage(failed.reason)} Retry to finish saving your selection.`)
            else onClose()
        } catch (saveError) {setError(getApiErrorMessage(saveError))}
        finally {setBusy(false)}
    }

    async function remove() {
        if (busy || !canChangeLeader || confirmation !== team.name) return
        setBusy(true); setError("")
        try {await deleteTeam({organizationId: organization.id, teamId: team.id}).unwrap(); onClose()}
        catch (deleteError) {setError(getApiErrorMessage(deleteError))}
        finally {setBusy(false)}
    }

    return <Dialog open onOpenChange={open => {if (!open && !busy) onClose()}}><DialogContent className="workshop-modal directory-modal directory-team-editor" showCloseButton={!busy}>
        <DialogHeader><DialogTitle>{confirmingDelete ? `Delete ${team.name}?` : `Manage ${team.name}`}</DialogTitle><DialogDescription>{confirmingDelete ? "This permanently deletes the team, its projects, and their saved data. Members keep their organization access. This cannot be undone." : "Keep ownership clear and bring the right people together."}</DialogDescription></DialogHeader>
        {confirmingDelete ? <div className="directory-delete-confirm"><Label>Type <strong>{team.name}</strong> to confirm<Input autoFocus value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy}/></Label>{error && <p className="directory-form-error" role="alert">{error}</p>}<div className="directory-modal-actions"><Button variant="outline" disabled={busy} onClick={() => {setConfirmingDelete(false); setError("")}}>Cancel</Button><Button variant="destructive" disabled={busy || confirmation !== team.name} onClick={() => void remove()}>{busy ? <LoaderCircle className="animate-spin"/> : <Trash2/>} Delete team</Button></div></div> :
            <form onSubmit={save}>
                <WorkspaceAvatarEditor label="Team icon" name={team.name} avatarUrl={team.avatarUrl} disabled={busy} onSave={avatarUrl => setTeamAvatar({organizationId: organization.id, teamId: team.id, avatarUrl}).unwrap()}/>
                <fieldset disabled={busy} className="directory-editor-fields"><Label>Team name<Input autoFocus defaultValue={team.name} minLength={2} maxLength={150} name="name" required/></Label>
                    <Label>Description <Textarea defaultValue={team.description} maxLength={1000} name="description" rows={3} placeholder="What does this team own?"/></Label>
                    <Label>Team leader<Select disabled={!canChangeLeader || busy} value={leaderId} onValueChange={id => {setLeaderId(id); setSelectedIds(current => new Set(current).add(id))}}><SelectTrigger className="w-full"><SelectValue/></SelectTrigger><SelectContent>{organization.members.map(member => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></Label>
                    <div className="directory-picker-heading"><h3>Team members</h3><span>{selectedIds.size} selected · leader included</span></div>
                    <DirectorySearch label="Search members" placeholder="Find a person…" value={query} onChange={setQuery}/>
                    <div className="directory-member-picker">{roster.map(member => <Label key={member.id}><Checkbox disabled={busy || member.id === leaderId} checked={selectedIds.has(member.id)} onCheckedChange={checked => setSelectedIds(current => {const next = new Set(current); if (checked === true) next.add(member.id); else next.delete(member.id); return next})}/><DirectoryAvatar member={member} small/><span><strong>{member.name}</strong><small>@{member.username}</small></span>{member.id === leaderId && <Crown/>}</Label>)}{!roster.length && <p>No people match your search.</p>}</div>
                </fieldset>
                {error && <p className="directory-form-error" role="alert">{error}</p>}
                <div className="directory-modal-actions">{canChangeLeader && <Button variant="ghost" className="directory-delete-button" disabled={busy} type="button" onClick={() => {setConfirmingDelete(true); setError("")}}><Trash2/> Delete team</Button>}<Button variant="outline" type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} type="submit">{busy ? <LoaderCircle className="animate-spin"/> : <Check/>} Save changes</Button></div>
            </form>}
    </DialogContent></Dialog>
}
