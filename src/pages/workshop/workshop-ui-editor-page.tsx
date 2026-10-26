import {useRef, useState} from "react"
import {useOutletContext} from "react-router-dom"
import {ArrowRight, Check, ChevronRight, FileImage, FileUp, ImageDown, PencilRuler, Play, Plus, Redo2, Sparkles, Undo2} from "lucide-react"
import {useAppSelector} from "@/app/hooks"
import {Button} from "@/components/ui/button"
import {DropdownMenuItem} from "@/components/ui/dropdown-menu"
import {hasWorkshopPermission} from "@/features/workshop/workshop-access"
import {ToolDocumentHeader} from "@/features/workshop/tool-document-header"
import {useToolDocument} from "@/features/workshop/use-tool-document"
import {downloadFile} from "@/features/workshop/tool-documents"
import {DesignCanvas} from "@/features/workshop/design-canvas"
import {designTools, type DesignTool} from "@/features/workshop/design-tools"
import {DesignLayersPanel, DesignInspector} from "@/features/workshop/design-panels"
import {DesignPlayer} from "@/features/workshop/design-player"
import {designPng, designSvg} from "@/features/workshop/design-export"
import {copyDesignLayers, designComponent, designStarter, layerUnavailable, layoutDesignFrames, moveDesignLayers, newDesignLayer, pasteDesignLayers, removeDesignLayers, reorderDesignLayer, validDesignDocument, type ComponentPreset, type DesignDocument, type DesignKind, type DesignLayer} from "@/features/workshop/design-document"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/features/workshop/design-editor.css"

export function WorkshopUiEditorPage() {
    const {organization, project} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current"
    if (!project) return <section className="workshop-empty-panel"><PencilRuler/><h3>No project selected</h3><p>Select or create a project to design its interface.</p></section>
    return <UiEditor key={`${userId}:${organization.id}:${project.id}`}/>
}
function UiEditor() {
    const {organization, project, isPersistedOrganization} = useOutletContext<WorkshopOutletContext>()
    const userId = useAppSelector(state => state.auth.user?.id) ?? "current", canWrite = hasWorkshopPermission(organization, userId, "Edit UI designs")
    const editor = useToolDocument({organizationId: organization.id, projectId: project!.id, tool: "ui-editor"}, userId, canWrite, isPersistedOrganization)
    const {document, setDocument, canEdit} = editor
    const workspace = useRef<HTMLElement>(null), fileInput = useRef<HTMLInputElement>(null), imageInput = useRef<HTMLInputElement>(null), imageTarget = useRef<string | undefined>(undefined), pasteCount = useRef({text: "", count: 0})
    const latest = useRef({document, canEdit}); latest.current = {document, canEdit}
    const [selectedIds, setSelectedIds] = useState<string[]>([]), [tool, setTool] = useState<DesignTool>("select"), [mode, setMode] = useState<"design" | "prototype">("design")
    const [present, setPresent] = useState(false), [fitKey, setFitKey] = useState(0), [error, setError] = useState(""), [exporting, setExporting] = useState(false)
    const selected = document.layers.filter(l => selectedIds.includes(l.id)), primary = selected.length === 1 ? selected[0] : undefined
    const selectedFrame = primary?.kind === "frame" ? primary : document.layers.find(l => l.id === primary?.parentId)
    const screens = document.layers.filter(l => l.kind === "frame" && !l.hidden), ready = editor.status !== "loading", canAdd = canEdit && document.layers.length < 5000
    function focusCanvas() {workspace.current?.querySelector<HTMLElement>(".ui-design-canvas")?.focus({preventScroll: true})}
    function apply(next: DesignDocument) {
        if (!latest.current.canEdit) return false
        const arranged = layoutDesignFrames(next), serialized = JSON.stringify(arranged)
        if (serialized.length > 4000000) {setError("This design is full. Export a draft and move some screens or images to another project."); return false}
        if (serialized !== JSON.stringify(latest.current.document)) setDocument(arranged)
        setError(""); return true
    }
    function patch(id: string, changes: Partial<DesignLayer>) {
        if (!canEdit) return
        const target = document.layers.find(l => l.id === id), parent = document.layers.find(l => l.id === target?.parentId)
        if (!target || parent?.locked || target.locked && Object.keys(changes).some(k => !["locked", "hidden"].includes(k))) return
        if (changes.parentId && !document.layers.some(l => l.id === changes.parentId && l.kind === "frame" && !l.locked)) return
        apply({...document, layers: document.layers.map(l => l.id === id ? {...l, ...changes} : l)})
    }
    function select(id: string, additive = false) {setSelectedIds(current => additive ? current.includes(id) ? current.filter(i => i !== id) : [...current, id] : [id]); setTool("select"); focusCanvas()}
    function addLayers(layers: DesignLayer[], fit = false) {
        if (!canEdit) return
        if (document.layers.length + layers.length > 5000) {setError("This design can contain up to 5,000 layers."); return}
        if (!apply({...document, layers: [...document.layers, ...layers]})) return
        setSelectedIds(layers.filter(l => !layers.some(p => p.id === l.parentId)).map(l => l.id)); setTool("select"); if (fit) setFitKey(v => v + 1); focusCanvas()
    }
    function frameX() {return document.layers.length ? Math.max(...document.layers.map(l => l.x + l.width)) + 100 : 80}
    function addFrame(width: number, height: number, name: string) {addLayers([newDesignLayer("frame", {name, width, height, x: frameX(), y: 80})], true)}
    function starter(kind: "onboarding" | "dashboard") {addLayers(designStarter(kind, frameX()), true)}
    function component(kind: ComponentPreset) {
        const frame = selectedFrame && !selectedFrame.locked ? selectedFrame : screens.find(l => !l.locked)
        const offset = document.layers.filter(l => l.parentId === frame?.id).length % 7 * 16
        addLayers(designComponent(kind, frame ? frame.x + 24 : 80 + offset, frame ? frame.y + 72 + offset : 80 + offset, frame?.id))
    }
    function create(kind: DesignKind, rect: {x: number; y: number; width: number; height: number}) {
        const frame = kind === "frame" ? undefined : [...screens].reverse().find(f => !f.locked && rect.x + rect.width / 2 >= f.x && rect.x + rect.width / 2 <= f.x + f.width && rect.y + rect.height / 2 >= f.y && rect.y + rect.height / 2 <= f.y + f.height)
        addLayers([newDesignLayer(kind, {...rect, x: Math.max(-1e6, Math.min(1e6, rect.x)), y: Math.max(-1e6, Math.min(1e6, rect.y)), width: Math.min(10000, rect.width), height: Math.min(10000, rect.height), ...(frame ? {parentId: frame.id} : {}), name: kind === "frame" ? `Screen ${screens.length + 1}` : kind[0].toUpperCase() + kind.slice(1)})])
    }
    function remove() {if (canEdit) {apply(removeDesignLayers(document, selectedIds)); setSelectedIds([])}}
    function paste(text: string, offset = 32, preserveNames = false) {if (!latest.current.canEdit) return false; const result = pasteDesignLayers(latest.current.document, text, offset, {preserveNames}); if (!result || !apply(result.document)) return false; setSelectedIds(result.ids); setTool("select"); return true}
    function duplicate() {paste(copyDesignLayers(document, selectedIds))}
    function reparent(id: string, parentId?: string, beforeId?: string) {
        const layer = document.layers.find(l => l.id === id), parent = document.layers.find(l => l.id === parentId)
        if (!canEdit || !layer || layerUnavailable(document, layer, "locked") || parent?.locked || parentId && (!parent || parent.kind !== "frame") || layer.kind === "frame" && parentId) return
        const layers = document.layers.filter(l => l.id !== id), moved = {...layer, parentId}
        const index = beforeId ? layers.findIndex(l => l.id === beforeId) + 1 : layers.length
        layers.splice(index, 0, moved); apply({...document, layers})
    }
    function align(axis: "left" | "center" | "right" | "top" | "middle" | "bottom" | "horizontal" | "vertical") {
        const layers = selected.filter(l => !layerUnavailable(document, l, "locked") && !selectedIds.includes(l.parentId ?? ""))
        if (!canEdit || !layers.length) return
        const parent = layers.length === 1 ? document.layers.find(l => l.id === layers[0].parentId) : undefined
        const left = parent?.x ?? Math.min(...layers.map(l => l.x)), top = parent?.y ?? Math.min(...layers.map(l => l.y)), right = parent ? parent.x + parent.width : Math.max(...layers.map(l => l.x + l.width)), bottom = parent ? parent.y + parent.height : Math.max(...layers.map(l => l.y + l.height))
        if (axis === "horizontal" || axis === "vertical") {
            if (layers.length < 3) return
            const horizontal = axis === "horizontal", ordered = [...layers].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y), gap = ((horizontal ? right - left : bottom - top) - ordered.reduce((s, l) => s + (horizontal ? l.width : l.height), 0)) / (layers.length - 1)
            let cursor = horizontal ? left : top
            apply(moveDesignLayers(document, ordered.map(l => {const position = {id: l.id, x: horizontal ? cursor : l.x, y: horizontal ? l.y : cursor}; cursor += (horizontal ? l.width : l.height) + gap; return position}))); return
        }
        apply(moveDesignLayers(document, layers.map(l => ({id: l.id, x: axis === "left" ? left : axis === "center" ? (left + right - l.width) / 2 : axis === "right" ? right - l.width : l.x, y: axis === "top" ? top : axis === "middle" ? (top + bottom - l.height) / 2 : axis === "bottom" ? bottom - l.height : l.y}))))
    }
    function action(key: string, shift: boolean) {
        if (key === "a") {setSelectedIds(document.layers.filter(l => !layerUnavailable(document, l, "hidden") && !layerUnavailable(document, l, "locked")).map(l => l.id)); return}
        if (!canEdit) return
        if (key === "z") {if (shift) editor.redo(); else editor.undo()}
        else if (key === "y") editor.redo()
        else if (key === "d") duplicate()
        else if (key === "delete" || key === "backspace") remove()
        else if ((key === "[" || key === "]") && primary) apply(reorderDesignLayer(document, primary.id, key === "]" ? 1 : -1))
        else if (key.startsWith("arrow")) {const amount = shift ? 10 : 1; apply(moveDesignLayers(document, selected.map(l => ({id: l.id, x: Math.max(-1e6, Math.min(1e6, l.x + (key === "arrowright" ? amount : key === "arrowleft" ? -amount : 0))), y: Math.max(-1e6, Math.min(1e6, l.y + (key === "arrowdown" ? amount : key === "arrowup" ? -amount : 0)))}))))}
    }
    async function importDraft(file?: File) {
        if (!file || !canEdit) return
        try {
            if (file.size > 15 * 1024 * 1024) throw new Error("Choose a design JSON file smaller than 15 MB.")
            const draft = JSON.parse(await file.text())
            if (!validDesignDocument(draft)) throw new Error("This file is not a valid UI/UX design draft.")
            if (!draft.layers.length) throw new Error("This draft does not contain any layers.")
            const current = latest.current.document, offset = current.layers.length ? Math.max(...current.layers.map(l => l.x + l.width)) + 100 - Math.min(...draft.layers.map(l => l.x)) : 0
            if (!paste(JSON.stringify({type: "devhub-design", layers: draft.layers, startFrameId: draft.startFrameId}), offset, true)) throw new Error("The design could not be added. Check the document size and 5,000 layer limit.")
            setFitKey(v => v + 1)
        } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not import this design.")}
        finally {if (fileInput.current) fileInput.current.value = ""}
    }
    async function exportPng() {setExporting(true); setError(""); try {await designPng(document, primary?.kind === "frame" ? primary.id : undefined)} catch (failure) {setError(failure instanceof Error ? failure.message : "Could not export PNG.")} finally {setExporting(false)}}
    function chooseImage(id?: string) {imageTarget.current = id; imageInput.current?.click()}
    async function placeImage(file?: File) {
        if (!file || !canEdit) return
        const targetId = imageTarget.current
        try {
            if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 1.5 * 1024 * 1024) throw new Error("Choose a PNG, JPG, WebP, or GIF image up to 1.5 MB.")
            const image = await new Promise<string>((resolve, reject) => {const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Could not read this image.")); reader.readAsDataURL(file)})
            const bitmap = new Image(); bitmap.src = image; await bitmap.decode()
            const current = latest.current.document
            if (targetId) {
                const layer = current.layers.find(l => l.id === targetId)
                if (layer && !layerUnavailable(current, layer, "locked")) apply({...current, layers: current.layers.map(l => l.id === targetId ? {...l, image} : l)})
            } else {
                if (current.layers.length >= 5000) throw new Error("This design can contain up to 5,000 layers.")
                const frame = current.layers.find(l => l.id === selectedFrame?.id && !l.locked), width = Math.max(16, Math.min(bitmap.width, frame ? frame.width - 48 : 480)), height = Math.max(16, Math.min(10000, bitmap.height * width / bitmap.width))
                const layer = newDesignLayer("rectangle", {name: file.name.slice(0, 150), image, width, height, x: frame ? frame.x + 24 : 80, y: frame ? frame.y + 72 : 80, ...(frame ? {parentId: frame.id} : {})})
                if (apply({...current, layers: [...current.layers, layer]})) {setSelectedIds([layer.id]); setTool("select"); setFitKey(v => v + 1)}
            }
        } catch (failure) {setError(failure instanceof Error ? failure.message : "Could not place image.")}
        finally {if (imageInput.current) imageInput.current.value = ""}
    }
    return <section ref={workspace} className="project-tool-workspace ui-editor-workspace"
        onCopy={e => {if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true]") || !selected.length) return; const text = copyDesignLayers(document, selectedIds); e.clipboardData.setData("text/plain", text); e.preventDefault(); pasteCount.current = {text, count: 0}}}
        onCut={e => {if (!canEdit || (e.target as HTMLElement).closest("input, textarea, [contenteditable=true]") || !selected.length) return; e.clipboardData.setData("text/plain", copyDesignLayers(document, selectedIds)); e.preventDefault(); remove()}}
        onPaste={e => {if ((e.target as HTMLElement).closest("input, textarea, [contenteditable=true]")) return; const text = e.clipboardData.getData("text/plain"), count = pasteCount.current.text === text ? pasteCount.current.count + 1 : 1; if (paste(text, 32 * count)) {e.preventDefault(); pasteCount.current = {text, count}}}}>
        <ToolDocumentHeader title="Interface studio" projectName={project!.name} {...editor} canWrite={canWrite} persisted={isPersistedOrganization} onSave={() => void editor.save()} onRetry={editor.retry} onReload={editor.reload} tool="ui-editor" document={document} exporting={exporting} exportItems={<>
            <DropdownMenuItem disabled={!document.layers.length} onSelect={() => downloadFile(designSvg(document, primary?.kind === "frame" ? primary.id : undefined), "interface-design.svg", "image/svg+xml")}><FileImage/>Export {primary?.kind === "frame" ? "screen" : "canvas"} as SVG</DropdownMenuItem>
            <DropdownMenuItem disabled={!document.layers.length} onSelect={() => void exportPng()}><ImageDown/>Export {primary?.kind === "frame" ? "screen" : "canvas"} as PNG</DropdownMenuItem>
        </>}><Button size="sm" className="ui-present-button" disabled={!screens.length} onClick={() => setPresent(true)}><Play/>Present</Button></ToolDocumentHeader>
        <div className="ui-editor-commandbar"><div><span className="ui-studio-icon"><PencilRuler/></span><span>Workspace</span><ChevronRight/><strong>{mode === "design" ? "Design" : "Prototype"}</strong></div><div><span className="ui-screen-count">{screens.length} {screens.length === 1 ? "screen" : "screens"}</span><i/><button type="button" aria-label="Undo" title="Undo · Ctrl+Z" disabled={!canEdit || !editor.canUndo} onClick={editor.undo}><Undo2/></button><button type="button" aria-label="Redo" title="Redo · Ctrl+Shift+Z" disabled={!canEdit || !editor.canRedo} onClick={editor.redo}><Redo2/></button><i/><button type="button" title="Import a design draft; adds screens to this canvas" disabled={!canAdd} onClick={() => fileInput.current?.click()}><FileUp/><span>Import</span></button></div></div>
        <input type="file" ref={fileInput} hidden accept=".json,application/json" aria-label="Import design draft" onChange={e => void importDraft(e.target.files?.[0])}/>
        <input type="file" ref={imageInput} hidden accept="image/png,image/jpeg,image/webp,image/gif" aria-label="Place design image" onChange={e => void placeImage(e.target.files?.[0])}/>
        {error && <div className="tool-document-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></div>}
        <div className="tool-editor-body ui-editor-body">
            <DesignLayersPanel document={document} selectedIds={selectedIds} onSelect={select} canEdit={canEdit} onPatch={patch} onReparent={reparent} onSort={direction => {if (primary) apply(reorderDesignLayer(document, primary.id, direction))}} onComponent={component} onFrame={addFrame} onStarter={starter} onImage={() => chooseImage()}/>
            <div className="ui-canvas-area"><DesignCanvas document={document} selectedIds={selectedIds} onSelect={setSelectedIds} tool={tool} onTool={setTool} canEdit={canEdit} onChange={apply} onCreate={create} fitKey={fitKey} prototype={mode === "prototype"} onEditText={(id, text) => patch(id, {text})} onAction={action}/>
                {!ready && <div className="ui-canvas-loading" role="status">Opening your design workspace…</div>}
                {ready && !document.layers.length && <div className="ui-design-empty"><div className="ui-empty-art" aria-hidden="true"><div className="ui-empty-art-screen"><span/><i/><i/><div/><b/></div><div className="ui-empty-art-swatch"><i/><i/><i/><i/></div><span className="ui-empty-art-cursor"><PencilRuler/></span><small>your next great idea</small></div><span className="ui-empty-eyebrow">IDEAS, MEET CANVAS.</span><h2>Make something<br/><em>worth clicking.</em></h2><p>A space to design interfaces, shape the details,<br/>and bring your next experience to life.</p><div className="ui-empty-actions"><Button disabled={!canAdd} onClick={() => addFrame(390, 844, "Mobile screen")}><Plus/>Start with a frame</Button><button type="button" disabled={!canAdd} onClick={() => starter("onboarding")}><Sparkles/>Try a starter<ArrowRight/></button></div><span className="ui-empty-hint"><kbd>F</kbd> to draw a frame anywhere on the canvas</span></div>}
                <div className="ui-design-toolbar" role="toolbar" aria-label="Design tools">{designTools.map(({id, icon: Icon, label, key}) => <button type="button" key={id} disabled={id !== "select" && id !== "hand" && !canAdd} className={tool === id ? "active" : ""} aria-label={`${label} tool`} aria-pressed={tool === id} title={`${label} · ${key}`} onClick={() => {setTool(id); focusCanvas()}}><Icon/><span className="ui-tool-tooltip">{label}<kbd>{key}</kbd></span></button>)}</div>
            </div>
            <DesignInspector document={document} selectedIds={selectedIds} mode={mode} canEdit={canEdit} onPatch={patch} onGeometry={changes => {if (primary) apply(moveDesignLayers(document, [{...primary, ...changes}]))}} onRemove={remove} onDuplicate={duplicate} onAlign={align} onStart={id => apply({...document, startFrameId: id})} onFrame={addFrame} onMode={setMode} onImage={chooseImage} onBegin={editor.beginTransaction} onEnd={editor.endTransaction}/>
        </div>
        <footer className="ui-editor-status"><span><span className={`ui-status-dot ${canEdit ? "" : "readonly"}`}/>{!canWrite ? "View only" : canEdit ? "Ready to create" : "Editing unavailable"}</span><span>{selected.length ? `${selected.length} ${selected.length === 1 ? "layer" : "layers"} selected` : "Scroll to pan · Ctrl + scroll to zoom"}</span><span><Check/> {document.layers.length.toLocaleString()} layers</span></footer>
        {present && <DesignPlayer document={document} initialFrameId={selectedFrame?.id} onClose={() => setPresent(false)}/>}
    </section>
}
