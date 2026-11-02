import {useId, useRef, useState} from "react"
import {ArrowDownLeft, ChevronDown, MousePointer2, Plus, Search, Shapes, Type, X} from "lucide-react"
import {type ShapePreset, shapePresets} from "../shape-catalog"
import {prioritizedUmlPresets, umlTypes, type UmlType} from "../uml-catalog"
import {normalizeCanvasItem} from "../shape-clipboard"
import {ShapeGeometry} from "./shape-geometry"
import "./shape-selector.css"

function PresetPreview({preset}: {preset: ShapePreset}) {
    // Fit the original geometry into the thumbnail instead of reshaping it to fit.
    const square = ["ellipse", "triangle", "pentagon", "hexagon", "star", "diamond"].includes(preset.kind)
    const width = preset.changes?.width ?? (square ? 160 : 200)
    const height = preset.changes?.height ?? (square ? 160 : 120)
    const scale = Math.min(60 / width, 44 / height)
    return <span className="shape-library-artboard" aria-hidden="true">
        <span className="shape-library-art" style={{width: width * scale, height: height * scale}}>
            {preset.kind === "text" ? <Type/> : preset.id === "waterfall" ? <svg viewBox="0 0 64 44" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h24v10H4z M20 17h24v10H20z M36 30h24v10H36z"/>
            </svg> : preset.id === "erd" ? <svg viewBox="0 0 64 44" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6h20v32H2z M42 6h20v32H42z M2 15h20 M42 15h20 M22 22h20"/>
            </svg> : preset.changes?.umlSymbol === "constraint" ? <span className="shape-library-constraint">{ "{…}" }</span> :
                <ShapeGeometry item={normalizeCanvasItem({
                    kind: preset.kind,
                    umlSymbol: preset.changes?.umlSymbol,
                    width, height,
                    outlineWidth: 1.5 / scale,
                    outlineColor: "currentColor",
                    outlineStyle: preset.changes?.outlineStyle ?? "solid",
                    appearance: "outlined",
                    cornerRadius: preset.changes?.cornerRadius ?? 0
                })}/>}
        </span>
    </span>
}

export function ShapeSelector({onAdd, onClose, umlType}: {
    onAdd: (preset: ShapePreset) => void;
    onClose: () => void;
    umlType?: UmlType | null
}) {
    const isUml = umlType !== undefined
    const preferred = umlTypes.find(type => type.id === umlType)?.label
    const [query, setQuery] = useState("")
    const [category, setCategory] = useState(preferred ?? "all")
    const [notice, setNotice] = useState("")
    const search = useRef<HTMLInputElement>(null)
    const content = useRef<HTMLDivElement>(null)
    const headingId = useId(), resultsId = useId()
    const presets = isUml ? prioritizedUmlPresets(umlType) : shapePresets
    const categories = [...new Set(presets.map(preset => preset.category))]
    const term = query.trim().toLowerCase()
    // Searching the whole library keeps symbols discoverable across diagram types.
    const matches = presets.filter(preset => (term || category === "all" || preset.category === category)
        && `${preset.label} ${preset.category}`.toLowerCase().includes(term))
    const sections = [...new Set(matches.map(preset => preset.category))]

    return <aside aria-label="Shape selector" className="workshop-shape-menu workshop-shape-library"
        onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}
        onKeyDown={event => {
            event.stopPropagation()
            if (event.key === "Escape") {
                if (query) {setQuery(""); search.current?.focus()}
                else onClose()
            }
        }}>
        <header className="shape-library-header">
            <div><span className="shape-library-icon"><Shapes aria-hidden="true"/></span>
                <span><strong id={headingId}>Shape library</strong><small>{isUml ? "UML shapes & notation" : "Shapes, diagrams & text"}</small></span>
            </div>
            <button className="shape-library-close" type="button" aria-label="Close shapes" title="Close · Esc" onClick={onClose}><X/></button>
        </header>
        <div className="shape-library-tools">
            <div className="shape-library-search">
                <Search aria-hidden="true"/>
                <input ref={search} aria-label="Search shapes" aria-controls={resultsId} placeholder="Find a shape…" value={query}
                    onChange={event => {setQuery(event.target.value); content.current?.scrollTo(0, 0)}}/>
                {query && <button type="button" aria-label="Clear search" onClick={() => {setQuery(""); search.current?.focus()}}><X/></button>}
            </div>
            <div className="shape-library-browse">
                <label className="shape-library-category"><span className="sr-only">Shape category</span>
                    <select aria-label="Shape category" aria-controls={resultsId} value={term ? "all" : category}
                        onChange={event => {setCategory(event.target.value); setQuery(""); content.current?.scrollTo(0, 0)}}>
                        <option value="all">All categories</option>
                        {categories.map(name => <option key={name} value={name}>{name}</option>)}
                    </select><ChevronDown aria-hidden="true"/>
                </label>
                <span className="shape-library-count" role="status">{matches.length} {matches.length === 1 ? "shape" : "shapes"}</span>
            </div>
        </div>
        <div ref={content} id={resultsId} className="shape-library-content" aria-labelledby={headingId}>
            {sections.map(name => <section className="shape-library-section" key={name}>
                <div className="shape-library-section-heading"><h3>{name}</h3><span>{matches.filter(preset => preset.category === name).length}</span></div>
                <div className="shape-library-grid">{matches.filter(preset => preset.category === name).map(preset =>
                    <button className="shape-library-card" type="button" key={preset.id} aria-label={"Add " + preset.label.toLowerCase()}
                        title={`${preset.label} · Click to add${isUml ? " or drag to canvas" : ""}`} draggable={isUml}
                        onDragStart={event => {event.dataTransfer.setData("application/x-zevont-uml-preset", preset.id); event.dataTransfer.effectAllowed = "copy"}}
                        onClick={() => {onAdd(preset); setNotice(preset.kind === "arrow" && isUml ? `${preset.label} connector selected` : `${preset.label} added to canvas`)}}>
                        <PresetPreview preset={preset}/><span className="shape-library-name">{preset.label}</span>
                        <Plus className="shape-library-add" aria-hidden="true"/>
                    </button>)}</div>
            </section>)}
            {matches.length === 0 && <div className="shape-library-empty"><Search aria-hidden="true"/><strong>No shapes found</strong>
                <p>Try a shape name or diagram type.</p><button type="button" onClick={() => {setQuery(""); setCategory("all"); search.current?.focus()}}>Browse all shapes <ArrowDownLeft aria-hidden="true"/></button>
            </div>}
        </div>
        <footer className="shape-library-footer"><MousePointer2 aria-hidden="true"/><span aria-live="polite">{notice || (isUml ? "Click to add · Drag to place" : "Click a shape to add to canvas")}</span><kbd>esc</kbd></footer>
    </aside>
}
