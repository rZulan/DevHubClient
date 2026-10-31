import {type CSSProperties, useState} from "react"
import {Building2, ChevronDown, Layers, LoaderCircle, Network, Users} from "lucide-react"
import {useOutletContext} from "react-router-dom"
import {Button} from "@/components/ui/button"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {directoryMemberMatches, directoryMemberTeams, directoryRoleGroups, directoryStats, directoryTeamMembers} from "@/features/workshop/organization-directory"
import {DirectoryEmpty, DirectoryHeading, DirectoryPerson, DirectoryPersonDialog, DirectorySearch} from "@/features/workshop/organization-directory-ui"
import type {WorkshopMember} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {useOrganizationDirectoryData} from "@/features/workshop/use-organization-directory-data"
import {WorkspaceAvatar} from "@/features/workshop/workspace-avatar"

export function WorkshopOrgChartPage() {
    const {organization, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const [view, setView] = useState("roles")
    const [query, setQuery] = useState("")
    const [teamFilter, setTeamFilter] = useState("all")
    const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())
    const [person, setPerson] = useState<WorkshopMember | null>(null)
    const directoryData = useOrganizationDirectoryData(organization.id, isPersistedOrganization)
    const stats = directoryStats(organization)
    const unassigned = organization.members.filter(member => !directoryMemberTeams(organization, member.id).length)
    const baseGroups = view === "roles" ? directoryRoleGroups(organization) : [
        ...[...organization.teams].sort((a, b) => a.name.localeCompare(b.name)).map(team => ({
            id: team.id, name: team.name, color: team.color, members: directoryTeamMembers(organization, team), leaderId: team.leaderId,
        })),
        ...(unassigned.length ? [{id: "directory-unassigned", name: "No team assigned", color: "var(--muted-foreground)", members: unassigned, leaderId: undefined}] : []),
    ]
    const search = query.trim().toLowerCase()
    const groups = baseGroups.filter(group => view === "roles" || teamFilter === "all" || group.id === (teamFilter === "unassigned" ? "directory-unassigned" : teamFilter)).map(group => ({...group, members: group.members.filter(member =>
        (teamFilter === "all" || (teamFilter === "unassigned" ? !directoryMemberTeams(organization, member.id).length : directoryMemberTeams(organization, member.id).some(team => team.id === teamFilter))) &&
        (!search || group.name.toLowerCase().includes(search) || directoryMemberMatches(member, search) || directoryMemberTeams(organization, member.id).some(team => team.name.toLowerCase().includes(search))))
    })).filter(group => group.members.length)
    const visiblePeople = new Set(groups.flatMap(group => group.members.map(member => member.id))).size
    const allCollapsed = groups.length > 0 && groups.every(group => collapsed.has(group.id))

    return <div className="workshop-page organization-directory directory-chart-page">
        <DirectoryHeading organization={organization} chart/>
        <div className="directory-chart-controls">
            <div className="directory-segment directory-chart-grouping" aria-label="Chart grouping">
                <button type="button" aria-pressed={view === "roles"} onClick={() => {setView("roles"); setCollapsed(new Set())}}><Layers/> By role</button>
                <button type="button" aria-pressed={view === "teams"} onClick={() => {setView("teams"); setCollapsed(new Set())}}><Users/> By team</button>
            </div>
            <DirectorySearch label="Search organization chart" placeholder="Find a person, role or team…" value={query} onChange={value => {setQuery(value); setCollapsed(new Set())}}/>
            <Select value={teamFilter} onValueChange={setTeamFilter}><SelectTrigger aria-label="Filter by team"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">All people</SelectItem>{organization.teams.map(team => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}<SelectItem value="unassigned">No team assigned</SelectItem></SelectContent></Select>
        </div>
        {directoryData.isError && <div className="directory-error" role="alert">Some organization data could not be refreshed. <Button variant="outline" size="sm" onClick={directoryData.retry}>Try again</Button></div>}
        <section className="directory-chart" aria-label={view === "roles" ? "Role hierarchy" : "Team structure"}>
            <div className="directory-chart-meta"><span><Network/>{view === "roles" ? "Role hierarchy" : "Team structure"}</span><span role="status">{visiblePeople} of {organization.members.length} people</span><Button variant="ghost" size="sm" disabled={!groups.length} onClick={() => setCollapsed(allCollapsed ? new Set() : new Set(groups.map(group => group.id)))}>{allCollapsed ? "Expand all" : "Collapse all"}</Button></div>
            {directoryData.isLoading ? <div className="directory-loading" role="status"><LoaderCircle className="animate-spin"/> Loading organization…</div> : <>
                <div className="directory-chart-root"><WorkspaceAvatar name={organization.name} avatarUrl={organization.avatarUrl} fallback={<Building2/>}/><div><small>Organization</small><h3>{organization.name}</h3><p>{organization.members.length} people <i/> {stats.teams} teams</p></div></div>
                {groups.length ? <div className="directory-chart-branches">{groups.map((group, index) => {
                    const isCollapsed = collapsed.has(group.id)
                    return <section className="directory-chart-branch" key={group.id} style={{"--directory-color": group.color} as CSSProperties}>
                        <button className="directory-branch-heading" type="button" aria-expanded={!isCollapsed} aria-controls={`directory-group-${group.id}`} onClick={() => setCollapsed(current => {const next = new Set(current); if (next.has(group.id)) next.delete(group.id); else next.add(group.id); return next})}>
                            {view === "roles" ? <span className="directory-branch-symbol">{String(index + 1).padStart(2, "0")}</span> : <WorkspaceAvatar className="directory-branch-symbol" name={group.name} avatarUrl={organization.teams.find(team => team.id === group.id)?.avatarUrl} fallback={<Users/>}/>}
                            <span><small>{view === "roles" ? "Role" : "Team"}</small><h4>{group.name}</h4></span>
                            <span className="directory-branch-count">{group.members.length} {group.members.length === 1 ? "person" : "people"}</span><ChevronDown className={isCollapsed ? "is-collapsed" : ""}/>
                        </button>
                        {!isCollapsed && <div className="directory-branch-people" id={`directory-group-${group.id}`}>{group.members.map(member => <DirectoryPerson key={member.id} member={member} organization={organization} leader={"leaderId" in group && member.id === group.leaderId} onClick={() => setPerson(member)}/>)}</div>}
                    </section>
                })}</div> : <DirectoryEmpty title={organization.members.length ? "No people found" : "Your organization starts here"} action={(query || teamFilter !== "all") ? <Button variant="outline" onClick={() => {setQuery(""); setTeamFilter("all")}}>Clear filters</Button> : undefined}>{organization.members.length ? "Try a different search or choose all people." : "Members will appear here as they join the organization."}</DirectoryEmpty>}
            </>}
        </section>
        <DirectoryPersonDialog member={person} organization={organization} onClose={() => setPerson(null)}/>
    </div>
}
