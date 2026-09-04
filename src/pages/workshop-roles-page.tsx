import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  ArrowDown,
  ArrowUp,
  Check,
  Crown,
  LogOut,
  LockKeyhole,
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  UserMinus,
  Users,
} from "lucide-react"
import { useNavigate, useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getApiErrorMessage } from "@/features/auth/api-error"
import {
  canManageWorkshopMember,
  canManageWorkshopRole,
  hasWorkshopPermission,
} from "@/features/workshop/workshop-access"
import { clearSelectedOrganizationId } from "@/features/workshop/workshop-storage"
import type {
  WorkshopPermission,
  WorkshopRole,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import {
  useAssignOrganizationRoleMutation,
  useCreateOrganizationRoleMutation,
  useDeleteOrganizationRoleMutation,
  useLeaveOrganizationMutation,
  useRemoveOrganizationMemberMutation,
  usePromoteOrganizationOwnerMutation,
  useUpdateOrganizationMutation,
  useUpdateOrganizationRoleMutation,
} from "@/services/api"

const availablePermissions = [
  "Administrator",
  "Manage organization",
  "Manage roles",
  "Manage members",
  "Create invites",
  "Manage teams",
  "View all projects",
  "Manage projects",
  "Manage tasks",
  "Edit ideation",
] as const satisfies readonly WorkshopPermission[]

const permissionDescriptions: Record<WorkshopPermission, string> = {
  Administrator: "Grants every regular permission without bypassing role hierarchy.",
  "Manage organization": "Edit the organization name, description, and settings.",
  "Manage roles": "Create and manage roles and assignments below this role.",
  "Manage members": "Remove organization members lower in the hierarchy.",
  "Create invites": "Create invitation links for new organization members.",
  "Manage teams": "Create, rename, delete, and change team membership or leadership.",
  "View all projects": "See projects owned by teams this member has not joined.",
  "Manage projects": "Create, edit, move, archive, and delete projects.",
  "Manage tasks": "Create, assign, move, edit, and delete project tasks.",
  "Edit ideation": "Create, edit, move, and delete ideation items.",
}

export function WorkshopRolesPage() {
  const { organization } = useOutletContext<WorkshopOutletContext>()
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const navigate = useNavigate()
  const [editingRole, setEditingRole] = useState<WorkshopRole | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState("")
  const [createRole, { isLoading: isCreatingRole }] = useCreateOrganizationRoleMutation()
  const [updateRole, { isLoading: isUpdatingRole }] = useUpdateOrganizationRoleMutation()
  const [deleteRole, { isLoading: isDeletingRole }] = useDeleteOrganizationRoleMutation()
  const [assignRole] = useAssignOrganizationRoleMutation()
  const [promoteOwner] = usePromoteOrganizationOwnerMutation()
  const [leaveOrganization, { isLoading: isLeaving }] = useLeaveOrganizationMutation()
  const [removeMember, { isLoading: isRemovingMember }] = useRemoveOrganizationMemberMutation()
  const [updateOrganization, { isLoading: isUpdatingOrganization }] = useUpdateOrganizationMutation()
  const canCreateRoles = hasWorkshopPermission(organization, currentUserId, "Manage roles")
  const canManageOrganization = hasWorkshopPermission(organization, currentUserId, "Manage organization")
  const canManageMembers = hasWorkshopPermission(organization, currentUserId, "Manage members")
  const roles = useMemo(
    () => [...organization.roles].sort((left, right) => left.order - right.order),
    [organization.roles],
  )
  const currentMember = organization.members.find((member) => member.id === currentUserId)
  const ownerCount = organization.members.filter((member) => member.isOwner).length
  const canLeave = !currentMember?.isOwner || ownerCount > 1

  async function moveRole(role: WorkshopRole, direction: -1 | 1) {
    const movableRoles = roles.filter((candidate) => !candidate.isOwnerRole && !candidate.isDefaultRole)
    const index = movableRoles.findIndex((candidate) => candidate.id === role.id)
    const target = movableRoles[index + direction]
    if (!target || !canManageWorkshopRole(organization, currentUserId, target)) return
    setError("")
    try {
      await Promise.all([
        updateRole({ organizationId: organization.id, roleId: role.id, role: { name: role.name, color: role.color, position: target.order, permissions: role.permissions } }).unwrap(),
        updateRole({ organizationId: organization.id, roleId: target.id, role: { name: target.name, color: target.color, position: role.order, permissions: target.permissions } }).unwrap(),
      ])
    } catch (moveError) {
      setError(getApiErrorMessage(moveError))
    }
  }

  async function leave() {
    setError("")
    try {
      await leaveOrganization(organization.id).unwrap()
      clearSelectedOrganizationId()
      navigate("/workshop", { replace: true })
    } catch (leaveError) {
      setError(getApiErrorMessage(leaveError))
    }
  }

  async function kickMember(memberId: string) {
    setError("")
    try {
      await removeMember({ organizationId: organization.id, userId: memberId }).unwrap()
    } catch (removeError) {
      setError(getApiErrorMessage(removeError))
    }
  }

  async function toggleMember(role: WorkshopRole, memberId: string, assigned: boolean) {
    setError("")
    try {
      if (role.isOwnerRole) {
        if (assigned) {
          await promoteOwner({ organizationId: organization.id, userId: memberId }).unwrap()
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
    setError("")
    try {
      await deleteRole({ organizationId: organization.id, roleId: role.id }).unwrap()
      setEditingRole(null)
    } catch {
      setError("This role could not be deleted. Protected roles and higher roles cannot be removed.")
    }
  }

  return (
    <div className="workshop-page">
      <section className="workshop-page-heading compact">
        <div>
          <span className="workshop-page-kicker">Workshop permissions</span>
          <h2>Roles & access</h2>
          <p>Permissions combine across assigned roles. A member can only manage roles and people below their highest role.</p>
        </div>
        <div className="workshop-heading-actions">
          {canManageOrganization && <Button onClick={() => setSettingsOpen(true)} type="button" variant="outline"><Settings /> Organization settings</Button>}
          {canCreateRoles && <Button className="workshop-page-action" onClick={() => { setError(""); setIsCreating(true) }} type="button"><Plus /> Create role</Button>}
        </div>
      </section>

      <div className="workshop-role-summary">
        <div><ShieldCheck /><span><strong>{roles.length}</strong><small>Organization roles</small></span></div>
        <div><Users /><span><strong>{organization.members.length}</strong><small>Assigned members</small></span></div>
        <div><LockKeyhole /><span><strong>{availablePermissions.length}</strong><small>Available permissions</small></span></div>
      </div>

      {canManageMembers && <section className="workshop-role-member-management">
        <h3>Member management</h3>
        <p>Only members below your highest role can be removed.</p>
        <div>{organization.members.map((member) => {
          const canRemove = canManageWorkshopMember(organization, currentUserId, member.id)
          return <article key={member.id}><span>{member.avatarUrl ? <img alt={member.name} referrerPolicy="no-referrer" src={member.avatarUrl} /> : member.initials}</span><div><strong>{member.name}</strong><small>@{member.username}{member.isOwner ? " · Owner" : ""}</small></div>{canRemove && <Button aria-label={`Remove ${member.name}`} disabled={isRemovingMember} onClick={() => void kickMember(member.id)} size="sm" type="button" variant="ghost"><UserMinus /> Remove</Button>}</article>
        })}</div>
      </section>}

      <p className="workshop-role-drag-hint"><LockKeyhole /> The Org Owner role is always highest. Custom roles follow their displayed hierarchy.</p>
      {error && <p className="workshop-form-error">{error}</p>}
      <div className="workshop-role-list">
        {roles.map((role) => {
          const members = organization.members.filter((member) =>
            (member.roleIds ?? [member.roleId]).includes(role.id),
          )
          const manageable = canManageWorkshopRole(organization, currentUserId, role)
          const movableRoles = roles.filter((candidate) => !candidate.isOwnerRole && !candidate.isDefaultRole)
          const movableIndex = movableRoles.findIndex((candidate) => candidate.id === role.id)
          return (
            <article key={role.id} style={{ "--role-color": role.color } as React.CSSProperties}>
              {role.isOwnerRole ? <Crown className="workshop-role-grip" /> : <ShieldCheck className="workshop-role-grip" />}
              <div className="workshop-role-copy">
                <header>
                  <span />
                  <div><h3>{role.name}</h3><p>{role.isOwnerRole ? "Highest protected role" : `Hierarchy level ${role.order + 1}`}</p></div>
                  <b>{members.length} member{members.length === 1 ? "" : "s"}</b>
                </header>
                <div className="workshop-permission-tags">
                  {role.permissions.map((permission) => <span key={permission}><Check /> {permission}</span>)}
                  {!role.permissions.length && <small>No elevated permissions</small>}
                </div>
              </div>
              <div className="workshop-role-members">
                {members.slice(0, 4).map((member) => <span key={member.id}>{member.avatarUrl ? <img alt={member.name} referrerPolicy="no-referrer" src={member.avatarUrl} /> : member.initials}</span>)}
              </div>
              {manageable && <div className="workshop-role-order-actions">
                {!role.isOwnerRole && !role.isDefaultRole && <>
                  <Button aria-label={`Move ${role.name} up`} disabled={movableIndex <= 0} onClick={() => void moveRole(role, -1)} size="icon-xs" type="button" variant="ghost"><ArrowUp /></Button>
                  <Button aria-label={`Move ${role.name} down`} disabled={movableIndex < 0 || movableIndex >= movableRoles.length - 1} onClick={() => void moveRole(role, 1)} size="icon-xs" type="button" variant="ghost"><ArrowDown /></Button>
                </>}
                <Button aria-label={`Manage ${role.name}`} onClick={() => { setError(""); setEditingRole(role) }} size="icon" type="button" variant="ghost"><Pencil /></Button>
              </div>}
            </article>
          )
        })}
      </div>

      <section className="workshop-role-leave">
        <div><LogOut /><span><strong>Leave organization</strong><small>{currentMember?.isOwner && !canLeave ? "Promote at least one other owner before leaving." : "Your roles and team access will be removed."}</small></span></div>
        <Button disabled={!canLeave || isLeaving} onClick={() => void leave()} type="button" variant="destructive"><LogOut /> Leave</Button>
      </section>

      <RoleDialog
        busy={isCreatingRole}
        currentUserId={currentUserId}
        onClose={() => setIsCreating(false)}
        onSave={async (draft) => {
          setError("")
          try {
            await createRole({ organizationId: organization.id, role: draft }).unwrap()
            setIsCreating(false)
          } catch {
            setError("The role could not be created. Check its name and your permissions.")
          }
        }}
        open={isCreating}
        organization={organization}
      />

      <RoleDialog
        busy={isUpdatingRole || isDeletingRole}
        members={editingRole ? organization.members : undefined}
        onClose={() => setEditingRole(null)}
        onDelete={editingRole && !editingRole.isOwnerRole && !editingRole.isDefaultRole
          ? () => void removeRole(editingRole)
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
              role: { ...draft, position: editingRole.order },
            }).unwrap()
            setEditingRole(null)
          } catch {
            setError("The role could not be updated. Check the hierarchy and role name.")
          }
        }}
        open={Boolean(editingRole)}
        organization={organization}
        currentUserId={currentUserId}
        role={editingRole ?? undefined}
      />

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        {settingsOpen && <DialogContent className="workshop-modal sm:max-w-lg">
          <span className="workshop-modal-icon"><Settings /></span>
          <DialogHeader><DialogTitle>Organization settings</DialogTitle><DialogDescription>Update the name and description shown to every member.</DialogDescription></DialogHeader>
          <form onSubmit={async (event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            setError("")
            try {
              await updateOrganization({ organizationId: organization.id, name: String(form.get("name") ?? "").trim(), description: String(form.get("description") ?? "").trim() }).unwrap()
              setSettingsOpen(false)
            } catch (updateError) {
              setError(getApiErrorMessage(updateError))
            }
          }}>
            <Label>Organization name<Input autoFocus defaultValue={organization.name} maxLength={150} name="name" required /></Label>
            <Label>Description <span>Optional</span><Input defaultValue={organization.description} maxLength={1000} name="description" /></Label>
            <Button className="workshop-primary-action" disabled={isUpdatingOrganization} type="submit"><Check /> Save changes</Button>
          </form>
        </DialogContent>}
      </Dialog>
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

  useEffect(() => {
    if (!open) return
    setName(role?.name ?? "")
    setColor(role?.color ?? "#f472b6")
    setPermissions(new Set(role?.isOwnerRole ? availablePermissions : role?.permissions ?? []))
  }, [open, role])

  const administrator = role?.isOwnerRole || permissions.has("Administrator")

  function canGrantPermission(permission: WorkshopPermission) {
    return Boolean(organization && hasWorkshopPermission(organization, currentUserId, permission))
  }

  function togglePermission(permission: WorkshopPermission, checked: boolean) {
    setPermissions((current) => {
      if (permission === "Administrator") {
        return checked ? new Set(availablePermissions) : new Set<WorkshopPermission>()
      }
      const next = new Set(current)
      if (checked) next.add(permission)
      else next.delete(permission)
      return next
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await onSave({ name: name.trim(), color, permissions: [...permissions] })
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose() }}>
      {open && (
        <DialogContent className="workshop-modal workshop-role-modal sm:max-w-2xl">
          <span className="workshop-modal-icon">{role?.isOwnerRole ? <Crown /> : <ShieldCheck />}</span>
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
              <Label>Role name<Input autoFocus maxLength={100} onChange={(event) => setName(event.target.value)} required value={name} /></Label>
              <Label>Color<Input disabled={role?.isOwnerRole} onChange={(event) => setColor(event.target.value)} type="color" value={color} /></Label>
            </div>
            <fieldset>
              <legend>Permissions</legend>
              {availablePermissions.map((permission) => {
                const locked = Boolean(
                  role?.isOwnerRole ||
                  (administrator && permission !== "Administrator") ||
                  !canGrantPermission(permission),
                )
                return (
                  <Label key={permission}>
                    <Checkbox
                      checked={permissions.has(permission)}
                      disabled={locked}
                      onCheckedChange={(checked) => togglePermission(permission, checked === true)}
                    />
                    <span><strong>{permission}</strong><small>{permissionDescriptions[permission]}</small></span>
                  </Label>
                )
              })}
            </fieldset>

            {role && members && organization && (
              <fieldset className="workshop-role-member-picker">
                <legend>{role.isOwnerRole ? "Organization owners" : "Role members"}</legend>
                {members.map((member) => {
                  const assigned = (member.roleIds ?? [member.roleId]).includes(role.id)
                  const canChange = role.isOwnerRole
                    ? organization.members.find((candidate) => candidate.id === currentUserId)?.isOwner && !member.isOwner
                    : !role.isDefaultRole &&
                      canManageWorkshopMember(organization, currentUserId, member.id) &&
                      canManageWorkshopRole(organization, currentUserId, role)
                  return (
                    <Label key={member.id}>
                      <Checkbox
                        checked={assigned}
                        disabled={!canChange}
                        onCheckedChange={(checked) => onMemberChange?.(member.id, checked === true)}
                      />
                      <span><strong>{member.name}</strong><small>@{member.username}{member.isOwner ? " · Owner" : ""}</small></span>
                    </Label>
                  )
                })}
              </fieldset>
            )}

            <div className="workshop-role-dialog-actions">
              {onDelete && <Button disabled={busy} onClick={onDelete} type="button" variant="destructive"><Trash2 /> Delete role</Button>}
              <Button className="workshop-primary-action" disabled={busy || !name.trim()} type="submit">
                {role ? <Check /> : <Plus />} {role ? "Save changes" : "Create role"}
              </Button>
            </div>
          </form>
        </DialogContent>
      )}
    </Dialog>
  )
}
