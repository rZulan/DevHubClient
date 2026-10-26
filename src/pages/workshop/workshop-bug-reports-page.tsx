import {useEffect, useState} from "react"
import {useOutletContext} from "react-router-dom"
import {Bug, Check, Circle, Inbox, LoaderCircle, Mail, Paperclip, Plus, RefreshCw, Search, Tags} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {bugError, bugStatuses} from "@/features/workshop/bug-reports"
import {useListBugReportsQuery, useSubmitTeamBugMutation} from "@/features/workshop/bug-reports-api"
import {BugPortalSettings, BugCategoryManager} from "@/features/workshop/bug-report-settings"
import {BugReportDetail} from "@/features/workshop/bug-report-detail"
import {BugReportForm} from "@/features/workshop/bug-report-form"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/bug-reports.css"

export function WorkshopBugReportsPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><Bug/><h3>No project selected</h3><p>Select or create a project to collect bug reports.</p></section>
    return <BugReportsInbox key={`${userId}:${organization.id}:${project.id}`}/>
}
function BugReportsInbox() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>(), user = useAppSelector(state => state.auth.user)
    const scope = {organizationId: organization.id, projectId: project!.id}, canManage = hasWorkshopPermission(organization, user?.id ?? "current", "Manage bug reports")
    const [status, setStatus] = useState(""), [categoryId, setCategoryId] = useState(""), [search, setSearch] = useState(""), [term, setTerm] = useState(""), [page, setPage] = useState(0)
    const [selected, setSelected] = useState<string | null>(null), [categoriesOpen, setCategoriesOpen] = useState(false), [creating, setCreating] = useState(false), [formVersion, setFormVersion] = useState(0), [receipt, setReceipt] = useState("")
    useEffect(() => {const timer = setTimeout(() => {setTerm(search.trim()); setPage(0)}, 300); return () => clearTimeout(timer)}, [search])
    const inbox = useListBugReportsQuery({...scope, status, categoryId, search: term, page}, {pollingInterval: 30000, skipPollingIfUnfocused: true, refetchOnMountOrArgChange: true})
    const [submitTeam] = useSubmitTeamBugMutation(), categories = inbox.currentData?.categories ?? []
    const data = inbox.currentData
    useEffect(() => {
        if (data && !inbox.isFetching && page > 0 && page * 25 >= data.total) setPage(Math.max(0, Math.ceil(data.total / 25) - 1))
    }, [data, inbox.isFetching, page])
    return <div className="workshop-page bug-page">
        <header className="workshop-page-heading compact bug-page-heading"><div><span className="bug-eyebrow"><Bug/>PROJECT QUALITY</span><h2>Bug Reports</h2><p>{project!.name} <span aria-hidden="true">/</span> From first report to resolution.</p></div><div className="bug-actions">{canManage && <><Button variant="outline" onClick={() => setCategoriesOpen(true)} disabled={!data}><Tags/>Categories</Button><Button onClick={() => {setCreating(value => !value); setReceipt("")}} disabled={!data}><Plus/>{creating ? "Hide draft" : "New report"}</Button></>}</div></header>
        {canManage && <BugPortalSettings scope={scope}/>}
        {receipt && <div className="bug-success" role="status"><Check/>Report {receipt} was added to the inbox.</div>}
        {canManage && data && <section hidden={!creating} className="bug-team-form"><header><h3>New bug report</h3><p>Keep an internal report alongside feedback from your testers.</p></header><BugReportForm key={formVersion} categories={categories} initialEmail={user?.email ?? ""} onSubmit={form => submitTeam({...scope, form}).unwrap()} onSuccess={result => {setReceipt(result.reference); setCreating(false); setFormVersion(value => value + 1); setPage(0); setStatus(""); setCategoryId(""); setSearch("")}} onCancel={() => setCreating(false)}/></section>}
        <section className="bug-stat-grid" aria-label="Bug report overview"><div><span><Inbox/>New reports</span><strong>{data?.newCount ?? "—"}</strong><small>Waiting for a first look</small></div><div><span><Circle/>Open issues</span><strong>{data?.openCount ?? "—"}</strong><small>New, triaged, or in progress</small></div><div><span><Check/>Resolved & closed</span><strong>{data?.resolvedCount ?? "—"}</strong><small>Completed by the team</small></div></section>
        <div className="bug-filter-bar"><label className="bug-search"><Search/><Input aria-label="Search bug reports" maxLength={200} placeholder="Search reports or reporter email…" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter by status" value={status} onChange={event => {setStatus(event.target.value); setPage(0)}}><option value="">All statuses</option>{bugStatuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select><select aria-label="Filter by category" value={categoryId} onChange={event => {setCategoryId(event.target.value); setPage(0)}}><option value="">All categories</option>{categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.archived ? " (archived)" : ""}</option>)}</select><Button variant="outline" size="icon" aria-label="Refresh bug reports" disabled={inbox.isFetching} onClick={() => void inbox.refetch()}><RefreshCw className={inbox.isFetching ? "animate-spin" : ""}/></Button></div>
        <div className={`bug-inbox-layout${selected ? " has-detail" : ""}`}><section className="bug-report-list" aria-label="Project bug reports"><header><h3>Reports <span>{data?.total ?? 0}</span></h3><small>{!canManage ? "View only" : inbox.isFetching ? "Refreshing…" : "Newest first"}</small></header>
            {inbox.isLoading || !data && !inbox.error ? <p className="bug-loading" role="status"><LoaderCircle className="animate-spin"/>Loading reports…</p> : inbox.error ? <div className="bug-list-empty"><Bug/><h3>Couldn’t load reports</h3><p role="alert">{bugError(inbox.error)}</p><Button variant="outline" onClick={() => void inbox.refetch()}>Try again</Button></div> : !data?.items.length ? <div className="bug-list-empty"><span><Bug/></span><h3>{status || categoryId || term ? "No matching reports" : "A clear inbox. A better project."}</h3><p>{status || categoryId || term ? "Try another filter or search term." : canManage ? "Enable your public link and share it with testers, or create the first report here." : "Bug reports shared with this project will appear here."}</p></div> : data.items.map(report => <button type="button" key={report.id} className={`bug-report-row${selected === report.id ? " selected" : ""}`} onClick={() => setSelected(report.id)} aria-label={`Open report: ${report.title}`}><div className="bug-report-row-top"><span className="bug-reference">{report.reference}</span><span className={`bug-priority ${report.priority}`}>{report.priority}</span><time dateTime={report.createdAtUtc}>{new Date(report.createdAtUtc).toLocaleDateString(undefined, {month: "short", day: "numeric"})}</time></div><strong>{report.title}</strong><div className="bug-report-row-meta"><span className={`bug-status ${report.status}`}>{bugStatuses.find(item => item.id === report.status)?.label ?? report.status}</span><span className="bug-category-tag">{categories.find(category => category.id === report.categoryId)?.name ?? "Uncategorized"}</span>{report.attachmentCount > 0 && <span><Paperclip/>{report.attachmentCount}</span>}</div><span className="bug-report-email"><Mail/>{report.email}<small>{report.source === "public" ? "Public" : "Team"}</small></span></button>)}
            {data && data.total > 25 && <footer className="bug-pagination"><Button variant="outline" size="sm" disabled={page === 0 || inbox.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button><span>Page {page + 1} of {Math.ceil(data.total / 25)}</span><Button variant="outline" size="sm" disabled={(page + 1) * 25 >= data.total || inbox.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button></footer>}
        </section>{selected && <BugReportDetail scope={scope} reportId={selected} categories={categories} canManage={canManage} onClose={() => setSelected(null)}/>}</div>
        {canManage && <BugCategoryManager scope={scope} categories={categories} open={categoriesOpen} onOpenChange={setCategoriesOpen}/>}
    </div>
}
