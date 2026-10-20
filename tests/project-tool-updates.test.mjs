import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/use-project-tool-updates.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText
function harness({enabled = true, token = 'token', failStart = false} = {}) {
    let index = 0, timerId = 0, key = {organizationId: 'org', projectId: 'project', tool: 'erd'}, fail = failStart
    const state = {auth: {accessToken: token, user: {id: 'user'}}}, slots = [], pending = [], connections = [], timers = new Map(), events = new Map(), changes = []
    const react = {
        useEffect(fn, deps) {const i = index++; if (!slots[i] || deps.some((value, j) => value !== slots[i].deps[j])) pending.push(() => {slots[i]?.cleanup?.(); slots[i] = {deps, cleanup: fn()}})},
        useEffectEvent(fn) {const i = index++; slots[i] ??= {}; slots[i].fn = fn; return (...args) => slots[i].fn(...args)},
    }
    class Connection {
        state = 'Disconnected'; handlers = {}; starts = 0; stops = 0; calls = []
        on(name, fn) {this.handlers[name] = fn}
        onclose(fn) {this.closed = fn}
        async start() {this.starts++; if (fail) throw Error('offline'); this.state = 'Connected'}
        async invoke(...args) {this.calls.push(args)}
        async stop() {this.stops++; this.state = 'Disconnected'; this.closed?.()}
    }
    class Builder {withUrl() {return this} build() {const c = new Connection(); connections.push(c); return c}}
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => {
        if (name === 'react') return react
        if (name === '@microsoft/signalr') return {HubConnectionBuilder: Builder, HubConnectionState: {Disconnected: 'Disconnected'}}
        if (name === '@/app/hooks') return {useAppSelector: fn => fn(state)}
        throw Error(name)
    }, window: {addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name)}, setTimeout: (fn, delay) => {timers.set(++timerId, {fn, delay}); return timerId}, clearTimeout: id => timers.delete(id)})
    function render() {index = 0; exports.useProjectToolUpdates(key, enabled, revision => changes.push(revision)); while (pending.length) pending.shift()()}
    render()
    return {connections, changes, timers, events, async settle() {for (let i = 0; i < 12; i++) await Promise.resolve()},
        switchProject(projectId) {key = {...key, projectId}; render()}, allowStart() {fail = false}, tick() {const items = [...timers.values()]; timers.clear(); items.forEach(item => item.fn())},
        unmount() {slots.forEach(slot => slot.cleanup?.())}}
}
test('live updates subscribe by project and filter unrelated tools, projects and invalid revisions', async () => {
    const h = harness(); await h.settle(); const c = h.connections[0]
    assert.deepEqual(Array.from(c.calls[0]), ['JoinProjectTools', 'org', 'project'])
    assert.equal(h.changes.length, 1)
    c.handlers.ProjectToolChanged('other', 'erd', 2); c.handlers.ProjectToolChanged('project', 'sdlc', 2); c.handlers.ProjectToolChanged('project', 'erd', -1)
    assert.equal(h.changes.length, 1)
    c.handlers.ProjectToolChanged('PROJECT', 'erd', 2); assert.equal(h.changes[1], 2)
    h.events.get('focus')(); assert.equal(h.changes.length, 3)
})
test('switching projects stops the old subscription and stale events cannot update the new project', async () => {
    const h = harness(); await h.settle(); const old = h.connections[0]
    h.switchProject('second'); await h.settle(); assert.equal(old.stops, 1)
    const count = h.changes.length; old.handlers.ProjectToolChanged('project', 'erd', 3); assert.equal(h.changes.length, count)
    assert.equal(h.connections[1].calls[0][2], 'second')
    h.unmount(); assert.equal(h.events.size, 0); assert.equal(h.connections[1].stops, 1)
})
test('failed connections retry with bounded backoff and reconnect resynchronizes the document', async () => {
    const h = harness({failStart: true}); await h.settle(); assert.equal([...h.timers.values()][0].delay, 1000)
    h.tick(); await h.settle(); assert.equal([...h.timers.values()][0].delay, 2000)
    h.allowStart(); h.tick(); await h.settle(); assert.equal(h.changes.length, 1)
    h.connections[0].state = 'Disconnected'; h.connections[0].closed(); h.tick(); await h.settle(); assert.equal(h.changes.length, 2)
    h.unmount(); assert.equal(h.timers.size, 0)
})
test('browser-only previews and signed-out users do not start shared subscriptions', async () => {
    assert.equal(harness({enabled: false}).connections.length, 0)
    assert.equal(harness({token: null}).connections.length, 0)
})
