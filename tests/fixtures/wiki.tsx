// Local-only preview: sample pages use isolated browser storage; no API writes.
import {StrictMode, useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Outlet, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {saveWikiPage} from "@/features/workshop/wiki-document"
import {WorkshopProjectWikiPage} from "@/pages/workshop/workshop-project-wiki-page"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"

const organizationId = "wiki-reading-preview", projectId = "sample-project"
const documentKey = `devhub.tool-document:current:${organizationId}:${projectId}:wiki`
const intro = "Welcome to the project wiki. This is where our team keeps setup guides, architecture decisions, and shared knowledge."
const body = ["## Getting started", intro, "### Local setup", "Install the dependencies, configure your environment, and start the development server.", "```md\n## This is code, not a section\n```", "### Team workflow", "Keep changes focused and link related documentation in your review.", "## Architecture", "The application is organized around projects. Each project brings its tools and documentation together.", "### Application layers", "The client handles the user experience. The API validates changes and persists shared content.", "## Release checklist", "- [ ] Review documentation\n- [ ] Run checks\n- [ ] Publish the release", "## Café & 日本語", "Headings with Unicode and **inline formatting** also appear in the contents.", "## Getting started", "Repeated headings receive their own links.", "## Getting started-1", "Names that resemble a generated anchor remain unique."].join("\n\n")
let sample = saveWikiPage({pages: [], homePageId: null}, {id: "home", title: "Project handbook", body, message: "First edition"}, "current", "initial", "2026-10-26T05:00:00Z")
sample = saveWikiPage(sample, {id: "home", title: "Project handbook", body: `${body}\n\n## Next steps\n\nRead the [API guide](api-guide) to learn more.`, message: "Add next steps"}, "current", "update", "2026-10-27T05:00:00Z")
sample = saveWikiPage(sample, {id: "api", title: "API guide", body: "API reference coming soon. This page intentionally has no headings.", message: "Add API guide"}, "current", "api", "2026-10-27T05:00:00Z")
sample = saveWikiPage(sample, {id: "installation", parentId: "home", title: "Installation", body: "## Setup\n\nFollow this guide to install the project.\n\n![DevHub installation reference](/brand/devhub-mark-512.png){width=320 height=180}", message: "Add a nested guide with an image"}, "current", "installation", "2026-10-29T05:00:00Z")
sample = saveWikiPage(sample, {id: "linux", parentId: "installation", title: "Linux setup", body: "Install the required packages.", message: "Add another level"}, "current", "linux", "2026-10-29T05:00:00Z")
if (!localStorage.getItem(documentKey)) localStorage.setItem(documentKey, JSON.stringify({revision: 0, document: sample, pending: false}))

const project = {id: projectId, name: "Atlas workspace", summary: "", status: "Planning" as const, teamIds: [], leadUserId: "current", techStack: [], repository: "", sdlc: "Waterfall", database: "", environments: [], updatedAt: ""}
export function Preview() {
    const [permission, setPermission] = useState("editor"), [width, setWidth] = useState("100%"), [dark, setDark] = useState(true), [version, setVersion] = useState(0)
    useEffect(() => {document.documentElement.classList.toggle("dark", dark)}, [dark])
    const context: WorkshopOutletContext = {organization: {id: organizationId, ownerUserId: "owner", name: "Preview", description: "", initials: "PV", roles: [{id: "member", name: "Member", color: "#f90", order: 1, permissions: permission === "editor" ? ["Manage wiki"] : [], memberCount: 1}], members: [{id: "current", name: "Alex Morgan", username: "alex", initials: "AM", roleId: "member", teamIds: [], online: true, isOwner: permission === "owner"}], teams: [], projects: [project], tasks: []}, project, selectProject() {}, isPersistedOrganization: false, canInvite: false, openInviteDialog() {}, previewColorScheme() {}}
    return <div className={dark ? "dark" : ""} style={{height: "100dvh", background: "var(--background)", color: "var(--foreground)", display: "flex", flexDirection: "column"}}>
        <nav aria-label="Preview controls" style={{display: "flex", gap: 16, padding: "10px 20px", fontSize: 12, borderBottom: "1px solid var(--border)", flexWrap: "wrap", flexShrink: 0}}>
            <strong>Isolated wiki preview</strong><label>Permission <select aria-label="Preview permission" value={permission} onChange={event => setPermission(event.target.value)}><option value="reader">Reader</option><option value="editor">Wiki editor</option><option value="owner">Owner</option></select></label>
            <label>Width <select aria-label="Preview width" value={width} onChange={event => setWidth(event.target.value)}><option value="100%">Desktop</option><option value="850px">Tablet</option><option value="390px">Phone</option></select></label>
            <label><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)}/> Dark</label>
            <button onClick={() => {localStorage.setItem(documentKey, JSON.stringify({revision: 0, document: sample, pending: false})); setVersion(value => value + 1)}}>Reset sample pages</button>
        </nav>
        <main className="workshop-content" style={{width, maxWidth: "100%", alignSelf: "center"}}><Outlet key={version} context={context}/></main>
    </div>
}
const root = createRoot(document.getElementById("root")!)
root.render(<StrictMode><Provider store={store}><MemoryRouter initialEntries={["/project-wiki"]}><Routes><Route element={<Preview/>}><Route path="project-wiki" element={<WorkshopProjectWikiPage/>}/></Route></Routes></MemoryRouter></Provider></StrictMode>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
