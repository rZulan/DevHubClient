import {useRef, useState, type FormEvent} from "react"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {TodoDateFields} from "./todo-dates"
import {readTodoDates, todoDateError} from "./todo-schedule"
import type {Todo, TodoDates} from "./todo-api"

export function TodoDatesDialog({todo, disabled, onClose, onSave}: {todo: Todo; disabled: boolean; onClose: () => void; onSave: (dates: TodoDates) => Promise<void>}) {
    const [pending, setPending] = useState(false), [error, setError] = useState(""), saving = useRef(false)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (saving.current || disabled) return
        const dates = readTodoDates(new FormData(event.currentTarget)), invalid = todoDateError(dates.startDate, dates.targetDate)
        if (invalid) {setError(invalid); return}
        saving.current = true; setPending(true); setError("")
        try {await onSave(dates); onClose()}
        catch (failure) {setError(typeof failure === "object" && failure && "status" in failure && failure.status === 409 ? "This board changed. Close and reopen this dialog to edit its latest dates." : "The dates could not be saved. Please try again.")}
        finally {saving.current = false; setPending(false)}
    }
    return <Dialog open onOpenChange={open => {if (!open && !saving.current) onClose()}}><DialogContent className="workshop-modal sm:max-w-md">
        <DialogHeader><DialogTitle>TODO dates</DialogTitle><DialogDescription>{todo.name}</DialogDescription></DialogHeader>
        <form onSubmit={event => void submit(event)}><fieldset disabled={pending || disabled} className="todo-schedule-fields"><TodoDateFields startDate={todo.startDate} targetDate={todo.targetDate}/><p className="todo-schedule-hint">Add a From date to show a range in Calendar. Clear both dates to remove this TODO from Calendar.</p></fieldset>
            {error && <p role="alert" className="workshop-form-error">{error}</p>}
            <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || disabled}>{pending ? "Saving…" : "Save dates"}</Button></div>
        </form>
    </DialogContent></Dialog>
}
