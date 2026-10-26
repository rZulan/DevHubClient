import {useEffect, useRef, useState, type FormEvent} from "react"
import {FileUp, LoaderCircle, Paperclip, X} from "lucide-react"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {createClientId} from "@/lib/create-client-id"
import {bugError, bugFileAccept, bugFileError, bugFileSize, bugFormData, bugPriorities, type BugCategory, type BugFormValues, type BugReceipt} from "./bug-reports"

export function BugReportForm({categories, initialEmail = "", onSubmit, onSuccess, onCancel}: {categories: BugCategory[]; initialEmail?: string; onSubmit: (form: FormData) => Promise<BugReceipt>; onSuccess: (receipt: BugReceipt) => void; onCancel?: () => void}) {
    const [values, setValues] = useState<BugFormValues>({email: initialEmail, title: "", description: "", steps: "", environment: "", priority: "medium", categoryId: ""})
    const [files, setFiles] = useState<File[]>([]), [error, setError] = useState(""), [busy, setBusy] = useState(false), [dragging, setDragging] = useState(false)
    const submissionId = useRef(createClientId()), input = useRef<HTMLInputElement>(null), submitting = useRef(false)
    const dirty = !!(values.title || values.description || values.steps || files.length)
    useEffect(() => {
        const leaving = (event: BeforeUnloadEvent) => {if (dirty) event.preventDefault()}
        window.addEventListener("beforeunload", leaving); return () => window.removeEventListener("beforeunload", leaving)
    }, [dirty])
    const update = (key: keyof BugFormValues, value: string) => setValues(current => ({...current, [key]: value}))
    function addFiles(incoming: File[]) {
        const next = [...files, ...incoming.filter(file => !files.some(item => item.name === file.name && item.size === file.size && item.lastModified === file.lastModified))]
        const failure = bugFileError(next)
        if (failure) {setError(failure); return}
        setFiles(next); setError("")
    }
    async function submit(event: FormEvent) {
        event.preventDefault()
        if (submitting.current) return
        const failure = bugFileError(files)
        if (failure) {setError(failure); return}
        submitting.current = true; setBusy(true); setError("")
        try {onSuccess(await onSubmit(bugFormData(submissionId.current, values, files)))}
        catch (failure) {setError(bugError(failure, "Your report could not be sent. Your writing and files are still here; please try again."))}
        finally {submitting.current = false; setBusy(false)}
    }
    return <form className="bug-submit-form" onSubmit={submit}>
        <fieldset disabled={busy}>
            <label htmlFor="bug-email">Your email <span>Required</span></label><Input id="bug-email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" value={values.email} onChange={event => update("email", event.target.value)}/><p className="bug-field-help">Your email identifies who sent this report. You don’t need a DevHub account.</p>
            <label htmlFor="bug-title">Report title <span>Required</span></label><Input id="bug-title" required maxLength={200} placeholder="A short description of the problem" value={values.title} onChange={event => update("title", event.target.value)}/>
            <div className="bug-form-columns"><div><label htmlFor="bug-category">Category</label><select id="bug-category" value={values.categoryId} onChange={event => update("categoryId", event.target.value)}><option value="">Uncategorized</option>{categories.filter(category => !category.archived).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div><div><label htmlFor="bug-priority">Impact</label><select id="bug-priority" value={values.priority} onChange={event => update("priority", event.target.value)}>{bugPriorities.map(priority => <option key={priority.id} value={priority.id}>{priority.label}</option>)}</select></div></div>
            <label htmlFor="bug-description">What happened? <span>Required</span></label><Textarea id="bug-description" required maxLength={20000} placeholder="Describe the problem, what you expected, and what happened instead." value={values.description} onChange={event => update("description", event.target.value)}/>
            <label htmlFor="bug-steps">Steps to reproduce <span>Optional</span></label><Textarea id="bug-steps" maxLength={10000} placeholder={"1. Open…\n2. Click…\n3. The problem occurs…"} value={values.steps} onChange={event => update("steps", event.target.value)}/>
            <label htmlFor="bug-environment">Browser, device, or page URL <span>Optional</span></label><Input id="bug-environment" maxLength={1000} placeholder="e.g. Chrome on Windows, or the page where it happened" value={values.environment} onChange={event => update("environment", event.target.value)}/>
            <label htmlFor="bug-files">Attachments <span>Optional</span></label>
            <div className={`bug-dropzone${dragging ? " dragging" : ""}`} onDragOver={event => {event.preventDefault(); if (!busy) setDragging(true)}} onDragLeave={() => setDragging(false)} onDrop={event => {event.preventDefault(); setDragging(false); if (!busy) addFiles(Array.from(event.dataTransfer.files))}}>
                <input ref={input} id="bug-files" className="sr-only" type="file" multiple accept={bugFileAccept} onChange={event => {addFiles(Array.from(event.target.files ?? [])); event.target.value = ""}}/>
                <FileUp/><p>Drop screenshots, recordings, or logs here</p><Button type="button" variant="outline" size="sm" onClick={() => input.current?.click()}>Choose files</Button><small>Up to 5 files · 10 MB each · 25 MB total<br/>Images, PDF, ZIP, MP4, WebM, TXT, LOG, CSV, JSON</small>
            </div>
            {!!files.length && <ul className="bug-file-list">{files.map((file, index) => <li key={`${file.name}:${index}`}><Paperclip/><span>{file.name}<small>{bugFileSize(file.size)}</small></span><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${file.name}`} onClick={() => setFiles(current => current.filter((_, i) => i !== index))}><X/></Button></li>)}</ul>}
        </fieldset>
        {error && <p role="alert" className="bug-error">{error}</p>}
        <p className="bug-submit-privacy">Your report, email, and attachments will be visible to members who can access this project. Leave out passwords and access tokens.</p>
        <div className="bug-form-footer">{onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Keep draft & close</Button>}<Button type="submit" disabled={busy || !values.email.trim() || !values.title.trim() || !values.description.trim()}>{busy ? <LoaderCircle className="animate-spin"/> : <Paperclip/>}{busy ? "Sending report…" : "Submit bug report"}</Button></div>
    </form>
}
