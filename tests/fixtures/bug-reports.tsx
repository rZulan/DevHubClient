// Isolated UI fixture. All reports, links, categories, and files remain in memory.
import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {Link, MemoryRouter, Outlet, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {bugReportsApi} from "@/features/workshop/bug-reports-api"
import type {BugCategory, BugDetail} from "@/features/workshop/bug-reports"
import {WorkshopBugReportsPage} from "@/pages/workshop/workshop-bug-reports-page"
import {PublicBugReportPage} from "@/pages/general/public-bug-report-page"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"

const categories: BugCategory[] = [{id: "ui", name: "Interface", archived: false}, {id: "performance", name: "Performance", archived: false}, {id: "functional", name: "Functionality", archived: false}]
let portal = {token: "a".repeat(64), enabled: false, revision: 0}
const files = new Map<string, File>([["log", new File(["Error: Unhandled save action\nBrowser: Chrome on Windows"], "console.log", {type: "text/plain"})]])
const reports: BugDetail[] = [
    {id: "save-button", title: "Save button doesn't respond on the settings page", description: "Clicking **Save changes** leaves the settings unchanged. There is no error message, but the console logs an unhandled action.", steps: "1. Open project settings\n2. Change the project description\n3. Click Save changes", environment: "Chrome 141 · Windows 11", email: "maya@example.test", categoryId: "functional", priority: "high", status: "new", source: "public", attachments: [{id: "log", fileName: "console.log", contentType: "text/plain", size: files.get("log")!.size}]},
    {id: "mobile-menu", title: "Navigation overlaps content on smaller screens", description: "The navigation overlaps the report form on a narrow phone screen.", steps: "Open the app on a phone and expand the menu.", environment: "Safari · iPhone", email: "jordan@example.test", categoryId: "ui", priority: "medium", status: "triaged", source: "public", attachments: []},
    {id: "slow-search", title: "Search takes several seconds with large projects", description: "Searching a large project takes around five seconds before results appear.", steps: "", environment: "Firefox · macOS", email: "alex@example.test", categoryId: "performance", priority: "low", status: "resolved", source: "team", attachments: []},
].map((report, index) => ({...report, reference: `BUG-PREVIEW000${index + 1}`, createdAtUtc: `2026-10-26T0${5 - index}:00:00Z`, updatedAtUtc: null, internalNotes: index === 2 ? "Added an index to the search query." : "", revision: 0}))
function changed() {window.dispatchEvent(new Event("bug-fixture-change"))}
function json(data: unknown, status = 200) {return new Response(JSON.stringify(data), {status, headers: {"Content-Type": "application/json"}})}
async function submit(form: FormData, source: string) {
    const id = crypto.randomUUID(), attachments = []
    for (const file of form.getAll("files")) if (file instanceof File) {const fileId = crypto.randomUUID(); files.set(fileId, file); attachments.push({id: fileId, fileName: file.name, contentType: file.type, size: file.size})}
    const report: BugDetail = {id, reference: `BUG-${id.slice(0, 12).toUpperCase()}`, title: String(form.get("title")), email: String(form.get("email")), description: String(form.get("description")), steps: String(form.get("steps") ?? ""), environment: String(form.get("environment") ?? ""), categoryId: String(form.get("categoryId") ?? "") || null, priority: String(form.get("priority")), status: "new", source, attachments, createdAtUtc: new Date().toISOString(), updatedAtUtc: null, internalNotes: "", revision: 0}
    reports.unshift(report); changed(); return {reference: report.reference}
}
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, options) => {
    const request = new Request(input, options), url = new URL(request.url)
    if (url.pathname.startsWith("/api/public/bug-reports/")) {
        if (url.pathname.split("/").at(-1) !== portal.token || !portal.enabled) return json({detail: "The report or submission link is unavailable."}, 404)
        if (request.method === "GET") return json({projectName: "Atlas workspace", categories: categories.filter(category => !category.archived)})
        const result = await submit(await request.formData(), "public"); store.dispatch(bugReportsApi.util.invalidateTags(["BugReports"])); return json(result, 201)
    }
    if (url.pathname.includes("/bug-reports/") && url.pathname.includes("/attachments/")) {
        const file = files.get(url.pathname.split("/").at(-1)!); return file ? new Response(file) : json({detail: "Attachment unavailable"}, 404)
    }
    return originalFetch(input, options)
}
bugReportsApi.injectEndpoints({overrideExisting: true, endpoints: builder => ({
    listBugReports: builder.query({queryFn: ({status, categoryId, search, page}) => {
        const filtered = reports.filter(report => (!status || report.status === status) && (!categoryId || report.categoryId === categoryId) && (!search || `${report.title} ${report.email} ${report.reference}`.toLowerCase().includes(search.toLowerCase())))
        return {data: structuredClone({items: filtered.slice(page * 25, page * 25 + 25).map(report => ({...report, attachmentCount: report.attachments.length})), total: filtered.length, newCount: reports.filter(report => report.status === "new").length, openCount: reports.filter(report => !["resolved", "closed"].includes(report.status)).length, resolvedCount: reports.filter(report => ["resolved", "closed"].includes(report.status)).length, categories})}
    }, providesTags: ["BugReports"]}),
    getBugReport: builder.query({queryFn: ({reportId}) => ({data: structuredClone(reports.find(report => report.id === reportId))}), providesTags: ["BugReports"]}),
    getBugPortal: builder.query({queryFn: () => ({data: {...portal}}), providesTags: ["BugPortal"]}),
    saveBugPortal: builder.mutation({queryFn: ({enabled, rotate}) => {portal = {...portal, enabled, revision: portal.revision + 1, token: rotate ? crypto.randomUUID().replaceAll("-", "").repeat(2) : portal.token}; changed(); return {data: {...portal}}}, invalidatesTags: ["BugPortal"]}),
    saveBugCategory: builder.mutation({queryFn: ({id, name, archived}) => {
        if (categories.some(category => category.id !== id && category.name.toLowerCase() === name.toLowerCase())) return {error: {status: 400, data: {detail: "A category with this name already exists."}}}
        let category = categories.find(category => category.id === id)
        if (!category) {category = {id: crypto.randomUUID(), name, archived}; categories.push(category)} else Object.assign(category, {name, archived})
        return {data: {...category}}
    }, invalidatesTags: ["BugReports"]}),
    triageBugReport: builder.mutation({queryFn: input => {const report = reports.find(report => report.id === input.reportId)!; Object.assign(report, {status: input.status, priority: input.priority, categoryId: input.categoryId, internalNotes: input.internalNotes, revision: report.revision + 1}); return {data: structuredClone(report)}}, invalidatesTags: ["BugReports"]}),
    submitTeamBug: builder.mutation({queryFn: async ({form}) => ({data: await submit(form, "team")}), invalidatesTags: ["BugReports"]}),
})})
const project = {id: "preview-project", name: "Atlas workspace", summary: "", status: "Planning" as const, teamIds: [], leadUserId: "current", techStack: [], repository: "", sdlc: "Waterfall", database: "", environments: [], updatedAt: ""}
export function Preview() {
    const [, render] = useState(0), [viewOnly, setViewOnly] = useState(false), [dark, setDark] = useState(false)
    useEffect(() => {const update = () => render(value => value + 1); window.addEventListener("bug-fixture-change", update); return () => window.removeEventListener("bug-fixture-change", update)}, [])
    useEffect(() => {document.documentElement.classList.toggle("dark", dark)}, [dark])
    const context: WorkshopOutletContext = {organization: {id: "bugs-preview", ownerUserId: "current", name: "Preview", description: "", initials: "PV", roles: [], members: [{id: "current", name: "Preview owner", username: "preview", initials: "PV", roleId: "owner", teamIds: [], online: true, isOwner: !viewOnly}], teams: [], projects: [project], tasks: []}, project, selectProject() {}, isPersistedOrganization: false, canInvite: false, openInviteDialog() {}, previewColorScheme() {}}
    return <><nav style={{display: "flex", gap: 20, padding: "12px 24px", borderBottom: "1px solid var(--border)", fontSize: 12, alignItems: "center", flexWrap: "wrap"}}><span>Isolated bug report preview</span><Link to="/bug-reports">Project inbox</Link><Link to={`/report-bug/${portal.token}`}>Public form preview</Link><label><input type="checkbox" checked={viewOnly} onChange={event => setViewOnly(event.target.checked)}/> View only</label><label><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)}/> Dark theme</label></nav><Outlet context={context}/></>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><MemoryRouter initialEntries={["/bug-reports"]}><Routes><Route element={<Preview/>}><Route path="bug-reports" element={<main className="workshop-content" style={{padding: 32}}><WorkshopBugReportsPage/></main>}/><Route path="report-bug/:token" element={<PublicBugReportPage/>}/></Route></Routes></MemoryRouter></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => {root.unmount(); window.fetch = originalFetch})
