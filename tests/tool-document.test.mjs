import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {emptyDocuments, validToolDocument} from '../src/features/workshop/tool-documents.ts'
import {switchSdlcModel, startSdlcCycle, startSdlcRelease} from '../src/features/workshop/sdlc-document.ts'

const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/use-tool-document.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText
const document = {model: 'waterfall', currentPhase: 2, completed: false, notes: {implementation: 'saved'}}
function harness({saved = {revision: 4, document}, draft, canWrite = true, persisted = true, loadError = false, storageError = false} = {}) {
    let index = 0, dirty = false, value, timerId = 0, notify, serverDocument = saved
    const slots = [], effects = [], timers = new Map(), storage = new Map(), saves = [], events = new Map()
    const storageKey = 'devhub.tool-document:user:org:project:sdlc'
    if (draft) storage.set(storageKey, JSON.stringify(draft))
    const react = {
        useState(initial) {const i = index++; slots[i] ??= {value: initial}; return [slots[i].value, next => {slots[i].value = typeof next === 'function' ? next(slots[i].value) : next; dirty = true}]},
        useRef(initial) {const i = index++; slots[i] ??= {current: initial}; return slots[i]},
        useEffect(fn) {const i = index++; if (!slots[i]) {slots[i] = true; effects.push(fn)}},
        useEffectEvent(fn) {const i = index++; slots[i] ??= {}; slots[i].fn = fn; return (...args) => slots[i].fn(...args)},
    }
    const dispatch = action => ({unwrap: () => action.type === 'get' ? loadError ? Promise.reject(new Error('offline')) : Promise.resolve(serverDocument) : new Promise((resolve, reject) => saves.push({...action.args, resolve, reject}))})
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => {
        if (name === 'react') return react
        if (name === '@/app/hooks') return {useAppDispatch: () => dispatch}
        if (name === './use-project-tool-updates') return {useProjectToolUpdates: (_key, _enabled, callback) => {notify = callback}}
        if (name === './tool-documents') return {emptyDocuments, validToolDocument}
        if (name === './tool-documents-api') return {toolDocumentsApi: {endpoints: {getToolDocument: {initiate: args => ({type: 'get', args})}, saveToolDocument: {initiate: args => ({type: 'save', args})}}}}
        throw Error(name)
    }, localStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, text) => {if (storageError) throw Error('blocked'); storage.set(key, text)}},
    window: {addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name)},
    setTimeout: fn => {timers.set(++timerId, fn); return timerId}, clearTimeout: id => timers.delete(id)})
    function render() {index = 0; dirty = false; value = exports.useToolDocument({organizationId: 'org', projectId: 'project', tool: 'sdlc'}, 'user', canWrite, persisted)}
    render(); const cleanup = effects[0]()
    return {get value() {if (dirty) render(); return value}, saves, storage, storageKey, events,
        async settle() {for (let i = 0; i < 10; i++) {await Promise.resolve(); if (dirty) render()}},
        remote(saved) {serverDocument = saved; notify(saved.revision)},
        tick() {const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn())}, unmount: cleanup}
}
test('loading and failed loads never overwrite saved project content', async () => {
    const h = harness(); h.value.setDocument(emptyDocuments.sdlc); await h.settle()
    assert.equal(h.value.document.currentPhase, 2); assert.equal(h.saves.length, 0)
    const failed = harness({loadError: true}); await failed.settle(); failed.value.setDocument(document)
    assert.equal(failed.value.status, 'load-error'); assert.equal(failed.saves.length, 0)
})
test('read-only members ignore editable local drafts and cannot save', async () => {
    const h = harness({canWrite: false, draft: {revision: 4, pending: true, document: {...document, currentPhase: 5}}})
    await h.settle(); h.value.setDocument(emptyDocuments.sdlc); h.tick()
    assert.equal(h.value.document.currentPhase, 2); assert.equal(h.saves.length, 0)
})
test('autosave serializes requests and includes edits made during an in-flight save', async () => {
    const h = harness(); await h.settle()
    h.value.setDocument({...document, currentPhase: 3}); h.tick()
    h.value.setDocument({...document, currentPhase: 4}); h.tick()
    assert.equal(h.saves.length, 1)
    h.saves[0].resolve({revision: 5}); await h.settle()
    assert.equal(h.saves.length, 2); assert.equal(h.saves[1].revision, 5); assert.equal(h.saves[1].document.currentPhase, 4)
    h.saves[1].resolve({revision: 6}); await h.settle()
    assert.equal(h.value.status, 'saved'); assert.equal(JSON.parse(h.storage.get(h.storageKey)).pending, false)
})
test('conflicts freeze editing and preserve the draft until explicit reload', async () => {
    const h = harness(); await h.settle(); h.value.setDocument({...document, currentPhase: 3}); h.tick()
    h.saves[0].reject({status: 409}); await h.settle()
    h.value.setDocument(emptyDocuments.sdlc); await h.value.save()
    assert.equal(h.value.status, 'conflict'); assert.equal(h.value.document.currentPhase, 3); assert.equal(h.saves.length, 1)
    h.value.reload(); await h.settle(); assert.equal(h.value.document.currentPhase, 2); assert.equal(h.value.status, 'saved')
})
test('recovery retries current drafts and protects stale drafts', async () => {
    const h = harness({draft: {revision: 4, pending: true, document: {...document, currentPhase: 3}}}); await h.settle()
    assert.equal(h.saves.length, 1); assert.equal(h.saves[0].document.currentPhase, 3)
    const stale = harness({draft: {revision: 1, pending: true, document: {...document, currentPhase: 3}}}); await stale.settle()
    assert.equal(stale.value.status, 'conflict'); assert.equal(stale.saves.length, 0)
    const malformed = harness({draft: {revision: 4, pending: true, document: {}}}); await malformed.settle()
    assert.equal(malformed.value.status, 'saved'); assert.equal(malformed.value.document.currentPhase, 2)
})
test('drag transactions produce one undo step with redo', async () => {
    const h = harness(); await h.settle(); h.value.beginTransaction()
    h.value.setDocument({...document, currentPhase: 3}); h.value.setDocument({...document, currentPhase: 4}); h.value.endTransaction()
    h.value.undo(); assert.equal(h.value.document.currentPhase, 2); assert.equal(h.value.canUndo, false)
    h.value.redo(); assert.equal(h.value.document.currentPhase, 4)
})
test('navigation flushes pending saves and Ctrl+S uses the same save queue', async () => {
    const h = harness(); await h.settle(); h.value.setDocument({...document, currentPhase: 3}); h.unmount()
    assert.equal(h.saves.length, 1)
    const shortcut = harness(); await shortcut.settle(); shortcut.value.setDocument({...document, currentPhase: 3})
    let prevented = false; shortcut.events.get('keydown')({ctrlKey: true, key: 's', preventDefault() {prevented = true}})
    assert.equal(prevented, true); assert.equal(shortcut.saves.length, 1)
})
test('local preview documents never call the API and cannot report a save when storage is blocked', async () => {
    const h = harness({persisted: false}); await h.settle(); h.value.setDocument(document); h.tick(); await h.settle()
    assert.equal(h.value.status, 'saved'); assert.equal(h.saves.length, 0)
    const blocked = harness({persisted: false, storageError: true}); await blocked.settle(); blocked.value.setDocument(document); blocked.tick(); await blocked.settle()
    assert.equal(blocked.value.status, 'error'); assert.equal(blocked.saves.length, 0)
})
test('teammate saves update a clean or view-only document without writing it back', async () => {
    for (const canWrite of [true, false]) {
        const h = harness({canWrite}); await h.settle()
        h.remote({revision: 5, document: {...document, currentPhase: 4}}); await h.settle()
        assert.equal(h.value.document.currentPhase, 4); assert.equal(h.value.status, 'saved'); assert.equal(h.saves.length, 0)
        h.remote({revision: 3, document}); await h.settle(); assert.equal(h.value.document.currentPhase, 4)
    }
})
test('teammate saves protect a pending draft and block stale autosave', async () => {
    const h = harness(); await h.settle(); h.value.setDocument({...document, currentPhase: 3})
    h.remote({revision: 5, document: {...document, currentPhase: 4}}); await h.settle(); h.tick()
    assert.equal(h.value.status, 'conflict'); assert.equal(h.value.document.currentPhase, 3); assert.equal(h.saves.length, 0)
    assert.equal(JSON.parse(h.storage.get(h.storageKey)).document.currentPhase, 3)
    h.value.reload(); await h.settle(); assert.equal(h.value.document.currentPhase, 4)
})
test('own save echoes preserve edits made during an in-flight save', async () => {
    const h = harness(); await h.settle(); h.value.setDocument({...document, currentPhase: 3}); h.tick()
    h.remote({revision: 5, document: {...document, currentPhase: 3}}); await h.settle()
    h.value.setDocument({...document, currentPhase: 4})
    h.saves[0].resolve({revision: 5}); await h.settle()
    assert.equal(h.saves.length, 2); assert.equal(h.saves[1].document.currentPhase, 4); assert.equal(h.value.status, 'saving')
})
test('a newer peer revision during saving cannot be overwritten by queued edits', async () => {
    const h = harness(); await h.settle(); h.value.setDocument({...document, currentPhase: 3}); h.tick()
    h.value.setDocument({...document, currentPhase: 4})
    h.remote({revision: 6, document: {...document, currentPhase: 5}}); await h.settle()
    h.saves[0].resolve({revision: 5}); await h.settle()
    assert.equal(h.value.status, 'conflict'); assert.equal(h.value.document.currentPhase, 4); assert.equal(h.saves.length, 1)
})

test('multi-model progress and cycle history use the same save, recovery, undo and permission boundaries', async () => {
    let mixed=switchSdlcModel(document,'agile')
    mixed=startSdlcCycle({...mixed,currentPhase:6,completed:true,notes:{review:'Keep this feedback'}})
    mixed={...mixed,notes:{backlog:'Next increment'}}
    const h=harness(); await h.settle(); h.value.setDocument(mixed); h.tick()
    assert.deepEqual(h.saves[0].document,mixed)
    h.saves[0].resolve({revision:5}); await h.settle()
    const draft=JSON.parse(h.storage.get(h.storageKey))
    const recovered=harness({persisted:false,draft}); await recovered.settle()
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.value.document)),mixed)
    h.value.setDocument(value=>switchSdlcModel(value,'v-model'))
    h.value.undo(); assert.deepEqual(h.value.document,mixed)
    h.value.redo(); assert.equal(h.value.document.model,'v-model')
    const viewer=harness({canWrite:false,saved:{revision:5,document:mixed}}); await viewer.settle()
    viewer.value.setDocument(value=>switchSdlcModel(value,'waterfall')); viewer.tick()
    assert.deepEqual(viewer.value.document,mixed)
    assert.equal(viewer.saves.length,0)
})

test('the Iterative release decision saves, recovers and undoes with the rest of the roadmap', async () => {
    const evaluated={model:'iterative',currentPhase:5,completed:true,notes:{evaluate:'Ready to release'}}
    const released=startSdlcRelease(evaluated)
    const h=harness({saved:{revision:4,document:evaluated}}); await h.settle()
    h.value.setDocument(startSdlcRelease); h.tick()
    assert.deepEqual(h.saves[0].document,released)
    h.saves[0].resolve({revision:5}); await h.settle()
    const recovered=harness({persisted:false,draft:JSON.parse(h.storage.get(h.storageKey))}); await recovered.settle()
    assert.deepEqual(JSON.parse(JSON.stringify(recovered.value.document)),released)
    h.value.undo(); assert.deepEqual(h.value.document,evaluated)
    h.value.redo(); assert.deepEqual(h.value.document,released)
    const viewer=harness({canWrite:false,saved:{revision:5,document:evaluated}}); await viewer.settle()
    viewer.value.setDocument(startSdlcRelease); viewer.tick()
    assert.equal(viewer.value.document.release,undefined)
    assert.equal(viewer.saves.length,0)
})
