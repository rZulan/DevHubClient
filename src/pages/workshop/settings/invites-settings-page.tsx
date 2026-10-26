import {useState} from "react"
import {Link2, RefreshCw, ShieldCheck, Trash2} from "lucide-react"
import {useOutletContext} from "react-router-dom"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {useListOrganizationInvitesQuery, useRevokeOrganizationInviteMutation} from "@/services/api"
import type {ActiveOrganizationInvite} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"

const dateLabel = (value: string) => new Date(value).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})
export function InvitesSettingsPage() {
    const {organization, isPersistedOrganization, openInviteDialog} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id)
    const canCreate = isPersistedOrganization && hasWorkshopPermission(organization, userId, "Create invites")
    const canManage = hasWorkshopPermission(organization, userId, "Manage invites")
    const query = useListOrganizationInvitesQuery(organization.id, {skip: !canCreate, refetchOnMountOrArgChange: true})
    const [revoke, {isLoading: revoking}] = useRevokeOrganizationInviteMutation()
    const [confirming, setConfirming] = useState<ActiveOrganizationInvite | null>(null), [error, setError] = useState("")
    const invites = query.currentData ?? []
    async function confirmRevoke() {
        if (!confirming || !canCreate || revoking) return
        try {await revoke({organizationId: organization.id, inviteId: confirming.id}).unwrap(); setConfirming(null); setError("")}
        catch (failure) {setError(getApiErrorMessage(failure))}
    }
    return <div className="workshop-settings-page">
        <header className="workshop-settings-heading with-actions"><div><h2>Invitations</h2><p>{canManage ? "Review and revoke active invitation links for this organization." : "Review and revoke the active invitation links you created."}</p></div><Button disabled={!canCreate} onClick={openInviteDialog}><Link2/>Create invite</Button></header>
        {!canCreate ? <section className="workshop-settings-card"><p className="text-sm text-muted-foreground">{isPersistedOrganization ? "You need Create invites or Manage invites permission to access invitation links." : "Invitation management is available for organizations saved to your account."}</p></section>
            : <section className="workshop-settings-card"><header className="flex items-center justify-between gap-3"><h3>Active links ({invites.length})</h3><Button variant="ghost" size="sm" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw/>Refresh</Button></header>
                {query.isFetching && <p role="status" className="text-sm text-muted-foreground">Updating invitations…</p>}
                {query.isError && <p role="alert" className="workshop-form-error">Could not load invitations. Use Refresh to try again.</p>}
                {!query.isFetching && !query.isError && !invites.length && <div className="py-8 text-center text-sm text-muted-foreground"><ShieldCheck className="mx-auto mb-3 size-6"/>No active invitation links.</div>}
                <div className="divide-y divide-border">{invites.map(invite => {
                    const creator = organization.members.find(member => member.id === invite.createdByUserId)
                    return <article key={invite.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="grid gap-1 text-sm"><strong>{creator?.nickname || creator?.name || "Former member"}{invite.createdByUserId === userId ? " · You" : ""}</strong><span className="text-xs text-muted-foreground">Created {dateLabel(invite.createdAtUtc)}</span><span className="text-xs text-muted-foreground">Expires {dateLabel(invite.expiresAtUtc)}</span></div><Button variant="outline" size="sm" disabled={revoking} onClick={() => {setError(""); setConfirming(invite)}}><Trash2/>Revoke</Button></article>
                })}</div>{invites.length === 100 && <p className="text-xs text-muted-foreground">Showing the 100 most recent active links.</p>}
            </section>}
        <Dialog open={!!confirming} onOpenChange={open => {if (!open && !revoking) setConfirming(null)}}><DialogContent><DialogHeader><DialogTitle>Revoke invitation link?</DialogTitle><DialogDescription>This link will no longer let people join {organization.name}. Existing members keep their access. You can create a new link whenever needed.</DialogDescription></DialogHeader>{error && <p role="alert" className="workshop-form-error">{error}</p>}<DialogFooter><Button variant="outline" disabled={revoking} onClick={() => setConfirming(null)}>Cancel</Button><Button variant="destructive" disabled={revoking} onClick={() => void confirmRevoke()}>{revoking ? "Revoking…" : "Revoke link"}</Button></DialogFooter></DialogContent></Dialog>
    </div>
}
