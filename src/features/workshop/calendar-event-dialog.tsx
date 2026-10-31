import {useState, type FormEvent} from "react"
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Button} from "@/components/ui/button"
import {WorkshopSelect} from "./workshop-select"
import {calendarEventError, calendarEventKinds, calendarKindLabels, type CalendarEvent} from "./calendar-document"

export function CalendarEventDialog({event, existing, canEdit, timeZone, onSave, onDelete, onClose}: {
    event: CalendarEvent; existing: boolean; canEdit: boolean; timeZone: string; onSave: (event: CalendarEvent) => string; onDelete: () => string; onClose: () => void;
}) {
    const [draft, setDraft] = useState(event), [error, setError] = useState(""), [confirmDelete, setConfirmDelete] = useState(false)
    function update(changes: Partial<CalendarEvent>) {setDraft(current => ({...current, ...changes})); setError(""); setConfirmDelete(false)}
    function submit(form: FormEvent) {
        form.preventDefault(); if (!canEdit) return
        const next = {...draft, title: draft.title.trim(), ...(draft.allDay ? {startTime: "", endTime: ""} : {})}, failure = calendarEventError(next)
        if (failure) {setError(failure); return}
        const saveError = onSave(next); if (saveError) {setError(saveError); return}; onClose()
    }
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}><DialogContent className="calendar-event-dialog">
        <DialogHeader><DialogTitle>{existing ? canEdit ? "Edit event" : "Event details" : "New event"}</DialogTitle><DialogDescription>Times are shown in {timeZone.replaceAll("_", " ")}.</DialogDescription></DialogHeader>
        <form onSubmit={submit}><fieldset disabled={!canEdit}>
            <label>Title<input autoFocus required maxLength={150} value={draft.title} onChange={event => update({title: event.target.value})} placeholder="e.g. Sprint planning"/></label>
            <label>Type<WorkshopSelect value={draft.kind} disabled={!canEdit} onValueChange={value => update({kind: value as CalendarEvent["kind"]})}>{calendarEventKinds.map(kind => <option key={kind} value={kind}>{calendarKindLabels[kind]}</option>)}</WorkshopSelect></label>
            <div className="calendar-form-grid"><label>Start date<input type="date" required value={draft.startDate} onChange={event => update({startDate: event.target.value, ...(event.target.value > draft.endDate ? {endDate: event.target.value} : {})})}/></label><label>End date<input type="date" required min={draft.startDate} value={draft.endDate} onChange={event => update({endDate: event.target.value})}/></label></div>
            <label className="calendar-checkbox"><input type="checkbox" checked={draft.allDay} onChange={event => update({allDay: event.target.checked, startTime: event.target.checked ? "" : "09:00", endTime: event.target.checked ? "" : "10:00"})}/>All day</label>
            {!draft.allDay && <div className="calendar-form-grid"><label>Start time<input type="time" required value={draft.startTime} onChange={event => update({startTime: event.target.value})}/></label><label>End time<input type="time" required value={draft.endTime} onChange={event => update({endTime: event.target.value})}/></label></div>}
            <label>Details<textarea rows={3} maxLength={5000} value={draft.description} onChange={event => update({description: event.target.value})} placeholder="Agenda, location, or a meeting link"/></label>
        </fieldset>
        {error && <p className="calendar-inline-error" role="alert">{error}</p>}
        {confirmDelete && <div className="calendar-delete-confirm" role="alert"><p>Delete “{event.title}” from this project calendar?</p><Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>Keep event</Button><Button type="button" variant="destructive" disabled={!canEdit} onClick={() => {if (canEdit) {const error = onDelete(); if (error) setError(error); else onClose()}}}>Confirm delete</Button></div>}
        <footer>{existing && canEdit && <Button type="button" variant="ghost" className="calendar-delete" onClick={() => setConfirmDelete(true)}>Delete event</Button>}<span/><Button type="button" variant="outline" onClick={onClose}>{canEdit ? "Cancel" : "Close"}</Button>{canEdit && <Button type="submit">{existing ? "Save changes" : "Add event"}</Button>}</footer>
        </form>
    </DialogContent></Dialog>
}
