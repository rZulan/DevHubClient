import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {WorkshopNoProject} from "@/features/workshop/workshop-empty-state"
import {type ShapePreset} from "@/features/workshop/shape-catalog"
import {canvasGridBackground} from "@/features/workshop/canvas-view"
import {readCanvasView, saveCanvasView} from "@/features/workshop/canvas-view-storage"
import {ArrowLeft, Lightbulb, Waypoints, Undo2, Redo2, Layers} from "lucide-react"
import {
    type CSSProperties,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type WheelEvent,
} from "react"
import {Navigate, useOutletContext} from "react-router-dom"

import {Button} from "@/components/ui/button"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import {createClientId} from "@/lib/create-client-id"
import type {ResizeDirection} from "@/features/workshop/resize-rectangle"
import {type SnapGuide, snapShape} from "@/features/workshop/snap-shape"
import {axisAlignedBounds, combinedBounds, fitBounds, zoomAt} from "@/features/workshop/canvas-view"
import {resizeSelection} from "@/features/workshop/resize-selection"
import {rotateSelection} from "@/features/workshop/rotate-selection"
import {WorkshopCanvasNotice} from "@/features/workshop/workshop-limit-notices"
import {prioritizedUmlPresets, umlPresets} from "@/features/workshop/uml-catalog"
import type {UmlDiagram} from "@/features/workshop/uml-library"
import {upgradeUmlConnections, visibleUmlItems, canConnectUmlShape, newUmlConnection, syncUmlConnections, umlEndpointAt, umlEndpointPoint, umlConnectionRoute, umlSelectionWithConnections, translateUmlItems} from "@/features/workshop/uml-connections"
import {umlConnectorSymbols, umlSides, type UmlConnection, type UmlConnectorSymbol, type UmlSide} from "@/features/workshop/uml-connection-types"
import {UmlConnectionSuggestions} from "@/features/workshop/ideas/uml-connection-suggestions"
import {addUmlSuggestedElement, createUmlPresetItems, umlFacingEndpoint, validUmlConnectionSuggestion, type UmlConnectionSuggestion} from "@/features/workshop/uml-connection-drop"
import {UmlConnectionsLayer} from "@/features/workshop/ideas/uml-connections-layer"
import {UmlConnectionLabelEditor} from "@/features/workshop/ideas/uml-connection-label-editor"
import {UmlConnectorPanel} from "@/features/workshop/ideas/uml-connector-panel"
import {UmlElementFields} from "@/features/workshop/ideas/uml-element-fields"
import {UmlCanvasActions} from "@/features/workshop/ideas/uml-canvas-actions"
import {UmlLayersPanel} from "@/features/workshop/ideas/uml-layers-panel"
import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {expandGroupedIds, groupShapes, ungroupShapes} from "@/features/workshop/shape-groups"
import {CanvasCard, type TextSelection, type TextStyleCommand} from "@/features/workshop/ideas/canvas-card"
import {CanvasToolbar, ShapeSelector, ZoomControls} from "@/features/workshop/ideas/canvas-controls"
import {CanvasMinimap} from "@/features/workshop/ideas/canvas-minimap"
import {IdeasShortcutsDialog} from "@/features/workshop/ideas/shortcuts-dialog"
import {type CanvasContextAction, CanvasContextMenu} from "@/features/workshop/ideas/canvas-context-menu"
import {ShapePropertiesPanel, type ShapeStyleChanges} from "@/features/workshop/ideas/shape-properties-panel"
import {useCanvasTouch} from "@/features/workshop/use-canvas-touch"
import {type CharacterStyleChanges, selectedCharacterStyle} from "@/features/workshop/ideas/rich-text"

import {
    type CanvasItem,
    cloneShapes,
    decodeShapes,
    encodeShapes,
} from "@/features/workshop/shape-clipboard"

export function WorkshopIdeationPage() {
    return <Navigate to="../uml" replace/>
}

export function PlaygroundCanvas({diagram, adapter, onBack, viewStorageKey}: {diagram: UmlDiagram; adapter: {canEdit: boolean; status: string; error: string; setItems: (items: CanvasItem[]) => void; save: () => void; retry: () => void; reload: () => void}; onBack: () => void; viewStorageKey?: string}) {
    const {project} = useOutletContext<WorkshopOutletContext>()
    const items = useMemo(()=>upgradeUmlConnections(diagram.items),[diagram.items]), setDocumentItems = adapter.setItems, saveStatus = adapter.status, saveError = adapter.error, save = adapter.save, retry = adapter.retry, reload = adapter.reload, hasEditPermission = adapter.canEdit
    const itemsRef = useRef(items)
    itemsRef.current = items
    const history = useRef<{ past: CanvasItem[][]; future: CanvasItem[][] }>({past: [], future: []})
    const historyTransaction = useRef<CanvasItem[] | null>(null)
    const lastLocalItems = useRef(items)
    useEffect(() => {if (items !== lastLocalItems.current) {history.current = {past: [], future: []}; historyTransaction.current = null; lastLocalItems.current = items}}, [items])

    function setItems(action: CanvasItem[] | ((current: CanvasItem[]) => CanvasItem[])) {
        if (!hasEditPermission) return
        const current = itemsRef.current
        const next = syncUmlConnections(typeof action === "function" ? action(current) : action)
        if (next === current || next.length === current.length && next.every((item, index) => item === current[index])) return
        if (!historyTransaction.current) {
            history.current.past.push(current)
            if (history.current.past.length > 100) history.current.past.shift()
        }
        history.current.future = []
        itemsRef.current = next
        lastLocalItems.current = next
        setDocumentItems(next)
    }

    function beginHistoryTransaction() {
        historyTransaction.current ??= itemsRef.current
    }

    function endHistoryTransaction() {
        const start = historyTransaction.current
        historyTransaction.current = null
        const current = itemsRef.current
        if (!start || start === current || start.length === current.length && start.every((item, index) => item === current[index])) return
        history.current.past.push(start)
        if (history.current.past.length > 100) history.current.past.shift()
    }

    function undo() {
        if (!hasEditPermission) return
        const previous = history.current.past.pop()
        if (!previous) return
        historyTransaction.current = null
        history.current.future.push(itemsRef.current)
        itemsRef.current = previous
        lastLocalItems.current = previous
        setDocumentItems(previous)
        setSnapGuides([])
    }

    function redo() {
        if (!hasEditPermission) return
        const next = history.current.future.pop()
        if (!next) return
        historyTransaction.current = null
        history.current.past.push(itemsRef.current)
        itemsRef.current = next
        lastLocalItems.current = next
        setDocumentItems(next)
        setSnapGuides([])
    }
    const manualSave = useRef(save)
    manualSave.current = save
    useEffect(() => {
        function saveShortcut(event: globalThis.KeyboardEvent) {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return
            event.preventDefault()
            if (!event.repeat && hasEditPermission) manualSave.current()
        }

        window.addEventListener("keydown", saveShortcut, true)
        return () => window.removeEventListener("keydown", saveShortcut, true)
    }, [hasEditPermission])
    const [savedView] = useState(() => readCanvasView(viewStorageKey))
    const [zoom, setZoom] = useState(savedView?.zoom ?? 0.85)
    const [pan, setPan] = useState(savedView?.pan ?? {x: 60, y: 30})
    useEffect(() => {saveCanvasView(viewStorageKey, {zoom, pan})}, [viewStorageKey, zoom, pan])
    const [tool, setTool] = useState<"select" | "hand">("select")
    const [connecting, setConnecting] = useState(false)
    const [connectionSymbol, setConnectionSymbol] = useState<UmlConnectorSymbol>(diagram.type === "sequence" ? "sync" : diagram.type === "class" || diagram.type === "use-case" ? "association" : "directed")
    const [connectionRouting, setConnectionRouting] = useState<UmlConnection["routing"]>(diagram.type === "sequence" || diagram.type === "communication" ? "straight" : "orthogonal")
    const [connectionDraft, setConnectionDraft] = useState<CanvasItem>()
    const [pendingConnection, setPendingConnection] = useState<UmlConnectionSuggestion & {beforeDrop:CanvasItem[];afterDrop:CanvasItem[]}>()
    const [editingLabelId, setEditingLabelId] = useState<string>()
    const [layersOpen, setLayersOpen] = useState(false)
    const connectionGesture = useRef<{pointerId:number; original:CanvasItem; draft:CanvasItem; mode:"new"|"start"|"end"|"bend"; index:number; clientX:number; clientY:number; moved:boolean}|null>(null)
    const [spacePanning, setSpacePanning] = useState(false)
    const [isPanning, setIsPanning] = useState(false)
    const [isShapeMenuOpen, setIsShapeMenuOpen] = useState(true)
    const [isHotkeysOpen, setIsHotkeysOpen] = useState(false)
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        worldX: number;
        worldY: number;
        target: "canvas" | "selection"
    }>()
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [activeTextSelection, setActiveTextSelection] = useState<TextSelection>()
    const [textStyleCommand, setTextStyleCommand] = useState<TextStyleCommand>()
    const textStyleCommandId = useRef(0)
    const selectorsByShape = new Map<string, string[]>()
    const [snapping, setSnapping] = useState(true)
    const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
    const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds])
    useEffect(() => {
        const available = new Set(items.map(item => item.id))
        setSelectedIds(current => {
            const next = current.filter(id => available.has(id))
            return next.length === current.length ? current : next
        })
    }, [items])
    const selectedItems = useMemo(() => items.filter((item) => selectedIdSet.has(item.id)), [items, selectedIdSet])
    const selectedGroupId = useMemo(() => selectedItems.length > 1 && selectedItems[0].groupId && selectedItems.every((item) => item.groupId === selectedItems[0].groupId)
        ? selectedItems[0].groupId
        : undefined, [selectedItems])
    const [propertyItemId, setPropertyItemId] = useState<string>()
    useEffect(() => {
        if (!selectedItems.some((item) => item.id === propertyItemId)) setPropertyItemId(selectedItems[0]?.id)
    }, [propertyItemId, selectedItems])
    const selectedItem = selectedItems.find((item) => item.id === propertyItemId) ?? selectedItems[0]
    const selectedTextStyle = useMemo(() => selectedItem && activeTextSelection?.itemId === selectedItem.id
        ? selectedCharacterStyle(selectedItem, activeTextSelection.part, activeTextSelection.start, activeTextSelection.end)
        : undefined, [activeTextSelection, selectedItem])
    const propertyItems = useMemo(() => selectedGroupId && selectedItem ? [selectedItem] : selectedItems, [selectedGroupId, selectedItem, selectedItems])
    const propertyTargetIds = useMemo(() => new Set(propertyItems.map((item) => item.id)), [propertyItems])
    const canvasRef = useRef<HTMLDivElement>(null)
    const lastPaste = useRef({text: "", count: 0})
    const contextClipboard = useRef<CanvasItem[]>([])
    const [viewportSize, setViewportSize] = useState({width: 1, height: 1})
    useLayoutEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return
        const observer = new ResizeObserver(() => setViewportSize({
            width: canvas.clientWidth,
            height: canvas.clientHeight
        }))
        observer.observe(canvas)
        return () => observer.disconnect()
    }, [project?.id])
    const selectionStart = useRef<{ pointerId: number; x: number; y: number; base: string[] } | null>(null)
    const groupStart = useRef<CanvasItem[]>([])
    const [marquee, setMarquee] = useState<{ x: number; y: number; width: number; height: number }>()
    const panStart = useRef<{ pointerX: number; pointerY: number; panX: number; panY: number } | null>(null)
    const touch = useCanvasTouch(canvasRef, {zoom, pan}, view => {setZoom(view.zoom); setPan(view.pan)}, () => {
        cancelConnection(); endPan(); groupStart.current = []; setSnapGuides([]); endHistoryTransaction()
    })
    const canEditIdeation = hasEditPermission && !["loading", "load-error", "conflict"].includes(saveStatus)
    const panningMode = tool === "hand" || spacePanning
    const editingLabel = canEditIdeation && !panningMode ? visibleUmlItems(items).find(item=>item.id===editingLabelId && item.connection && !item.locked) : undefined

    function editConnectionLabel(id:string) {
        const item=itemsRef.current.find(candidate=>candidate.id===id)
        if(!canEditIdeation || panningMode || !item?.connection || item.locked || item.hidden) return
        cancelConnection()
        setSelectedIds([id])
        setPropertyItemId(id)
        setEditingLabelId(id)
    }
    function commitConnectionLabel(text:string) {
        const id=editingLabelId
        if(canEditIdeation) setItems(current=>current.map(item=>item.id===id && item.connection && !item.locked && item.text!==text ? {...item,text,textRuns:undefined} : item))
        setEditingLabelId(undefined)
    }
    useEffect(()=>{if(editingLabelId && !editingLabel) setEditingLabelId(undefined)},[editingLabelId,editingLabel])

    function offerConnectionSuggestions(item:CanvasItem,end:"start"|"end",beforeDrop:CanvasItem[]) {
        const endpoint=item.connection![end]
        if("shapeId" in endpoint) {setPendingConnection(undefined);return}
        setPendingConnection({connectionId:item.id,end,point:endpoint,beforeDrop,afterDrop:itemsRef.current})
    }
    function chooseSuggestedElement(presetId:string) {
        if(!canEditIdeation || !pendingConnection) return "This canvas is not editable right now."
        const current=itemsRef.current,result=addUmlSuggestedElement(current,pendingConnection,presetId,createClientId)
        if(!result) return "This connection changed. Drag its end again to add an element."
        const combineUndo=current===pendingConnection.afterDrop && history.current.past.at(-1)===pendingConnection.beforeDrop && !historyTransaction.current
        setItems(result.items)
        if(combineUndo) history.current.past.pop()
        setSelectedIds([result.id]);setPropertyItemId(result.id)
        setPendingConnection(undefined)
        return ""
    }
    useEffect(()=>{
        if(pendingConnection && (!canEditIdeation || !validUmlConnectionSuggestion(items,pendingConnection))) setPendingConnection(undefined)
    },[canEditIdeation,items,pendingConnection])

    function worldPoint(event: {clientX:number;clientY:number}) {
        const rect = canvasRef.current!.getBoundingClientRect()
        return {x:(event.clientX-rect.left-pan.x)/zoom,y:(event.clientY-rect.top-pan.y)/zoom}
    }
    function cancelConnection() {connectionGesture.current=null;setConnectionDraft(undefined)}
    function startConnection(event: ReactPointerEvent, item:CanvasItem, mode:"new"|"start"|"end"|"bend", index=0) {
        if (!canEditIdeation || event.button!==0 || !event.isPrimary || item.locked || panningMode) return
        event.preventDefault();event.stopPropagation()
        canvasRef.current?.focus({preventScroll:true})
        canvasRef.current?.setPointerCapture(event.pointerId)
        connectionGesture.current={pointerId:event.pointerId,original:item,draft:item,mode,index,clientX:event.clientX,clientY:event.clientY,moved:false}
        setConnectionDraft(item);setEditingLabelId(undefined)
    }
    function beginEdge(event: ReactPointerEvent, item:CanvasItem, side:UmlSide, offset=.5) {
        const start={shapeId:item.id,side,offset}
        const added=newUmlConnection(itemsRef.current,start,umlEndpointPoint(itemsRef.current,start),connectionSymbol,connectionRouting)
        if (diagram.type==="sequence"||diagram.type==="communication") added.connection!.number=Math.min(10000,1+Math.max(0,...itemsRef.current.map(n=>n.connection?.number??0)))
        startConnection(event,added,"new")
    }
    function moveConnection(event: ReactPointerEvent) {
        const gesture=connectionGesture.current
        if (!gesture || gesture.pointerId!==event.pointerId) return false
        event.preventDefault();event.stopPropagation()
        gesture.moved ||= Math.hypot(event.clientX-gesture.clientX,event.clientY-gesture.clientY)>4
        const point=worldPoint(event), c=gesture.original.connection!
        let connection:UmlConnection
        if (gesture.mode==="bend") {const bends=[...c.bends];bends[gesture.index]=point;connection={...c,bends}}
        else {const endpoint=umlEndpointAt(itemsRef.current,point,14/zoom)??point;connection={...c,[gesture.mode==="start"?"start":"end"]:endpoint}}
        gesture.draft={...gesture.original,connection};setConnectionDraft(gesture.draft)
        return true
    }
    function finishConnection(event: ReactPointerEvent) {
        if (!connectionGesture.current || connectionGesture.current.pointerId!==event.pointerId) return
        moveConnection(event)
        const gesture=connectionGesture.current
        if (gesture.moved && canEditIdeation && !itemsRef.current.find(n=>n.id===gesture.original.id)?.locked) {
            const beforeDrop=itemsRef.current
            setItems(current=>gesture.mode==="new" ? [...current,gesture.draft] : current.map(item=>item.id===gesture.original.id ? gesture.draft : item))
            setSelectedIds([gesture.original.id]);setPropertyItemId(gesture.original.id)
            if(gesture.mode!=="bend") offerConnectionSuggestions(gesture.draft,gesture.mode==="start" ? "start" : "end",beforeDrop)
        }
        cancelConnection()
        if(canvasRef.current?.hasPointerCapture(event.pointerId))canvasRef.current.releasePointerCapture(event.pointerId)
    }
    useEffect(()=>{const cancel=()=>cancelConnection();window.addEventListener("blur",cancel);return()=>window.removeEventListener("blur",cancel)},[])
    useEffect(()=>{if(!canEditIdeation)cancelConnection()},[canEditIdeation])

    useEffect(() => {
        function keyDown(event: globalThis.KeyboardEvent) {
            if (event.code !== "Space" || event.repeat || isHotkeysOpen || isEditingText(event.target) || event.target instanceof Element && !!event.target.closest("[data-uml-connection-suggestions]")) return
            event.preventDefault()
            setSpacePanning(true)
        }

        function releaseSpace(event: globalThis.KeyboardEvent) {
            if (event.code === "Space") setSpacePanning(false)
        }

        function releaseOnBlur() {
            setSpacePanning(false)
        }

        window.addEventListener("keydown", keyDown, true)
        window.addEventListener("keyup", releaseSpace, true)
        window.addEventListener("blur", releaseOnBlur)
        return () => {
            window.removeEventListener("keydown", keyDown, true)
            window.removeEventListener("keyup", releaseSpace, true)
            window.removeEventListener("blur", releaseOnBlur)
        }
    }, [isHotkeysOpen])

    useEffect(() => {
        if (!contextMenu) return

        function close(event: globalThis.PointerEvent) {
            if (event.target instanceof Element && event.target.closest(".workshop-canvas-context-menu")) return
            setContextMenu(undefined)
        }

        function closeOnEscape(event: globalThis.KeyboardEvent) {
            if (event.key !== "Escape") return
            event.preventDefault()
            event.stopPropagation()
            setContextMenu(undefined)
        }

        function closeOnBlur() {
            setContextMenu(undefined)
        }

        window.addEventListener("pointerdown", close, true)
        window.addEventListener("keydown", closeOnEscape, true)
        window.addEventListener("blur", closeOnBlur)
        return () => {
            window.removeEventListener("pointerdown", close, true)
            window.removeEventListener("keydown", closeOnEscape, true)
            window.removeEventListener("blur", closeOnBlur)
        }
    }, [contextMenu])

    function setViewZoom(value: number, anchor = {x: viewportSize.width / 2, y: viewportSize.height / 2}) {
        // Guard numerical overflow only; there are no product-level zoom limits.
        if (!Number.isFinite(value) || value <= 0) return
        const nextPan = zoomAt(zoom, pan, value, anchor)
        if (!Number.isFinite(nextPan.x) || !Number.isFinite(nextPan.y) || !Number.isFinite(viewportSize.width / value)) return
        setPan(nextPan)
        setZoom(value)
    }

    function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
        if (!event.isPrimary || connectionGesture.current) return
        event.currentTarget.focus({preventScroll: true})
        if (event.button === 0 && !panningMode && event.pointerType !== "touch") {
            event.preventDefault()
            const bounds = event.currentTarget.getBoundingClientRect()
            const base = event.shiftKey || event.ctrlKey || event.metaKey ? selectedIds : []
            selectionStart.current = {
                pointerId: event.pointerId,
                x: (event.clientX - bounds.left - pan.x) / zoom,
                y: (event.clientY - bounds.top - pan.y) / zoom,
                base
            }
            setSelectedIds(base)
            event.currentTarget.setPointerCapture(event.pointerId)
            return
        }
        const isMiddleMouse = event.button === 1
        const isPrimaryPan = event.button === 0 && (panningMode || event.pointerType === "touch")
        if (!isMiddleMouse && !isPrimaryPan) return

        event.preventDefault()
        event.currentTarget.setPointerCapture(event.pointerId)
        panStart.current = {pointerX: event.clientX, pointerY: event.clientY, panX: pan.x, panY: pan.y}
        setIsPanning(true)
    }

    function movePan(event: ReactPointerEvent<HTMLDivElement>) {
        if (moveConnection(event)) return
        const start = selectionStart.current
        if (start && start.pointerId === event.pointerId) {
            const bounds = event.currentTarget.getBoundingClientRect()
            const x = (event.clientX - bounds.left - pan.x) / zoom
            const y = (event.clientY - bounds.top - pan.y) / zoom
            const box = {
                x: Math.min(x, start.x),
                y: Math.min(y, start.y),
                width: Math.abs(x - start.x),
                height: Math.abs(y - start.y)
            }
            setMarquee(box)
            const hits = items.filter((item) => {
                if (item.hidden) return false
                const bounds = axisAlignedBounds(item)
                return bounds.x <= box.x + box.width && bounds.x + bounds.width >= box.x
                    && bounds.y <= box.y + box.height && bounds.y + bounds.height >= box.y
            }).map((item) => item.id)
            setSelectedIds(expandGroupedIds(items, [...new Set([...start.base, ...hits])]))
            return
        }
        if (!panStart.current) return
        setPan({
            x: panStart.current.panX + event.clientX - panStart.current.pointerX,
            y: panStart.current.panY + event.clientY - panStart.current.pointerY,
        })
    }

    function handleWheel(event: WheelEvent<HTMLDivElement>) {
        event.preventDefault()
        if (connectionGesture.current || selectionStart.current || groupStart.current.length) return
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportSize.height : 1)
        const nextZoom = zoom * Math.exp(-delta * 0.0015)
        if (nextZoom === zoom) return

        const bounds = event.currentTarget.getBoundingClientRect()
        const pointerX = event.clientX - bounds.left
        const pointerY = event.clientY - bounds.top
        setViewZoom(nextZoom, {x: pointerX, y: pointerY})
    }

    function endPan() {
        selectionStart.current = null
        setMarquee(undefined)
        panStart.current = null
        setIsPanning(false)
    }

    function addRectangle(at?: { x: number; y: number }) {
        addPreset(prioritizedUmlPresets(diagram.type)[0], at)
    }

    function addPreset(preset: ShapePreset, at?: { x: number; y: number }) {
        if (!canEditIdeation) return
        const symbol=preset.changes?.umlSymbol
        if (symbol && umlConnectorSymbols.includes(symbol as UmlConnectorSymbol)) {
            setConnectionSymbol(symbol as UmlConnectorSymbol);setConnecting(true);setTool("select")
            if(at){
                const source=selectedItem && canConnectUmlShape(selectedItem) ? selectedItem : undefined
                const added=newUmlConnection(itemsRef.current,source ? umlFacingEndpoint(source,at) : {x:at.x-200,y:at.y},umlEndpointAt(itemsRef.current,at,14/zoom)??at,symbol as UmlConnectorSymbol,connectionRouting)
                if(diagram.type==="sequence"||diagram.type==="communication") added.connection!.number=Math.min(10000,1+Math.max(0,...itemsRef.current.map(n=>n.connection?.number??0)))
                setEditingLabelId(undefined)
                const beforeDrop=itemsRef.current
                setItems(current=>[...current,added])
                setSelectedIds([added.id]);setPropertyItemId(added.id)
                offerConnectionSuggestions(added,"end",beforeDrop)
            }
            return
        }
        const shapes=createUmlPresetItems(preset,{x:0,y:0},createClientId),bounds=combinedBounds(shapes)
        const origin=at??{x:(viewportSize.width/2-pan.x)/zoom-bounds.width/2,y:(viewportSize.height/2-pan.y)/zoom-bounds.height/2}
        const added=translateUmlItems(shapes,origin)
        setItems(current => [...current, ...added])
        setTool("select");setConnecting(false)
        setSelectedIds(added.map(item => item.id))
    }

    function resetView() {
        if (!items.some(n=>!n.hidden)) {
            setZoom(1)
            setPan({x: viewportSize.width / 2, y: viewportSize.height / 2})
            return
        }
        const view = fitBounds(combinedBounds(visibleUmlItems(items)), viewportSize, selectedItem && tool === "select" && viewportSize.width > 600 ? 300 : 0)
        setZoom(view.zoom)
        setPan(view.pan)
    }

    function updateShapeStyle(changes: ShapeStyleChanges) {
        setItems((current) => current.map((item) => propertyTargetIds.has(item.id) && !item.locked ? {...item, ...changes} : item))
    }

    function updateSelectedTextStyle(changes: CharacterStyleChanges) {
        if (!activeTextSelection) return
        setTextStyleCommand({...activeTextSelection, changes, id: ++textStyleCommandId.current})
    }

    function changeShapeOrder(position: "front" | "back") {
        setItems((current) => {
            const selected = current.filter((item) => selectedIds.includes(item.id))
            if (!selected) return current
            const others = current.filter((item) => !selectedIds.includes(item.id) || item.locked)
            return position === "front" ? [...others, ...selected] : [...selected, ...others]
        })
    }

    function groupSelection() {
        if (selectedItems.length < 2) return
        const groupId = createClientId()
        setItems((current) => groupShapes(current, selectedIds, groupId))
        setSelectedIds(expandGroupedIds(items.map((item) => selectedIds.includes(item.id) ? {
            ...item,
            groupId
        } : item), selectedIds))
    }

    function ungroupSelection() {
        if (!selectedItems.some((item) => item.groupId)) return
        setItems((current) => ungroupShapes(current, selectedIds))
    }

    function insertCopies(source: CanvasItem[], offset: number) {
        if(source.every(n=>itemsRef.current.includes(n))) source = umlSelectionWithConnections(itemsRef.current,source.map(n=>n.id))
        if (!source.length) return
        const copies = cloneShapes(source, offset, createClientId)
        setItems((current) => [...current, ...copies])
        setSelectedIds(copies.map((item) => item.id))
        setSnapGuides([])
    }

    async function copySelection(source = umlSelectionWithConnections(itemsRef.current,selectedIds)) {
        if (!source.length) return
        const text = encodeShapes(source)
        contextClipboard.current = source.map((item) => ({...item}))
        lastPaste.current = {text, count: 0}
        try {
            await navigator.clipboard.writeText(text)
        } catch { /* The internal canvas clipboard remains available. */
        }
    }

    async function pasteFromClipboard(at?: { x: number; y: number }) {
        let text = ""
        try {
            text = await navigator.clipboard.readText()
        } catch { /* Fall back to the internal canvas clipboard. */
        }
        const decoded = decodeShapes(text)
        const source = decoded.length ? decoded : contextClipboard.current
        if (!source.length) return
        if (at) {
            const copies = cloneShapes(source, 0, createClientId)
            const bounds = combinedBounds(copies)
            const positioned = translateUmlItems(copies,{x:at.x-bounds.x,y:at.y-bounds.y})
            setItems((current) => [...current, ...positioned])
            setSelectedIds(positioned.map((item) => item.id))
            return
        }
        const encoded = text || encodeShapes(source)
        const count = lastPaste.current.text === encoded ? lastPaste.current.count + 1 : 1
        lastPaste.current = {text: encoded, count}
        insertCopies(source, 24 * count / zoom)
    }

    function deleteSelection() {
        setItems((current) => current.filter((item) => !selectedIds.includes(item.id) || item.locked))
        setSelectedIds([])
    }

    function openContextMenu(event: ReactMouseEvent<HTMLDivElement>) {
        if (isEditingText(event.target) || event.target instanceof Element && event.target.closest(".workshop-shape-properties, .workshop-canvas-toolbar, .workshop-shape-menu, .workshop-zoom-control, .workshop-canvas-minimap, .workshop-canvas-meta, [role=dialog]")) return
        event.preventDefault()
        const canvas = event.currentTarget
        const bounds = canvas.getBoundingClientRect()
        const shapeElement = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-canvas-item-id]") : null
        const selectionBounds = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-canvas-selection]") : null
        const shapeId = shapeElement?.dataset.canvasItemId
        if (shapeId) {
            const shape = items.find((item) => item.id === shapeId)
            if (shape && !selectedIdSet.has(shapeId)) {
                const ids = shape.groupId ? items.filter((item) => item.groupId === shape.groupId).map((item) => item.id) : [shapeId]
                setSelectedIds(ids)
                setPropertyItemId(shapeId)
            }
        }
        const x = Math.max(8, Math.min(event.clientX - bounds.left, canvas.clientWidth - 228))
        const selectionTarget = !!shapeId || !!selectionBounds
        const y = Math.max(8, Math.min(event.clientY - bounds.top, canvas.clientHeight - (selectionTarget ? 460 : 220)))
        setContextMenu({
            x,
            y,
            worldX: (event.clientX - bounds.left - pan.x) / zoom,
            worldY: (event.clientY - bounds.top - pan.y) / zoom,
            target: selectionTarget ? "selection" : "canvas"
        })
        setIsShapeMenuOpen(false)
    }

    async function runContextAction(action: CanvasContextAction) {
        const menu = contextMenu
        setContextMenu(undefined)
        if (!menu) return
        if (action === "copy") await copySelection()
        else if (action === "cut") {
            await copySelection();
            deleteSelection()
        } else if (action === "paste") await pasteFromClipboard({x: menu.worldX, y: menu.worldY})
        else if (action === "duplicate") insertCopies(selectedItems, 24 / zoom)
        else if (action === "flip-horizontal") flipSelection("horizontal")
        else if (action === "flip-vertical") flipSelection("vertical")
        else if (action === "delete") deleteSelection()
        else if (action === "group") groupSelection()
        else if (action === "ungroup") ungroupSelection()
        else if (action === "front") changeShapeOrder("front")
        else if (action === "back") changeShapeOrder("back")
        else if (action === "select-all") setSelectedIds(visibleUmlItems(items).map((item) => item.id))
        else if (action === "fit") resetView()
        else if (action === "add-rectangle") addRectangle({x: menu.worldX, y: menu.worldY})
    }

    function flipSelection(axis: "horizontal" | "vertical") {
        setItems((current) => current.map((item) => !selectedIds.includes(item.id) || item.locked || item.connection ? item : axis === "horizontal"
            ? {...item, flipHorizontal: !item.flipHorizontal}
            : {...item, flipVertical: !item.flipVertical}))
    }

    function isEditingText(target: EventTarget | null) {
        return target instanceof HTMLElement && !!target.closest("input, select, textarea, [contenteditable]:not([contenteditable=false])")
    }

    function changeSelectionSize(next: CanvasItem, direction?: ResizeDirection, bypass = true, keyboard = false) {
        const source = (keyboard ? selectedItems : groupStart.current).filter(n=>!n.connection&&!n.locked)
        if (source.length < 2) return
        const original = combinedBounds(source)
        const constrained = resizeSelection(source, original, next)
        const targets = items.filter((item) => !source.some((member) => member.id === item.id))
        const snapped = snapping && !bypass ? snapShape({...next, ...constrained.bounds}, targets, zoom, direction) : {
            shape: {...next, ...constrained.bounds},
            guides: []
        }
        const resized = resizeSelection(source, original, snapped.shape)
        setSnapGuides(snapped.guides.filter((guide) => guide.axis === "x"
            ? resized.bounds.x === snapped.shape.x && resized.bounds.width === snapped.shape.width
            : resized.bounds.y === snapped.shape.y && resized.bounds.height === snapped.shape.height))
        setItems((current) => current.map((item) => resized.items.find((member) => member.id === item.id) ?? item))
    }

    function changeSelectionRotation(degrees: number) {
        const source = (groupStart.current.length ? groupStart.current : selectedItems).filter(n=>!n.connection&&!n.locked)
        if (source.length < 2) return
        const rotated = rotateSelection(source, degrees)
        setItems((current) => current.map((item) => rotated.find((member) => member.id === item.id) ?? item))
    }

    if (!project) {
        return <WorkshopNoProject icon={Lightbulb}/>
    }

    return (
        <div
            ref={canvasRef}
            tabIndex={0}
            aria-label={`${diagram.name} UML canvas`}
            onDragOver={event => {if (canEditIdeation && event.dataTransfer.types.includes("application/x-zevont-uml-preset")) {event.preventDefault(); event.dataTransfer.dropEffect = "copy"}}}
            onDrop={event => {if (!canEditIdeation || (event.target as Element).closest(".workshop-shape-menu")) return; const preset = umlPresets.find(p => p.id === event.dataTransfer.getData("application/x-zevont-uml-preset")); if (!preset || !canvasRef.current) return; event.preventDefault(); const bounds = canvasRef.current.getBoundingClientRect(); addPreset(preset, {x: (event.clientX - bounds.left - pan.x) / zoom, y: (event.clientY - bounds.top - pan.y) / zoom})}}
            onCopy={(event) => {
                if (isEditingText(event.target) || tool !== "select" || !canEditIdeation || !selectedItems.length || groupStart.current.length) return
                event.preventDefault()
                const copied = umlSelectionWithConnections(itemsRef.current,selectedIds)
                const text = encodeShapes(copied)
                event.clipboardData.setData("text/plain", text)
                lastPaste.current = {text, count: 0}
                contextClipboard.current = copied
            }}
            onCut={(event) => {
                if (isEditingText(event.target) || tool !== "select" || !canEditIdeation || !selectedItems.length || groupStart.current.length) return
                event.preventDefault()
                const copied = umlSelectionWithConnections(itemsRef.current,selectedIds)
                const text = encodeShapes(copied)
                event.clipboardData.setData("text/plain", text)
                lastPaste.current = {text, count: 0}
                contextClipboard.current = copied
                deleteSelection()
            }}
            onPaste={(event) => {
                if (isEditingText(event.target) || tool !== "select" || !canEditIdeation || groupStart.current.length || selectionStart.current) return
                const text = event.clipboardData.getData("text/plain")
                const source = decodeShapes(text)
                if (!source.length) return
                event.preventDefault()
                const count = lastPaste.current.text === text ? lastPaste.current.count + 1 : 1
                lastPaste.current = {text, count}
                insertCopies(source, 24 * count / zoom)
                canvasRef.current?.focus({preventScroll: true})
            }}
            onKeyDown={(event) => {
                if(event.key==="Escape" && connectionGesture.current){event.preventDefault();cancelConnection();return}
                if (!isEditingText(event.target) && canEditIdeation && (event.ctrlKey || event.metaKey)) {
                    const key = event.key.toLowerCase()
                    const isUndo = key === "z" && !event.shiftKey
                    const isRedo = key === "y" || key === "z" && event.shiftKey
                    if (isUndo || isRedo) {
                        event.preventDefault()
                        if (!event.repeat && !groupStart.current.length && !selectionStart.current) {
                            if (isUndo) undo()
                            else redo()
                        }
                        return
                    }
                }
                if (!isEditingText(event.target) && tool === "select" && canEditIdeation && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
                    event.preventDefault()
                    if (!event.repeat && !groupStart.current.length && !selectionStart.current) insertCopies(selectedItems, 24 / zoom)
                    return
                }
                if (!isEditingText(event.target) && tool === "select" && canEditIdeation && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "g") {
                    event.preventDefault()
                    if (!event.repeat) {
                        if (event.shiftKey) ungroupSelection()
                        else groupSelection()
                    }
                    return
                }
                if ((event.target as HTMLElement).closest("input, select, textarea, button, [contenteditable=true]")) return
                if (event.key === "Escape") {
                    setSelectedIds([]);setConnecting(false);
                    setSnapGuides([]);
                    setIsShapeMenuOpen(false);
                    return
                }
                if (tool !== "select" || !canEditIdeation) return
                if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                    event.preventDefault();
                    setSelectedIds(visibleUmlItems(items).map((item) => item.id))
                } else if (event.key === "Delete" || event.key === "Backspace") {
                    event.preventDefault();
                    setItems((current) => current.filter((item) => !selectedIds.includes(item.id) || item.locked));
                    setSelectedIds([])
                } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
                    event.preventDefault()
                    const step = event.shiftKey ? 10 : 1
                    const offset={x:event.key==="ArrowLeft"?-step:event.key==="ArrowRight"?step:0,y:event.key==="ArrowUp"?-step:event.key==="ArrowDown"?step:0}
                    setItems(current=>current.map(item=>selectedIds.includes(item.id)&&!item.locked?translateUmlItems([item],offset)[0]:item))
                }
            }}
            className={`workshop-ideation${connecting ? " uml-connecting" : ""}${panningMode ? " hand-tool" : ""}${isPanning ? " panning" : ""}`}
            onAuxClick={(event) => {
                if (event.button === 1) event.preventDefault()
            }}
            onDoubleClick={event=>{
                if(!canEditIdeation || panningMode || isEditingText(event.target)) return
                const target=event.target instanceof Element ? event.target : null
                if(target?.closest(".workshop-canvas-toolbar, .workshop-shape-menu, .workshop-shape-properties, .workshop-canvas-meta, .workshop-canvas-minimap, .workshop-zoom-control, [role=dialog]")) return
                const shapeId=target?.closest<HTMLElement>("[data-canvas-item-id]")?.dataset.canvasItemId
                if(shapeId && !items.find(item=>item.id===shapeId)?.connection) return
                const point=worldPoint(event)
                const link=visibleUmlItems(items).find(item=>{
                    if(!item.connection || item.locked || !selectedIdSet.has(item.id)) return false
                    const center=umlConnectionRoute(items,item).label
                    return Math.hypot(point.x-center.x,point.y-center.y)<=14/zoom
                })
                if(link){event.preventDefault();event.stopPropagation();editConnectionLabel(link.id)}
            }}
            onPointerDown={beginPan}
            {...touch}
            onPointerCancel={()=>{cancelConnection();endPan()}}
            onLostPointerCapture={()=>{cancelConnection();endPan()}}
            onPointerMove={movePan}
            onPointerUp={event=>{finishConnection(event);endPan()}}
            onContextMenu={openContextMenu}
            onWheel={handleWheel}
            style={{
                "--canvas-pan-x": `${pan.x}px`,
                "--canvas-pan-y": `${pan.y}px`,
                "--canvas-zoom": zoom,
                ...canvasGridBackground(zoom, pan, 22),
            } as CSSProperties}
        >
            <div className="workshop-canvas-meta" onPointerDown={(event) => event.stopPropagation()}>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Back to UML diagrams" onClick={onBack}><ArrowLeft/></Button>
                <div><small>{project.name} · UML</small><strong>{diagram.name}</strong></div>
                <small role="status">{({
                    loading: "Loading…",
                    saved: "Saved",
                    unsaved: "Unsaved changes",
                    saving: "Saving…",
                    error: "Save failed",
                    conflict: "Save conflict",
                    "load-error": "Could not load"
                })[saveStatus]}</small>
            </div>
            <div className="workshop-ideas-limit-notice" onPointerDown={event => event.stopPropagation()}><WorkshopCanvasNotice tool="ideas" document={items}/></div>
            {(["error", "load-error", "conflict"].includes(saveStatus) || saveError) &&
                <WorkshopToast variant="error" onPointerDown={(event) => event.stopPropagation()}>
                    <span>{saveStatus === "saving" ? "Retrying save… Your draft is kept locally." : saveStatus === "conflict" ? "Another session changed this canvas. Your draft is kept locally. Reloading replaces it with the saved version." : saveStatus === "load-error" ? "The canvas could not be loaded. Editing is disabled until it loads." : saveError}</span>
                    {saveStatus === "conflict" ? <Button size="sm" type="button" onClick={() => {
                            if (window.confirm("Replace your local draft with the latest saved canvas?")) {
                                setSelectedIds([]);
                                reload()
                            }
                        }}>Reload saved version</Button> :
                        <Button disabled={saveStatus === "saving"} size="sm" type="button"
                                onClick={retry}>{saveStatus === "saving" ? "Retrying…" : "Retry"}</Button>}
                </WorkshopToast>}

            <CanvasToolbar
                canEdit={canEditIdeation}
                tool={tool}
                shapeMenuOpen={isShapeMenuOpen}
                snapping={snapping}
                onSelectTool={() => {
                    setTool("select");setConnecting(false);
                    canvasRef.current?.focus({preventScroll: true})
                }}
                onHandTool={() => {setTool("hand");setConnecting(false)}}
                onToggleShapes={() => setIsShapeMenuOpen((current) => !current)}
                onToggleSnapping={() => {
                    setSnapping((current) => !current);
                    setSnapGuides([])
                }}
                onShowShortcuts={() => setIsHotkeysOpen(true)}
            >
                {canEditIdeation&&<><Button size="sm" variant={connecting?"secondary":"ghost"} aria-pressed={connecting} title="Drag from a shape edge to connect" onClick={()=>{setConnecting(!connecting);setTool("select")}}><Waypoints/>Connect</Button>
                <WorkshopSelect aria-label="Connection type" value={connectionSymbol} onValueChange={value=>{setConnectionSymbol(value as UmlConnectorSymbol);setConnecting(true);setTool("select")}}>{umlConnectorSymbols.map(symbol=><option key={symbol} value={symbol}>{umlPresets.find(p=>p.changes?.umlSymbol===symbol)?.label||symbol}</option>)}</WorkshopSelect>
                <WorkshopSelect aria-label="Default connection routing" value={connectionRouting} onValueChange={value=>setConnectionRouting(value as UmlConnection["routing"])}><option value="orthogonal">Elbow</option><option value="straight">Straight</option><option value="curve">Curve</option></WorkshopSelect>
                <Button size="icon-sm" variant="ghost" aria-label="Undo canvas change" disabled={!history.current.past.length} onClick={undo}><Undo2/></Button><Button size="icon-sm" variant="ghost" aria-label="Redo canvas change" disabled={!history.current.future.length} onClick={redo}><Redo2/></Button></>}
                <Button size="icon-sm" variant={layersOpen?"secondary":"ghost"} aria-label="Layers" aria-pressed={layersOpen} onClick={()=>setLayersOpen(!layersOpen)}><Layers/></Button>
                <UmlCanvasActions diagram={{...diagram,items}} selectedIds={selectedIds} canEdit={canEditIdeation} onItems={setItems}/>
            </CanvasToolbar>
            {pendingConnection && <UmlConnectionSuggestions key={pendingConnection.connectionId} anchor={{x:pan.x+pendingConnection.point.x*zoom,y:pan.y+pendingConnection.point.y*zoom}} viewport={viewportSize} umlType={diagram.type} onChoose={chooseSuggestedElement} onClose={restoreFocus=>{setPendingConnection(undefined);if(restoreFocus)canvasRef.current?.focus({preventScroll:true})}}/>}
            <IdeasShortcutsDialog open={isHotkeysOpen} onOpenChange={setIsHotkeysOpen}/>
            {contextMenu &&
                <CanvasContextMenu canEdit={canEditIdeation} hasClipboard={contextClipboard.current.length > 0}
                                   hasGroupedItems={selectedItems.some((item) => item.groupId)}
                                   selectionCount={selectedItems.length} target={contextMenu.target} x={contextMenu.x}
                                   y={contextMenu.y} onAction={runContextAction}/>}
            {layersOpen && <UmlLayersPanel items={items} selectedIds={selectedIds} canEdit={canEditIdeation} onSelect={id=>{setSelectedIds([id]);setPropertyItemId(id)}} onUpdate={item=>setItems(current=>current.map(n=>n.id===item.id?item:n))} onClose={()=>setLayersOpen(false)}/>}
            {canEditIdeation && isShapeMenuOpen && !layersOpen &&
                <ShapeSelector umlType={diagram.type} onAdd={addPreset} onClose={() => setIsShapeMenuOpen(false)}/>}
            {canEditIdeation && tool === "select" && selectedItem && (selectedItem.connection ? <UmlConnectorPanel key={selectedItem.id} item={selectedItem} items={items} onChange={next=>setItems(current=>current.map(n=>n.id===next.id?next:n))} onDelete={deleteSelection}/> : (
                <ShapePropertiesPanel
                    key={selectedItem.id}
                    extra={<UmlElementFields item={selectedItem} onChange={next=>setItems(current=>current.map(n=>n.id===next.id?next:n))}/>}
                    disabled={selectedItem.locked}
                    allItemsCount={items.length}
                    selectedGroupId={selectedGroupId}
                    selectedIds={selectedIds}
                    selectedItem={selectedItem}
                    selectedItems={selectedItems}
                    propertyItems={propertyItems}
                    onPropertyItemChange={setPropertyItemId}
                    onUpdate={updateShapeStyle}
                    activeTextPart={activeTextSelection?.itemId === selectedItem.id ? activeTextSelection.part : undefined}
                    selectedTextStyle={selectedTextStyle}
                    onTextStyleUpdate={updateSelectedTextStyle}
                    onChangeOrder={changeShapeOrder}
                    onGroup={groupSelection}
                    onUngroup={ungroupSelection}
                />
            ))}
            <div className="workshop-canvas-world" aria-label="Infinite UML canvas">
                {items.filter(item=>!item.connection&&!item.hidden).map((item, index) => (
                    <CanvasCard canDrag={canEditIdeation && tool === "select" && !spacePanning && !item.locked && !connecting}
                                showResizeHandles={selectedItems.length < 2} item={item} layer={index + 1} key={item.id}
                                remoteSelectors={selectorsByShape.get(item.id)} selected={selectedIdSet.has(item.id)}
                                textStyleCommand={textStyleCommand} onTextSelectionChange={(selection) => {
                        setActiveTextSelection(selection)
                        if (selection) setPropertyItemId(selection.itemId)
                    }} onSelect={(toggle, resizing) => {
                        canvasRef.current?.focus({preventScroll: true})
                        const itemIds = item.groupId ? items.filter((candidate) => candidate.groupId === item.groupId).map((candidate) => candidate.id) : [item.id]
                        const groupSelected = itemIds.every((id) => selectedIds.includes(id))
                        const ids = toggle
                            ? groupSelected ? selectedIds.filter((id) => !itemIds.includes(id)) : expandGroupedIds(items, [...selectedIds, ...itemIds])
                            : groupSelected ? selectedIds : itemIds
                        setSelectedIds(ids)
                        groupStart.current = items.filter((candidate) => !candidate.connection&&!candidate.locked&&(resizing ? candidate.id === item.id : ids.includes(candidate.id)))
                        if (toggle) {
                            groupStart.current = [];
                            return false
                        }
                        beginHistoryTransaction()
                        return true
                    }}
                                onChange={(next) => setItems((current) => current.map((candidate) => candidate.id === item.id ? {...candidate, ...next} : candidate))}
                                onDragChange={(next, direction, bypass) => {
                                    const moving = groupStart.current
                                    const targets = items.filter((candidate) => !moving.some((member) => member.id === candidate.id))
                                    const snapped = snapping && !bypass ? snapShape(next, targets, zoom, direction) : {
                                        shape: next,
                                        guides: []
                                    }
                                    setSnapGuides(snapped.guides)
                                    const origin = moving.find((member) => member.id === item.id)
                                    setItems((current) => current.map((candidate) => {
                                        if (direction) return candidate.id === item.id ? snapped.shape : candidate
                                        const start = moving.find((member) => member.id === candidate.id)
                                        return start && origin ? {
                                            ...candidate,
                                            x: start.x + snapped.shape.x - origin.x,
                                            y: start.y + snapped.shape.y - origin.y
                                        } : candidate
                                    }))
                                }} onDragEnd={() => {
                        setSnapGuides([]);
                        groupStart.current = [];
                        endHistoryTransaction()
                    }} zoom={zoom}>
                        <div className="uml-node-hit" data-locked={item.locked||!canEditIdeation} onPointerDown={event=>{if(item.locked){event.stopPropagation();setSelectedIds([item.id]);setPropertyItemId(item.id)}else if(connecting){const endpoint=umlEndpointAt([item],worldPoint(event),14/zoom);if(endpoint&&"shapeId"in endpoint)beginEdge(event,item,endpoint.side,endpoint.offset)}}}/>
                        {canEditIdeation&&!panningMode&&!item.locked&&canConnectUmlShape(item)&&umlSides.map(side=><button key={side} type="button" className="uml-edge-handle" data-side={side} title={`Drag to connect from ${side}`} aria-label={`Connect from ${side} edge`} onClick={event=>{if(event.detail===0){const start={shapeId:item.id,side,offset:.5},point=umlEndpointPoint(items,start),link=newUmlConnection(items,start,{x:point.x+100,y:point.y+60},connectionSymbol,connectionRouting);setItems(current=>[...current,link]);setSelectedIds([link.id]);setPropertyItemId(link.id)}}} style={{"--uml-handle-size":`${12/zoom}px` } as CSSProperties} onPointerDown={event=>beginEdge(event,item,side)} onDoubleClick={event=>event.stopPropagation()}/>)}
                    </CanvasCard>
                ))}
                {editingLabel && <UmlConnectionLabelEditor key={editingLabel.id} item={editingLabel} items={items} zoom={zoom} onCommit={commitConnectionLabel} onCancel={()=>setEditingLabelId(undefined)}/>}
                <UmlConnectionsLayer canInteract={!panningMode} items={items} selectedIds={selectedIds} canEdit={canEditIdeation&&!panningMode} zoom={zoom} draft={connectionDraft} onSelect={(id,additive)=>{setSelectedIds(current=>additive?(current.includes(id)?current.filter(n=>n!==id):[...current,id]):[id]);setPropertyItemId(id);setEditingLabelId(undefined);canvasRef.current?.focus({preventScroll:true})}} onEditLabel={editConnectionLabel} editingLabelId={editingLabel?.id} onEndpoint={(event,id,end)=>{const item=itemsRef.current.find(n=>n.id===id);if(item)startConnection(event,item,end)}} onBend={(event,id,index)=>{const item=itemsRef.current.find(n=>n.id===id);if(item)startConnection(event,item,"bend",index)}}/>
                {canEditIdeation && tool === "select" && selectedItems.length > 1 && selectedItems.every(n=>!n.connection&&!n.locked) && selectedItem && (
                    <CanvasCard
                        selectionBox
                        canDrag={!spacePanning}
                        selected
                        item={{
                            ...selectedItem, ...combinedBounds(selectedItems),
                            id: "selection-bounds",
                            appearance: "outlined",
                            outlineStyle: "dashed",
                            outlineWidth: 1 / zoom,
                            outlineColor: "#818cf8",
                            cornerRadius: 0,
                            rotation: 0,
                            flipHorizontal: false,
                            flipVertical: false,
                        }}
                        layer={items.length + 2}
                        zoom={zoom}
                        onSelect={() => {
                            groupStart.current = selectedItems.map((item) => ({...item}));
                            beginHistoryTransaction();
                            canvasRef.current?.focus({preventScroll: true});
                            return true
                        }}
                        onChange={(next) => changeSelectionSize(next, undefined, true, true)}
                        onRotateChange={(next) => changeSelectionRotation(next.rotation)}
                        onDragChange={changeSelectionSize}
                        onDragEnd={() => {
                            groupStart.current = [];
                            setSnapGuides([]);
                            endHistoryTransaction()
                        }}
                    />
                )}
                {marquee && <i className="workshop-selection-marquee" aria-hidden="true" style={{
                    left: marquee.x,
                    top: marquee.y,
                    width: marquee.width,
                    height: marquee.height,
                    borderWidth: 1 / zoom,
                    zIndex: items.length + 2
                }}/>}
                {snapGuides.map((guide) => <i aria-hidden="true" className="workshop-snap-guide" key={guide.axis}
                                              style={{
                                                  left: guide.axis === "x" ? guide.position : guide.start - 12 / zoom,
                                                  top: guide.axis === "y" ? guide.position : guide.start - 12 / zoom,
                                                  width: guide.axis === "x" ? 1 / zoom : guide.end - guide.start + 24 / zoom,
                                                  height: guide.axis === "y" ? 1 / zoom : guide.end - guide.start + 24 / zoom,
                                                  zIndex: items.length + 1,
                                              }}/>)}
            </div>

            <ZoomControls zoom={zoom} onZoom={setViewZoom} onFit={resetView}/>

            <CanvasMinimap items={visibleUmlItems(items)} viewport={{
                x: -pan.x / zoom,
                y: -pan.y / zoom,
                width: viewportSize.width / zoom,
                height: viewportSize.height / zoom
            }} onNavigate={(x, y) => setPan({
                x: viewportSize.width / 2 - x * zoom,
                y: viewportSize.height / 2 - y * zoom
            })}/>
        </div>
    )
}
