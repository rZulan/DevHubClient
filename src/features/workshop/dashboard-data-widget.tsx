import type {ReactNode} from "react"
import {Link} from "react-router-dom"
import {Bar, BarChart, LabelList, Pie, PieChart, XAxis, YAxis} from "recharts"
import {ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig} from "@/components/ui/chart"
import {DashboardMemberPresence} from "./dashboard-member-presence"
import {dashboardMemberTeams, dashboardWidgetTeam, type DashboardDataContext} from "./dashboard-placeholders"
import {DashboardTeamSetting, dashboardTodoFinished, readDashboardWidgetSettings, todoTaskAssignedTo, useDashboardOrganizationTodos} from "./dashboard-widget-settings"
import {calendarDate, calendarItems, calendarKindLabels, calendarToday, shiftCalendarDate, validCalendarDocument} from "./calendar-document"
import {bugStatuses} from "./bug-reports"
import {useListBugReportsQuery} from "./bug-reports-api"
import {dashboardWidgetByType} from "./dashboard-widget-catalog"
import {useListTodosQuery} from "./todo-api"
import {toolDocumentsApi} from "./tool-documents-api"
import type {DashboardWidget} from "./workshop-types"

type MetricColor = "pending" | "finished" | "new" | "in-progress" | "closed"
type Metric = {name: string; value: number; color: MetricColor}
const bugStatusColors = {new: "new", triaged: "pending", "in-progress": "in-progress", resolved: "finished", closed: "closed"} as const
const localDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {month: "short", day: "numeric"})

function comparisonMetrics(pending: number, finished: number, finishedLabel = "Finished"): Metric[] {
    return [{name: "Pending", value: pending, color: "pending"}, {name: finishedLabel, value: finished, color: "finished"}]
}

function MetricChart({items, pie = false}: {items: Metric[]; pie?: boolean}) {
    const config: ChartConfig = {value: {label: "Count"}}
    const chart = items.map((item, index) => {
        const key = `status${index}`
        const color = `var(--dashboard-chart-${item.color})`
        config[key] = {label: item.name, color}
        return {...item, key, color, fill: `var(--color-${key})`}
    })
    const total = items.reduce((sum, item) => sum + item.value, 0)
    if (!total) return <p className="dashboard-widget-empty">No records to chart.</p>
    if (!pie) {
        const max = Math.max(...items.map(item => item.value))
        return <div className="dashboard-comparison">
            <ChartContainer config={config} className="dashboard-comparison-chart">
                <BarChart accessibilityLayer layout="vertical" data={chart} margin={{left: 0, right: String(max).length * 8 + 9, top: 0, bottom: 0}}>
                    <XAxis type="number" hide allowDecimals={false} domain={[0, max]}/>
                    <YAxis type="category" dataKey="name" width={64} tickMargin={8} interval={0} axisLine={false} tickLine={false}/>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="key" hideLabel/>}/>
                    <Bar dataKey="value" radius={4} maxBarSize={12} isAnimationActive={false}>
                        <LabelList dataKey="value" position="right" offset={6} className="dashboard-comparison-value"/>
                    </Bar>
                </BarChart>
            </ChartContainer>
            <ul className="sr-only" aria-label="Chart values">{items.map(item => <li key={item.name}>{item.name} {item.value}</li>)}</ul>
        </div>
    }
    return <div className="dashboard-metrics">
        <ChartContainer config={config} className="dashboard-chart">
            <PieChart accessibilityLayer><ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel/>}/>
                <Pie data={chart.filter(item => item.value > 0)} dataKey="value" nameKey="key" innerRadius="45%" outerRadius="92%" stroke="var(--background)" isAnimationActive={false}/>
            </PieChart>
        </ChartContainer>
        <ul className="dashboard-chart-legend" aria-label="Chart values">{chart.map(item => <li key={item.name}><i style={{background: item.color}}/>{item.name}<strong>{item.value}</strong></li>)}</ul>
    </div>
}

function ActivityCalendar({dates, now, unit}: {dates: (string | null | undefined)[]; now: Date; unit: string}) {
    const today = calendarDate(now)
    const first = shiftCalendarDate(today, -84 - (now.getDay() + 6) % 7)
    const counts = new Map<string, number>()
    for (const date of dates) {
        if (!date) continue
        const instant = new Date(date)
        if (!Number.isFinite(instant.getTime())) continue
        const day = calendarDate(instant)
        if (day >= first && day <= today) counts.set(day, (counts.get(day) ?? 0) + 1)
    }
    const sum = [...counts.values()].reduce((total, count) => total + count, 0)
    const days = Array.from({length: 91}, (_, index) => shiftCalendarDate(first, index))
    const weeks = days.filter((_, index) => index % 7 === 0)
    return <div className="dashboard-activity-calendar">
        <div className="dashboard-activity-summary"><strong>{sum}</strong> finished<small>Last 13 weeks</small></div>
        <div className="dashboard-activity-plot">
            <div className="dashboard-activity-months" aria-hidden="true">{weeks.map((day, index) => {
                if (index > 0 && day.slice(0, 7) === weeks[index - 1].slice(0, 7)) return null
                return <span key={day} style={{gridColumnStart: index + 1}} data-at-end={index >= weeks.length - 3 || undefined}>
                    {new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {month: "short"})}
                </span>
            })}</div>
            <div className="dashboard-activity-weekdays" aria-hidden="true"><span>Mon</span><span>Wed</span><span>Fri</span></div>
            <div className="dashboard-activity-grid" role="group" aria-label={`Daily ${unit} completions`}>
                {days.map(day => {
                    const count = counts.get(day) ?? 0
                    const label = `${localDate(day)}, ${count} finished`
                    return <span key={day} className="dashboard-activity-cell" data-level={Math.min(count, 4)} data-future={day > today || undefined}
                        role={day <= today ? "img" : undefined} aria-label={day <= today ? label : undefined} title={day <= today ? label : undefined}/>
                })}
            </div>
        </div>
        <div className="dashboard-activity-legend" aria-hidden="true">Less {[0, 1, 2, 3, 4].map(level => <i key={level} className="dashboard-activity-cell" data-level={level}/>)} More</div>
    </div>
}

type ListRow = {id: string; name: string; detail: string; to?: string}
function WidgetList({items, empty = "Nothing to show yet."}: {items: ListRow[]; empty?: string}) {
    if (!items.length) return <p className="dashboard-widget-empty">{empty}</p>
    return <ul className="dashboard-info-list">{items.map(item => {
        const content = <><span title={item.name}>{item.name}</span><small>{item.detail}</small></>
        return <li key={item.id}>{item.to ? <Link to={item.to}>{content}</Link> : <div>{content}</div>}</li>
    })}</ul>
}

type OrgTodoRow = {id: string; name: string; project: string; finished: boolean; to?: string}

function OrgTodoList({items}: {items: OrgTodoRow[]}) {
    if (!items.length) return <p className="dashboard-widget-empty">No organization TODOs yet.</p>
    return <ul className="dashboard-org-todos">{items.map(({id, name, project, finished, to}) => {
        const content = <>
            <span className="dashboard-org-todo-details">
                <strong title={name}>{name}</strong>
                {project && <small title={project}>{project}</small>}
            </span>
            <span className="dashboard-org-todo-status" data-finished={finished || undefined}>
                {finished ? "Finished" : "Pending"}
            </span>
        </>
        return <li key={id}>{to ? <Link to={to}>{content}</Link> : <div>{content}</div>}</li>
    })}</ul>
}

function orgTodoSummary(items: OrgTodoRow[]) {
    const finished = items.filter(item => item.finished).length
    return `${items.length - finished} pending · ${finished} finished`
}

function DashboardDataFrame({title, subtitle, settings, graph, variant, children}: {
    title?: string; subtitle?: string; settings?: ReactNode; graph: boolean; variant?: "org-todos"; children: ReactNode
}) {
    return <div className="dashboard-widget-face dashboard-data-widget" data-graph={graph || undefined} data-variant={variant}>
        <header><h3>{title}</h3>{subtitle && <small title={subtitle}>{subtitle}</small>}</header>
        {settings}
        <div className="dashboard-data-body">{children}</div>
    </div>
}

export function DashboardDataPreview({type, title, projectName}: {type: DashboardWidget["type"]; title: string; projectName?: string}) {
    if (type === "info-org-members") return <DashboardMemberPresence memberCount={5} members={[
        {id: "alex", name: "Alex Morgan", initials: "AM", online: true},
        {id: "jamie", name: "Jamie Lee", initials: "JL", online: true, presenceStatus: "away"},
    ]}/>
    if (type === "info-org-todos") {
        const project = projectName ?? "Example project"
        const items = [{id: "release", name: "Release checklist", project, finished: false}, {id: "kickoff", name: "Project kickoff", project, finished: true}]
        return <DashboardDataFrame graph={false} variant="org-todos" title={title} subtitle={orgTodoSummary(items)}><OrgTodoList items={items}/></DashboardDataFrame>
    }
    const graph = type.startsWith("graph-")
    let sample: ReactNode
    if (type.endsWith("-activity")) {
        const now = new Date(), today = calendarDate(now)
        const dates = [0, 1, 1, 3, 5, 5, 8, 15, 15, 17, 20, 20, 25, 32, 34, 42, 47, 54, 65, 66, 72, 79].map(days => `${shiftCalendarDate(today, -days)}T12:00:00`)
        sample = <ActivityCalendar dates={dates} now={now} unit={type === "graph-todo-activity" ? "TODOs" : "tasks"}/>
    } else if (graph) {
        const pie = type === "graph-bug-status"
        const items = pie ? bugStatuses.map((status, index) => ({name: status.label, value: [4, 2, 3, 5, 1][index], color: bugStatusColors[status.id]}))
            : comparisonMetrics(5, 8, type === "graph-bugs" ? "Resolved" : "Finished")
        sample = <MetricChart items={items} pie={pie}/>
    } else if (type === "info-schedule") {
        sample = <div className="dashboard-schedule"><section><h4>Today</h4><WidgetList items={[{id: "today", name: "Design review", detail: "Meeting"}]}/></section>
            <section><h4>Next</h4><WidgetList items={[{id: "next", name: "Draft release notes", detail: "Task"}]}/></section></div>
    } else {
        const examples = type === "info-org-teams" ? [["Design", "6 members"], ["Platform", "4 members"]]
            : type === "info-team-members" ? [["Alex Morgan", "Team lead"], ["Jamie Lee", "Member"]]
            : type.endsWith("-todos") ? [["Release checklist", "Pending"], ["Project kickoff", "Finished"]]
            : [["Review requirements", "In progress"], ["Set up repository", "Done"]]
        sample = <WidgetList items={examples.map(([name, detail]) => ({id: name, name, detail}))}/>
    }
    return <DashboardDataFrame graph={graph} title={title} subtitle={graph || type === "info-schedule" ? projectName ?? "Example project" : undefined}>{sample}</DashboardDataFrame>
}

export function DashboardDataWidget({context, widget, editing, onContentChange}: {
    context: DashboardDataContext; widget: DashboardWidget; editing: boolean; onContentChange: (value: string) => void
}) {
    const {organization, project, persisted, userId, now} = context
    const type = widget.type
    const graph = type.startsWith("graph-")
    const bugs = type === "graph-bugs" || type === "graph-bug-status"
    const schedule = type === "info-schedule"
    const teamScoped = type.startsWith("info-team-")
    const teamList = type === "info-org-teams" || type === "info-team-members"
    const orgTodos = type.startsWith("info-") && !teamList && !schedule
    const needsProject = graph || schedule
    const scope = {organizationId: organization.id, projectId: project?.id ?? ""}
    const projectTodos = useListTodosQuery(scope, {skip: !persisted || !project || !(graph && !bugs || schedule), refetchOnFocus: true, refetchOnReconnect: true})
    const allTodos = useDashboardOrganizationTodos(context, orgTodos)
    const bugQuery = useListBugReportsQuery({...scope, page: 0, search: "", status: "", categoryId: ""}, {skip: !persisted || !project || !bugs, refetchOnFocus: true, refetchOnReconnect: true})
    const calendar = toolDocumentsApi.useGetToolDocumentQuery({...scope, tool: "calendar"}, {skip: !persisted || !project || !schedule, refetchOnFocus: true})
    const settings = readDashboardWidgetSettings(widget.content)
    const team = teamScoped ? dashboardWidgetTeam(dashboardMemberTeams(context), settings.teamId) : undefined
    const title = dashboardWidgetByType.get(type)?.title
    const projectLabel = (id: string) => organization.projects.find(item => item.id === id)?.name ?? ""
    const todoLink = (projectId: string, todo: string, task?: string) => `../todo?${new URLSearchParams({project: projectId, todoProject: projectId, todo, ...(task ? {task} : {})})}`
    const failure = projectTodos.isError || allTodos.isError || bugQuery.isError || calendar.isError
    const loading = projectTodos.isLoading || allTodos.isLoading || bugQuery.isLoading || calendar.isLoading
    let subtitle = needsProject ? project?.name : team?.name
    let body: ReactNode
    if (needsProject && !project) body = <p className="dashboard-widget-empty">Select a project.</p>
    else if (failure) body = <p className="dashboard-widget-empty">This widget’s data could not be loaded.</p>
    else if (loading) body = <p className="dashboard-widget-empty" role="status">Loading…</p>
    else if (teamScoped && !team) body = <p className="dashboard-widget-empty">Choose one of your teams in this widget.</p>
    else if (bugs) {
        const {openCount = 0, resolvedCount = 0, statusCounts} = bugQuery.currentData ?? {}
        const pie = type === "graph-bug-status"
        const items = pie && statusCounts ? bugStatuses.map(status => ({name: status.label, value: statusCounts[status.id] ?? 0, color: bugStatusColors[status.id]}))
            : comparisonMetrics(openCount, resolvedCount, "Resolved")
        body = <MetricChart pie={pie} items={items}/>
    } else if (graph) {
        const todos = projectTodos.currentData ?? []
        const tasks = todos.flatMap(todo => todo.tasks.map(task => ({...task, finished: task.status === (todo.columns.at(-1)?.id ?? "done")})))
        if (type === "graph-todo-activity") body = <ActivityCalendar dates={todos.map(todo => todo.finishedAtUtc)} now={now} unit="TODOs"/>
        else if (type === "graph-task-activity") body = <ActivityCalendar dates={tasks.map(task => task.finishedAtUtc)} now={now} unit="tasks"/>
        else {
            const total = type === "graph-todos" ? todos.length : tasks.length
            const finished = type === "graph-todos" ? todos.filter(dashboardTodoFinished).length : tasks.filter(task => task.finished).length
            body = <MetricChart items={comparisonMetrics(total - finished, finished)}/>
        }
    } else if (schedule) {
        const saved = calendar.currentData?.document
        const doc = validCalendarDocument(saved) ? saved : {timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", events: []}
        const today = calendarToday(doc.timeZone, now)
        const items = calendarItems(doc, projectTodos.currentData ?? []).filter(item => item.kind !== "todo" && !item.completed)
        const rows = (values: typeof items): ListRow[] => values.map(item => ({
            id: item.id, name: item.title, detail: `${calendarKindLabels[item.kind]} · ${localDate(item.startDate)}`,
            to: item.todoId ? todoLink(scope.projectId, item.todoId, item.taskId) : `../calendar?${new URLSearchParams({project: scope.projectId})}`,
        }))
        body = <div className="dashboard-schedule"><section><h4>Today</h4><WidgetList items={rows(items.filter(item => item.startDate <= today && item.endDate >= today))} empty="Nothing scheduled today."/></section>
            <section><h4>Next</h4><WidgetList items={rows(items.filter(item => item.startDate > today).slice(0, 8))} empty="Nothing upcoming."/></section></div>
    } else if (type === "info-org-teams") {
        body = <WidgetList items={organization.teams.map(item => ({id: item.id, name: item.name, detail: `${item.memberCount ?? item.memberIds.length} members`, to: "../teams"}))}/>
    } else if (type === "info-team-members") {
        const members = organization.members.filter(member => team?.memberIds.includes(member.id))
        body = <WidgetList items={members.map(member => ({id: member.id, name: member.name, detail: team?.leaderId === member.id ? "Team lead" : member.online ? "Online" : "Member"}))}/>
    } else if (type === "info-org-todos") {
        const items = (allTodos.currentData ?? []).map(todo => ({
            id: todo.id, name: todo.name, project: projectLabel(todo.projectId), finished: dashboardTodoFinished(todo), to: todoLink(todo.projectId, todo.id),
        }))
        if (items.length) subtitle = orgTodoSummary(items)
        body = <OrgTodoList items={items}/>
    } else {
        const todos = (allTodos.currentData ?? []).filter(todo => !team || organization.projects.some(item => item.id === todo.projectId && item.teamIds.includes(team.id)))
        const personal = type.startsWith("info-personal-")
        const items = type.endsWith("-todos")
            ? todos.filter(todo => !personal || todo.tasks.some(task => todoTaskAssignedTo(task, userId))).map(todo => ({
                id: todo.id, name: todo.name, detail: `${dashboardTodoFinished(todo) ? "Finished" : "Pending"} · ${projectLabel(todo.projectId)}`, to: todoLink(todo.projectId, todo.id),
            }))
            : todos.flatMap(todo => todo.tasks.filter(task => !personal || todoTaskAssignedTo(task, userId)).map(task => ({
                id: task.id, name: task.title, detail: `${todo.columns.find(column => column.id === task.status)?.name ?? task.status} · ${projectLabel(todo.projectId)}`, to: todoLink(todo.projectId, todo.id, task.id),
            })))
        body = <WidgetList items={items}/>
    }
    const teamSetting = editing && teamScoped && <DashboardTeamSetting context={context} value={settings.teamId} onChange={teamId => onContentChange(JSON.stringify({...settings, teamId}))}/>
    return <DashboardDataFrame graph={graph} variant={type === "info-org-todos" ? "org-todos" : undefined}
        title={title} subtitle={subtitle} settings={teamSetting}>{body}</DashboardDataFrame>
}
