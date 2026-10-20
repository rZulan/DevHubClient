// Local browser fixture: uses isolated browser documents and never writes to the API.
import "./ideas-preview-api"
import {useEffect, useLayoutEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, NavLink, Outlet, Route, Routes, useLocation} from "react-router-dom"
import {useCompactWorkshop} from "@/hooks/use-compact-workshop"
import {ResponsiveWorkshopPanel} from "@/features/workshop/responsive-workshop-panel"
import {useChatLauncherPosition} from "@/features/chat/use-chat-launcher-position"
import {WorkshopIdeationPage} from "@/pages/workshop/workshop-ideation-page"
import {store} from "@/app/store"
import {ProjectToolsNavigation} from "@/features/workshop/project-tools-navigation"
import {WorkshopErdPage} from "@/pages/workshop/workshop-erd-page"
import {WorkshopUiEditorPage} from "@/pages/workshop/workshop-ui-editor-page"
import {WorkshopSdlcPage} from "@/pages/workshop/workshop-sdlc-page"
import {WorkshopNotesPage} from "@/pages/workshop/workshop-notes-page"
import {DashboardQuickAction} from "@/features/workshop/dashboard-quick-action"
import {TodoTaskCard} from "@/features/workshop/todo-task-card"
import {TodoTaskEditDialog, TodoTaskDeleteDialog} from "@/features/workshop/todo-task-dialogs"
import {defaultTodoColumns, type TodoTask} from "@/features/workshop/todo-api"
import {paletteTokens} from "@/features/workshop/appearance/color-schemes"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"
const project = {id: "preview-project", name: "Project tools preview", summary: "", status: "Planning" as const, teamIds: [], leadUserId: "current", techStack: [], repository: "", sdlc: "Waterfall", database: "", environments: [], updatedAt: ""}
const context: WorkshopOutletContext = {
    organization: {id: "tools-preview", ownerUserId: "current", name: "Preview", description: "", initials: "PV", roles: [], members: [{id: "current", name: "Preview owner", username: "preview", initials: "PV", roleId: "owner", teamIds: [], online: true, isOwner: true}], teams: [], projects: [project], tasks: []},
    project, selectProject() {}, isPersistedOrganization: false, canInvite: false, openInviteDialog() {}, previewColorScheme() {},
}
function TodoFixture() {
    const [tasks, setTasks] = useState<TodoTask[]>([{id: "preview-task", todoId: "preview-board", projectId: project.id, title: "Design onboarding", description: "Review the first-run experience with the team.", status: "pending", assigneeId: null, assigneeIds: []}])
    const [editing, setEditing] = useState<TodoTask | null>(null), [deleting, setDeleting] = useState<TodoTask | null>(null)
    const [readonly, setReadonly] = useState(false), [error, setError] = useState("")
    const members = context.organization.members
    return <div className="workshop-page workshop-board-page">
        <header className="workshop-page-heading compact"><div><h2>Task interaction preview</h2><p>Isolated example tasks; changes stay in this preview.</p></div><label><input type="checkbox" checked={readonly} onChange={event => setReadonly(event.target.checked)}/> View only</label></header>
        {error && <p role="alert">{error}</p>}
        <div className="workshop-board" style={{"--todo-columns": 3} as React.CSSProperties}>
            {defaultTodoColumns.map(column => <section className="workshop-board-column" key={column.id}><header><strong>{column.name}</strong></header><div className="workshop-task-list">
                {tasks.filter(task => task.status === column.id).map(task => <TodoTaskCard key={task.id} task={task} columns={defaultTodoColumns} members={members} userId="current" canManage={!readonly} disabled={false}
                    onEdit={() => setEditing(task)} onDelete={() => setDeleting(task)} onError={setError}
                    onDuplicate={() => setTasks(current => [...current, {...task, id: crypto.randomUUID(), title: `${task.title} copy`}])}
                    onMove={status => setTasks(current => current.map(item => item.id === task.id ? {...item, status} : item))}
                    onAssign={(id, remove) => setTasks(current => current.map(item => item.id === task.id ? {...item, assigneeIds: remove ? item.assigneeIds.filter(value => value !== id) : [...new Set([...item.assigneeIds, id])]} : item))}/>)}</div></section>)}
        </div>
        {editing && <TodoTaskEditDialog task={editing} columns={defaultTodoColumns} members={members} onClose={() => setEditing(null)} onSave={async details => {setTasks(current => current.map(task => task.id === editing.id ? {...task, ...details} : task))}}/>}
        {deleting && <TodoTaskDeleteDialog task={deleting} onClose={() => setDeleting(null)} onDelete={async () => {setTasks(current => current.filter(task => task.id !== deleting.id))}}/>}
    </div>
}
function DashboardFixture() {
    const [action, setAction] = useState("")
    const cards = [
        {category: "Projects", title: "Create new project", description: "Define ownership, stack, and delivery dates.", to: "../projects"},
        {category: "Tasks", title: "Open task board", description: "Review work assigned across the current project.", to: "../todo"},
        {category: "Notes", title: "Open notes", description: "Capture thoughts and reminders on colorful sticky notes.", to: "../notes"},
        {category: "Teams", title: "Create a team", description: "Choose a team leader and organize members.", onClick: () => setAction("Create team action selected in this isolated preview.")},
    ]
    return <div className="workshop-page"><header className="workshop-page-heading compact"><div><h2>Dashboard</h2><p>Quick actions · isolated visual preview</p></div></header>
        <div className="workshop-widget-grid">{cards.map(card => <section className="workshop-widget" key={card.category} style={{gridColumn: "span 2", gridRow: "span 2"}}><DashboardQuickAction {...card}/></section>)}</div>
        {action && <p role="status" style={{marginTop: 24}}>{action}</p>}
    </div>
}
export function Fixture() {
    const compact = useCompactWorkshop(), location = useLocation()
    const [navigationOpen, setNavigationOpen] = useState(false), [membersOpen, setMembersOpen] = useState(false)
    const launcher = useChatLauncherPosition("responsive-preview")
    useEffect(() => {setNavigationOpen(false); setMembersOpen(false)}, [location.pathname, compact])
    const [expanded, setExpanded] = useState(true)
    const [sidebarUser, setSidebarUser] = useState("current")
    const [theme, setTheme] = useState("light")
    useLayoutEffect(() => {
        const root = document.documentElement
        const tokens = paletteTokens({accent: "#4ade80", background: "#0a1712", surface: "#102219", sidebar: "#0d1d15", text: "#e4eee7"}, "dark")
        root.classList.toggle("dark", theme !== "light")
        for (const [key, value] of Object.entries(tokens)) {if (theme === "dark") root.style.setProperty(key, value); else root.style.removeProperty(key)}
        return () => {root.classList.remove("dark"); for (const key of Object.keys(tokens)) root.style.removeProperty(key)}
    }, [theme])
    return <div className="workshop-shell members-collapsed">
        <ResponsiveWorkshopPanel compact={compact} open={navigationOpen} onOpenChange={setNavigationOpen} title="Workshop navigation" side="left">
        <aside className="workshop-sidebar">
            <p style={{fontSize: 12, padding: 10}}>Isolated tools preview</p>
            <label style={{display: "block", fontSize: 10, padding: 10}}>Preview theme<select aria-label="Preview theme" value={theme} onChange={event => setTheme(event.target.value)} style={{display: "block", padding: 5, width: "100%"}}><option value="light">Light</option><option value="dark-neutral">Dark</option><option value="dark">Dark green</option></select></label>
            <label style={{display: "block", fontSize: 10, padding: 10}}>Sidebar preview user<select aria-label="Sidebar preview user" value={sidebarUser} onChange={event => setSidebarUser(event.target.value)} style={{display: "block", marginTop: 6, border: "1px solid var(--border)", padding: 5, width: "100%"}}><option value="current">Current user</option><option value="teammate">Teammate</option></select></label>
            <NavLink to="dashboard" className={({isActive}) => `workshop-nav-link ${isActive ? "active" : ""}`}>Dashboard</NavLink>
            <ProjectToolsNavigation key={sidebarUser} userId={sidebarUser} organizationId="tools-preview" expanded={expanded} onToggle={() => setExpanded(value => !value)}/>
        </aside>
        </ResponsiveWorkshopPanel>
        <section className="workshop-main-column">
            <header className="workshop-topbar">
                {compact && <button className="workshop-navigation-toggle" aria-label="Open workshop navigation" onClick={() => setNavigationOpen(true)}>Menu</button>}
                <div><small>Preview workshop</small><h1>{location.pathname === "/erd" ? "ERD maker" : location.pathname === "/ui-editor" ? "UI/UX Editor" : location.pathname === "/sdlc" ? "SDLC Roadmap" : location.pathname === "/ideation" ? "Playground" : location.pathname === "/notes" ? "Notes" : "Dashboard"}</h1></div>
                <div className="workshop-topbar-actions"><div className="workshop-project-select"><select aria-label="Current project"><option>Project tools preview</option></select></div><button className="workshop-icon-button" aria-label="Open members" onClick={() => setMembersOpen(true)}>⋯</button></div>
            </header>
            <main className={`workshop-content ${["/erd", "/ui-editor", "/sdlc", "/ideation"].includes(location.pathname) ? "workshop-content-canvas" : ""}`}><Outlet context={context}/></main>
        </section>
        <ResponsiveWorkshopPanel compact open={membersOpen} onOpenChange={setMembersOpen} title="Members" side="right"><aside className="workshop-members"><header><strong>Preview owner</strong></header></aside></ResponsiveWorkshopPanel>
        <button {...launcher} className="workshop-messages-button" aria-label="Messages preview, drag to move">Chat</button>
    </div>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><MemoryRouter initialEntries={["/notes"]}><Routes><Route path="/" element={<Fixture/>}><Route path="dashboard" element={<DashboardFixture/>}/><Route path="erd" element={<WorkshopErdPage/>}/><Route path="ui-editor" element={<WorkshopUiEditorPage/>}/><Route path="sdlc" element={<WorkshopSdlcPage/>}/><Route path="notes" element={<WorkshopNotesPage/>}/><Route path="todo" element={<TodoFixture/>}/><Route path="ideation" element={<WorkshopIdeationPage/>}/><Route path="*" element={<p>Isolated preview</p>}/></Route></Routes></MemoryRouter></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
