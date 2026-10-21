import {createClientId} from "../../lib/create-client-id.ts"
import {maxErdImportBytes, validateErdImport} from "./erd-import.ts"
import type {ErdDocument} from "./tool-documents.ts"

export function copyErdTables(document: ErdDocument, selectedIds: string[]): string {
    const ids = new Set(selectedIds)
    const tables = document.tables.filter(table => ids.has(table.id))
    if (!tables.length) return ""
    const selected = {...document, tables, relationships: document.relationships.filter(relation => ids.has(relation.fromTable) && ids.has(relation.toTable))}
    return JSON.stringify({type: "devhub/erd-tables", version: 1, document: selected})
}

export function readErdClipboard(text: string): ErdDocument | null {
    if (new TextEncoder().encode(text).length > maxErdImportBytes) throw new Error("The copied schema exceeds the 4 MB limit.")
    let value: unknown
    try {value = JSON.parse(text)} catch {return null}
    if (!value || typeof value !== "object" || !("type" in value) || value.type !== "devhub/erd-tables") return null
    if (!("version" in value) || value.version !== 1 || !("document" in value)) throw new Error("This ERD clipboard format is not supported.")
    validateErdImport(value.document)
    return value.document.tables.length ? value.document : null
}

function unusedName(base: string, used: Set<string>) {
    if (!used.has(base.toLowerCase())) {used.add(base.toLowerCase()); return base}
    let suffix = "_copy", count = 2
    while (used.has((base.slice(0, 150 - suffix.length) + suffix).toLowerCase())) suffix = `_copy_${count++}`
    const name = base.slice(0, 150 - suffix.length) + suffix
    used.add(name.toLowerCase())
    return name
}

/** Copies a selected subgraph with fresh identities and export-safe names. */
export function insertErdTables(current: ErdDocument, source: ErdDocument, offset = 24, createId = createClientId) {
    if (!Number.isFinite(offset) || !source.tables.length) throw new Error("No tables are available to paste.")
    validateErdImport(source)
    if (current.tables.length + source.tables.length > 500 || current.relationships.length + source.relationships.length > 2000) throw new Error("Pasting would exceed 500 tables or 2,000 relationships.")
    const tableIds = new Map<string, string>(), fieldIds = new Map<string, string>()
    const names = new Set(current.tables.map(table => table.name.toLowerCase()))
    const constraintNames = new Set(current.tables.flatMap(table => [...(table.indexes ?? []), ...(table.checks ?? [])].map(item => item.name.toLowerCase())))
    const tables = source.tables.map(table => {
        const id = createId(); tableIds.set(table.id, id)
        const fields = table.fields.map(field => {const id = createId(); fieldIds.set(`${table.id}:${field.id}`, id); return {...field, id}})
        return {...table, id, name: unusedName(table.name, names), x: table.x + offset, y: table.y + offset, fields,
            ...(table.indexes ? {indexes: table.indexes.map(index => ({...index, id: createId(), name: unusedName(index.name, constraintNames), fields: index.fields.map(id => fieldIds.get(`${table.id}:${id}`)!)}))} : {}),
            ...(table.checks ? {checks: table.checks.map(check => ({...check, id: createId(), name: unusedName(check.name, constraintNames)}))} : {}),
        }
    })
    const relationships = source.relationships.map(relation => ({...relation, id: createId(), fromTable: tableIds.get(relation.fromTable)!, toTable: tableIds.get(relation.toTable)!,
        fromField: fieldIds.get(`${relation.fromTable}:${relation.fromField}`)!, toField: fieldIds.get(`${relation.toTable}:${relation.toField}`)!,
        ...(relation.fromFields ? {fromFields: relation.fromFields.map(id => fieldIds.get(`${relation.fromTable}:${id}`)!)} : {}),
        ...(relation.toFields ? {toFields: relation.toFields.map(id => fieldIds.get(`${relation.toTable}:${id}`)!)} : {}),
    }))
    const document = {...current, tables: [...current.tables, ...tables], relationships: [...current.relationships, ...relationships]}
    validateErdImport(document)
    return {document, selectedIds: tables.map(table => table.id)}
}
