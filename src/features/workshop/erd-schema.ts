import {createClientId} from "../../lib/create-client-id.ts"
import {erdDialectLabels, isErdKey, newField, relationshipColumns, relationshipEnds, relationshipFieldIds, type ErdDialect, type ErdDocument, type ErdField, type ErdRelationship, type RelationshipEnd} from "./tool-documents.ts"
import {erdRelationshipError} from "./erd-relationship-draft.ts"

/** Concise portable type codes for the canvas and visual previews. */
export function erdDisplayType(field: ErdField) {
    const length = field.length.trim()
    return field.type + (field.type === "VARCHAR" ? `(${length || "255"})` : field.type === "DECIMAL" ? `(${length || "10,2"})` : "")
}

/** Database-specific type mapping for SQL export. */
export function erdSqlType(field: ErdField, dialect: ErdDialect = "postgresql") {
    const length = field.length.trim()
    if (dialect === "sqlite") return ({UUID: "TEXT", INT: "INTEGER", BIGINT: "INTEGER", VARCHAR: "TEXT", TEXT: "TEXT", BOOLEAN: "INTEGER", DATE: "TEXT", TIMESTAMP: "TEXT", DECIMAL: "NUMERIC", FLOAT: "REAL", JSON: "TEXT", BLOB: "BLOB"})[field.type]
    if (dialect === "mysql") {
        if (field.type === "UUID") return "CHAR(36)"
        if (field.type === "TIMESTAMP") return "DATETIME"
        if (field.type === "FLOAT") return "DOUBLE"
    }
    if (dialect === "sqlserver") {
        if (field.type === "UUID") return "UNIQUEIDENTIFIER"
        if (field.type === "BOOLEAN") return "BIT"
        if (field.type === "TIMESTAMP") return "DATETIME2"
        if (field.type === "TEXT" || field.type === "JSON") return "NVARCHAR(MAX)"
        if (field.type === "BLOB") return "VARBINARY(MAX)"
        if (field.type === "VARCHAR") return `NVARCHAR(${length || "255"})`
    }
    if (dialect === "postgresql" && field.type === "BLOB") return "BYTEA"
    if (dialect === "postgresql" && field.type === "FLOAT") return "DOUBLE PRECISION"
    return field.type + (field.type === "VARCHAR" ? `(${length || "255"})` : field.type === "DECIMAL" ? `(${length || "10,2"})` : "")
}

export function erdSchemaIssues(document: ErdDocument): string[] {
    const errors: string[] = [], dialect = document.dialect ?? "postgresql"
    const duplicates = (names: string[]) => new Set(names.map(name => name.trim().toLowerCase())).size !== names.length
    if (duplicates(document.tables.map(table => table.name))) errors.push("Table names must be unique.")
    for (const table of document.tables) {
        const maxName = dialect === "mysql" ? 64 : dialect === "postgresql" ? 63 : dialect === "sqlserver" ? 128 : Infinity
        for (const name of [table.name, ...table.fields.map(field => field.name), ...(table.indexes ?? []).map(index => index.name), ...(table.checks ?? []).map(check => check.name)]) {
            if ((dialect === "postgresql" ? new TextEncoder().encode(name).length : name.length) > maxName) errors.push(`${name}: identifiers exceed this database's ${maxName} ${dialect === "postgresql" ? "byte" : "character"} limit.`)
        }
        if (!table.name.trim() || !table.fields.length) errors.push(`${table.name || "Table"}: add a name and at least one column.`)
        if (duplicates(table.fields.map(field => field.name))) errors.push(`${table.name}: column names must be unique.`)
        const generated = table.fields.filter(field => field.autoIncrement)
        if (generated.length > 1) errors.push(`${table.name}: use only one generated ID column.`)
        for (const field of table.fields) {
            const name = `${table.name}.${field.name}`
            if (!field.name.trim()) errors.push(`${table.name}: column names cannot be empty.`)
            if (field.type === "VARCHAR" && field.length && (!/^\d+$/.test(field.length) || Number(field.length) < 1 || Number(field.length) > (dialect === "sqlserver" ? 4000 : dialect === "mysql" ? 16383 : 10485760))) errors.push(`${name}: enter a valid positive text length for this database.`)
            if (field.type === "DECIMAL" && field.length) {
                const match = field.length.match(/^(\d+)(?:,\s*(\d+))?$/), precision = Number(match?.[1]), scale = Number(match?.[2] ?? 0)
                if (!match || precision < 1 || precision > (dialect === "sqlserver" ? 38 : dialect === "mysql" ? 65 : 1000) || scale > precision || dialect === "mysql" && scale > 30) errors.push(`${name}: enter valid decimal precision and scale.`)
            }
            if (field.primary && field.nullable) errors.push(`${name}: primary keys cannot be nullable.`)
            if (field.autoIncrement && (!["INT", "BIGINT"].includes(field.type) || field.nullable || field.defaultValue.trim() || dialect === "mysql" && !isErdKey(table, [field.id]) || dialect === "sqlite" && (!field.primary || table.fields.filter(item => item.primary).length !== 1))) errors.push(`${name}: generated IDs need a non-null integer, no default, and ${dialect === "sqlite" ? "a single-column primary key" : dialect === "mysql" ? "a primary or unique key" : "a valid integer type"}.`)
        }
        if (duplicates([...(table.indexes ?? []).map(index => index.name), ...(table.checks ?? []).map(check => check.name)])) errors.push(`${table.name}: constraint and index names must be unique.`)
        for (const index of table.indexes ?? []) if (!index.name.trim() || !index.fields.length || index.fields.some(id => !table.fields.some(field => field.id === id))) errors.push(`${table.name}: each index needs a name and existing columns.`)
        for (const check of table.checks ?? []) if (!check.name.trim() || !check.expression.trim()) errors.push(`${table.name}: each check needs a name and SQL expression.`)
        if (dialect === "mysql" || dialect === "sqlserver") {
            const keyed = new Set([...table.fields.filter(field => field.primary || field.unique).map(field => field.id), ...(table.indexes ?? []).flatMap(index => index.fields)])
            for (const field of table.fields) if (keyed.has(field.id) && ["TEXT", "JSON", "BLOB"].includes(field.type)) errors.push(`${table.name}.${field.name}: choose a bounded type before using this column in a key or index.`)
        }
    }
    const indexNames = document.tables.flatMap(table => (table.indexes ?? []).map(index => index.name))
    if ((dialect === "postgresql" || dialect === "sqlite") && duplicates(indexNames)) errors.push("Index names must be unique across the diagram for this database.")
    if (dialect === "sqlserver" && duplicates(document.tables.flatMap(table => [...(table.indexes ?? []).filter(index => index.unique).map(index => index.name), ...(table.checks ?? []).map(check => check.name)]))) errors.push("Constraint names must be unique across the diagram for SQL Server.")
    for (const relation of document.relationships) {
        const {parentTable, childTable} = relationshipColumns(document, relation)
        const label = `${parentTable?.name ?? "Missing table"} → ${childTable?.name ?? "Missing table"}`
        if (relation.cardinality === "N:M") {errors.push(`${label}: create a junction table before exporting SQL.`); continue}
        const relationshipError = erdRelationshipError(document, relation)
        if (relationshipError) {errors.push(`${label}: ${relationshipError}`); continue}
    }
    return [...new Set(errors)]
}

export function erdSql(document: ErdDocument): string {
    const errors = erdSchemaIssues(document)
    if (errors.length) throw new Error(errors.join("\n"))
    const dialect = document.dialect ?? "postgresql"
    const quote = (value: string) => dialect === "mysql" ? "`" + value.replaceAll("`", "``") + "`" : dialect === "sqlserver" ? "[" + value.replaceAll("]", "]]") + "]" : '"' + value.replaceAll('"', '""') + '"'
    const list = (fields: (ErdField | undefined)[]) => fields.map(field => quote(field!.name)).join(", ")
    const deferred: string[] = [], indexes: string[] = []
    const statements = document.tables.map(table => {
        const inlineId = dialect === "sqlite" && table.fields.find(field => field.autoIncrement)
        const columns = table.fields.map(field => {
            const generation = !field.autoIncrement ? "" : dialect === "postgresql" ? " GENERATED BY DEFAULT AS IDENTITY" : dialect === "mysql" ? " AUTO_INCREMENT" : dialect === "sqlserver" ? " IDENTITY(1,1)" : " PRIMARY KEY AUTOINCREMENT"
            let defaultValue = field.defaultValue.trim()
            if (field.type === "BOOLEAN" && (dialect === "sqlserver" || dialect === "sqlite") && /^(true|false)$/i.test(defaultValue)) defaultValue = defaultValue.toLowerCase() === "true" ? "1" : "0"
            return `  ${quote(field.name)} ${erdSqlType(field, dialect)}${generation}${field.nullable && !field.primary ? "" : " NOT NULL"}${field.unique ? " UNIQUE" : ""}${defaultValue ? ` DEFAULT ${defaultValue}` : ""}`
        })
        const primary = table.fields.filter(field => field.primary)
        if (primary.length && !inlineId) columns.push(`  PRIMARY KEY (${list(primary)})`)
        for (const index of table.indexes ?? []) {
            const fields = index.fields.map(id => table.fields.find(field => field.id === id))
            if (index.unique) columns.push(`  CONSTRAINT ${quote(index.name)} UNIQUE (${list(fields)})`)
            else indexes.push(`CREATE INDEX ${quote(index.name)} ON ${quote(table.name)} (${list(fields)});`)
        }
        for (const check of table.checks ?? []) columns.push(`  CONSTRAINT ${quote(check.name)} CHECK (${check.expression.trim()})`)
        for (const relation of document.relationships) {
            const {parentTable, childTable, parents, children} = relationshipColumns(document, relation)
            if (childTable?.id !== table.id) continue
            if (relation.cardinality === "1:1" && !isErdKey(table, children.map(field => field!.id))) {
                const unique = `UNIQUE (${list(children)})`
                if (dialect === "sqlite") columns.push(`  ${unique}`); else deferred.push(`ALTER TABLE ${quote(table.name)} ADD ${unique};`)
            }
            const action = dialect === "sqlserver" && relation.onDelete === "RESTRICT" ? "NO ACTION" : relation.onDelete
            const foreign = `FOREIGN KEY (${list(children)}) REFERENCES ${quote(parentTable!.name)} (${list(parents)}) ON DELETE ${action}`
            if (dialect === "sqlite") columns.push(`  ${foreign}`); else deferred.push(`ALTER TABLE ${quote(table.name)} ADD ${foreign};`)
        }
        return `CREATE TABLE ${quote(table.name)} (\n${columns.join(",\n")}\n);`
    })
    return `-- DevHub ERD · ${erdDialectLabels[dialect]}\n${dialect === "sqlite" ? "-- Enable foreign key enforcement on every SQLite connection.\nPRAGMA foreign_keys = ON;\n" : ""}\n${[...statements, ...deferred, ...indexes].join("\n\n")}`
}

/** Replace the conceptual N:M edge with an editable physical junction and two FKs. */
export function createErdJunction(document: ErdDocument, relation: ErdRelationship, requestedName?: string): ErdDocument {
    const replacing = document.relationships.some(item => item.id === relation.id)
    if (relation.cardinality !== "N:M" || document.tables.length >= 500 || document.relationships.length - Number(replacing) + 2 > 2000) throw new Error("Cannot add a junction table: check the 500-table and 2,000-relationship limits.")
    const from = document.tables.find(table => table.id === relation.fromTable), to = document.tables.find(table => table.id === relation.toTable)
    const key = (table: typeof from, selected: string[]) => isErdKey(table, selected) ? selected : table?.fields.filter(field => field.primary).map(field => field.id) ?? []
    const fromIds = key(from, relationshipFieldIds(relation, "from")), toIds = key(to, relationshipFieldIds(relation, "to"))
    if (!from || !to || !isErdKey(from, fromIds) || !isErdKey(to, toIds)) throw new Error("Both tables need a primary or unique key before creating a junction table.")
    if (fromIds.length + toIds.length > 200) throw new Error("The combined keys exceed the junction table's 200-column limit.")
    const fields: ErdField[] = [], names = new Set<string>()
    const copy = (table: typeof from, ids: string[]) => ids.map(id => {
        const original = table!.fields.find(field => field.id === id)!
        const base = `${table!.name}_${original.name}`.slice(0, 130)
        let name = base, suffix = 2
        while (names.has(name)) name = `${base}_${suffix++}`
        names.add(name)
        const field = {...newField(name), type: original.type, length: original.length, primary: true}
        fields.push(field); return field.id
    })
    const left = copy(from, fromIds), right = copy(to, toIds), base = `${from.name}_${to.name}`.slice(0, 130)
    let name = base, suffix = 2
    while (document.tables.some(table => table.name.toLowerCase() === name.toLowerCase())) name = `${base}_${suffix++}`
    if (requestedName !== undefined) {
        name = requestedName.trim()
        if (!name || name.length > 150) throw new Error("Enter a junction table name of up to 150 characters.")
        if (document.tables.some(table => table.name.toLowerCase() === name.toLowerCase())) throw new Error("A table with this name already exists.")
    }
    const table = {id: createClientId(), name, x: (from.x + to.x) / 2, y: Math.max(from.y + 50 + from.fields.length * 32, to.y + 50 + to.fields.length * 32) + 100, fields}
    const ends = relationshipEnds(relation)
    const many = (end: RelationshipEnd) => end === "zero-many" ? "zero-many" : "many"
    const connect = (parent: typeof from, parents: string[], children: string[], rightEnd: RelationshipEnd, fromAnchor?: ErdRelationship["fromAnchor"]): ErdRelationship => ({id: createClientId(), fromTable: parent!.id, fromField: parents[0], toTable: table.id, toField: children[0], ...(parents.length > 1 ? {fromFields: parents, toFields: children} : {}), cardinality: "1:N", leftEnd: "one", rightEnd, ...(fromAnchor ? {fromAnchor} : {}), onDelete: relation.onDelete === "SET NULL" ? "RESTRICT" : relation.onDelete})
    return {...document, tables: [...document.tables, table], relationships: [...document.relationships.filter(item => item.id !== relation.id), connect(from, fromIds, left, many(ends.rightEnd), relation.fromAnchor), connect(to, toIds, right, many(ends.leftEnd), relation.toAnchor)]}
}
