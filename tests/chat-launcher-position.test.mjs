import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as positions from '../src/features/chat/chat-launcher-position.ts'

const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/chat/use-chat-launcher-position.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText
function harness(saved = {}, {unavailable = false} = {}) {
    const storage = new Map(Object.entries(saved)), events = new Map(), slots = [], pending = []
    let index = 0, result, user = 'alice', writes = 0
    const button = {offsetWidth: 44, offsetHeight: 44, getBoundingClientRect: () => ({left: result.style?.left ?? 1300, top: result.style?.top ?? 800}), setPointerCapture() {}, hasPointerCapture: () => false}
    const react = {
        useRef(value) {const i = index++; slots[i] ??= {current: value}; if (value === null && i === 0) slots[i].current = button; return slots[i]},
        useState(value) {const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], next => {slots[i] = typeof next === 'function' ? next(slots[i]) : next}]},
        useCallback(fn, deps) {const i = index++; if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) slots[i] = {fn, deps}; return slots[i].fn},
        useLayoutEffect(fn, deps) {const i = index++; if (!slots[i] || deps.some((dep, j) => dep !== slots[i].deps[j])) pending.push(() => {slots[i]?.cleanup?.(); slots[i] = {deps, cleanup: fn()}})},
    }
    const window = {innerWidth: 1440, innerHeight: 900, addEventListener: (name, fn) => events.set(name, fn), removeEventListener: name => events.delete(name)}
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => name === 'react' ? react : positions, window, localStorage: {
        getItem: key => {if (unavailable) throw Error('blocked'); return storage.get(key) ?? null},
        setItem: (key, value) => {if (unavailable) throw Error('blocked'); writes++; storage.set(key, value)}, removeItem: key => storage.delete(key),
    }})
    function render() {index = 0; result = exports.useChatLauncherPosition(user); while (pending.length) pending.shift()(); index = 0; result = exports.useChatLauncherPosition(user); return result}
    render()
    return {storage, get style() {return result.style}, get writes() {return writes},
        resize(width, height = 900) {window.innerWidth = width; window.innerHeight = height; events.get('resize')(); render()},
        drag(x, y) {const event = {pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, currentTarget: button}; result.onPointerDown(event); result.onPointerMove({...event, clientX: x - button.getBoundingClientRect().left, clientY: y - button.getBoundingClientRect().top}); result.onPointerUp({...event, type: 'pointerup'}); render()},
        switchUser(next) {user = next; render()}, unmount() {slots.forEach(slot => slot?.cleanup?.())}, events}
}
const key = 'devhub.chat-launcher-positions.v2:alice'
test('resizing clamps the display without overwriting a desktop preference, including height changes', () => {
    const h = harness({[key]: JSON.stringify({desktop: {x: 1300, y: 800}})})
    h.resize(1150, 500); assert.equal(h.style.left, 1098); assert.equal(h.style.top, 448)
    h.resize(1440, 900); assert.equal(h.style.left, 1300); assert.equal(h.style.top, 800)
    assert.equal(h.writes, 0)
})
test('phone, tablet and desktop drags persist separately and restore across resize and reload', () => {
    const h = harness(); h.drag(1200, 720)
    h.resize(390, 844); assert.equal(h.style, undefined); h.drag(30, 600)
    h.resize(820, 900); assert.equal(h.style, undefined); h.drag(600, 700)
    h.resize(1440); assert.equal(h.style.left, 1200); assert.equal(h.style.top, 720)
    h.resize(390, 844); assert.equal(h.style.left, 30); assert.equal(h.style.top, 600)
    const reloaded = harness(Object.fromEntries(h.storage)); reloaded.resize(820); assert.equal(reloaded.style.left, 600)
    assert.deepEqual(JSON.parse(h.storage.get(key)), {desktop: {x: 1200, y: 720}, phone: {x: 30, y: 600}, tablet: {x: 600, y: 700}})
})
test('preferences are scoped to the user and resize subscriptions are cleaned up', () => {
    const h = harness({[key]: JSON.stringify({desktop: {x: 400, y: 300}})})
    h.switchUser('bob'); assert.equal(h.style, undefined); h.drag(900, 600)
    h.switchUser('alice'); assert.equal(h.style.left, 400)
    h.unmount(); assert.equal(h.events.size, 0)
})
test('legacy position migrates once and invalid or unavailable storage does not prevent dragging', () => {
    const h = harness({'devhub.chat-launcher-position': JSON.stringify({x: 800, y: 500})})
    assert.equal(h.style.left, 800); assert.equal(h.storage.has('devhub.chat-launcher-position'), false)
    const invalid = harness({[key]: 'bad json'}); invalid.drag(200, 300); assert.equal(invalid.style.left, 200)
    const blocked = harness({}, {unavailable: true}); blocked.drag(200, 300); assert.equal(blocked.style.top, 300)
    assert.deepEqual(positions.readLauncherPositions('{"phone":{"x":"bad","y":5},"desktop":{"x":20,"y":30}}'), {desktop: {x: 20, y: 30}})
})
