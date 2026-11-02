import {useEffect, useRef, useState} from "react"
import {Search, X} from "lucide-react"
import {Button} from "@/components/ui/button"
import {normalizeCanvasItem} from "../shape-clipboard"
import {prioritizedUmlPresets, type UmlType} from "../uml-catalog"
import {umlConnectorSymbols, type UmlPoint} from "../uml-connection-types"
import {ShapeGeometry} from "./shape-geometry"

export function UmlConnectionSuggestions({anchor,viewport,umlType,onChoose,onClose}: {
    anchor:UmlPoint
    viewport:{width:number;height:number}
    umlType:UmlType|null
    onChoose:(presetId:string)=>string
    onClose:(restoreFocus?:boolean)=>void
}) {
    const [query,setQuery]=useState("")
    const [error,setError]=useState("")
    const panel=useRef<HTMLDivElement>(null)
    const seen=new Set<string>()
    const presets=prioritizedUmlPresets(umlType).filter(preset=>preset.changes?.umlSymbol && !(umlConnectorSymbols as readonly string[]).includes(preset.changes.umlSymbol))
    const matches=query.trim() ? presets.filter(p=>(p.label+" "+p.category).toLowerCase().includes(query.trim().toLowerCase())) : presets.filter(p=>{const symbol=p.changes!.umlSymbol!;if(seen.has(symbol))return false;seen.add(symbol);return true}).slice(0,6)
    useEffect(()=>{
        function outside(event:globalThis.PointerEvent) {if(event.target instanceof Node && !panel.current?.contains(event.target))onClose()}
        function escape(event:globalThis.KeyboardEvent) {if(event.key==="Escape"){event.preventDefault();event.stopPropagation();onClose(true)}}
        window.addEventListener("pointerdown",outside,true)
        window.addEventListener("keydown",escape,true)
        return ()=>{window.removeEventListener("pointerdown",outside,true);window.removeEventListener("keydown",escape,true)}
    },[onClose])
    return <div ref={panel} className="uml-connection-suggestions" data-uml-connection-suggestions role="dialog" aria-modal={false} aria-label="Suggested shapes"
        style={{left:Math.max(8,Math.min(anchor.x+12,viewport.width-256)),top:Math.max(8,Math.min(anchor.y+12,viewport.height-260))}}
        onPointerDown={event=>event.stopPropagation()} onWheel={event=>event.stopPropagation()} onKeyDown={event=>event.stopPropagation()}>
        <header><strong>Suggested shapes</strong><Button type="button" size="icon-sm" variant="ghost" aria-label="Dismiss suggestions" onClick={()=>onClose(true)}><X/></Button></header>
        <label className="uml-suggestions-search"><Search/><input aria-label="Search suggested shapes" placeholder="Search shapes…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
        <div className="uml-suggestions-grid">
            {matches.map(preset=><Button key={preset.id} type="button" variant="ghost" className="uml-suggestion" aria-label={`Add connected ${preset.label.toLowerCase()}`} title={preset.label} onClick={()=>{const failure=onChoose(preset.id);if(failure)setError(failure)}}>
                <span className="uml-suggestion-preview"><ShapeGeometry item={normalizeCanvasItem({kind:preset.kind,umlSymbol:preset.changes?.umlSymbol,width:40,height:28,outlineWidth:1.5,outlineColor:"currentColor",outlineStyle:preset.changes?.outlineStyle??"solid",appearance:"outlined"})}/></span>
                <small>{preset.label}</small>
            </Button>)}
            {!matches.length&&<p>No matching shapes.</p>}
        </div>
        {error&&<p role="alert" className="workshop-form-error">{error}</p>}
    </div>
}
