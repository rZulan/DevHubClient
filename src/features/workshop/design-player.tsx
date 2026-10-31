import {WorkshopSelect} from "@/features/workshop/workshop-select"
import {useEffect, useRef, useState} from "react"
import {ArrowLeft, Eye, EyeOff, RotateCcw, X} from "lucide-react"
import {Dialog, DialogContent, DialogDescription, DialogTitle} from "@/components/ui/dialog"
import {DesignShape} from "./design-shape"
import {designShapeStyle} from "./design-style"
import {layerUnavailable, type DesignDocument, type DesignInteraction, type DesignLayer} from "./design-document"

export function DesignPlayer({document, initialFrameId, onClose}: {document: DesignDocument; initialFrameId?: string; onClose: () => void}) {
    const frames = document.layers.filter(l => l.kind === "frame" && !l.hidden), first = frames.find(f => f.id === initialFrameId) ?? frames.find(f => f.id === document.startFrameId) ?? frames[0]
    const [frameId, setFrameId] = useState(first?.id), [history, setHistory] = useState<string[]>([]), [overlayId, setOverlayId] = useState<string | null>(null), [hints, setHints] = useState(false)
    const [transition, setTransition] = useState("instant"), [size, setSize] = useState({width: 800, height: 600})
    const stage = useRef<HTMLDivElement>(null), frame = frames.find(f => f.id === frameId) ?? first, overlay = frames.find(f => f.id === overlayId)
    useEffect(() => {const node = stage.current; if (!node) return; const observer = new ResizeObserver(() => setSize({width: node.clientWidth, height: node.clientHeight})); observer.observe(node); return () => observer.disconnect()}, [])
    function back() {if (overlayId) {setOverlayId(null); return} const last = history.at(-1); if (last) {setFrameId(last); setHistory(h => h.slice(0, -1)); setTransition("instant")}}
    function activate(interaction?: DesignInteraction) {
        if (!interaction) return
        setTransition(interaction.transition)
        if (interaction.action === "back") back()
        else if (interaction.action === "close") setOverlayId(null)
        else if (frames.some(f => f.id === interaction.targetId)) {
            if (interaction.action === "overlay") setOverlayId(interaction.targetId!)
            else {if (frameId) setHistory(h => [...h, frameId]); setFrameId(interaction.targetId!); setOverlayId(null)}
        }
    }
    function screen(screen: DesignLayer, isOverlay = false) {
        const children = document.layers.filter(l => l.parentId === screen.id && !layerUnavailable(document, l, "hidden"))
        return <div className={`ui-player-screen transition-${transition}`} key={screen.id} style={{width: screen.width, height: screen.height, backgroundColor: screen.fill, backgroundImage: screen.image ? `url("${screen.image}")` : undefined, backgroundSize: screen.imageFit ?? "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat", opacity: screen.opacity, borderRadius: screen.radius, position: isOverlay ? "relative" : undefined}}>
            {screen.interaction && <button type="button" className="ui-player-frame-hotspot" aria-label={`Activate ${screen.name}`} onClick={() => activate(screen.interaction)}/>}
            {children.map(layer => {const interactive = !!layer.interaction; return <div className={`ui-player-layer ${hints && interactive ? "show-hotspot" : ""}`} key={layer.id} style={{left: layer.x - screen.x, top: layer.y - screen.y, width: layer.width, height: layer.height, opacity: layer.opacity}}>
                {layer.control ? <PrototypeControl layer={layer} onInteract={() => activate(layer.interaction)}/> : <><DesignShape layer={layer}/>{interactive && <button type="button" className="ui-player-hotspot" aria-label={layer.text || layer.name} onClick={() => activate(layer.interaction)}/>}</>}</div>})}
        </div>
    }
    const scale = frame ? Math.max(.05, Math.min(1, (size.width - 64) / frame.width, (size.height - 48) / frame.height)) : 1
    return <Dialog open onOpenChange={open => {if (!open) onClose()}}><DialogContent showCloseButton={false} className="ui-player-dialog" onKeyDown={e => {if (e.altKey && e.key === "ArrowLeft") {e.preventDefault(); back()}}}>
        <header className="ui-player-header"><div><span className="ui-player-mark">▶</span><div><DialogTitle>Prototype preview</DialogTitle><DialogDescription>Click through your design.</DialogDescription></div></div><div><button type="button" aria-label="Go back in prototype" disabled={!history.length && !overlayId} onClick={back}><ArrowLeft/></button><button type="button" aria-label="Restart prototype" onClick={() => {setFrameId(first?.id); setHistory([]); setOverlayId(null); setTransition("instant")}}><RotateCcw/></button><button type="button" aria-label="Show interaction hotspots" aria-pressed={hints} onClick={() => setHints(v => !v)}>{hints ? <Eye/> : <EyeOff/>}</button><i/><button type="button" aria-label="Close prototype" onClick={onClose}><X/></button></div></header>
        <div className="ui-player-stage" ref={stage}>{frame && <div className="ui-player-fit" style={{width: frame.width * scale, height: frame.height * scale}}><div style={{transform: `scale(${scale})`, transformOrigin: "0 0", width: frame.width, height: frame.height}}>{screen(frame)}{overlay && <div className="ui-player-overlay" style={{width: frame.width, height: frame.height}}><button type="button" className="ui-overlay-backdrop" aria-label="Dismiss overlay" onClick={() => setOverlayId(null)}/><div style={{position: "relative", transform: `scale(${Math.min(1, (frame.width - 32) / overlay.width, (frame.height - 32) / overlay.height)})`}}>{screen(overlay, true)}</div></div>}</div></div>}</div>
        <footer className="ui-player-footer"><label>Screen<WorkshopSelect aria-label="Preview screen" value={frameId} onValueChange={selectedValue => {setFrameId(selectedValue); setOverlayId(null); setTransition("instant")}}>{frames.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</WorkshopSelect></label><span>{hints ? "Interactive areas are highlighted" : "Click elements to follow your flow"}</span><small>{Math.round(scale * 100)}%</small></footer>
    </DialogContent></Dialog>
}
function PrototypeControl({layer, onInteract}: {layer: DesignLayer; onInteract: () => void}) {
    const [checked, setChecked] = useState(true)
    if (layer.control === "input") return <input className="ui-prototype-input" aria-label={layer.name} placeholder={layer.text} style={{...designShapeStyle(layer), pointerEvents: "auto", outlineColor: "#9872ed", userSelect: "text"}}/>
    return <button type="button" className="ui-prototype-toggle" role={layer.control === "toggle" ? "switch" : "checkbox"} aria-checked={checked} aria-label={layer.name} onClick={() => {setChecked(v => !v); onInteract()}}><DesignShape layer={checked ? layer : {...layer, fill: "#dce0e8"}} checked={checked}/></button>
}
