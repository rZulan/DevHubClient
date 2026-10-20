import {useState, type CSSProperties} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowDown, ArrowUp, Circle, Copy, Download, Eye, EyeOff, Frame, Lock, PencilRuler, Plus, RectangleHorizontal, Square, Trash2, Type, Unlock} from "lucide-react"
import {ErdPanel} from "@/features/workshop/erd-panel"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolCanvas, type NodePosition} from "@/features/workshop/tool-canvas"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {designSvg, downloadFile, type DesignKind, type DesignLayer} from "@/features/workshop/tool-documents"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {createClientId} from "@/lib/create-client-id"

const kinds = {frame: Frame, rectangle: Square, ellipse: Circle, text: Type, button: RectangleHorizontal}
export function WorkshopUiEditorPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><PencilRuler/><h3>No project selected</h3><p>Select or create a project to design its interface.</p></section>
    return <UiEditor key={`${userId}:${organization.id}:${project.id}`}/>
}
function UiEditor() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    const canWrite = hasWorkshopPermission(organization, userId, "Edit ideation")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "ui-editor"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit} = editor
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [preview, setPreview] = useState(false)
    const [layersCollapsed, setLayersCollapsed] = useState(false), [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
    const selected = document.layers.find(layer => layer.id === selectedIds[0])
    const selectionLocked = selected?.locked || document.layers.some(layer => layer.id === selected?.parentId && layer.locked)
    function patch(id: string, changes: Partial<DesignLayer>) {setDocument(current => ({layers: current.layers.map(layer => layer.id === id ? {...layer, ...changes} : layer)}))}
    function move(positions: NodePosition[]) {
        setDocument(current => {
            const byId = new Map(positions.map(position => [position.id, position]))
            const originals = new Map(current.layers.map(layer => [layer.id, layer]))
            return {layers: current.layers.map(layer => {
                const position = byId.get(layer.id)
                if (position) return {...layer, x: position.x, y: position.y}
                const parentPosition = layer.parentId && byId.get(layer.parentId)
                const parent = layer.parentId && originals.get(layer.parentId)
                return parentPosition && parent ? {...layer, x: layer.x + parentPosition.x - parent.x, y: layer.y + parentPosition.y - parent.y} : layer
            })}
        })
    }
    function add(kind: DesignKind, frameSize?: "mobile" | "desktop") {
        const parent = kind !== "frame" ? selected?.kind === "frame" ? selected : document.layers.find(layer => layer.id === selected?.parentId) : undefined
        const offset = document.layers.length % 8 * 24
        const layer: DesignLayer = {id: createClientId(), name: kind === "frame" ? frameSize === "desktop" ? "Desktop frame" : "Mobile frame" : `${kind[0].toUpperCase()}${kind.slice(1)}`,
            kind, ...(parent ? {parentId: parent.id} : {}), x: parent ? parent.x + 24 : 80 + offset, y: parent ? parent.y + 72 : 60 + offset,
            width: kind === "frame" ? frameSize === "desktop" ? 1280 : 390 : kind === "text" ? 240 : 180,
            height: kind === "frame" ? frameSize === "desktop" ? 800 : 844 : kind === "text" || kind === "button" ? 48 : 120,
            fill: kind === "frame" ? "#ffffff" : "#8b5cf6", stroke: "#cbd5e1", strokeWidth: kind === "frame" ? 1 : 0, radius: kind === "button" ? 12 : kind === "rectangle" ? 8 : 0,
            opacity: 1, text: kind === "text" ? "Your text here" : kind === "button" ? "Get started" : "", fontSize: kind === "text" ? 24 : 16, textColor: kind === "button" ? "#ffffff" : "#172033", hidden: false, locked: false}
        setDocument(current => ({layers: kind === "frame" ? [layer, ...current.layers] : [...current.layers, layer]})); setSelectedIds([layer.id])
    }
    function remove() {
        const ids = new Set(selectedIds.filter(id => {
            const layer = document.layers.find(item => item.id === id)
            return layer && !layer.locked && !document.layers.some(parent => parent.id === layer.parentId && parent.locked)
        }))
        setDocument(current => ({layers: current.layers.filter(layer => !ids.has(layer.id) && !ids.has(layer.parentId ?? ""))})); setSelectedIds([])
    }
    function duplicate() {
        const ids = new Set(selectedIds)
        const originals = document.layers.filter(layer => ids.has(layer.id) || ids.has(layer.parentId ?? ""))
        const newIds = new Map(originals.map(layer => [layer.id, createClientId()]))
        const copies = originals.map(layer => ({...layer, id: newIds.get(layer.id)!, name: `${layer.name.slice(0, 140)} copy`, x: layer.x + 32, y: layer.y + 32, locked: false,
            ...(layer.parentId ? {parentId: newIds.get(layer.parentId) ?? layer.parentId} : {})}))
        setDocument(current => ({layers: [...current.layers, ...copies]})); setSelectedIds(copies.filter(layer => ids.has(originals.find(original => newIds.get(original.id) === layer.id)!.id)).map(layer => layer.id))
    }
    function reorder(direction: -1 | 1) {
        if (!selected) return
        setDocument(current => {
            const layers = [...current.layers], index = layers.findIndex(layer => layer.id === selected.id), next = index + direction
            if (next < 0 || next >= layers.length) return current
            ;[layers[index], layers[next]] = [layers[next], layers[index]]
            return {layers}
        })
    }
    const visible = document.layers.filter(layer => !layer.hidden && !document.layers.some(parent => parent.id === layer.parentId && parent.hidden))
    function geometry(changes: Partial<DesignLayer>) {
        if (!selected) return
        if (changes.x !== undefined || changes.y !== undefined) move([{...selected, ...changes}])
        else patch(selected.id, changes)
    }
    return <section className="project-tool-workspace">
        <ToolDocumentHeader title="Interface design" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="ui-editor" document={document}>
            <Button size="sm" variant={preview ? "secondary" : "ghost"} aria-pressed={preview} onClick={() => {setPreview(value => !value); setSelectedIds([])}}><Eye/>{preview ? "Exit preview" : "Preview"}</Button>
            <Button size="sm" variant="ghost" disabled={!document.layers.length} onClick={() => downloadFile(designSvg(document), "design.svg", "image/svg+xml")}><Download/> SVG</Button>
        </ToolDocumentHeader>
        <div className={`tool-editor-body ${preview ? "design-preview" : ""}`}>
            {!preview && <ErdPanel side="left" title="Layers" detail={`${document.layers.length} layers`} collapsed={layersCollapsed} onToggle={() => setLayersCollapsed(value => !value)}>
                <div className="tool-frame-presets"><Button size="sm" variant="secondary" disabled={!canEdit} onClick={() => add("frame", "mobile")}><Plus/> Mobile</Button><Button size="sm" variant="ghost" disabled={!canEdit} onClick={() => add("frame", "desktop")}>Desktop</Button></div>
                <div className="tool-layer-list">{[...document.layers].reverse().map(layer => {
                    const Icon = kinds[layer.kind]
                    return <div className={`design-layer-entry ${selectedIds.includes(layer.id) ? "active" : ""} ${layer.parentId ? "nested" : ""}`} key={layer.id}>
                        <button type="button" title={layer.name} onClick={() => setSelectedIds([layer.id])}><Icon/><span>{layer.name}</span></button>
                        <button type="button" aria-label={`${layer.hidden ? "Show" : "Hide"} ${layer.name}`} disabled={!canEdit} onClick={() => patch(layer.id, {hidden: !layer.hidden})}>{layer.hidden ? <EyeOff/> : <Eye/>}</button>
                        <button type="button" aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`} disabled={!canEdit} onClick={() => patch(layer.id, {locked: !layer.locked})}>{layer.locked ? <Lock/> : <Unlock/>}</button>
                    </div>
                })}</div>
                <footer>Select a frame before adding elements to place them inside it. Drag the corner to resize.</footer>
            </ErdPanel>}
            <ToolCanvas nodes={visible.map(layer => ({...layer, locked: layer.locked || preview || document.layers.some(parent => parent.id === layer.parentId && parent.locked)}))} selectedIds={preview ? [] : selectedIds} onSelect={preview ? () => {} : setSelectedIds} {...editor} canEdit={canEdit && !preview} onMove={move}
                onResize={(id, width, height) => patch(id, {width, height})} onDelete={remove} onDuplicate={duplicate}
                renderNode={node => {
                    const layer = document.layers.find(item => item.id === node.id)!
                    const parent = document.layers.find(item => item.id === layer.parentId)
                    const style: CSSProperties = {background: layer.kind === "text" ? "transparent" : layer.fill, border: `${layer.strokeWidth}px solid ${layer.stroke}`, borderRadius: layer.kind === "ellipse" ? "50%" : layer.radius,
                        opacity: layer.opacity, color: layer.textColor, fontSize: layer.fontSize,
                        clipPath: parent ? `inset(${Math.max(0, parent.y - layer.y)}px ${Math.max(0, layer.x + layer.width - parent.x - parent.width)}px ${Math.max(0, layer.y + layer.height - parent.y - parent.height)}px ${Math.max(0, parent.x - layer.x)}px)` : undefined}
                    return <><div className={`design-shape design-${layer.kind}`} style={style}>{layer.text}</div>{layer.kind === "frame" && !preview && <span className="design-frame-label">{layer.name} · {Math.round(layer.width)} × {Math.round(layer.height)}</span>}</>
                }}>
                {!preview && (Object.entries(kinds) as [DesignKind, typeof Frame][]).map(([kind, Icon]) => <Button size="icon-sm" variant="ghost" key={kind} disabled={!canEdit || document.layers.length >= 5000} aria-label={`Add ${kind}`} title={`Add ${kind}`} onClick={() => add(kind)}><Icon/></Button>)}
            </ToolCanvas>
            {!preview && selected && <ErdPanel side="right" title="Design properties" detail={selected.kind} collapsed={propertiesCollapsed} onToggle={() => setPropertiesCollapsed(value => !value)}>
                {selected ? <><fieldset disabled={!canEdit || selectionLocked}>
                    <label>Layer name<input maxLength={150} value={selected.name} onChange={event => patch(selected.id, {name: event.target.value || "Layer"})}/></label>
                    <div className="tool-property-grid">{(["x", "y", "width", "height"] as const).map(key => <label key={key}>{key === "width" ? "Width" : key === "height" ? "Height" : key.toUpperCase()}<input type="number" min={key === "width" || key === "height" ? 16 : -1000000} max={key === "width" || key === "height" ? 10000 : 1000000} value={Math.round(selected[key])} onChange={event => geometry({[key]: Math.max(key === "width" || key === "height" ? 16 : -1000000, Math.min(key === "width" || key === "height" ? 10000 : 1000000, Number(event.target.value)))})}/></label>)}</div>
                    {selected.kind !== "frame" && <label>Parent frame<select value={selected.parentId ?? ""} onChange={event => {
                        if (event.target.value) patch(selected.id, {parentId: event.target.value})
                        else setDocument(current => ({layers: current.layers.map(layer => {if (layer.id !== selected.id) return layer; const {parentId: _parent, ...rest} = layer; return rest})}))
                    }}><option value="">None</option>{document.layers.filter(layer => layer.kind === "frame").map(layer => <option value={layer.id} key={layer.id}>{layer.name}</option>)}</select></label>}
                    <div className="tool-section-heading"><strong>Appearance</strong></div>
                    <div className="tool-property-grid"><label>Fill<input type="color" value={selected.fill} onChange={event => patch(selected.id, {fill: event.target.value})}/></label><label>Border<input type="color" value={selected.stroke} onChange={event => patch(selected.id, {stroke: event.target.value})}/></label>
                        <label>Border width<input type="number" min="0" max="20" value={selected.strokeWidth} onChange={event => patch(selected.id, {strokeWidth: Math.min(20, Math.max(0, Number(event.target.value)))})}/></label><label>Corner radius<input type="number" min="0" max="5000" value={selected.radius} onChange={event => patch(selected.id, {radius: Math.min(5000, Math.max(0, Number(event.target.value)))})}/></label></div>
                    <label>Opacity · {Math.round(selected.opacity * 100)}%<input type="range" min="0" max="1" step="0.01" value={selected.opacity} onChange={event => patch(selected.id, {opacity: Number(event.target.value)})}/></label>
                    {selected.kind !== "frame" && selected.kind !== "ellipse" && <><div className="tool-section-heading"><strong>Typography</strong><Type/></div><label>Text<textarea maxLength={100000} rows={3} value={selected.text} onChange={event => patch(selected.id, {text: event.target.value})}/></label><div className="tool-property-grid"><label>Size<input type="number" min="1" max="500" value={selected.fontSize} onChange={event => patch(selected.id, {fontSize: Math.min(500, Math.max(1, Number(event.target.value)))})}/></label><label>Text color<input type="color" value={selected.textColor} onChange={event => patch(selected.id, {textColor: event.target.value})}/></label></div></>}
                    <div className="tool-section-heading"><strong>Arrange</strong></div><div className="tool-inspector-actions"><Button size="sm" variant="ghost" onClick={() => reorder(1)}><ArrowUp/> Forward</Button><Button size="sm" variant="ghost" onClick={() => reorder(-1)}><ArrowDown/> Backward</Button></div>
                    <div className="tool-inspector-actions"><Button size="sm" variant="ghost" onClick={duplicate}><Copy/> Duplicate</Button><Button size="sm" variant="ghost" className="tool-delete" onClick={remove}><Trash2/> Delete</Button></div>
                </fieldset>{selectionLocked && <p className="tool-help">This layer or its frame is locked. Unlock it in the Layers panel to edit.</p>}</> : <div className="tool-inspector-empty"><PencilRuler/><p>Build your interface with frames, shapes, text and buttons.</p><small>V select · H hand · Ctrl+Z undo · Ctrl+D duplicate · Delete remove</small></div>}
            </ErdPanel>}
        </div>
    </section>
}
