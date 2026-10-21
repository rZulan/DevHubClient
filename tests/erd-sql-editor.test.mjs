import test from 'node:test'
import assert from 'node:assert/strict'
import {prepareErdSql} from '../src/features/workshop/erd-sql-editor.ts'
import {importErdSql} from '../src/features/workshop/erd-import.ts'
import {erdSql, newField, relationshipEnds, tableHeight} from '../src/features/workshop/tool-documents.ts'

const schema = `CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE);
CREATE TABLE orders (id UUID PRIMARY KEY, user_id UUID NOT NULL, total DECIMAL(10,2) DEFAULT 0);
ALTER TABLE orders ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX orders_total ON orders(total);`
function example() {
    const document = importErdSql(schema).document
    document.tables[0].x = -250; document.tables[0].y = 380
    document.tables[1].x = 700; document.tables[1].y = -120
    document.relationships[0].rightEnd = 'many'
    document.relationships[0].fromAnchor = {edge: 'bottom', offset: .25}
    document.relationships[0].toAnchor = {edge: 'top', offset: .75}
    return document
}

test('SQL edits preserve existing IDs, positions, indexes and custom relationship attachments', () => {
    const current = example(), before = structuredClone(current)
    const result = prepareErdSql(erdSql(current).replace('DECIMAL(10,2)', 'DECIMAL(12,3)'), current).document
    assert.deepEqual(current, before)
    assert.deepEqual(result.tables.map(({id, x, y}) => ({id, x, y})), current.tables.map(({id, x, y}) => ({id, x, y})))
    assert.deepEqual(result.tables.flatMap(table => table.fields.map(field => field.id)), current.tables.flatMap(table => table.fields.map(field => field.id)))
    assert.equal(result.tables[1].fields[2].length, '12,3')
    assert.equal(result.tables[1].indexes[0].id, current.tables[1].indexes[0].id)
    assert.deepEqual(result.relationships, current.relationships)
})

test('added tables appear below existing tables, while deleting a definition removes its table', () => {
    const current = example()
    const {document} = prepareErdSql(erdSql(current) + '\nCREATE TABLE audit_log (id INT PRIMARY KEY, message TEXT);', current)
    const added = document.tables[2]
    assert.ok(added.y >= Math.max(...current.tables.map(table => table.y + tableHeight(table))))
    const removed = prepareErdSql('CREATE TABLE users (id UUID PRIMARY KEY, email VARCHAR(255) NOT NULL UNIQUE);', current).document
    assert.equal(removed.tables.length, 1)
    assert.equal(removed.tables[0].id, current.tables[0].id)
    assert.equal(removed.relationships.length, 0)
})

test('a replacement schema starts near the origin instead of below tables that were removed', () => {
    const current = example()
    current.tables.forEach(table => {table.y = 50000})
    const next = prepareErdSql('CREATE TABLE new_schema (a INT, b TEXT, c BOOLEAN, d FLOAT);', current).document
    assert.equal(next.tables[0].x, 80)
    assert.equal(next.tables[0].y, 60)
})

test('unambiguous table and column renames retain their identities', () => {
    const current = example()
    const {document} = prepareErdSql(erdSql(current).replaceAll('"orders"', '"purchases"').replaceAll('"total"', '"amount"'), current)
    assert.equal(document.tables[1].id, current.tables[1].id)
    assert.equal(document.tables[1].fields[2].id, current.tables[1].fields[2].id)
    assert.equal(document.tables[1].fields[2].name, 'amount')
    assert.equal(document.tables[1].x, current.tables[1].x)
})

test('reverse relationships and composite keys retain their field IDs and attachments', () => {
    const current = importErdSql('CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a,b)); CREATE TABLE child (a INT NOT NULL, b INT NOT NULL, FOREIGN KEY (a,b) REFERENCES parent(a,b));').document
    const old = current.relationships[0]
    current.relationships[0] = {...old, fromTable: old.toTable, toTable: old.fromTable, fromField: old.toField, toField: old.fromField, fromFields: old.toFields, toFields: old.fromFields, cardinality: 'N:1', leftEnd: 'many', rightEnd: 'one', fromAnchor: {edge: 'left', offset: .2}}
    const next = prepareErdSql(erdSql(current) + '\n-- edited', current).document
    assert.deepEqual(next.relationships, current.relationships)
    const nullable = prepareErdSql(erdSql(current).replace('"a" INT NOT NULL,\n  "b" INT NOT NULL\n);', '"a" INT,\n  "b" INT\n);'), current).document
    assert.equal(nullable.relationships[0].rightEnd, 'zero-one')
    assert.equal(relationshipEnds(next.relationships[0]).leftEnd, 'many')
})

test('editing SQL does not silently convert portable types in any export dialect', () => {
    for (const dialect of ['postgresql', 'mysql', 'sqlserver', 'sqlite']) {
        const fields = ['UUID', 'BOOLEAN', 'VARCHAR', 'JSON', 'DECIMAL'].map((type, index) => ({...newField(`value_${index}`), type, primary: index === 0, nullable: index !== 0, length: type === 'VARCHAR' ? '120' : type === 'DECIMAL' ? '10,2' : '', defaultValue: type === 'BOOLEAN' ? 'true' : ''}))
        const current = {dialect, tables: [{id: 'portable', name: 'portable', x: 340, y: 200, fields}], relationships: []}
        const next = prepareErdSql(erdSql(current).replace('\n);', ',\n  "extra" TEXT\n);'), current).document
        assert.deepEqual(next.tables[0].fields.slice(0, fields.length), fields, dialect)
    }
})

test('invalid and unsupported SQL cannot replace the document; empty SQL clears it explicitly', () => {
    const current = example(), before = structuredClone(current)
    for (const source of ['CREATE TABLE users (id UUID', 'CREATE TABLE users (id UUID name TEXT);', 'CREATE TABLE users (id UUID); ALTER TABLE users ADD COLUMN name TEXT;', 'CREATE TABLE users (id UNKNOWN);', 'CREATE TABLE users (id UUID); DROP TABLE users;', '/* unclosed', '--' + 'x'.repeat(4_000_000)]) {
        assert.throws(() => prepareErdSql(source, current), source.slice(0, 80))
        assert.deepEqual(current, before)
    }
    assert.deepEqual(prepareErdSql('-- empty schema', current).document.tables, [])
})

test('an explicit physical type change is applied even when the import aliases are equal', () => {
    const current = {dialect: 'mysql', tables: [{id: 'users', name: 'users', x: 10, y: 20, fields: [newField('id')]}], relationships: []}
    const next = prepareErdSql(erdSql(current).replace('CHAR(36)', 'VARCHAR(36)'), current).document
    assert.equal(next.tables[0].fields[0].type, 'VARCHAR')
    assert.equal(next.tables[0].fields[0].length, '36')
    assert.equal(next.tables[0].fields[0].id, current.tables[0].fields[0].id)
})

test('new foreign key columns inherit unchanged portable types for matching physical SQL', () => {
    for (const dialect of ['mysql', 'sqlite']) {
        const current = {dialect, tables: [{id: 'parent', name: 'parent', x: 20, y: 40, fields: [newField('id')]}], relationships: []}
        const type = dialect === 'mysql' ? 'CHAR(36)' : 'TEXT'
        const source = erdSql(current) + `\nCREATE TABLE child (parent_id ${type} NOT NULL, FOREIGN KEY (parent_id) REFERENCES parent(id));`
        const next = prepareErdSql(source, current).document
        assert.equal(next.tables[0].fields[0].type, 'UUID')
        assert.equal(next.tables[1].fields[0].type, 'UUID')
        assert.equal(next.relationships.length, 1)
    }
})

test('a schema with 71 tables keeps positions and IDs while adding a column', () => {
    const current = importErdSql(Array.from({length: 71}, (_, i) => `CREATE TABLE table_${i} (id INT PRIMARY KEY);`).join('\n')).document
    const source = erdSql(current).replace('CREATE TABLE "table_70" (\n  "id" INT NOT NULL,', 'CREATE TABLE "table_70" (\n  "id" INT NOT NULL,\n  "name" TEXT,')
    const next = prepareErdSql(source, current).document
    assert.equal(next.tables.length, 71)
    assert.equal(next.tables[70].fields.length, 2)
    for (let i = 0; i < 71; i++) assert.deepEqual([next.tables[i].id, next.tables[i].x, next.tables[i].y], [current.tables[i].id, current.tables[i].x, current.tables[i].y])
})
