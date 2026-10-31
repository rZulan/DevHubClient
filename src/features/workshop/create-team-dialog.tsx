import {type FormEvent, useEffect, useRef, useState} from "react"
import {Crown, LoaderCircle, Plus} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from "@/components/ui/select"
import {Textarea} from "@/components/ui/textarea"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {DirectoryAvatar, DirectorySearch} from "./organization-directory-ui"
import {directoryMemberMatches} from "./organization-directory"
import {useWorkshop} from "./workshop-context"
import {createClientId} from "@/lib/create-client-id"
import type {WorkshopMember, WorkshopOrganization, WorkshopTeam} from "./workshop-types"
import {useAddTeamMemberMutation, useCreateTeamMutation} from "@/services/api"

const teamColors = ["#a78bfa", "#38bdf8", "#fb7185", "#34d399", "#fbbf24"]
const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function CreateTeamDialog({defaultLeaderId, members, onOpenChange, open, organization, teams}: {
    defaultLeaderId?: string; members: WorkshopMember[]; onOpenChange: (open: boolean) => void;
    open: boolean; organization: WorkshopOrganization; teams: WorkshopTeam[];
}) {
    const {addTeam} = useWorkshop()
    const initialLeaderId = members.find(member => member.id === defaultLeaderId)?.id ?? members[0]?.id ?? ""
    const [leaderId, setLeaderId] = useState(initialLeaderId)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
    const [query, setQuery] = useState("")
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)
    const [createdId, setCreatedId] = useState<string | null>(null)
    const addedIds = useRef(new Set<string>())
    const [createTeam] = useCreateTeamMutation()
    const [addTeamMember] = useAddTeamMemberMutation()
    const isPersisted = guidPattern.test(organization.id)

    useEffect(() => {
        if (!open) return
        setError(""); setQuery(""); setLeaderId(initialLeaderId); setSelectedIds(new Set()); setCreatedId(null)
        addedIds.current = new Set()
    }, [initialLeaderId, open])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        const form = new FormData(event.currentTarget)
        const name = String(form.get("name") ?? "").trim()
        const description = String(form.get("description") ?? "").trim()
        if (!createdId && (name.length < 2 || !leaderId)) {setError("Add a team name and choose one team leader."); return}
        setBusy(true); setError("")
        const memberIds = [...new Set([...selectedIds, leaderId])]
        try {
            if (isPersisted) {
                let teamId = createdId
                if (!teamId) {
                    const created = await createTeam({organizationId: organization.id, name, description, leaderUserId: leaderId}).unwrap()
                    teamId = created.id; setCreatedId(teamId); addedIds.current.add(leaderId)
                }
                const targetTeamId = teamId
                const results = await Promise.allSettled(memberIds.filter(id => !addedIds.current.has(id)).map(async userId => {
                    await addTeamMember({organizationId: organization.id, teamId: targetTeamId, userId}).unwrap()
                    addedIds.current.add(userId)
                }))
                const failed = results.find(result => result.status === "rejected")
                if (failed?.status === "rejected") {setError(`Your team was created, but some people could not be added. ${getApiErrorMessage(failed.reason)} Retry to finish adding them.`); return}
            } else {
                addTeam(organization.id, {id: createClientId(), name, description, color: teamColors[teams.length % teamColors.length], leaderId, memberIds, memberCount: memberIds.length})
            }
            onOpenChange(false)
        } catch (submitError) {setError(getApiErrorMessage(submitError))}
        finally {setBusy(false)}
    }

    const roster = members.filter(member => directoryMemberMatches(member, query))
    return <Dialog open={open} onOpenChange={next => {if (!busy) onOpenChange(next)}}>
        {open && <DialogContent className="workshop-modal directory-modal directory-team-editor" showCloseButton={!busy}>
            <DialogHeader><DialogTitle>Create a team</DialogTitle><DialogDescription>Give your team a purpose, choose a leader, and bring your people together.</DialogDescription></DialogHeader>
            <form onSubmit={submit}>
                <fieldset className="directory-editor-fields" disabled={busy || Boolean(createdId)}>
                    <Label>Team name<Input autoFocus name="name" required minLength={2} maxLength={150} placeholder="e.g. Platform Engineering"/></Label>
                    <Label>Description <Textarea name="description" maxLength={1000} rows={3} placeholder="What is this team responsible for?"/></Label>
                    <Label>Team leader<Select value={leaderId} onValueChange={setLeaderId} disabled={busy || Boolean(createdId)}><SelectTrigger className="w-full"><SelectValue placeholder="Choose a team leader"/></SelectTrigger><SelectContent>{members.map(member => <SelectItem key={member.id} value={member.id}>{member.name} · @{member.username}</SelectItem>)}</SelectContent></Select></Label>
                    <div className="directory-picker-heading"><h3>Team members</h3><span>{new Set([...selectedIds, leaderId].filter(Boolean)).size} selected · leader included</span></div>
                    <DirectorySearch label="Search members" placeholder="Find a person…" value={query} onChange={setQuery}/>
                    <div className="directory-member-picker">{roster.map(member => <Label key={member.id}><Checkbox disabled={busy || Boolean(createdId) || member.id === leaderId} checked={member.id === leaderId || selectedIds.has(member.id)} onCheckedChange={checked => setSelectedIds(current => {const next = new Set(current); if (checked === true) next.add(member.id); else next.delete(member.id); return next})}/><DirectoryAvatar member={member} small/><span><strong>{member.name}</strong><small>@{member.username}</small></span>{member.id === leaderId && <Crown/>}</Label>)}{!roster.length && <p>No people match your search.</p>}</div>
                </fieldset>
                {error && <p className="directory-form-error" role="alert">{error}</p>}
                <div className="directory-modal-actions"><Button variant="outline" type="button" disabled={busy} onClick={() => onOpenChange(false)}>{createdId ? "Close" : "Cancel"}</Button><Button type="submit" disabled={busy || !members.length}>{busy ? <LoaderCircle className="animate-spin"/> : <Plus/>}{createdId ? "Retry adding members" : "Create team"}</Button></div>
            </form>
        </DialogContent>}
    </Dialog>
}
