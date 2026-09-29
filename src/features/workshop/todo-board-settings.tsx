import {type FormEvent, useState} from "react"
import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {type Todo, type TodoColumn, useConfigureTodoColumnsMutation} from "./todo-api"

export function TodoBoardSettings({todo, organizationId, onClose}: {
    todo: Todo;
    organizationId: string;
    onClose: () => void
}) {
    const [columns, setColumns] = useState<TodoColumn[]>(() => todo.columns.map(column => ({...column})))
    const [revision] = useState(todo.boardRevision)
    const [error, setError] = useState("")
    const [save, {isLoading}] = useConfigureTodoColumnsMutation()
    const removedTasks = todo.tasks.filter(task => !columns.some(column => column.id === task.status)).length

    function reorder(index: number, direction: number) {
        setColumns(current => {
            const next = [...current]
            ;[next[index], next[index + direction]] = [next[index + direction], next[index]]
            return next
        })
    }

    async function submit(event: FormEvent) {
        event.preventDefault()
        if (isLoading) return
        setError("")
        try {
            await save({
                organizationId,
                projectId: todo.projectId,
                todoId: todo.id,
                columns: columns.map(column => ({...column, name: column.name.trim()})),
                boardRevision: revision
            }).unwrap()
            onClose()
        } catch (failure) {
            setError(typeof failure === "object" && failure !== null && "status" in failure && failure.status === 409
                ? "This TODO changed while you were editing. Close this dialog and reopen it to use the latest board."
                : "The columns could not be saved. Please try again.")
        }
    }

    return <Dialog open onOpenChange={open => {
        if (!open && !isLoading) onClose()
    }}>
        <DialogContent className="workshop-modal sm:max-w-lg">
            <DialogHeader><DialogTitle>Customize board</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="workshop-board-settings">
                <ol>
                    {columns.map((column, index) => <li key={column.id}>
                        <span className="workshop-column-position">{index + 1}</span>
                        <div><Input aria-label={`Column ${index + 1} name`} required maxLength={50} value={column.name}
                                    disabled={isLoading}
                                    onChange={event => setColumns(current => current.map(item => item.id === column.id ? {
                                        ...item,
                                        name: event.target.value
                                    } : item))}/>
                            {index === columns.length - 1 && <small>Complete · rightmost column</small>}
                        </div>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Move ${column.name} left`}
                                title="Move left" disabled={isLoading || index === 0}
                                onClick={() => reorder(index, -1)}><ArrowUp/></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Move ${column.name} right`}
                                title="Move right" disabled={isLoading || index === columns.length - 1}
                                onClick={() => reorder(index, 1)}><ArrowDown/></Button>
                        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${column.name}`}
                                title="Remove column" disabled={isLoading || columns.length === 1}
                                onClick={() => setColumns(current => current.filter(item => item.id !== column.id))}><Trash2/></Button>
                    </li>)}
                </ol>
                <Button type="button" variant="outline" disabled={isLoading || columns.length >= 5}
                        onClick={() => setColumns(current => [...current, {
                            id: `col_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`,
                            name: "New column"
                        }])}><Plus/> Add column ({columns.length}/5)</Button>
                {removedTasks > 0 &&
                    <p className="text-sm text-muted-foreground">{removedTasks} task{removedTasks === 1 ? "" : "s"} in
                        removed columns will move to the nearest remaining column. No tasks will be deleted.</p>}
                {error && <p role="alert" className="workshop-form-error">{error}</p>}
                <div className="workshop-board-settings-actions"><Button type="button" variant="ghost"
                                                                         disabled={isLoading}
                                                                         onClick={onClose}>Cancel</Button><Button
                    type="submit"
                    disabled={isLoading || columns.some(column => !column.name.trim())}>{isLoading ? "Saving…" : "Save columns"}</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
}
