import { useMemo, useState } from "react"
import { Crown, Link2, LoaderCircle, MoreHorizontal, Search, ShieldCheck, UserMinus } from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { getApiErrorMessage } from "@/features/auth/api-error"
import {
  canManageWorkshopMember,
  canManageWorkshopRole,
} from "@/features/workshop/workshop-access"
import type { WorkshopMember, WorkshopRole } from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import {
  useAssignOrganizationRoleMutation,
  usePromoteOrganizationOwnerMutation,
  useRemoveOrganizationMemberMutation,
} from "@/services/api"

const joinedFormat = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" })

export function MembersSettingsPage() {
  const { organization, canInvite, openInviteDialog } = useOutletContext<WorkshopOutletContext>()
  const currentUserId = useAppSelector((state) => state.auth.user?.id)
  const [query, setQuery] = useState("")
  const [error, setError] = useState("")
  const [removing, setRemoving] = useState<WorkshopMember | null>(null)
  const [assignRole] = useAssignOrganizationRoleMutation()
  const [promoteOwner] = usePromoteOrganizationOwnerMutation()
  const [removeMember, { isLoading: isRemoving }] = useRemoveOrganizationMemberMutation()

  const roles = useMemo(
    () => [...organization.roles].sort((left, right) => left.order - right.order),
    [organization.roles],
  )
  const currentMember = organization.members.find((member) => member.id === currentUserId)
  const onlineCount = organization.members.filter((member) => member.online).length
  const members = useMemo(() => {
    const search = query.trim().toLowerCase()
    return organization.members
      .filter((member) => !search || `${member.name} ${member.username}`.toLowerCase().includes(search))
      .sort((left, right) =>
        Number(Boolean(right.isOwner)) - Number(Boolean(left.isOwner)) ||
        left.name.localeCompare(right.name))
  }, [organization.members, query])

  async function toggleRole(member: WorkshopMember, role: WorkshopRole, assigned: boolean) {
    setError("")
    try {
      if (role.isOwnerRole) await promoteOwner({ organizationId: organization.id, userId: member.id }).unwrap()
      else await assignRole({ organizationId: organization.id, roleId: role.id, userId: member.id, assigned }).unwrap()
    } catch (roleError) {
      setError(getApiErrorMessage(roleError))
    }
  }

  async function confirmRemove() {
    if (!removing) return
    setError("")
    try {
      await removeMember({ organizationId: organization.id, userId: removing.id }).unwrap()
      setRemoving(null)
    } catch (removeError) {
      setError(getApiErrorMessage(removeError))
      setRemoving(null)
    }
  }

  return (
    <div className="workshop-settings-page">
      <header className="workshop-settings-heading with-actions">
        <div>
          <h2>Members</h2>
          <p>{organization.members.length} member{organization.members.length === 1 ? "" : "s"} · {onlineCount} online now</p>
        </div>
        <Button disabled={!canInvite} onClick={openInviteDialog} type="button"><Link2 /> Invite members</Button>
      </header>

      <label className="workshop-settings-search">
        <Search />
        <Input aria-label="Search members" onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or username" value={query} />
      </label>

      {error && <p className="workshop-form-error">{error}</p>}

      <section className="workshop-settings-card flush">
        <div className="workshop-settings-member-head" aria-hidden="true">
          <span>Member</span><span>Roles</span><span>Joined</span><span />
        </div>
        {members.map((member) => {
          const memberRoleIds = member.roleIds ?? [member.roleId]
          const assignedRoles = roles.filter((role) => memberRoleIds.includes(role.id) && !role.isOwnerRole)
          // Everyone holds the default role, so only surface it when it is the member's only role.
          const customRoles = assignedRoles.filter((role) => !role.isDefaultRole)
          const memberRoles = customRoles.length || member.isOwner ? customRoles : assignedRoles
          const canRemove = canManageWorkshopMember(organization, currentUserId, member.id)
          const assignableRoles = roles.filter((role) =>
            role.isOwnerRole
              ? currentMember?.isOwner && !member.isOwner
              : !role.isDefaultRole &&
                canManageWorkshopMember(organization, currentUserId, member.id) &&
                canManageWorkshopRole(organization, currentUserId, role))
          const presence = member.presenceStatus ?? (member.online ? "online" : "offline")

          return (
            <article className="workshop-settings-member" key={member.id}>
              <div className="workshop-settings-member-identity">
                <span className="workshop-member-avatar">
                  <Avatar className="size-9">
                    {member.avatarUrl && <AvatarImage alt={member.name} referrerPolicy="no-referrer" src={member.avatarUrl} />}
                    <AvatarFallback>{member.initials}</AvatarFallback>
                  </Avatar>
                  <i className={`presence-${presence}`} />
                </span>
                <span>
                  <strong>{member.name}{member.id === currentUserId && <em>You</em>}</strong>
                  <small>@{member.username}</small>
                </span>
              </div>
              <div className="workshop-settings-role-chips">
                {member.isOwner && <span style={{ "--role-color": "#f59e0b" } as React.CSSProperties}><Crown /> Owner</span>}
                {memberRoles.map((role) => (
                  <span key={role.id} style={{ "--role-color": role.color } as React.CSSProperties}><i />{role.name}</span>
                ))}
              </div>
              <small className="workshop-settings-member-joined">
                {member.joinedAtUtc ? joinedFormat.format(new Date(member.joinedAtUtc)) : "—"}
              </small>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button aria-label={`Manage ${member.name}`} disabled={!assignableRoles.length && !canRemove} size="icon-sm" type="button" variant="ghost"><MoreHorizontal /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-2"><ShieldCheck className="size-3.5" /> Roles</DropdownMenuLabel>
                  {roles.filter((role) => !role.isDefaultRole).map((role) => {
                    const assigned = role.isOwnerRole ? Boolean(member.isOwner) : memberRoleIds.includes(role.id)
                    const canToggle = assignableRoles.includes(role) && !(role.isOwnerRole && assigned)
                    return (
                      <DropdownMenuCheckboxItem
                        checked={assigned}
                        disabled={!canToggle}
                        key={role.id}
                        onCheckedChange={(checked) => void toggleRole(member, role, checked === true)}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <i className="workshop-settings-role-dot" style={{ background: role.color }} />
                        {role.isOwnerRole ? "Owner" : role.name}
                      </DropdownMenuCheckboxItem>
                    )
                  })}
                  {canRemove && <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => setRemoving(member)} variant="destructive"><UserMinus /> Remove from organization</DropdownMenuItem>
                  </>}
                </DropdownMenuContent>
              </DropdownMenu>
            </article>
          )
        })}
        {!members.length && <p className="workshop-settings-empty">No members match “{query}”.</p>}
      </section>

      <p className="workshop-settings-footnote">You can change roles and remove members only below your highest role. Owners can promote other owners.</p>

      <Dialog open={Boolean(removing)} onOpenChange={(open) => { if (!open) setRemoving(null) }}>
        {removing && (
          <DialogContent className="workshop-modal sm:max-w-md">
            <span className="workshop-modal-icon danger"><UserMinus /></span>
            <DialogHeader>
              <DialogTitle>Remove {removing.name}?</DialogTitle>
              <DialogDescription>They lose access to {organization.name} and its teams immediately. You can invite them again later.</DialogDescription>
            </DialogHeader>
            <div className="workshop-settings-dialog-actions">
              <Button onClick={() => setRemoving(null)} type="button" variant="ghost">Cancel</Button>
              <Button disabled={isRemoving} onClick={() => void confirmRemove()} type="button" variant="destructive">
                {isRemoving ? <LoaderCircle className="animate-spin" /> : <UserMinus />} Remove member
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
