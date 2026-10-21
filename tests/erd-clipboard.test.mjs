import test from 'node:test'
import assert from 'node:assert/strict'
import {copyErdTables, insertErdTables, readErdClipboard} from '../src/features/workshop/erd-clipboard.ts'
import {importErdSql} from '../src/features/workshop/erd-import.ts'
import {erdSchemaIssues} from '../src/features/workshop/erd-schema.ts'

const schema = `CREATE TABLE parent (id INT PRIMARY KEY, email VARCHAR(100) UNIQUE, CONSTRAINT email_check CHECK (id > 0));
CREATE TABLE child (id INT PRIMARY KEY, parent_id INT NOT NULL, FOREIGN KEY (parent_id) REFERENCES parent(id));
CREATE INDEX child_parent ON child(parent_id);`
const example = () => importErdSql(schema).document

test('copy includes selected tables and their internal relationships only', () => {
    const document = example()
    const all = readErdClipboard(copyErdTables(document, document.tables.map(table => table.id)))
    assert.deepEqual(all, document)
    const child = readErdClipboard(copyErdTables(document, [document.tables[1].id]))
    assert.equal(child.tables.length, 1)
    assert.equal(child.relationships.length, 0)
    assert.equal(copyErdTables(document, []), '')
})

test('duplicate creates a valid subgraph with fresh IDs, names, keys and indexes', () => {
    const current = example(), before = structuredClone(current)
    const pasted = insertErdTables(current, current, 32)
    assert.deepEqual(current, before)
    assert.equal(pasted.document.tables.length, 4)
    assert.equal(pasted.document.relationships.length, 2)
    assert.deepEqual(pasted.document.tables.slice(2).map(table => table.name), ['parent_copy', 'child_copy'])
    const added = pasted.document.tables.slice(2)
    assert.deepEqual(pasted.selectedIds, added.map(table => table.id))
    for (let i = 0; i < 2; i++) {
        assert.equal(added[i].x, current.tables[i].x + 32)
        assert.equal(added[i].y, current.tables[i].y + 32)
        assert.notEqual(added[i].id, current.tables[i].id)
        assert.ok(added[i].fields.every(field => !current.tables[i].fields.some(old => old.id === field.id)))
    }
    const relation = pasted.document.relationships[1]
    assert.equal(relation.fromTable, added[0].id)
    assert.equal(relation.toTable, added[1].id)
    assert.equal(relation.fromField, added[0].fields[0].id)
    assert.equal(relation.toField, added[1].fields[1].id)
    assert.deepEqual(erdSchemaIssues(pasted.document), [])
    const again = insertErdTables(pasted.document, current, 48)
    assert.equal(again.document.tables[4].name, 'parent_copy_2')
    assert.deepEqual(erdSchemaIssues(again.document), [])
})

test('paste into another document or after cutting preserves available names', () => {
    const source = example()
    const next = insertErdTables({tables: [], relationships: [], dialect: 'mysql'}, source)
    assert.equal(next.document.dialect, 'mysql')
    assert.deepEqual(next.document.tables.map(table => table.name), ['parent', 'child'])
    assert.equal(next.document.tables[0].checks[0].name, 'email_check')
})

test('composite relationship fields, index references and attachment symbols are remapped', () => {
    const current = importErdSql('CREATE TABLE p (a INT, b INT, PRIMARY KEY (a,b)); CREATE TABLE c (a INT NOT NULL, b INT NOT NULL, FOREIGN KEY (a,b) REFERENCES p(a,b)); CREATE INDEX c_keys ON c(a,b);').document
    current.relationships[0].fromAnchor = {edge: 'bottom', offset: .25}
    const next = insertErdTables(current, current).document
    const relation = next.relationships[1]
    assert.deepEqual(relation.fromFields, next.tables[2].fields.map(field => field.id))
    assert.deepEqual(relation.toFields, next.tables[3].fields.map(field => field.id))
    assert.deepEqual(next.tables[3].indexes[0].fields, relation.toFields)
    assert.deepEqual(relation.fromAnchor, current.relationships[0].fromAnchor)
    assert.deepEqual(erdSchemaIssues(next), [])
})

test('clipboard ignores unrelated text, rejects corrupt documents, and enforces limits', () => {
    assert.equal(readErdClipboard('hello'), null)
    assert.equal(readErdClipboard('{"type":"devhub/ideas-shapes"}'), null)
    assert.throws(() => readErdClipboard('{"type":"devhub/erd-tables","version":2}'))
    assert.throws(() => readErdClipboard('{"type":"devhub/erd-tables","version":1,"document":{}}'))
    assert.throws(() => readErdClipboard('x'.repeat(4_000_001)))
    assert.throws(() => insertErdTables(example(), example(), Infinity))
    const many = importErdSql(Array.from({length: 499}, (_, i) => `CREATE TABLE table_${i} (id INT);`).join('\n')).document
    assert.throws(() => insertErdTables(many, example()), /500 tables/)
})

test('copy names stay within length limits and avoid case-insensitive collisions', () => {
    const current = example()
    current.tables[0].name = 'a'.repeat(150)
    const next = insertErdTables(current, current).document
    assert.equal(next.tables[2].name.length, 150)
    assert.match(next.tables[2].name, /_copy$/)
})
