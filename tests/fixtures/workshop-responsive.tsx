// Actual workshop shell and pages with an isolated, non-persisted organization.
import "./ideas-preview-api"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Outlet, Route, Routes, useOutletContext} from "react-router-dom"
import {store} from "@/app/store"
import {ThemeProvider} from "@/components/theme-provider"
import {WorkshopContext} from "@/features/workshop/workshop-context"
import {WorkshopPresenceContext} from "@/features/workshop/use-workshop-presence"
import {WorkshopLayout, type WorkshopOutletContext} from "@/layouts/workshop-layout"
import {WorkshopPage} from "@/pages/workshop/workshop-page"
import {setUser} from "@/features/auth/auth-slice"
import {WorkshopErdPage} from "@/pages/workshop/workshop-erd-page"
import {WorkshopIdeationPage} from "@/pages/workshop/workshop-ideation-page"
import {WorkshopUiEditorPage} from "@/pages/workshop/workshop-ui-editor-page"
import {WorkshopSdlcPage} from "@/pages/workshop/workshop-sdlc-page"
import {WorkshopLobbyPage} from "@/pages/workshop/workshop-lobby-page"
import {WorkshopProjectsPage} from "@/pages/workshop/projects/workshop-projects-page"
import {WorkshopProjectDetailPage} from "@/pages/workshop/projects/workshop-project-detail-page"
import {WorkshopTeamsPage} from "@/pages/workshop/organization/workshop-teams-page"
import {WorkshopOrgChartPage} from "@/pages/workshop/organization/workshop-org-chart-page"
import {WorkshopRolesPage} from "@/pages/workshop/organization/workshop-roles-page"
import {WorkshopSettingsLayout} from "@/pages/workshop/settings/workshop-settings-layout"
import {AppearanceSettingsPage} from "@/pages/workshop/settings/appearance-settings-page"
import {MembersSettingsPage} from "@/pages/workshop/settings/members-settings-page"
import {GeneralSettingsPage} from "@/pages/workshop/settings/general-settings-page"
import {InvitesSettingsPage} from "@/pages/workshop/settings/invites-settings-page"
import {WorkshopTodoPage} from "@/pages/workshop/workshop-todo-page"
import {WorkshopCalendarPage} from "@/pages/workshop/workshop-calendar-page"
import {WorkshopNotesPage} from "@/pages/workshop/workshop-notes-page"
import {WorkshopProjectWikiPage} from "@/pages/workshop/workshop-project-wiki-page"
import {WorkshopBugReportsPage} from "@/pages/workshop/workshop-bug-reports-page"
import {WorkshopStateMachinePage} from "@/pages/workshop/workshop-state-machine-page"
import type {WorkshopOrganization} from "@/features/workshop/workshop-types"
import "@/index.css"

const organization: WorkshopOrganization = {
    id: "tools-preview", ownerUserId: "current", name: "Preview workshop", description: "Isolated responsive preview", initials: "PW",
    roles: [{id: "owner", name: "Org owner", color: "#a78bfa", order: 0, permissions: [], isOwnerRole: true}],
    members: [{id: "current", name: "Preview owner", username: "preview", initials: "PV", roleId: "owner", teamIds: ["preview-team"], online: true, isOwner: true}],
    teams: [{id: "preview-team", name: "Product team", description: "Design and development", color: "#a78bfa", leaderId: "current", memberIds: ["current"]}],
    projects: [{id: "preview-project", name: "Project tools preview", summary: "Design, build and deliver the project together.", status: "Planning", teamIds: ["preview-team"], leadUserId: "current", techStack: ["React", "TypeScript"], repository: "", sdlc: "Waterfall", database: "PostgreSQL", environments: [], updatedAt: "2026-10-15"}], tasks: [],
}
const noop = () => {}
const requestedPage = new URLSearchParams(window.location.search).get("page") ?? "erd"
const populated = new URLSearchParams(window.location.search).has("populated")
if (populated) {
    store.dispatch(setUser({id: "current", email: "preview@example.test", firstName: "Preview", lastName: "Owner", username: "preview"}))
    organization.roles.push({id: "designer", name: "Product designer", color: "#38bdf8", order: 1, permissions: ["Edit UI designs", "Manage notes"]})
    organization.members.push(...Array.from({length: 5}, (_, index) => ({id: `member-${index}`, name: ["Alex Rivera", "Sam Chen", "Jordan Williams", "Morgan Taylor", "Avery Santos"][index], username: `member_${index}`, initials: ["AR", "SC", "JW", "MT", "AS"][index], roleId: "designer", roleIds: ["designer"], teamIds: ["preview-team"], online: index < 2})))
    const now = new Date().toISOString()
    const documents = {
        notes: {notes: ["Plan the next release", "Design review feedback", "Ideas for onboarding"].map((title, index) => ({id: `note-${index}`, title, body: "Keep the experience clear and welcoming.\n\n- Review mobile navigation\n- Share progress with the team\n- Test the final experience", color: ["#fef3c7", "#dbeafe", "#dcfce7"][index], updatedAt: now}))},
        wiki: {homePageId: "welcome", pages: ["Welcome to the project", "Getting started", "Development guide", "Release checklist"].map((title, index) => ({id: index ? `wiki-${index}` : "welcome", slug: index ? `guide-${index}` : "welcome", title, body: "# Overview\n\nA shared space to plan, build, and deliver thoughtful experiences.\n\n## Getting started\n\nKeep the project easy to explore on every screen size.\n\n## Working together\n\nShare notes, review designs, and track the next release.\n\n```ts\nconst workshop = { responsive: true, team: 'Product' }\n```", message: "Initial page", authorId: "current", updatedAt: now, history: []}))},
        calendar: {timeZone: "Asia/Manila", events: ["Team design review", "Release planning", "Workshop milestone"].map((title, index) => ({id: `event-${index}`, title, description: "Review progress and plan the next steps.", kind: "meeting", startDate: `2026-10-${20 + index * 3}`, endDate: `2026-10-${20 + index * 3}`, allDay: false, startTime: "09:00", endTime: "10:00"}))},
    }
    for (const [tool, document] of Object.entries(documents)) localStorage.setItem(`devhub.tool-document:current:tools-preview:preview-project:${tool}`, JSON.stringify({revision: 0, pending: false, document}))
}
export function PreviewPageContext() {
    const context = useOutletContext<WorkshopOutletContext>()
    return <Outlet context={{...context, isPersistedOrganization: populated && requestedPage.startsWith("settings/")}}/>
}
const preview = {organizations: [organization], isLoading: false, organizationById: () => organization, addLocalOrganization: () => organization, removeLocalOrganization: noop, moveTask: noop, addTask: noop, addTeam: noop, addProject: noop, updateProject: noop, saveRoles: noop}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><ThemeProvider><WorkshopContext value={preview}>
    <WorkshopPresenceContext value={{presence: new Map(), currentUserId: undefined, status: "online", setStatus: noop}}>
        <MemoryRouter initialEntries={[requestedPage === "entry" ? "/workshop?choose=1" : `/workshop/tools-preview/${requestedPage}`]}><Routes>
            <Route path="/workshop" element={<WorkshopPage/>}/>
            <Route path="/workshop/:organizationId" element={<WorkshopLayout/>}>
                <Route element={<PreviewPageContext/>}>
                <Route path="dashboard" element={<WorkshopLobbyPage/>}/><Route path="erd" element={<WorkshopErdPage/>}/><Route path="ui-editor" element={<WorkshopUiEditorPage/>}/><Route path="sdlc" element={<WorkshopSdlcPage/>}/>
                <Route path="ideation" element={<WorkshopIdeationPage/>}/>
                <Route path="todo" element={<WorkshopTodoPage/>}/><Route path="calendar" element={<WorkshopCalendarPage/>}/>
                <Route path="notes" element={<WorkshopNotesPage/>}/><Route path="project-wiki" element={<WorkshopProjectWikiPage/>}/>
                <Route path="bug-reports" element={<WorkshopBugReportsPage/>}/><Route path="state-machine" element={<WorkshopStateMachinePage/>}/>
                <Route path="projects" element={<WorkshopProjectsPage/>}/><Route path="projects/:projectId" element={<WorkshopProjectDetailPage/>}/>
                <Route path="teams" element={<WorkshopTeamsPage/>}/><Route path="org-chart" element={<WorkshopOrgChartPage/>}/>
                <Route path="settings" element={<WorkshopSettingsLayout/>}><Route path="general" element={<GeneralSettingsPage/>}/><Route path="appearance" element={<AppearanceSettingsPage/>}/><Route path="members" element={<MembersSettingsPage/>}/><Route path="invites" element={<InvitesSettingsPage/>}/><Route path="roles" element={<WorkshopRolesPage/>}/></Route>
                </Route>
            </Route>
        </Routes></MemoryRouter>
    </WorkshopPresenceContext>
</WorkshopContext></ThemeProvider></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
