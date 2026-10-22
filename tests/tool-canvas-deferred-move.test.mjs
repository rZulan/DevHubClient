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

function canvas(deferMoves = true, overrides = {}) {
    const states = [], frames = new Map(), commits = [], history = []
    let cursor = 0, frameId = 0, selected = [], effectEventCursor = 0, wheelHandler
    const react = {
        useState(initial) {const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], next => {states[index] = typeof next === 'function' ? next(states[index]) : next}]},
        useRef(initial) {const index = cursor++; return states[index] ??= {current: initial}},
        useEffect() {}, useEffectEvent: callback => {if(effectEventCursor++===0) wheelHandler=callback; return callback},
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
    const root = {clientWidth: 1000, clientHeight: 800, focus() {}, setPointerCapture() {}, querySelector: () => null, getBoundingClientRect: () => ({left: 0, top: 0})}
    const event = (x, type = 'pointermove') => ({type, button: 0, pointerId: 1, clientX: x, clientY: 100, preventDefault() {}, stopPropagation() {}})
    function all(node, result = []) {
        if (Array.isArray(node)) node.forEach(child => all(child, result))
        else if (node?.props) {result.push(node); all(node.props.children, result)}
        return result
    }
    function render() {
        cursor = 0
        effectEventCursor = 0
        const result = exports.ToolCanvas({nodes: [{id: 'table', x: 0, y: 0, width: 300, height: 100}], selectedIds: selected, onSelect: ids => {selected = ids}, onMove: moves => commits.push(moves),
            renderNode: () => null, canEdit: true, deferMoves, beginTransaction: () => history.push('begin'), endTransaction: () => history.push('end'), ...overrides})
        result.props.ref.current = root
        return result
    }
    return {
        start() {all(render()).find(node => node.props.className?.startsWith('tool-node ')).props.onPointerDown(event(100, 'pointerdown'))},
        move(x) {render().props.onPointerMove(event(x))},
        release(x) {render().props.onPointerUp(event(x, 'pointerup'))},
        cancel() {render().props.onPointerCancel()},
        capture(options = {}) {
            const event = {...eventForPan(options), defaultPrevented: false, stopped: false, preventDefault() {this.defaultPrevented = true}, stopPropagation() {this.stopped = true}}
            render().props.onPointerDownCapture(event)
            return {prevented: event.defaultPrevented, stopped: event.stopped}
        },
        clickCapture(control = false, detail = 1, double = false) {
            const event = {detail, target: {closest: () => control ? {} : null}, prevented: false, stopped: false, preventDefault() {this.prevented = true}, stopPropagation() {this.stopped = true}}
            render().props[double ? 'onDoubleClickCapture' : 'onClickCapture'](event)
            return {prevented: event.prevented, stopped: event.stopped}
        },
        keyUpSpace() {render().props.onKeyUp({code: 'Space'})},
        isPanning() {return render().props.className.split(' ').includes('panning')},
        pan() {const s = render().props.style; return [parseFloat(s['--canvas-pan-x']), parseFloat(s['--canvas-pan-y'])]},
        zoom() {return render().props.style['--canvas-zoom']},
        wheel(deltaY) {render(); wheelHandler({deltaY,deltaMode:0,clientX:500,clientY:400,preventDefault(){}})},
        flush() {const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback())},
        previewX() {return all(render()).find(node => node.props.className?.startsWith('tool-node ')).props.style.left},
        key(key, options = {}) {
            const event = {key, code: key === ' ' ? 'Space' : '', ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, repeat: false, defaultPrevented: false, target: {closest: () => options.editing ? {} : null}, preventDefault() {this.defaultPrevented = true}, ...options}
            render().props.onKeyDown(event)
            return event.defaultPrevented
        },
        clipboard(kind, text = '', editing = false) {
            let copied = ''
            const event = {target: {closest: () => editing ? {} : null}, clipboardData: {getData: () => text, setData: (_type, value) => {copied = value}}, defaultPrevented: false, preventDefault() {this.defaultPrevented = true}}
            render().props[kind](event)
            return {copied, prevented: event.defaultPrevented}
        },
        isHand() {return render().props.className.includes('hand-tool')},
        selection() {return selected},
        frames, commits, history,
    }
}

function eventForPan({button = 0, control = false} = {}) {
    return {type: 'pointerdown', button, pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, target: {closest: () => control ? {} : null}}
}

test('middle-mouse panning captures child gestures, shows dragging state, and never changes the document', () => {
    const c = canvas()
    assert.deepEqual(c.capture({button: 1}), {prevented: true, stopped: true})
    assert.equal(c.isHand(), true); assert.equal(c.isPanning(), true)
    c.move(185)
    assert.deepEqual(c.pan(), [135, 100])
    assert.equal(c.commits.length, 0); assert.equal(c.history.length, 0)
    assert.deepEqual(c.selection(), [])
    c.release(185)
    assert.equal(c.isHand(), false); assert.equal(c.isPanning(), false)
    assert.equal(c.clickCapture().stopped, true, 'pan release cannot click a field, connection, or add-column button')
    c.capture()
    assert.equal(c.clickCapture().stopped, false, 'the next normal interaction still works')
})

test('wheel zoom accumulates every delta in one frame while preserving the pointer anchor', () => {
    const c=canvas(), before=c.pan(), zoom=c.zoom()
    c.wheel(80); c.wheel(40); c.wheel(-20)
    assert.equal(c.frames.size,1)
    assert.equal(c.zoom(),zoom,'wheel events do not each reconcile the diagram')
    c.flush()
    const expected=zoom*Math.exp(-100*.0015)
    assert.ok(Math.abs(c.zoom()-expected)<1e-12,'no input delta is lost')
    const after=c.pan()
    assert.ok(Math.abs((500-before[0])/zoom-(500-after[0])/c.zoom())<1e-9)
    assert.ok(Math.abs((400-before[1])/zoom-(400-after[1])/c.zoom())<1e-9)
    c.wheel(20); c.capture({button:1})
    assert.equal(c.frames.size,0,'starting a gesture cancels a pending zoom')
})

test('node renderers receive the current zoom for readable detail transitions', () => {
    const levels=[]
    const c=canvas(true,{renderNode:(_node,view)=>{levels.push(view.zoom); return null}})
    assert.equal(c.zoom(),.85)
    c.key('-',{ctrlKey:true})
    assert.equal(c.zoom(),.85/1.2)
    assert.equal(levels.at(-1),c.zoom())
})

test('Hand and Space capture panning before child controls while toolbar and keyboard activation remain usable', () => {
    for (const mode of ['h', ' ']) {
        const c = canvas()
        c.key(mode)
        assert.deepEqual(c.capture({control: true}), {prevented: false, stopped: false})
        assert.equal(c.clickCapture(true).stopped, false)
        assert.equal(c.clickCapture(false, 0).stopped, false, 'keyboard activation is not a pointer pan')
        assert.deepEqual(c.capture(), {prevented: true, stopped: true})
        c.move(200); c.release(200)
        assert.equal(c.clickCapture().stopped, true)
        assert.equal(c.clickCapture(false, 2, true).stopped, true, 'double-click does not rename a field in pan mode')
        assert.equal(c.commits.length, 0); assert.equal(c.history.length, 0)
        if (mode === 'h') c.key('v'); else c.keyUpSpace()
        c.capture()
        assert.equal(c.isHand(), false)
        assert.equal(c.clickCapture().stopped, false)
    }
    const cancelled = canvas()
    cancelled.capture({button: 1}); cancelled.cancel()
    assert.equal(cancelled.isPanning(), false); assert.equal(cancelled.isHand(), false)
})

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

test('canvas shortcuts support both platforms and do not duplicate repeats or hijack text fields', () => {
    const actions = []
    const c = canvas(true, {onDuplicate: offset => actions.push(['duplicate', offset]), undo: () => actions.push(['undo']), redo: () => actions.push(['redo']), onDelete: () => actions.push(['delete'])})
    assert.equal(c.key('d', {ctrlKey: true}), true)
    c.key('d', {ctrlKey: true, repeat: true})
    c.key('d', {metaKey: true})
    c.key('z', {ctrlKey: true}); c.key('z', {metaKey: true, shiftKey: true}); c.key('y', {ctrlKey: true})
    c.key('Delete')
    assert.deepEqual(actions.map(action => action[0]), ['duplicate', 'duplicate', 'undo', 'redo', 'redo', 'delete'])
    assert.equal(actions[0][1], 24 / .85)
    for (const key of ['d', 'a', 'z', 'y', 'Delete']) assert.equal(c.key(key, {ctrlKey: true, editing: true}), false)
    assert.equal(actions.length, 6)
    c.key('h'); assert.equal(c.isHand(), true)
    c.key('v', {ctrlKey: true}); assert.equal(c.isHand(), true)
    c.key('v'); assert.equal(c.isHand(), false)
    c.start(); c.key('d', {ctrlKey: true}); assert.equal(actions.length, 6)
})

test('clipboard events preserve native text editing, cut only after copying, and offset repeated pastes', () => {
    const actions = [], offsets = []
    const c = canvas(true, {onCopy: () => 'erd-clipboard', onDelete: () => actions.push('delete'), onPaste: (_text, offset) => {offsets.push(offset); return true}})
    assert.deepEqual(c.clipboard('onCopy'), {copied: 'erd-clipboard', prevented: true})
    assert.equal(c.clipboard('onPaste', 'erd-clipboard').prevented, true)
    c.clipboard('onPaste', 'erd-clipboard')
    assert.deepEqual(offsets, [24 / .85, 48 / .85])
    assert.deepEqual(c.clipboard('onCut'), {copied: 'erd-clipboard', prevented: true})
    assert.deepEqual(actions, ['delete'])
    for (const kind of ['onCopy', 'onCut', 'onPaste']) assert.deepEqual(c.clipboard(kind, '', true), {copied: '', prevented: false})
    assert.equal(offsets.length, 2)
    assert.equal(actions.length, 1)
})

test('read-only canvas permits copying and selecting but blocks cut, paste and duplicate', () => {
    const actions = []
    const c = canvas(true, {canEdit: false, onCopy: () => 'schema', onDelete: () => actions.push('delete'), onPaste: () => {actions.push('paste'); return true}, onDuplicate: () => actions.push('duplicate')})
    assert.equal(c.clipboard('onCopy').copied, 'schema')
    assert.equal(c.clipboard('onCut').prevented, false)
    assert.equal(c.clipboard('onPaste', 'schema').prevented, false)
    c.key('d', {ctrlKey: true}); c.key('Delete'); c.key('a', {ctrlKey: true})
    assert.deepEqual(actions, [])
    assert.deepEqual(c.selection(), ['table'])
})
