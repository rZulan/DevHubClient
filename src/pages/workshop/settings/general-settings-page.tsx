import {type FormEvent, useEffect, useState} from "react"
import {AlertTriangle, Check, FolderKanban, LoaderCircle, LogOut, ShieldCheck, Trash2, Users} from "lucide-react"
import {useNavigate, useOutletContext} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useWorkshop} from "@/features/workshop/workshop-context"
import {clearSelectedOrganizationId} from "@/features/workshop/workshop-storage"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {organizationProfileDraft, syncOrganizationProfileDraft} from "@/features/workshop/organization-profile-draft"
import {
    useDeleteOrganizationMutation,
    useLeaveOrganizationMutation,
    useListOrganizationsQuery,
    useUpdateOrganizationMutation,
} from "@/services/api"

export function GeneralSettingsPage() {
    const {organization, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const currentUserId = useAppSelector((state) => state.auth.user?.id)
    const navigate = useNavigate()
    const {removeLocalOrganization} = useWorkshop()
    // The workshop model substitutes placeholder copy for a missing description; edit the stored value.
    const profileQuery = useListOrganizationsQuery(undefined, {skip: !isPersistedOrganization})
    const savedDescription = isPersistedOrganization ? profileQuery.data ? profileQuery.data.find(candidate => candidate.id === organization.id)?.description ?? "" : undefined : organization.description
    const [profile, setProfile] = useState(() => organizationProfileDraft(organization.id, organization.name, savedDescription ?? ""))
    const {name, description} = profile
    useEffect(() => {if (savedDescription !== undefined) setProfile(current => syncOrganizationProfileDraft(current, organization.id, organization.name, savedDescription))}, [organization.id, organization.name, savedDescription])
    const [savedAt, setSavedAt] = useState(0)
    const [error, setError] = useState("")
    const [deleteOpen, setDeleteOpen] = useState(false)
    const [confirmation, setConfirmation] = useState("")
    const [leaveOpen, setLeaveOpen] = useState(false)
    const [updateOrganization, {isLoading: isSaving}] = useUpdateOrganizationMutation()
    const [leaveOrganization, {isLoading: isLeaving}] = useLeaveOrganizationMutation()
    const [deleteOrganization, {isLoading: isDeleting}] = useDeleteOrganizationMutation()

    const canEdit = isPersistedOrganization && savedDescription !== undefined && hasWorkshopPermission(organization, currentUserId, "Manage organization")
    const currentMember = organization.members.find((member) => member.id === currentUserId)
    const ownerCount = organization.members.filter((member) => member.isOwner).length
    const leadsTeam = organization.teams.some(team => team.leaderId === currentUserId)
    const canLeave = isPersistedOrganization && !!currentMember && (currentMember.isOwner ? ownerCount > 1 : !leadsTeam)
    const canDelete = isPersistedOrganization && Boolean(currentMember?.isOwner)
    const isDirty = name.trim() !== profile.savedName || description.trim() !== profile.savedDescription
    const initials = name.trim().split(/\s+/).map((word) => word[0]).join("").slice(0, 2).toUpperCase() || organization.initials

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canEdit || isSaving) return
        setError("")
        if (name.trim().length < 2) {
            setError("Give your organization a name with at least 2 characters.")
            return
        }
        try {
            const saved = await updateOrganization({
                organizationId: organization.id,
                name: name.trim(),
                description: description.trim()
            }).unwrap()
            setProfile(organizationProfileDraft(organization.id, saved.name, saved.description ?? ""))
            setSavedAt(Date.now())
        } catch (saveError) {
            setError(getApiErrorMessage(saveError))
        }
    }

    function exitOrganization() {
        removeLocalOrganization(organization.id)
        clearSelectedOrganizationId()
        navigate("/workshop?choose=1", {replace: true})
    }

    async function leave() {
        if (!canLeave || isLeaving) return
        setError("")
        try {
            await leaveOrganization(organization.id).unwrap()
            exitOrganization()
        } catch (leaveError) {
            setError(getApiErrorMessage(leaveError))
        }
    }

    async function remove() {
        if (!canDelete || confirmation !== organization.name || isDeleting) return
        try {
            await deleteOrganization(organization.id).unwrap()
            setDeleteOpen(false)
            exitOrganization()
        } catch (deleteError) {
            setError(getApiErrorMessage(deleteError))
            setDeleteOpen(false)
        }
    }

    return (
        <div className="workshop-settings-page">
            <header className="workshop-settings-heading">
                <h2>General</h2>
            </header>

            <section className="workshop-settings-card">
                <header>
                    <h3>Organization profile</h3>
                    {!canEdit && <p>{!isPersistedOrganization ? "Profile editing is available for organizations saved to your account." : savedDescription === undefined ? "Loading the saved profile…" : "You need the Manage organization permission to edit these details."}</p>}
                </header>
                <form className="workshop-settings-form" onSubmit={save}>
                    <div className="workshop-settings-identity">
                        <span className="workshop-org-mark" aria-hidden="true">{initials}</span>
                        <Label>Organization name
                            <Input disabled={!canEdit || isSaving} maxLength={150} onChange={(event) => {
                                setProfile(current => ({...current, name: event.target.value}));
                                setSavedAt(0)
                            }} required value={name}/>
                        </Label>
                    </div>
                    <Label><span>Description <small>Optional</small></span>
                        <Textarea disabled={!canEdit || isSaving} maxLength={1000} onChange={(event) => {
                            setProfile(current => ({...current, description: event.target.value}));
                            setSavedAt(0)
                        }} placeholder="What are you building together?" rows={3} value={description}/>
                    </Label>
                    {canEdit && (
                        <footer>
                            {savedAt > 0 && !isDirty &&
                                <small className="workshop-settings-saved"><Check/> Saved</small>}
                            <Button disabled={!isDirty || isSaving} onClick={() => {
                                setProfile(organizationProfileDraft(organization.id, organization.name, savedDescription ?? ""))
                            }} type="button" variant="ghost">Reset</Button>
                            <Button disabled={!isDirty || isSaving} type="submit">{isSaving ?
                                <LoaderCircle className="animate-spin"/> : <Check/>} Save changes</Button>
                        </footer>
                    )}
                </form>
            </section>

            <section className="workshop-settings-stats" aria-label="Organization overview">
                <div><Users/><span><strong>{organization.members.length}</strong><small>Members</small></span></div>
                <div><ShieldCheck/><span><strong>{organization.roles.length}</strong><small>Roles</small></span></div>
                <div><Users/><span><strong>{organization.teams.length}</strong><small>Teams</small></span></div>
                <div><FolderKanban/><span><strong>{organization.projects.length}</strong><small>Projects</small></span>
                </div>
            </section>

            {profileQuery.isError && isPersistedOrganization && <p role="alert" className="workshop-form-error">Could not load the saved organization profile. <button type="button" onClick={() => void profileQuery.refetch()}>Retry</button></p>}
            {error && <p role="alert" className="workshop-form-error">{error}</p>}

            <section className="workshop-settings-card danger">
                <header>
                    <h3><AlertTriangle/> Danger zone</h3>
                </header>
                <div className="workshop-settings-row">
                    <div><strong>Leave organization</strong>{currentMember?.isOwner && ownerCount <= 1 ? <p className="mt-1 text-xs text-muted-foreground">Promote another owner in Members before leaving.</p> : leadsTeam && !currentMember?.isOwner ? <p className="mt-1 text-xs text-muted-foreground">Reassign your team leadership before leaving.</p> : null}</div>
                    <Button disabled={!canLeave || isLeaving}
                            title={currentMember?.isOwner && ownerCount <= 1 ? "Promote another owner before leaving" : undefined}
                            onClick={() => setLeaveOpen(true)} type="button" variant="outline">{isLeaving ?
                        <LoaderCircle className="animate-spin"/> : <LogOut/>} Leave</Button>
                </div>
                <div className="workshop-settings-row">
                    <strong>Delete organization</strong>
                    <Button disabled={!canDelete}
                            title={canDelete ? undefined : "Only owners can delete the organization"} onClick={() => {
                        setConfirmation("");
                        setDeleteOpen(true)
                    }} type="button" variant="destructive"><Trash2/> Delete</Button>
                </div>
            </section>

            <Dialog open={leaveOpen} onOpenChange={open => {if (!isLeaving) setLeaveOpen(open)}}><DialogContent><DialogHeader><DialogTitle>Leave {organization.name}?</DialogTitle><DialogDescription>You will lose access to this organization, its teams, and its projects. An invitation is needed to join again.</DialogDescription></DialogHeader>{error && <p role="alert" className="workshop-form-error">{error}</p>}<div className="workshop-settings-dialog-actions"><Button variant="outline" disabled={isLeaving} onClick={() => setLeaveOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!canLeave || isLeaving} onClick={() => void leave()}>{isLeaving ? "Leaving…" : "Leave organization"}</Button></div></DialogContent></Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                {deleteOpen && (
                    <DialogContent className="workshop-modal sm:max-w-md">
                        <span className="workshop-modal-icon danger"><Trash2/></span>
                        <DialogHeader>
                            <DialogTitle>Delete {organization.name}?</DialogTitle>
                            <DialogDescription>This permanently deletes the organization for
                                all {organization.members.length} members. It cannot be undone.</DialogDescription>
                        </DialogHeader>
                        <form onSubmit={(event) => {
                            event.preventDefault();
                            if (confirmation === organization.name) void remove()
                        }}>
                            <Label>Type <b>{organization.name}</b> to confirm
                                <Input autoComplete="off" autoFocus
                                       onChange={(event) => setConfirmation(event.target.value)} value={confirmation}/>
                            </Label>
                            <Button disabled={confirmation !== organization.name || isDeleting} type="submit"
                                    variant="destructive">
                                {isDeleting ? <LoaderCircle className="animate-spin"/> : <Trash2/>} Delete organization
                            </Button>
                        </form>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    )
}
