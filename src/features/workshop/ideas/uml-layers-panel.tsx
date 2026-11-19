import {useState} from "react"
import {Eye,EyeOff,LockKeyhole,UnlockKeyhole,X} from "lucide-react"
import {Button} from "@/components/ui/button"
import {ConnectionLightning} from "../connections/connection-lightning"
import type {CanvasItem} from "../shape-clipboard"

export function UmlLayersPanel({diagramId, items, selectedIds, canEdit, onSelect, onUpdate, onClose}: {
    diagramId: string; items: CanvasItem[]; selectedIds: string[]; canEdit: boolean
    onSelect: (id: string) => void; onUpdate: (item: CanvasItem) => void; onClose: () => void
}) {
    const [query, setQuery] = useState("")
    const layers = [...items].reverse().filter(item => `${item.text} ${item.umlSymbol}`.toLowerCase().includes(query.toLowerCase()))
    return <aside className="workshop-shape-menu uml-layers" aria-label="Layers" onPointerDown={event => event.stopPropagation()} onWheel={event => event.stopPropagation()}>
        <header><strong>Layers</strong><Button size="icon-sm" variant="ghost" aria-label="Close layers" onClick={onClose}><X/></Button></header>
        <input aria-label="Search layers" placeholder="Search layers…" value={query} onChange={event => setQuery(event.target.value)}/>
        <div className="uml-layer-list">{layers.map(item => {
            const label = item.umlDetails?.name || item.text.split("\n")[0] || "Untitled"
            return <div key={item.id} className={`connection-node-anchor${selectedIds.includes(item.id) ? " selected" : ""}`}>
                <button type="button" className="uml-layer-name" onClick={() => onSelect(item.id)}><small>{item.umlSymbol}</small><span>{label}</span></button>
                <Button size="icon-sm" variant="ghost" disabled={!canEdit} aria-label={`${item.hidden ? "Show" : "Hide"} ${item.umlSymbol}`} onClick={() => onUpdate({...item, hidden: !item.hidden})}>{item.hidden ? <EyeOff/> : <Eye/>}</Button>
                <Button size="icon-sm" variant="ghost" disabled={!canEdit} aria-label={`${item.locked ? "Unlock" : "Lock"} ${item.umlSymbol}`} onClick={() => onUpdate({...item, locked: !item.locked})}>{item.locked ? <LockKeyhole/> : <UnlockKeyhole/>}</Button>
                <ConnectionLightning node={{kind: item.connection ? "uml-relationship" : "uml-element", id: item.id, parentId: diagramId, label}}/>
            </div>
        })}</div>
    </aside>
}
