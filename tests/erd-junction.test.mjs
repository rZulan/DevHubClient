import test from 'node:test'
import assert from 'node:assert/strict'
import {createErdJunction, erdSchemaIssues} from '../src/features/workshop/erd-schema.ts'
import {newField, erdSql} from '../src/features/workshop/tool-documents.ts'

function example() {
    const left = {id: 'left', name: 'students', x: 80, y: 80, fields: [{...newField('id'), type: 'INT', autoIncrement: true}]}
    const right = {id: 'right', name: 'courses', x: 500, y: 80, fields: [newField('id')]}
    const relation = {id: 'proposal', fromTable: left.id, toTable: right.id, fromField: left.fields[0].id, toField: right.fields[0].id, cardinality: 'N:M', leftEnd: 'many', rightEnd: 'zero-many', onDelete: 'CASCADE', fromAnchor: {edge: 'bottom', offset: .2}, toAnchor: {edge: 'left', offset: .7}}
    return {document: {dialect: 'postgresql', tables: [left, right], relationships: []}, relation}
}

test('a new many-to-many proposal creates the junction and two correctly notated foreign keys atomically', () => {
    const {document, relation} = example(), before = structuredClone(document)
    const next = createErdJunction(document, relation)
    assert.deepEqual(document, before)
    assert.equal(next.tables.length, 3)
    assert.equal(next.relationships.length, 2)
    const junction = next.tables[2]
    assert.equal(junction.name, 'students_courses')
    assert.deepEqual(junction.fields.map(field => field.type), ['INT', 'UUID'])
    assert.ok(junction.fields.every(field => field.primary && !field.nullable && !field.autoIncrement && !field.defaultValue))
    assert.deepEqual(next.relationships.map(({cardinality, leftEnd, rightEnd}) => ({cardinality, leftEnd, rightEnd})), [{cardinality: '1:N', leftEnd: 'one', rightEnd: 'zero-many'}, {cardinality: '1:N', leftEnd: 'one', rightEnd: 'many'}])
    assert.deepEqual(next.relationships.map(edge => edge.fromAnchor), [relation.fromAnchor, relation.toAnchor])
    assert.deepEqual(erdSchemaIssues(next), [])
    assert.match(erdSql(next), /PRIMARY KEY \("students_id", "courses_id"\)/)
    assert.equal((erdSql(next).match(/ADD FOREIGN KEY/g) ?? []).length, 2)
})

test('converting an existing conceptual relationship replaces it, preserves other edges, and supports a custom name', () => {
    const {document, relation} = example()
    document.relationships = [relation]
    const next = createErdJunction(document, relation, '  enrollments  ')
    assert.equal(next.tables.at(-1).name, 'enrollments')
    assert.equal(next.relationships.length, 2)
    assert.ok(next.relationships.every(edge => edge.id !== relation.id && edge.cardinality === '1:N'))
    assert.throws(() => createErdJunction(document, relation, 'STUDENTS'), /already exists/)
    assert.throws(() => createErdJunction(document, relation, ' '), /table name/)
    assert.throws(() => createErdJunction(document, relation, 'a'.repeat(151)), /150/)
})

test('junctions use unique keys, reject missing keys, and keep their composite primary key non-null', () => {
    const {document, relation} = example()
    document.tables[0].fields[0].primary = false
    assert.throws(() => createErdJunction(document, relation), /primary or unique key/)
    document.tables[0].fields[0].unique = true
    relation.onDelete = 'SET NULL'
    const next = createErdJunction(document, relation)
    assert.ok(next.relationships.every(edge => edge.onDelete === 'RESTRICT' && edge.leftEnd === 'one'))
    assert.deepEqual(erdSchemaIssues(next), [])
})

test('junction creation budgets both new relationships and the total number of key columns', () => {
    const {document, relation} = example()
    const many = {...document, relationships: Array.from({length: 1999}, (_, i) => ({...relation, id: `existing-${i}`}))}
    assert.throws(() => createErdJunction(many, relation), /relationship limits/)
    assert.equal(createErdJunction({...many, relationships: [...many.relationships.slice(0, 1998), relation]}, relation).relationships.length, 2000)
    document.tables.forEach(table => {table.fields = Array.from({length: 101}, (_, i) => ({...newField(`key_${i}`), primary: true}))})
    assert.throws(() => createErdJunction(document, relation), /200-column limit/)
})
