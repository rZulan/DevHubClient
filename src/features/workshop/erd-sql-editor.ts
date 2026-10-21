import {importErdSql, maxErdImportBytes, validateErdImport, type ErdImportResult} from "./erd-import.ts"
import {erdSchemaIssues, erdSql} from "./erd-schema.ts"
import {cardinalityForEnds, relationshipColumns, relationshipEnds, relationshipFieldIds, tableHeight, type ErdDocument, type ErdField, type ErdRelationship} from "./tool-documents.ts"

const nameKey = (name: string) => name.toLowerCase()
const fieldShape = ({type, length, primary, nullable, unique, defaultValue, autoIncrement}: ErdField) =>
    JSON.stringify([type, length, primary, nullable, unique, defaultValue, !!autoIncrement])

/** Reuse identities for names, and for unambiguous structural renames. */
function matches<T extends {id: string; name: string}>(next: T[], previous: T[], shape: (item: T) => string, oldShape = shape) {
    const result = new Map<string, T>(), used = new Set<string>()
    for (const item of next) {
        const old = previous.find(value => nameKey(value.name) === nameKey(item.name) && !used.has(value.id))
        if (old) {result.set(item.id, old); used.add(old.id)}
    }
    const remaining = next.filter(item => !result.has(item.id))
    for (const item of remaining) {
        const signature = shape(item)
        const candidates = previous.filter(old => !used.has(old.id) && oldShape(old) === signature)
        if (candidates.length === 1 && remaining.filter(value => shape(value) === signature).length === 1) {
            result.set(item.id, candidates[0]); used.add(candidates[0].id)
        }
    }
    return result
}

export function prepareErdSql(source: string, current: ErdDocument): ErdImportResult {
    if (new TextEncoder().encode(source).length > maxErdImportBytes) throw new Error("Keep the SQL schema smaller than 4 MB.")
    const dialect = current.dialect ?? "postgresql"
    const sqlTypes = new Map<string, Map<string, string>>(), baselineTypes = new Map<string, Map<string, string>>()
    // Empty/comment-only SQL is an intentional empty schema, not a parse failure.
    const empty = !source.replace(/--[^\r\n]*|\/\*[\s\S]*?\*\//g, "").trim()
    const parsed = empty ? {document: {dialect, tables: [], relationships: []} as ErdDocument, warnings: []} : importErdSql(source, dialect, {strict: true, sqlTypes})
    if (parsed.warnings.some(message => /skipped|statements other than/i.test(message))) {
        throw new Error("Use CREATE TABLE definitions and supported key/index constraints. This SQL contains statements the diagram cannot apply.")
    }
    const issues = erdSchemaIssues(parsed.document)
    if (issues.length) throw new Error(issues.join("\n"))

    // SQL dialects can export a portable type as another physical type (e.g.
    // UUID -> CHAR(36) in MySQL). Compare with that same round trip before
    // changing existing portable types or their original default expressions.
    let baseline: ErdDocument | undefined
    try {if (current.tables.length) baseline = importErdSql(erdSql(current), dialect, {sqlTypes: baselineTypes}).document} catch { /* A new valid schema can repair an unexportable diagram. */ }
    const tableShape = (table: ErdDocument["tables"][number]) => JSON.stringify(table.fields.map(fieldShape).sort())
    const tableMatches = matches(parsed.document.tables, current.tables, tableShape, table => tableShape(baseline?.tables.find(value => nameKey(value.name) === nameKey(table.name)) ?? table))
    const tableIds = new Map<string, string>(), fieldIds = new Map<string, string>()
    const newFields = new Set<string>(), physicalTypes = new Map<string, string>(), portableTypes = new Map<string, Pick<ErdField, "type" | "length">>()
    let nextY = Math.max(60, ...[...tableMatches.values()].map(table => table.y + tableHeight(table) + 100)), column = 0, rowHeight = 0
    const tables = parsed.document.tables.map(table => {
        const old = tableMatches.get(table.id)
        const base = baseline?.tables.find(value => nameKey(value.name) === nameKey(old?.name ?? ""))
        const oldFieldShape = (field: ErdField) => fieldShape(base?.fields.find(value => nameKey(value.name) === nameKey(field.name)) ?? field)
        const fieldsMatched = matches(table.fields, old?.fields ?? [], fieldShape, oldFieldShape)
        const fields = table.fields.map(field => {
            const previous = fieldsMatched.get(field.id)
            const original = base?.fields.find(value => nameKey(value.name) === nameKey(previous?.name ?? ""))
            const sameSqlType = !!old && !!previous && sqlTypes.get(nameKey(table.name))?.get(nameKey(field.name)) === baselineTypes.get(nameKey(old.name))?.get(nameKey(previous.name))
            const fieldKey = `${old?.id ?? table.id}:${previous?.id ?? field.id}`
            physicalTypes.set(fieldKey, sqlTypes.get(nameKey(table.name))?.get(nameKey(field.name)) ?? "")
            if (!previous) newFields.add(fieldKey)
            else if (sameSqlType && original?.type === field.type && original.length === field.length) portableTypes.set(fieldKey, {type: previous.type, length: previous.length})
            fieldIds.set(`${table.id}:${field.id}`, previous?.id ?? field.id)
            if (!previous) return field
            if (original && sameSqlType && fieldShape(original) === fieldShape(field)) return {...previous, name: field.name}
            return {...field, id: previous.id,
                ...(sameSqlType && original?.type === field.type && original.length === field.length ? {type: previous.type, length: previous.length} : {}),
                ...(original?.defaultValue === field.defaultValue ? {defaultValue: previous.defaultValue} : {}),
            }
        })
        tableIds.set(table.id, old?.id ?? table.id)
        const indexes = table.indexes?.map(index => ({...index, id: old?.indexes?.find(value => nameKey(value.name) === nameKey(index.name))?.id ?? index.id, fields: index.fields.map(id => fieldIds.get(`${table.id}:${id}`)!)}))
        const checks = table.checks?.map(check => ({...check, id: old?.checks?.find(value => nameKey(value.name) === nameKey(check.name))?.id ?? check.id}))
        const position = old ? {x: old.x, y: old.y} : {x: 80 + column * 400, y: nextY}
        if (!old) {
            rowHeight = Math.max(rowHeight, tableHeight(table)); column++
            if (column === 3) {column = 0; nextY += rowHeight + 100; rowHeight = 0}
        }
        return {...table, ...position, id: old?.id ?? table.id, fields, indexes, checks}
    })
    // A newly added FK using the same physical SQL type should inherit an
    // existing endpoint's portable type (e.g. SQLite TEXT used for UUIDs).
    const neighbors = new Map<string, string[]>(), fieldsById = new Map<string, ErdField>(tables.flatMap(table => table.fields.map(field => [`${table.id}:${field.id}`, field] as const)))
    for (const relation of parsed.document.relationships) {
        const from = relationshipFieldIds(relation, "from"), to = relationshipFieldIds(relation, "to")
        from.forEach((id, index) => {
            const left = `${tableIds.get(relation.fromTable)}:${fieldIds.get(`${relation.fromTable}:${id}`)}`
            const right = `${tableIds.get(relation.toTable)}:${fieldIds.get(`${relation.toTable}:${to[index]}`)}`
            neighbors.set(left, [...(neighbors.get(left) ?? []), right]); neighbors.set(right, [...(neighbors.get(right) ?? []), left])
        })
    }
    const queue = [...portableTypes.keys()]
    for (let i = 0; i < queue.length; i++) for (const target of neighbors.get(queue[i]) ?? []) {
        if (!newFields.has(target) || portableTypes.has(target) || physicalTypes.get(target) !== physicalTypes.get(queue[i])) continue
        const type = portableTypes.get(queue[i])!
        Object.assign(fieldsById.get(target)!, type); portableTypes.set(target, type); queue.push(target)
    }
    const sameEnd = (a: ErdRelationship, b: ErdRelationship, end: "from" | "to", other = end) =>
        a[`${end}Table`] === b[`${other}Table`] && JSON.stringify(relationshipFieldIds(a, end)) === JSON.stringify(relationshipFieldIds(b, other))
    const usedRelations = new Set<string>()
    const relationships = parsed.document.relationships.map(relation => {
        const next = {...relation, fromTable: tableIds.get(relation.fromTable)!, toTable: tableIds.get(relation.toTable)!,
            fromField: fieldIds.get(`${relation.fromTable}:${relation.fromField}`)!, toField: fieldIds.get(`${relation.toTable}:${relation.toField}`)!,
            ...(relation.fromFields ? {fromFields: relation.fromFields.map(id => fieldIds.get(`${relation.fromTable}:${id}`)!)} : {}),
            ...(relation.toFields ? {toFields: relation.toFields.map(id => fieldIds.get(`${relation.toTable}:${id}`)!)} : {}),
        }
        const previous = current.relationships.find(old => !usedRelations.has(old.id) && (sameEnd(old, next, "from") && sameEnd(old, next, "to") || sameEnd(old, next, "from", "to") && sameEnd(old, next, "to", "from")))
        if (!previous) return next
        usedRelations.add(previous.id)
        const reversed = !(sameEnd(previous, next, "from") && sameEnd(previous, next, "to"))
        const parsedEnds = relationshipEnds(next)
        const alignedEnds = reversed ? {leftEnd: parsedEnds.rightEnd, rightEnd: parsedEnds.leftEnd} : parsedEnds
        const oldNullable = relationshipColumns(current, previous).children.some(field => field?.nullable)
        const newNullable = relationshipColumns({tables, relationships: []}, next).children.some(field => field?.nullable)
        const ends = previous.cardinality === cardinalityForEnds(alignedEnds.leftEnd, alignedEnds.rightEnd) && oldNullable === newNullable ? relationshipEnds(previous) : alignedEnds
        return {...next, id: previous.id, ...(reversed ? {fromTable: next.toTable, toTable: next.fromTable, fromField: next.toField, toField: next.fromField, ...(next.toFields ? {fromFields: next.toFields} : {}), ...(next.fromFields ? {toFields: next.fromFields} : {})} : {}),
            ...ends, cardinality: cardinalityForEnds(ends.leftEnd, ends.rightEnd), ...(previous.fromAnchor ? {fromAnchor: previous.fromAnchor} : {}), ...(previous.toAnchor ? {toAnchor: previous.toAnchor} : {})}
    })
    const document = {dialect, tables, relationships}
    validateErdImport(document)
    return {document, warnings: parsed.warnings}
}
