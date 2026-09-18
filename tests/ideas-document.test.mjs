import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { decodeShapes, encodeShapes, defaultTextStyle, normalizeCanvasItem } from '../src/features/workshop/shape-clipboard.ts'

const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/use-ideas-document.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const shape = { ...defaultTextStyle, id: 'one', x: 0, y: 0, width: 100, height: 100, appearance: 'fill', fillColor: '#ffffff', outlineColor: '#000000', outlineWidth: 2, outlineStyle: 'solid', cornerRadius: 0, text: 'hello', textAlign: 'center', verticalAlign: 'center' }

function harness({ document = { revision: 0, items: [] }, draft, canWrite = true, loadError = false } = {}) {
  let index = 0, dirty = false, value, cleanup, timerId = 0
  const slots = [], effects = [], timers = new Map(), storage = new Map(), saves = []
  const storageKey = 'devhub.ideas-draft:user:org:project'
  if (draft) storage.set(storageKey, JSON.stringify(draft))
  const react = {
    useState(initial) { const i = index++; slots[i] ??= { value: initial }; return [slots[i].value, (next) => { slots[i].value = next; dirty = true }] },
    useRef(initial) { const i = index++; slots[i] ??= { current: initial }; return slots[i] },
    useEffect(fn) { const i = index++; if (!slots[i]) { slots[i] = true; effects.push(fn) } },
    useEffectEvent(fn) { const i = index++; slots[i] ??= {}; slots[i].fn = fn; return (...args) => slots[i].fn(...args) },
  }
  const dispatch = (action) => ({ reset() {}, unwrap: () => action.type === 'get'
    ? loadError ? Promise.reject(new Error('offline')) : Promise.resolve(document)
    : new Promise((resolve, reject) => saves.push({ ...action.args, resolve, reject })) })
  const exports = {}
  const events = { addEventListener() {}, removeEventListener() {} }
  vm.runInNewContext(source, { exports, require: (name) => {
    if (name === 'react') return react
    if (name === '@/app/hooks') return { useAppDispatch: () => dispatch }
    if (name === './shape-clipboard') return { decodeShapes, encodeShapes, normalizeCanvasItem }
    if (name === './ideas-api') return { ideasApi: { endpoints: { getIdeas: { initiate: (args) => ({ type: 'get', args }) }, saveIdeas: { initiate: (args) => ({ type: 'save', args }) } } } }
    throw Error(name)
  }, localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, val) => storage.set(key, val), removeItem: (key) => storage.delete(key) }, window: events, document: events,
  setTimeout: (fn) => { timers.set(++timerId, fn); return timerId }, clearTimeout: (id) => timers.delete(id) })
  function render() { index = 0; dirty = false; value = exports.useIdeasDocument({ organizationId: 'org', projectId: 'project' }, 'user', canWrite) }
  render()
  cleanup = effects[0]()
  return {
    get value() { if (dirty) render(); return value }, saves, storage,
    async settle() { for (let i = 0; i < 8; i++) { await Promise.resolve(); if (dirty) render() } },
    tick() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((fn) => fn()) },
    unmount() { cleanup() },
  }
}

test('loading never writes an empty canvas over saved content', async () => {
  const h = harness({ document: { revision: 5, items: [shape] } })
  h.value.setItems([])
  await h.settle()
  assert.equal(h.value.items[0].text, 'hello')
  assert.equal(h.saves.length, 0)
})

test('autosave serializes requests and saves edits made during an in-flight save', async () => {
  const h = harness()
  await h.settle()
  h.value.setItems([shape]); h.tick()
  h.value.setItems([{ ...shape, text: 'latest' }]); h.tick()
  assert.equal(h.saves.length, 1)
  h.saves[0].resolve({ revision: 1, items: [shape] }); await h.settle()
  assert.equal(h.saves.length, 2)
  assert.equal(h.saves[1].revision, 1)
  assert.equal(h.saves[1].items[0].text, 'latest')
  h.saves[1].resolve({ revision: 2 }); await h.settle()
  assert.equal(h.value.status, 'saved')
  assert.equal(h.storage.size, 0)
})

test('manual save flushes pending edits immediately', async () => {
  const h = harness(); await h.settle()
  h.value.setItems([shape])
  h.value.save()
  assert.equal(h.saves.length, 1)
  assert.equal(h.saves[0].items[0].text, 'hello')
  h.saves[0].resolve({ revision: 1, items: [shape] }); await h.settle()
  assert.equal(h.value.status, 'saved')
})

test('conflicts preserve the draft and block further writes', async () => {
  const h = harness(); await h.settle()
  h.value.setItems([shape]); h.tick()
  h.saves[0].reject({ status: 409 }); await h.settle()
  assert.equal(h.value.status, 'conflict')
  h.value.setItems([]); h.value.retry(); h.tick()
  assert.equal(h.value.items.length, 1)
  assert.equal(h.saves.length, 1)
  assert.equal(h.storage.size, 1)
})

test('navigation flushes pending edits to the original project', async () => {
  const h = harness(); await h.settle()
  h.value.setItems([shape]); h.unmount()
  assert.equal(h.saves.length, 1)
  assert.equal(h.saves[0].projectId, 'project')
})

test('recovery restores and saves a compatible local draft', async () => {
  const h = harness({ draft: { revision: 0, document: encodeShapes([shape]) } }); await h.settle()
  assert.equal(h.value.items[0].text, 'hello')
  assert.equal(h.saves.length, 1)
})

test('failed loads and read-only access cannot save', async () => {
  for (const options of [{ loadError: true }, { canWrite: false }]) {
    const h = harness(options); await h.settle(); h.value.setItems([shape]); h.tick()
    assert.equal(h.saves.length, 0)
  }
})

test('a remote revision updates a clean canvas immediately', async () => {
  const h = harness({ document: { revision: 2, items: [shape] } }); await h.settle()
  h.value.applyRemote({ revision: 3, items: [{ ...shape, text: 'remote' }] })
  assert.equal(h.value.items[0].text, 'remote')
  assert.equal(h.value.status, 'saved')
  assert.equal(h.saves.length, 0)
})

test('remote revisions preserve dirty local shapes and rebase their save', async () => {
  const h = harness({ document: { revision: 5, items: [shape] } }); await h.settle()
  h.value.setItems([{ ...shape, text: 'local' }])
  const remoteShape = { ...shape, id: 'two', text: 'from teammate' }
  h.value.applyRemote({ revision: 6, items: [{ ...shape, text: 'remote' }, remoteShape] })
  assert.deepEqual(Array.from(h.value.items, item => item.text), ['local', 'from teammate'])
  h.tick()
  assert.equal(h.saves.length, 1)
  assert.equal(h.saves[0].revision, 6)
  assert.deepEqual(Array.from(h.saves[0].items, item => item.text), ['local', 'from teammate'])
})

test('concurrent additions do not make untouched local shapes overwrite teammate edits', async () => {
  const h = harness({ document: { revision: 8, items: [shape] } }); await h.settle()
  const localShape = { ...shape, id: 'local', text: 'local addition' }
  h.value.setItems([h.value.items[0], localShape])
  const remoteShape = { ...shape, id: 'remote', text: 'remote addition' }
  h.value.applyRemote({ revision: 9, items: [{ ...shape, text: 'teammate updated this' }, remoteShape] })
  assert.deepEqual(Array.from(h.value.items, item => item.text), ['teammate updated this', 'remote addition', 'local addition'])
})
