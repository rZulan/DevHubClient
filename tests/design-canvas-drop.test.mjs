import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as palette from '../src/features/workshop/canvas-palette.ts'
import * as design from '../src/features/workshop/design-document.ts'
import * as viewStorage from '../src/features/workshop/canvas-view-storage.ts'
import {placeDesignElement} from '../src/features/workshop/palette-placement.ts'
import {canvasStorage} from './fixtures/canvas-storage.mjs'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/design-canvas.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText

function canvas(canEdit = true, options = {}) {
    const hooks = [], effects = [], drops = [], doc = {layers: options.layers ?? []}
    let cursor = 0, dirty = false, selected = []
    const root = {clientWidth: 1000, clientHeight: 800, focus() {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({left: 220, top: 80})}
    const react = {
        useState(initial) {const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], next => {const value = typeof next === 'function' ? next(hooks[i]) : next; if (!Object.is(value, hooks[i])) {hooks[i] = value; dirty = true}}]},
        useRef(initial) {const i = cursor++; return hooks[i] ??= {current: initial}},
        useEffect(callback, deps) {const i = cursor++, old = hooks[i]; if (!old || deps.some((d, j) => !Object.is(d, old[j]))) {hooks[i] = deps; effects.push(callback)}},
        useEffectEvent: fn => fn,
    }
    const exports = {}
    vm.runInNewContext(source, {exports, window: {innerWidth: 1400, innerHeight: 1000, addEventListener() {}, removeEventListener() {}}, ResizeObserver: class {observe() {} disconnect() {}}, require: name => {
        if (name === 'react') return react
        if (name === './canvas-palette') return palette
        if (name === './canvas-view-storage') return viewStorage
        if (name === './design-document') return design
        if (name === './design-shape') return {DesignShape: () => null}
        if (name === './design-style') return {designShapeStyle: () => ({})}
        if (name === './design-tools') return {designTools: []}
        if (name === './use-canvas-touch') return {useCanvasTouch: () => ({})}
        return require(name)
    }})
    function render() {
        let result, loops = 0
        do {
            dirty = false; cursor = 0
            result = exports.DesignCanvas({document: doc, selectedIds: selected, onSelect: ids => {selected = ids}, tool: 'select', onTool() {}, canEdit, onChange() {}, onCreate() {}, fitKey: 0, prototype: false, onEditText() {}, onAction() {}, children: 'Empty canvas actions', viewStorageKey: options.viewStorageKey,
                onPaletteDrop(element, point) {drops.push({element, point}); doc.layers.push(...placeDesignElement(doc, element, point)); return true}})
            result.props.ref.current = root
            effects.splice(0).forEach(effect => effect())
            assert.ok(loops++ < 10, 'render settles')
        } while (dirty)
        return result
    }
    return {
        camera() {const style = render().props.style; return {x: parseFloat(style['--ui-pan-x']), y: parseFloat(style['--ui-pan-y']), zoom: parseFloat(style['--ui-grid']) / 8}},
        key(key) {render().props.onKeyDown({key, ctrlKey: true, target: {closest: () => null}, preventDefault() {}})},
        drop(element) {
            const values = new Map(), dataTransfer = {types: [], setData(type, value) {values.set(type, value); this.types = [...values.keys()]}, getData: type => values.get(type) ?? ''}
            palette.paletteDragProps(element, true).onDragStart({dataTransfer})
            const event = {dataTransfer, clientX: 640, clientY: 350, prevented: false, preventDefault() {this.prevented = true}, stopPropagation() {}}
            render().props.onDragOver(event); render().props.onDrop(event)
            render()
            return event.prevented
        },
        children() {return render().props.children},
        doc, drops,
    }
}

test('UI canvas drops account for its offset and camera without auto-fitting the first dropped element', () => {
    const c = canvas(), before = c.camera()
    assert.equal(c.drop({tool: 'ui-editor', source: 'shape', kind: 'rectangle'}), true)
    assert.deepEqual(c.camera(), before, 'the first drop does not move the camera away from the release position')
    const point = c.drops[0].point
    assert.deepEqual(point, {x: (640 - 220 - before.x) / before.zoom, y: (350 - 80 - before.y) / before.zoom})
    assert.equal(c.doc.layers[0].x + c.doc.layers[0].width / 2, point.x)
    assert.equal(c.doc.layers[0].y + c.doc.layers[0].height / 2, point.y)
    assert.ok(c.children().includes('Empty canvas actions'), 'empty-state content is inside the canvas drop target')
    c.key('-')
    const zoomed = c.camera()
    c.drop({tool: 'ui-editor', source: 'component', kind: 'button'})
    assert.deepEqual(c.drops[1].point, {x: (640 - 220 - zoomed.x) / zoomed.zoom, y: (350 - 80 - zoomed.y) / zoomed.zoom})
})

test('UI canvas refuses palette drops in read-only mode and drops from the state-machine palette', () => {
    const readonly = canvas(false)
    assert.equal(readonly.drop({tool: 'ui-editor', source: 'shape', kind: 'text'}), false)
    assert.equal(readonly.doc.layers.length, 0)
    const c = canvas()
    assert.equal(c.drop({tool: 'state-machine', kind: 'state'}), false)
    assert.equal(c.doc.layers.length, 0)
})

test('UI editor restores the saved camera after its layers load and saves subsequent zoom changes', t => {
    canvasStorage(t)
    const key = 'ui-view', saved = {zoom: .25, pan: {x: -450, y: 210}}
    viewStorage.saveCanvasView(key, saved)
    const first = canvas(true, {viewStorageKey: key})
    assert.deepEqual(first.camera(), {zoom: saved.zoom, x: saved.pan.x, y: saved.pan.y})
    first.doc.layers.push(design.newDesignLayer('frame', 0, 0))
    assert.deepEqual(first.camera(), {zoom: saved.zoom, x: saved.pan.x, y: saved.pan.y})
    first.key('-')
    const updated = first.camera()
    assert.notEqual(updated.zoom, saved.zoom)
    assert.deepEqual(canvas(true, {viewStorageKey: key, layers: first.doc.layers}).camera(), updated)
})
