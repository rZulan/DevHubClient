import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {WorkshopEmptyState} from "@/features/workshop/workshop-empty-state"
import {getDashboardView, setDashboardView} from "@/features/workshop/dashboard-view"
import {type CSSProperties, type DragEvent, type PointerEvent, useEffect, useMemo, useRef, useState} from "react"
import {
    LayoutDashboard,
    Plus,
    RotateCcw,
    Settings2,
    X,
} from "lucide-react"
import {useOutletContext, useSearchParams} from "react-router-dom"

import {useAppDispatch, useAppSelector} from "@/app/hooks"
import {Badge} from "@/components/ui/badge"
import {Button} from "@/components/ui/button"
import {getApiErrorMessage} from "@/features/auth/api-error"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import type {
    DashboardWidget,
    DashboardWidgetHeight,
    DashboardNewWidgetType,
    DashboardQuickLink,
    DashboardWidgetSize,
    DashboardWidgetWidth,
} from "@/features/workshop/workshop-types"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {createClientId} from "@/lib/create-client-id"
import {cn} from "@/lib/utils"
import {dashboardWidgetByType, type DashboardCatalogItem} from "@/features/workshop/dashboard-widget-catalog"
import {DashboardWidgetPicker, dashboardWidgetDragMime, useDashboardPaletteWindow} from "@/features/workshop/dashboard-widget-picker"
import {DashboardWidgetAppearanceControl, dashboardWidgetAppearanceStyle, normalizeDashboardImageFrame} from "@/features/workshop/dashboard-widget-appearance"
import {DashboardDataWidget} from "@/features/workshop/dashboard-data-widget"
import {DashboardMemberPresence} from "@/features/workshop/dashboard-member-presence"
import {DashboardImageWidget, DashboardTextWidget, dashboardWidgetStarterContent} from "@/features/workshop/dashboard-widget-settings"
import {DashboardWidgetLink} from "@/features/workshop/dashboard-widget-link"
import type {DashboardDataContext} from "@/features/workshop/dashboard-placeholders"
import type {DashboardTextRow} from "@/features/workshop/dashboard-text-format"
import "@/features/workshop/dashboard-widgets.css"
import {api, useGetOrganizationDashboardQuery, usePublishOrganizationDashboardMutation, useGetPersonalDashboardQuery, useSavePersonalDashboardMutation} from "@/services/api"

type WidgetInsertTarget = {
    index: number;
    maxColumns: number;
    maxHeight: DashboardWidgetHeight;
    sectionId?: string;
    newSection?: boolean;
    column?: number;
    row?: number
}
type WidgetPlacement = {
    column: number
    row: number
    width: number
    heightRows: number
}
type WidgetLayout = {
    cells: Array<Array<string | undefined>>
    placements: Map<string, WidgetPlacement>
    slots: WidgetPlacement[]
}
type WidgetMoveGesture = {
    id: string
    pointerId: number
    x: number
    y: number
    active: boolean
    columnStep: number
    rowStep: number
}

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const columnsPerUnit = 4
const defaultWidgetGap = 20
const minWidgetGap = 8
const maxWidgetGap = 24
const columnsPerResizeStep = columnsPerUnit / 2
const gridColumns = 5 * columnsPerUnit
const maxWidgetColumns = 4 * columnsPerUnit
const rowsPerHeightUnit = 2
const maxGridRow = 120
const maxHeightRows = 2 * rowsPerHeightUnit
const maxImageHeight = 4
const maxImageHeightRows = maxImageHeight * rowsPerHeightUnit
const widthOrder: DashboardWidgetWidth[] = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const legacyWidths: Record<DashboardWidgetSize, DashboardWidgetWidth> = {
    sixth: 0.5,
    third: 1,
    half: 2,
    "two-thirds": 3,
    full: 4,
}

function widgetWidth(widget: DashboardWidget): DashboardWidgetWidth {
    const template = dashboardWidgetByType.get(widget.type)
    if (template?.fixed) return template.defaultWidth
    const width = widget.width ?? (widget.size ? legacyWidths[widget.size] : 4)
    return Math.max(width, template?.minWidth ?? .5) as DashboardWidgetWidth
}

function olderQuickLinkCard(widget: DashboardWidget) {
    return widget.type.startsWith("link-") && widget.type.endsWith("-card") && widget.width !== 1.25
}

function needsFixedWidgetReflow(widget: DashboardWidget) {
    if (widget.type === "info-org-members") return widget.height === .5
    return widget.type.startsWith("graph-") && widget.width != null && widget.width !== widgetWidth(widget)
}

function savedColumn(widget: DashboardWidget) {
    if (widget.column == null || !Number.isFinite(widget.column)) return
    const position = olderQuickLinkCard(widget) && widget.width === 4 / 3 ? Math.round(widget.column * 9 / 8) : widget.column
    return Math.round(position * columnsPerResizeStep)
}

function legacySizeForWidth(width: DashboardWidgetWidth): DashboardWidgetSize {
    if (width <= 0.5) return "sixth"
    if (width <= 1.5) return "third"
    if (width <= 2.5) return "half"
    if (width <= 3.5) return "two-thirds"
    return "full"
}

function widgetHeight(widget: DashboardWidget): DashboardWidgetHeight {
    const template = dashboardWidgetByType.get(widget.type)
    if (template?.fixed) return template.defaultHeight
    const savedHeight = widget.height ?? 1
    // Round previously saved quarter heights up so the widget keeps enough room for its content.
    const maxHeight = template?.category === "Image Containers" ? maxImageHeight : 2
    const height = Number.isInteger(savedHeight * 4) && savedHeight >= .25 && savedHeight <= maxHeight
        ? Math.ceil(savedHeight * rowsPerHeightUnit) / rowsPerHeightUnit : 1
    return Math.max(height, template?.minHeight ?? .5) as DashboardWidgetHeight
}

function isWidgetAreaFree(cells: WidgetLayout['cells'], placement: WidgetPlacement, ignoreId?: string) {
    const {column, row, width, heightRows} = placement
    if (column < 0 || column + width > gridColumns || row < 0 || row > maxGridRow) return false
    for (let y = row; y < row + heightRows; y++) {
        for (let x = column; x < column + width; x++) {
            const occupant = cells[y]?.[x]
            if (occupant && occupant !== ignoreId) return false
        }
    }
    return true
}

function closestPlacementOverGap(cells: WidgetLayout['cells'], source: WidgetPlacement, gap: WidgetPlacement,
                                 projected: WidgetPlacement, widgetId: string) {
    // The widget can straddle the gap and its previous footprint. Its full bounds must still be free.
    const firstColumn = Math.max(0, gap.column - source.width + 1)
    const lastColumn = Math.min(gridColumns - source.width, gap.column + gap.width - 1)
    const firstRow = Math.max(0, gap.row - source.heightRows + 1)
    const lastRow = Math.min(cells.length - source.heightRows, gap.row + gap.heightRows - 1)
    let closest: WidgetPlacement | undefined
    let distance = Infinity
    for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
            const candidate = {...source, column, row}
            const candidateDistance = (column - projected.column) ** 2 + (row - projected.row) ** 2
            if (candidateDistance >= distance || !isWidgetAreaFree(cells, candidate, widgetId)) continue
            closest = candidate
            distance = candidateDistance
        }
    }
    return closest
}

function rowsOverlap(a: WidgetPlacement, b: WidgetPlacement) {
    return a.row < b.row + b.heightRows && b.row < a.row + a.heightRows
}

function pushWidgetsRight(placements: WidgetLayout['placements'], id: string, original: WidgetPlacement, resized: WidgetPlacement) {
    const shifted = new Map<string, WidgetPlacement>()
    const neighbors = [...placements].filter(([key]) => key !== id).sort(([, a], [, b]) => a.column - b.column)
    for (const [key, neighbor] of neighbors) {
        let column = neighbor.column
        if (column >= original.column + original.width && rowsOverlap(resized, neighbor)) {
            column = Math.max(column, resized.column + resized.width)
        }
        // Keep the original left-to-right order in every row the neighbor spans.
        for (const prior of shifted.values()) {
            if (rowsOverlap(prior, neighbor)) column = Math.max(column, prior.column + prior.width)
        }
        if (column + neighbor.width > gridColumns) return undefined
        if (column !== neighbor.column) shifted.set(key, {...neighbor, column})
    }
    return shifted
}

function resizeWidgetPlacements(layout: WidgetLayout, id: string, start: WidgetPlacement,
                               template: DashboardCatalogItem, corner: string, dx: number, dy: number) {
    const fromLeft = corner.includes('w')
    const fromTop = corner.includes('n')
    const minWidth = template.minWidth * columnsPerUnit
    const minHeight = template.minHeight * rowsPerHeightUnit
    const image = template.category === "Image Containers"
    const heightLimit = image ? maxImageHeightRows : maxHeightRows
    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
    const limit = Math.min(image ? gridColumns : maxWidgetColumns, fromLeft ? start.column + start.width : gridColumns - start.column)
    const maxWidth = Math.floor(limit / columnsPerResizeStep) * columnsPerResizeStep
    const width = fromLeft ? clamp(start.width - dx, minWidth, maxWidth)
        : corner.includes('e') ? clamp(start.width + dx, minWidth, maxWidth) : start.width
    const heightRows = fromTop ? clamp(start.heightRows - dy, Math.max(minHeight, start.row + start.heightRows - maxGridRow), Math.min(heightLimit, start.row + start.heightRows))
        : corner.includes('s') ? clamp(start.heightRows + dy, minHeight, heightLimit) : start.heightRows

    // Apply any shrink before testing growth so a corner can clear a nearby widget.
    let nextWidth = Math.min(width, start.width)
    let nextHeight = Math.min(heightRows, start.heightRows)
    const rectangle = (columns: number, rows: number): WidgetPlacement => ({
        column: fromLeft ? start.column + start.width - columns : start.column,
        row: fromTop ? start.row + start.heightRows - rows : start.row,
        width: columns, heightRows: rows,
    })
    let shifted = new Map<string, WidgetPlacement>()
    while (nextWidth < width) {
        const wider = rectangle(nextWidth + columnsPerResizeStep, nextHeight)
        if (fromLeft) {
            if (!isWidgetAreaFree(layout.cells, wider, id)) break
        } else {
            const neighbors = pushWidgetsRight(layout.placements, id, start, wider)
            if (!neighbors) break
            shifted = neighbors
        }
        nextWidth = wider.width
    }
    const placements = new Map([...layout.placements, ...shifted])
    while (nextHeight < heightRows) {
        const taller = rectangle(nextWidth, nextHeight + 1)
        const blocked = [...placements].some(([key, neighbor]) => key !== id && rowsOverlap(taller, neighbor)
            && taller.column < neighbor.column + neighbor.width && neighbor.column < taller.column + taller.width)
        if (blocked) break
        nextHeight++
    }
    placements.set(id, rectangle(nextWidth, nextHeight))
    return placements
}

function gridStep(grid: HTMLElement) {
    const styles = getComputedStyle(grid)
    const gap = parseFloat(styles.columnGap) || 0
    return {
        columnStep: (grid.clientWidth + gap) / gridColumns,
        rowStep: (parseFloat(styles.gridAutoRows) || 80) + (parseFloat(styles.rowGap) || 0),
    }
}

function buildWidgetLayout(widgets: DashboardWidget[]): WidgetLayout {
    const cells: Array<Array<string | undefined>> = []
    const placements = new Map<string, WidgetPlacement>()
    const olderCardPositions = new Set(widgets.filter(olderQuickLinkCard).map(widget => `${widget.row}:${savedColumn(widget)}`))
    const formerCardWidth = 1.5 * columnsPerUnit

    for (const widget of [...widgets].sort((a, b) => Number(b.row != null) - Number(a.row != null) || Number(needsFixedWidgetReflow(a)) - Number(needsFixedWidgetReflow(b)))) {
        const width = widgetWidth(widget) * columnsPerUnit
        const heightRows = widgetHeight(widget) * rowsPerHeightUnit
        let placement: WidgetPlacement | undefined
        let column = savedColumn(widget)
        if (column != null && widget.row != null && Number.isInteger(widget.row * 2)) {
            // Tighten existing runs of cards so the extra card can fit beside them.
            if (olderQuickLinkCard(widget)) {
                for (let previous = column - formerCardWidth; olderCardPositions.has(`${widget.row}:${previous}`); previous -= formerCardWidth) {
                    column -= formerCardWidth - width
                }
            }
            const saved = {column, row: Math.round(widget.row), width, heightRows}
            if (Number.isInteger(column) && isWidgetAreaFree(cells, saved)) placement = saved
            if (!placement && needsFixedWidgetReflow(widget)) {
                // Preserve unchanged anchors and keep a resized widget on its row if it still fits.
                const candidates = Array.from({length: gridColumns - width + 1}, (_, index) => ({...saved, column: index}))
                candidates.sort((a, b) => Math.abs(a.column - saved.column) - Math.abs(b.column - saved.column))
                placement = candidates.find(candidate => isWidgetAreaFree(cells, candidate))
            }
        }

        for (let row = 0; !placement; row += 1) {
            for (let column = 0; column <= gridColumns - width; column += 1) {
                const available = Array.from({length: heightRows}, (_, rowOffset) => row + rowOffset)
                    .every((candidateRow) => Array.from({length: width}, (_, columnOffset) => column + columnOffset)
                        .every((candidateColumn) => !cells[candidateRow]?.[candidateColumn]))
                if (available) {
                    placement = {column, row, width, heightRows}
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

    // Partition every empty region into a drop target, without treating it as occupied content.
    const slots: WidgetPlacement[] = []
    const visited = cells.map((row) => row.map(Boolean))
    for (let row = 0; row < cells.length; row += 1) {
        for (let column = 0; column < gridColumns; column += 1) {
            if (visited[row]?.[column]) continue
            let width = 0
            while (column + width < gridColumns && !visited[row]?.[column + width]) width += 1
            let heightRows = 1
            while (row + heightRows < cells.length && heightRows < maxImageHeightRows && Array.from({length: width}, (_, dx) => column + dx).every((x) => !visited[row + heightRows]?.[x])) heightRows += 1
            slots.push({column, row, width, heightRows})
            for (let y = row; y < row + heightRows; y += 1) {
                visited[y] ??= []
                for (let x = column; x < column + width; x += 1) visited[y][x] = true
            }
        }
    }
    return {cells, placements, slots}
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
            .map((widget, index) => ({widget, index, placement: layout.placements.get(widget.id)}))
            .filter(({placement}) => placement && placement.row >= startRow && placement.row < endRow)
            .map(({widget, index}) => ({widget, index}))
        return {
            id: `section-${sectionIndex}-${sectionWidgets[0]?.widget.id ?? "empty"}`.slice(0, 100),
            widgets: sectionWidgets,
            layout: buildWidgetLayout(sectionWidgets.map(({widget}) => widget))
        }
    }).filter(({widgets: sectionWidgets}) => sectionWidgets.length > 0)
}

function ensureWidgetSectionIds(widgets: DashboardWidget[]) {
    if (widgets.every((widget) => widget.sectionId)) return widgets
    return inferWidgetSections(widgets).flatMap((section) => section.widgets.map(({widget}) => ({
        ...widget,
        sectionId: widget.sectionId ?? section.id,
    })))
}

function buildWidgetSections(widgets: DashboardWidget[]) {
    const sections: Array<{ id: string; widgets: Array<{ widget: DashboardWidget; index: number }> }> = []
    widgets.forEach((widget, index) => {
        const sectionId = widget.sectionId ?? `section-${index}-${widget.id}`.slice(0, 100)
        const currentSection = sections.at(-1)
        if (!currentSection || currentSection.id !== sectionId) sections.push({id: sectionId, widgets: []})
        sections.at(-1)!.widgets.push({widget, index})
    })
    return sections.map((section) => ({
        ...section,
        layout: buildWidgetLayout(section.widgets.map(({widget}) => widget)),
    }))
}

function firstAvailableWidgetSpace(widgets: DashboardWidget[], item: DashboardCatalogItem): WidgetInsertTarget | undefined {
    const width = item.defaultWidth * columnsPerUnit
    const heightRows = item.defaultHeight * rowsPerHeightUnit
    for (const section of buildWidgetSections(widgets)) {
        const {cells} = section.layout
        for (let row = 0; row < cells.length; row++) {
            for (let column = 0; column <= gridColumns - width; column++) {
                if (isWidgetAreaFree(cells, {column, row, width, heightRows})) {
                    return {sectionId: section.id, index: section.widgets.at(-1)!.index + 1, column, row,
                        maxColumns: width, maxHeight: item.defaultHeight}
                }
            }
        }
    }
}

// Keep the visible positions when a widget moves into a gap; dense packing must not refill its old space.
function captureWidgetPositions(widgets: DashboardWidget[]) {
    return buildWidgetSections(widgets).flatMap((section) => section.widgets.map(({widget}) => {
        const placement = section.layout.placements.get(widget.id)!
        return {...widget, column: placement.column / columnsPerResizeStep, row: placement.row}
    }))
}

function fitWidgetWidth(width: DashboardWidgetWidth, maxColumns: number, minWidth: DashboardWidgetWidth) {
    if (width * columnsPerUnit <= maxColumns) return width
    const allowedWidths = widthOrder.filter(candidate => candidate >= minWidth && candidate * columnsPerUnit <= maxColumns)
    if (allowedWidths.length === 0) return undefined
    return [...allowedWidths].reverse().find((candidate) => candidate <= width) ?? allowedWidths[0]
}

function widthLabelForColumns(columns: number) {
    return `${columns / columnsPerUnit}W`
}

function normalizeWidget(widget: DashboardWidget): DashboardWidget {
    const width = widgetWidth(widget)
    return {...widget, width, height: widgetHeight(widget), size: legacySizeForWidth(width)}
}

function starterWidget(type: DashboardNewWidgetType, sectionId: string, left: number, options: {
    id?: string; width?: DashboardWidgetWidth; rows?: DashboardTextRow[]
} = {}): DashboardWidget {
    const template = dashboardWidgetByType.get(type)!
    const width = options.width ?? template.defaultWidth
    return {
        id: `default-${options.id ?? type}`, type, sectionId, column: left * columnsPerUnit / columnsPerResizeStep, row: 0,
        size: legacySizeForWidth(width), width, height: template.defaultHeight,
        content: options.rows && JSON.stringify({rows: options.rows}),
    }
}

function starterLinks(links: DashboardQuickLink[]) {
    return links.map((link, index) => starterWidget(`link-${link}-chip`, "default-links", index))
}

const defaultDashboardWidgets = [
    starterWidget("text-rows-3", "default-header", 0, {id: "org-heading", width: 3.5, rows: [
        {text: "WORKSHOP OVERVIEW", align: "left", size: 12, font: "IBM Plex Mono", bold: true},
        {text: "%org_name%", align: "left", size: 30, bold: true},
        {text: "Teams %org_team_count% · Projects %org_project_count%", align: "left", runs: [
            {text: "Teams ", size: 14}, {text: "%org_team_count%", bold: true},
            {text: " · Projects ", size: 14}, {text: "%org_project_count%", bold: true},
        ]},
    ]}),
    starterWidget("info-org-members", "default-header", 3.5),
    ...starterLinks(["teams", "org-chart", "sdlc", "todo", "bug-reports"]),
    starterWidget("info-org-todos", "default-overview", 0, {width: 3}),
    starterWidget("info-org-teams", "default-overview", 3),
    starterWidget("graph-tasks", "default-project-health", 0),
    starterWidget("graph-bugs", "default-project-health", 2.5),
]

const defaultPersonalWidgets = [
    starterWidget("text-rows-3", "default-header", 0, {id: "personal-heading", width: 3.5, rows: [
        {text: "YOUR WORKSHOP", align: "left", size: 12, font: "IBM Plex Mono", bold: true},
        {text: "Welcome, %personal_first_name%", align: "left", runs: [
            {text: "Welcome, ", size: 24}, {text: "%personal_first_name%", size: 30, bold: true},
        ]},
        {text: "Working in %org_name%", align: "left", runs: [
            {text: "Working in ", size: 14}, {text: "%org_name%", size: 14, bold: true},
        ]},
    ]}),
    starterWidget("text-rows-3", "default-header", 3.5, {id: "personal-snapshot", width: 1.5, rows: [
        {text: "MY WORKDAY", size: 12, font: "IBM Plex Mono", bold: true},
        {text: "Open tasks · %personal_open_task_count%", runs: [
            {text: "Open tasks · ", size: 14}, {text: "%personal_open_task_count%", size: 20, bold: true},
        ]},
        {text: "Local time · %personal_time%", runs: [
            {text: "Local time · ", size: 14}, {text: "%personal_time%", size: 14, font: "IBM Plex Mono"},
        ]},
    ]}),
    ...starterLinks(["todo", "calendar", "project-wiki", "project", "erd"]),
    starterWidget("info-personal-tasks", "default-overview", 0, {width: 2.5}),
    starterWidget("info-schedule", "default-overview", 2.5, {width: 2.5}),
]

export function WorkshopLobbyPage() {
    const {organization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id ?? "current")
    const [params, setParams] = useSearchParams()
    const view = getDashboardView(userId, organization.id, params.get("view"))
    const personal = view === "personal"
    useEffect(() => {
        setDashboardView(userId, organization.id, view)
        if (params.get("view") !== view) {
            setParams(current => {const next = new URLSearchParams(current); next.set("view", view); return next}, {replace: true})
        }
    }, [userId, organization.id, view, params, setParams])
    return <DashboardContent key={`${organization.id}:${userId}:${personal}`} personal={personal}/>
}

function DashboardContent({personal}: {personal: boolean}) {
    const dispatch = useAppDispatch()
    const {organization, project, setDashboardEditing} = useOutletContext<WorkshopOutletContext>()
    const user = useAppSelector((state) => state.auth.user)
    const [isEditing, setIsEditing] = useState(false)
    const [libraryOpen, setLibraryOpen] = useState(false)
    const [widgetInsertTarget, setWidgetInsertTarget] = useState<WidgetInsertTarget>()
    const [draftWidgets, setDraftWidgets] = useState<DashboardWidget[]>([])
    const [draftWidgetGap, setDraftWidgetGap] = useState(defaultWidgetGap)
    const [focusedWidgetId, setFocusedWidgetId] = useState<string>()
    const [draggedWidgetId, setDraggedWidgetId] = useState<string>()
    const moveGesture = useRef<WidgetMoveGesture | null>(null)
    const suppressWidgetClick = useRef(false)
    const [dropTargetId, setDropTargetId] = useState<string>()
    const nativePaletteItem = useRef<DashboardCatalogItem | null>(null)
    const paletteWindow = useDashboardPaletteWindow(isEditing, closeWidgetLibrary)
    const [dragOffset, setDragOffset] = useState({x: 0, y: 0})
    const resizeGesture = useRef<{
        id: string;
        pointerId: number;
        x: number;
        y: number;
        placement: WidgetPlacement;
        layout: WidgetLayout;
        template: DashboardCatalogItem;
        columnStep: number;
        rowStep: number;
        corner: string
    } | null>(null)
    const [resizingWidgetId, setResizingWidgetId] = useState<string>()
    const [publishError, setPublishError] = useState("")
    const [now, setNow] = useState(() => new Date())
    const isPersistedOrganization = guidPattern.test(organization.id)
    const canManageDashboard = isPersistedOrganization && (personal || hasWorkshopPermission(organization, user?.id ?? "current", "Manage dashboard"))
    const orgQuery = useGetOrganizationDashboardQuery(
        organization.id,
        {skip: !isPersistedOrganization || personal},
    )
    const personalKey = {organizationId: organization.id, userId: user?.id ?? "current"}
    const personalQuery = useGetPersonalDashboardQuery(personalKey, {skip: !isPersistedOrganization || !personal})
    const dashboardQuery = personal ? personalQuery : orgQuery
    const savedWidgetGap = dashboardQuery.currentData?.widgetGap ?? defaultWidgetGap
    const widgetGap = isEditing ? draftWidgetGap : savedWidgetGap
    const dashboardLoading = dashboardQuery.isLoading
    const dashboardError = dashboardQuery.error
    const [publishDashboard, {isLoading: orgPublishing}] = usePublishOrganizationDashboardMutation()
    const [savePersonalDashboard, {isLoading: personalSaving}] = useSavePersonalDashboardMutation()
    const isPublishing = orgPublishing || personalSaving
    useEffect(() => {
        setDashboardEditing?.(isEditing || isPublishing)
        return () => setDashboardEditing?.(false)
    }, [isEditing, isPublishing, setDashboardEditing])
    const defaults = personal ? defaultPersonalWidgets : defaultDashboardWidgets

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30_000)
        return () => window.clearInterval(timer)
    }, [])

    const members = organization.members
    const currentUserId = user?.id ?? "current"
    const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : members.find((member) => member.id === currentUserId)?.name ?? "there"
    const onlineMembers = members.filter((member) => member.online)
    const publishedWidgets = useMemo(() => {
        const stored = personal ? (personalQuery.currentData?.savedAtUtc ? personalQuery.currentData.widgets : defaults)
            : (orgQuery.currentData?.publishedAtUtc ? orgQuery.currentData.widgets : defaults)
        // Saved layouts can still contain widgets from before the revamp.
        return ensureWidgetSectionIds(stored.map(normalizeDashboardImageFrame).filter(widget => dashboardWidgetByType.has(widget.type)))
    }, [personal, personalQuery.currentData, orgQuery.currentData, defaults])
    const visibleWidgets = isEditing ? draftWidgets : publishedWidgets
    const widgetSections = useMemo(() => buildWidgetSections(visibleWidgets), [visibleWidgets])

    function beginEditing() {
        if (!canManageDashboard || dashboardLoading || dashboardError) return
        setLibraryOpen(false)
        setWidgetInsertTarget(undefined)
        setDropTargetId(undefined)
        setDraftWidgets(captureWidgetPositions(publishedWidgets).map(normalizeWidget))
        setDraftWidgetGap(savedWidgetGap)
        setPublishError("")
        setIsEditing(true)
    }

    function resetToDefault() {
        setDraftWidgets(defaults.map(normalizeWidget))
        setDraftWidgetGap(defaultWidgetGap)
        setFocusedWidgetId(undefined)
        setDraggedWidgetId(undefined)
        setDropTargetId(undefined)
        setPublishError("")
    }

    function widgetFits(item: DashboardCatalogItem, target = widgetInsertTarget) {
        return !target || item.minWidth * columnsPerUnit <= target.maxColumns && item.minHeight <= target.maxHeight
    }

    function addWidget(item: DashboardCatalogItem, target = widgetInsertTarget) {
        if (isPublishing || !widgetFits(item, target) || draftWidgets.length >= 30) return

        setDraftWidgets((current) => {
            if (current.length >= 30) return current
            const destination = target ?? firstAvailableWidgetSpace(current, item)
            current = captureWidgetPositions(current)
            const insertIndex = Math.min(destination?.index ?? current.length, current.length)
            const width = fitWidgetWidth(item.defaultWidth, destination?.maxColumns ?? gridColumns, item.minWidth)
            if (!width) return current
            const sectionId = destination?.newSection || !destination?.sectionId
                ? `section-${createClientId()}`
                : destination.sectionId
            const widget: DashboardWidget = {
                id: `${item.type}-${createClientId()}`,
                type: item.type,
                sectionId,
                column: destination?.column == null ? undefined : destination.column / columnsPerResizeStep, row: destination?.row,
                size: legacySizeForWidth(width),
                width,
                height: Math.max(item.minHeight, Math.min(item.defaultHeight, destination?.maxHeight ?? 2)) as DashboardWidgetHeight,
                content: dashboardWidgetStarterContent(item.type),
            }
            const next = [...current]
            next.splice(insertIndex, 0, widget)
            return next
        })
        setWidgetInsertTarget(undefined)
    }

    function openWidgetLibrary(target?: WidgetInsertTarget) {
        if (!isEditing || isPublishing) return
        setWidgetInsertTarget(target)
        paletteWindow.open()
        setLibraryOpen(true)
    }

    function clearPaletteDrag() {
        nativePaletteItem.current = null
        setDropTargetId(undefined)
    }

    function closeWidgetLibrary() {
        setLibraryOpen(false)
        setWidgetInsertTarget(undefined)
        clearPaletteDrag()
    }

    function dropWidget(sourceId: string, targetId: string) {
        if (sourceId === targetId) return
        setDraftWidgets((current) => {
            current = captureWidgetPositions(current)
            const sourceIndex = current.findIndex((widget) => widget.id === sourceId)
            const targetIndex = current.findIndex((widget) => widget.id === targetId)
            if (sourceIndex < 0 || targetIndex < 0) return current
            const destination = current[targetIndex]
            const targetSectionId = destination.sectionId
            const next = [...current]
            const [widget] = next.splice(sourceIndex, 1)
            const destinationIndex = next.findIndex((candidate) => candidate.id === targetId)
            next[destinationIndex] = {
                ...destination,
                sectionId: widget.sectionId,
                column: widget.column,
                row: widget.row
            }
            next.splice(targetIndex, 0, {
                ...widget,
                sectionId: targetSectionId,
                column: destination.column,
                row: destination.row
            })
            // Keep each section contiguous after a cross-section swap.
            const sectionOrder = [...new Set(current.map((candidate) => candidate.sectionId))]
            next.sort((a, b) => sectionOrder.indexOf(a.sectionId) - sectionOrder.indexOf(b.sectionId))
            return next
        })
        setDraggedWidgetId(undefined)
    }

    function dropWidgetIntoSpace(sourceId: string, target: WidgetInsertTarget) {
        setDraftWidgets((current) => {
            current = captureWidgetPositions(current)
            const sourceIndex = current.findIndex((widget) => widget.id === sourceId)
            if (sourceIndex < 0) return current
            const next = [...current]
            const [widget] = next.splice(sourceIndex, 1)
            const template = dashboardWidgetByType.get(widget.type)
            if (!template) return current
            const width = fitWidgetWidth(widgetWidth(widget), target.maxColumns, template.minWidth)
            if (!width || template.minHeight > target.maxHeight) return current
            const insertIndex = sourceIndex < target.index ? target.index - 1 : target.index
            next.splice(insertIndex, 0, {
                ...widget,
                sectionId: target.sectionId,
                column: target.column == null ? undefined : target.column / columnsPerResizeStep, row: target.row,
                size: legacySizeForWidth(width),
                width,
                height: Math.max(template.minHeight, Math.min(widgetHeight(widget), target.maxHeight)) as DashboardWidgetHeight,
            })
            return next
        })
        setDraggedWidgetId(undefined)
    }

    function beginWidgetMove(event: PointerEvent<HTMLElement>, widgetId: string) {
        if (!isEditing || resizeGesture.current || moveGesture.current || event.button !== 0 || !event.isPrimary) return
        const target = event.target as HTMLElement
        if (target.closest('textarea, input, select, [contenteditable="true"], [role="dialog"], [role="listbox"], [data-dashboard-text-editor], .dashboard-widget-field, .dashboard-widget-config, .workshop-widget-remove, .workshop-widget-resize')) {
            suppressWidgetClick.current = false
            return
        }
        event.preventDefault()
        setFocusedWidgetId(widgetId)
        suppressWidgetClick.current = false
        moveGesture.current = {
            id: widgetId,
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            active: false,
            ...gridStep(event.currentTarget.closest<HTMLElement>('.workshop-widget-grid')!),
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    function targetForEmptySpace(element: HTMLElement): WidgetInsertTarget | undefined {
        const section = widgetSections.find(candidate => candidate.id === element.dataset.widgetSection)
        const slot = section?.layout.slots.find(candidate => `${section.id}:${candidate.row}:${candidate.column / columnsPerResizeStep}` === element.dataset.widgetSpace)
        if (!section || !slot) return
        return {index: section.widgets.at(-1)!.index + 1, maxColumns: slot.width, maxHeight: slot.heightRows / rowsPerHeightUnit as DashboardWidgetHeight,
            sectionId: section.id, column: slot.column, row: slot.row}
    }

    function widgetMoveTarget(gesture: WidgetMoveGesture, x: number, y: number): {id?: string; space?: WidgetInsertTarget} | undefined {
        const element = document.elementsFromPoint(x, y)
            .map(node => node.closest<HTMLElement>('[data-widget-id], [data-widget-space], [data-widget-grid]'))
            .find(node => node && node.dataset.widgetId !== gesture.id)
        if (!element) return
        const {widgetId, widgetSpace, widgetGrid} = element.dataset
        if (widgetId) return {id: widgetId}

        const sourceSection = widgetSections.find(section => section.layout.placements.has(gesture.id))
        const source = sourceSection?.layout.placements.get(gesture.id)
        if (!sourceSection || !source) return
        const target = widgetSpace ? targetForEmptySpace(element) : undefined
        if (widgetGrid === sourceSection.id || target?.sectionId === sourceSection.id) {
            const {cells} = sourceSection.layout
            const projected = {...source, column: source.column + Math.round((x - gesture.x) / gesture.columnStep),
                row: source.row + Math.round((y - gesture.y) / gesture.rowStep)}
            let placement: WidgetPlacement | undefined = projected
            if (target?.column != null && target.row != null) {
                const gap = {column: target.column, row: target.row, width: target.maxColumns, heightRows: target.maxHeight * rowsPerHeightUnit}
                placement = source.width <= gap.width && source.heightRows <= gap.heightRows
                    ? {...source, column: gap.column, row: gap.row}
                    : closestPlacementOverGap(cells, source, gap, projected, gesture.id)
            }
            if (placement && placement.row + source.heightRows <= cells.length && isWidgetAreaFree(cells, placement, gesture.id)) {
                const {column, row} = placement
                if (column === source.column && row === source.row) return
                return {id: widgetSpace, space: {
                    index: target?.index ?? sourceSection.widgets.at(-1)!.index + 1,
                    sectionId: sourceSection.id, column, row, maxColumns: source.width,
                    maxHeight: source.heightRows / rowsPerHeightUnit as DashboardWidgetHeight,
                }}
            }
        }
        if (target) {
            const widget = sourceSection.widgets.find(({widget}) => widget.id === gesture.id)!.widget
            const template = dashboardWidgetByType.get(widget.type)
            if (template && widgetFits(template, target)) return {id: widgetSpace, space: target}
        }
    }

    function paletteDropTarget(item: DashboardCatalogItem, x: number, y: number) {
        if (!isEditing || isPublishing || draftWidgets.length >= 30) return
        const element = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-widget-space], [data-widget-id], [data-widget-insert]")
        if (!element) return
        const {widgetSpace, widgetId, widgetInsert} = element.dataset
        if (widgetSpace) {
            const target = targetForEmptySpace(element)
            if (target && item.defaultWidth * columnsPerUnit <= target.maxColumns && item.defaultHeight <= target.maxHeight) return {id: widgetSpace, target}
        } else if (widgetInsert !== undefined) {
            return {id: `insert:${widgetInsert}`, target: {index: Number(widgetInsert), maxColumns: gridColumns, maxHeight: 2, newSection: true} as const}
        } else if (widgetId) {
            const section = widgetSections.find(candidate => candidate.widgets.some(({widget}) => widget.id === widgetId))
            const destination = section?.widgets.find(({widget}) => widget.id === widgetId)
            if (section && destination) return {id: widgetId, target: {index: destination.index + 1, maxColumns: gridColumns, maxHeight: 2, sectionId: section.id} as const}
        }
    }

    function highlightPaletteDrop(item: DashboardCatalogItem, x: number, y: number) {
        const destination = paletteDropTarget(item, x, y)
        setDropTargetId(destination?.id)
        return !!destination
    }

    function placePaletteWidget(item: DashboardCatalogItem, x: number, y: number) {
        const destination = paletteDropTarget(item, x, y)
        clearPaletteDrag()
        if (!destination) return false
        addWidget(item, destination.target)
        return true
    }

    function nativePaletteDragOver(event: DragEvent<HTMLDivElement>) {
        const item = nativePaletteItem.current
        if (!item || !event.dataTransfer.types.includes(dashboardWidgetDragMime)) return
        if (!highlightPaletteDrop(item, event.clientX, event.clientY)) return
        event.preventDefault()
        event.dataTransfer.dropEffect = "copy"
    }

    function nativePaletteDrop(event: DragEvent<HTMLDivElement>) {
        const item = nativePaletteItem.current
        if (!item || event.dataTransfer.getData(dashboardWidgetDragMime) !== item.type) return
        event.preventDefault()
        if (placePaletteWidget(item, event.clientX, event.clientY)) paletteWindow.refocusAfterDrop()
    }

    function moveWidgetPointer(event: PointerEvent<HTMLElement>) {
        const gesture = moveGesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        const x = event.clientX - gesture.x
        const y = event.clientY - gesture.y
        if (!gesture.active && Math.hypot(x, y) < 5) return
        gesture.active = true
        suppressWidgetClick.current = true
        setDraggedWidgetId(gesture.id)
        setDragOffset({x, y})
        setDropTargetId(widgetMoveTarget(gesture, event.clientX, event.clientY)?.id)
    }

    function finishWidgetMove(event: PointerEvent<HTMLElement>, cancelled = false) {
        const gesture = moveGesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        moveGesture.current = null
        if (gesture.active && !cancelled) {
            const target = widgetMoveTarget(gesture, event.clientX, event.clientY)
            if (target?.space) dropWidgetIntoSpace(gesture.id, target.space)
            else if (target?.id) dropWidget(gesture.id, target.id)
        }
        setDraggedWidgetId(undefined)
        setDropTargetId(undefined)
        setDragOffset({x: 0, y: 0})
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    }

    function startResize(event: PointerEvent<HTMLButtonElement>, widget: DashboardWidget, corner: string) {
        if (event.button !== 0 || !event.isPrimary || moveGesture.current || resizeGesture.current) return
        const section = widgetSections.find(section => section.layout.placements.has(widget.id))
        const placement = section?.layout.placements.get(widget.id)
        const template = dashboardWidgetByType.get(widget.type)
        if (!section || !placement || !template || template.fixed) return
        event.preventDefault()
        event.stopPropagation()
        setFocusedWidgetId(widget.id)
        resizeGesture.current = {
            id: widget.id, pointerId: event.pointerId, x: event.clientX, y: event.clientY,
            placement, layout: section.layout, template, corner,
            ...gridStep(event.currentTarget.closest<HTMLElement>('.workshop-widget-grid')!),
        }
        setResizingWidgetId(widget.id)
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    function resizeWidget(event: PointerEvent<HTMLButtonElement>) {
        const gesture = resizeGesture.current
        if (!gesture || gesture.pointerId !== event.pointerId) return
        event.stopPropagation()
        const dx = Math.round((event.clientX - gesture.x) / (gesture.columnStep * columnsPerResizeStep)) * columnsPerResizeStep
        const dy = Math.round((event.clientY - gesture.y) / gesture.rowStep)
        applyWidgetPlacements(resizeWidgetPlacements(gesture.layout, gesture.id, gesture.placement, gesture.template, gesture.corner, dx, dy))
    }

    function applyWidgetPlacements(placements: WidgetLayout['placements']) {
        setDraftWidgets(current => {
            let changed = false
            const next = current.map(widget => {
                const placement = placements.get(widget.id)
                if (!placement) return widget
                const {row} = placement
                const column = placement.column / columnsPerResizeStep
                const width = placement.width / columnsPerUnit as DashboardWidgetWidth
                const height = placement.heightRows / rowsPerHeightUnit as DashboardWidgetHeight
                if (widget.column === column && widget.row === row && widget.width === width && widget.height === height) return widget
                changed = true
                return {...widget, column, row, width, height, size: legacySizeForWidth(width)}
            })
            return changed ? next : current
        })
    }

    function finishResize() {
        resizeGesture.current = null
        setResizingWidgetId(undefined)
    }

    async function publishChanges() {
        if (!canManageDashboard || isPublishing) return
        setPublishError("")
        try {
            const widgets = captureWidgetPositions(draftWidgets).map(normalizeWidget)
            if (personal) {
                const savedDashboard = await savePersonalDashboard({...personalKey, widgets, widgetGap: draftWidgetGap}).unwrap()
                dispatch(api.util.updateQueryData("getPersonalDashboard", personalKey, () => savedDashboard))
            } else {
                const savedDashboard = await publishDashboard({organizationId: organization.id, widgets, widgetGap: draftWidgetGap}).unwrap()
                dispatch(api.util.updateQueryData("getOrganizationDashboard", organization.id, () => savedDashboard))
            }
            setIsEditing(false)
            setDraftWidgets([])
        } catch (error) {
            setPublishError(getApiErrorMessage(error))
        }
    }

    const widgetContext: DashboardDataContext = {organization, project, user, userId: currentUserId, displayName, persisted: isPersistedOrganization, now}

    return (
        <div className={cn("workshop-page workshop-dashboard-page", libraryOpen && isEditing && !paletteWindow.surface && "has-widget-palette")} onPointerDown={(event) => {
            const target = event.target as HTMLElement
            if (target.ownerDocument === event.currentTarget.ownerDocument && !target.closest('[data-widget-id], [data-dashboard-text-editor], [role="listbox"]')) setFocusedWidgetId(undefined)
        }}>
            <section className="workshop-dashboard-heading">
                <div><h2>{personal ? "Personal Dashboard" : "Org Dashboard"}</h2>
                </div>
                <div className="workshop-dashboard-heading-actions">
                    <Badge variant="outline"><i/> {onlineMembers.length} online</Badge>
                    {canManageDashboard && !isEditing &&
                        <Button onClick={beginEditing} disabled={dashboardLoading || !!dashboardError} type="button" variant="outline"><Settings2/> Manage
                            Dashboard</Button>}
                </div>
            </section>

            {isEditing && <div className="workshop-dashboard-editor-bar">
                <div>
                    <LayoutDashboard/><span><strong>Edit mode</strong><small>{personal ? "Only you can see this layout. Save or discard to switch dashboards." : "Publish or discard to switch dashboards."}</small></span>
                </div>
                <div><label className="dashboard-widget-gap-control">Widget gap
                    <input type="range" min={minWidgetGap} max={maxWidgetGap} value={draftWidgetGap} disabled={isPublishing}
                           aria-valuetext={`${draftWidgetGap} pixels`} onChange={event => setDraftWidgetGap(event.currentTarget.valueAsNumber)}/>
                    <span aria-hidden="true">{draftWidgetGap} px</span>
                </label><Button onClick={() => openWidgetLibrary()} disabled={isPublishing} type="button" variant="outline"><Plus/> Add
                    widget</Button><Button onClick={resetToDefault} type="button" variant="outline"><RotateCcw/> Reset
                    to default</Button><Button onClick={() => {
                    setDraftWidgets([]);
                    setPublishError("");
                    setIsEditing(false)
                }} disabled={isPublishing} type="button" variant="ghost">Discard</Button><Button disabled={isPublishing}
                                                                         onClick={() => void publishChanges()}
                                                                         type="button">{personal ? isPublishing ? "Saving…" : "Save personal dashboard" : isPublishing ? "Publishing…" : "Publish for everyone"}</Button>
                </div>
            </div>}
            {publishError && <WorkshopToast variant="error" onDismiss={() => setPublishError("")}>{publishError}</WorkshopToast>}

            {dashboardError && !isEditing ? <WorkshopEmptyState icon={LayoutDashboard} title="Could not load dashboard" description="Try again to load your saved layout." action={<Button onClick={() => void dashboardQuery.refetch()}>Retry</Button>}/> : dashboardLoading && !isEditing ? <div className="workshop-dashboard-loading">Loading dashboard…</div> : (
                <div className={cn("workshop-widget-sections", isEditing && visibleWidgets.length === 0 && "dashboard-empty-drop-area", dropTargetId === "insert:0" && visibleWidgets.length === 0 && "is-drop-target")}
                     style={widgetGap !== defaultWidgetGap ? {"--dashboard-widget-gap": `${widgetGap}px`} as CSSProperties : undefined}
                     data-widget-insert={isEditing && visibleWidgets.length === 0 ? 0 : undefined}
                     onDragOver={nativePaletteDragOver} onDrop={nativePaletteDrop} onDragLeave={event => {
                        if (nativePaletteItem.current && (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget))) setDropTargetId(undefined)
                     }}>
                    {widgetSections.map((section, sectionIndex) => {
                        const firstIndex = section.widgets[0].index
                        const lastIndex = section.widgets.at(-1)!.index
                        return <section className="workshop-widget-section" key={section.id}>
                            {isEditing && sectionIndex > 0 && <button className={cn("workshop-add-section-rail", dropTargetId === `insert:${firstIndex}` && "is-drop-target")} data-widget-insert={firstIndex}
                                                                      onClick={() => openWidgetLibrary({
                                                                          index: firstIndex,
                                                                          maxColumns: gridColumns,
                                                                          maxHeight: 2,
                                                                          newSection: true
                                                                      })} type="button"><span><Plus/> Add section</span>
                            </button>}
                            <div className={cn("workshop-widget-grid", isEditing && "is-editing")} data-widget-grid={section.id}>
                                {section.widgets.map(({widget}) => {
                                    const template = dashboardWidgetByType.get(widget.type)
                                    const placement = section.layout.placements.get(widget.id)
                                    if (!template || !placement) return null
                                    const height = widgetHeight(widget)
                                    const width = widgetWidth(widget)
                                    return <section
                                        className={cn("workshop-widget", `workshop-widget-width-${String(width).replace(".", "-")}`, `workshop-widget-height-${String(height).replace(".", "-")}`, isEditing && "is-editing", draggedWidgetId === widget.id && "is-dragging", dropTargetId === widget.id && draggedWidgetId !== widget.id && "is-drop-target", resizingWidgetId === widget.id && "is-resizing", focusedWidgetId === widget.id && "is-focused")}
                                        data-widget-id={widget.id} data-widget-scope={template.scope} key={widget.id} tabIndex={isEditing ? 0 : undefined}
                                        onFocus={() => setFocusedWidgetId(widget.id)}
                                        onPointerDown={(event) => beginWidgetMove(event, widget.id)}
                                        onPointerMove={moveWidgetPointer}
                                        onPointerUp={(event) => finishWidgetMove(event)}
                                        onPointerCancel={(event) => finishWidgetMove(event, true)}
                                        onLostPointerCapture={(event) => finishWidgetMove(event, true)}
                                        onDragStart={(event) => {
                                            if (isEditing) event.preventDefault()
                                        }}
                                        onClickCapture={(event) => {
                                            if (suppressWidgetClick.current || (isEditing && (event.target as HTMLElement).closest('a, .workshop-quick-actions button'))) {
                                                event.preventDefault();
                                                event.stopPropagation();
                                                suppressWidgetClick.current = false
                                            }
                                        }}
                                        style={{
                                            ...dashboardWidgetAppearanceStyle(widget.appearance),
                                            "--widget-height-rows": placement.heightRows,
                                            gridColumn: `${placement.column + 1} / span ${placement.width}`,
                                            gridRow: `${placement.row + 1} / span ${placement.heightRows}`, ...(draggedWidgetId === widget.id ? {transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)`} : {})
                                        } as CSSProperties}>
                                        {isEditing && <>
                                            <span className="dashboard-widget-scope">{template.scope}</span>
                                            <DashboardWidgetAppearanceControl widget={widget} title={template.title} onChange={appearance =>
                                                setDraftWidgets(current => current.map(candidate => candidate.id === widget.id ? {...candidate, appearance} : candidate))}/>
                                            <Button aria-label={`Remove ${template.title}`}
                                                    className="workshop-widget-remove" onPointerDown={() => {
                                                suppressWidgetClick.current = false
                                            }}
                                                    onClick={() => setDraftWidgets((current) => captureWidgetPositions(current).filter((candidate) => candidate.id !== widget.id))}
                                                    size="icon" type="button" variant="ghost"><X/></Button>
                                            {!template.fixed && ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((direction) => <button
                                                aria-label={`Resize ${template.title} from ${direction}`}
                                                className="workshop-resize-handle workshop-widget-resize"
                                                data-direction={direction} key={direction}
                                                onPointerDown={(event) => startResize(event, widget, direction)}
                                                onPointerMove={resizeWidget}
                                                onPointerUp={finishResize} onPointerCancel={finishResize}
                                                onLostPointerCapture={finishResize}
                                                onKeyDown={(event) => {
                                                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
                                                    event.preventDefault()
                                                    const dx = event.key === 'ArrowRight' ? columnsPerResizeStep : event.key === 'ArrowLeft' ? -columnsPerResizeStep : 0
                                                    const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0
                                                    applyWidgetPlacements(resizeWidgetPlacements(section.layout, widget.id, placement, template, direction, dx, dy))
                                                }} title="Drag to resize; arrow keys adjust size" type="button"/>)}
                                        </>}
                                        <DashboardWidgetContent context={widgetContext} editing={isEditing}
                                                                onContentChange={(content) => setDraftWidgets((current) => current.map((candidate) => candidate.id === widget.id ? {
                                                                    ...candidate,
                                                                    content
                                                                } : candidate))} widget={widget}/>
                                    </section>
                                })}
                                {isEditing && section.layout.slots.map((slot) => {
                                    const maxHeight = slot.heightRows / rowsPerHeightUnit as DashboardWidgetHeight
                                    const slotId = `${section.id}:${slot.row}:${slot.column / columnsPerResizeStep}`
                                    const target: WidgetInsertTarget = {
                                        index: lastIndex + 1,
                                        maxColumns: slot.width,
                                        maxHeight,
                                        sectionId: section.id,
                                        column: slot.column,
                                        row: slot.row
                                    }
                                    return <button key={slotId}
                                                   aria-label={`Empty space: add or drop a widget, up to ${widthLabelForColumns(slot.width)} wide and ${maxHeight} units high`}
                                                   className={cn("workshop-widget-add-space", dropTargetId === slotId && "is-drop-target")}
                                                   data-widget-space={slotId} data-widget-section={section.id}
                                                   onClick={() => openWidgetLibrary(target)} style={{
                                        gridColumn: `${slot.column + 1} / span ${slot.width}`,
                                        gridRow: `${slot.row + 1} / span ${slot.heightRows}`
                                    }} type="button">
                                        <Plus/><span>{dropTargetId === slotId ? "Drop widget here" : "Add widget here"}</span><small>{widthLabelForColumns(slot.width)} · {maxHeight}H</small>
                                    </button>
                                })}
                            </div>
                        </section>
                    })}
                    {visibleWidgets.length === 0 &&
                        <WorkshopEmptyState icon={LayoutDashboard} title="No widgets yet"
                            description={isEditing ? "Add a section to start building the dashboard." : personal ? "Use Manage Dashboard to add your widgets." : "A dashboard manager can add and publish widgets."} action={isEditing &&
                            <Button data-widget-insert={0} className={dropTargetId === "insert:0" ? "dashboard-new-section-target is-drop-target" : undefined} onClick={() => openWidgetLibrary({
                                index: 0,
                                maxColumns: gridColumns,
                                maxHeight: 2,
                                newSection: true
                            })} type="button"><Plus/>Add section</Button>}/>}
                    {isEditing && visibleWidgets.length > 0 && <button className={cn("workshop-add-section-bottom", dropTargetId === `insert:${visibleWidgets.length}` && "is-drop-target")} data-widget-insert={visibleWidgets.length}
                                                                       onClick={() => openWidgetLibrary({
                                                                           index: visibleWidgets.length,
                                                                           maxColumns: gridColumns,
                                                                           maxHeight: 2,
                                                                           newSection: true
                                                                       })} type="button"><Plus/><span>Add section</span><small>Start
                        a new dashboard row</small></button>}
                </div>
            )}

            <DashboardWidgetPicker open={libraryOpen && isEditing} surface={paletteWindow.surface} onOpenChange={open => {
                if (!open) closeWidgetLibrary()
            }} newSection={widgetInsertTarget?.newSection} projectName={project?.name} fits={widgetFits} full={draftWidgets.length >= 30} onAdd={addWidget}
                onDragOver={highlightPaletteDrop} onDrop={placePaletteWidget} onDragCancel={clearPaletteDrag}
                onNativeDragStart={item => {nativePaletteItem.current = item}}/>

        </div>
    )
}

function DashboardWidgetContent({context, editing, onContentChange, widget}: {
    context: DashboardDataContext;
    editing: boolean;
    onContentChange: (content: string) => void;
    widget: DashboardWidget
}) {
    if (widget.type === "info-org-members") {
        const {members, memberCount} = context.organization
        return <DashboardMemberPresence members={members} memberCount={memberCount}/>
    }
    switch (dashboardWidgetByType.get(widget.type)?.category) {
        case "Quick Links": return <DashboardWidgetLink type={widget.type} project={context.project}/>
        case "Image Containers": return <DashboardImageWidget {...{widget, context, editing, onContentChange}}/>
        case "Text Containers": return <DashboardTextWidget {...{widget, context, editing, onContentChange}}/>
        case "Graphs":
        case "Info": return <DashboardDataWidget {...{widget, context, editing, onContentChange}}/>
        default: return null
    }
}
