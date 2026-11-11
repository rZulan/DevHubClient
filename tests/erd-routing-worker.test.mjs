import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as dragRoutes from '../src/features/workshop/erd-drag-routes.ts'
import * as protocol from '../src/features/workshop/erd-routing-protocol.ts'

const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/use-erd-route-plan.ts', import.meta.url), 'utf8').replace('import.meta.url', '"https://example.test/erd.js"'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText
const table = (id, x) => ({id, name: id, x, y: 0, fields: [{id: 'id'}, {id: 'parent'}]})
const document = () => ({tables: [table('a', 0), table('b', 500)], relationships: [{id: 'r', fromTable: 'a', toTable: 'b', fromField: 'id', toField: 'parent', cardinality: '1:N'}]})

function hook({unavailable = false, blocked = false} = {}) {
    const states = [], effects = [], cleanups = [], workers = []
    let cursor = 0
    const changed = (old, deps) => !old || deps.some((dep, i) => !Object.is(dep, old[i]))
    const react = {
        useState(initial) {const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], next => {states[i] = next}]},
        useRef(initial) {const i = cursor++; return states[i] ??= {current: initial}},
        useMemo(callback, deps) {const i = cursor++; if (changed(states[i]?.deps, deps)) states[i] = {deps, value: callback()}; return states[i].value},
        useEffect(callback, deps) {const i = cursor++; if (changed(states[i], deps)) {states[i] = deps; effects.push(() => {cleanups[i]?.(); cleanups[i] = callback()})}},
    }
    class FakeWorker {
        requests = []
        terminated = false
        constructor() {if (blocked) throw new Error('Workers blocked'); workers.push(this)}
        postMessage(request) {this.requests.push(request)}
        terminate() {this.terminated = true}
        complete(index = this.requests.length - 1) {
            const {id, document} = this.requests[index]
            const connections = dragRoutes.fastErdRoutes(document)
            this.onmessage({data: {id, routes: connections.map(({relation, route, laneOffset}) => ({id: relation.id, route: {...route, path: `${route.path} `}, laneOffset})), crossings: new Map([['r', [{x: 350, y: 66}]]])}})
        }
    }
    const exports = {}
    vm.runInNewContext(source, {exports, URL, Worker: unavailable ? undefined : FakeWorker, require(name) {
        if (name === 'react') return react
        if (name === './erd-drag-routes') return dragRoutes
        if (name === './erd-routing-protocol') return protocol
        throw new Error(`Unexpected dependency ${name}`)
    }})
    return {workers,
        render(document, enabled = true) {cursor = 0; const result = exports.useErdRoutePlan(document, enabled); effects.splice(0).forEach(effect => effect()); return result},
        unmount() {cleanups.forEach(cleanup => cleanup?.())},
    }
}

test('background routing shows immediate geometry, applies the worker result and preserves live drop coordinates', () => {
    const editor = hook(), first = document(), quick = editor.render(first)
    assert.equal(quick.connections.length, 1)
    assert.equal(quick.crossings.size, 0)
    assert.equal(editor.workers.length, 1)
    const worker = editor.workers[0]
    worker.complete()
    const settled = editor.render(first)
    assert.equal(settled.crossings.size, 1)
    assert.notEqual(settled.connections[0].route.path, quick.connections[0].route.path)
    const next = {...first, tables: [{...first.tables[0], x: -80, y: 120}, first.tables[1]]}
    const dropped = editor.render(next)
    assert.equal(dropped.connections[0].route.source.x, settled.connections[0].route.source.x - 80)
    assert.equal(dropped.connections[0].route.source.y, settled.connections[0].route.source.y + 120)
    assert.equal(dropped.crossings.size, 0)
    worker.complete()
    assert.equal(editor.render(next).crossings.size, 1)
    editor.unmount()
    assert.equal(worker.terminated, true)
})

test('hidden relationships stop the worker and do no routing until shown again', () => {
    const editor = hook(), first = document()
    assert.equal(editor.render(first, false).connections.length, 0)
    assert.equal(editor.workers.length, 0)
    assert.equal(editor.render(first, true).connections.length, 1)
    editor.render(first, false)
    assert.equal(editor.workers[0].terminated, true)
    editor.render(first, true)
    assert.equal(editor.workers.length, 2)
    assert.equal(editor.workers[1].requests.length, 1)
    editor.unmount()
})

test('unavailable, blocked or failed workers leave the ERD usable with current geometry', () => {
    for (const options of [{unavailable: true}, {blocked: true}, {}]) {
        const editor = hook(options), first = document()
        assert.equal(editor.render(first).connections.length, 1)
        if (editor.workers.length) editor.workers[0].onerror()
        const next = {...first, tables: [{...first.tables[0], x: 80}, first.tables[1]]}
        const plan = editor.render(next)
        assert.equal(plan.connections[0].from.x, 80)
        editor.unmount()
    }
})

test('schema edits cannot reuse obsolete endpoint geometry from the previous document', () => {
    const editor = hook(), first = document()
    editor.render(first); editor.workers[0].complete(); editor.render(first)
    const next = {...first, tables: [{...first.tables[0], name: 'renamed', fields: [{id: 'extra'}, ...first.tables[0].fields]}, first.tables[1]]}
    const plan = editor.render(next)
    assert.equal(plan.connections[0].from.name, 'renamed')
    assert.equal(plan.connections[0].route.source.y, 98)
    assert.equal(plan.crossings.size, 0)
    editor.unmount()
})
