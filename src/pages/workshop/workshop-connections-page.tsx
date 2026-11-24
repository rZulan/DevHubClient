import {Link, useLocation, useOutletContext, useSearchParams} from "react-router-dom"
import {Link2, Zap} from "lucide-react"
import {WorkshopEmptyPage, WorkshopNoProject} from "@/features/workshop/workshop-empty-state"
import {ConnectionCatalog} from "@/features/workshop/connections/connection-catalog"
import {ConnectionLibrary, type ConnectionCarry} from "@/features/workshop/connections/connection-library"
import {ConnectionRuns} from "@/features/workshop/connections/connection-runs"
import {sdlcTodoConnection, todoCalendarConnection} from "@/features/workshop/connections/connections-model"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"

export function WorkshopConnectionsPage() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const [params, setParams] = useSearchParams()
    const location = useLocation()
    if (!project) return <WorkshopNoProject icon={Zap}/>
    if (!isPersistedOrganization) return <WorkshopEmptyPage icon={Zap} title="Connections require a saved project" description="Open a project in your organization to create or view connections."/>
    const scope = {organizationId: organization.id, projectId: project.id}
    const carry = location.state as ConnectionCarry | null
    const connectionId = params.get("connection") ?? undefined
    const runConnectionId = connectionId === todoCalendarConnection.id || connectionId === sdlcTodoConnection.id ? undefined : connectionId
    const rawView = params.get("view")
    const view = rawView === "catalog" || rawView === "runs" ? rawView : "connections"
    const tabs = [{id: "connections", label: "Connections"}, {id: "catalog", label: "Catalog"}, {id: "runs", label: "Run history"}] as const

    function select(id: string | null) {
        setParams(current => {
            const next = new URLSearchParams(current)
            next.set("project", scope.projectId)
            if (id) next.set("connection", id)
            else next.delete("connection")
            next.delete("run")
            return next
        }, {replace: true})
    }

    return <div className={view === "connections" ? "connections-page connections-page-map" : "workshop-page connections-page"} key={project.id}>
        <div className="connections-page-navigation">
            <header className="connections-page-header"><span className="connections-page-icon"><Link2 aria-hidden="true"/></span>
                <div><h1>Connections</h1><p>{project.name}</p></div></header>
            <nav className="connections-tabs" aria-label="Connections views">{tabs.map(tab => {
                const query = new URLSearchParams({project: scope.projectId})
                if (tab.id !== "connections") query.set("view", tab.id)
                const id = tab.id === "runs" ? runConnectionId : connectionId
                if (id) query.set("connection", id)
                return <Link key={tab.id} to={{search: `?${query}`}} aria-current={view === tab.id ? "page" : undefined}>{tab.label}</Link>
            })}</nav>
        </div>
        {view === "connections" && <ConnectionLibrary key={scope.projectId} scope={scope} initialDraft={carry?.projectId === scope.projectId ? carry.draft : undefined}
            selection={connectionId ?? null} onSelect={select} todoCalendarEnabled={project.todoCalendarEnabled !== false}/>}
        {view === "catalog" && <ConnectionCatalog scope={scope}/>}
        {view === "runs" && <ConnectionRuns scope={scope} connectionId={runConnectionId} focusId={params.get("run") ?? undefined} onFilter={select}/>}
    </div>
}
