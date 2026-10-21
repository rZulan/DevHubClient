import {createClientId} from "../../lib/create-client-id.ts"
import {cardinalityForEnds, dataTypes, isErdKey, newField, relationshipEnds, relationshipEndTypes, validToolDocument, type DataType, type ErdDialect, type ErdDocument, type ErdField, type ErdRelationship} from "./tool-documents.ts"
import {erdRelationshipError} from "./erd-relationship-draft.ts"

export type ErdImportResult = {document: ErdDocument; warnings: string[]}
export const maxErdImportBytes = 4_000_000
export function validateErdImport(value: unknown): asserts value is ErdDocument {
    if (!validToolDocument("erd", value)) throw new Error("This JSON is not a valid ERD draft. Choose a draft downloaded from the ERD maker.")
    const document = value as ErdDocument
    if (JSON.stringify(document).length > maxErdImportBytes || document.tables.length > 500 || document.relationships.length > 2000) throw new Error("The ERD exceeds the supported document size (500 tables, 2,000 relationships).")
    const tables = new Map<string, Map<string, ErdField>>()
    const text = (value: string, max: number, name: string, required = false) => {
        if (value.length > max || required && !value.trim()) throw new Error(`Invalid ${name} in the ERD draft.`)
    }
    for (const table of document.tables) {
        text(table.id, 100, "table ID", true); text(table.name, 150, "table name", true)
        if (tables.has(table.id) || table.fields.length > 200 || Math.abs(table.x) > 1_000_000 || Math.abs(table.y) > 1_000_000) throw new Error(`Invalid or duplicate table: ${table.name}.`)
        const fields = new Map<string, ErdField>()
        for (const field of table.fields) {
            text(field.id, 100, "column ID", true); text(field.name, 150, "column name", true); text(field.length, 30, "column length"); text(field.defaultValue, 500, "column default")
            if (fields.has(field.id) || !dataTypes.includes(field.type)) throw new Error(`Invalid or duplicate column in ${table.name}.`)
            fields.set(field.id, field)
        }
        const constraintIds = new Set<string>()
        for (const item of [...(table.indexes ?? []), ...(table.checks ?? [])]) {
            text(item.id, 100, "constraint ID", true); text(item.name, 150, "constraint name", true)
            if (constraintIds.has(item.id)) throw new Error("Duplicate constraint ID.")
            constraintIds.add(item.id)
            if ("fields" in item && item.fields.some(id => !fields.has(id))) throw new Error("An index references a missing column.")
            if ("expression" in item) text(item.expression, 2000, "check expression", true)
        }
        tables.set(table.id, fields)
    }
    const ids = new Set<string>()
    for (const relation of document.relationships) {
        text(relation.id, 100, "relationship ID", true)
        const left = tables.get(relation.fromTable)?.get(relation.fromField), right = tables.get(relation.toTable)?.get(relation.toField)
        if (ids.has(relation.id) || !left || !right || relation.fromTable === relation.toTable && relation.fromField === relation.toField) throw new Error("The ERD contains a duplicate or dangling relationship.")
        ids.add(relation.id)
        const ends = relationshipEnds(relation)
        if (cardinalityForEnds(ends.leftEnd, ends.rightEnd) !== relation.cardinality) throw new Error("A relationship's endpoint symbols do not match its cardinality.")
        if ([relation.leftEnd, relation.rightEnd].some(end => end !== undefined && !relationshipEndTypes.includes(end))) throw new Error("Invalid relationship endpoint symbol.")
        const error = erdRelationshipError(document, relation)
        if (error) throw new Error(error)
    }
}
export function importErdJson(source: string): ErdImportResult {
    let value: unknown
    try {value = JSON.parse(source)} catch {throw new Error("The JSON file could not be parsed. Check its syntax and try again.")}
    if (value && typeof value === "object" && "document" in value) value = value.document
    validateErdImport(value)
    return {document: value, warnings: []}
}

type Token = {value: string; raw: string; start: number; end: number; kind: "word" | "quoted" | "string" | "symbol"}
function tokenize(source: string): Token[] {
    const tokens: Token[] = []
    let position = 0
    while (position < source.length) {
        const start = position, character = source[position]
        if (/\s/.test(character)) {position++; continue}
        if (source.startsWith("--", position)) {while (position < source.length && source[position] !== "\n") position++; continue}
        if (source.startsWith("/*", position)) {
            position += 2; let depth = 1
            while (position < source.length && depth) {
                if (source.startsWith("/*", position)) {depth++; position += 2}
                else if (source.startsWith("*/", position)) {depth--; position += 2}
                else position++
            }
            if (depth) throw new Error("The SQL contains an unclosed block comment.")
            continue
        }
        if (["'", '"', "`", "["].includes(character)) {
            const closing = character === "[" ? "]" : character
            position++; let value = "", closed = false
            while (position < source.length) {
                if (source[position] === closing) {
                    if (source[position + 1] === closing) {value += closing; position += 2; continue}
                    position++; closed = true; break
                }
                if (character === "'" && source[position] === "\\" && position + 1 < source.length) {value += source.slice(position, position + 2); position += 2}
                else value += source[position++]
            }
            if (!closed) throw new Error("The SQL contains an unclosed quoted identifier or string.")
            tokens.push({value, raw: source.slice(start, position), start, end: position, kind: character === "'" ? "string" : "quoted"}); continue
        }
        const dollar = source.slice(position).match(/^\$(?:[a-zA-Z_][\w]*)?\$/)?.[0]
        if (dollar) {
            const end = source.indexOf(dollar, position + dollar.length)
            if (end < 0) throw new Error("The SQL contains an unclosed dollar-quoted value.")
            position = end + dollar.length; tokens.push({value: source.slice(start, position), raw: source.slice(start, position), start, end: position, kind: "string"}); continue
        }
        const word = source.slice(position).match(/^[\w$]+/)?.[0]
        if (word) {
            position += word.length
            // SQL Server's GO separates batches when it occurs on its own line.
            const batch = word.toUpperCase() === "GO" && !source.slice(source.lastIndexOf("\n", start - 1) + 1, start).trim() && /^\s*(?:--[^\n]*)?(?:\r?\n|$)/.test(source.slice(position))
            tokens.push({value: batch ? ";" : word, raw: word, start, end: position, kind: batch ? "symbol" : "word"}); continue
        }
        position++; tokens.push({value: character, raw: character, start, end: position, kind: "symbol"})
    }
    return tokens
}
const keyword = (token: Token | undefined, value: string) => token?.kind === "word" && token.value.toUpperCase() === value
function split(tokens: Token[], delimiter: string): Token[][] {
    const groups: Token[][] = []; let current: Token[] = [], depth = 0
    for (const token of tokens) {
        if (token.value === "(" && token.kind === "symbol") depth++
        if (token.value === ")" && token.kind === "symbol") depth--
        if (depth < 0) throw new Error("The SQL contains mismatched parentheses.")
        if (token.value === delimiter && token.kind === "symbol" && depth === 0) {if (current.length) groups.push(current); current = []}
        else current.push(token)
    }
    if (depth) throw new Error("The SQL contains mismatched parentheses.")
    if (current.length) groups.push(current)
    return groups
}
function identifier(tokens: Token[], index: number): {name: string; next: number} {
    const parts: string[] = []
    while (true) {
        const token = tokens[index]
        if (!token || !["word", "quoted"].includes(token.kind)) throw new Error("Expected a table or column name in the SQL schema.")
        parts.push(token.value); index++
        if (tokens[index]?.value !== ".") break
        index++
    }
    return {name: parts.join("."), next: index}
}
function parenthesized(tokens: Token[], index: number): {body: Token[]; next: number} {
    if (tokens[index]?.value !== "(") throw new Error("Expected a parenthesized column list in the SQL schema.")
    const start = ++index; let depth = 1
    while (index < tokens.length && depth) {
        if (tokens[index].kind === "symbol") {if (tokens[index].value === "(") depth++; if (tokens[index].value === ")") depth--}
        if (depth) index++
    }
    if (depth) throw new Error("The SQL contains an unclosed column list.")
    return {body: tokens.slice(start, index), next: index + 1}
}
function names(tokens: Token[], index: number) {
    const group = parenthesized(tokens, index)
    return {...group, names: split(group.body, ",").map(part => identifier(part, 0).name)}
}
type ForeignKey = {table: string; fields: string[]; parent: string; parentFields: string[]; onDelete: ErdRelationship["onDelete"]}
type Key = {table: string; fields: string[]; primary: boolean; name?: string; unique?: boolean}
function validateColumnAttributes(tokens: Token[], start: number, label: string) {
    const starters = ["NOT", "NULL", "PRIMARY", "UNIQUE", "REFERENCES", "CONSTRAINT", "CHECK", "COLLATE", "GENERATED", "COMMENT", "AUTO_INCREMENT", "AUTOINCREMENT"]
    for (let i = start; i < tokens.length;) {
        const token = tokens[i]
        if (keyword(token, "NOT") && keyword(tokens[i + 1], "NULL") || keyword(token, "PRIMARY") && keyword(tokens[i + 1], "KEY")) {i += 2; continue}
        if (["NULL", "UNIQUE", "AUTO_INCREMENT", "AUTOINCREMENT", "UNSIGNED", "ZEROFILL"].some(word => keyword(token, word))) {i++; continue}
        if (keyword(token, "IDENTITY")) {i++; if (tokens[i]?.value === "(") i = parenthesized(tokens, i).next; continue}
        if (keyword(token, "CONSTRAINT") || keyword(token, "COLLATE")) {i = identifier(tokens, i + 1).next; continue}
        if (keyword(token, "COMMENT") && tokens[i + 1]?.kind === "string") {i += 2; continue}
        if ((keyword(token, "WITH") || keyword(token, "WITHOUT")) && keyword(tokens[i + 1], "TIME") && keyword(tokens[i + 2], "ZONE")) {i += 3; continue}
        if (keyword(token, "CHECK")) {i = parenthesized(tokens, i + 1).next; continue}
        if (keyword(token, "GENERATED")) {
            i++
            if (keyword(tokens[i], "BY") && keyword(tokens[i + 1], "DEFAULT")) i += 2
            else if (keyword(tokens[i], "ALWAYS")) i++
            if (!keyword(tokens[i], "AS") || !keyword(tokens[i + 1], "IDENTITY")) throw new Error(`${label}: only generated integer identities are supported.`)
            i += 2; if (tokens[i]?.value === "(") i = parenthesized(tokens, i).next
            continue
        }
        if (keyword(token, "REFERENCES")) {
            const table = identifier(tokens, i + 1); i = names(tokens, table.next).next
            while (keyword(tokens[i], "ON") && (keyword(tokens[i + 1], "DELETE") || keyword(tokens[i + 1], "UPDATE"))) {
                i += 2
                if (keyword(tokens[i], "SET") || keyword(tokens[i], "NO")) i += 2
                else if (keyword(tokens[i], "CASCADE") || keyword(tokens[i], "RESTRICT")) i++
                else throw new Error(`${label}: invalid foreign key action.`)
            }
            continue
        }
        if (keyword(token, "DEFAULT") || keyword(token, "ON") && keyword(tokens[i + 1], "UPDATE")) {
            i += keyword(token, "ON") ? 2 : 1
            const expressionStart = i; let depth = 0
            for (; i < tokens.length; i++) {
                if (depth === 0 && i > expressionStart && starters.some(word => keyword(tokens[i], word))) break
                if (tokens[i].kind === "symbol") {if (tokens[i].value === "(") depth++; if (tokens[i].value === ")") depth--}
            }
            if (i === expressionStart) throw new Error(`${label}: missing default expression.`)
            continue
        }
        throw new Error(`${label}: unexpected ${token.raw}. Separate column definitions with commas.`)
    }
}

export function importErdSql(source: string, dialect: ErdDialect = "postgresql", options: {strict?: boolean; sqlTypes?: Map<string, Map<string, string>>} = {}): ErdImportResult {
    const document: ErdDocument = {dialect, tables: [], relationships: []}, warnings = new Set<string>(), keys: Key[] = [], foreignKeys: ForeignKey[] = []
    const checks: {table: string; name?: string; expression: string}[] = []
    const aliases: Record<string, DataType> = {
        UUID: "UUID", UNIQUEIDENTIFIER: "UUID", INT: "INT", INTEGER: "INT", SMALLINT: "INT", TINYINT: "INT", MEDIUMINT: "INT", INT1: "INT", INT2: "INT", INT3: "INT", INT4: "INT", INT8: "BIGINT",
        SERIAL: "INT", SMALLSERIAL: "INT", SERIAL2: "INT", SERIAL4: "INT", BIGINT: "BIGINT", BIGSERIAL: "BIGINT", SERIAL8: "BIGINT",
        VARCHAR: "VARCHAR", VARCHAR2: "VARCHAR", NVARCHAR: "VARCHAR", CHAR: "VARCHAR", NCHAR: "VARCHAR", CHARACTER: "VARCHAR", BPCHAR: "VARCHAR", SYSNAME: "VARCHAR",
        TEXT: "TEXT", TINYTEXT: "TEXT", MEDIUMTEXT: "TEXT", LONGTEXT: "TEXT", NTEXT: "TEXT", CLOB: "TEXT", NCLOB: "TEXT", CITEXT: "TEXT", XML: "TEXT", ENUM: "VARCHAR", SET: "VARCHAR",
        BOOL: "BOOLEAN", BOOLEAN: "BOOLEAN", BIT: "BOOLEAN", DATE: "DATE", TIMESTAMP: "TIMESTAMP", TIMESTAMPTZ: "TIMESTAMP", DATETIME: "TIMESTAMP", DATETIME2: "TIMESTAMP", SMALLDATETIME: "TIMESTAMP", DATETIMEOFFSET: "TIMESTAMP",
        TIME: "TEXT", TIMETZ: "TEXT", INTERVAL: "TEXT", YEAR: "INT",
        DEC: "DECIMAL", DECIMAL: "DECIMAL", NUMERIC: "DECIMAL", FIXED: "DECIMAL", MONEY: "DECIMAL", SMALLMONEY: "DECIMAL",
        FLOAT: "FLOAT", FLOAT4: "FLOAT", FLOAT8: "FLOAT", REAL: "FLOAT", DOUBLE: "FLOAT", JSON: "JSON", JSONB: "JSON",
        BLOB: "BLOB", TINYBLOB: "BLOB", MEDIUMBLOB: "BLOB", LONGBLOB: "BLOB", BYTEA: "BLOB", BINARY: "BLOB", VARBINARY: "BLOB", IMAGE: "BLOB", ROWVERSION: "BLOB", VARBIT: "BLOB",
    }
    const multiwordTypes: Record<string, DataType> = {
        "NATIONAL CHARACTER VARYING": "VARCHAR", "NATIONAL CHAR VARYING": "VARCHAR", "NATIONAL CHARACTER": "VARCHAR", "NATIONAL CHAR": "VARCHAR", "NATIONAL VARCHAR": "VARCHAR",
        "CHARACTER VARYING": "VARCHAR", "CHAR VARYING": "VARCHAR", "NCHAR VARYING": "VARCHAR", "VARYING CHARACTER": "VARCHAR", "NATIVE CHARACTER": "VARCHAR",
        "LONG VARCHAR": "TEXT", "LONG VARBINARY": "BLOB", "DOUBLE PRECISION": "FLOAT", "UNSIGNED BIG INT": "BIGINT", "BIT VARYING": "BLOB",
    }
    const generatedTypes = new Set(["SERIAL", "SMALLSERIAL", "BIGSERIAL", "SERIAL2", "SERIAL4", "SERIAL8"])
    function references(tokens: Token[], index: number, table: string, fields: string[]) {
        const parent = identifier(tokens, index + 1), columns = names(tokens, parent.next)
        let onDelete: ErdRelationship["onDelete"] = "RESTRICT"
        for (let i = columns.next; i < tokens.length; i++) {
            if (keyword(tokens[i], "ON") && keyword(tokens[i + 1], "DELETE")) {
                if (keyword(tokens[i + 2], "CASCADE")) onDelete = "CASCADE"
                else if (keyword(tokens[i + 2], "SET") && keyword(tokens[i + 3], "NULL")) onDelete = "SET NULL"
                else if (!keyword(tokens[i + 2], "RESTRICT") && !(keyword(tokens[i + 2], "NO") && keyword(tokens[i + 3], "ACTION"))) throw new Error("This import supports ON DELETE RESTRICT, CASCADE and SET NULL.")
            }
            if (keyword(tokens[i], "ON") && keyword(tokens[i + 1], "UPDATE")) warnings.add("ON UPDATE behavior is not represented in the ERD.")
        }
        if (fields.length !== columns.names.length) throw new Error("Composite foreign keys need matching column counts.")
        foreignKeys.push({table, fields, parent: parent.name, parentFields: columns.names, onDelete})
    }
    function constraint(tokens: Token[], table: string): boolean {
        let index = 0, name: string | undefined
        if (keyword(tokens[index], "CONSTRAINT")) {const named = identifier(tokens, index + 1); name = named.name; index = named.next}
        if (keyword(tokens[index], "PRIMARY") && keyword(tokens[index + 1], "KEY")) {
            index += 2
            if (keyword(tokens[index], "CLUSTERED") || keyword(tokens[index], "NONCLUSTERED")) index++
            keys.push({table, fields: names(tokens, index).names, primary: true}); return true
        }
        if (keyword(tokens[index], "UNIQUE")) {
            if (keyword(tokens[index + 1], "KEY") || keyword(tokens[index + 1], "INDEX")) index++
            if (tokens[index + 1]?.value !== "(") {const named = identifier(tokens, index + 1); name = named.name; index = named.next - 1}
            keys.push({table, fields: names(tokens, index + 1).names, primary: false, name, unique: true}); return true
        }
        if (keyword(tokens[index], "FOREIGN") && keyword(tokens[index + 1], "KEY")) {
            index += 2
            if (tokens[index]?.value !== "(") index = identifier(tokens, index).next
            const columns = names(tokens, index)
            if (!keyword(tokens[columns.next], "REFERENCES")) throw new Error("A foreign key is missing its REFERENCES clause.")
            references(tokens, columns.next, table, columns.names); return true
        }
        if (keyword(tokens[index], "CHECK")) {
            const body = parenthesized(tokens, index + 1).body
            checks.push({table, name, expression: source.slice(body[0]?.start, body.at(-1)?.end)}); return true
        }
        if (keyword(tokens[index], "KEY") || keyword(tokens[index], "INDEX")) {
            if (tokens[index + 1]?.value !== "(") {const named = identifier(tokens, index + 1); name = named.name; index = named.next - 1}
            keys.push({table, name, fields: names(tokens, index + 1).names, primary: false, unique: false}); return true
        }
        if (keyword(tokens[index], "EXCLUDE")) {warnings.add("Exclusion constraints are not represented in the ERD."); return true}
        return false
    }
    for (const statement of split(tokenize(source), ";")) {
        let index = 0
        if (keyword(statement[0], "CREATE")) {
            index = 1
            const unique = keyword(statement[index], "UNIQUE")
            if (unique) index++
            if (keyword(statement[index], "INDEX")) {
                const named = identifier(statement, index + 1)
                if (!keyword(statement[named.next], "ON")) throw new Error("An index is missing its ON clause.")
                const table = identifier(statement, named.next + 1), columns = names(statement, table.next)
                keys.push({table: table.name, name: named.name, fields: columns.names, primary: false, unique})
                if (columns.next !== statement.length) warnings.add("Index filters and storage options were omitted.")
                continue
            }
            if (["TEMP", "TEMPORARY", "UNLOGGED"].some(word => keyword(statement[index], word))) index++
            if (!keyword(statement[index], "TABLE")) {warnings.add("Statements other than CREATE TABLE and ALTER TABLE constraints were skipped."); continue}
            index++
            if (keyword(statement[index], "IF") && keyword(statement[index + 1], "NOT") && keyword(statement[index + 2], "EXISTS")) index += 3
            const tableName = identifier(statement, index), body = parenthesized(statement, tableName.next)
            if (document.tables.length >= 500) throw new Error("An ERD can contain up to 500 tables.")
            if (document.tables.some(table => table.name.toLowerCase() === tableName.name.toLowerCase())) throw new Error(`Duplicate table definition: ${tableName.name}.`)
            const fields: ErdField[] = []
            const sqlTypes = new Map<string, string>()
            options.sqlTypes?.set(tableName.name.toLowerCase(), sqlTypes)
            for (const part of split(body.body, ",")) {
                if (constraint(part, tableName.name)) continue
                if (fields.length >= 200) throw new Error(`Table ${tableName.name} exceeds the limit of 200 columns.`)
                const column = identifier(part, 0)
                let typeIndex = column.next, typeToken = part[typeIndex]
                const typeStart = typeIndex
                if (!typeToken || !["word", "quoted"].includes(typeToken.kind)) throw new Error(`Missing data type for ${tableName.name}.${column.name}.`)
                if (part[typeIndex + 1]?.value === ".") {
                    const qualified = identifier(part, typeIndex)
                    const namespace = typeToken.value.toUpperCase()
                    if (!(dialect === "sqlserver" && namespace === "SYS" || dialect === "postgresql" && namespace === "PG_CATALOG") || qualified.next !== typeIndex + 3) throw new Error(`Unsupported qualified data type ${qualified.name} in ${tableName.name}.${column.name}. Custom types must be converted to a supported scalar type before import.`)
                    typeIndex = qualified.next - 1; typeToken = part[typeIndex]
                }
                let typeName = typeToken.value.toUpperCase(), cursor = typeIndex + 1
                let type = aliases[typeName]
                for (const count of [3, 2]) {
                    const phrase = part.slice(typeIndex, typeIndex + count)
                    if (phrase.length !== count || phrase.some(token => token.kind !== "word")) continue
                    const name = phrase.map(token => token.value.toUpperCase()).join(" ")
                    if (Object.hasOwn(multiwordTypes, name)) {typeName = name; type = multiwordTypes[name]; cursor = typeIndex + count; break}
                }
                if (dialect === "sqlserver" && typeName === "TIMESTAMP") type = "BLOB"
                if (dialect === "mysql" && typeName === "SERIAL") type = "BIGINT"
                if (dialect === "postgresql" && typeName === "BIT") type = "BLOB"
                if (!type) throw new Error(`Unsupported data type ${typeToken.value} in ${tableName.name}.${column.name}.`)
                const field: ErdField = {...newField(column.name), primary: false, nullable: true, type, length: ""}
                if (typeName === "SYSNAME") field.length = "128"
                if (dialect === "mysql" && typeName === "SERIAL") field.unique = true
                if (typeName === "MONEY" || typeName === "SMALLMONEY") field.length = typeName === "SMALLMONEY" ? "10,4" : "19,4"
                if (part[cursor]?.value === "(") {
                    const size = parenthesized(part, cursor)
                    if (["VARCHAR", "BLOB"].includes(type) && keyword(size.body[0], "MAX")) {if (type === "VARCHAR") {type = "TEXT"; field.type = type}}
                    else if (["ENUM", "SET"].includes(typeName)) {
                        const values = split(size.body, ",")
                        if (!values.length || values.some(value => value.length !== 1 || value[0].kind !== "string")) throw new Error(`Invalid ${typeName} values for ${tableName.name}.${column.name}.`)
                        const lengths = values.map(value => value[0].value.length)
                        const length = typeName === "SET" ? lengths.reduce((sum, length) => sum + length, 0) + lengths.length - 1 : Math.max(...lengths)
                        if (length > (dialect === "mysql" ? 16383 : dialect === "sqlserver" ? 4000 : 10485760)) {type = "TEXT"; field.type = type}
                        else field.length = String(Math.max(1, length))
                    }
                    else if (typeName === "BIT" && dialect !== "sqlserver" && size.body.length === 1 && /^\d+$/.test(size.body[0].value)) {
                        if (dialect === "postgresql" || Number(size.body[0].value) > 1) {type = "BLOB"; field.type = type; warnings.add("Bit-string columns are imported as BLOB; their bit width is not retained.")}
                    }
                    else if (["VARCHAR", "DECIMAL"].includes(type) && size.body.every(token => /^\d+$/.test(token.value) || token.value === ",")) field.length = size.body.map(token => token.value).join("")
                    else if (["INT", "BIGINT"].includes(type) && size.body.length === 1 && /^\d+$/.test(size.body[0].value)) warnings.add("Integer display widths are not retained; numeric values are still represented as integers.")
                    else warnings.add(`Type parameters for ${tableName.name}.${column.name} were omitted.`)
                    cursor = size.next
                }
                sqlTypes.set(column.name.toLowerCase(), part.slice(typeStart, cursor).map(token => token.kind === "word" ? token.value.toUpperCase() : token.raw).join(" "))
                if (options.strict) validateColumnAttributes(part, cursor, `${tableName.name}.${column.name}`)
                const attributesEnd = part.findIndex((token, index) => index >= cursor && ["DEFAULT", "NOT", "NULL", "PRIMARY", "UNIQUE", "REFERENCES", "CONSTRAINT", "CHECK", "GENERATED"].some(word => keyword(token, word)))
                const attributes = part.slice(cursor, attributesEnd < 0 ? part.length : attributesEnd)
                if (attributes.some(token => /^\[\d*\]$/.test(token.raw) || keyword(token, "ARRAY"))) throw new Error("SQL array column types are not supported by this ERD import; convert them explicitly in a copy of the schema first.")
                if (part[cursor]?.value === ".") throw new Error(`Unsupported qualified data type in ${tableName.name}.${column.name}. Custom types must be converted to a supported scalar type before import.`)
                if (generatedTypes.has(typeName) || part.some(token => keyword(token, "IDENTITY") || keyword(token, "AUTO_INCREMENT") || keyword(token, "AUTOINCREMENT"))) {
                    field.autoIncrement = true; field.nullable = false
                    warnings.add("Generated ID sequences use the database's default start and increment on export.")
                }
                if (["TINYTEXT", "MEDIUMTEXT", "LONGTEXT", "TINYBLOB", "MEDIUMBLOB", "LONGBLOB"].includes(typeName)) warnings.add(`${typeName} is imported as ${type}; its original storage limit is not retained. Review the size before exporting SQL.`)
                if (["MEDIUMINT", "SMALLINT", "TINYINT", "INT1", "INT2", "INT3", "SMALLSERIAL", "SERIAL2"].includes(typeName)) warnings.add("Small and medium integer types are imported as INT; their original range limits are not retained.")
                if (typeName.includes("UNSIGNED") || dialect === "mysql" && typeName === "SERIAL" || attributes.some(token => keyword(token, "UNSIGNED") || keyword(token, "ZEROFILL"))) warnings.add("UNSIGNED and ZEROFILL attributes are not retained. Review numeric ranges before exporting SQL.")
                if (["ENUM", "SET"].includes(typeName)) warnings.add(`${typeName} is imported as ${type}; its allowed-value restrictions are not retained.`)
                if (["TIMESTAMPTZ", "TIMETZ", "DATETIMEOFFSET"].includes(typeName) || attributes.some(token => keyword(token, "WITH") && attributes.some(value => keyword(value, "ZONE")))) warnings.add("Timezone information is not retained in the ERD's portable date/time types.")
                if (["TIME", "TIMETZ", "INTERVAL"].includes(typeName)) warnings.add(`${typeName} is imported as TEXT; native time/duration validation is not retained.`)
                if (typeName === "YEAR") warnings.add("YEAR is imported as INT; its year range limits are not retained.")
                if (["MONEY", "SMALLMONEY"].includes(typeName)) warnings.add(`${typeName} is imported as DECIMAL(${field.length}); currency-specific behavior is not retained.`)
                if (["ROWVERSION", "TIMESTAMP"].includes(typeName) && dialect === "sqlserver") warnings.add("SQL Server rowversion/timestamp is imported as BLOB; automatic version generation is not retained.")
                if (typeName === "CITEXT") warnings.add("CITEXT is imported as TEXT; case-insensitive comparison behavior is not retained.")
                if (typeName === "XML") warnings.add("XML is imported as TEXT; XML validation is not retained.")
                if (["VARBIT", "BIT VARYING"].includes(typeName) || dialect === "postgresql" && typeName === "BIT") warnings.add("Bit-string columns are imported as BLOB; their bit width is not retained.")
                if (attributes.some(token => keyword(token, "COLLATE") || keyword(token, "CHARSET") || keyword(token, "CHARACTER"))) warnings.add("Column character sets and collations are not retained.")
                if (attributes.some((token, index) => keyword(token, "ON") && keyword(attributes[index + 1], "UPDATE"))) warnings.add("Automatic ON UPDATE column expressions are not retained.")
                for (let i = cursor; i < part.length; i++) {
                    if (keyword(part[i], "NOT") && keyword(part[i + 1], "NULL")) field.nullable = false
                    if (keyword(part[i], "PRIMARY") && keyword(part[i + 1], "KEY")) {field.primary = true; field.nullable = false}
                    if (keyword(part[i], "UNIQUE")) field.unique = true
                    if (keyword(part[i], "REFERENCES")) {references(part, i, tableName.name, [column.name]); const target = identifier(part, i + 1); i = names(part, target.next).next - 1}
                    if (keyword(part[i], "DEFAULT")) {
                        if (keyword(part[i - 1], "BY") && keyword(part[i + 1], "AS")) continue
                        const start = ++i; let depth = 0
                        for (; i < part.length; i++) {
                            if (depth === 0 && (["NOT", "NULL", "PRIMARY", "UNIQUE", "REFERENCES", "CONSTRAINT", "CHECK", "COLLATE", "GENERATED", "COMMENT", "AUTO_INCREMENT", "AUTOINCREMENT"].some(word => keyword(part[i], word)) || keyword(part[i], "ON") && keyword(part[i + 1], "UPDATE")) && i > start) break
                            if (part[i].kind === "symbol") {if (part[i].value === "(") depth++; if (part[i].value === ")") depth--}
                        }
                        if (i === start) throw new Error(`Missing default expression for ${column.name}.`)
                        field.defaultValue = source.slice(part[start].start, part[i - 1].end); i--
                    }
                    if (keyword(part[i], "CHECK")) {const check = parenthesized(part, i + 1); checks.push({table: tableName.name, expression: source.slice(check.body[0]?.start, check.body.at(-1)?.end)}); i = check.next - 1}
                    if (keyword(part[i], "ON") && keyword(part[i + 1], "UPDATE")) warnings.add("Automatic ON UPDATE column expressions are not retained.")
                }
                if (fields.some(item => item.name.toLowerCase() === field.name.toLowerCase())) throw new Error(`Duplicate column ${column.name} in ${tableName.name}.`)
                fields.push(field)
            }
            if (statement.length > body.next) warnings.add("Table storage options are not represented in the ERD.")
            document.tables.push({id: createClientId(), name: tableName.name, x: 0, y: 0, fields})
        } else if (keyword(statement[0], "ALTER") && keyword(statement[1], "TABLE")) {
            index = 2
            if (keyword(statement[index], "ONLY")) index++
            const table = identifier(statement, index)
            if (keyword(statement[table.next], "ADD")) {
                for (const part of split(statement.slice(table.next + 1), ",")) {
                    const tokens = keyword(part[0], "ADD") ? part.slice(1) : part
                    if (!constraint(tokens, table.name)) warnings.add("ALTER TABLE operations other than key constraints were skipped.")
                }
            } else warnings.add("ALTER TABLE operations other than key constraints were skipped.")
        } else if (!keyword(statement[0], "PRAGMA")) warnings.add("Statements other than CREATE TABLE and ALTER TABLE constraints were skipped.")
    }
    if (!document.tables.length) throw new Error("No CREATE TABLE definitions were found in this SQL file.")
    const findTable = (name: string) => {
        const table = document.tables.find(table => table.name.toLowerCase() === name.toLowerCase())
        if (!table) throw new Error(`Referenced table ${name} is not defined in the SQL file.`)
        return table
    }
    const findField = (table: typeof document.tables[number], name: string) => {
        const field = table.fields.find(field => field.name.toLowerCase() === name.toLowerCase())
        if (!field) throw new Error(`Column ${table.name}.${name} is not defined in the SQL file.`)
        return field
    }
    for (const key of keys) {
        const table = findTable(key.table)
        const fields = key.fields.map(name => findField(table, name))
        if (key.primary) for (const field of fields) {field.primary = true; field.nullable = false}
        else if (key.unique !== false && fields.length === 1 && !key.name) fields[0].unique = true
        else (table.indexes ??= []).push({id: createClientId(), name: key.name ?? `${table.name}_uq_${(table.indexes?.length ?? 0) + 1}`.slice(0, 150), fields: fields.map(field => field.id), unique: key.unique !== false})
    }
    for (const check of checks) {const table = findTable(check.table); (table.checks ??= []).push({id: createClientId(), name: check.name ?? `${table.name}_check_${(table.checks?.length ?? 0) + 1}`.slice(0, 150), expression: check.expression})}
    for (const foreign of foreignKeys) {
        const parent = findTable(foreign.parent), child = findTable(foreign.table), parentField = findField(parent, foreign.parentFields[0]), childField = findField(child, foreign.fields[0])
        const parentFields = foreign.parentFields.map(name => findField(parent, name).id), childFields = foreign.fields.map(name => findField(child, name).id)
        const childUnique = isErdKey(child, childFields)
        document.relationships.push({id: createClientId(), fromTable: parent.id, fromField: parentField.id, toTable: child.id, toField: childField.id, ...(parentFields.length > 1 ? {fromFields: parentFields, toFields: childFields} : {}),
            cardinality: childUnique ? "1:1" : "1:N", leftEnd: childField.nullable ? "zero-one" : "one", rightEnd: childUnique ? "zero-one" : "zero-many", onDelete: foreign.onDelete})
    }
    let y = 60
    for (let index = 0; index < document.tables.length; index += 3) {
        const row = document.tables.slice(index, index + 3)
        row.forEach((table, column) => {table.x = 80 + column * 400; table.y = y})
        y += Math.max(...row.map(table => 50 + table.fields.length * 32)) + 100
    }
    validateErdImport(document)
    return {document, warnings: [...warnings]}
}
export function importErdFile(source: string, filename: string, dialect: ErdDialect = "postgresql"): ErdImportResult {
    if (new TextEncoder().encode(source).length > maxErdImportBytes) throw new Error("Choose an ERD file smaller than 4 MB.")
    if (/\.json$/i.test(filename)) return importErdJson(source)
    if (/\.sql$/i.test(filename)) return importErdSql(source, dialect)
    throw new Error("Choose a .sql schema or .json ERD draft.")
}
