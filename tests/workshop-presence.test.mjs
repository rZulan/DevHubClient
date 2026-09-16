import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

// Exercise the actual hook's effects using deterministic hook slots, transport and timers.
// This tests connection lifecycle behavior without a real server or browser timing.
const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/use-workshop-presence.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
function harness({ failStart = false, failJoin = false } = {}) {
  let index = 0, dirty = true, result, timerId = 0, fail = failStart
  const slots = [], pending = [], connections = [], requests = [], actions = [], timers = new Map()
  const state = { auth: { accessToken: 'token-1', user: { id: 'alice' } } }
  let ids = ['org-a', 'org-b']
  const dispatch = action => {
    if (action.presence) {
      requests.push([action.presence.organizationId, { status: action.presence.status }])
      return { abort() {}, reset() {}, unwrap: async () => [{ userId: 'bob', status: 'away' }] }
    }
    return actions.push(action)
  }
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]))
  const react = {
    createContext: () => ({}),
    useState(initial) {
      const i = index++
      slots[i] ??= { value: typeof initial === 'function' ? initial() : initial }
      return [slots[i].value, value => {
        const next = typeof value === 'function' ? value(slots[i].value) : value
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true }
      }]
    },
    useRef(initial) { const i = index++; slots[i] ??= { current: initial }; return slots[i] },
    useEffect(fn, deps) {
      const i = index++
      if (!same(slots[i]?.deps, deps)) {
        pending.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() } })
      }
    },
    useMemo(fn, deps) { const i = index++; if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() }; return slots[i].value },
  }
  class Connection {
    state = 'Disconnected'; handlers = {}; calls = []; starts = 0; stops = 0
    on(name, fn) { this.handlers[name] = fn }
    onclose(fn) { this.closed = fn }
    async start() { this.starts++; if (fail) throw Error('network'); this.state = 'Connected' }
    async stop() { this.stops++; const wasConnected = this.state !== 'Disconnected'; this.state = 'Disconnected'; if (wasConnected) this.closed?.() }
    async invoke(method, ...args) {
      this.calls.push([method, ...args])
      if (method === 'JoinOrganization' && failJoin) throw Error('temporary server error')
      return method === 'JoinOrganization' ? [{ userId: 'bob', status: 'online' }] : undefined
    }
  }
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible', hasFocus: () => true })
  const storage = new Map()
  const sandbox = { exports: {}, Map, Set, AbortController, AbortSignal, CustomEvent, window, document,
    localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v) },
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId },
    clearTimeout: id => timers.delete(id),
    fetch: async (url, options) => { requests.push([url, JSON.parse(options.body)]); return { ok: true, json: async () => [{ userId: 'bob', status: 'away' }] } },
    require: name => {
      if (name === 'react') return react
      if (name === '@microsoft/signalr') return { HubConnectionState: { Disconnected: 'Disconnected', Connected: 'Connected' }, HubConnectionBuilder: class {
        withUrl(_url, options) { this.options = options; return this }
        build() { const connection = new Connection(); connection.options = this.options; connections.push(connection); return connection }
      } }
      if (name === '@/app/hooks') return { useAppDispatch: () => dispatch, useAppSelector: selector => selector(state) }
      if (name === '@/services/api') return { api: { util: { invalidateTags: tags => tags }, endpoints: { updateWorkshopPresence: { initiate: presence => ({ presence }) } } } }
      if (name === '@/features/auth/sign-out-events') return { beforeSignOutEvent: 'sign-out' }
      throw Error(name)
    },
  }
  vm.runInNewContext(source, sandbox)
  async function flush() {
    for (let n = 0; n < 40; n++) {
      if (dirty) { dirty = false; index = 0; result = sandbox.exports.useWorkshopPresenceSession(ids); pending.splice(0).forEach(fn => fn()) }
      await Promise.resolve()
    }
  }
  return { flush, connections, requests, actions, timers, state,
    get result() { return result },
    recover() { fail = false },
    render() { dirty = true },
    setIds(next) { ids = next; dirty = true },
    fireTimer(predicate) { const item = [...timers].find(([, timer]) => predicate(timer.delay)); assert.ok(item); timers.delete(item[0]); item[1].fn() },
    dispose() { slots.forEach(slot => slot?.cleanup?.()) },
  }
}

test('all organizations share one connection and healthy sessions never heartbeat', async () => {
  const h = harness(); await h.flush()
  assert.equal(h.connections.length, 1)
  assert.deepEqual(h.connections[0].calls.map(c => c[0]), ['JoinOrganization', 'JoinOrganization'])
  assert.equal(h.requests.length, 0)
  h.result.setStatus('dnd'); await h.flush()
  assert.equal(h.connections.length, 1)
  assert.equal(h.connections[0].starts, 1)
  assert.equal(h.connections[0].calls.filter(c => c[0] === 'SetStatus').length, 2)
  assert.equal(h.requests.length, 0)
  h.state.auth.accessToken = 'token-2'; h.render(); await h.flush()
  assert.equal(h.connections[0].options.accessTokenFactory(), 'token-2')
  assert.equal(h.connections[0].starts, 1)
  h.dispose()
})

test('presence deltas are isolated by organization and duplicates preserve references', async () => {
  const h = harness(); await h.flush()
  const other = h.result.presence.get('org-b')
  h.connections[0].handlers.MemberStatusChanged('bob', 'away', 'org-a'); await h.flush()
  assert.equal(h.result.presence.get('org-a').get('bob'), 'away')
  assert.equal(h.result.presence.get('org-b'), other)
  const snapshot = h.result.presence
  h.connections[0].handlers.MemberStatusChanged('bob', 'away', 'org-a'); await h.flush()
  assert.equal(h.result.presence, snapshot)
  h.connections[0].handlers.MemberOffline('bob', 'org-a'); await h.flush()
  assert.equal(h.result.presence.get('org-a').has('bob'), false)
  h.dispose()
})

test('failed connection uses bounded fallback then stops heartbeats on recovery', async () => {
  const h = harness({ failStart: true }); await h.flush()
  assert.equal(h.requests.length, 2)
  assert.ok([...h.timers.values()].some(t => t.delay >= 40000))
  h.recover(); h.fireTimer(delay => delay >= 1600 && delay <= 2400); await h.flush()
  assert.equal(h.connections[0].starts, 2)
  assert.equal(h.result.presence.get('org-a').get('bob'), 'online')
  assert.equal([...h.timers.values()].some(t => t.delay >= 40000), false)
  assert.equal(h.requests.length, 2)
  h.dispose()
})

test('join errors stop the connected transport and schedule a real retry', async () => {
  const h = harness({ failJoin: true }); await h.flush()
  assert.equal(h.connections[0].state, 'Disconnected')
  assert.ok(h.connections[0].stops > 0)
  assert.ok([...h.timers.values()].some(t => t.delay >= 1600 && t.delay < 40000))
  h.dispose()
})

test('membership changes dispose the old session; cleanup removes retry and heartbeat timers', async () => {
  const h = harness(); await h.flush()
  h.setIds(['org-b']); await h.flush()
  assert.equal(h.connections.length, 2)
  assert.equal(h.connections[0].state, 'Disconnected')
  assert.equal(h.result.presence.has('org-a'), false)
  h.dispose()
  assert.equal(h.timers.size, 0)
})
