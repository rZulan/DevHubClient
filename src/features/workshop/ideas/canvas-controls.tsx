import {useState} from "react"
import {type ShapePreset, shapePresets} from "../shape-catalog"
import {normalizeCanvasItem} from "../shape-clipboard"
import {ShapeGeometry} from "./shape-geometry"
import {Focus, Hand, Keyboard, Minus, MousePointer2, Plus, Search, Shapes, Type, X} from "lucide-react"

import {Button} from "@/components/ui/button"

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

export function CanvasToolbar({
                                  canEdit,
                                  tool,
                                  shapeMenuOpen,
                                  snapping,
                                  onSelectTool,
                                  onHandTool,
                                  onToggleShapes,
                                  onToggleSnapping,
                                  onShowShortcuts
                              }: CanvasToolbarProps) {
    return <div className="workshop-canvas-toolbar" onPointerDown={(event) => event.stopPropagation()}>
        <Button aria-label="Select tool"
                title="Select: drag on the canvas to select multiple shapes; Shift/Ctrl-click to toggle selection"
                className={tool === "select" ? "active" : ""} onClick={onSelectTool} size="icon" type="button"
                variant="ghost"><MousePointer2/></Button>
        <Button aria-label="Hand tool" className={tool === "hand" ? "active" : ""} onClick={onHandTool} size="icon"
                type="button" variant="ghost"><Hand/></Button>
        <span/>
        {canEdit && <Button aria-expanded={shapeMenuOpen} className={shapeMenuOpen ? "active h-8" : "h-8"}
                            onClick={onToggleShapes} type="button" variant="ghost"><Shapes/> <b>Shapes</b></Button>}
        {canEdit &&
            <Button aria-pressed={snapping} title="Snap to shape edges and centers. Hold Alt to bypass while dragging."
                    onClick={onToggleSnapping} size="sm" type="button"
                    variant={snapping ? "secondary" : "ghost"}>Snap {snapping ? "on" : "off"}</Button>}
        <Button aria-label="Show keyboard shortcuts" title="Keyboard shortcuts" onClick={onShowShortcuts} size="icon-sm"
                type="button" variant="ghost"><Keyboard/></Button>
    </div>
}

export function ShapeSelector({onAdd, onClose}: { onAdd: (preset: ShapePreset) => void; onClose: () => void }) {
    const [query, setQuery] = useState("")
    const matches = shapePresets.filter(preset => (preset.label + " " + preset.category).toLowerCase().includes(query.trim().toLowerCase()))
    const categories = [...new Set(matches.map(preset => preset.category))]
    return <aside aria-label="Shape selector" className="workshop-shape-menu"
                  onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}
                  onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Escape") onClose()
                  }}>
        <header>
            <div><Shapes/><span><strong>Shapes & text</strong></span></div>
            <Button aria-label="Close shapes" onClick={onClose} size="icon-sm" type="button"
                    variant="ghost"><X/></Button></header>
        <label><Search/><input aria-label="Search shapes" placeholder="Search shapes, diagrams, text…" value={query}
                               onChange={event => setQuery(event.target.value)}/></label>
        <div className="workshop-shape-sections">{categories.map(category => <section key={category}><h3>{category}</h3>
            <div>
                {matches.filter(preset => preset.category === category).map(preset => <Button key={preset.id}
                                                                                              aria-label={"Add " + preset.label.toLowerCase()}
                                                                                              title={preset.label}
                                                                                              className="h-auto"
                                                                                              onClick={() => onAdd(preset)}
                                                                                              type="button"
                                                                                              variant="ghost">
                    <span className="workshop-preset-preview">{preset.kind === "text" ?
                        <Type/> : preset.id === "waterfall" ? <svg viewBox="0 0 64 44" aria-hidden="true">
                            <path d="M4 4h24v10H4z M20 17h24v10H20z M36 30h24v10H36z" fill="none" stroke="currentColor"
                                  strokeWidth="2"/>
                        </svg> : preset.id === "erd" ? <svg viewBox="0 0 64 44" aria-hidden="true">
                            <path d="M2 6h20v32H2z M42 6h20v32H42z M2 15h20 M42 15h20 M22 22h20" fill="none"
                                  stroke="currentColor" strokeWidth="2"/>
                        </svg> : <ShapeGeometry item={normalizeCanvasItem({
                            kind: preset.kind,
                            width: 64,
                            height: 44,
                            outlineWidth: 2,
                            outlineColor: "currentColor",
                            outlineStyle: preset.changes?.outlineStyle ?? "solid",
                            appearance: "outlined",
                            cornerRadius: preset.changes?.cornerRadius ?? 0
                        })}/>}</span><small>{preset.label}</small>
                </Button>)}
            </div>
        </section>)}{matches.length === 0 &&
            <p className="workshop-shapes-empty">No shapes found. Try another search.</p>}</div>
    </aside>
}

export function ZoomControls({zoom, onZoom, onFit}: {
    zoom: number;
    onZoom: (zoom: number) => void;
    onFit: () => void
}) {
    return <div className="workshop-zoom-control" onPointerDown={(event) => event.stopPropagation()}>
        <Button aria-label="Zoom out" onClick={() => onZoom(zoom / 1.2)} size="icon-sm" type="button"
                variant="ghost"><Minus/></Button>
        <Button aria-label="Reset zoom to 100%" title="Reset to 100%" onClick={() => onZoom(1)} size="sm" type="button"
                variant="ghost">{Number((zoom * 100).toPrecision(3))}%</Button>
        <Button aria-label="Zoom in" onClick={() => onZoom(zoom * 1.2)} size="icon-sm" type="button"
                variant="ghost"><Plus/></Button>
        <span/>
        <Button aria-label="Center and fit all shapes" title="Center and fit all shapes" onClick={onFit} size="icon-sm"
                type="button" variant="ghost"><Focus/></Button>
    </div>
}
