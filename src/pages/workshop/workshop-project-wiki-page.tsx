import {useCallback, useEffect, useId, useRef, useState, type FormEvent} from "react"
import {Link, useLocation, useOutletContext, useSearchParams} from "react-router-dom"
import {Bold, BookOpen, Check, ChevronDown, Code, Download, Ellipsis, Eye, FileText, Heading, History, Home, Image as ImageIcon, Italic, Link2, LoaderCircle, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Pencil, Plus, Search, Trash2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Textarea} from "@/components/ui/textarea"
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from "@/components/ui/dropdown-menu"
import {createClientId} from "@/lib/create-client-id"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {downloadFile} from "@/features/workshop/tool-documents"
import {deleteWikiPage, saveWikiPage, wikiAncestors, wikiCanAddSubpage, wikiParentOptions, wikiLimits, wikiPageHref, wikiPageVersion, type WikiPage, type WikiPageForm, type WikiRevision} from "@/features/workshop/wiki-document"
import {WikiTableOfContents} from "@/features/workshop/wiki-table-of-contents"
import type {WikiHeadingNavigation} from "@/features/workshop/wiki-active-heading"
import {WikiMarkdown} from "@/features/workshop/wiki-markdown"
import {WikiCopyLink} from "@/features/workshop/wiki-copy-link"
import {WikiPageNavigation} from "@/features/workshop/wiki-page-navigation"
import {WikiImageDialog} from "@/features/workshop/wiki-image-dialog"
import {WorkshopSelect} from "@/features/workshop/workshop-select"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/wiki.css"

const expandedSections: ReadonlySet<string> = new Set()

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
    const [pageForm, setPageForm] = useState<WikiPageForm | null>(null)
    const [editMode, setEditMode] = useState(false), [editing, setEditing] = useState(false), [preview, setPreview] = useState(false)
    const canManage = canWrite && editMode
    const [query, setQuery] = useState(""), [formError, setFormError] = useState("")
    const [imageOpen, setImageOpen] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true), sidebarId = useId()
    const [hasToc, setHasToc] = useState(false), [tocWide, setTocWide] = useState(false)
    const [tocPreference, setTocPreference] = useState<boolean | null>(null), tocId = useId()
    const tocOpen = tocPreference ?? tocWide
    const [deleting, setDeleting] = useState<WikiPage | null>(null)
    const [showHistory, setShowHistory] = useState(false), [historical, setHistorical] = useState<WikiRevision | null>(null)
    const [sectionState, setSectionState] = useState<{key: string; collapsed: ReadonlySet<string>}>({key: "", collapsed: expandedSections})
    const [headingNavigation, setHeadingNavigation] = useState<WikiHeadingNavigation | null>(null)
    const [params, setParams] = useSearchParams(), location = useLocation(), bodyInput = useRef<HTMLTextAreaElement>(null), article = useRef<HTMLElement>(null)
    const requestedSlug = params.get("page")
    const page = requestedSlug ? document.pages.find(item => item.slug === requestedSlug) : document.pages.find(item => item.id === document.homePageId)
    const contentKey = `${page?.id}:${historical?.id ?? page?.updatedAt}`
    const collapsedSections = sectionState.key === contentKey ? sectionState.collapsed : expandedSections
    const revealSection = useCallback((id: string) => {
        const target = window.document.getElementById(id)
        if (!target) return
        setHeadingNavigation(current => ({contentKey, id, sequence: (current?.sequence ?? 0) + 1}))
        const ancestors: string[] = []
        let section = target?.closest(".wiki-section")
        while (section) {
            const heading = section.querySelector<HTMLElement>(":scope > .wiki-section-heading")
            if (heading?.id) ancestors.push(heading.id)
            section = section.parentElement?.closest(".wiki-section") ?? null
        }
        setSectionState(current => {
            if (current.key !== contentKey || !ancestors.some(anchor => current.collapsed.has(anchor))) return current
            const next = new Set(current.collapsed)
            for (const anchor of ancestors) next.delete(anchor)
            return {key: contentKey, collapsed: next}
        })
        requestAnimationFrame(() => window.document.getElementById(id)?.scrollIntoView({block: "start"}))
    }, [contentKey])
    const parents = pageForm ? wikiParentOptions(document.pages, pageForm.id) : []
    const ancestors = page ? wikiAncestors(document.pages, page.id) : []
    const changedRemotely = !!pageForm && pageForm.baseVersion !== wikiPageVersion(document.pages.find(item => item.id === pageForm.id))
    const savedPage = pageForm ? document.pages.find(item => item.id === pageForm.id) : undefined
    const hasUnsavedEdits = !!pageForm && (pageForm.title !== (savedPage?.title ?? "") || pageForm.body !== (savedPage?.body ?? "") || !!pageForm.message || (pageForm.parentId ?? null) !== (savedPage?.parentId ?? null))
    const statusText = status === "loading" ? "Loading wiki…" : status === "load-error" ? "Could not load wiki" : status === "saving" ? "Saving…" : status === "unsaved" ? "Unsaved changes" : status === "conflict" ? "Save conflict" : status === "error" ? "Save failed" : isPersistedOrganization ? "All changes saved" : "Saved in this browser"
    const author = (id: string) => organization.members.find(member => member.id === id)?.name ?? "Former member"
    const date = (value: string) => new Date(value).toLocaleString(undefined, {dateStyle: "medium", timeStyle: "short"})
    useEffect(() => {
        // Remove the retired per-page recovery data; saved wiki documents use a separate key.
        try {localStorage.removeItem(`devhub.wiki-draft:${userId}:${organization.id}:${project.id}`)} catch { /* Editing does not require browser storage. */ }
    }, [userId, organization.id, project.id])
    useEffect(() => {
        if (!hasUnsavedEdits) return
        function leaving(event: BeforeUnloadEvent) {event.preventDefault()}
        window.addEventListener("beforeunload", leaving)
        return () => window.removeEventListener("beforeunload", leaving)
    }, [hasUnsavedEdits])
    useEffect(() => {setHistorical(null); setShowHistory(false); setEditing(false); setPageForm(null); setImageOpen(false)}, [requestedSlug])
    useEffect(() => {if (!canManage) {setHistorical(null); setShowHistory(false)}}, [canManage])
    useEffect(() => {
        if (!canWrite) {setEditMode(false); setEditing(false); setPageForm(null); setDeleting(null); setImageOpen(false)}
    }, [canWrite])
    useEffect(() => {
        if (location.hash && status === "saved") {
            let id: string
            try {id = decodeURIComponent(location.hash.slice(1))} catch {return}
            revealSection(id)
        }
    }, [location.hash, requestedSlug, status, revealSection])

    function toggleSection(id: string) {
        setSectionState(current => {
            const next = new Set(current.key === contentKey ? current.collapsed : expandedSections)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return {key: contentKey, collapsed: next}
        })
    }
    function setSectionsExpanded(expand: boolean) {
        const ids = [...article.current?.querySelectorAll<HTMLElement>(".wiki-section-heading[id]") ?? []].map(heading => heading.id)
        setSectionState({key: contentKey, collapsed: expand ? expandedSections : new Set(ids)})
    }

    function navigatePage(slug: string) {
        setParams(current => {const next = new URLSearchParams(current); next.set("page", slug); return next})
    }
    function startEditing(existing?: WikiPage, title?: string, parentId: string | null = null) {
        if (!canEdit) return
        if (!existing && parentId && !wikiCanAddSubpage(document.pages, parentId)) {setFormError("This page already has 2 subpages."); return}
        setEditMode(true)
        setPageForm({id: existing?.id ?? createClientId(), title: existing?.title ?? title ?? "", body: existing?.body ?? "", message: "", parentId: existing?.parentId ?? parentId, baseVersion: wikiPageVersion(existing)})
        setEditing(true); setPreview(false); setFormError("")
    }
    function finishEditing() {
        setEditing(false); setPageForm(null); setEditMode(false); setPreview(false); setFormError(""); setDeleting(null); setImageOpen(false)
    }
    function savePage(event: FormEvent) {
        event.preventDefault()
        if (!pageForm || !canEdit || !canManage || changedRemotely) return
        try {
            const next = saveWikiPage(document, pageForm, userId, createClientId(), new Date().toISOString())
            editor.setDocument(next); navigatePage(next.pages.find(item => item.id === pageForm.id)!.slug)
            setPageForm(null); finishEditing(); setHistorical(null)
        } catch (failure) {setFormError((failure as Error).message)}
    }
    function insert(before: string, after = "", replace = false) {
        if (!pageForm || !bodyInput.current || !canEdit || !canManage) return
        const {selectionStart: start, selectionEnd: end} = bodyInput.current
        const body = `${pageForm.body.slice(0, start)}${before}${replace ? "" : pageForm.body.slice(start, end)}${after}${pageForm.body.slice(end)}`
        if (body.length > wikiLimits.body) {setFormError("This page has reached its content limit. Shorten it before adding more formatting."); return}
        setPageForm({...pageForm, body})
        requestAnimationFrame(() => {bodyInput.current?.focus(); bodyInput.current?.setSelectionRange(start + before.length, (replace ? start : end) + before.length)})
    }
    function removePage() {
        if (!deleting || !canEdit || !canManage) return
        const next = deleteWikiPage(document, deleting.id)
        editor.setDocument(next); setDeleting(null)
        const home = next.pages.find(item => item.id === next.homePageId)
        if (home) navigatePage(home.slug)
        else setParams(current => {const next = new URLSearchParams(current); next.delete("page"); return next})
    }

    return <div className="workshop-page wiki-page">
        {editor.error && <div className="wiki-notice" role="alert"><p>{editor.error.replaceAll("your draft", "your changes").replaceAll("A recovered draft conflicts", "Recovered pending saves conflict")}</p><div className="wiki-actions"><Button variant="outline" size="sm" onClick={() => downloadFile(JSON.stringify(document, null, 2), "wiki-recovery.json", "application/json")}>Download recovery copy</Button>{status === "conflict" ? <Button variant="outline" size="sm" onClick={editor.reload}>Discard pending saves & reload</Button> : <Button variant="outline" size="sm" onClick={editor.retry}>Retry</Button>}</div></div>}
        {formError && !editing && <p className="wiki-notice" role="alert">{formError}</p>}
        {status === "loading" ? <div className="wiki-loading" role="status"><LoaderCircle className="animate-spin"/>Loading project pages…</div> : status !== "load-error" && <div className={`wiki-workspace${sidebarOpen ? "" : " wiki-sidebar-collapsed"}`}>
            <aside id={sidebarId} className="wiki-sidebar" aria-label="Wiki pages" hidden={!sidebarOpen}>
                <div className="wiki-sidebar-title"><BookOpen/><strong>{project.name} Wiki</strong></div>
                <label className="wiki-search"><Search/><Input aria-label="Search wiki pages" placeholder="Find a page…" value={query} onChange={event => setQuery(event.target.value)}/></label>
                {canManage && <Button className="wiki-new-page" variant="outline" size="sm" disabled={!canEdit || document.pages.length >= wikiLimits.pages || !!pageForm} onClick={() => startEditing(undefined, document.pages.length ? "" : "Home")}><Plus/>New page</Button>}
                <WikiPageNavigation pages={document.pages} homePageId={document.homePageId} currentId={page?.id} projectId={project.id} query={query} canAdd={canManage && canEdit && !pageForm && document.pages.length < wikiLimits.pages} onAdd={parentId => startEditing(undefined, "", parentId)} onNavigate={() => {setEditing(false); setPageForm(null); setImageOpen(false)}}/>
            </aside>
            <section className="wiki-main">
                <div className="wiki-toolbar">
                    <div className="wiki-toolbar-navigation"><Button variant="ghost" size="icon-sm" aria-label={sidebarOpen ? "Collapse pages sidebar" : "Expand pages sidebar"} title={sidebarOpen ? "Collapse pages sidebar" : "Expand pages sidebar"} aria-expanded={sidebarOpen} aria-controls={sidebarId} onClick={() => setSidebarOpen(value => !value)}>{sidebarOpen ? <PanelLeftClose/> : <PanelLeftOpen/>}</Button><div className="wiki-breadcrumb"><BookOpen/><span>Wiki</span><span aria-hidden="true">/</span><strong>{editing && pageForm && canManage ? pageForm.title || "New page" : page?.title || "Pages"}</strong></div></div>
                    <div className="wiki-actions"><span className="wiki-mode" role="status">{canManage ? <><Pencil/>Editing</> : <><Eye/>Read only</>}</span>{canWrite && (canManage ? <Button variant="outline" size="sm" onClick={finishEditing}><Check/>Done editing</Button> : <Button variant="outline" size="sm" disabled={!canEdit} onClick={() => setEditMode(true)}><Pencil/>Edit wiki</Button>)}{hasToc && page && !editing && <Button className="wiki-toc-toggle" variant="ghost" size="icon-sm" aria-label={tocOpen ? "Collapse table of contents" : "Expand table of contents"} title={tocOpen ? "Collapse table of contents" : "Expand table of contents"} aria-expanded={tocOpen} aria-controls={tocId} onClick={() => setTocPreference(!tocOpen)}>{tocOpen ? <PanelRightClose/> : <PanelRightOpen/>}</Button>}</div>
                </div>
                <span className="sr-only" role="status">{statusText}</span>
                <div className="wiki-main-content">
                {editing && pageForm && canManage ? <form className="wiki-editor" onSubmit={savePage}>
                    <div className="wiki-editor-heading"><span>{pageForm.baseVersion === null ? "CREATE A PAGE" : "EDIT PAGE"}</span></div>
                    {changedRemotely && <p className="wiki-notice" role="alert">This page changed in another session or was deleted. Copy your changes, then cancel editing and reopen the latest page before saving.</p>}
                    {formError && <p className="wiki-notice" role="alert">{formError}</p>}
                    <label htmlFor="wiki-title">Page title</label><Input id="wiki-title" autoFocus required maxLength={wikiLimits.title} readOnly={!canEdit} value={pageForm.title} placeholder="Give this page a title" onChange={event => setPageForm({...pageForm, title: event.target.value})}/>
                    <label htmlFor="wiki-parent">Parent page</label><WorkshopSelect id="wiki-parent" aria-label="Parent page" className="wiki-parent-select" value={pageForm.parentId ?? ""} disabled={!canEdit} onValueChange={parentId => setPageForm({...pageForm, parentId: parentId || null})}><option value="">Top level</option>{pageForm.parentId && !parents.some(parent => parent.id === pageForm.parentId) && <option value={pageForm.parentId} disabled>Parent unavailable — choose another</option>}{parents.map(parent => <option key={parent.id} value={parent.id} disabled={parent.disabled}>{parent.label}{parent.disabled ? " (2 subpages)" : ""}</option>)}</WorkshopSelect>
                    <div className="wiki-editor-tabs" role="group" aria-label="Wiki editor mode"><Button type="button" variant={!preview ? "secondary" : "ghost"} aria-pressed={!preview} onClick={() => setPreview(false)}><Pencil/>Write</Button><Button type="button" variant={preview ? "secondary" : "ghost"} aria-pressed={preview} onClick={() => setPreview(true)}><Eye/>Preview</Button></div>
                    {preview ? <div className="wiki-preview" role="region" aria-label="Wiki page preview"><h2>{pageForm.title || "Untitled page"}</h2>{pageForm.body ? <WikiMarkdown body={pageForm.body} pages={document.pages} projectId={project.id}/> : <p>Your formatted page will appear here.</p>}</div> : <>
                        <div className="wiki-formatting" role="group" aria-label="Markdown formatting">
                            <button type="button" aria-label="Heading" title="Heading" disabled={!canEdit} onClick={() => insert("## ")}><Heading aria-hidden="true"/></button>
                            <button type="button" aria-label="Bold" title="Bold" disabled={!canEdit} onClick={() => insert("**", "**")}><Bold aria-hidden="true"/></button>
                            <button type="button" aria-label="Italic" title="Italic" disabled={!canEdit} onClick={() => insert("*", "*")}><Italic aria-hidden="true"/></button>
                            <button type="button" aria-label="Link" title="Link" disabled={!canEdit} onClick={() => insert("[", "](page-title)")}><Link2 aria-hidden="true"/></button>
                            <button type="button" aria-label="Image" title="Image" disabled={!canEdit} onClick={() => setImageOpen(true)}><ImageIcon aria-hidden="true"/></button>
                            <button type="button" aria-label="Code" title="Code block" disabled={!canEdit} onClick={() => insert("\n```\n", "\n```\n")}><Code aria-hidden="true"/></button>
                        </div>
                        <label htmlFor="wiki-body" className="sr-only">Page content</label><Textarea id="wiki-body" ref={bodyInput} readOnly={!canEdit} value={pageForm.body} maxLength={wikiLimits.body} placeholder="Write your documentation in Markdown…" onChange={event => setPageForm({...pageForm, body: event.target.value})}/>
                    </>}
                    <label htmlFor="wiki-message">Edit summary <span className="wiki-muted">(optional)</span></label><Input id="wiki-message" maxLength={500} readOnly={!canEdit} placeholder="What changed?" value={pageForm.message} onChange={event => setPageForm({...pageForm, message: event.target.value})}/>
                    <div className="wiki-editor-footer"><small>The latest 20 previous versions are kept per page.</small><div className="wiki-actions"><Button type="button" variant="outline" onClick={() => {setEditing(false); setPageForm(null); setPreview(false); setFormError(""); setImageOpen(false)}}>Cancel</Button><Button type="submit" disabled={!canEdit || changedRemotely || !pageForm.title.trim()}>Save page</Button></div></div>
                </form> : !document.pages.length && !requestedSlug ? <div className="wiki-empty"><span className="wiki-empty-icon"><BookOpen/></span><span className="wiki-eyebrow">START WITH A SINGLE PAGE</span><h3>Give your project a home.</h3><p>{canWrite ? "From the first setup guide to the decisions behind your code, build a wiki your whole team can turn to." : "Your team's guides and documentation will appear here."}</p>{canManage && <Button disabled={!canEdit || !!pageForm} onClick={() => startEditing(undefined, "Home")}><Plus/>Create the first page</Button>}<div className="wiki-empty-ideas"><span><FileText/>Getting started</span><span><BookOpen/>Team guides</span><span><History/>Decisions & context</span></div></div> : !page ? <div className="wiki-empty"><FileText/><h3>Page not found</h3><p>This page may have been deleted, or its link is incomplete.</p>{canManage && <Button disabled={!canEdit || !!pageForm || document.pages.length >= wikiLimits.pages} onClick={() => startEditing(undefined, requestedSlug?.replaceAll("-", " "))}><Plus/>Create this page</Button>}</div> : <>
                    <div className="wiki-reader"><div className="wiki-reader-document"><header className="wiki-article-header">
                        {ancestors.length > 0 && <nav className="wiki-page-ancestry" aria-label="Parent pages">{ancestors.map(parent => <span key={parent.id}><Link to={wikiPageHref(location.search, project.id, parent.slug)}>{parent.title}</Link><span aria-hidden="true">/</span></span>)}</nav>}
                        <div className="wiki-article-title">
                            <div className="wiki-page-title-label"><h2>{page.title}</h2><WikiCopyLink key={page.id} href={`${location.pathname}${wikiPageHref(location.search, project.id, page.slug)}`} title={page.title}/></div>
                            <div className="wiki-actions">
                                {canManage && <><Button variant="outline" size="sm" disabled={!canEdit || !!pageForm} onClick={() => startEditing(page)}><Pencil/>Edit page</Button>
                                    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Page actions" title="Page actions"><Ellipsis/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="min-w-44">
                                            <DropdownMenuItem disabled={!canEdit || !!pageForm || document.pages.length >= wikiLimits.pages || !wikiCanAddSubpage(document.pages, page.id)} title={!wikiCanAddSubpage(document.pages, page.id) ? "Maximum of 2 subpages reached" : undefined} onSelect={() => startEditing(undefined, "", page.id)}><Plus/>Add subpage</DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => {setShowHistory(value => !value); setHistorical(null)}}><History/>{showHistory ? "Hide history" : "Page history"}<span className="wiki-count ml-auto">{page.history.length + 1}</span></DropdownMenuItem>
                                            <DropdownMenuItem onSelect={() => downloadFile(page.body, `${page.slug}.md`, "text/markdown")}><Download/>Download Markdown</DropdownMenuItem>
                                            <DropdownMenuItem disabled={!canEdit || page.id === document.homePageId} onSelect={() => editor.setDocument(current => ({...current, homePageId: page.id}))}><Home/>{page.id === document.homePageId ? "Home page" : "Set as home"}</DropdownMenuItem>
                                            <DropdownMenuSeparator/>
                                            <DropdownMenuItem variant="destructive" disabled={!canEdit} onSelect={() => setDeleting(page)}><Trash2/>Delete page</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </>}
                                {hasToc && <button type="button" className="wiki-section-toggle" aria-label={collapsedSections.size ? "Expand all wiki sections" : "Collapse all wiki sections"} title={collapsedSections.size ? "Expand all sections" : "Collapse all sections"} aria-expanded={!collapsedSections.size} onClick={() => setSectionsExpanded(!!collapsedSections.size)}><ChevronDown aria-hidden="true"/></button>}
                            </div>
                        </div>
                    </header>
                    {showHistory && <section className="wiki-history" aria-label="Page revision history"><h3>Page history</h3><p>Current version and up to 20 previous versions. Select a version to read or restore it.</p><button type="button" className={!historical ? "selected" : ""} onClick={() => setHistorical(null)}><strong>Current version</strong><span>{page.message || "Update page"}</span><small>{date(page.updatedAt)} · {author(page.authorId)}</small></button>{page.history.map(revision => <button type="button" key={revision.id} className={historical?.id === revision.id ? "selected" : ""} onClick={() => setHistorical(revision)}><strong>{revision.title}</strong><span>{revision.message || "Update page"}</span><small>{date(revision.updatedAt)} · {author(revision.authorId)}</small></button>)}</section>}
                    {historical && <div className="wiki-notice"><p>Viewing the version from {date(historical.updatedAt)}.</p>{canManage && <Button size="sm" disabled={!canEdit || !!pageForm} onClick={() => {startEditing(page); setPageForm({id: page.id, title: historical.title, body: historical.body, message: `Restore version from ${date(historical.updatedAt)}`, parentId: page.parentId ?? null, baseVersion: wikiPageVersion(page)})}}>Restore this version</Button>}</div>}
                    <article ref={article} className="wiki-article" aria-label="Wiki page content">{historical && <h2>{historical.title}</h2>}{(historical ?? page).body ? <WikiMarkdown key={`${page.id}:${historical?.id ?? page.updatedAt}`} body={(historical ?? page).body} pages={document.pages} projectId={project.id} pageSlug={page.slug} collapsedSections={collapsedSections} onToggleSection={toggleSection} onRevealSection={revealSection}/> : <p className="wiki-muted">This page has no content yet.{canWrite ? " Edit the page to start writing." : ""}</p>}</article>
                </div><WikiTableOfContents article={article} contentKey={`${page.id}:${historical?.id ?? page.updatedAt}`} body={(historical ?? page).body} id={tocId} expanded={tocOpen} onAvailableChange={setHasToc} onWideChange={setTocWide} headingNavigation={headingNavigation} collapsedSections={collapsedSections} onToggleSection={toggleSection} onRevealSection={revealSection} onExpandAll={() => setSectionsExpanded(true)} onCollapseAll={() => setSectionsExpanded(false)}/></div></>}
                </div>
            </section>
        </div>}
        {imageOpen && editing && canManage && canEdit && <WikiImageDialog onInsert={markdown => insert(markdown, "", true)} onClose={() => setImageOpen(false)}/>}
        <Dialog open={!!deleting} onOpenChange={open => {if (!open) setDeleting(null)}}><DialogContent><DialogHeader><DialogTitle>Delete “{deleting?.title}”?</DialogTitle><DialogDescription>This removes the page and its revision history. Download the page as Markdown first if you need to keep its content.{document.pages.some(item => item.parentId === deleting?.id) ? " Its subpages will move up one level where space is available, or to the top level. Their content and links will be kept." : ""}{deleting?.id === document.homePageId && document.pages.length > 1 ? " Another page will become the home page." : ""}</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="destructive" disabled={!canEdit} onClick={removePage}>Delete page</Button></DialogFooter></DialogContent></Dialog>
    </div>
}
