import { useEffect, useMemo, useState, type CSSProperties, type DragEvent } from "react"
import {
  ArrowDown, ArrowRight, ArrowUp, BarChart3, CheckCircle2, Circle, Clock3,
  GripVertical, History, LayoutDashboard, Lightbulb, ListTodo, Maximize2,
  MoveVertical, Plus, Settings2, TextCursorInput, Trash2, UserRoundCheck, Users,
} from "lucide-react"
import { Link, useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { CreateTeamDialog } from "@/features/workshop/create-team-dialog"
import { getApiErrorMessage } from "@/features/auth/api-error"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import type {
  DashboardWidget, DashboardWidgetHeight, DashboardWidgetSize, DashboardWidgetType, DashboardWidgetWidth,
  WorkshopMember, WorkshopTask, WorkshopTeam,
} from "@/features/workshop/workshop-types"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { createClientId } from "@/lib/create-client-id"
import { cn } from "@/lib/utils"
import {
  useGetOrganizationDashboardQuery, usePublishOrganizationDashboardMutation,
} from "@/services/api"

type WidgetCategory = "Quick Actions" | "Graphs" | "Info" | "Text"
type WidgetCatalogItem = {
  type: DashboardWidgetType
  category: WidgetCategory
  title: string
  description: string
  defaultWidth: DashboardWidgetWidth
  defaultHeight: DashboardWidgetHeight
  minWidth: DashboardWidgetWidth
  minHeight: DashboardWidgetHeight
  icon: typeof LayoutDashboard
}
type WidgetInsertTarget = { index: number; maxColumns: number; maxHeight: DashboardWidgetHeight; sectionId?: string; newSection?: boolean }
type WidgetPlacement = {
  column: number
  row: number
  width: number
  heightRows: number
}
type WidgetLayout = {
  cells: Array<Array<string | undefined>>
  placements: Map<string, WidgetPlacement>
  slot?: { column: number; row: number; width: number; heightRows: number }
}

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const widgetCategories: WidgetCategory[] = ["Quick Actions", "Graphs", "Info", "Text"]
const gridColumns = 8
const widthOrder: DashboardWidgetWidth[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]
const heightOrder: DashboardWidgetHeight[] = [0.5, 1, 1.5, 2]
const legacyWidths: Record<DashboardWidgetSize, DashboardWidgetWidth> = {
  sixth: 0.5,
  third: 1,
  half: 2,
  "two-thirds": 3,
  full: 4,
}

function widgetWidth(widget: DashboardWidget): DashboardWidgetWidth {
  const width = widget.width ?? (widget.size ? legacyWidths[widget.size] : 4)
  return Math.max(width, widgetMinimums[widget.type].width) as DashboardWidgetWidth
}

function legacySizeForWidth(width: DashboardWidgetWidth): DashboardWidgetSize {
  if (width <= 0.5) return "sixth"
  if (width <= 1.5) return "third"
  if (width <= 2.5) return "half"
  if (width <= 3.5) return "two-thirds"
  return "full"
}

function widgetHeight(widget: DashboardWidget): DashboardWidgetHeight {
  const height = widget.height && heightOrder.includes(widget.height) ? widget.height : 1
  return Math.max(height, widgetMinimums[widget.type].height) as DashboardWidgetHeight
}

function buildWidgetLayout(widgets: DashboardWidget[]): WidgetLayout {
  const cells: Array<Array<string | undefined>> = []
  const placements = new Map<string, WidgetPlacement>()

  for (const widget of widgets) {
    const width = widgetWidth(widget) * 2
    const heightRows = widgetHeight(widget) * 2
    let placement: WidgetPlacement | undefined

    for (let row = 0; !placement; row += 1) {
      for (let column = 0; column <= gridColumns - width; column += 1) {
        const available = Array.from({ length: heightRows }, (_, rowOffset) => row + rowOffset)
          .every((candidateRow) => Array.from({ length: width }, (_, columnOffset) => column + columnOffset)
            .every((candidateColumn) => !cells[candidateRow]?.[candidateColumn]))
        if (available) {
          placement = { column, row, width, heightRows }
          break
        }
      }
    }

    if (!placement) continue
    placements.set(widget.id, placement)
    for (let row = placement.row; row < placement.row + placement.heightRows; row += 1) {
      cells[row] ??= Array<string | undefined>(gridColumns).fill(undefined)
      for (let column = placement.column; column < placement.column + placement.width; column += 1) {
        cells[row][column] = widget.id
      }
    }
  }

  let slot: WidgetLayout["slot"]
  for (let row = 0; row < cells.length && !slot; row += 1) {
    let column = 0
    while (column < gridColumns && !slot) {
      if (cells[row]?.[column]) {
        column += 1
        continue
      }

      const start = column
      while (column < gridColumns && !cells[row]?.[column]) column += 1
      const availableColumns = column - start
      const width = [...widthOrder].reverse()
        .map((candidate) => candidate * 2)
        .find((candidate) => candidate <= availableColumns)
      if (width) {
        let heightRows = 0
        for (let candidateRow = row; candidateRow < cells.length && heightRows < 4; candidateRow += 1) {
          const rowIsAvailable = Array.from({ length: width }, (_, offset) => start + offset)
            .every((candidateColumn) => !cells[candidateRow]?.[candidateColumn])
          if (!rowIsAvailable) break
          heightRows += 1
        }
        if (heightRows > 0) slot = { column: start, row, width, heightRows }
      }
    }
  }

  return { cells, placements, slot }
}

function inferWidgetSections(widgets: DashboardWidget[]) {
  if (widgets.length === 0) return []
  const layout = buildWidgetLayout(widgets)
  const rowCount = Math.max(...Array.from(layout.placements.values(), (placement) => placement.row + placement.heightRows))
  const boundaries = [0]

  for (let row = 1; row < rowCount; row += 1) {
    const crossesBoundary = Array.from(layout.placements.values())
      .some((placement) => placement.row < row && placement.row + placement.heightRows > row)
    if (!crossesBoundary) boundaries.push(row)
  }
  boundaries.push(rowCount)

  return boundaries.slice(0, -1).map((startRow, sectionIndex) => {
    const endRow = boundaries[sectionIndex + 1]
    const sectionWidgets = widgets
      .map((widget, index) => ({ widget, index, placement: layout.placements.get(widget.id) }))
      .filter(({ placement }) => placement && placement.row >= startRow && placement.row < endRow)
      .map(({ widget, index }) => ({ widget, index }))
    return { id: `section-${sectionIndex}-${sectionWidgets[0]?.widget.id ?? "empty"}`.slice(0, 100), widgets: sectionWidgets, layout: buildWidgetLayout(sectionWidgets.map(({ widget }) => widget)) }
  }).filter(({ widgets: sectionWidgets }) => sectionWidgets.length > 0)
}

function ensureWidgetSectionIds(widgets: DashboardWidget[]) {
  if (widgets.every((widget) => widget.sectionId)) return widgets
  return inferWidgetSections(widgets).flatMap((section) => section.widgets.map(({ widget }) => ({
    ...widget,
    sectionId: widget.sectionId ?? section.id,
  })))
}

function buildWidgetSections(widgets: DashboardWidget[]) {
  const sections: Array<{ id: string; widgets: Array<{ widget: DashboardWidget; index: number }> }> = []
  widgets.forEach((widget, index) => {
    const sectionId = widget.sectionId ?? `section-${index}-${widget.id}`.slice(0, 100)
    const currentSection = sections.at(-1)
    if (!currentSection || currentSection.id !== sectionId) sections.push({ id: sectionId, widgets: [] })
    sections.at(-1)!.widgets.push({ widget, index })
  })
  return sections.map((section) => ({
    ...section,
    layout: buildWidgetLayout(section.widgets.map(({ widget }) => widget)),
  }))
}

function maxWidgetColumns(layout: WidgetLayout, widgetId: string) {
  const placement = layout.placements.get(widgetId)
  if (!placement) return 12

  let availableColumns = 0
  for (let column = placement.column; column < gridColumns; column += 1) {
    const blocked = Array.from({ length: placement.heightRows }, (_, rowOffset) => placement.row + rowOffset)
      .some((row) => layout.cells[row]?.[column] && layout.cells[row][column] !== widgetId)
    if (blocked) break
    availableColumns += 1
  }
  return availableColumns
}

function fitWidgetWidth(width: DashboardWidgetWidth, maxColumns: number, minWidth: DashboardWidgetWidth) {
  const allowedWidths = widthOrder.filter((candidate) => candidate >= minWidth && candidate * 2 <= maxColumns)
  if (allowedWidths.length === 0) return undefined
  if (allowedWidths.includes(width)) return width
  return [...allowedWidths].reverse().find((candidate) => candidate <= width) ?? allowedWidths[0]
}

function widthLabelForColumns(columns: number) {
  return `${columns / 2}W`
}

const widgetCatalog: WidgetCatalogItem[] = [
  { type: "quick-action-project", category: "Quick Actions", title: "Create new project", description: "Open projects and start defining a new project.", defaultWidth: 1, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: Plus },
  { type: "quick-action-tasks", category: "Quick Actions", title: "Open task board", description: "Review work assigned across the current project.", defaultWidth: 1, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: ListTodo },
  { type: "quick-action-idea", category: "Quick Actions", title: "Start an idea", description: "Capture a note or map a flow on the canvas.", defaultWidth: 1, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: Lightbulb },
  { type: "quick-action-team", category: "Quick Actions", title: "Create or view teams", description: "Create a team or open the teams workspace.", defaultWidth: 1, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: Users },
  { type: "project-stats", category: "Graphs", title: "Project pulse", description: "Task totals and an activity trend graph.", defaultWidth: 4, defaultHeight: 1, minWidth: 2, minHeight: 1, icon: BarChart3 },
  { type: "team-distribution", category: "Graphs", title: "Team distribution", description: "Compare member counts across teams.", defaultWidth: 2, defaultHeight: 1, minWidth: 1.5, minHeight: 1, icon: Users },
  { type: "welcome", category: "Info", title: "Welcome banner", description: "A personalized greeting and project summary.", defaultWidth: 4, defaultHeight: 1, minWidth: 1.5, minHeight: 1, icon: UserRoundCheck },
  { type: "assigned-tasks", category: "Info", title: "Your TODO", description: "Tasks assigned to the person viewing the dashboard.", defaultWidth: 4, defaultHeight: 1, minWidth: 2, minHeight: 1, icon: ListTodo },
  { type: "recent-activity", category: "Info", title: "Recent activity", description: "A timeline of recent organization work.", defaultWidth: 2, defaultHeight: 2, minWidth: 1.5, minHeight: 1.5, icon: History },
  { type: "online-members", category: "Info", title: "Online members", description: "People who are currently available.", defaultWidth: 2, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: Users },
  { type: "project-overview", category: "Info", title: "Project overview", description: "Current project, team, and task totals.", defaultWidth: 1, defaultHeight: 1, minWidth: 1, minHeight: 1, icon: LayoutDashboard },
  { type: "text", category: "Text", title: "Custom text", description: "Add a heading, label, note, or dynamic text.", defaultWidth: 2, defaultHeight: 0.5, minWidth: 0.5, minHeight: 0.5, icon: TextCursorInput },
]

const widgetMinimums = {
  ...Object.fromEntries(widgetCatalog.map((item) => [item.type, { width: item.minWidth, height: item.minHeight }])),
  "quick-actions": { width: 2, height: 1.5 },
} as Record<DashboardWidgetType, { width: DashboardWidgetWidth; height: DashboardWidgetHeight }>

function normalizeWidget(widget: DashboardWidget): DashboardWidget {
  const width = widgetWidth(widget)
  return { ...widget, width, height: widgetHeight(widget), size: legacySizeForWidth(width) }
}

function expandLegacyQuickActions(widgets: DashboardWidget[]) {
  return widgets.flatMap((widget): DashboardWidget[] => widget.type === "quick-actions"
    ? [
        { id: `${widget.id}-project`, type: "quick-action-project", sectionId: widget.sectionId, size: "third", width: 1, height: 1 },
        { id: `${widget.id}-tasks`, type: "quick-action-tasks", sectionId: widget.sectionId, size: "third", width: 1, height: 1 },
        { id: `${widget.id}-idea`, type: "quick-action-idea", sectionId: widget.sectionId, size: "third", width: 1, height: 1 },
        { id: `${widget.id}-team`, type: "quick-action-team", sectionId: widget.sectionId, size: "third", width: 1, height: 1 },
      ]
    : [widget])
}

const defaultDashboardWidgets: DashboardWidget[] = [
  { id: "default-welcome", type: "welcome", sectionId: "default-welcome-section", size: "full", width: 4, height: 1 },
  { id: "default-create-project", type: "quick-action-project", sectionId: "default-actions-section", size: "third", width: 1, height: 1 },
  { id: "default-task-board", type: "quick-action-tasks", sectionId: "default-actions-section", size: "third", width: 1, height: 1 },
  { id: "default-start-idea", type: "quick-action-idea", sectionId: "default-actions-section", size: "third", width: 1, height: 1 },
  { id: "default-create-team", type: "quick-action-team", sectionId: "default-actions-section", size: "third", width: 1, height: 1 },
  { id: "default-assigned-tasks", type: "assigned-tasks", sectionId: "default-tasks-section", size: "full", width: 4, height: 1 },
  { id: "default-project-stats", type: "project-stats", sectionId: "default-stats-section", size: "full", width: 4, height: 1 },
  { id: "default-recent-activity", type: "recent-activity", sectionId: "default-info-section", size: "half", width: 2, height: 2 },
  { id: "default-online-members", type: "online-members", sectionId: "default-info-section", size: "half", width: 2, height: 1 },
]

export function WorkshopLobbyPage() {
  const { organization, project } = useOutletContext<WorkshopOutletContext>()
  const user = useAppSelector((state) => state.auth.user)
  const [isCreatingTeam, setIsCreatingTeam] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [widgetInsertTarget, setWidgetInsertTarget] = useState<WidgetInsertTarget>()
  const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([])
  const [draggedWidgetId, setDraggedWidgetId] = useState<string>()
  const [publishError, setPublishError] = useState("")
  const [now, setNow] = useState(() => new Date())
  const isPersistedOrganization = guidPattern.test(organization.id)
  const canManageDashboard = isPersistedOrganization && hasWorkshopPermission(organization, user?.id ?? "current", "Manage organization")
  const canManageTeams = hasWorkshopPermission(organization, user?.id ?? "current", "Manage teams")
  const { data: dashboard, isLoading: dashboardLoading } = useGetOrganizationDashboardQuery(
    organization.id,
    { skip: !isPersistedOrganization },
  )
  const [publishDashboard, { isLoading: isPublishing }] = usePublishOrganizationDashboardMutation()

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const members = organization.members
  const teams = organization.teams
  const currentUserId = user?.id ?? "current"
  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : members.find((member) => member.id === currentUserId)?.name ?? "there"
  const projectTasks = organization.tasks.filter((task) => task.projectId === project?.id)
  const assignedTasks = organization.tasks.filter((task) => task.assigneeId === currentUserId || task.assigneeId === "current").slice(0, 6)
  const completedTasks = projectTasks.filter((task) => task.status === "done").length
  const pendingTasks = projectTasks.filter((task) => task.status === "pending").length
  const activeTasks = projectTasks.filter((task) => task.status === "progress").length
  const onlineMembers = members.filter((member) => member.online)
  const publishedWidgets = useMemo(() => ensureWidgetSectionIds(expandLegacyQuickActions(
    dashboard?.publishedAtUtc ? dashboard.widgets : defaultDashboardWidgets,
  )), [dashboard])
  const visibleWidgets = useMemo(() => expandLegacyQuickActions(
    isEditing ? draftWidgets : publishedWidgets,
  ), [isEditing, draftWidgets, publishedWidgets])
  const widgetSections = useMemo(() => buildWidgetSections(visibleWidgets), [visibleWidgets])

  function beginEditing() {
    setDraftWidgets(publishedWidgets.map(normalizeWidget))
    setPublishError("")
    setIsEditing(true)
  }

  function addWidget(item: WidgetCatalogItem) {
    if (widgetInsertTarget && (
      item.minWidth * 2 > widgetInsertTarget.maxColumns ||
      item.minHeight > widgetInsertTarget.maxHeight
    )) return

    setDraftWidgets((current) => {
      const insertIndex = Math.min(widgetInsertTarget?.index ?? current.length, current.length)
      const width = fitWidgetWidth(item.defaultWidth, widgetInsertTarget?.maxColumns ?? gridColumns, item.minWidth)
      if (!width) return current
      const sectionId = widgetInsertTarget?.newSection || !widgetInsertTarget?.sectionId
        ? `section-${createClientId()}`
        : widgetInsertTarget.sectionId
      const widget: DashboardWidget = {
        id: `${item.type}-${createClientId()}`,
        type: item.type,
        sectionId,
        size: legacySizeForWidth(width),
        width,
        height: Math.max(item.minHeight, Math.min(item.defaultHeight, widgetInsertTarget?.maxHeight ?? 2)) as DashboardWidgetHeight,
        content: item.type === "text" ? "Add a heading or note for %organization%" : null,
      }
      const next = [...current]
      next.splice(insertIndex, 0, widget)
      return next
    })
    setLibraryOpen(false)
    setWidgetInsertTarget(undefined)
  }

  function openWidgetLibrary(target?: WidgetInsertTarget) {
    setWidgetInsertTarget(target)
    setLibraryOpen(true)
  }

  function moveWidget(widgetId: string, direction: -1 | 1) {
    setDraftWidgets((current) => {
      const index = current.findIndex((widget) => widget.id === widgetId)
      const destination = index + direction
      if (index < 0 || destination < 0 || destination >= current.length) return current
      const next = [...current]
      const destinationSectionId = current[destination].sectionId
      const [widget] = next.splice(index, 1)
      next.splice(destination, 0, { ...widget, sectionId: destinationSectionId })
      return next
    })
  }

  function dropWidget(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault()
    if (!draggedWidgetId || draggedWidgetId === targetId) return
    setDraftWidgets((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === draggedWidgetId)
      const targetIndex = current.findIndex((widget) => widget.id === targetId)
      if (sourceIndex < 0 || targetIndex < 0) return current
      const targetSectionId = current[targetIndex].sectionId
      const next = [...current]
      const [widget] = next.splice(sourceIndex, 1)
      next.splice(targetIndex, 0, { ...widget, sectionId: targetSectionId })
      return next
    })
    setDraggedWidgetId(undefined)
  }

  function dropWidgetIntoSpace(event: DragEvent<HTMLElement>, target: WidgetInsertTarget) {
    event.preventDefault()
    if (!draggedWidgetId) return
    setDraftWidgets((current) => {
      const sourceIndex = current.findIndex((widget) => widget.id === draggedWidgetId)
      if (sourceIndex < 0) return current
      const next = [...current]
      const [widget] = next.splice(sourceIndex, 1)
      const minimums = widgetMinimums[widget.type]
      const width = fitWidgetWidth(widgetWidth(widget), target.maxColumns, minimums.width)
      if (!width || minimums.height > target.maxHeight) return current
      const insertIndex = sourceIndex < target.index ? target.index - 1 : target.index
      next.splice(insertIndex, 0, {
        ...widget,
        sectionId: target.sectionId,
        size: legacySizeForWidth(width),
        width,
        height: Math.max(minimums.height, Math.min(widgetHeight(widget), target.maxHeight)) as DashboardWidgetHeight,
      })
      return next
    })
    setDraggedWidgetId(undefined)
  }

  function cycleWidgetSize(widgetId: string) {
    setDraftWidgets((current) => {
      const activeWidget = current.find((widget) => widget.id === widgetId)
      if (!activeWidget) return current
      const sectionWidgets = current.filter((widget) => widget.sectionId === activeWidget.sectionId)
      const layout = buildWidgetLayout(sectionWidgets)
      const maxColumns = maxWidgetColumns(layout, widgetId)
      const currentWidth = widgetWidth(activeWidget)
      const allowedWidths = widthOrder.filter((width) => width >= widgetMinimums[activeWidget.type].width && width * 2 <= maxColumns)
      const nextWidth = allowedWidths[(allowedWidths.indexOf(currentWidth) + 1) % allowedWidths.length]
      return current.map((widget) => widget.id === widgetId
        ? { ...widget, width: nextWidth, size: legacySizeForWidth(nextWidth) }
        : widget)
    })
  }

  function cycleWidgetHeight(widgetId: string) {
    setDraftWidgets((current) => current.map((widget) => {
      if (widget.id !== widgetId) return widget
      const currentHeight = widgetHeight(widget)
      const allowedHeights = heightOrder.filter((height) => height >= widgetMinimums[widget.type].height)
      return { ...widget, height: allowedHeights[(allowedHeights.indexOf(currentHeight) + 1) % allowedHeights.length] }
    }))
  }

  async function publishChanges() {
    setPublishError("")
    try {
      await publishDashboard({ organizationId: organization.id, widgets: expandLegacyQuickActions(draftWidgets).map(normalizeWidget) }).unwrap()
      setIsEditing(false)
      setDraftWidgets([])
    } catch (error) {
      setPublishError(getApiErrorMessage(error))
    }
  }

  const widgetContext: WidgetContext = {
    assignedTasks, canManageTeams, completedTasks, displayName, members, now, onlineMembers,
    organizationName: organization.name, projectName: project?.name, projectTasks,
    pendingTasks, activeTasks, teams, onCreateTeam: () => setIsCreatingTeam(true),
  }

  return (
    <div className="workshop-page workshop-dashboard-page">
      <section className="workshop-dashboard-heading">
        <div><span className="workshop-page-kicker">Organization dashboard</span><h2>{isEditing ? "Customize Dashboard" : "Dashboard"}</h2><p>{isEditing ? "Add, remove, resize, and drag widgets into position." : `Shared across everyone in ${organization.name}.`}</p></div>
        <div className="workshop-dashboard-heading-actions">
          <Badge variant="outline"><i /> {onlineMembers.length} online</Badge>
          {canManageDashboard && !isEditing && <Button onClick={beginEditing} type="button" variant="outline"><Settings2 /> Manage Dashboard</Button>}
        </div>
      </section>

      {isEditing && <div className="workshop-dashboard-editor-bar"><div><LayoutDashboard /><span><strong>Edit mode</strong><small>Changes stay private until you publish.</small></span></div><div><Button onClick={() => openWidgetLibrary()} type="button" variant="outline"><Plus /> Add widget</Button><Button onClick={() => { setDraftWidgets([]); setPublishError(""); setIsEditing(false) }} type="button" variant="ghost">Discard</Button><Button disabled={isPublishing} onClick={() => void publishChanges()} type="button">{isPublishing ? "Publishing…" : "Publish for everyone"}</Button></div></div>}
      {publishError && <p className="workshop-dashboard-publish-error">{publishError}</p>}

      {dashboardLoading && !isEditing ? <div className="workshop-dashboard-loading">Loading dashboard…</div> : (
        <div className="workshop-widget-sections">
          {widgetSections.map((section, sectionIndex) => {
            const firstIndex = section.widgets[0].index
            const lastIndex = section.widgets.at(-1)!.index
            return <section className="workshop-widget-section" key={section.id}>
              {isEditing && sectionIndex > 0 && <button className="workshop-add-section-rail" onClick={() => openWidgetLibrary({ index: firstIndex, maxColumns: gridColumns, maxHeight: 2, newSection: true })} type="button"><span><Plus /> Add section</span></button>}
              <div className={cn("workshop-widget-grid", isEditing && "is-editing")}>
                {section.widgets.map(({ widget, index }) => {
                  const catalogItem = widgetCatalog.find((item) => item.type === widget.type)
                  const placement = section.layout.placements.get(widget.id)
                  if (!placement) return null
                  const height = widgetHeight(widget)
                  const maxColumns = maxWidgetColumns(section.layout, widget.id)
                  const width = widgetWidth(widget)
                  const minimums = widgetMinimums[widget.type]
                  return <section className={cn("workshop-widget", `workshop-widget-width-${String(width).replace(".", "-")}`, `workshop-widget-height-${String(height).replace(".", "-")}`, isEditing && "is-editing", draggedWidgetId === widget.id && "is-dragging")} draggable={isEditing} key={widget.id} onDragEnd={() => setDraggedWidgetId(undefined)} onDragOver={(event) => { if (isEditing) event.preventDefault() }} onDragStart={(event) => { setDraggedWidgetId(widget.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", widget.id) }} onDrop={(event) => dropWidget(event, widget.id)} style={{ "--widget-height-rows": placement.heightRows, gridColumn: `${placement.column + 1} / span ${placement.width}`, gridRow: `${placement.row + 1} / span ${placement.heightRows}` } as CSSProperties}>
                    {isEditing && <header className="workshop-widget-editor-header"><span><GripVertical /> {catalogItem?.title ?? "Widget"}</span><div><Button aria-label="Move widget up" disabled={index === 0} onClick={() => moveWidget(widget.id, -1)} size="icon" type="button" variant="ghost"><ArrowUp /></Button><Button aria-label="Move widget down" disabled={index === visibleWidgets.length - 1} onClick={() => moveWidget(widget.id, 1)} size="icon" type="button" variant="ghost"><ArrowDown /></Button><Button aria-label={`Change widget width; currently ${width} units; minimum ${minimums.width}; maximum ${widthLabelForColumns(maxColumns)}`} onClick={() => cycleWidgetSize(widget.id)} size="sm" title={`Width: ${minimums.width}W minimum · ${widthLabelForColumns(maxColumns)} maximum`} type="button" variant="ghost"><Maximize2 /> {width}W</Button><Button aria-label={`Change widget height; currently ${height} unit${height === 1 ? "" : "s"}; minimum ${minimums.height}`} onClick={() => cycleWidgetHeight(widget.id)} size="sm" title={`Minimum height: ${minimums.height}H`} type="button" variant="ghost"><MoveVertical /> {height}H</Button><Button aria-label="Remove widget" onClick={() => setDraftWidgets((current) => current.filter((candidate) => candidate.id !== widget.id))} size="icon" type="button" variant="ghost"><Trash2 /></Button></div></header>}
                    <DashboardWidgetContent context={widgetContext} editing={isEditing} onContentChange={(content) => setDraftWidgets((current) => current.map((candidate) => candidate.id === widget.id ? { ...candidate, content } : candidate))} widget={widget} />
                  </section>
                })}
                {isEditing && section.layout.slot && (() => {
                  const slot = section.layout.slot
                  const maxHeight = slot.heightRows / 2 as DashboardWidgetHeight
                  const target: WidgetInsertTarget = { index: lastIndex + 1, maxColumns: slot.width, maxHeight, sectionId: section.id }
                  return <button aria-label={`Add a widget here, up to ${widthLabelForColumns(slot.width)} wide and ${maxHeight} units high`} className="workshop-widget-add-space" onClick={() => openWidgetLibrary(target)} onDragOver={(event) => { if (draggedWidgetId) event.preventDefault() }} onDrop={(event) => dropWidgetIntoSpace(event, target)} style={{ gridColumn: `${slot.column + 1} / span ${slot.width}`, gridRow: `${slot.row + 1} / span ${slot.heightRows}` }} type="button"><Plus /><span>Add widget here</span><small>{widthLabelForColumns(slot.width)} · {maxHeight}H</small></button>
                })()}
              </div>
            </section>
          })}
          {visibleWidgets.length === 0 && <div className="workshop-dashboard-empty"><LayoutDashboard /><strong>This dashboard has no widgets</strong><span>{isEditing ? "Add a section to start building the dashboard." : "A dashboard manager can add and publish widgets."}</span>{isEditing && <Button onClick={() => openWidgetLibrary({ index: 0, maxColumns: gridColumns, maxHeight: 2, newSection: true })} type="button"><Plus /> Add section</Button>}</div>}
          {isEditing && visibleWidgets.length > 0 && <button className="workshop-add-section-bottom" onClick={() => openWidgetLibrary({ index: visibleWidgets.length, maxColumns: gridColumns, maxHeight: 2, newSection: true })} type="button"><Plus /><span>Add section</span><small>Start a new dashboard row</small></button>}
        </div>
      )}

      <Dialog open={libraryOpen} onOpenChange={(open) => { setLibraryOpen(open); if (!open) setWidgetInsertTarget(undefined) }}><DialogContent className="workshop-widget-library sm:max-w-2xl"><DialogHeader><DialogTitle>{widgetInsertTarget?.newSection ? "Add a section" : "Add widgets"}</DialogTitle><DialogDescription>{widgetInsertTarget?.newSection ? "Choose the first component for this new full-width section. You can resize it afterward." : widgetInsertTarget ? `Choose a widget for this space. It supports up to ${widthLabelForColumns(widgetInsertTarget.maxColumns)} width and ${widgetInsertTarget.maxHeight} height unit.` : "Choose from categorized building blocks for your organization dashboard."}</DialogDescription></DialogHeader><div className="workshop-widget-library-content">
        {widgetCategories.map((category) => <section key={category}><h3>{category}</h3><div>{widgetCatalog.filter((item) => item.category === category).map((item) => { const Icon = item.icon; const added = item.type !== "text" && draftWidgets.some((widget) => widget.type === item.type); const fitsTarget = !widgetInsertTarget || (item.minWidth * 2 <= widgetInsertTarget.maxColumns && item.minHeight <= widgetInsertTarget.maxHeight); const unavailable = added || !fitsTarget; return <Button disabled={unavailable} key={item.type} onClick={() => addWidget(item)} type="button" variant="outline"><span><Icon /></span><span><strong>{item.title}</strong><small>{added ? "Already added" : !fitsTarget ? `Needs at least ${item.minWidth}W × ${item.minHeight}H` : `${item.description} Minimum ${item.minWidth}W × ${item.minHeight}H.`}</small></span><Plus /></Button> })}</div></section>)}
        <aside><strong>Text placeholders</strong><span>%time%</span><span>%username%</span><span>%organization%</span><span>%project%</span><span>%online%</span></aside>
      </div></DialogContent></Dialog>

      <CreateTeamDialog defaultLeaderId={user?.id ?? members[0]?.id} members={members} onOpenChange={setIsCreatingTeam} open={isCreatingTeam} organization={organization} teams={teams} />
    </div>
  )
}

type WidgetContext = {
  assignedTasks: WorkshopTask[]; canManageTeams: boolean; completedTasks: number; displayName: string
  members: WorkshopMember[]; now: Date; onlineMembers: WorkshopMember[]; organizationName: string
  projectName?: string; projectTasks: WorkshopTask[]; pendingTasks: number; activeTasks: number
  teams: WorkshopTeam[]; onCreateTeam: () => void
}

function DashboardWidgetContent({ context, editing, onContentChange, widget }: { context: WidgetContext; editing: boolean; onContentChange: (content: string) => void; widget: DashboardWidget }) {
  const { activeTasks, assignedTasks, canManageTeams, completedTasks, displayName, members, now, onlineMembers, organizationName, pendingTasks, projectName, projectTasks, teams } = context
  if (widget.type === "welcome") return <Card className="workshop-welcome-widget"><CardContent><span>Welcome back</span><h3>{greeting(now)}, <strong>{displayName}</strong></h3><p>{projectName ? `Here’s what is moving in ${projectName}.` : `Here’s what is happening across ${organizationName}.`}</p></CardContent></Card>
  if (widget.type === "quick-action-project") return <QuickActionWidget description="Define ownership, stack, and delivery dates." icon={Plus} title="Create new project" to="../projects" />
  if (widget.type === "quick-action-tasks") return <QuickActionWidget description="Review work assigned across the current project." icon={ListTodo} title="Open task board" to="../todo" />
  if (widget.type === "quick-action-idea") return <QuickActionWidget description="Capture a note or map a flow on the canvas." icon={Lightbulb} title="Start an idea" to="../ideation" />
  if (widget.type === "quick-action-team") return canManageTeams
    ? <QuickActionWidget description="Choose a team leader and organize members." icon={Users} onClick={context.onCreateTeam} title="Create a team" />
    : <QuickActionWidget description="See ownership and team membership." icon={Users} title="View teams" to="../teams" />
  if (widget.type === "assigned-tasks") return <section className="workshop-dashboard-section workshop-personal-todo"><Card><CardHeader><span>Task</span><Link to="../todo">Open board <ArrowRight /></Link><span>Status</span></CardHeader><CardContent>{assignedTasks.length > 0 ? assignedTasks.map((task) => <DashboardTaskRow key={task.id} task={task} />) : <p>No tasks assigned to you yet.</p>}</CardContent></Card></section>
  if (widget.type === "project-stats") return <section className="workshop-dashboard-section workshop-statistics"><div className="workshop-statistics-panel"><div className="workshop-stat-bars" aria-label="Project task statistics"><StatBar color="blue" label="Pending" total={projectTasks.length} value={pendingTasks} /><StatBar color="amber" label="Active" total={projectTasks.length} value={activeTasks} /><StatBar color="green" label="Done" total={projectTasks.length} value={completedTasks} /><StatBar color="slate" label="Teams" total={Math.max(teams.length, 1)} value={teams.length} /></div><div className="workshop-trend-chart"><div><strong>Work completed</strong><small>{projectName ?? organizationName}</small></div><svg aria-label="Project activity trend" preserveAspectRatio="none" role="img" viewBox="0 0 600 180"><line x1="0" x2="600" y1="164" y2="164" /><polyline className="comparison" fill="none" points="0,164 120,100 240,128 360,72 480,116 600,46" /><polyline className="primary" fill="none" points="0,164 120,124 240,78 360,68 480,62 600,28" /></svg></div></div></section>
  if (widget.type === "recent-activity") return <section className="workshop-dashboard-activity"><header><History /><strong>Recent activity</strong></header><ol><ActivityItem copy={`created the ${projectName ?? "current"} project workspace`} name={displayName} time="10 minutes ago" /><ActivityItem copy="moved a task to In progress" name={members[1]?.name ?? displayName} time="38 minutes ago" /><ActivityItem copy="added a note to Ideas" name={members[2]?.name ?? displayName} time="2 hours ago" /><ActivityItem copy="completed a project task" name={members[3]?.name ?? displayName} time="Yesterday" /></ol><Button asChild variant="ghost"><Link to="../todo">Load more <ArrowRight /></Link></Button></section>
  if (widget.type === "online-members") return <Card className="workshop-info-widget"><CardHeader><Users /><strong>Online members</strong><Badge variant="secondary">{onlineMembers.length}</Badge></CardHeader><CardContent>{onlineMembers.length > 0 ? onlineMembers.slice(0, 8).map((member) => <div key={member.id}><i /><span><strong>{member.name}</strong><small>@{member.username}</small></span></div>) : <p>No one is online right now.</p>}</CardContent></Card>
  if (widget.type === "project-overview") return <Card className="workshop-overview-widget"><CardHeader><LayoutDashboard /><strong>Project overview</strong></CardHeader><CardContent><strong>{projectName ?? "No project selected"}</strong><div><span><b>{projectTasks.length}</b> tasks</span><span><b>{teams.length}</b> teams</span><span><b>{members.length}</b> members</span></div></CardContent></Card>
  if (widget.type === "team-distribution") { const maximum = Math.max(...teams.map((team) => team.memberCount ?? team.memberIds.length), 1); return <Card className="workshop-team-chart-widget"><CardHeader><BarChart3 /><strong>Team distribution</strong></CardHeader><CardContent>{teams.length > 0 ? teams.map((team) => { const count = team.memberCount ?? team.memberIds.length; return <div key={team.id}><span>{team.name}<small>{count}</small></span><i><b style={{ width: `${Math.max(8, (count / maximum) * 100)}%`, background: team.color }} /></i></div> }) : <p>Create a team to see this graph.</p>}</CardContent></Card> }
  const content = widget.content ?? ""
  return <Card className="workshop-text-widget"><CardContent>{editing ? <Textarea aria-label="Custom dashboard text" maxLength={2000} onChange={(event) => onContentChange(event.target.value)} value={content} /> : <p>{resolvePlaceholders(content, context)}</p>}{editing && <small>Try %time%, %username%, %organization%, %project%, or %online%.</small>}</CardContent></Card>
}

function QuickActionWidget({ description, icon: Icon, onClick, title, to }: { description: string; icon: typeof LayoutDashboard; onClick?: () => void; title: string; to?: string }) {
  const content = <><span><Icon /></span><strong>{title}</strong><small>{description}</small><ArrowRight /></>
  return <section className="workshop-dashboard-section"><div className="workshop-quick-actions workshop-single-quick-action">{to
    ? <Link to={to}>{content}</Link>
    : <button onClick={onClick} type="button">{content}</button>}
  </div></section>
}

function resolvePlaceholders(content: string, context: WidgetContext) {
  return content.replaceAll("%time%", context.now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })).replaceAll("%username%", context.displayName).replaceAll("%organization%", context.organizationName).replaceAll("%project%", context.projectName ?? "your organization").replaceAll("%online%", String(context.onlineMembers.length))
}
function greeting(now: Date) { const hour = now.getHours(); return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening" }
function DashboardTaskRow({ task }: { task: WorkshopTask }) { const Icon = task.status === "done" ? CheckCircle2 : task.status === "progress" ? Clock3 : Circle; return <div><span><Icon /><strong>{task.title}</strong></span><Badge variant={task.status === "done" ? "secondary" : "outline"}>{task.status === "progress" ? "In progress" : task.status}</Badge></div> }
function StatBar({ color, label, total, value }: { color: string; label: string; total: number; value: number }) { const height = total > 0 ? Math.max(18, Math.round((value / total) * 100)) : 18; return <div><span><i data-color={color} style={{ "--bar-height": `${height}%` } as CSSProperties} /></span><strong>{value}</strong><small>{label}</small></div> }
function ActivityItem({ copy, name, time }: { copy: string; name: string; time: string }) { return <li><i /><p><strong>{name}</strong> {copy}<small>{time}</small></p></li> }
