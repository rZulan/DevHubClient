import {relationshipColumns, type ErdDocument} from "./tool-documents.ts"

/** Resolve foreign keys once per schema change, rather than scanning the graph for every row. */
export function erdRenderIndex(document: ErdDocument) {
    const tables = new Map(document.tables.map(table => [table.id, table]))
    const foreignKeys = new Map(document.tables.map(table => [table.id, new Set<string>()]))
    for (const relation of document.relationships) {
        if (relation.cardinality === "N:M") continue
        const {childTable, children} = relationshipColumns(document, relation)
        if (childTable) for (const field of children) if (field) foreignKeys.get(childTable.id)?.add(field.id)
    }
    return {tables, foreignKeys}
}
