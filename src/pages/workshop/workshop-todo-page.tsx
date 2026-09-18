import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type FormEvent } from "react"
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ChevronsLeft, ChevronsRight, Circle, Clock3, GripHorizontal, Plus } from "lucide-react"
import { useOutletContext, useSearchParams } from "react-router-dom"
import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import { useCreateTodoMutation, useCreateTodoTaskMutation, useTodoPagesInfiniteQuery, useGetTodoQuery, useMoveTodoTaskMutation, type Todo } from "@/features/workshop/todo-api"
import type { WorkshopTaskStatus } from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"

const columns = [
  { id: "pending", label: "Pending", icon: Circle },
  { id: "progress", label: "In progress", icon: Clock3 },
  { id: "done", label: "Done", icon: CheckCircle2 },
] as const
const formatDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })

function TodoTargetDate({ todo, prefix = "" }: { todo: Todo; prefix?: string }) {
  const [today, setToday] = useState(() => new Date().setHours(0, 0, 0, 0))
  useEffect(() => {
    const now = new Date()
    const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const refresh = () => setToday(new Date().setHours(0, 0, 0, 0))
    const timer = window.setTimeout(refresh, nextDay.getTime() - now.getTime())
    window.addEventListener("focus", refresh)
    return () => { window.clearTimeout(timer); window.removeEventListener("focus", refresh) }
  }, [today])
  const past = todo.targetDate && new Date(`${todo.targetDate}T00:00:00`).getTime() < today
  const status = past && todo.tasks.length > 0
    ? todo.tasks.every(task => task.status === "done") ? "completed" : "overdue"
    : undefined
  const description = status === "overdue" ? "Overdue — unfinished tasks" : status === "completed" ? "All tasks completed" : undefined

  return <span className="workshop-todo-date" data-status={status} title={description}>
    <CalendarDays aria-hidden="true" />
    {todo.targetDate ? `${prefix}${formatDate(todo.targetDate)}` : "No target date"}
    {description && <span className="sr-only"> — {description}</span>}
  </span>
}

function TodoLoading({ label = "Loading TODOs…" }: { label?: string }) {
  return <div className="workshop-todo-loading" role="status">
    <span className="sr-only">{label}</span>
    <span className="workshop-todo-loading-dot" aria-hidden="true" />
    <span className="workshop-todo-loading-dot" aria-hidden="true" />
    <span className="workshop-todo-loading-dot" aria-hidden="true" />
  </div>
}

export function WorkshopTodoPage() {
  const context = useOutletContext<WorkshopOutletContext>()
  if (!context.project) return <section className="workshop-empty-panel"><CheckCircle2 /><h3>No project selected</h3><p>Create a project to organize TODOs and tasks.</p></section>
  return <TodoPageContent key={`${context.organization.id}/${context.project.id}`} {...context} project={context.project} />
}

function TodoPageContent({ organization, project }: WorkshopOutletContext & { project: NonNullable<WorkshopOutletContext["project"]> }) {
  const userId = useAppSelector((state) => state.auth.user?.id)
  const [params, setParams] = useSearchParams()
  const scope = { organizationId: organization.id, projectId: project.id }
  const headingRef = useRef<HTMLElement>(null)
  const [columnCount, setColumnCount] = useState<number | null>(null)
  useLayoutEffect(() => {
    const heading = headingRef.current
    if (!heading) return
    const measure = () => setColumnCount(Math.max(1, Math.floor((heading.clientWidth + 18) / (300 + 18))))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(heading)
    return () => observer.disconnect()
  }, [])
  const selectedId = params.get("todoProject") === project.id ? params.get("todo") : null
  const list = useTodoPagesInfiniteQuery({ ...scope, pageSize: (columnCount ?? 1) * 4 }, { skip: !!selectedId || columnCount === null })
  const detail = useGetTodoQuery({ ...scope, todoId: selectedId ?? "" }, { skip: !selectedId })
  const todos = [...new Map(list.currentData?.pages.flatMap(page => page.items).map(todo => [todo.id, todo])).values()]
  const selected = detail.currentData
  const { isFetching, isError, refetch } = selectedId ? detail : list
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = list

  useEffect(() => {
    const target = loadMoreRef.current
    if (!target || selectedId || !hasNextPage || isFetching || isError || !("IntersectionObserver" in window)) return
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect()
        void fetchNextPage()
      }
    }, { rootMargin: "0px 0px 240px 0px" })
    observer.observe(target)
    return () => observer.disconnect()
  }, [selectedId, hasNextPage, isFetching, isError, fetchNextPage, todos.length])
  const [createTodo, { isLoading: creatingTodo }] = useCreateTodoMutation()
  const [createTask, { isLoading: creatingTask }] = useCreateTodoTaskMutation()
  const [moveTask, { isLoading: movingTask }] = useMoveTodoTaskMutation()
  const [creating, setCreating] = useState(false)
  const [addingTo, setAddingTo] = useState<WorkshopTaskStatus | null>(null)
  const [error, setError] = useState("")
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropColumn, setDropColumn] = useState<WorkshopTaskStatus | null>(null)
  const dragPreviewCleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => dragPreviewCleanup.current?.(), [])

  function startDrag(event: DragEvent<HTMLDivElement>, taskId: string) {
    dragPreviewCleanup.current?.()
    const card = event.currentTarget
    const bounds = card.getBoundingClientRect()
    const offsetX = event.clientX - bounds.left
    const offsetY = event.clientY - bounds.top
    const preview = card.cloneNode(true) as HTMLElement
    preview.classList.remove("workshop-task-dragging")
    preview.classList.add("workshop-task-drag-preview")
    preview.inert = true
    preview.setAttribute("aria-hidden", "true")
    preview.removeAttribute("draggable")
    preview.style.width = bounds.width + "px"
    preview.style.height = bounds.height + "px"
    preview.style.left = bounds.left + "px"
    preview.style.top = bounds.top + "px"
    document.body.appendChild(preview)
    const blank = document.createElement("canvas")
    blank.width = blank.height = 1
    event.dataTransfer.setDragImage(blank, 0, 0)
    event.dataTransfer.setData("text/plain", taskId)
    event.dataTransfer.effectAllowed = "move"
    let lastX = event.clientX
    const move = (pointer: globalThis.DragEvent) => {
      preview.style.left = pointer.clientX - offsetX + "px"
      preview.style.top = pointer.clientY - offsetY + "px"
      const delta = pointer.clientX - lastX
      if (Math.abs(delta) >= 2) {
        preview.style.setProperty("--drag-tilt", delta > 0 ? "2deg" : "-2deg")
        lastX = pointer.clientX
      }
    }
    const cleanup = () => {
      preview.remove()
      document.removeEventListener("dragover", move)
      document.removeEventListener("drop", cleanup)
      document.removeEventListener("dragend", cleanup)
      dragPreviewCleanup.current = null
    }
    document.addEventListener("dragover", move)
    document.addEventListener("drop", cleanup)
    document.addEventListener("dragend", cleanup)
    dragPreviewCleanup.current = cleanup
    setDraggedId(taskId)
  }

  const saving = useRef(false)
  const canManage = hasWorkshopPermission(organization, userId ?? "current", "Manage tasks")
  const busy = creatingTodo || creatingTask || movingTask

  function openTodo(id: string | null) {
    setError("")
    setParams(current => {
      const next = new URLSearchParams(current)
      if (id) { next.set("todo", id); next.set("todoProject", project.id) }
      else { next.delete("todo"); next.delete("todoProject") }
      return next
    })
  }

  async function submitTodo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canManage || saving.current) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    if (!name) { setError("Enter a TODO name."); return }
    saving.current = true
    setError("")
    try {
      const todo = await createTodo({ ...scope, name, description: String(form.get("description") ?? "").trim(), targetDate: String(form.get("targetDate") ?? "") || null }).unwrap()
      setCreating(false)
      openTodo(todo.id)
    } catch { setError("The TODO could not be saved. Please try again.") }
    finally { saving.current = false }
  }

  async function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !addingTo || !canManage || saving.current) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get("title") ?? "").trim()
    if (!title) { setError("Enter a task title."); return }
    saving.current = true
    setError("")
    try {
      await createTask({ ...scope, todoId: selected.id, title, description: String(form.get("description") ?? "").trim(), status: addingTo }).unwrap()
      setAddingTo(null)
    } catch { setError("The task could not be saved. Please try again.") }
    finally { saving.current = false }
  }

  async function changeStatus(taskId: string, status: WorkshopTaskStatus) {
    setDraggedId(null)
    const task = selected?.tasks.find(t => t.id === taskId)
    if (!selected || !task || task.status === status || !canManage || saving.current) return
    saving.current = true
    setError("")
    try { await moveTask({ ...scope, todoId: selected.id, taskId, status }).unwrap() }
    catch { setError("The task could not be moved. Please try again.") }
    finally { saving.current = false }
  }

  return (
    <div className="workshop-page workshop-board-page">
      <section className="workshop-page-heading workshop-todo-heading compact" ref={headingRef}>
        <div>
          {selectedId && <Button variant="ghost" onClick={() => openTodo(null)}><ArrowLeft /> All TODOs</Button>}
          <h2>{selected?.name ?? (selectedId ? "TODO board" : "TODOs")}</h2>
          {selected?.description && <p>{selected.description}</p>}
          {selected?.targetDate && <TodoTargetDate todo={selected} prefix="Final target: " />}
        </div>
        {canManage && !isError && (!selectedId || selected) && <Button className="workshop-page-action" disabled={busy} onClick={() => { setError(""); if (selected) setAddingTo("pending"); else setCreating(true) }}><Plus />{selected ? "Add task" : "Create TODO"}</Button>}
      </section>
      {error && !creating && !addingTo && <p role="alert" className="workshop-form-error">{error}</p>}
      {isError && (selectedId || !todos.length) ? <section className="workshop-empty-panel"><h3>Could not load TODOs</h3><p>Please try again to retrieve your saved work.</p><Button onClick={() => void refetch()}>Retry</Button></section>
        : (!selectedId && columnCount === null) || (isFetching && (selectedId ? !selected : !todos.length)) ? <TodoLoading />
        : selectedId && !selected ? <section className="workshop-empty-panel"><h3>{isFetching ? "Opening TODO…" : "TODO not found"}</h3><p>{isFetching ? "Loading the task board." : "This TODO is no longer available in this project."}</p></section>
        : selected ? (
          <div className="workshop-board" aria-busy={busy || isFetching}>
            {columns.map(({ id, label, icon: Icon }) => {
              const tasks = selected.tasks.filter(t => t.status === id)
              return <section className={`workshop-board-column${dropColumn === id && draggedId ? " workshop-board-column-drop" : ""}`} key={id}
                onDragOver={event => { if (canManage && !busy && draggedId) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDropColumn(id) } }}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropColumn(null) }}
                onDrop={event => { event.preventDefault(); setDropColumn(null); if (draggedId) void changeStatus(draggedId, id) }}>
                <header><span><Icon /><strong>{label}</strong><b>{tasks.length}</b></span></header>
                <div className="workshop-task-list">
                  {tasks.map(task => <Card className={`workshop-task${draggedId === task.id ? " workshop-task-dragging" : ""}`} key={task.id} draggable={canManage && !busy} onDragStart={event => startDrag(event, task.id)} onDragEnd={() => { setDraggedId(null); setDropColumn(null) }}>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                    {canManage && <>
                      {task.status !== "pending" && <Button aria-label={`Move ${task.title} to ${task.status === "done" ? "In progress" : "Pending"}`} title={`Move to ${task.status === "done" ? "In progress" : "Pending"}`} className="workshop-task-edge workshop-task-edge-left" disabled={busy} variant="ghost" onClick={() => void changeStatus(task.id, task.status === "done" ? "progress" : "pending")}><ChevronsLeft /></Button>}
                      {task.status !== "done" && <Button aria-label={`Move ${task.title} to ${task.status === "pending" ? "In progress" : "Done"}`} title={`Move to ${task.status === "pending" ? "In progress" : "Done"}`} className="workshop-task-edge workshop-task-edge-right" disabled={busy} variant="ghost" onClick={() => void changeStatus(task.id, task.status === "pending" ? "progress" : "done")}><ChevronsRight /></Button>}
                    <span className="workshop-task-drag-handle" title="Drag task to another column" aria-hidden="true"><GripHorizontal /></span></>}
                  </Card>)}
                  {!tasks.length && <p className="workshop-todo-empty-column">No tasks yet</p>}
                  {canManage && <Button className="workshop-add-task" disabled={busy} variant="ghost" onClick={() => { setError(""); setAddingTo(id) }}><Plus /> Add a task</Button>}
                </div>
              </section>
            })}
          </div>
        ) : todos.length ? (
          <div className="workshop-todo-grid" aria-busy={isFetching}>
            {todos.map(todo => {
              const completed = todo.tasks.filter(task => task.status === "done").length
              return <button className="workshop-todo-card" key={todo.id} onClick={() => openTodo(todo.id)}>
                <span className="workshop-todo-card-heading"><CheckCircle2 /><strong>{todo.name}</strong><ArrowRight /></span>
                {todo.description && <p>{todo.description}</p>}
                <TodoTargetDate todo={todo} />
                <progress aria-label={`${todo.name} progress`} max={Math.max(todo.tasks.length, 1)} value={completed} />
                <span className="workshop-todo-progress">{completed} of {todo.tasks.length} tasks done</span>
              </button>
            })}
          </div>
        ) : <section className="workshop-empty-panel"><CheckCircle2 /><h3>No TODOs yet</h3><p>{canManage ? "Create your first TODO, then add tasks to its board." : "TODOs created by your team will appear here."}</p></section>}

      {!selectedId && todos.length > 0 && (isFetching || isError || hasNextPage) && <div className="workshop-todo-pagination" ref={loadMoreRef}>
        {isFetching ? <TodoLoading label={isFetchingNextPage ? "Loading more TODOs…" : "Updating TODOs…"} />
          : isError ? <><p role="alert">Could not load TODOs. Your loaded items are still available.</p><Button variant="outline" onClick={() => void refetch()}>Retry</Button></>
          : hasNextPage ? <Button variant="ghost" onClick={() => void fetchNextPage()}>Load more TODOs</Button>
          : null}
      </div>}

      <Dialog open={creating || addingTo !== null} onOpenChange={open => { if (!open && !busy) { setCreating(false); setAddingTo(null); setError("") } }}>
        <DialogContent className="workshop-modal workshop-task-modal sm:max-w-md">
          <span className="workshop-modal-icon"><CheckCircle2 /></span>
          <DialogHeader><DialogTitle>{creating ? "Create a TODO" : "Add a task"}</DialogTitle><DialogDescription>{creating ? "Give this TODO a name. You can add individual tasks on the next screen." : `New task in ${columns.find(c => c.id === addingTo)?.label}.`}</DialogDescription></DialogHeader>
          <form onSubmit={creating ? submitTodo : submitTask}>
            <Label>{creating ? "TODO name" : "Task title"}<Input key={creating ? "todo" : "task"} autoFocus required maxLength={150} name={creating ? "name" : "title"} placeholder={creating ? "e.g. Launch the new website" : "What needs to happen?"} /></Label>
            <Label>Description <span>Optional</span><Textarea name="description" maxLength={2000} placeholder="Add useful context for the team" rows={3} /></Label>
            {creating && <Label>Final target date <span>Optional</span><Input name="targetDate" type="date" /></Label>}
            {error && <p role="alert" className="workshop-form-error">{error}</p>}
            <Button className="workshop-primary-action" disabled={busy} type="submit"><Plus />{busy ? "Saving…" : creating ? "Create TODO & open board" : "Add task"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
