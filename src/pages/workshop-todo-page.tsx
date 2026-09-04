import { useMemo, useState, type DragEvent, type FormEvent } from "react"
import {
  CheckCircle2,
  Circle,
  Clock3,
  GripVertical,
  MoreHorizontal,
  Plus,
} from "lucide-react"
import { useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useWorkshop } from "@/features/workshop/workshop-context"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import type {
  WorkshopTask,
  WorkshopTaskStatus,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { createClientId } from "@/lib/create-client-id"

const columns: Array<{
  id: WorkshopTaskStatus
  label: string
  icon: typeof Circle
  description: string
}> = [
  { id: "pending", label: "Pending", icon: Circle, description: "Ready to be picked up" },
  { id: "progress", label: "In progress", icon: Clock3, description: "Actively being worked on" },
  { id: "done", label: "Done", icon: CheckCircle2, description: "Completed this cycle" },
]

export function WorkshopTodoPage() {
  const { organization, project } = useOutletContext<WorkshopOutletContext>()
  const userId = useAppSelector((state) => state.auth.user?.id)
  const { addTask, moveTask } = useWorkshop()
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [addingTo, setAddingTo] = useState<WorkshopTaskStatus | null>(null)
  const tasks = useMemo(
    () => organization.tasks.filter((task) => task.projectId === project?.id),
    [organization.tasks, project?.id],
  )
  const canManageTasks = hasWorkshopPermission(
    organization,
    userId ?? "current",
    "Manage tasks",
  )

  function handleDrop(event: DragEvent, status: WorkshopTaskStatus) {
    event.preventDefault()
    if (canManageTasks && draggedTaskId) moveTask(organization.id, draggedTaskId, status)
    setDraggedTaskId(null)
  }

  function handleAddTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !addingTo) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get("title") ?? "").trim()
    if (!title) return

    addTask(organization.id, {
      id: createClientId(),
      projectId: project.id,
      title,
      description: String(form.get("description") ?? "").trim(),
      status: addingTo,
      priority: "Medium",
      label: "General",
    })
    setAddingTo(null)
  }

  if (!project) {
    return <section className="workshop-empty-panel"><CheckCircle2 /><h3>No project selected</h3><p>Task boards live inside projects. Create a project first.</p></section>
  }

  return (
    <div className="workshop-page workshop-board-page">
      <section className="workshop-page-heading compact">
        <div><span className="workshop-page-kicker">{project.name}</span><h2>TODO board</h2><p>Drag work between columns as it moves from idea to shipped.</p></div>
        {canManageTasks && <Button className="workshop-page-action" onClick={() => setAddingTo("pending")} type="button"><Plus /> Add task</Button>}
      </section>

      <div className="workshop-board">
        {columns.map(({ description, icon: Icon, id, label }) => {
          const columnTasks = tasks.filter((task) => task.status === id)
          return (
            <section className="workshop-board-column" key={id} onDragOver={(event) => { if (canManageTasks) event.preventDefault() }} onDrop={(event) => handleDrop(event, id)}>
              <header><span><Icon /><strong>{label}</strong><b>{columnTasks.length}</b></span><p>{description}</p></header>
              <div className="workshop-task-list">
                {columnTasks.map((task) => <TaskCard canManage={canManageTasks} key={task.id} organization={organization} onDragStart={() => setDraggedTaskId(task.id)} task={task} />)}
                {canManageTasks && <Button className="workshop-add-task" onClick={() => setAddingTo(id)} type="button" variant="ghost"><Plus /> Add a task</Button>}
              </div>
            </section>
          )
        })}
      </div>

      <Dialog open={addingTo !== null} onOpenChange={(open) => { if (!open) setAddingTo(null) }}>
        {addingTo && (
          <DialogContent className="workshop-modal workshop-task-modal sm:max-w-md">
            <span className="workshop-modal-icon"><CheckCircle2 /></span>
            <DialogHeader>
              <DialogTitle id="task-modal-title">Add a task</DialogTitle>
              <DialogDescription>New task in {columns.find((column) => column.id === addingTo)?.label}.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddTask}>
              <Label>Task title<Input autoFocus name="title" placeholder="What needs to happen?" /></Label>
              <Label>Description <span>Optional</span><Textarea name="description" placeholder="Add useful context for the team" rows={3} /></Label>
              <Button className="workshop-primary-action" type="submit"><Plus /> Add task</Button>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}

function TaskCard({
  canManage,
  organization,
  onDragStart,
  task,
}: {
  canManage: boolean
  organization: WorkshopOutletContext["organization"]
  onDragStart: () => void
  task: WorkshopTask
}) {
  const assignee = organization.members.find((member) => member.id === task.assigneeId)

  return (
    <Card className="workshop-task" draggable={canManage} onDragStart={onDragStart}>
      <header><span className={`priority-${task.priority.toLowerCase()}`}>{task.priority}</span>{canManage && <Button aria-label="Task actions" size="icon-xs" type="button" variant="ghost"><MoreHorizontal /></Button>}</header>
      <div><GripVertical /><h3>{task.title}</h3></div>
      {task.description && <p>{task.description}</p>}
      <footer><span>{task.label}</span>{assignee ? <b title={assignee.name}>{assignee.initials}</b> : canManage ? <Button aria-label="Assign task" size="icon-xs" type="button" variant="ghost"><Plus /></Button> : null}</footer>
    </Card>
  )
}
