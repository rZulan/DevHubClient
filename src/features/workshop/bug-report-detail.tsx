import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useState, type FormEvent} from "react"
import {Download, LoaderCircle, Mail, Paperclip, RefreshCw, X} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Textarea} from "@/components/ui/textarea"
import {NoteMarkdown} from "./note-markdown"
import {bugApiBase, bugError, bugFileSize, bugPriorities, bugStatuses, type BugAttachment, type BugCategory, type BugDetail} from "./bug-reports"
import {bugReportsPath, useGetBugReportQuery, useTriageBugReportMutation, type BugScope} from "./bug-reports-api"

export function BugReportDetail({scope, reportId, categories, canManage, onClose}: {scope: BugScope; reportId: string; categories: BugCategory[]; canManage: boolean; onClose: () => void}) {
    const query = useGetBugReportQuery({...scope, reportId}, {refetchOnMountOrArgChange: true})
    if (query.isLoading || query.currentData?.id !== reportId && !query.error) return <section className="bug-detail"><p className="bug-loading"><LoaderCircle className="animate-spin"/>Loading report…</p></section>
    if (query.error || !query.currentData) return <section className="bug-detail"><p role="alert" className="bug-error">{bugError(query.error, "Could not load this report.")}</p><Button variant="outline" onClick={() => void query.refetch()}><RefreshCw/>Retry</Button><Button variant="ghost" onClick={onClose}>Close</Button></section>
    return <DetailEditor key={`${query.currentData.id}:${query.currentData.revision}`} scope={scope} report={query.currentData} categories={categories} canManage={canManage} onClose={onClose} onReload={() => void query.refetch()}/>
}
function DetailEditor({scope, report, categories, canManage, onClose, onReload}: {scope: BugScope; report: BugDetail; categories: BugCategory[]; canManage: boolean; onClose: () => void; onReload: () => void}) {
    const token = useAppSelector(state => state.auth.accessToken)
    const [status, setStatus] = useState(report.status), [priority, setPriority] = useState(report.priority), [categoryId, setCategoryId] = useState(report.categoryId ?? ""), [notes, setNotes] = useState(report.internalNotes)
    const [save, mutation] = useTriageBugReportMutation(), [error, setError] = useState(""), [conflict, setConflict] = useState(false), [downloading, setDownloading] = useState<string | null>(null)
    const dirty = status !== report.status || priority !== report.priority || categoryId !== (report.categoryId ?? "") || notes !== report.internalNotes
    async function submit(event: FormEvent) {
        event.preventDefault(); setError("")
        try {await save({...scope, reportId: report.id, revision: report.revision, status, priority, categoryId: categoryId || null, internalNotes: notes}).unwrap(); setConflict(false)}
        catch (failure) {setError(bugError(failure)); setConflict((failure as {status?: number}).status === 409)}
    }
    async function download(attachment: BugAttachment) {
        setDownloading(attachment.id); setError("")
        try {
            const response = await fetch(`${bugApiBase}${bugReportsPath(scope)}/${report.id}/attachments/${attachment.id}`, {credentials: "include", headers: token ? {Authorization: `Bearer ${token}`} : {}})
            if (!response.ok) throw {status: response.status, data: await response.json().catch(() => null)}
            const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement("a")
            link.href = url; link.download = attachment.fileName; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000)
        } catch (failure) {setError(bugError(failure, "The attachment could not be downloaded. Refresh your session and try again."))}
        finally {setDownloading(null)}
    }
    return <section className="bug-detail" aria-label="Bug report details">
        <header><span className="bug-reference">{report.reference}</span><Button size="icon-sm" variant="ghost" aria-label="Close report details" onClick={onClose}><X/></Button></header>
        <h3>{report.title}</h3><div className="bug-detail-sender"><Mail/><a href={`mailto:${report.email}`}>{report.email}</a><span>Email supplied by reporter · unverified</span></div><p className="bug-detail-date">{new Date(report.createdAtUtc).toLocaleString()} · {report.source === "public" ? "Public submission" : "Team report"}</p>
        <div className="bug-description"><h4>Description</h4><NoteMarkdown body={report.description}/>{report.steps && <><h4>Steps to reproduce</h4><p className="bug-preformatted">{report.steps}</p></>}{report.environment && <><h4>Environment</h4><p className="bug-preformatted">{report.environment}</p></>}</div>
        <div className="bug-attachments"><h4><Paperclip/>Attachments <span>{report.attachments.length}</span></h4>{report.attachments.length ? report.attachments.map(attachment => <button type="button" key={attachment.id} disabled={!!downloading} onClick={() => void download(attachment)}><Paperclip/><span>{attachment.fileName}<small>{bugFileSize(attachment.size)}</small></span>{downloading === attachment.id ? <LoaderCircle className="animate-spin"/> : <Download/>}</button>) : <p>No attachments.</p>}</div>
        <form className="bug-triage" onSubmit={submit}><h4>Triage</h4><fieldset disabled={!canManage || mutation.isLoading || conflict}>
            <div className="bug-form-columns"><div><label htmlFor="triage-status">Status</label><WorkshopSelect id="triage-status" value={status} onValueChange={selectedValue => setStatus(selectedValue)}>{bugStatuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</WorkshopSelect></div><div><label htmlFor="triage-priority">Priority</label><WorkshopSelect id="triage-priority" value={priority} onValueChange={selectedValue => setPriority(selectedValue)}>{bugPriorities.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</WorkshopSelect></div></div>
            <label htmlFor="triage-category">Category</label><WorkshopSelect id="triage-category" value={categoryId} onValueChange={selectedValue => setCategoryId(selectedValue)}><option value="">Uncategorized</option>{categories.filter(item => !item.archived || item.id === report.categoryId).map(item => <option key={item.id} value={item.id}>{item.name}{item.archived ? " (archived)" : ""}</option>)}</WorkshopSelect>
            <label htmlFor="triage-notes">Internal notes</label><Textarea id="triage-notes" maxLength={10000} value={notes} placeholder="Investigation notes, workarounds, or resolution details…" onChange={event => setNotes(event.target.value)}/>
        </fieldset><p className="bug-field-help">Internal notes are visible only inside the project.</p>{error && <p className="bug-error" role="alert">{error}</p>}{conflict && <><p className="bug-field-help">Copy any unsaved notes before loading the latest report.</p><Button variant="outline" type="button" onClick={onReload}>Discard triage draft & reload</Button></>}{canManage ? <Button type="submit" disabled={!dirty || mutation.isLoading || conflict}>{mutation.isLoading && <LoaderCircle className="animate-spin"/>}Save changes</Button> : <p className="bug-field-help">View only. Ask an owner for Manage bug reports permission to triage this report.</p>}</form>
    </section>
}
