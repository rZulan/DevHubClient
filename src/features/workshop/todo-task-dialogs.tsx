import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useId, useRef, useState, type FormEvent} from "react"
import {ChevronDown, ClipboardList, LoaderCircle} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {Textarea} from "@/components/ui/textarea"
import {TodoAssignees} from "./todo-assignees"
import {TodoDateFields} from "./todo-dates"
import {readTodoDates, todoDateError} from "./todo-schedule"
import type {TodoTask, TodoColumn, TodoTaskDetails} from "./todo-api"
import type {WorkshopMember} from "./workshop-types"

function todoTaskError(error: unknown, fallback: string) {
    if (typeof error === "object" && error && "status" in error && error.status === 409)
        return "This board changed while you were editing. Close this dialog and reopen the task to use the latest version."
    return fallback
}

export function TodoTaskEditDialog({task, columns, members, disabled, onClose, onSave}: {
    task: TodoTask; columns: TodoColumn[]; members: WorkshopMember[]; disabled?: boolean; onClose: () => void; onSave: (details: TodoTaskDetails) => Promise<void>
}) {
    const formId = useId()
    const [assignees, setAssignees] = useState(task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []))
    const [error, setError] = useState(""), [pending, setPending] = useState(false)
    const saving = useRef(false)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (saving.current || disabled) return
        const form = new FormData(event.currentTarget), title = String(form.get("title") ?? "").trim()
        if (!title) {setError("Enter a task title."); return}
        const dates = readTodoDates(form), invalid = todoDateError(dates.startDate, dates.targetDate)
        if (invalid) {setError(invalid); return}
        saving.current = true; setPending(true); setError("")
        try {await onSave({title, description: String(form.get("description") ?? "").trim(), status: String(form.get("status")), assigneeIds: assignees, ...dates}); onClose()}
        catch (failure) {setError(todoTaskError(failure, "The task could not be saved. Please try again."))}
        finally {saving.current = false; setPending(false)}
    }
    return <Dialog open onOpenChange={open => {if (!open && !saving.current) onClose()}}><DialogContent className="workshop-task-edit-dialog">
        <DialogHeader className="task-edit-header">
            <span className="task-edit-icon" aria-hidden="true"><ClipboardList/></span>
            <div><DialogTitle>Edit task</DialogTitle><DialogDescription>Keep your team up to date on this task.</DialogDescription></div>
        </DialogHeader>
        <form className="task-edit-form" onSubmit={event => void submit(event)}>
            <fieldset disabled={pending || disabled} className="task-edit-fields">
                <div className="task-edit-field"><Label htmlFor={`${formId}-title`}>Task title</Label><Input id={`${formId}-title`} name="title" defaultValue={task.title} autoFocus required maxLength={150} placeholder="What needs to happen?"/></div>
                <div className="task-edit-field"><div className="task-edit-label"><Label htmlFor={`${formId}-description`}>Description</Label><span>Optional</span></div><Textarea id={`${formId}-description`} name="description" defaultValue={task.description} maxLength={2000} rows={4} placeholder="Add context, requirements, or useful links…"/></div>
                <div className="task-edit-metadata">
                    <div className="task-edit-field"><Label htmlFor={`${formId}-status`}>Column</Label><div className="task-edit-select"><WorkshopSelect id={`${formId}-status`} name="status" defaultValue={task.status}>{columns.map(column => <option value={column.id} key={column.id}>{column.name}</option>)}</WorkshopSelect><ChevronDown aria-hidden="true"/></div></div>
                    <div className="task-edit-field"><div className="task-edit-label"><Label>Assignees</Label><span>Optional</span></div><div className="task-edit-assignees"><TodoAssignees ids={assignees} members={members} editable disabled={pending || !!disabled} taskTitle={task.title}
                        onAdd={id => setAssignees(current => [...new Set([...current, id])])} onRemove={id => setAssignees(current => current.filter(value => value !== id))}/></div></div>
                </div>
                <TodoDateFields startDate={task.startDate} targetDate={task.targetDate}/>
                {error && <p role="alert" className="workshop-form-error">{error}</p>}
            </fieldset>
            <footer className="task-edit-footer"><Button variant="outline" type="button" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || disabled}>{pending && <LoaderCircle className="animate-spin"/>}{pending ? "Saving…" : "Save changes"}</Button></footer>
        </form>
    </DialogContent></Dialog>
}

export function TodoTaskDeleteDialog({task, disabled, onClose, onDelete}: {task: TodoTask; disabled?: boolean; onClose: () => void; onDelete: () => Promise<void>}) {
    const [error, setError] = useState(""), [pending, setPending] = useState(false)
    const saving = useRef(false)
    async function remove() {
        if (saving.current || disabled) return
        saving.current = true; setPending(true); setError("")
        try {await onDelete(); onClose()}
        catch (failure) {setError(todoTaskError(failure, "The task could not be deleted. Please try again."))}
        finally {saving.current = false; setPending(false)}
    }
    return <Dialog open onOpenChange={open => {if (!open && !saving.current) onClose()}}><DialogContent className="workshop-modal sm:max-w-md">
        <DialogHeader><DialogTitle>Delete task?</DialogTitle><DialogDescription>“{task.title}” will be permanently removed for everyone on this project.</DialogDescription></DialogHeader>
        {error && <p role="alert" className="workshop-form-error">{error}</p>}
        <div className="flex justify-end gap-2"><Button variant="ghost" disabled={pending} onClick={onClose}>Cancel</Button><Button variant="destructive" disabled={pending || disabled} onClick={() => void remove()}>{pending ? "Deleting…" : "Delete task"}</Button></div>
    </DialogContent></Dialog>
}
