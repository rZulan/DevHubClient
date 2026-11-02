import test from 'node:test'
import assert from 'node:assert/strict'
import {canvasDropPoint, paletteDragProps, paletteDropHandlers, readPaletteElement} from '../src/features/workshop/canvas-palette.ts'
import {placeDesignElement} from '../src/features/workshop/palette-placement.ts'
import {newDesignLayer, designStarter} from '../src/features/workshop/design-document.ts'

function transfer() {
    const values = new Map()
    return {types: [], setData(type, value) {values.set(type, value); this.types = [...values.keys()]}, getData(type) {return values.get(type) ?? ''}}
}
function event(dataTransfer, extra = {}) {return {dataTransfer, clientX: 300, clientY: 250, prevented: false, stopped: false, preventDefault() {this.prevented = true}, stopPropagation() {this.stopped = true}, ...extra}}

test('all palette elements round-trip without sharing their payload with other tools', () => {
    const elements = [
        ...['frame', 'rectangle', 'ellipse', 'text', 'button'].map(kind => ({tool: 'ui-editor', source: 'shape', kind})),
        ...['button', 'input', 'card', 'badge', 'toggle', 'checkbox'].map(kind => ({tool: 'ui-editor', source: 'component', kind})),
        ...['Phone', 'Tablet', 'Desktop'].map(kind => ({tool: 'ui-editor', source: 'frame', kind})),
        ...['onboarding', 'dashboard'].map(kind => ({tool: 'ui-editor', source: 'starter', kind}))]
    for (const element of elements) {
        const data = transfer()
        paletteDragProps(element, true).onDragStart(event(data))
        assert.equal(data.effectAllowed, 'copy')
        assert.deepEqual(readPaletteElement(data, element.tool), element)
        assert.equal(readPaletteElement(data, element.tool === 'ui-editor' ? 'state-machine' : 'ui-editor'), null)
    }
    const disabled = event(transfer())
    paletteDragProps(elements[0], false).onDragStart(disabled)
    assert.equal(disabled.prevented, true); assert.equal(disabled.dataTransfer.types.length, 0)
})

test('drop handling accepts only a matching editable palette, clears feedback, and rejects malformed data', () => {
    const data = transfer(), active = [], drops = []
    paletteDragProps({tool: 'ui-editor', source: 'component', kind: 'card'}, true).onDragStart(event(data))
    const handlers = paletteDropHandlers('ui-editor', true, value => active.push(value), value => drops.push(value))
    const over = event(data)
    handlers.onDragOver(over)
    assert.equal(over.prevented, true); assert.equal(data.dropEffect, 'copy'); assert.equal(active.at(-1), true)
    handlers.onDragLeave(event(data, {relatedTarget: {}, currentTarget: {contains: () => true}}))
    assert.equal(active.at(-1), true, 'moving over a child keeps feedback')
    handlers.onDragLeave(event(data, {relatedTarget: null}))
    assert.equal(active.at(-1), false)
    handlers.onDrop(event(data))
    assert.equal(drops.length, 1); assert.equal(active.at(-1), false)
    for (const value of ['{', 'null', '[]', JSON.stringify({tool: 'ui-editor', source: 'constructor', kind: 'text'}), JSON.stringify({tool: 'ui-editor', source: 'shape', kind: 'unknown'})]) {
        data.setData(data.types[0], value); handlers.onDrop(event(data))
    }
    assert.equal(drops.length, 1)
    const readonly = event(data)
    paletteDropHandlers('ui-editor', false, () => {}, () => assert.fail()).onDrop(readonly)
    assert.equal(readonly.prevented, false)
    handlers.onDragOver(event({types: ['Files', 'text/plain']}))
    assert.equal(active.at(-1), false)
})

test('drop coordinates invert canvas offset, pan and zoom at any camera scale', () => {
    for (const zoom of [.08, .7, 1, 4]) for (const pan of [{x: 60, y: 100}, {x: -430, y: 216}]) {
        const point = {x: 317, y: -28}, bounds = {left: 248, top: 132}
        const result = canvasDropPoint({clientX: bounds.left + pan.x + point.x * zoom, clientY: bounds.top + pan.y + point.y * zoom}, bounds, pan, zoom)
        assert.ok(Math.abs(result.x - point.x) < 1e-9); assert.ok(Math.abs(result.y - point.y) < 1e-9)
    }
})

test('design drops use the target screen, keep components together, and respect hidden and locked screens', () => {
    const frame = newDesignLayer('frame', {x: 100, y: 100, width: 500, height: 700}), doc = {layers: [frame]}
    const card = placeDesignElement(doc, {tool: 'ui-editor', source: 'component', kind: 'card'}, {x: 350, y: 350})
    assert.equal(card.length, 4)
    assert.ok(card.every(l => l.parentId === frame.id))
    assert.deepEqual([card[0].x, card[0].y, card[1].x - card[0].x, card[1].y - card[0].y], [200, 260, 24, 24])
    const nearEdge = placeDesignElement(doc, {tool: 'ui-editor', source: 'component', kind: 'checkbox'}, {x: 101, y: 101})
    assert.ok(nearEdge.every(l => l.x >= frame.x && l.y >= frame.y), 'edge drops stay visible inside the frame')
    const outside = placeDesignElement(doc, {tool: 'ui-editor', source: 'shape', kind: 'ellipse'}, {x: -100, y: 800})
    assert.equal(outside[0].parentId, undefined)
    assert.deepEqual([outside[0].x, outside[0].y], [-190, 740])
    assert.deepEqual(placeDesignElement({layers: [{...frame, locked: true}]}, {tool: 'ui-editor', source: 'shape', kind: 'text'}, {x: 350, y: 350}), [])
    const hidden = placeDesignElement({layers: [{...frame, hidden: true}]}, {tool: 'ui-editor', source: 'shape', kind: 'text'}, {x: 350, y: 350})
    assert.equal(hidden[0].parentId, undefined)
})

test('screen and starter drops stay top-level and translate every child with the screen', () => {
    const doc = {layers: [newDesignLayer('frame', {width: 2000, height: 2000})]}
    for (const kind of ['onboarding', 'dashboard']) {
        const original = designStarter(kind, 0), dropped = placeDesignElement(doc, {tool: 'ui-editor', source: 'starter', kind}, {x: 600, y: 900})
        assert.equal(dropped[0].parentId, undefined)
        assert.equal(dropped[0].x + dropped[0].width / 2, 600); assert.equal(dropped[0].y + dropped[0].height / 2, 900)
        for (let i = 1; i < dropped.length; i++) {
            assert.equal(dropped[i].parentId, dropped[0].id)
            assert.equal(dropped[i].x - dropped[0].x, original[i].x - original[0].x)
            assert.equal(dropped[i].y - dropped[0].y, original[i].y - original[0].y)
        }
    }
    const desktop = placeDesignElement(doc, {tool: 'ui-editor', source: 'frame', kind: 'Desktop'}, {x: 600, y: 900})[0]
    assert.deepEqual([desktop.name, desktop.width, desktop.height, desktop.parentId], ['Desktop', 1440, 900, undefined])
    assert.deepEqual(placeDesignElement(doc, {tool: 'ui-editor', source: 'shape', kind: 'text'}, {x: NaN, y: 0}), [])
})
