import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as canvasView from '../src/features/workshop/canvas-view.ts'
import * as visibility from '../src/features/workshop/canvas-visibility.ts'
import * as connectionDrag from '../src/features/workshop/connection-drag.ts'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/tool-canvas.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText

function canvas(deferMoves = true) {
    const states = [], frames = new Map(), commits = [], history = []
    let cursor = 0, frameId = 0, selected = []
    const react = {
        useState(initial) {const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => {states[index] = typeof next === 'function' ? next(states[index]) : next}]},
        useRef(initial) {const index = cursor++; return states[index] ??= {current: initial}},
        useEffect() {}, useEffectEvent: callback => callback,
    }
    const exports = {}
    vm.runInNewContext(source, {exports, requestAnimationFrame: callback => {frames.set(++frameId, callback); return frameId}, cancelAnimationFrame: id => frames.delete(id), require: name => {
        if (name === 'react') return react
        if (name === './canvas-view') return canvasView
        if (name === './canvas-visibility') return visibility
        if (name === './connection-drag') return connectionDrag
        if (name === './use-canvas-touch') return {useCanvasTouch: () => ({})}
        if (name === './ideas/canvas-controls') return {ZoomControls: () => null}
        if (name === '@/components/ui/button') return {Button: 'button'}
        return require(name)
    }})
    const root = {clientWidth: 1000, clientHeight: 800, focus() {}, setPointerCapture() {}, getBoundingClientRect: () => ({left: 0, top: 0})}
    const event = (x, type = 'pointermove') => ({type, button: 0, pointerId: 1, clientX: x, clientY: 100, preventDefault() {}, stopPropagation() {}})
    function all(node, result = []) {
        if (Array.isArray(node)) node.forEach(child => all(child, result))
        else if (node?.props) {result.push(node); all(node.props.children, result)}
        return result
    }
    function render() {
        cursor = 0
        const result = exports.ToolCanvas({nodes: [{id: 'table', x: 0, y: 0, width: 300, height: 100}], selectedIds: selected, onSelect: ids => {selected = ids}, onMove: moves => commits.push(moves),
            renderNode: () => null, canEdit: true, deferMoves, beginTransaction: () => history.push('begin'), endTransaction: () => history.push('end')})
        result.props.ref.current = root
        return result
    }
    return {
        start() {all(render()).find(node => node.props.className?.startsWith('tool-node ')).props.onPointerDown(event(100, 'pointerdown'))},
        move(x) {render().props.onPointerMove(event(x))},
        release(x) {render().props.onPointerUp(event(x, 'pointerup'))},
        cancel() {render().props.onPointerCancel()},
        flush() {const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback())},
        previewX() {return all(render()).find(node => node.props.className?.startsWith('tool-node ')).props.style.left},
        frames, commits, history,
    }
}

test('drag previews use one animation frame and commit the final release position once', () => {
    const c = canvas()
    c.start(); c.move(185); c.move(270)
    assert.equal(c.commits.length, 0)
    assert.equal(c.frames.size, 1)
    c.flush()
    assert.equal(c.previewX(), 200)
    c.release(355)
    assert.equal(c.commits.length, 1)
    assert.equal(c.commits[0][0].x, 304)
    assert.deepEqual(c.history, ['begin', 'end'])
    assert.equal(c.frames.size, 0)
})

test('a cancelled deferred drag discards the preview without changing the document', () => {
    const c = canvas()
    c.start(); c.move(185); c.flush()
    assert.equal(c.previewX(), 104)
    c.cancel()
    assert.equal(c.previewX(), 0)
    assert.equal(c.commits.length, 0)
    assert.deepEqual(c.history, ['begin', 'end'])
})

test('a click does not commit a move, and other canvas tools retain immediate movement', () => {
    const deferred = canvas()
    deferred.start(); deferred.release(100)
    assert.equal(deferred.commits.length, 0)
    const immediate = canvas(false)
    immediate.start(); immediate.move(185)
    assert.equal(immediate.commits.length, 1)
    assert.equal(immediate.commits[0][0].x, 104)
})
