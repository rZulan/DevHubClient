import {useState, type CSSProperties, type FormEvent} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowUpRight, Check, Download, Eye, LoaderCircle, Pencil, Plus, StickyNote as StickyNoteIcon, Trash2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Input} from "@/components/ui/input"
import {createClientId} from "@/lib/create-client-id"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {downloadFile, type StickyNote} from "@/features/workshop/tool-documents"
import {noteColors, noteTextColor} from "@/features/workshop/sticky-notes"
import {NoteMarkdown, NoteMarkdownGuide} from "@/features/workshop/note-markdown"
import {NoteBodyEditor} from "@/features/workshop/note-body-editor"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"

function noteStyle(color: string): CSSProperties {
    return {"--note-color": color, "--note-ink": noteTextColor(color)} as CSSProperties
}

export function WorkshopNotesPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><StickyNoteIcon/><h3>No project selected</h3><p>Select or create a project to start collecting notes.</p></section>
    return <NotesBoard key={`${userId}:${organization.id}:${project.id}`}/>
}

function NotesBoard() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Edit ideation")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "notes"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit, status, error} = editor
    const [draft, setDraft] = useState<StickyNote | null>(null)
    const [deleting, setDeleting] = useState<StickyNote | null>(null)
    const [creating, setCreating] = useState(false)
    const [mode, setMode] = useState<"write" | "preview" | "read">("read")
    const atLimit = document.notes.length >= 1000
    const statusText = status === "loading" ? "Loading notes…" : status === "load-error" ? "Could not load notes" : !canWrite ? "View only" : status === "saved" ? isPersistedOrganization ? "All changes saved" : "Saved in this browser" : status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : status === "conflict" ? "Save conflict" : "Save failed"

    function createNote() {
        setCreating(true)
        setMode("write")
        setDraft({id: createClientId(), title: "", body: "", color: noteColors[0].color, updatedAt: new Date().toISOString()})
    }
    function saveNote(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!canEdit || !draft || !draft.title.trim() || creating && atLimit) return
        const note = {...draft, title: draft.title.trim(), updatedAt: new Date().toISOString()}
        setDocument(current => ({notes: creating ? [...current.notes, note] : current.notes.map(item => item.id === note.id ? note : item)}))
        setDraft(note)
        setCreating(false)
        setMode("read")
    }
    function deleteNote() {
        if (!canEdit || !deleting) return
        setDocument(current => ({notes: current.notes.filter(note => note.id !== deleting.id)}))
        setDeleting(null)
        setDraft(null)
    }

    return <div className="workshop-page workshop-notes-page">
        <section className="workshop-page-heading compact">
            <div><h2>Notes</h2><p className="notes-board-status"><span>{document.notes.length} {document.notes.length === 1 ? "note" : "notes"}</span><span aria-hidden="true">·</span><span role="status">{(status === "loading" || status === "saving") && <LoaderCircle className="animate-spin"/>}{statusText}</span></p></div>
            {canWrite && <Button disabled={!canEdit || atLimit} onClick={createNote}><Plus/>Create note</Button>}
        </section>
        {error && <div className="notes-board-error" role="alert"><p>{error}</p><div>
            {(status === "conflict" || status === "error") && <Button size="sm" variant="outline" onClick={() => downloadFile(JSON.stringify(document, null, 2), "notes-draft.json", "application/json")}><Download/>Download draft</Button>}
            {status === "conflict" ? <Button size="sm" variant="outline" onClick={editor.reload}>Discard draft & reload</Button> : <Button size="sm" variant="outline" onClick={editor.retry}>Retry</Button>}
        </div></div>}
        {atLimit && <p className="notes-board-limit">This board has reached 1,000 notes. Delete a note to make room for a new one.</p>}
        {status === "loading" ? <div className="notes-board-loading" aria-label="Loading notes">{Array.from({length: 6}, (_, index) => <div key={index} className="animate-pulse"/>)}</div>
            : status !== "load-error" && (document.notes.length ? <div className="workshop-notes-grid">
                {[...document.notes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)).map(note => <article key={note.id} className="workshop-sticky-note" style={noteStyle(note.color)}>
                    <button type="button" className="sticky-note-open" onClick={() => {setCreating(false); setMode("read"); setDraft({...note})}} aria-label={`Open note: ${note.title}`}/>
                    <span className="sticky-note-heading"><StickyNoteIcon/><strong>{note.title}</strong><ArrowUpRight/></span>
                    <div className={`sticky-note-body ${note.body ? "" : "empty"}`}>{note.body ? <NoteMarkdown body={note.body} compact/> : "No details yet."}</div>
                    <span className="sticky-note-footer"><time dateTime={note.updatedAt}>{new Date(note.updatedAt).toLocaleDateString(undefined, {month: "short", day: "numeric", year: "numeric"})}</time><span>{canWrite ? "Open note" : "View note"}<ArrowUpRight/></span></span>
                </article>)}
            </div> : <section className="workshop-empty-panel notes-empty-panel"><span className="notes-empty-icon"><StickyNoteIcon/></span><h3>A little space for your thoughts</h3><p>{canWrite ? "Capture meeting takeaways, reminders, and bright ideas. Give each note a color of its own." : "Notes shared by your team will appear here."}</p>{canWrite && <Button disabled={!canEdit} onClick={createNote}><Plus/>Create your first note</Button>}</section>)}

        <Dialog open={!!draft} onOpenChange={open => {if (!open) setDraft(null)}}>
            <DialogContent className="notes-editor-dialog w-[calc(100%-2rem)] sm:max-w-xl lg:max-w-5xl">
                <DialogHeader><DialogTitle>{creating ? "Create note" : mode !== "read" ? "Edit note" : "Note preview"}</DialogTitle><DialogDescription>{project!.name} · {mode !== "read" ? "Write in Markdown. Preview your formatting before saving." : "A note shared with your project."}</DialogDescription></DialogHeader>
                {draft && (mode === "read" ? <>
                    <div className="notes-editor-paper notes-reader-paper" style={noteStyle(draft.color)}>
                        <h3>{draft.title}</h3>
                        {draft.body ? <NoteMarkdown body={draft.body}/> : <p className="notes-reader-empty">No details yet.</p>}
                    </div>
                    <DialogFooter className="notes-editor-footer">
                        <Button type="button" variant="outline" onClick={() => setDraft(null)}>Close</Button>
                        {canWrite && <Button type="button" disabled={!canEdit} onClick={() => setMode("write")}><Pencil/>Edit note</Button>}
                    </DialogFooter>
                </> : <form onSubmit={saveNote}>
                    <div className="notes-editor-mode" role="group" aria-label="Note editor mode">
                        <Button type="button" size="sm" variant={mode === "write" ? "secondary" : "ghost"} aria-pressed={mode === "write"} onClick={() => setMode("write")}><Pencil/>Write</Button>
                        <Button type="button" size="sm" variant={mode === "preview" ? "secondary" : "ghost"} aria-pressed={mode === "preview"} onClick={() => setMode("preview")}><Eye/>Preview</Button>
                    </div>
                    <div className="notes-editor-paper" style={noteStyle(draft.color)}>
                        {mode === "write" ? <>
                            <label htmlFor="sticky-note-title" className="sr-only">Note title</label><Input id="sticky-note-title" autoFocus required readOnly={!canEdit} maxLength={150} placeholder="Give your note a title" value={draft.title} onChange={event => setDraft({...draft, title: event.target.value})}/>
                            <NoteBodyEditor body={draft.body} readOnly={!canEdit} onChange={body => setDraft({...draft, body})}/>
                        </> : <div className="notes-editor-preview" role="region" aria-label="Markdown preview"><h3>{draft.title || "Untitled note"}</h3>{draft.body ? <NoteMarkdown body={draft.body}/> : <p className="notes-reader-empty">Your formatted note will appear here.</p>}</div>}
                    </div>
                    <p id="sticky-note-markdown-hint" className="notes-markdown-hint">Markdown supported. Type ``` on a new line to start a code block with grammar and theme controls.</p>
                    <NoteMarkdownGuide/>
                    {canWrite && <fieldset className="note-color-picker" disabled={!canEdit}><legend>Note color</legend><div>
                        {noteColors.map(({name, color}) => <button type="button" key={color} style={{backgroundColor: color, color: noteTextColor(color)}} aria-label={`${name} note color`} aria-pressed={draft.color.toLowerCase() === color} title={name} onClick={() => setDraft({...draft, color})}>{draft.color.toLowerCase() === color && <Check/>}</button>)}
                        <label className="note-custom-color"><input type="color" aria-label="Custom note color" value={draft.color} onInput={event => setDraft({...draft, color: event.currentTarget.value})}/><span>Custom</span></label>
                    </div></fieldset>}
                    {canWrite && !canEdit && <p className="notes-editor-blocked">{status === "conflict" ? "Resolve the save conflict before editing this note. Your draft is still here." : "Editing is temporarily unavailable."}</p>}
                    <DialogFooter className="notes-editor-footer">
                        {!creating && canWrite && <Button type="button" variant="ghost" className="notes-delete-button" disabled={!canEdit} onClick={() => setDeleting(draft)}><Trash2/>Delete</Button>}
                        <Button type="button" variant="outline" onClick={() => setDraft(null)}>{canWrite ? "Cancel" : "Close"}</Button>
                        {canWrite && <Button type="submit" disabled={!canEdit || !draft.title.trim() || creating && atLimit}>{creating ? "Create note" : "Save note"}</Button>}
                    </DialogFooter>
                </form>)}
            </DialogContent>
        </Dialog>
        <Dialog open={!!deleting} onOpenChange={open => {if (!open) setDeleting(null)}}>
            <DialogContent><DialogHeader><DialogTitle>Delete this note?</DialogTitle><DialogDescription>“{deleting?.title}” will be removed from this project.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Keep note</Button><Button variant="destructive" disabled={!canEdit} onClick={deleteNote}>Delete note</Button></DialogFooter></DialogContent>
        </Dialog>
    </div>
}
