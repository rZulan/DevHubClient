import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as canvasView from '../src/features/workshop/canvas-view.ts'
import * as viewStorage from '../src/features/workshop/canvas-view-storage.ts'
import * as visibility from '../src/features/workshop/canvas-visibility.ts'
import * as connectionDrag from '../src/features/workshop/connection-drag.ts'
import * as canvasPalette from '../src/features/workshop/canvas-palette.ts'
import {canvasStorage} from './fixtures/canvas-storage.mjs'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/tool-canvas.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText

function canvas(deferMoves = true, overrides = {}, runEffects = false) {
    const states = [], frames = new Map(), commits = [], history = [], effects = [], cleanups = [], observers = []
    let cursor = 0, frameId = 0, selected = [], effectEventCursor = 0, wheelHandler
    const react = {
        useState(initial) {const index = cursor++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial; return [states[index], next => {states[index] = typeof next === 'function' ? next(states[index]) : next}]},
        useRef(initial) {const index = cursor++; return states[index] ??= {current: initial}},
        useEffect(callback, deps) {
            if (!runEffects) return
            const index = cursor++, old = states[index]
            if (!old || deps.some((dep, i) => !Object.is(dep, old[i]))) {states[index] = deps; effects.push(() => {cleanups[index]?.(); cleanups[index] = callback()})}
        }, useEffectEvent: callback => {if(effectEventCursor++===0) wheelHandler=callback; return callback},
    }
    const exports = {}
    vm.runInNewContext(source, {exports, window: {addEventListener() {}, removeEventListener() {}}, ResizeObserver: class {
        constructor(callback) {this.callback = callback}
        observe() {observers.push(this); this.callback()}
        disconnect() {observers.splice(observers.indexOf(this), 1)}
    }, requestAnimationFrame: callback => {frames.set(++frameId, callback); return frameId}, cancelAnimationFrame: id => frames.delete(id), require: name => {
        if (name === 'react') return react
        if (name === './canvas-view') return canvasView
        if (name === './canvas-view-storage') return viewStorage
        if (name === './canvas-visibility') return visibility
        if (name === './connection-drag') return connectionDrag
        if (name === './canvas-palette') return canvasPalette
        if (name === './use-canvas-touch') return {useCanvasTouch: () => ({})}
        if (name === './ideas/canvas-controls') return {ZoomControls: () => null}
        if (name === '@/components/ui/button') return {Button: 'button'}
        return require(name)
    }})
    const root = {clientWidth: 1000, clientHeight: 800, focus() {}, addEventListener() {}, removeEventListener() {}, setPointerCapture() {}, querySelector: () => null, getBoundingClientRect: () => ({left: 0, top: 0})}
    const event = (x, type = 'pointermove', y = 100) => ({type, button: 0, pointerId: 1, clientX: x, clientY: y, preventDefault() {}, stopPropagation() {}})
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
        effects.splice(0).forEach(effect => effect())
        return result
    }
    return {
        render,
        connectButtons() {return all(render()).filter(node => node.props.className === 'tool-connect-handle')},
        unmount() {cleanups.forEach(cleanup => cleanup?.())},
        resize(width, height) {root.clientWidth = width; root.clientHeight = height; observers.forEach(observer => observer.callback()); render()},
        fit() {all(render()).find(node => node.props.onFit).props.onFit(); render()},
        start() {all(render()).find(node => node.props.className?.startsWith('tool-node ')).props.onPointerDown(event(100, 'pointerdown'))},
        move(x, y) {render().props.onPointerMove(event(x, 'pointermove', y))},
        release(x, y) {render().props.onPointerUp(event(x, 'pointerup', y))},
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
        palette(kind, dataTransfer, x = 220, y = 270) {
            const event = {dataTransfer, clientX: x, clientY: y, prevented: false, preventDefault() {this.prevented = true}, stopPropagation() {}}
            render().props[kind](event)
            return event.prevented
        },
        paletteActive() {return render().props.className.includes('canvas-palette-active')},
        selection() {return selected},
        frames, commits, history,
    }
}

function eventForPan({button = 0, control = false} = {}) {
    return {type: 'pointerdown', button, pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, target: {closest: () => control ? {} : null}}
}

test('each table has one header control for clicking, keyboard activation, and dragging to connect', () => {
    const connections = []
    const nodes = [{id: 'source', name: 'Source', x: 0, y: 0, width: 300, height: 100}, {id: 'target', name: 'Target', x: 400, y: 0, width: 300, height: 100}]
    const props = {nodes, onConnect: (from, to) => connections.push([from, to])}
    const c = canvas(true, props)
    const buttons = c.connectButtons()
    assert.deepEqual(buttons.map(button => button.props['aria-label']), ['Connect Source', 'Connect Target'])
    assert.equal(canvas(true, {...props, canEdit: false}).connectButtons().length, 0)
    const start = () => c.connectButtons()[0].props.onPointerDown({button: 0, pointerId: 1, clientX: 285, clientY: 120,
        currentTarget: {getBoundingClientRect: () => ({left: 272, top: 106, width: 26, height: 26})}, preventDefault() {}, stopPropagation() {}})
    start()
    c.release(286, 120)
    buttons[0].props.onClick({detail: 0})
    start()
    c.move(425, 120)
    c.release(425, 120)
    start()
    c.move(350, 120)
    c.release(350, 120)
    assert.deepEqual(connections, [['source', ''], ['source', ''], ['source', 'target']])
})

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

test('canvas file drops pass local files through only when editing is enabled', () => {
    const imports = [], hint = 'Drop an ERD file'
    const fileDrop = {hint, onDrop: files => imports.push(files[0])}
    const editable = canvas(true, {fileDrop, nodes: []}), readonly = canvas(true, {fileDrop, canEdit: false})
    const showsHint = c => c.render().props.children.some(child => child?.props?.children === hint)
    const event = (types, files = []) => ({dataTransfer: {types, files}, prevented: false, preventDefault() {this.prevented = true}, stopPropagation() {}})
    const textDrag = event(['text/plain'])
    editable.render().props.onDragOver(textDrag)
    editable.render().props.onDrop(textDrag)
    assert.equal(textDrag.prevented, false)
    const hover = event(['Files'])
    editable.render().props.onDragOver(hover)
    assert.equal(hover.dataTransfer.dropEffect, 'copy')
    assert.equal(showsHint(editable), true)
    editable.render().props.onDragLeave({relatedTarget: null})
    assert.equal(showsHint(editable), false)
    for (const name of ['schema.sql', 'draft.json']) {
        const file = new File([], name), drop = event(['Files'], [file])
        editable.render().props.onDrop(drop)
        assert.equal(drop.prevented, true)
        assert.equal(imports.at(-1), file)
    }
    readonly.render().props.onDragOver(hover)
    assert.equal(hover.dataTransfer.dropEffect, 'none')
    assert.equal(showsHint(readonly), false)
    const blocked = event(['Files'], [new File([], 'readonly.sql')])
    readonly.render().props.onDrop(blocked)
    assert.equal(blocked.prevented, true)
    assert.equal(imports.length, 2)
})

test('ERD restores zoom and pan across tool switches, delayed loading and explicit fit requests', t => {
    canvasStorage(t)
    const key = viewStorage.canvasViewKey('user', 'org', 'project', 'erd')
    const first = canvas(true, {viewStorageKey: key, fitViewKey: 0}, true)
    first.render(); first.render()
    assert.notEqual(first.zoom(), .85, 'a new diagram still fits initially')
    first.wheel(1200); first.flush()
    first.capture({button: 1}); first.move(350); first.release(350)
    const saved = {zoom: first.zoom(), pan: {x: first.pan()[0], y: first.pan()[1]}}
    first.unmount()
    const overrides = {viewStorageKey: key, fitViewKey: 0, nodes: []}
    const returned = canvas(true, overrides, true)
    assert.equal(returned.zoom(), saved.zoom)
    assert.deepEqual(returned.pan(), [saved.pan.x, saved.pan.y])
    overrides.nodes = [{id: 'table', x: 0, y: 0, width: 300, height: 100}]
    returned.render(); returned.render()
    assert.equal(returned.zoom(), saved.zoom, 'loading the tables does not fit over the saved view')
    assert.deepEqual(returned.pan(), [saved.pan.x, saved.pan.y])
    returned.resize(1200, 900)
    assert.equal(returned.zoom(), saved.zoom, 'resizing preserves zoom')
    assert.deepEqual(returned.pan(), [saved.pan.x + 100, saved.pan.y + 50])
    overrides.fitViewKey++
    returned.render(); returned.render()
    assert.notEqual(returned.zoom(), saved.zoom, 'auto-arrange can still request a fit')
    returned.wheel(700); returned.flush(); returned.render()
    returned.fit()
    const fitted = returned.zoom()
    returned.unmount()
    const reopened = canvas(true, {viewStorageKey: key, fitViewKey: 0}, true)
    assert.equal(reopened.zoom(), fitted, 'manual Fit becomes the next saved view')
    reopened.unmount()
})

test('switching tools before a queued wheel frame saves its final zoom and pan', t => {
    canvasStorage(t)
    const key = 'pending-wheel-view', original = {zoom: .4, pan: {x: -500, y: 200}}
    viewStorage.saveCanvasView(key, original)
    const first = canvas(true, {viewStorageKey: key}, true)
    first.wheel(100)
    first.unmount()
    const next = viewStorage.readCanvasView(key)
    assert.equal(next.zoom, original.zoom * Math.exp(-100 * .0015))
    const reopened = canvas(true, {viewStorageKey: key}, true)
    assert.equal(reopened.zoom(), next.zoom)
    assert.deepEqual(reopened.pan(), [next.pan.x, next.pan.y])
    reopened.unmount()
})
