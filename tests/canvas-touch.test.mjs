import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {pinchView} from '../src/features/workshop/canvas-view.ts'
const source = ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/use-canvas-touch.ts', import.meta.url), 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText
function harness() {
    const views = [], captures = []; let starts = 0
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => name === 'react' ? {useRef: value => ({current: value})} : {pinchView}})
    const root = {current: {getBoundingClientRect: () => ({left: 20, top: 40}), setPointerCapture: id => captures.push(id)}}
    const handlers = exports.useCanvasTouch(root, {zoom: 1, pan: {x: 0, y: 0}}, view => views.push(view), () => starts++)
    function event(id, x = 100, y = 100, blocked = false, pointerType = 'touch') {
        return {pointerId: id, clientX: x + 20, clientY: y + 40, pointerType, target: {closest: () => blocked}, prevented: false, stopped: false,
            preventDefault() {this.prevented = true}, stopPropagation() {this.stopped = true}}
    }
    return {handlers, event, views, captures, get starts() {return starts}}
}
test('single-finger edits and controls are left alone; a second canvas finger takes over navigation', () => {
    const h = harness(), first = h.event(1, 50, 100), second = h.event(2, 150, 100)
    h.handlers.onPointerDownCapture(h.event(0, 0, 0, false, 'mouse'))
    h.handlers.onPointerDownCapture(h.event(3, 0, 0, true))
    h.handlers.onPointerDownCapture(first); assert.equal(first.stopped, false); assert.equal(h.starts, 0)
    h.handlers.onPointerDownCapture(second); assert.equal(second.stopped, true); assert.equal(h.starts, 1)
    h.handlers.onPointerMoveCapture(h.event(2, 250, 100))
    assert.equal(h.views.at(-1).zoom, 2); assert.equal(h.views.at(-1).pan.x, -50)
    assert.deepEqual(h.captures, [2])
})
test('extra fingers cannot start edits, and remaining fingers do not edit until the pinch ends', () => {
    const h = harness()
    h.handlers.onPointerDownCapture(h.event(1, 50, 100)); h.handlers.onPointerDownCapture(h.event(2, 150, 100))
    const extra = h.event(3); h.handlers.onPointerDownCapture(extra); assert.equal(extra.stopped, true); assert.equal(h.starts, 1)
    h.handlers.onPointerUpCapture(h.event(2))
    const remaining = h.event(1, 200, 200); h.handlers.onPointerMoveCapture(remaining); assert.equal(remaining.stopped, true); assert.equal(h.views.length, 0)
    h.handlers.onPointerCancelCapture(h.event(1))
    const next = h.event(4); h.handlers.onPointerDownCapture(next); assert.equal(next.stopped, false)
    h.handlers.onPointerDownCapture(h.event(5, 200, 200)); assert.equal(h.starts, 2)
})
