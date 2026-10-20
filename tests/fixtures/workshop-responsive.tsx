// Actual workshop shell and pages with an isolated, non-persisted organization.
import "./ideas-preview-api"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {ThemeProvider} from "@/components/theme-provider"
import {WorkshopContext} from "@/features/workshop/workshop-context"
import {WorkshopPresenceContext} from "@/features/workshop/use-workshop-presence"
import {WorkshopLayout} from "@/layouts/workshop-layout"
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
const preview = {organizations: [organization], isLoading: false, organizationById: () => organization, addLocalOrganization: () => organization, removeLocalOrganization: noop, moveTask: noop, addTask: noop, addTeam: noop, addProject: noop, updateProject: noop, saveRoles: noop}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><ThemeProvider><WorkshopContext value={preview}>
    <WorkshopPresenceContext value={{presence: new Map(), currentUserId: undefined, status: "online", setStatus: noop}}>
        <MemoryRouter initialEntries={["/workshop/tools-preview/erd"]}><Routes>
            <Route path="/workshop/:organizationId" element={<WorkshopLayout/>}>
                <Route path="dashboard" element={<WorkshopLobbyPage/>}/><Route path="erd" element={<WorkshopErdPage/>}/><Route path="ui-editor" element={<WorkshopUiEditorPage/>}/><Route path="sdlc" element={<WorkshopSdlcPage/>}/>
                <Route path="ideation" element={<WorkshopIdeationPage/>}/>
                <Route path="projects" element={<WorkshopProjectsPage/>}/><Route path="projects/:projectId" element={<WorkshopProjectDetailPage/>}/>
                <Route path="teams" element={<WorkshopTeamsPage/>}/><Route path="org-chart" element={<WorkshopOrgChartPage/>}/>
                <Route path="settings" element={<WorkshopSettingsLayout/>}><Route path="appearance" element={<AppearanceSettingsPage/>}/><Route path="members" element={<MembersSettingsPage/>}/><Route path="roles" element={<WorkshopRolesPage/>}/></Route>
            </Route>
        </Routes></MemoryRouter>
    </WorkshopPresenceContext>
</WorkshopContext></ThemeProvider></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
