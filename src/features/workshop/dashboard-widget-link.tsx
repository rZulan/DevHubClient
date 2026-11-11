import {ArrowRight} from "lucide-react"
import {Link} from "react-router-dom"
import {DashboardQuickAction} from "./dashboard-quick-action"
import {dashboardQuickLinks} from "./dashboard-widget-catalog"
import type {DashboardQuickLink, DashboardWidgetType, WorkshopProject} from "./workshop-types"

export function DashboardWidgetLink({type, project}: {type: DashboardWidgetType; project?: Pick<WorkshopProject, "id" | "name">}) {
    const variant = type.endsWith("-chip") ? "chip" : "card"
    const key = type.slice(5, -(variant.length + 1)) as DashboardQuickLink
    const {title: label, icon: Icon} = dashboardQuickLinks[key]
    const title = key === "project" && project ? `Project (${project.name})` : label
    const to = key === "project" ? (project ? `../projects/${encodeURIComponent(project.id)}` : "../projects")
        : `../${key}${project && key !== "teams" && key !== "org-chart" ? `?${new URLSearchParams({project: project.id})}` : ""}`
    return variant === "card" ? <DashboardQuickAction category="Quick link" title={title} to={to}/>
        : <Link to={to} className="dashboard-link-chip" title={title}><Icon aria-hidden="true"/><span>{title}</span><ArrowRight aria-hidden="true"/></Link>
}
