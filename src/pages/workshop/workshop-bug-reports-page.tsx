import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {WorkshopNoProject, WorkshopEmptyState} from "@/features/workshop/workshop-empty-state"
import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useEffect, useState} from "react"
import {useOutletContext, useSearchParams} from "react-router-dom"
import {Bug, Check, Circle, Inbox, LoaderCircle, Mail, Paperclip, Plus, RefreshCw, Search, Tags, X} from "lucide-react"
import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {bugError, bugStatuses} from "@/features/workshop/bug-reports"
import {bugReportsApi, useListBugReportsQuery, useSubmitTeamBugMutation} from "@/features/workshop/bug-reports-api"
import {BugPortalSettings, BugCategoryManager} from "@/features/workshop/bug-report-settings"
import {BugReportDetail} from "@/features/workshop/bug-report-detail"
import {BugReportForm} from "@/features/workshop/bug-report-form"
import {projectToolLabels} from "@/features/workshop/project-tools"
import {useProjectToolUpdates} from "@/features/workshop/use-project-tool-updates"
import {useConnectionNodeLink} from "@/features/workshop/connections/use-connection-node-link"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/bug-reports.css"

export function WorkshopBugReportsPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <WorkshopNoProject icon={Bug}/>
    return <BugReportsInbox key={`${userId}:${organization.id}:${project.id}`}/>
}
function BugReportsInbox() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>(), user = useAppSelector(state => state.auth.user)
    const dispatch = useAppDispatch()
    const scope = {organizationId: organization.id, projectId: project!.id}, canManage = hasWorkshopPermission(organization, user?.id ?? "current", "Manage bug reports")
    const [status, setStatus] = useState(""), [categoryId, setCategoryId] = useState(""), [search, setSearch] = useState(""), [term, setTerm] = useState(""), [page, setPage] = useState(0)
    const [params, setParams] = useSearchParams()
    const selected = params.get("project") === project!.id ? params.get("report") : null
    function setSelected(id: string | null) {
        setParams(current => {const next = new URLSearchParams(current); if (id) {next.set("project", project!.id); next.set("report", id)} else next.delete("report"); return next})
    }
    const [categoriesOpen, setCategoriesOpen] = useState(false), [creating, setCreating] = useState(false), [formVersion, setFormVersion] = useState(0), [receipt, setReceipt] = useState("")
    const [focusedCategory, setFocusedCategory] = useState<string>()
    useEffect(() => {const timer = setTimeout(() => {setTerm(search.trim()); setPage(0)}, 300); return () => clearTimeout(timer)}, [search])
    const inbox = useListBugReportsQuery({...scope, status, categoryId, search: term, page}, {pollingInterval: 30000, skipPollingIfUnfocused: true, refetchOnMountOrArgChange: true})
    useProjectToolUpdates({...scope, tool: "bug-reports"}, isPersistedOrganization, () => {
        dispatch(bugReportsApi.util.invalidateTags([{type: "BugReports", id: scope.projectId}]))
    })
    const [submitTeam] = useSubmitTeamBugMutation(), categories = inbox.currentData?.categories ?? inbox.data?.categories ?? []
    const data = inbox.currentData
    useConnectionNodeLink(scope.projectId, ({kind, id}) => {
        if (kind !== "bug-category" || !categories.some(category => category.id === id)) return false
        setCategoryId(id)
        setPage(0)
        if (canManage) {setFocusedCategory(id); setCategoriesOpen(true)}
        return true
    })
    useEffect(() => {
        if (data && !inbox.isFetching && page > 0 && page * 25 >= data.total) setPage(Math.max(0, Math.ceil(data.total / 25) - 1))
    }, [data, inbox.isFetching, page])

    const metrics = [
        {label: "New", count: data?.newCount, icon: Inbox, tone: "new"},
        {label: "Open", count: data?.openCount, icon: Circle, tone: "open"},
        {label: "Resolved & closed", count: data?.resolvedCount, icon: Check, tone: "done"},
    ]
    const hasFilters = Boolean(status || categoryId || term)
    function clearFilters() {
        setStatus("")
        setCategoryId("")
        setSearch("")
        setTerm("")
        setPage(0)
    }

    return <div className="workshop-page bug-page">
        <header className="workshop-page-heading compact bug-page-heading">
            <div className="bug-page-title">
                <h2>{projectToolLabels["bug-reports"]}</h2>
                <p>{project!.name}</p>
            </div>
            {canManage && <div className="bug-actions">
                <Button variant="outline" onClick={() => {setFocusedCategory(undefined); setCategoriesOpen(true)}} disabled={!data}>
                    <Tags/>Categories
                </Button>
                <Button onClick={() => {setCreating(value => !value); setReceipt("")}} disabled={!data}
                    aria-expanded={creating} aria-controls="team-bug-report-form">
                    {creating ? <X/> : <Plus/>}{creating ? "Hide draft" : "New report"}
                </Button>
            </div>}
        </header>

        {canManage && <BugPortalSettings scope={scope}/>}
        {receipt && <WorkshopToast variant="success"><Check/>Report {receipt} added.</WorkshopToast>}
        {canManage && data && <section id="team-bug-report-form" hidden={!creating} className="bug-team-form">
            <header><h3>New report</h3></header>
            <BugReportForm
                key={formVersion} categories={categories} initialEmail={user?.email ?? ""}
                onSubmit={form => submitTeam({...scope, form}).unwrap()}
                onSuccess={result => {
                    setReceipt(result.reference)
                    setCreating(false)
                    setFormVersion(value => value + 1)
                    clearFilters()
                }}
                onCancel={() => setCreating(false)}
            />
        </section>}

        <dl className="bug-stat-strip" aria-label="Issue summary">
            {metrics.map(({label, count, icon: Icon, tone}) => <div key={tone} data-tone={tone}>
                <dt><Icon aria-hidden="true"/>{label}</dt>
                <dd>{count ?? "—"}</dd>
            </div>)}
        </dl>

        <div className={`bug-inbox-layout${selected ? " has-detail" : ""}`}>
            <section className="bug-report-list" aria-label="Project bug reports">
                <header className="bug-inbox-toolbar">
                    <div className="bug-inbox-title">
                        <h3>Reports {data && <span>{data.total}</span>}</h3>
                        {!canManage && <small>View only</small>}
                    </div>
                    <div className="bug-filter-bar">
                        <label className="bug-search">
                            <Search aria-hidden="true"/>
                            <Input aria-label="Search bug reports" maxLength={200} placeholder="Search reports…" value={search} onChange={event => setSearch(event.target.value)}/>
                        </label>
                        <WorkshopSelect aria-label="Filter by status" value={status} onValueChange={value => {setStatus(value); setPage(0)}}>
                            <option value="">All statuses</option>
                            {bugStatuses.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
                        </WorkshopSelect>
                        <WorkshopSelect aria-label="Filter by category" value={categoryId} onValueChange={value => {setCategoryId(value); setPage(0)}}>
                            <option value="">All categories</option>
                            {categories.map(category => <option key={category.id} value={category.id}>{category.name}{category.archived ? " (archived)" : ""}</option>)}
                        </WorkshopSelect>
                        <Button variant="outline" size="icon" aria-label="Refresh bug reports" title="Refresh reports" disabled={inbox.isFetching} onClick={() => void inbox.refetch()}>
                            <RefreshCw className={inbox.isFetching ? "animate-spin" : ""}/>
                        </Button>
                    </div>
                </header>

                {inbox.isLoading || !data && !inbox.error ? (
                    <p className="bug-loading" role="status"><LoaderCircle className="animate-spin"/>Loading reports…</p>
                ) : inbox.error ? (
                    <WorkshopEmptyState className="workshop-empty-state-inset" icon={Bug} title="Could not load reports"
                        description={<span role="alert">{bugError(inbox.error)}</span>}
                        action={<Button variant="outline" onClick={() => void inbox.refetch()}>Try again</Button>}/>
                ) : !data?.items.length ? (
                    <div className="bug-list-empty">
                        <span><Bug aria-hidden="true"/></span>
                        <h4>{hasFilters ? "No matching reports" : "No reports yet"}</h4>
                        {hasFilters && <Button size="sm" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
                    </div>
                ) : data.items.map(report => (
                    <button type="button" key={report.id} className={`bug-report-row${selected === report.id ? " selected" : ""}`} onClick={() => setSelected(report.id)} aria-label={`Open report: ${report.title}`}>
                        <div className="bug-report-row-top">
                            <span className="bug-reference">{report.reference}</span>
                            <span className={`bug-priority ${report.priority}`}>{report.priority}</span>
                            <time dateTime={report.createdAtUtc}>{new Date(report.createdAtUtc).toLocaleDateString(undefined, {month: "short", day: "numeric"})}</time>
                        </div>
                        <strong>{report.title}</strong>
                        <div className="bug-report-row-meta">
                            <span className={`bug-status ${report.status}`}>{bugStatuses.find(item => item.id === report.status)?.label ?? report.status}</span>
                            <span className="bug-category-tag">{categories.find(category => category.id === report.categoryId)?.name ?? "Uncategorized"}</span>
                            {report.attachmentCount > 0 && <span><Paperclip/>{report.attachmentCount}</span>}
                        </div>
                        <span className="bug-report-email"><Mail/>{report.email}<small>{report.source === "public" ? "Public" : "Team"}</small></span>
                    </button>
                ))}
                {data && data.total > 25 && <footer className="bug-pagination">
                    <Button variant="outline" size="sm" disabled={page === 0 || inbox.isFetching} onClick={() => setPage(value => value - 1)}>Previous</Button>
                    <span>Page {page + 1} of {Math.ceil(data.total / 25)}</span>
                    <Button variant="outline" size="sm" disabled={(page + 1) * 25 >= data.total || inbox.isFetching} onClick={() => setPage(value => value + 1)}>Next</Button>
                </footer>}
            </section>
            {selected && <BugReportDetail scope={scope} reportId={selected} categories={categories} canManage={canManage} onClose={() => setSelected(null)}/>}
        </div>
        {canManage && <BugCategoryManager scope={scope} categories={categories} focusedCategory={focusedCategory} open={categoriesOpen} onOpenChange={setCategoriesOpen}/>}
    </div>
}
