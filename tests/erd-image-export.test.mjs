import test from 'node:test'
import assert from 'node:assert/strict'
import {erdDiagramImage, erdPngSize} from '../src/features/workshop/erd-image-export.ts'
import {erdConnectionBounds} from '../src/features/workshop/erd-connection.ts'
import {tableHeight} from '../src/features/workshop/tool-documents.ts'

const field = (id, changes = {}) => ({id, name: id, type: 'UUID', length: '', primary: false, nullable: false, unique: false, defaultValue: '', ...changes})
const table = (id, x, y, fields = [field('id', {primary: true})]) => ({id, name: id, x, y, fields})
const relation = (changes = {}) => ({id: 'link', fromTable: 'users', fromField: 'id', toTable: 'orders', toField: 'user_id', cardinality: '1:N', onDelete: 'RESTRICT', ...changes})

test('PNG includes every table and routed relationship with padding, including negative coordinates', () => {
    const document = {tables: [table('users', -900, -400), table('orders', 500, 300, [field('user_id')])], relationships: [relation({fromAnchor: {edge: 'top', offset: .5}, toAnchor: {edge: 'bottom', offset: .5}})]}
    const {view, width, height} = erdPngSize(document)
    const content = [...document.tables.map(t => ({...t, width: 300, height: tableHeight(t)})), ...erdConnectionBounds(document)]
    for (const item of content) {
        assert.ok(item.x >= view.x + 48)
        assert.ok(item.y >= view.y + 48)
        assert.ok(item.x + item.width <= view.x + view.width - 48)
        assert.ok(item.y + item.height <= view.y + view.height - 48)
    }
    assert.equal(width, view.width * 2)
    assert.equal(height, view.height * 2)
    const {svg} = erdDiagramImage(document)
    assert.match(svg, />users<\/text>/)
    assert.match(svg, />orders<\/text>/)
    assert.match(svg, />FK<\/text>/)
    assert.doesNotMatch(svg, /foreignObject|tool-canvas|selected/)
})

test('PNG diagram includes self relationships, cardinality symbols and empty tables', () => {
    const document = {tables: [table('users', 0, 0), table('empty', 600, 0, [])], relationships: [relation({toTable: 'users', toField: 'id', leftEnd: 'zero-one', rightEnd: 'zero-many'})]}
    const {svg} = erdDiagramImage(document)
    assert.equal((svg.match(/<circle /g) ?? []).length, 2)
    assert.match(svg, /M3 -9 L17 0 L3 9 M3 0 H17/)
    assert.match(svg, /No columns yet/)
})

test('PNG uses the selected SQL dialect and escapes user-supplied labels as literal text', () => {
    const document = {dialect: 'sqlserver', tables: [{...table('users', 0, 0, [field('id', {name: '<script>alert("x")</script> & data'})]), name: 'users "<&'}], relationships: []}
    const {svg} = erdDiagramImage(document)
    assert.match(svg, /UNIQUEIDENTIFIER/)
    assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; data/)
    assert.match(svg, /users &quot;&lt;&amp;/)
    assert.doesNotMatch(svg, /<script>/)
})

test('large diagrams remain complete while raster allocations stay bounded', () => {
    for (const [x, y] of [[100000, 0], [0, 100000], [100000, 100000]]) {
        const {view, width, height} = erdPngSize({tables: [table('first', 0, 0), table('far', x, y)], relationships: []})
        assert.ok(view.width > x)
        assert.ok(view.height > y)
        assert.ok(width > 0 && height > 0)
        assert.ok(width <= 8192 && height <= 8192)
        assert.ok(width * height <= 16_000_000)
    }
    assert.throws(() => erdPngSize({tables: [], relationships: []}), /Add a table/)
})
