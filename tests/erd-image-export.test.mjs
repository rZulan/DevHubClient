import test from 'node:test'
import assert from 'node:assert/strict'
import {erdDiagramImage, erdPngSize} from '../src/features/workshop/erd-image-export.ts'
import {erdConnectionBounds} from '../src/features/workshop/erd-connection.ts'
import {tableHeight} from '../src/features/workshop/tool-documents.ts'
import {planErdRoutes} from '../src/features/workshop/erd-route-plan.ts'

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
    assert.equal(width, Math.ceil(view.width * 4))
    assert.equal(height, Math.ceil(view.height * 4))
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

test('PNG can hide cardinality symbols while preserving relationship paths, resolution, and schema', () => {
    const document={tables:[table('users',0,0),table('orders',800,200,[field('user_id')])],relationships:[relation({leftEnd:'zero-one',rightEnd:'zero-many'})]}
    const before=structuredClone(document),shown=erdDiagramImage(document),hidden=erdDiagramImage(document,undefined,{showNotations:false})
    assert.match(shown.svg,/<circle cx="25"/)
    assert.doesNotMatch(hidden.svg,/<circle cx="25"|M3 -9 L17 0 L3 9|M8 -9 V9/)
    assert.equal(hidden.width,shown.width)
    assert.equal(hidden.height,shown.height)
    for(const {route} of planErdRoutes(document)) assert.ok(hidden.svg.includes(`d="${route.path}"`))
    assert.match(hidden.svg,/>FK<\/text>/)
    assert.deepEqual(document,before)
})

test('hiding relationships removes connectors and symbols while retaining tables and foreign keys', () => {
    const document={tables:[table('users',0,0),table('orders',800,200,[field('user_id')])],relationships:[relation({leftEnd:'zero-one',rightEnd:'zero-many'})]}
    const before=structuredClone(document),shown=erdDiagramImage(document)
    for (const showNotations of [true,false]) {
        const hidden=erdDiagramImage(document,undefined,{showRelationships:false,showNotations})
        for(const {route} of planErdRoutes(document)) assert.ok(!hidden.svg.includes(`d="${route.path}"`))
        assert.doesNotMatch(hidden.svg,/<circle |M3 -9 L17 0 L3 9|M8 -9 V9/)
        assert.match(hidden.svg,/>users<\/text>/)
        assert.match(hidden.svg,/>orders<\/text>/)
        assert.match(hidden.svg,/>user_id<\/text>/)
        assert.match(hidden.svg,/>FK<\/text>/)
        assert.equal(hidden.width,shown.width)
        assert.equal(hidden.height,shown.height)
    }
    assert.deepEqual(document,before)
    assert.equal(erdDiagramImage(document).svg,shown.svg)
})

test('PNG uses concise type codes across dialects and escapes user-supplied labels as literal text', () => {
    const document = {dialect: 'sqlserver', tables: [{...table('users', 0, 0, [field('id', {name: '<script>alert("x")</script> & data'})]), name: 'users "<&'}], relationships: []}
    const {svg} = erdDiagramImage(document)
    assert.match(svg, />UUID<\/text>/)
    assert.doesNotMatch(svg, /UNIQUEIDENTIFIER/)
    assert.match(svg, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; &amp; data/)
    assert.match(svg, /users &quot;&lt;&amp;/)
    assert.doesNotMatch(svg, /<script>/)
})

test('large diagrams retain 4x detail without pixel dimension or area caps', () => {
    for (const [x, y] of [[100000, 0], [0, 100000], [100000, 100000]]) {
        const {view, width, height} = erdPngSize({tables: [table('first', 0, 0), table('far', x, y)], relationships: []})
        assert.ok(view.width > x)
        assert.ok(view.height > y)
        assert.ok(width > 0 && height > 0)
        assert.equal(width, Math.ceil(view.width * 4))
        assert.equal(height, Math.ceil(view.height * 4))
        assert.ok(width > 8192 || height > 8192)
        assert.ok(width * height > 16_000_000)
    }
    assert.throws(() => erdPngSize({tables: [], relationships: []}), /Add a table/)
})

test('fractional geometry rounds up at 4x and SVG raster dimensions match the PNG', () => {
    const document = {tables: [table('users', 0, 0), table('orders', 850, 180, [field('user_id')])], relationships: [relation({fromAnchor:{edge:'bottom',offset:.333},toAnchor:{edge:'top',offset:.667}})]}
    const {view,width,height} = erdPngSize(document), image = erdDiagramImage(document)
    assert.equal(width, Math.ceil(view.width * 4))
    assert.equal(height, Math.ceil(view.height * 4))
    assert.equal(image.width,width)
    assert.equal(image.height,height)
    assert.ok(image.svg.includes(`width="${width}" height="${height}" viewBox=`))
})
