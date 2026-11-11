import test from 'node:test'
import assert from 'node:assert/strict'
import {performance} from 'node:perf_hooks'
import {createErdDragPreview, fastErdRoutes} from '../src/features/workshop/erd-drag-routes.ts'
import {planErdRoutes} from '../src/features/workshop/erd-route-plan.ts'
import {createErdRoutingQueue} from '../src/features/workshop/erd-routing-protocol.ts'

const table = (id, x, y = 0) => ({id, name: id, x, y, fields: [{id: 'id', name: 'id'}, {id: 'parent', name: 'parent'}]})
const relation = (id, fromTable, toTable, extra = {}) => ({id, fromTable, toTable, fromField: 'id', toField: 'parent', cardinality: '1:N', ...extra})

test('drag previews retain allocated ports and unrelated connections without mutating the saved plan', () => {
    const a = table('a', 0), b = table('b', 500), c = table('c', 1000)
    const document = {tables: [a, b, c], relationships: [relation('ab', 'a', 'b', {fromAnchor: {edge: 'top', offset: .3}}), relation('bc', 'b', 'c')]}
    const plan = planErdRoutes(document), before = JSON.stringify(plan), preview = createErdDragPreview(plan)
    const moved = preview([{id: 'a', x: -50, y: 120}])
    assert.equal(moved[1], plan[1])
    assert.equal(moved[0].route.source.edge, plan[0].route.source.edge)
    assert.equal(moved[0].route.source.x, plan[0].route.source.x - 50)
    assert.equal(moved[0].route.source.y, plan[0].route.source.y + 120)
    assert.deepEqual(moved[0].route.target, plan[0].route.target)
    assert.equal(preview([]), plan, 'cancelling restores the exact settled graph')
    assert.equal(preview([{id: 'unconnected', x: 4, y: 8}]), plan)
    assert.equal(preview([{id: 'a', x: a.x, y: a.y}])[0], plan[0])
    assert.equal(JSON.stringify(plan), before)
})

test('group drags move both endpoints, including self relationships, from the original coordinates', () => {
    const document = {tables: [table('a', 0), table('b', 500)], relationships: [relation('ab', 'a', 'b'), relation('self', 'a', 'a')]}
    const plan = fastErdRoutes(document), preview = createErdDragPreview(plan)
    for (const dx of [20, 40, -200]) {
        const moved = preview([{id: 'a', x: dx, y: 80}, {id: 'b', x: 500 + dx, y: 80}])
        moved.forEach((connection, i) => {
            assert.equal(connection.route.source.x, plan[i].route.source.x + dx)
            assert.equal(connection.route.target.x, plan[i].route.target.x + dx)
            assert.equal(connection.route.source.y, plan[i].route.source.y + 80)
            assert.equal(connection.route.target.y, plan[i].route.target.y + 80)
            assert.ok(Object.values(connection.route.bounds).every(Number.isFinite))
        })
    }
})

test('500 tables and 2000 relationships update only incident lines within an interactive budget', () => {
    const tables = Array.from({length: 500}, (_, i) => table(`t${i}`, (i % 25) * 440, Math.floor(i / 25) * 280))
    const relationships = Array.from({length: 2000}, (_, i) => relation(`r${i}`, `t${i % 500}`, `t${(i * 17 + 1) % 500}`))
    const document = {tables, relationships}, original = JSON.stringify(document)
    const start = performance.now(), plan = fastErdRoutes(document), preview = createErdDragPreview(plan)
    assert.equal(plan.length, 2000)
    const incidentCount = relationships.filter(relation => relation.fromTable === 't0' || relation.toTable === 't0').length
    for (let frame = 1; frame <= 120; frame++) {
        const moved = preview([{id: 't0', x: frame * 8, y: frame * 2}])
        assert.equal(moved.filter((connection, i) => connection !== plan[i]).length, incidentCount)
    }
    assert.ok(performance.now() - start < 1500, 'initial geometry plus 120 drag updates must not run the full graph router')
    assert.equal(JSON.stringify(document), original)
})

test('routing queue skips obsolete drops and never applies an older worker result', () => {
    const sent = [], applied = [], queue = createErdRoutingQueue(request => sent.push(request), (document, response) => applied.push({document, response}))
    const a = {tables: [table('a', 0)], relationships: []}, b = {...a, tables: [table('a', 10)]}, c = {...a, tables: [table('a', 20)]}
    queue.request(a); queue.request(b); queue.request(c)
    assert.equal(sent.length, 1)
    queue.receive({id: 100, routes: [], crossings: new Map()})
    assert.equal(sent.length, 1, 'unexpected responses cannot release the running job')
    queue.receive({id: sent[0].id, routes: [], crossings: new Map()})
    assert.equal(applied.length, 0)
    assert.equal(sent.length, 2)
    assert.equal(sent[1].document, c, 'only the latest pending diagram is routed')
    queue.receive({id: sent[0].id, routes: [], crossings: new Map()})
    assert.equal(applied.length, 0)
    queue.receive({id: sent[1].id, routes: [], crossings: new Map()})
    assert.equal(applied.length, 1)
    assert.equal(applied[0].document, c)
})

test('fast initial geometry safely skips missing endpoints and keeps stable parallel lanes', () => {
    const document = {tables: [table('a', 0), table('b', 500)], relationships: [relation('z', 'a', 'b'), relation('broken', 'a', 'missing'), relation('a', 'b', 'a')]}
    const plan = fastErdRoutes(document)
    assert.deepEqual(plan.map(connection => connection.relation.id), ['z', 'a'])
    assert.deepEqual(plan.map(connection => connection.laneOffset), [16, 0])
    const reordered = fastErdRoutes({...document, relationships: [...document.relationships].reverse()})
    for (const connection of reordered) assert.equal(connection.route.path, plan.find(entry => entry.relation.id === connection.relation.id).route.path)
})
