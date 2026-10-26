import {useEffect, useRef, useState, type FormEvent} from "react"
import {Link, useLocation, useOutletContext, useSearchParams} from "react-router-dom"
import {BookOpen, Check, Download, Eye, FileText, History, Home, Link2, LoaderCircle, Pencil, Plus, Search, Trash2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {createClientId} from "@/lib/create-client-id"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {downloadFile} from "@/features/workshop/tool-documents"
import {deleteWikiPage, saveWikiPage, wikiLimits, wikiPageHref, type WikiPage, type WikiRevision} from "@/features/workshop/wiki-document"
import {useWikiDraft, wikiPageVersion} from "@/features/workshop/wiki-draft"
import {WikiMarkdown} from "@/features/workshop/wiki-markdown"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/wiki.css"

export function WorkshopProjectWikiPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const [params] = useSearchParams(), requestedProject = params.get("project")
    if (requestedProject && requestedProject !== project?.id) return <section className="workshop-empty-panel"><BookOpen/><h3>Project unavailable</h3><p>Select an accessible project to open its wiki.</p></section>
    if (!project) return <section className="workshop-empty-panel"><BookOpen/><h3>No project selected</h3><p>Select or create a project to start its wiki.</p></section>
    return <ProjectWiki key={`${userId}:${organization.id}:${project.id}`}/>
}

function ProjectWiki() {
    const {organization, project: selectedProject, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const project = selectedProject!, userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Manage wiki")
    const editor = useToolDocument({organizationId: organization.id, projectId: project.id, tool: "wiki"}, userId, canWrite, isPersistedOrganization)
    const {document, status, canEdit} = editor
    const {draft, update: updateDraft, storageError} = useWikiDraft(`devhub.wiki-draft:${userId}:${organization.id}:${project.id}`)
    const [editing, setEditing] = useState(!!draft && canWrite), [preview, setPreview] = useState(false)
    const [query, setQuery] = useState(""), [formError, setFormError] = useState(""), [copied, setCopied] = useState(false)
    const [deleting, setDeleting] = useState<WikiPage | null>(null), [discarding, setDiscarding] = useState(false)
    const [showHistory, setShowHistory] = useState(false), [historical, setHistorical] = useState<WikiRevision | null>(null)
    const [params, setParams] = useSearchParams(), location = useLocation(), bodyInput = useRef<HTMLTextAreaElement>(null)
    const requestedSlug = params.get("page")
    const page = requestedSlug ? document.pages.find(item => item.slug === requestedSlug) : document.pages.find(item => item.id === document.homePageId)
    const filtered = [...document.pages].filter(item => `${item.title}\n${item.body}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.id === document.homePageId ? -1 : b.id === document.homePageId ? 1 : a.title.localeCompare(b.title))
    const changedRemotely = !!draft && draft.baseVersion !== wikiPageVersion(document.pages.find(item => item.id === draft.id))
    const statusText = status === "loading" ? "Loading wiki…" : status === "load-error" ? "Could not load wiki" : status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : status === "conflict" ? "Save conflict" : status === "error" ? "Save failed" : isPersistedOrganization ? "All changes saved" : "Saved in this browser"
    const author = (id: string) => organization.members.find(member => member.id === id)?.name ?? "Former member"
    const date = (value: string) => new Date(value).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})
    useEffect(() => {setHistorical(null); setShowHistory(false); setCopied(false)}, [requestedSlug])
    useEffect(() => {
        if (location.hash && status === "saved") {
            let id: string
            try {id = decodeURIComponent(location.hash.slice(1))} catch {return}
            window.document.getElementById(id)?.scrollIntoView({block: "start"})
        }
    }, [location.hash, requestedSlug, status])

    function navigatePage(slug: string) {
        setParams(current => {const next = new URLSearchParams(current); next.set("page", slug); return next})
    }
    function startEditing(existing?: WikiPage, title?: string) {
        if (!canEdit) return
        if (draft && draft.id !== existing?.id) {setEditing(true); setFormError("Finish or discard your recovered draft before starting another page."); return}
        updateDraft({id: existing?.id ?? createClientId(), title: existing?.title ?? title ?? "", body: existing?.body ?? "", message: "", baseVersion: wikiPageVersion(existing)})
        setEditing(true); setPreview(false); setFormError("")
    }
    function savePage(event: FormEvent) {
        event.preventDefault()
        if (!draft || !canEdit || changedRemotely) return
        try {
            const next = saveWikiPage(document, draft, userId, createClientId(), new Date().toISOString())
            editor.setDocument(next); navigatePage(next.pages.find(item => item.id === draft.id)!.slug)
            updateDraft(null); setEditing(false); setFormError(""); setHistorical(null)
        } catch (failure) {setFormError((failure as Error).message)}
    }
    function insert(before: string, after = "") {
        if (!draft || !bodyInput.current) return
        const {selectionStart: start, selectionEnd: end} = bodyInput.current
        const body = `${draft.body.slice(0, start)}${before}${draft.body.slice(start, end)}${after}${draft.body.slice(end)}`
        if (body.length > wikiLimits.body) {setFormError("This page has reached its content limit. Shorten it before adding more formatting."); return}
        updateDraft({...draft, body})
        requestAnimationFrame(() => {bodyInput.current?.focus(); bodyInput.current?.setSelectionRange(start + before.length, end + before.length)})
    }
    async function copyLink() {
        if (!page) return
        try {await navigator.clipboard.writeText(`${window.location.origin}${location.pathname}${wikiPageHref(location.search, project.id, page.slug)}`); setCopied(true)}
        catch {setFormError("The page link could not be copied. Copy the address from your browser.")}
    }
    function removePage() {
        if (!deleting || !canEdit) return
        const next = deleteWikiPage(document, deleting.id)
        editor.setDocument(next); setDeleting(null)
        const home = next.pages.find(item => item.id === next.homePageId)
        if (home) navigatePage(home.slug)
        else setParams(current => {const next = new URLSearchParams(current); next.delete("page"); return next})
    }

    return <div className="workshop-page wiki-page">
        <header className="workshop-page-heading compact wiki-heading">
            <div><div className="wiki-eyebrow"><BookOpen/>PROJECT KNOWLEDGE</div><h2>Project Wiki</h2><p>{project.name} <span aria-hidden="true">/</span> A shared home for your documentation.</p></div>
            <div className="wiki-actions"><Button variant="outline" disabled={!document.pages.length} onClick={() => downloadFile(JSON.stringify(document, null, 2), `${project.name}-wiki.json`, "application/json")}><Download/>Backup</Button>{canWrite && <Button disabled={!canEdit || document.pages.length >= wikiLimits.pages || !!draft} onClick={() => startEditing(undefined, document.pages.length ? "" : "Home")}><Plus/>New page</Button>}</div>
        </header>
        <div className="wiki-status"><span role="status">{(status === "loading" || status === "saving") ? <LoaderCircle className="animate-spin"/> : status === "saved" ? <Check/> : null}{statusText}</span><span>{!canWrite ? "View only" : "Markdown supported"}</span></div>
        {editor.error && <div className="wiki-notice" role="alert"><p>{editor.error}</p><div className="wiki-actions"><Button variant="outline" size="sm" onClick={() => downloadFile(JSON.stringify(document, null, 2), "wiki-recovery.json", "application/json")}>Download recovery copy</Button>{status === "conflict" ? <Button variant="outline" size="sm" onClick={editor.reload}>Discard pending saves & reload</Button> : <Button variant="outline" size="sm" onClick={editor.retry}>Retry</Button>}</div></div>}
        {draft && canWrite && !editing && <div className="wiki-notice"><p>You have an unfinished page: <strong>{draft.title || "Untitled page"}</strong></p><div className="wiki-actions"><Button size="sm" onClick={() => setEditing(true)}>Resume draft</Button><Button variant="ghost" size="sm" onClick={() => setDiscarding(true)}>Discard draft</Button></div></div>}
        {formError && !editing && <p className="wiki-notice" role="alert">{formError}</p>}
        {status === "loading" ? <div className="wiki-loading" role="status"><LoaderCircle className="animate-spin"/>Loading project pages…</div> : status !== "load-error" && <div className="wiki-workspace">
            <aside className="wiki-sidebar" aria-label="Wiki pages">
                <div className="wiki-sidebar-title"><strong>Pages</strong><span>{document.pages.length}</span></div>
                <label className="wiki-search"><Search/><Input aria-label="Search wiki pages" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)}/></label>
                <nav aria-label="Wiki page navigation">{filtered.map(item => <Link key={item.id} to={wikiPageHref(location.search, project.id, item.slug)} onClick={() => setEditing(false)} aria-current={page?.id === item.id ? "page" : undefined}>{item.id === document.homePageId ? <Home/> : <FileText/>}<span>{item.title}</span></Link>)}</nav>
                {!filtered.length && <p className="wiki-sidebar-empty">{query ? "No pages match your search." : "Your pages will appear here."}</p>}
                <div className="wiki-sidebar-tip"><BookOpen/><p>Keep guides, decisions, and project know-how in one place.</p></div>
            </aside>
            <section className="wiki-main">
                {editing && draft && canWrite ? <form className="wiki-editor" onSubmit={savePage}>
                    <div className="wiki-editor-heading"><span>{draft.baseVersion === null ? "CREATE A PAGE" : "EDIT PAGE"}</span><small>{storageError ? "Draft recovery unavailable" : "Draft saved in this browser"}</small></div>
                    {storageError && <p className="wiki-notice" role="alert">Browser storage is unavailable. Download your draft before leaving.</p>}
                    {changedRemotely && <p className="wiki-notice" role="alert">This page changed in another session or was deleted. Download your draft, then discard it and reopen the latest page before saving.</p>}
                    {formError && <p className="wiki-notice" role="alert">{formError}</p>}
                    <label htmlFor="wiki-title">Page title</label><Input id="wiki-title" autoFocus required maxLength={wikiLimits.title} readOnly={!canEdit} value={draft.title} placeholder="Give this page a title" onChange={event => updateDraft({...draft, title: event.target.value})}/>
                    <div className="wiki-editor-tabs" role="group" aria-label="Wiki editor mode"><Button type="button" variant={!preview ? "secondary" : "ghost"} aria-pressed={!preview} onClick={() => setPreview(false)}><Pencil/>Write</Button><Button type="button" variant={preview ? "secondary" : "ghost"} aria-pressed={preview} onClick={() => setPreview(true)}><Eye/>Preview</Button></div>
                    {preview ? <div className="wiki-preview" role="region" aria-label="Wiki page preview"><h2>{draft.title || "Untitled page"}</h2>{draft.body ? <WikiMarkdown body={draft.body} pages={document.pages} projectId={project.id}/> : <p>Your formatted page will appear here.</p>}</div> : <>
                        <div className="wiki-formatting" role="group" aria-label="Markdown formatting"><button type="button" disabled={!canEdit} onClick={() => insert("## ")}>Heading</button><button type="button" disabled={!canEdit} onClick={() => insert("**", "**")}><strong>Bold</strong></button><button type="button" disabled={!canEdit} onClick={() => insert("*", "*")}><em>Italic</em></button><button type="button" disabled={!canEdit} onClick={() => insert("[", "](page-title)")}>Link</button><button type="button" disabled={!canEdit} onClick={() => insert("\n```\n", "\n```\n")}>Code</button></div>
                        <label htmlFor="wiki-body" className="sr-only">Page content</label><Textarea id="wiki-body" ref={bodyInput} readOnly={!canEdit} value={draft.body} maxLength={wikiLimits.body} placeholder="Write your documentation in Markdown…" onChange={event => updateDraft({...draft, body: event.target.value})}/>
                    </>}
                    <details className="wiki-guide"><summary>Markdown help & page links</summary><p>Use <code># Heading</code>, <code>**bold**</code>, <code>- lists</code>, <code>- [ ] tasks</code>, and fenced code blocks. Link to another wiki page with <code>[Getting started](getting-started)</code>, or to a section with <code>[Setup](getting-started#setup)</code>. Page addresses stay the same when you rename a page.</p></details>
                    <label htmlFor="wiki-message">Edit summary <span className="wiki-muted">(optional)</span></label><Input id="wiki-message" maxLength={500} readOnly={!canEdit} placeholder="What changed?" value={draft.message} onChange={event => updateDraft({...draft, message: event.target.value})}/>
                    <div className="wiki-editor-footer"><small>The latest 20 previous versions are kept per page.</small><div className="wiki-actions"><Button type="button" variant="ghost" onClick={() => downloadFile(draft.body, `${draft.title || "wiki-draft"}.md`, "text/markdown")} aria-label="Download page draft"><Download/></Button><Button type="button" variant="outline" onClick={() => setEditing(false)}>Keep draft & close</Button><Button type="submit" disabled={!canEdit || changedRemotely || !draft.title.trim()}>Save page</Button></div></div>
                </form> : !document.pages.length && !requestedSlug ? <div className="wiki-empty"><span className="wiki-empty-icon"><BookOpen/></span><span className="wiki-eyebrow">START WITH A SINGLE PAGE</span><h3>Give your project a home.</h3><p>{canWrite ? "From the first setup guide to the decisions behind your code, build a wiki your whole team can turn to." : "Your team's guides and documentation will appear here."}</p>{canWrite && <Button disabled={!canEdit || !!draft} onClick={() => startEditing(undefined, "Home")}><Plus/>Create the first page</Button>}<div className="wiki-empty-ideas"><span><FileText/>Getting started</span><span><BookOpen/>Team guides</span><span><History/>Decisions & context</span></div></div> : !page ? <div className="wiki-empty"><FileText/><h3>Page not found</h3><p>This page may have been deleted, or its link is incomplete.</p>{canWrite && <Button disabled={!canEdit || !!draft || document.pages.length >= wikiLimits.pages} onClick={() => startEditing(undefined, requestedSlug?.replaceAll("-", " "))}><Plus/>Create this page</Button>}</div> : <>
                    <header className="wiki-article-header"><div className="wiki-breadcrumb"><BookOpen/>Wiki <span>/</span> {page.id === document.homePageId ? "Home" : "Documentation"}</div><div className="wiki-article-title"><h2>{page.title}</h2><div className="wiki-actions">{canWrite && <Button variant="outline" size="sm" disabled={!canEdit || !!draft} onClick={() => startEditing(page)}><Pencil/>Edit page</Button>}</div></div><p><span>{author(page.authorId)}</span> updated <time dateTime={page.updatedAt}>{date(page.updatedAt)}</time></p><div className="wiki-article-tools"><Button size="sm" variant={showHistory ? "secondary" : "ghost"} aria-pressed={showHistory} onClick={() => {setShowHistory(value => !value); setHistorical(null)}}><History/>History <span className="wiki-count">{page.history.length + 1}</span></Button><Button size="sm" variant="ghost" onClick={() => void copyLink()}>{copied ? <Check/> : <Link2/>}{copied ? "Copied" : "Copy link"}</Button><Button size="sm" variant="ghost" onClick={() => downloadFile(page.body, `${page.slug}.md`, "text/markdown")}><Download/>Markdown</Button>{canWrite && <><Button size="sm" variant="ghost" disabled={!canEdit || page.id === document.homePageId} onClick={() => editor.setDocument(current => ({...current, homePageId: page.id}))}><Home/>{page.id === document.homePageId ? "Home page" : "Set as home"}</Button><Button size="sm" variant="ghost" className="wiki-delete" disabled={!canEdit} onClick={() => setDeleting(page)} aria-label="Delete page"><Trash2/></Button></>}</div></header>
                    {showHistory && <section className="wiki-history" aria-label="Page revision history"><h3>Page history</h3><p>Current version and up to 20 previous versions. Select a version to read or restore it.</p><button type="button" className={!historical ? "selected" : ""} onClick={() => setHistorical(null)}><strong>Current version</strong><span>{page.message || "Update page"}</span><small>{date(page.updatedAt)} · {author(page.authorId)}</small></button>{page.history.map(revision => <button type="button" key={revision.id} className={historical?.id === revision.id ? "selected" : ""} onClick={() => setHistorical(revision)}><strong>{revision.title}</strong><span>{revision.message || "Update page"}</span><small>{date(revision.updatedAt)} · {author(revision.authorId)}</small></button>)}</section>}
                    {historical && <div className="wiki-notice"><p>Viewing the version from {date(historical.updatedAt)}.</p>{canWrite && <Button size="sm" disabled={!canEdit || !!draft} onClick={() => {startEditing(page); updateDraft({id: page.id, title: historical.title, body: historical.body, message: `Restore version from ${date(historical.updatedAt)}`, baseVersion: wikiPageVersion(page)})}}>Restore this version</Button>}</div>}
                    <article className="wiki-article" aria-label="Wiki page content">{historical && <h2>{historical.title}</h2>}{(historical ?? page).body ? <WikiMarkdown key={`${page.id}:${historical?.id ?? page.updatedAt}`} body={(historical ?? page).body} pages={document.pages} projectId={project.id}/> : <p className="wiki-muted">This page has no content yet.{canWrite ? " Edit the page to start writing." : ""}</p>}</article>
                </>}
            </section>
        </div>}
        <Dialog open={!!deleting} onOpenChange={open => {if (!open) setDeleting(null)}}><DialogContent><DialogHeader><DialogTitle>Delete “{deleting?.title}”?</DialogTitle><DialogDescription>This removes the page and its revision history. Download a backup first if you need to keep a copy.{deleting?.id === document.homePageId && document.pages.length > 1 ? " Another page will become the home page." : ""}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={!canEdit} onClick={removePage}>Delete page</Button></DialogFooter></DialogContent></Dialog>
        <Dialog open={discarding} onOpenChange={setDiscarding}><DialogContent><DialogHeader><DialogTitle>Discard this draft?</DialogTitle><DialogDescription>Your unsaved writing for “{draft?.title || "Untitled page"}” will be removed from this browser.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDiscarding(false)}>Keep draft</Button><Button variant="destructive" onClick={() => {updateDraft(null); setEditing(false); setDiscarding(false); setFormError("")}}>Discard draft</Button></DialogFooter></DialogContent></Dialog>
    </div>
}
