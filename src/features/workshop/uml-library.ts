import {createClientId} from "../../lib/create-client-id.ts"
import {decodeShapes, encodeShapes, type CanvasItem} from "./shape-clipboard.ts"
import {umlSymbolKinds, umlTypes, type UmlType} from "./uml-catalog.ts"
import {validUmlConnections} from "./uml-connections.ts"

export type UmlDiagram = {id: string; name: string; type: UmlType | null; items: CanvasItem[]; updatedAt: string}
export type UmlLibrary = {version: 1; diagrams: UmlDiagram[]}
export const emptyUmlLibrary: UmlLibrary = {version: 1, diagrams: []}
export function newUmlDiagram(name: string, type: UmlType | null): UmlDiagram {return {id: createClientId(), name: name.trim(), type, items: [], updatedAt: new Date().toISOString()}}
export function validUmlLibrary(value: unknown): value is UmlLibrary {
    if (!value || typeof value !== "object") return false
    try {if (JSON.stringify(value).length > 4_000_000) return false} catch {return false}
    const library = value as UmlLibrary, ids = new Set<string>()
    return library.version === 1 && Array.isArray(library.diagrams) && library.diagrams.length <= 100 && library.diagrams.every(d => {
        if (!d || typeof d.id !== "string" || !d.id.trim() || d.id.length > 100 || ids.has(d.id) || typeof d.name !== "string" || !d.name.trim() || d.name.length > 150 || !(d.type === null || umlTypes.some(t => t.id === d.type)) || typeof d.updatedAt !== "string" || d.updatedAt.length > 100 || !Number.isFinite(Date.parse(d.updatedAt)) || !Array.isArray(d.items) || d.items.length > 10000) return false
        const decoded = decodeShapes(encodeShapes(d.items))
        if (decoded.length !== d.items.length || d.items.some(i => !i.id.trim() || i.id.length > 100 || !i.umlSymbol || !umlSymbolKinds.includes(i.umlSymbol)) || new Set(d.items.map(i => i.id)).size !== d.items.length) return false
        if (!validUmlConnections(d.items)) return false
        ids.add(d.id); return true
    })
}
export function updateUmlDiagram(library: UmlLibrary, id: string, changes: Partial<Pick<UmlDiagram, "name" | "type" | "items">>): UmlLibrary {
    if (!library.diagrams.some(d => d.id === id)) return library
    return {...library, diagrams: library.diagrams.map(d => d.id === id ? {...d, ...changes, updatedAt: new Date().toISOString()} : d)}
}
