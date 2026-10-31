import type {CSSProperties, ReactNode} from "react"
import {ArrowUpRight, Crown, FolderKanban, Network, Search, Users, X} from "lucide-react"
import {Link} from "react-router-dom"
import {Avatar, AvatarFallback, AvatarImage} from "@/components/ui/avatar"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {directoryMemberTeams, directoryStats} from "./organization-directory"
import type {WorkshopMember, WorkshopOrganization} from "./workshop-types"
import "./organization-directory.css"
import {WorkspaceAvatar} from "./workspace-avatar"

export function DirectoryHeading({organization, chart = false, children}: {organization: WorkshopOrganization; chart?: boolean; children?: ReactNode}) {
    return <header className="directory-heading">
        <h2>{chart ? "Organization chart" : "Teams"}</h2>
        <div className="directory-heading-actions">
            <Link className="directory-text-link" to={`/workshop/${organization.id}/${chart ? "teams" : "org-chart"}`}>
                {chart ? <Users/> : <Network/>}{chart ? "View teams" : "View org chart"}<ArrowUpRight/>
            </Link>{children}
        </div>
    </header>
}

export function DirectorySummary({organization}: {organization: WorkshopOrganization}) {
    const stats = directoryStats(organization)
    return <dl className="directory-summary" aria-label="Organization overview">
        {[
            {label: "Teams", value: stats.teams, icon: Users},
            {label: "Team leaders", value: stats.leaders, icon: Crown},
            {label: "People in teams", value: stats.assigned, icon: Network},
            {label: "Team projects", value: stats.projects, icon: FolderKanban},
        ].map(({label, value, icon: Icon}) => <div key={label}><dt><Icon/>{label}</dt><dd>{value}</dd></div>)}
    </dl>
}

export function DirectorySearch({value, onChange, label, placeholder}: {value: string; onChange: (value: string) => void; label: string; placeholder: string}) {
    return <div className="directory-search"><Search aria-hidden="true"/>
        <Input aria-label={label} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)}/>
        {value && <button type="button" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => onChange("")}><X/></button>}
    </div>
}

export function DirectoryAvatar({member, small = false}: {member?: WorkshopMember; small?: boolean}) {
    return <Avatar size={small ? "sm" : "default"} className="directory-avatar" title={member?.name}>
        {member?.avatarUrl && <AvatarImage alt={member.name} src={member.avatarUrl} referrerPolicy="no-referrer"/>}
        <AvatarFallback>{member?.initials || "?"}</AvatarFallback>
    </Avatar>
}

export function DirectoryPerson({member, organization, leader = false, onClick}: {member: WorkshopMember; organization: WorkshopOrganization; leader?: boolean; onClick: () => void}) {
    const teams = directoryMemberTeams(organization, member.id)
    return <button className="directory-person" type="button" onClick={onClick} aria-label={`View ${member.name}`}>
        <DirectoryAvatar member={member}/><span className="directory-person-copy"><strong>{member.name}</strong><small>@{member.username}</small>
            <span>{leader ? <><Crown/> Team leader</> : teams.length ? teams.map(team => team.name).join(" · ") : "No team assigned"}</span>
        </span><ArrowUpRight className="directory-person-arrow"/>
    </button>
}

export function DirectoryPersonDialog({member, organization, onClose}: {member: WorkshopMember | null; organization: WorkshopOrganization; onClose: () => void}) {
    if (!member) return null
    const teams = directoryMemberTeams(organization, member.id)
    const roleIds = new Set([member.roleId, ...member.roleIds ?? []])
    const roles = organization.roles.filter(role => roleIds.has(role.id) || (member.isOwner && role.isOwnerRole)).sort((a, b) => a.order - b.order)
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}>
        <DialogContent className="workshop-modal directory-modal directory-profile">
            <DirectoryAvatar member={member}/>
            <DialogHeader><DialogTitle>{member.name}</DialogTitle><DialogDescription>@{member.username}</DialogDescription></DialogHeader>
            <section><h3>Organization roles</h3><div className="directory-tags">{roles.length ? roles.map(role => <span key={role.id} style={{"--directory-color": role.color} as CSSProperties}><i/>{role.name}</span>) : <p>No role assigned</p>}</div></section>
            <section><h3>Teams <span>{teams.length}</span></h3><div className="directory-profile-teams">{teams.length ? teams.map(team => <div key={team.id}><WorkspaceAvatar name={team.name} avatarUrl={team.avatarUrl} fallback={<Users/>}/><strong>{team.name}</strong>{team.leaderId === member.id && <small><Crown/> Leader</small>}</div>) : <p>No team assigned yet.</p>}</div></section>
            {member.status && <p className="directory-profile-status">{member.status}</p>}
            <Button variant="outline" onClick={onClose}>Done</Button>
        </DialogContent>
    </Dialog>
}

export function DirectoryEmpty({title, children, action}: {title: string; children: ReactNode; action?: ReactNode}) {
    return <section className="directory-empty"><span><Users/></span><h3>{title}</h3><p>{children}</p>{action}</section>
}
