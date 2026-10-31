// Isolated, in-memory API. Changes here never contact or update a real organization.
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Outlet, Route, Routes} from "react-router-dom"
import {store} from "@/app/store"
import {setUser} from "@/features/auth/auth-slice"
import {ThemeProvider} from "@/components/theme-provider"
import {WorkshopContext} from "@/features/workshop/workshop-context"
import {seedOrganizations} from "@/features/workshop/workshop-data"
import {WorkshopTeamsPage} from "@/pages/workshop/organization/workshop-teams-page"
import {WorkshopOrgChartPage} from "@/pages/workshop/organization/workshop-org-chart-page"
import {api, useListTeamsQuery} from "@/services/api"
import type {ApiTeam, WorkshopOrganization} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"

const params = new URLSearchParams(location.search)
const organization: WorkshopOrganization = structuredClone(seedOrganizations[0])
organization.id = "12345678-1234-4234-8234-123456789012"
organization.members[0] = {...organization.members[0], name: "Alex Morgan", username: "alexmorgan", initials: "AM", isOwner: true}
organization.roles[0].isOwnerRole = true
organization.members.push({id: "unassigned", name: "Jordan Taylor", username: "jordant", initials: "JT", roleId: "member", teamIds: [], online: false})
organization.members.forEach(member => {member.teamIds = []})
let teams: ApiTeam[] = organization.teams.map(team => ({id: team.id, organizationId: organization.id, leaderUserId: team.leaderId, name: team.name, description: team.description, memberIds: team.memberIds, memberCount: team.memberIds.length, createdAtUtc: new Date().toISOString()}))
let failAdd = params.get("fail") === "add-once"
let failUpdate = params.get("fail") === "update-once"
const wait = () => new Promise(resolve => setTimeout(resolve, Number(params.get("delay") ?? 50)))
const tags = [{type: "Teams" as const, id: organization.id}]
api.injectEndpoints({overrideExisting: true, endpoints: builder => ({
    listTeams: builder.query({queryFn: async () => {await wait(); return params.get("fail") === "load" ? {error: {status: 500, data: {detail: "Preview load failure"}}} : {data: structuredClone(teams)}}, providesTags: tags}),
    listOrganizationRoles: builder.query({queryFn: () => ({data: organization.roles.map(role => ({...role, position: role.order, isOwnerRole: Boolean(role.isOwnerRole), isDefaultRole: false, memberCount: 1}))})}),
    listOrganizationMembers: builder.query({queryFn: () => ({data: organization.members.map(member => ({...member, firstName: member.name.split(" ")[0], lastName: member.name.split(" ").slice(1).join(" "), email: `${member.username}@example.test`, createdAtUtc: new Date().toISOString(), isOwner: Boolean(member.isOwner), roleIds: [member.roleId]}))})}),
    createTeam: builder.mutation({queryFn: async (input: {name: string; description?: string; leaderUserId: string}) => {await wait(); if (teams.some(team => team.name.toLowerCase() === input.name.toLowerCase())) return {error: {status: 409, data: {detail: "A team with this name already exists."}}}; const team = {...input, id: crypto.randomUUID(), organizationId: organization.id, memberIds: [input.leaderUserId], memberCount: 1, createdAtUtc: new Date().toISOString()}; teams.push(team); return {data: structuredClone(team)}}, invalidatesTags: tags}),
    updateTeam: builder.mutation({queryFn: async (input: {teamId: string; name: string; description?: string; leaderUserId: string}) => {await wait(); if (failUpdate) {failUpdate = false; return {error: {status: 500, data: {detail: "Preview save failure"}}}}; teams = teams.map(team => team.id === input.teamId ? {...team, ...input, memberIds: [...new Set([...team.memberIds, input.leaderUserId])]} : team); return {data: structuredClone(teams.find(team => team.id === input.teamId)!)}}, invalidatesTags: tags}),
    setTeamAvatar: builder.mutation({queryFn: async (input: {teamId: string; avatarUrl: string|null}) => {await wait();const team=teams.find(team=>team.id===input.teamId);if(!team)return {error:{status:404,data:{detail:"Team not found"}}};const actor=store.getState().auth.user?.id;if(actor!=="current"&&actor!==team.leaderUserId)return {error:{status:403,data:{detail:"Permission required"}}};teams=teams.map(value=>value.id===input.teamId?{...value,avatarUrl:input.avatarUrl}:value);return {data:structuredClone(teams.find(value=>value.id===input.teamId)!)}},invalidatesTags:tags}),
    addTeamMember: builder.mutation({queryFn: async (input: {teamId: string; userId: string}) => {await wait(); if (failAdd) {failAdd = false; return {error: {status: 500, data: {detail: "Preview membership failure"}}}}; teams = teams.map(team => team.id === input.teamId ? {...team, memberIds: [...new Set([...team.memberIds, input.userId])]} : team); return {data: undefined}}, invalidatesTags: tags}),
    removeTeamMember: builder.mutation({queryFn: async (input: {teamId: string; userId: string}) => {await wait(); teams = teams.map(team => team.id === input.teamId ? {...team, memberIds: team.memberIds.filter(id => id !== input.userId)} : team); return {data: undefined}}, invalidatesTags: tags}),
    deleteTeam: builder.mutation({queryFn: async (input: {teamId: string}) => {await wait(); teams = teams.filter(team => team.id !== input.teamId); return {data: undefined}}, invalidatesTags: tags}),
})})
const actorId = params.get("actor") === "member" ? "sam" : params.get("actor") === "leader" ? "eli" : "current"
store.dispatch(setUser({id: actorId, email: "preview@example.test", firstName: "Alex", lastName: "Morgan"}))
const noop = () => {}
export function Fixture() {
    const result = useListTeamsQuery(organization.id)
    const model = {...organization, teams: (result.data ?? teams).map((team, index) => ({id: team.id, name: team.name, description: team.description ?? "", avatarUrl:team.avatarUrl, leaderId: team.leaderUserId, memberIds: team.memberIds, color: ["#a78bfa", "#38bdf8", "#fb7185", "#34d399"][index % 4]}))}
    const context: WorkshopOutletContext = {organization: model, isPersistedOrganization: true, canInvite: true, selectProject: noop, openInviteDialog: noop, previewColorScheme: noop}
    const workshop = {organizations: [model], isLoading: false, organizationById: () => model, addLocalOrganization: () => model, removeLocalOrganization: noop, moveTask: noop, addTask: noop, addTeam: noop, addProject: noop, updateProject: noop, saveRoles: noop}
    return <WorkshopContext value={workshop}><div className="workshop-shell" style={{display: "block", height: "auto", minHeight: "100vh", background: "var(--background)"}}><Outlet context={context}/></div></WorkshopContext>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><ThemeProvider><MemoryRouter initialEntries={[`/workshop/${organization.id}/${params.get("page") === "chart" ? "org-chart" : "teams"}`]}><Routes><Route path="/workshop/:organizationId" element={<Fixture/>}><Route path="teams" element={<WorkshopTeamsPage/>}/><Route path="org-chart" element={<WorkshopOrgChartPage/>}/><Route path="projects/:projectId" element={<p>Project link opened</p>}/></Route></Routes></MemoryRouter></ThemeProvider></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
