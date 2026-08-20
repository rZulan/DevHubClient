import { useState, type DragEvent, type FormEvent } from "react"
import {
  Check,
  GripVertical,
  LockKeyhole,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useWorkshop } from "@/features/workshop/workshop-context"
import type { WorkshopRole } from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"

const availablePermissions = [
  "Manage organization",
  "Manage roles",
  "Manage teams",
  "Manage projects",
  "Manage members",
  "Edit ideation",
  "Manage tasks",
  "View all projects",
] as const

export function WorkshopRolesPage() {
  const { organization } = useOutletContext<WorkshopOutletContext>()
  const { saveRoles } = useWorkshop()
  const [roles, setRoles] = useState(organization.roles)
  const [isCreating, setIsCreating] = useState(false)
  const [draggedRoleId, setDraggedRoleId] = useState<string | null>(null)
  const [dropTargetRoleId, setDropTargetRoleId] = useState<string | null>(null)

  function handleCreateRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    if (!name) return
    const permissions = availablePermissions.filter((permission) => form.get(permission) === "on")
    const role: WorkshopRole = {
      id: crypto.randomUUID(),
      name,
      color: String(form.get("color") ?? "#f472b6"),
      order: roles.length,
      permissions: [...permissions],
    }
    const nextRoles = [...roles, role]
    setRoles(nextRoles)
    saveRoles(organization.id, nextRoles)
    setIsCreating(false)
  }

  function handleDragStart(event: DragEvent<HTMLElement>, roleId: string) {
    event.dataTransfer.effectAllowed = "move"
    event.dataTransfer.setData("text/plain", roleId)
    setDraggedRoleId(roleId)
  }

  function handleDragOver(event: DragEvent<HTMLElement>, roleId: string) {
    event.preventDefault()
    event.dataTransfer.dropEffect = "move"
    if (roleId !== draggedRoleId) setDropTargetRoleId(roleId)
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetRoleId: string) {
    event.preventDefault()
    const sourceRoleId = draggedRoleId ?? event.dataTransfer.getData("text/plain")

    if (sourceRoleId && sourceRoleId !== targetRoleId) {
      const ordered = [...roles].sort((a, b) => a.order - b.order)
      const sourceIndex = ordered.findIndex((role) => role.id === sourceRoleId)
      const targetIndex = ordered.findIndex((role) => role.id === targetRoleId)
      if (sourceIndex >= 0 && targetIndex >= 0) {
        const [movedRole] = ordered.splice(sourceIndex, 1)
        ordered.splice(targetIndex, 0, movedRole)
        const reorderedRoles = ordered.map((role, order) => ({ ...role, order }))
        setRoles(reorderedRoles)
        saveRoles(organization.id, reorderedRoles)
      }
    }

    clearDragState()
  }

  function clearDragState() {
    setDraggedRoleId(null)
    setDropTargetRoleId(null)
  }

  return (
    <div className="workshop-page">
      <section className="workshop-page-heading compact">
        <div><span className="workshop-page-kicker">Workshop permissions</span><h2>Roles & access</h2><p>Create custom roles, arrange their hierarchy, and tag exactly what each can do inside this organization.</p></div>
        <Button className="workshop-page-action" onClick={() => setIsCreating(true)} type="button"><Plus /> Create role</Button>
      </section>

      <div className="workshop-role-summary">
        <div><ShieldCheck /><span><strong>{roles.length}</strong><small>Custom roles</small></span></div>
        <div><Users /><span><strong>{organization.members.length}</strong><small>Assigned members</small></span></div>
        <div><LockKeyhole /><span><strong>{availablePermissions.length}</strong><small>Permission tags</small></span></div>
      </div>

      <p className="workshop-role-drag-hint"><GripVertical /> Drag a role to change its hierarchy level.</p>
      <div className="workshop-role-list">
        {[...roles].sort((a, b) => a.order - b.order).map((role) => {
          const members = organization.members.filter((member) => member.roleId === role.id)
          return (
            <article
              aria-label={`${role.name}, hierarchy level ${role.order + 1}. Drag to reorder.`}
              data-dragging={draggedRoleId === role.id ? "true" : undefined}
              data-drop-target={dropTargetRoleId === role.id ? "true" : undefined}
              draggable
              key={role.id}
              onDragEnd={clearDragState}
              onDragEnter={() => { if (role.id !== draggedRoleId) setDropTargetRoleId(role.id) }}
              onDragOver={(event) => handleDragOver(event, role.id)}
              onDragStart={(event) => handleDragStart(event, role.id)}
              onDrop={(event) => handleDrop(event, role.id)}
              style={{ "--role-color": role.color } as React.CSSProperties}
            >
              <GripVertical className="workshop-role-grip" />
              <div className="workshop-role-copy">
                <header><span /><div><h3>{role.name}</h3><p>Hierarchy level {role.order + 1}</p></div><b>{members.length} member{members.length === 1 ? "" : "s"}</b></header>
                <div className="workshop-permission-tags">
                  {role.permissions.map((permission) => <span key={permission}><Check /> {permission}</span>)}
                  {!role.permissions.length && <small>No permissions assigned</small>}
                </div>
              </div>
              <div className="workshop-role-members">{members.slice(0, 4).map((member) => <span key={member.id}>{member.initials}</span>)}</div>
            </article>
          )
        })}
      </div>

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        {isCreating && (
          <DialogContent className="workshop-modal workshop-role-modal sm:max-w-lg">
            <span className="workshop-modal-icon"><ShieldCheck /></span>
            <DialogHeader>
              <DialogTitle id="role-modal-title">Create a custom role</DialogTitle>
              <DialogDescription>This role applies only inside {organization.name}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateRole}>
              <div className="workshop-role-fields"><Label>Role name<Input autoFocus name="name" placeholder="Design Lead" /></Label><Label>Color<Input defaultValue="#f472b6" name="color" type="color" /></Label></div>
              <fieldset><legend>Permission tags</legend>{availablePermissions.map((permission) => <Label key={permission}><Checkbox name={permission} />{permission}</Label>)}</fieldset>
              <Button className="workshop-primary-action" type="submit"><Plus /> Create role</Button>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
