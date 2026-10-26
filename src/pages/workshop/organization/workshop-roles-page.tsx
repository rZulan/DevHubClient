import {type FormEvent, useEffect, useMemo, useState} from "react"
import {ArrowDown, ArrowUp, Check, Crown, LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, Users,} from "lucide-react"
import {useOutletContext} from "react-router-dom"

import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Checkbox} from "@/components/ui/checkbox"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {
    canAssignWorkshopRole,
    canManageWorkshopRole,
    hasWorkshopPermission,
} from "@/features/workshop/workshop-access"
import type {WorkshopMember, WorkshopPermission, WorkshopRole,} from "@/features/workshop/workshop-types"
import {OwnerPromotionDialog} from "@/features/workshop/owner-promotion-dialog"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {availablePermissions, permissionGroups, permissionDescriptions, permissionLabels, impliedPermissionSources} from "@/features/workshop/workshop-permissions"
import {
    useAssignOrganizationRoleMutation,
    useCreateOrganizationRoleMutation,
    useDeleteOrganizationRoleMutation,
    useMoveOrganizationRoleMutation,
    usePromoteOrganizationOwnerMutation,
    useUpdateOrganizationRoleMutation,
} from "@/services/api"

export function WorkshopRolesPage() {
    const {organization, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const currentUserId = useAppSelector((state) => state.auth.user?.id)
    const [editingRole, setEditingRole] = useState<WorkshopRole | null>(null)
    const [isCreating, setIsCreating] = useState(false)
    const [error, setError] = useState("")
    const [createRole, {isLoading: isCreatingRole}] = useCreateOrganizationRoleMutation()
    const [updateRole, {isLoading: isUpdatingRole}] = useUpdateOrganizationRoleMutation()
    const [deleteRole, {isLoading: isDeletingRole}] = useDeleteOrganizationRoleMutation()
    const [moveRoleRequest, {isLoading: isMovingRole}] = useMoveOrganizationRoleMutation()
    const [assignRole, {isLoading: isAssigning}] = useAssignOrganizationRoleMutation()
    const [promoteOwner, {isLoading: isPromoting}] = usePromoteOrganizationOwnerMutation()
    const [deletingRole, setDeletingRole] = useState<WorkshopRole | null>(null)
    const [ownerCandidate, setOwnerCandidate] = useState<WorkshopMember | null>(null)
    const busy = isCreatingRole || isUpdatingRole || isDeletingRole || isMovingRole || isAssigning || isPromoting
    const canCreateRoles = isPersistedOrganization && hasWorkshopPermission(organization, currentUserId, "Manage roles")
    const roles = useMemo(
        () => [...organization.roles].sort((left, right) => left.order - right.order),
        [organization.roles],
    )

    async function moveRole(role: WorkshopRole, direction: -1 | 1) {
        const movableRoles = roles.filter((candidate) => !candidate.isOwnerRole && !candidate.isDefaultRole)
        const index = movableRoles.findIndex((candidate) => candidate.id === role.id)
        const target = movableRoles[index + direction]
        if (busy || !target || !canManageWorkshopRole(organization, currentUserId, role) || !canManageWorkshopRole(organization, currentUserId, target)) return
        setError("")
        try {
            await moveRoleRequest({organizationId: organization.id, roleId: role.id, direction}).unwrap()
        } catch (moveError) {
            setError(getApiErrorMessage(moveError))
        }
    }

    async function toggleMember(role: WorkshopRole, memberId: string, assigned: boolean) {
        setError("")
        try {
            if (role.isOwnerRole) {
                if (assigned) {
                    setOwnerCandidate(organization.members.find(member => member.id === memberId) ?? null)
                }
                return
            }

            await assignRole({
                organizationId: organization.id,
                roleId: role.id,
                userId: memberId,
                assigned,
            }).unwrap()
        } catch {
            setError("That role assignment was blocked by the role hierarchy.")
        }
    }

    async function removeRole(role: WorkshopRole) {
        if (busy || !canManageWorkshopRole(organization, currentUserId, role)) return
        setError("")
        try {
            await deleteRole({organizationId: organization.id, roleId: role.id}).unwrap()
            setEditingRole(null)
            setDeletingRole(null)
        } catch {
            setError("This role could not be deleted. Protected roles and higher roles cannot be removed.")
        }
    }

    return (
        <div className="workshop-settings-page">
            <header className="workshop-settings-heading with-actions">
                <div>
                    <h2>Roles & access</h2>
                    <p>Roles grant permissions and set the hierarchy for managing members.</p>
                </div>
                {canCreateRoles && <Button onClick={() => {
                    setError("");
                    setIsCreating(true)
                }} type="button"><Plus/> Create role</Button>}
            </header>

            <div className="workshop-role-summary">
                <div><ShieldCheck/><span><strong>{roles.length}</strong><small>Organization roles</small></span></div>
                <div><Users/><span><strong>{organization.members.length}</strong><small>Assigned members</small></span>
                </div>
                <div>
                    <LockKeyhole/><span><strong>{availablePermissions.length}</strong><small>Available permissions</small></span>
                </div>
            </div>

            <p className="workshop-role-drag-hint"><LockKeyhole/> The Org Owner role is always highest. Custom roles
                follow their displayed hierarchy.</p>
            {error && <p className="workshop-form-error">{error}</p>}
            <div className="workshop-role-list">
                {roles.map((role) => {
                    const members = organization.members.filter((member) =>
                        (member.roleIds ?? [member.roleId]).includes(role.id),
                    )
                    const manageable = isPersistedOrganization && canManageWorkshopRole(organization, currentUserId, role)
                    const movableRoles = roles.filter((candidate) => !candidate.isOwnerRole && !candidate.isDefaultRole)
                    const movableIndex = movableRoles.findIndex((candidate) => candidate.id === role.id)
                    return (
                        <article key={role.id} style={{"--role-color": role.color} as React.CSSProperties}>
                            {role.isOwnerRole ? <Crown className="workshop-role-grip"/> :
                                <ShieldCheck className="workshop-role-grip"/>}
                            <div className="workshop-role-copy">
                                <header>
                                    <span/>
                                    <div><h3>{role.name}</h3>
                                        <p>{role.isOwnerRole ? "Highest protected role" : `Hierarchy level ${role.order + 1}`}</p>
                                    </div>
                                    <b>{members.length} member{members.length === 1 ? "" : "s"}</b>
                                </header>
                                <div className="workshop-permission-tags">
                                    {role.permissions.map((permission) => <span
                                        key={permission}><Check/> {permissionLabels[permission] ?? permission}</span>)}
                                    {!role.permissions.length && <small>No elevated permissions</small>}
                                </div>
                            </div>
                            <div className="workshop-role-members">
                                {members.slice(0, 4).map((member) => <span key={member.id}>{member.avatarUrl ?
                                    <img alt={member.name} referrerPolicy="no-referrer"
                                         src={member.avatarUrl}/> : member.initials}</span>)}
                            </div>
                            {manageable && <div className="workshop-role-order-actions">
                                {!role.isOwnerRole && !role.isDefaultRole && <>
                                    <Button aria-label={`Move ${role.name} up`} disabled={busy || movableIndex <= 0 || !canManageWorkshopRole(organization, currentUserId, movableRoles[movableIndex - 1])}
                                            onClick={() => void moveRole(role, -1)} size="icon-xs" type="button"
                                            variant="ghost"><ArrowUp/></Button>
                                    <Button aria-label={`Move ${role.name} down`}
                                            disabled={busy || movableIndex < 0 || movableIndex >= movableRoles.length - 1 || !canManageWorkshopRole(organization, currentUserId, movableRoles[movableIndex + 1])}
                                            onClick={() => void moveRole(role, 1)} size="icon-xs" type="button"
                                            variant="ghost"><ArrowDown/></Button>
                                </>}
                                <Button aria-label={`Manage ${role.name}`} onClick={() => {
                                    setError("");
                                    setEditingRole(role)
                                }} size="icon" type="button" variant="ghost"><Pencil/></Button>
                            </div>}
                        </article>
                    )
                })}
            </div>

            <OwnerPromotionDialog member={ownerCandidate} organizationName={organization.name} onClose={() => setOwnerCandidate(null)} onConfirm={async () => {if (ownerCandidate) await promoteOwner({organizationId: organization.id, userId: ownerCandidate.id}).unwrap()}}/>

            <RoleDialog
                busy={isCreatingRole}
                currentUserId={currentUserId}
                onClose={() => setIsCreating(false)}
                onSave={async (draft) => {
                    setError("")
                    try {
                        await createRole({organizationId: organization.id, role: draft}).unwrap()
                        setIsCreating(false)
                    } catch (failure) {
                        setError(getApiErrorMessage(failure)); throw failure
                    }
                }}
                open={isCreating}
                organization={organization}
            />

            <RoleDialog
                busy={busy}
                members={editingRole ? organization.members : undefined}
                onClose={() => setEditingRole(null)}
                onDelete={editingRole && !editingRole.isOwnerRole && !editingRole.isDefaultRole
                    ? () => setDeletingRole(editingRole)
                    : undefined}
                onMemberChange={editingRole
                    ? (memberId, assigned) => void toggleMember(editingRole, memberId, assigned)
                    : undefined}
                onSave={async (draft) => {
                    if (!editingRole) return
                    setError("")
                    try {
                        await updateRole({
                            organizationId: organization.id,
                            roleId: editingRole.id,
                            role: {...draft, position: editingRole.order},
                        }).unwrap()
                        setEditingRole(null)
                    } catch (failure) {
                        setError(getApiErrorMessage(failure)); throw failure
                    }
                }}
                open={Boolean(editingRole)}
                organization={organization}
                currentUserId={currentUserId}
                role={editingRole ?? undefined}
            />

            <Dialog open={!!deletingRole} onOpenChange={open => {if (!open && !busy) setDeletingRole(null)}}><DialogContent><DialogHeader><DialogTitle>Delete {deletingRole?.name}?</DialogTitle><DialogDescription>This removes the role and its permissions from all assigned members. Their other roles remain. This cannot be undone.</DialogDescription></DialogHeader>{error && <p role="alert" className="workshop-form-error">{error}</p>}<div className="workshop-settings-dialog-actions"><Button variant="outline" disabled={busy} onClick={() => setDeletingRole(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => {if (deletingRole) void removeRole(deletingRole)}}>{isDeletingRole ? "Deleting…" : "Delete role"}</Button></div></DialogContent></Dialog>

        </div>
    )
}

type RoleDraft = {
    name: string
    color: string
    permissions: WorkshopPermission[]
}

function RoleDialog({
                        busy,
                        currentUserId,
                        members,
                        onClose,
                        onDelete,
                        onMemberChange,
                        onSave,
                        open,
                        organization,
                        role,
                    }: {
    busy: boolean
    currentUserId?: string
    members?: WorkshopOutletContext["organization"]["members"]
    onClose: () => void
    onDelete?: () => void
    onMemberChange?: (memberId: string, assigned: boolean) => void
    onSave: (draft: RoleDraft) => Promise<void>
    open: boolean
    organization?: WorkshopOutletContext["organization"]
    role?: WorkshopRole
}) {
    const [name, setName] = useState("")
    const [color, setColor] = useState("#f472b6")
    const [permissions, setPermissions] = useState<Set<WorkshopPermission>>(() => new Set())
    const [saveError, setSaveError] = useState("")

    useEffect(() => {
        if (!open) return
        setSaveError("")
        setName(role?.name ?? "")
        setColor(role?.color ?? "#f472b6")
        setPermissions(new Set(role?.isOwnerRole ? availablePermissions : role?.permissions.includes("Administrator") ? ["Administrator"] : role?.permissions ?? []))
    }, [open, role])

    const administrator = role?.isOwnerRole || permissions.has("Administrator")

    function canGrantPermission(permission: WorkshopPermission) {
        return Boolean(organization && hasWorkshopPermission(organization, currentUserId, permission))
    }

    function togglePermission(permission: WorkshopPermission, checked: boolean) {
        setPermissions((current) => {
            if (permission === "Administrator") {
                const next = new Set(current)
                if (checked) next.add(permission)
                else next.delete(permission)
                return next
            }
            const next = new Set(current)
            if (checked) next.add(permission)
            else next.delete(permission)
            return next
        })
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (busy) return
        setSaveError("")
        try {await onSave({name: name.trim(), color, permissions: [...permissions]})}
        catch (failure) {setSaveError(getApiErrorMessage(failure))}
    }

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => {
            if (!nextOpen && !busy) onClose()
        }}>
            {open && (
                <DialogContent className="workshop-modal workshop-role-modal sm:max-w-2xl">
                    <span className="workshop-modal-icon">{role?.isOwnerRole ? <Crown/> : <ShieldCheck/>}</span>
                    <DialogHeader>
                        <DialogTitle>{role ? `Manage ${role.name}` : "Create a custom role"}</DialogTitle>
                        <DialogDescription>
                            {role?.isOwnerRole
                                ? "The highest role is protected. Owners may rename it and promote additional owners."
                                : "Configure permissions and assign this role only to members below you."}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={submit}>
                        <div className="workshop-role-fields">
                            <Label>Role name<Input autoFocus disabled={busy} maxLength={100}
                                                   onChange={(event) => setName(event.target.value)} required
                                                   value={name}/></Label>
                            <Label>Color<Input disabled={role?.isOwnerRole || busy}
                                               onChange={(event) => setColor(event.target.value)} type="color"
                                               value={color}/></Label>
                        </div>
                        <fieldset>
                            <legend>Permissions</legend>
                            <p className="text-xs leading-relaxed text-muted-foreground">Members can view projects available to their teams. Tool editing permissions do not grant access to other teams’ projects.</p>
                            {permissionGroups.map(group => <div key={group.title} className="grid gap-2" role="group" aria-label={group.title}><h4 className="mt-3 text-xs font-semibold text-muted-foreground">{group.title}</h4>{group.permissions.map((permission) => {
                                const includedBy = (impliedPermissionSources[permission] ?? []).filter(source => permissions.has(source))
                                const locked = Boolean(
                                    role?.isOwnerRole ||
                                    (administrator && permission !== "Administrator") ||
                                    !canGrantPermission(permission),
                                ) || includedBy.length > 0
                                return (
                                    <Label key={permission}>
                                        <Checkbox
                                            checked={administrator || permissions.has(permission) || includedBy.length > 0}
                                            disabled={locked || busy}
                                            onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                                        />
                                        <span><strong>{permissionLabels[permission] ?? permission}</strong><small>{permissionDescriptions[permission]}{includedBy.length > 0 && ` Included through ${includedBy.map(source => permissionLabels[source] ?? source).join(", ")}.`}</small></span>
                                    </Label>
                                )
                            })}</div>)}
                        </fieldset>

                        {role && members && organization && (
                            <fieldset className="workshop-role-member-picker">
                                <legend>{role.isOwnerRole ? "Organization owners" : "Role members"}</legend>
                                {members.map((member) => {
                                    const assigned = (member.roleIds ?? [member.roleId]).includes(role.id)
                                    const canChange = role.isOwnerRole
                                        ? organization.members.find((candidate) => candidate.id === currentUserId)?.isOwner && !member.isOwner
                                        : !role.isDefaultRole &&
                                        canAssignWorkshopRole(organization, currentUserId, member.id, role)
                                    return (
                                        <Label key={member.id}>
                                            <Checkbox
                                                checked={assigned}
                                                disabled={!canChange || busy}
                                                onCheckedChange={(checked) => onMemberChange?.(member.id, checked === true)}
                                            />
                                            <span><strong>{member.name}</strong><small>@{member.username}{member.isOwner ? " · Owner" : ""}</small></span>
                                        </Label>
                                    )
                                })}
                            </fieldset>
                        )}

                        {saveError && <p role="alert" className="workshop-form-error">{saveError}</p>}
                        <div className="workshop-role-dialog-actions">
                            {onDelete && <Button disabled={busy} onClick={onDelete} type="button" variant="destructive"><Trash2/> Delete
                                role</Button>}
                            <Button className="workshop-primary-action" disabled={busy || !name.trim()} type="submit">
                                {role ? <Check/> : <Plus/>} {role ? "Save changes" : "Create role"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            )}
        </Dialog>
    )
}
