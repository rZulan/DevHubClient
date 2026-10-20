import {cardinalityForEnds, erdFieldLength, isErdKey, relationshipColumns, relationshipEnds, relationshipFieldIds, type ErdDocument, type ErdRelationship} from "./tool-documents.ts"
import {routeErdRelationship, type ErdPort} from "./erd-connection.ts"
import {tableHeight, type ErdAnchor, type ErdTable} from "./tool-documents.ts"

/** Keep the untouched endpoint and logical columns intact when only the attachment moves. */
export function reattachErdEnd(document: ErdDocument, relation: ErdRelationship, end: "from" | "to", target: {tableId: string; anchor: ErdAnchor}): ErdRelationship | undefined {
    const from = document.tables.find(table => table.id === relation.fromTable), to = document.tables.find(table => table.id === relation.toTable)
    const table = document.tables.find(item => item.id === target.tableId)
    if (!from || !to || !table) return
    const route = routeErdRelationship(from, to, relation.fromField, relation.toField, 0, relation)
    const anchor = (table: ErdTable, port: ErdPort): ErdAnchor => ({edge: port.edge, offset: Math.max(0, Math.min(1, port.edge === "left" || port.edge === "right" ? (port.y - table.y) / tableHeight(table) : (port.x - table.x) / 300))})
    const next = {...relation, fromAnchor: relation.fromAnchor ?? anchor(from, route.source), toAnchor: relation.toAnchor ?? anchor(to, route.target),
        ...(end === "from" ? {fromTable: table.id, fromAnchor: target.anchor} : {toTable: table.id, toAnchor: target.anchor})}
    if (table.id === (end === "from" ? from.id : to.id)) return next
    const fieldKey = end === "from" ? "fromField" : "toField"
    // A new table requires an explicit mapping for composite foreign keys.
    if (relationshipFieldIds(relation, end).length > 1) return {...next, [fieldKey]: "", [end === "from" ? "fromFields" : "toFields"]: undefined}
    const candidates = [...table.fields].sort((a, b) => end === "from" ? Number(b.primary || b.unique) - Number(a.primary || a.unique) : Number(a.primary) - Number(b.primary))
    const field = candidates.find(item => !erdRelationshipError(document, {...next, [fieldKey]: item.id}))
    return {...next, [fieldKey]: field?.id ?? ""}
}

export function erdRelationshipError(document: ErdDocument, relation: ErdRelationship) {
    const {parentTable, parents, children} = relationshipColumns(document, relation)
    const left = relationshipFieldIds(relation, "from"), right = relationshipFieldIds(relation, "to")
    if (!parents.length || !children.length || parents.some(field => !field) || children.some(field => !field)) return "Choose a column from each table."
    if (left[0] !== relation.fromField || right[0] !== relation.toField || new Set(left).size !== left.length || new Set(right).size !== right.length) return "Choose distinct columns and keep the first pair as the attachment."
    const ends = relationshipEnds(relation)
    if (cardinalityForEnds(ends.leftEnd, ends.rightEnd) !== relation.cardinality) return "The endpoint symbols must match the relationship cardinality."
    if (relation.fromTable === relation.toTable && left.some((id, index) => id === right[index])) return "Choose two different columns."
    if (relation.cardinality !== "N:M") {
        if (parents.length !== children.length) return "Choose the same number of columns on both sides."
        if (parents.some((field, index) => field!.type !== children[index]!.type)) return "Connected columns must use the same data type."
        if (parents.some((field, index) => erdFieldLength(field!) !== erdFieldLength(children[index]!))) return "Connected columns must use matching lengths and precision."
        if (!isErdKey(parentTable, parents.map(field => field!.id))) return "The referenced columns must be a complete primary or unique key."
        if (relation.onDelete === "SET NULL" && children.some(field => !field!.nullable || field!.primary)) return "SET NULL requires nullable target columns that are not a primary key."
    }
    if (document.relationships.some(item => item.id !== relation.id && item.fromTable === relation.fromTable && item.toTable === relation.toTable && JSON.stringify(relationshipFieldIds(item, "from")) === JSON.stringify(left) && JSON.stringify(relationshipFieldIds(item, "to")) === JSON.stringify(right))) return "These columns are already connected."
    return ""
}

export function suggestErdColumns(document: ErdDocument, fromId: string, toId: string) {
    const from = document.tables.find(table => table.id === fromId), to = document.tables.find(table => table.id === toId)
    if (!from || !to) return {fromField: "", toField: ""}
    const parents = [...from.fields].sort((a, b) => Number(b.primary || b.unique) - Number(a.primary || a.unique))
    const keys = parents.filter(field => isErdKey(from, [field.id]))
    const children = [...to.fields].sort((a, b) => Number(a.primary) - Number(b.primary))
    for (const parent of keys.length ? keys : parents) for (const child of children) {
        if (parent.type !== child.type || fromId === toId && parent.id === child.id) continue
        if (document.relationships.some(item => item.fromTable === fromId && item.fromField === parent.id && item.toTable === toId && item.toField === child.id)) continue
        return {fromField: parent.id, toField: child.id}
    }
    return {fromField: parents[0]?.id ?? "", toField: parents.length ? "" : to.fields[0]?.id ?? ""}
}
