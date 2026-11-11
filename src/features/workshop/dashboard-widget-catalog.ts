import {BarChart3, BookOpen, Bug, CalendarDays, Database, GitBranch, Image, LayoutDashboard, ListTodo, Network, PanelsTopLeft, PieChart, TextCursorInput, Users, type LucideIcon} from "lucide-react"
import type {DashboardGraph, DashboardImageFrame, DashboardInfo, DashboardNewWidgetType, DashboardQuickLink, DashboardWidgetHeight, DashboardWidgetWidth} from "./workshop-types"

export const dashboardCategories = ["Quick Links", "Text Containers", "Image Containers", "Graphs", "Info"] as const
export type DashboardScope = "Global" | "Personal"
export type DashboardCatalogItem = {
    type: DashboardNewWidgetType
    category: typeof dashboardCategories[number]
    title: string
    description: string
    scope: DashboardScope
    icon: LucideIcon
    defaultWidth: DashboardWidgetWidth
    defaultHeight: DashboardWidgetHeight
    minWidth: DashboardWidgetWidth
    minHeight: DashboardWidgetHeight
    fixed?: boolean
}

export const dashboardQuickLinks: Record<DashboardQuickLink, {title: string; icon: LucideIcon}> = {
    teams: {title: "Teams", icon: Users},
    "org-chart": {title: "Org Chart", icon: Network},
    sdlc: {title: "SDLC", icon: GitBranch},
    todo: {title: "TODOs", icon: ListTodo},
    calendar: {title: "Calendar", icon: CalendarDays},
    "bug-reports": {title: "Bug Reports", icon: Bug},
    erd: {title: "ERD", icon: Database},
    "ui-editor": {title: "UI/UX", icon: PanelsTopLeft},
    uml: {title: "UML", icon: GitBranch},
    "project-wiki": {title: "Project Wiki", icon: BookOpen},
    project: {title: "Current Project", icon: LayoutDashboard},
}

const imageFrames: Record<DashboardImageFrame, string> = {
    top: "Image above text", "top-inset": "Image above text with padding",
    left: "Image left, text right", right: "Image right, text left",
    "left-inset": "Image left with padding", "right-inset": "Image right with padding",
    full: "Whole image",
}
const graphs: Record<DashboardGraph, string> = {
    tasks: "Pending / Finished Tasks", todos: "Pending / Finished TODOs", bugs: "Pending / Resolved Bugs",
    "bug-status": "Bugs Pie Chart", "todo-activity": "Finished TODOs per Day", "task-activity": "Finished Tasks per Day",
}
const info: Record<DashboardInfo, string> = {
    "org-todos": "Org TODOs", "team-todos": "Personal Team TODOs", "personal-todos": "Personal TODOs",
    "org-tasks": "Org Tasks", "team-tasks": "Personal Team Tasks", "personal-tasks": "Personal Tasks",
    schedule: "Today / Next Tasks and Events", "org-teams": "Org Teams", "org-members": "Members & Online", "team-members": "Personal Team Members",
}

export const dashboardWidgetCatalog: DashboardCatalogItem[] = [
    ...Object.entries(dashboardQuickLinks).flatMap(([key, link]) => (["card", "chip"] as const).map((variant): DashboardCatalogItem => {
        const card = variant === "card"
        const width = card ? 1.25 : 1, height = card ? 1 : 0.5
        return {type: `link-${key as DashboardQuickLink}-${variant}`, category: "Quick Links", title: link.title,
            description: card ? "Card" : "Chip", scope: key === "project" ? "Personal" : "Global", icon: link.icon,
            defaultWidth: width, defaultHeight: height, minWidth: width, minHeight: height, fixed: true}
    })),
    ...([1, 2, 3] as const).map((rows): DashboardCatalogItem => ({
        type: `text-rows-${rows}`, category: "Text Containers", title: rows === 1 ? "1 Row" : `${rows} Rows`,
        description: "Formatted text and placeholders", scope: "Global", icon: TextCursorInput,
        defaultWidth: 2, defaultHeight: rows === 1 ? 0.5 : 1, minWidth: 1, minHeight: rows === 3 ? 1 : 0.5,
    })),
    ...Object.entries(imageFrames).map(([key, title]): DashboardCatalogItem => ({
        type: `image-${key as DashboardImageFrame}`, category: "Image Containers", title, description: "Image file or link, with optional text",
        scope: "Global", icon: Image, defaultWidth: 2, defaultHeight: 1.5, minWidth: 0.5, minHeight: 0.5,
    })),
    ...Object.entries(graphs).map(([key, title]): DashboardCatalogItem => {
        const activity = key.endsWith("-activity")
        const pie = key === "bug-status"
        const width = 2.5
        const height = pie ? 1.5 : 1
        return {type: `graph-${key as DashboardGraph}`, category: "Graphs", title,
            description: activity ? "Completion calendar" : pie ? "Reports by status" : "Status breakdown",
            scope: "Global", icon: pie ? PieChart : BarChart3, fixed: true,
            defaultWidth: width, defaultHeight: height, minWidth: width, minHeight: height}
    }),
    ...Object.entries(info).map(([key, title]): DashboardCatalogItem => {
        const counts = key === "org-members"
        return {
            type: `info-${key as DashboardInfo}`, category: "Info", title, description: counts ? "Live member presence tracker" : "Scrollable list",
            scope: key.startsWith("org-") || key === "schedule" ? "Global" : "Personal",
            icon: key === "schedule" ? CalendarDays : key.endsWith("teams") || key.endsWith("members") ? Users : ListTodo,
            defaultWidth: counts ? 1.5 : 2, defaultHeight: counts ? 1 : 1.5,
            minWidth: 1.5, minHeight: 1, fixed: counts,
        }
    }),
]

export const dashboardWidgetByType = new Map<string, DashboardCatalogItem>(dashboardWidgetCatalog.map(item => [item.type, item]))
