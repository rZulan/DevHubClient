import test from 'node:test'
import assert from 'node:assert/strict'
import {erdRenderIndex} from '../src/features/workshop/erd-render-index.ts'
import {createErdRouteCache} from '../src/features/workshop/erd-connection.ts'
import {canvasViewport, intersectsViewport} from '../src/features/workshop/canvas-visibility.ts'
import {relationshipColumns} from '../src/features/workshop/tool-documents.ts'

const table = (id, x = 0) => ({id, name: id, x, y: 0, fields: [{id: 'id'}, {id: 'tenant'}, {id: 'parent'}]})

test('indexed FK markers match the original semantics for reversed and composite keys', () => {
    const document = {tables: [table('a'), table('b'), table('c'), table('unrelated')], relationships: [
        {id: 'ab', fromTable: 'a', toTable: 'b', fromField: 'id', toField: 'parent', cardinality: '1:N'},
        {id: 'cb', fromTable: 'c', toTable: 'b', fromField: 'id', toField: 'id', fromFields: ['id', 'tenant'], toFields: ['id', 'tenant'], cardinality: 'N:1'},
        {id: 'many', fromTable: 'a', toTable: 'unrelated', fromField: 'id', toField: 'id', cardinality: 'N:M'},
    ]}
    const index = erdRenderIndex(document)
    for (const table of document.tables) for (const field of table.fields) {
        const previous = document.relationships.some(relation => {
            const columns = relationshipColumns(document, relation)
            return relation.cardinality !== 'N:M' && columns.childTable?.id === table.id && columns.children.some(value => value?.id === field.id)
        })
        assert.equal(index.foreignKeys.get(table.id).has(field.id), previous)
    }
    assert.deepEqual([...index.foreignKeys.get('c')], ['id', 'tenant'])
    assert.equal(index.tables.get('a'), document.tables[0])
})

test('moving a table reroutes only its relationships while other cached routes stay unchanged', () => {
    const a = table('a'), b = table('b', 500), c = table('c', 1000)
    const ab = {id: 'ab', fromField: 'id', toField: 'parent'}, bc = {id: 'bc', fromField: 'id', toField: 'parent'}
    const route = createErdRouteCache(), originalAB = route(a, b, ab, 0), originalBC = route(b, c, bc, 12)
    assert.equal(route(a, b, ab, 0), originalAB)
    const movedA = {...a, x: 50}
    assert.notEqual(route(movedA, b, ab, 0), originalAB)
    assert.equal(route(b, c, bc, 12), originalBC)
    assert.notEqual(route(b, c, {...bc, fromAnchor: {edge: 'top', offset: .5}}, 12), originalBC)
    assert.notEqual(route(b, c, bc, 24), originalBC)
})

test('viewport culling respects pan, zoom, overscan, negative coordinates and crossing connections', () => {
    const viewport = canvasViewport({zoom: 2, pan: {x: 100, y: -200}}, {width: 800, height: 600}, 100)
    assert.deepEqual(viewport, {x: -100, y: 50, width: 500, height: 400})
    assert.equal(intersectsViewport({x: -90, y: 60, width: 300, height: 100}, viewport), true)
    assert.equal(intersectsViewport({x: 900, y: 60, width: 300, height: 100}, viewport), false)
    assert.equal(intersectsViewport({x: -1000, y: 200, width: 2000, height: 24}, viewport), true)
    assert.equal(canvasViewport({zoom: 1, pan: {x: 0, y: 0}}, {width: 0, height: 0}), undefined)
    assert.equal(intersectsViewport({x: 900, y: 60, width: 300, height: 100}), true)
})
