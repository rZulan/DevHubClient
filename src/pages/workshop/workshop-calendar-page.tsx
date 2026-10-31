import {useState} from "react"
import {useNavigate, useOutletContext} from "react-router-dom"
import {CalendarDays} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {downloadFile} from "@/features/workshop/tool-documents"
import {useListTodosQuery} from "@/features/workshop/todo-api"
import {useProjectToolUpdates} from "@/features/workshop/use-project-tool-updates"
import {ProjectCalendar} from "@/features/workshop/project-calendar"
import {CalendarEventDialog} from "@/features/workshop/calendar-event-dialog"
import {calendarItems, type CalendarEvent} from "@/features/workshop/calendar-document"
import {createClientId} from "@/lib/create-client-id"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"

export function WorkshopCalendarPage() {
    const context = useOutletContext<WorkshopOutletContext>(), userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!context.project) return <section className="workshop-empty-panel"><CalendarDays/><h3>No project selected</h3><p>Select a project to view its calendar.</p></section>
    return <CalendarContent key={`${userId}:${context.organization.id}:${context.project.id}`}/>
}
function CalendarContent() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>(), navigate = useNavigate()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current", scope = {organizationId: organization.id, projectId: project!.id}
    const canWrite = hasWorkshopPermission(organization, userId, "Manage tasks")
    const editor = useToolDocument({...scope, tool: "calendar"}, userId, canWrite, isPersistedOrganization)
    const todos = useListTodosQuery(scope, {skip: !isPersistedOrganization, refetchOnFocus: true, refetchOnReconnect: true})
    useProjectToolUpdates({...scope, tool: "todo"}, isPersistedOrganization, () => {void todos.refetch()})
    const [editing, setEditing] = useState<{event: CalendarEvent; existing: boolean} | null>(null)
    function newEvent(date: string) {
        if (!editor.canEdit || editor.document.events.length >= 2000) return
        setEditing({existing: false, event: {id: createClientId(), title: "", description: "", kind: "meeting", startDate: date, endDate: date, allDay: false, startTime: "09:00", endTime: "10:00"}})
    }
    function failure() {
        if (!editor.canEdit || !editing) return "Editing is unavailable. Close this dialog and try again."
        const current = editor.document.events.find(event => event.id === editing.event.id)
        if (editing.existing && JSON.stringify(current) !== JSON.stringify(editing.event)) return "This event was changed or removed by a teammate. Reopen it to edit the latest version."
        if (!editing.existing && (current || editor.document.events.length >= 2000)) return "This event could not be added. Close this dialog and try again."
        return ""
    }
    return <div className="calendar-workspace">
        {editor.status === "loading" && <p className="calendar-data-notice" role="status">Loading calendar…</p>}
        {editor.error && <div className="tool-document-error" role="alert"><span>{editor.error}</span>
            <Button size="sm" variant="outline" onClick={() => downloadFile(JSON.stringify(editor.document, null, 2), "calendar-draft.json", "application/json")}>Download draft</Button>
            {editor.status === "conflict" ? <Button size="sm" variant="outline" onClick={editor.reload}>Discard draft & reload</Button> : <Button size="sm" variant="outline" onClick={editor.retry}>Retry</Button>}
        </div>}
        {isPersistedOrganization && todos.isLoading && <p className="calendar-data-notice" role="status">Loading TODO deadlines…</p>}
        {isPersistedOrganization && todos.isError && <div className="calendar-data-notice" role="alert">TODO deadlines could not be loaded.<Button size="sm" variant="ghost" onClick={() => void todos.refetch()}>Retry</Button></div>}
        {editor.document.events.length >= 2000 && <p className="calendar-data-notice">This calendar has reached its 2,000-event limit.</p>}
        <ProjectCalendar key={editor.document.timeZone} items={calendarItems(editor.document, todos.currentData ?? [])} timeZone={editor.document.timeZone} canEdit={editor.canEdit && editor.document.events.length < 2000} onAdd={newEvent} onOpen={item => {
            if (item.todoId) {navigate({pathname: `/workshop/${organization.id}/todo`, search: new URLSearchParams({project: project!.id, todoProject: project!.id, todo: item.todoId, ...(item.taskId ? {task: item.taskId} : {})}).toString()}); return}
            const event = editor.document.events.find(event => event.id === item.id)
            if (event) setEditing({event, existing: true})
        }}/>
        {editing && <CalendarEventDialog key={editing.event.id} {...editing} canEdit={editor.canEdit} timeZone={editor.document.timeZone} onClose={() => setEditing(null)} onSave={event => {
            const error = failure(); if (error) return error
            editor.setDocument(current => ({...current, events: editing.existing ? current.events.map(item => item.id === event.id ? event : item) : [...current.events, event]})); return ""
        }} onDelete={() => {const error = failure(); if (error) return error; editor.setDocument(current => ({...current, events: current.events.filter(event => event.id !== editing.event.id)})); return ""}}/>}
    </div>
}
