import {
  ArrowRight,
  Box,
  Braces,
  Circle,
  Cloud,
  Database,
  Diamond,
  FileText,
  Focus,
  Hand,
  Layers3,
  Lightbulb,
  Maximize2,
  Minus,
  MousePointer2,
  Network,
  Plus,
  Search,
  Server,
  Shapes,
  Square,
  StickyNote,
  UserRound,
  Webhook,
  X,
  type LucideIcon,
} from "lucide-react"
import {
  useCallback,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react"
import { useOutletContext } from "react-router-dom"

import { useAppSelector } from "@/app/hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { hasWorkshopPermission } from "@/features/workshop/workshop-access"
import type { WorkshopOutletContext } from "@/layouts/workshop-layout"
import { createClientId } from "@/lib/create-client-id"

type DiagramShapeKind =
  | "process"
  | "decision"
  | "terminator"
  | "data"
  | "document"
  | "database"
  | "service"
  | "server"
  | "api"
  | "queue"
  | "cloud"
  | "user"
  | "container"
  | "line"
  | "arrow"
  | "dashed-line"

type DiagramShapeDefinition = {
  kind: DiagramShapeKind
  label: string
  icon: LucideIcon
  width: number
  height: number
}

const diagramShapeGroups: { label: string; shapes: DiagramShapeDefinition[] }[] = [
  {
    label: "Flowchart",
    shapes: [
      { kind: "process", label: "Process", icon: Square, width: 190, height: 105 },
      { kind: "decision", label: "Decision", icon: Diamond, width: 145, height: 145 },
      { kind: "terminator", label: "Start / End", icon: Circle, width: 190, height: 85 },
      { kind: "data", label: "Input / Output", icon: Braces, width: 190, height: 105 },
      { kind: "document", label: "Document", icon: FileText, width: 180, height: 120 },
      { kind: "database", label: "Database", icon: Database, width: 145, height: 130 },
    ],
  },
  {
    label: "Architecture",
    shapes: [
      { kind: "service", label: "Service", icon: Box, width: 180, height: 110 },
      { kind: "server", label: "Server", icon: Server, width: 170, height: 120 },
      { kind: "api", label: "API", icon: Webhook, width: 170, height: 105 },
      { kind: "queue", label: "Queue", icon: Layers3, width: 180, height: 105 },
      { kind: "cloud", label: "Cloud", icon: Cloud, width: 175, height: 105 },
      { kind: "user", label: "User", icon: UserRound, width: 120, height: 130 },
    ],
  },
  {
    label: "Layout",
    shapes: [
      { kind: "container", label: "Container", icon: Maximize2, width: 310, height: 220 },
    ],
  },
  {
    label: "Connectors",
    shapes: [
      { kind: "line", label: "Line", icon: Minus, width: 240, height: 90 },
      { kind: "arrow", label: "Arrow", icon: ArrowRight, width: 240, height: 90 },
      { kind: "dashed-line", label: "Dashed", icon: Network, width: 240, height: 90 },
    ],
  },
]

const diagramShapeDefinitions = diagramShapeGroups.flatMap((group) => group.shapes)

type CanvasItem = {
  id: string
  type: "note" | "frame" | "diagram"
  shapeKind?: DiagramShapeKind
  title: string
  body?: string
  x: number
  y: number
  width: number
  height: number
  color: "amber" | "violet" | "cyan" | "slate"
}

const initialItems: CanvasItem[] = [
  { id: "note-one", type: "note", title: "What if setup felt like a conversation?", body: "Keep the first-run experience focused: create a team, choose a project, invite one person.", x: 160, y: 125, width: 230, height: 180, color: "amber" },
  { id: "note-two", type: "note", title: "Permission principle", body: "Members see work from their teams. Leads can coordinate across projects only when explicitly tagged.", x: 670, y: 210, width: 245, height: 190, color: "violet" },
  { id: "frame-one", type: "frame", title: "Workshop navigation study", x: 320, y: 430, width: 490, height: 285, color: "slate" },
  { id: "note-three", type: "note", title: "Project pulse", body: "The dashboard should answer: what changed, what is blocked, and where can I help?", x: 930, y: 500, width: 230, height: 175, color: "cyan" },
]

export function WorkshopIdeationPage() {
  const { organization, project } = useOutletContext<WorkshopOutletContext>()
  const userId = useAppSelector((state) => state.auth.user?.id)
  const [items, setItems] = useState(initialItems)
  const [zoom, setZoom] = useState(0.85)
  const [pan, setPan] = useState({ x: 60, y: 30 })
  const [tool, setTool] = useState<"select" | "hand">("select")
  const [isPanning, setIsPanning] = useState(false)
  const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(false)
  const [shapeSearch, setShapeSearch] = useState("")
  const panStart = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null)
  const canEditIdeation = hasWorkshopPermission(
    organization,
    userId ?? "current",
    "Edit ideation",
  )

  const setSafeZoom = useCallback((value: number) => {
    setZoom(Math.min(1.6, Math.max(0.35, value)))
  }, [])

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    const isMiddleMouse = event.button === 1
    const isPrimaryPan = event.button === 0 && tool === "hand"
    if (!isMiddleMouse && !isPrimaryPan) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    panStart.current = { pointerX: event.clientX, pointerY: event.clientY, panX: pan.x, panY: pan.y }
    setIsPanning(true)
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panStart.current) return
    setPan({
      x: panStart.current.panX + event.clientX - panStart.current.pointerX,
      y: panStart.current.panY + event.clientY - panStart.current.pointerY,
    })
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault()
    const nextZoom = Math.min(1.6, Math.max(0.35, zoom * Math.exp(-event.deltaY * 0.0015)))
    if (nextZoom === zoom) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - bounds.left
    const pointerY = event.clientY - bounds.top
    const worldX = (pointerX - pan.x) / zoom
    const worldY = (pointerY - pan.y) / zoom

    setPan({
      x: pointerX - worldX * nextZoom,
      y: pointerY - worldY * nextZoom,
    })
    setZoom(nextZoom)
  }

  function endPan() {
    panStart.current = null
    setIsPanning(false)
  }

  function addNote() {
    setItems((current) => [...current, {
      id: createClientId(),
      type: "note",
      title: "New idea",
      body: "Double-click text editing is coming with canvas persistence.",
      x: (240 - pan.x) / zoom,
      y: (180 - pan.y) / zoom,
      width: 220,
      height: 170,
      color: "amber",
    }])
  }

  function addShape(shape: DiagramShapeDefinition) {
    setItems((current) => [...current, {
      id: createClientId(),
      type: "diagram",
      shapeKind: shape.kind,
      title: shape.label,
      x: (520 - pan.x) / zoom + (current.length % 4) * 18,
      y: (280 - pan.y) / zoom + (current.length % 4) * 18,
      width: shape.width,
      height: shape.height,
      color: "violet",
    }])
    setTool("select")
  }

  function resetView() {
    setZoom(0.85)
    setPan({ x: 60, y: 30 })
  }

  if (!project) {
    return <section className="workshop-empty-panel"><Lightbulb /><h3>No project canvas yet</h3><p>Select or create a project to start capturing ideas.</p></section>
  }

  return (
    <div
      className={`workshop-ideation${tool === "hand" ? " hand-tool" : ""}${isPanning ? " panning" : ""}`}
      onAuxClick={(event) => {
        if (event.button === 1) event.preventDefault()
      }}
      onPointerDown={beginPan}
      onPointerCancel={endPan}
      onLostPointerCapture={endPan}
      onPointerMove={movePan}
      onPointerUp={endPan}
      onWheel={handleWheel}
      style={{
        "--canvas-pan-x": `${pan.x}px`,
        "--canvas-pan-y": `${pan.y}px`,
        "--canvas-zoom": zoom,
      } as CSSProperties}
    >
      <div className="workshop-canvas-meta" onPointerDown={(event) => event.stopPropagation()}>
        <span><Lightbulb /></span>
        <div><small>{project.name}</small><strong>Product direction · v1</strong></div>
        <i>Saved locally</i>
      </div>

      <div className="workshop-canvas-toolbar" onPointerDown={(event) => event.stopPropagation()}>
        <Button aria-label="Select tool" className={tool === "select" ? "active" : ""} onClick={() => setTool("select")} size="icon" type="button" variant="ghost"><MousePointer2 /></Button>
        <Button aria-label="Hand tool" className={tool === "hand" ? "active" : ""} onClick={() => setTool("hand")} size="icon" type="button" variant="ghost"><Hand /></Button>
        <span />
        {canEditIdeation && <><Button className="h-8" onClick={addNote} type="button" variant="ghost"><StickyNote /> <b>Add note</b></Button>
        <span />
        <Button className={isShapeMenuOpen ? "active h-8" : "h-8"} onClick={() => setIsShapeMenuOpen((current) => !current)} type="button" variant="ghost"><Shapes /> <b>Shapes</b></Button></>}
      </div>

      {isShapeMenuOpen && (
        <aside aria-label="Diagram shape library" className="workshop-shape-menu" onPointerDown={(event) => event.stopPropagation()}>
          <header><div><Shapes /><span><strong>Shapes</strong><small>Diagram library</small></span></div><Button aria-label="Close shapes" onClick={() => setIsShapeMenuOpen(false)} size="icon-sm" type="button" variant="ghost"><X /></Button></header>
          <label><Search /><Input autoFocus onChange={(event) => setShapeSearch(event.target.value)} placeholder="Search shapes" value={shapeSearch} /></label>
          <div className="workshop-shape-sections">
            {diagramShapeGroups.map((group) => {
              const matchingShapes = group.shapes.filter((shape) => shape.label.toLocaleLowerCase().includes(shapeSearch.trim().toLocaleLowerCase()))
              if (matchingShapes.length === 0) return null
              return (
                <section key={group.label}>
                  <h3>{group.label}</h3>
                  <div>
                    {matchingShapes.map(({ icon: Icon, ...shape }) => (
                      <Button className="h-auto" key={shape.kind} onClick={() => addShape({ ...shape, icon: Icon })} title={`Add ${shape.label}`} type="button" variant="ghost">
                        <span data-preview={shape.kind}><Icon /></span>
                        <small>{shape.label}</small>
                      </Button>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </aside>
      )}

      <div className="workshop-canvas-world" aria-label="Infinite ideation canvas">
        {items.map((item) => (
          <CanvasCard canDrag={canEditIdeation && tool === "select"} item={item} key={item.id} onMove={(x, y) => setItems((current) => current.map((candidate) => candidate.id === item.id ? { ...candidate, x, y } : candidate))} zoom={zoom} />
        ))}
      </div>

      <div className="workshop-zoom-control" onPointerDown={(event) => event.stopPropagation()}>
        <Button aria-label="Zoom out" onClick={() => setSafeZoom(zoom - 0.1)} size="icon-sm" type="button" variant="ghost"><Minus /></Button>
        <Button onClick={resetView} size="sm" type="button" variant="ghost">{Math.round(zoom * 100)}%</Button>
        <Button aria-label="Zoom in" onClick={() => setSafeZoom(zoom + 0.1)} size="icon-sm" type="button" variant="ghost"><Plus /></Button>
        <span />
        <Button aria-label="Fit to screen" onClick={resetView} size="icon-sm" type="button" variant="ghost"><Focus /></Button>
      </div>

      <div className="workshop-canvas-minimap" onPointerDown={(event) => event.stopPropagation()}>
        <div>{items.map((item) => <i key={item.id} style={{ left: `${8 + item.x / 14}px`, top: `${8 + item.y / 14}px`, width: `${Math.max(8, item.width / 14)}px`, height: `${Math.max(6, item.height / 14)}px` }} />)}</div>
        <span><Maximize2 /> Canvas overview</span>
      </div>
    </div>
  )
}

function CanvasCard({
  canDrag,
  item,
  onMove,
  zoom,
}: {
  canDrag: boolean
  item: CanvasItem
  onMove: (x: number, y: number) => void
  zoom: number
}) {
  const dragStart = useRef<{ pointerX: number; pointerY: number; x: number; y: number } | null>(null)

  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0 || !canDrag) return
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStart.current = { pointerX: event.clientX, pointerY: event.clientY, x: item.x, y: item.y }
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!dragStart.current) return
    event.stopPropagation()
    onMove(
      dragStart.current.x + (event.clientX - dragStart.current.pointerX) / zoom,
      dragStart.current.y + (event.clientY - dragStart.current.pointerY) / zoom,
    )
  }

  const style = {
    left: item.x,
    top: item.y,
    width: item.width,
    height: item.height,
  }

  function endDrag() {
    dragStart.current = null
  }

  const dragHandlers = {
    onLostPointerCapture: endDrag,
    onPointerCancel: endDrag,
    onPointerDown: beginDrag,
    onPointerMove: moveDrag,
    onPointerUp: endDrag,
  }

  const shapeDefinition = item.shapeKind
    ? diagramShapeDefinitions.find((shape) => shape.kind === item.shapeKind)
    : undefined
  const isConnector = item.shapeKind === "line" || item.shapeKind === "arrow" || item.shapeKind === "dashed-line"

  if (item.type === "diagram" && isConnector) {
    const markerId = `arrow-${item.id}`
    return (
      <section aria-label={`${item.title} connector`} className="workshop-canvas-line" {...dragHandlers} style={style}>
        <svg aria-hidden="true" height="100%" preserveAspectRatio="none" viewBox={`0 0 ${item.width} ${item.height}`} width="100%">
          {item.shapeKind === "arrow" && <defs><marker id={markerId} markerHeight="7" markerWidth="7" orient="auto" refX="6" refY="3.5"><path d="M0,0 L7,3.5 L0,7 Z" /></marker></defs>}
          <line className="hit-area" x1="5" x2={item.width - 5} y1={item.height - 5} y2="5" />
          <line className={item.shapeKind === "dashed-line" ? "visible dashed" : "visible"} markerEnd={item.shapeKind === "arrow" ? `url(#${markerId})` : undefined} x1="5" x2={item.width - 8} y1={item.height - 5} y2="8" />
          <circle cx="5" cy={item.height - 5} r="4" />
          {item.shapeKind !== "arrow" && <circle cx={item.width - 5} cy="5" r="4" />}
        </svg>
      </section>
    )
  }

  if (item.type === "diagram" && item.shapeKind) {
    const ShapeIcon = shapeDefinition?.icon
    return (
      <section aria-label={`${item.title} shape`} className="workshop-diagram-node" data-shape={item.shapeKind} {...dragHandlers} style={style}>
        <span className="workshop-node-content">
          {ShapeIcon && <ShapeIcon />}
          <b>{item.title}</b>
        </span>
      </section>
    )
  }

  if (item.type === "frame") {
    return (
      <section className="workshop-canvas-frame" data-color={item.color} {...dragHandlers} style={style}>
        <header><span /> {item.title}</header>
        <div className="workshop-wireframe">
          <aside><i /><i /><i /><i /></aside>
          <main><span /><div><i /><i /></div><b /></main>
        </div>
      </section>
    )
  }

  return (
    <article className="workshop-canvas-note" data-color={item.color} {...dragHandlers} style={style}>
      <span className="workshop-note-pin" />
      <small>Idea</small>
      <h3>{item.title}</h3>
      <p>{item.body}</p>
      <footer><b>YO</b><span>Just now</span></footer>
    </article>
  )
}
