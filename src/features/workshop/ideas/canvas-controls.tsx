import { Focus, Hand, Keyboard, Minus, MousePointer2, Plus, Shapes, Square, StickyNote, X } from "lucide-react"

import { Button } from "@/components/ui/button"

type CanvasToolbarProps = {
  canEdit: boolean
  tool: "select" | "hand"
  shapeMenuOpen: boolean
  snapping: boolean
  onSelectTool: () => void
  onHandTool: () => void
  onToggleShapes: () => void
  onToggleSnapping: () => void
  onShowShortcuts: () => void
}

export function CanvasToolbar({ canEdit, tool, shapeMenuOpen, snapping, onSelectTool, onHandTool, onToggleShapes, onToggleSnapping, onShowShortcuts }: CanvasToolbarProps) {
  return <div className="workshop-canvas-toolbar" onPointerDown={(event) => event.stopPropagation()}>
    <Button aria-label="Select tool" title="Select: drag on the canvas to select multiple shapes; Shift/Ctrl-click to toggle selection" className={tool === "select" ? "active" : ""} onClick={onSelectTool} size="icon" type="button" variant="ghost"><MousePointer2 /></Button>
    <Button aria-label="Hand tool" className={tool === "hand" ? "active" : ""} onClick={onHandTool} size="icon" type="button" variant="ghost"><Hand /></Button>
    <span />
    {canEdit && <Button aria-expanded={shapeMenuOpen} className={shapeMenuOpen ? "active h-8" : "h-8"} onClick={onToggleShapes} type="button" variant="ghost"><Shapes /> <b>Shapes</b></Button>}
    {canEdit && <Button aria-pressed={snapping} title="Snap to shape edges and centers. Hold Alt to bypass while dragging." onClick={onToggleSnapping} size="sm" type="button" variant={snapping ? "secondary" : "ghost"}>Snap {snapping ? "on" : "off"}</Button>}
    <Button aria-label="Show keyboard shortcuts" title="Keyboard shortcuts" onClick={onShowShortcuts} size="icon-sm" type="button" variant="ghost"><Keyboard /></Button>
  </div>
}

export function ShapeSelector({ onAddRectangle, onAddNote, onClose }: { onAddRectangle: () => void; onAddNote: () => void; onClose: () => void }) {
  return <aside aria-label="Shape selector" className="workshop-shape-menu" onPointerDown={(event) => event.stopPropagation()}>
    <header><div><Shapes /><span><strong>Shapes</strong></span></div><Button aria-label="Close shapes" onClick={onClose} size="icon-sm" type="button" variant="ghost"><X /></Button></header>
    <div className="workshop-shape-sections"><section><div>
      <Button aria-label="Add rectangle" className="h-auto" onClick={onAddRectangle} type="button" variant="ghost"><span data-preview="process"><Square /></span><small>Rectangle</small></Button>
      <Button aria-label="Add note" className="h-auto" onClick={onAddNote} type="button" variant="ghost"><span data-preview="process"><StickyNote /></span><small>Note</small></Button>
    </div></section></div>
  </aside>
}

export function ZoomControls({ zoom, onZoom, onFit }: { zoom: number; onZoom: (zoom: number) => void; onFit: () => void }) {
  return <div className="workshop-zoom-control" onPointerDown={(event) => event.stopPropagation()}>
    <Button aria-label="Zoom out" onClick={() => onZoom(zoom / 1.2)} size="icon-sm" type="button" variant="ghost"><Minus /></Button>
    <Button aria-label="Reset zoom to 100%" title="Reset to 100%" onClick={() => onZoom(1)} size="sm" type="button" variant="ghost">{Number((zoom * 100).toPrecision(3))}%</Button>
    <Button aria-label="Zoom in" onClick={() => onZoom(zoom * 1.2)} size="icon-sm" type="button" variant="ghost"><Plus /></Button>
    <span />
    <Button aria-label="Center and fit all shapes" title="Center and fit all shapes" onClick={onFit} size="icon-sm" type="button" variant="ghost"><Focus /></Button>
  </div>
}
