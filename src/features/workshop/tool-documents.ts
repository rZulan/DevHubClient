import {createClientId} from "../../lib/create-client-id.ts"
import {validNoteEmoji} from "./note-emojis.ts"

export const dataTypes = ["UUID", "INT", "BIGINT", "VARCHAR", "TEXT", "BOOLEAN", "DATE", "TIMESTAMP", "DECIMAL", "FLOAT", "JSON", "BLOB"] as const
export type DataType = typeof dataTypes[number]
export const erdDialects = ["postgresql", "mysql", "sqlserver", "sqlite"] as const
export type ErdDialect = typeof erdDialects[number]
export const erdDialectLabels: Record<ErdDialect, string> = {postgresql: "PostgreSQL", mysql: "MySQL 8+", sqlserver: "SQL Server", sqlite: "SQLite"}
export type ErdField = {id: string; name: string; type: DataType; length: string; primary: boolean; nullable: boolean; unique: boolean; defaultValue: string; autoIncrement?: boolean}
export type ErdIndex = {id: string; name: string; fields: string[]; unique: boolean}
export type ErdCheck = {id: string; name: string; expression: string}
export type ErdTable = {id: string; name: string; x: number; y: number; fields: ErdField[]; indexes?: ErdIndex[]; checks?: ErdCheck[]}
export const relationshipEndTypes = ["one", "zero-one", "many", "zero-many"] as const
export type RelationshipEnd = typeof relationshipEndTypes[number]
export const relationshipEndLabels: Record<RelationshipEnd, string> = {one: "One and only one", "zero-one": "Zero or one", many: "One or many", "zero-many": "Zero or many"}
export const relationshipEndCounts: Record<RelationshipEnd, string> = {one: "1", "zero-one": "0..1", many: "1..*", "zero-many": "0..*"}
export type ErdEdge = "left" | "right" | "top" | "bottom"
export type ErdAnchor = {edge: ErdEdge; offset: number}
export type ErdRelationship = {id: string; fromTable: string; fromField: string; toTable: string; toField: string; fromFields?: string[]; toFields?: string[]; cardinality: "1:1" | "1:N" | "N:1" | "N:M"; leftEnd?: RelationshipEnd; rightEnd?: RelationshipEnd; fromAnchor?: ErdAnchor; toAnchor?: ErdAnchor; onDelete: "RESTRICT" | "CASCADE" | "SET NULL"}
export type ErdDocument = {dialect?: ErdDialect; tables: ErdTable[]; relationships: ErdRelationship[]}
export type DesignKind = "frame" | "rectangle" | "ellipse" | "text" | "button"
export type DesignLayer = {id: string; name: string; kind: DesignKind; parentId?: string; x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number; radius: number; opacity: number; text: string; fontSize: number; textColor: string; hidden: boolean; locked: boolean}
export type DesignDocument = {layers: DesignLayer[]}
export const waterfallPhases = [
    {id: "requirements", title: "Requirements", description: "Define the problem, scope and acceptance criteria.", deliverables: "Requirements specification, stakeholder approval"},
    {id: "design", title: "System design", description: "Plan the architecture, data model and user experience.", deliverables: "Architecture, ERD, UI designs"},
    {id: "implementation", title: "Implementation", description: "Build the system from the approved design.", deliverables: "Working code, unit tests, technical documentation"},
    {id: "verification", title: "Verification", description: "Validate the system against the requirements.", deliverables: "Test results, defect fixes, acceptance sign-off"},
    {id: "deployment", title: "Deployment", description: "Release the approved system to its users.", deliverables: "Release plan, production deployment, user training"},
    {id: "maintenance", title: "Maintenance", description: "Monitor, support and improve the released system.", deliverables: "Monitoring, support log, maintenance releases"},
] as const
export type SdlcDocument = {model: "waterfall"; currentPhase: number; completed: boolean; notes: Record<string, string>}
export type StickyNote = {id: string; title: string; body: string; color: string; updatedAt: string; emoji?: string | null}
export type NotesDocument = {notes: StickyNote[]}
export type ToolDocumentMap = {erd: ErdDocument; "ui-editor": DesignDocument; sdlc: SdlcDocument; notes: NotesDocument}
export type DocumentTool = keyof ToolDocumentMap
export const emptyDocuments: ToolDocumentMap = {erd: {tables: [], relationships: []}, "ui-editor": {layers: []}, sdlc: {model: "waterfall", currentPhase: 0, completed: false, notes: {}}, notes: {notes: []}}

export function validToolDocument(tool: DocumentTool, value: unknown): boolean {
    const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)
    const text = (item: Record<string, unknown>, key: string) => typeof item[key] === "string"
    const number = (item: Record<string, unknown>, key: string) => typeof item[key] === "number" && Number.isFinite(item[key])
    const flag = (item: Record<string, unknown>, key: string) => typeof item[key] === "boolean"
    if (!record(value)) return false
    if (tool === "notes") {
        const ids = new Set<string>()
        return Array.isArray(value.notes) && value.notes.length <= 1000 && value.notes.every(note => {
            if (!record(note) || !["id", "title", "body", "color", "updatedAt"].every(key => text(note, key))) return false
            const {id, title, body, color, updatedAt} = note as StickyNote
            if (!id.trim() || id.length > 100 || ids.has(id) || !title.trim() || title.length > 150 || body.length > 10000 || !/^#[a-fA-F0-9]{6}$/.test(color) || !validNoteEmoji(note.emoji) || updatedAt.length > 100 || !Number.isFinite(Date.parse(updatedAt))) return false
            ids.add(id)
            return true
        })
    }
    if (tool === "sdlc") return value.model === "waterfall" && Number.isInteger(value.currentPhase) && Number(value.currentPhase) >= 0 && Number(value.currentPhase) < 6 && flag(value, "completed") && record(value.notes) && Object.values(value.notes).every(note => typeof note === "string")
    if (tool === "ui-editor") return Array.isArray(value.layers) && value.layers.every(layer => record(layer)
        && ["id", "name", "text", "fill", "stroke", "textColor"].every(key => text(layer, key))
        && ["frame", "rectangle", "ellipse", "text", "button"].includes(String(layer.kind))
        && ["x", "y", "width", "height", "radius", "strokeWidth", "opacity", "fontSize"].every(key => number(layer, key))
        && ["hidden", "locked"].every(key => flag(layer, key)))
    const stringList = (items: unknown) => Array.isArray(items) && items.length > 0 && items.length <= 200 && items.every(item => typeof item === "string") && new Set(items).size === items.length
    return (value.dialect === undefined || erdDialects.includes(value.dialect as ErdDialect)) && Array.isArray(value.tables) && Array.isArray(value.relationships) && value.tables.every(table => record(table)
        && ["id", "name"].every(key => text(table, key)) && ["x", "y"].every(key => number(table, key)) && Array.isArray(table.fields)
        && (table.indexes === undefined || Array.isArray(table.indexes) && table.indexes.length <= 200 && table.indexes.every(item => record(item) && text(item, "id") && text(item, "name") && stringList(item.fields) && flag(item, "unique")))
        && (table.checks === undefined || Array.isArray(table.checks) && table.checks.length <= 200 && table.checks.every(item => record(item) && text(item, "id") && text(item, "name") && text(item, "expression")))
        && table.fields.every(field => record(field) && ["id", "name", "length", "defaultValue"].every(key => text(field, key))
            && dataTypes.includes(field.type as DataType) && ["primary", "nullable", "unique"].every(key => flag(field, key)) && (field.autoIncrement === undefined || flag(field, "autoIncrement"))))
        && value.relationships.every(relation => record(relation) && ["id", "fromTable", "fromField", "toTable", "toField"].every(key => text(relation, key))
            && ["1:1", "1:N", "N:1", "N:M"].includes(String(relation.cardinality)) && ["RESTRICT", "CASCADE", "SET NULL"].includes(String(relation.onDelete))
            && ["leftEnd", "rightEnd"].every(key => relation[key] === undefined || relationshipEndTypes.includes(relation[key] as RelationshipEnd))
            && ["fromFields", "toFields"].every(key => relation[key] === undefined || stringList(relation[key]))
            && ["fromAnchor", "toAnchor"].every(key => relation[key] === undefined || record(relation[key]) && ["left", "right", "top", "bottom"].includes(String(relation[key].edge)) && number(relation[key], "offset") && Number(relation[key].offset) >= 0 && Number(relation[key].offset) <= 1))
}

export function relationshipEnds(relation: Pick<ErdRelationship, "cardinality" | "leftEnd" | "rightEnd">): {leftEnd: RelationshipEnd; rightEnd: RelationshipEnd} {
    return {leftEnd: relation.leftEnd ?? (relation.cardinality === "N:1" || relation.cardinality === "N:M" ? "many" : "one"),
        rightEnd: relation.rightEnd ?? (relation.cardinality === "1:N" || relation.cardinality === "N:M" ? "many" : "one")}
}
export function cardinalityForEnds(left: RelationshipEnd, right: RelationshipEnd): ErdRelationship["cardinality"] {
    const many = (end: RelationshipEnd) => end === "many" || end === "zero-many"
    return many(left) ? many(right) ? "N:M" : "N:1" : many(right) ? "1:N" : "1:1"
}
export function relationshipColumns(document: ErdDocument, relation: ErdRelationship) {
    const leftTable = document.tables.find(table => table.id === relation.fromTable), rightTable = document.tables.find(table => table.id === relation.toTable)
    const left = leftTable?.fields.find(field => field.id === relation.fromField), right = rightTable?.fields.find(field => field.id === relation.toField)
    const leftFields = relationshipFieldIds(relation, "from").map(id => leftTable?.fields.find(field => field.id === id))
    const rightFields = relationshipFieldIds(relation, "to").map(id => rightTable?.fields.find(field => field.id === id))
    return relation.cardinality === "N:1" ? {parentTable: rightTable, childTable: leftTable, parent: right, child: left, parents: rightFields, children: leftFields} : {parentTable: leftTable, childTable: rightTable, parent: left, child: right, parents: leftFields, children: rightFields}
}
export function relationshipFieldIds(relation: ErdRelationship, end: "from" | "to") {return end === "from" ? relation.fromFields ?? [relation.fromField] : relation.toFields ?? [relation.toField]}
export function isErdKey(table: ErdTable | undefined, ids: string[]) {
    if (!table || !ids.length) return false
    const same = (fields: string[]) => fields.length === ids.length && fields.every(id => ids.includes(id))
    return same(table.fields.filter(field => field.primary).map(field => field.id)) || ids.length === 1 && table.fields.some(field => field.id === ids[0] && field.unique) || !!table.indexes?.some(index => index.unique && same(index.fields))
}
export function erdFieldLength(field: ErdField) {
    const length = field.length?.replaceAll(/\s/g, "") ?? ""
    if (field.type === "VARCHAR") return length || "255"
    if (field.type === "DECIMAL") return !length ? "10,2" : length.includes(",") ? length : `${length},0`
    return ""
}

export function newField(name = "id"): ErdField {
    return {id: createClientId(), name, type: name === "id" ? "UUID" : "VARCHAR", length: name === "id" ? "" : "255", primary: name === "id", nullable: false, unique: false, defaultValue: ""}
}
export function removeTable(document: ErdDocument, id: string): ErdDocument {
    return {...document, tables: document.tables.filter(table => table.id !== id), relationships: document.relationships.filter(relation => relation.fromTable !== id && relation.toTable !== id)}
}
export function removeField(document: ErdDocument, tableId: string, fieldId: string): ErdDocument {
    return {...document, tables: document.tables.map(table => table.id === tableId ? {...table, fields: table.fields.filter(field => field.id !== fieldId), ...(table.indexes ? {indexes: table.indexes.filter(index => !index.fields.includes(fieldId))} : {})} : table),
        relationships: document.relationships.filter(relation => !(relation.fromTable === tableId && relationshipFieldIds(relation, "from").includes(fieldId) || relation.toTable === tableId && relationshipFieldIds(relation, "to").includes(fieldId)))}
}
export function tableHeight(table: ErdTable) {return 50 + Math.max(1, table.fields.length) * 32}
export function downloadFile(text: string, name: string, mime: string) {
    const url = URL.createObjectURL(new Blob([text], {type: mime}))
    const link = document.createElement("a"); link.href = url; link.download = name; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export {erdSql} from "./erd-schema.ts"

export function designSvg(document: DesignDocument): string {
    const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;")
    const visible = document.layers.filter(layer => !layer.hidden && !document.layers.some(parent => parent.id === layer.parentId && parent.hidden))
    const x = Math.min(0, ...visible.map(layer => layer.x)), y = Math.min(0, ...visible.map(layer => layer.y))
    const width = Math.max(100, ...visible.map(layer => layer.x + layer.width)) - x
    const height = Math.max(100, ...visible.map(layer => layer.y + layer.height)) - y
    const clips: string[] = []
    const shapes = visible.map((layer, index) => {
        const parent = visible.find(item => item.id === layer.parentId)
        if (parent) clips.push(`<clipPath id="clip-${index}"><rect x="${parent.x - layer.x}" y="${parent.y - layer.y}" width="${parent.width}" height="${parent.height}"/></clipPath>`)
        const common = `fill="${layer.kind === "text" ? "none" : layer.fill}" stroke="${layer.stroke}" stroke-width="${layer.strokeWidth}"`
        const shape = layer.kind === "ellipse" ? `<ellipse cx="${layer.width / 2}" cy="${layer.height / 2}" rx="${layer.width / 2}" ry="${layer.height / 2}" ${common}/>` : `<rect width="${layer.width}" height="${layer.height}" rx="${layer.radius}" ${common}/>`
        const text = layer.text ? `<text x="${layer.kind === "button" ? layer.width / 2 : 12}" y="${layer.kind === "button" ? layer.height / 2 + layer.fontSize * .35 : layer.fontSize + 12}" text-anchor="${layer.kind === "button" ? "middle" : "start"}" font-family="Arial, sans-serif" font-size="${layer.fontSize}" fill="${layer.textColor}">${layer.text.split('\n').map((line, index) => `<tspan x="${layer.kind === "button" ? layer.width / 2 : 12}" dy="${index ? layer.fontSize * 1.4 : 0}">${escape(line)}</tspan>`).join("")}</text>` : ""
        return `<g transform="translate(${layer.x} ${layer.y})" opacity="${layer.opacity}"${parent ? ` clip-path="url(#clip-${index})"` : ""}>${shape}${text}</g>`
    }).join("\n")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}">\n<defs>${clips.join("")}</defs>\n${shapes}\n</svg>`
}
