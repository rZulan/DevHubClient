import test from 'node:test'
import assert from 'node:assert/strict'
import {copyDesignLayers, designComponent, designPaintOrder, designStarter, layerUnavailable, layoutDesignFrames, moveDesignLayers, newDesignLayer, pasteDesignLayers, removeDesignLayers, reorderDesignLayer, validDesignDocument} from '../src/features/workshop/design-document.ts'
import {designSvg} from '../src/features/workshop/design-export.ts'

const scene = () => {
    const a = newDesignLayer('frame', {id: 'a', x: 100, y: 100}), b = newDesignLayer('frame', {id: 'b', x: 600, y: 100})
    const button = newDesignLayer('button', {id: 'button', parentId: a.id, x: 124, y: 200, interaction: {action: 'navigate', targetId: b.id, transition: 'fade'}})
    return {layers: [a, b, button], startFrameId: a.id}
}
test('legacy designs and editable component presets remain valid', () => {
    const doc = scene()
    for (const layer of doc.layers) for (const key of ['fontFamily', 'fontWeight', 'textAlign']) delete layer[key]
    assert.ok(validDesignDocument(doc))
    for (const kind of ['button', 'input', 'card', 'badge', 'toggle', 'checkbox']) assert.ok(validDesignDocument({layers: designComponent(kind, 20, 30)}), kind)
    for (const kind of ['onboarding', 'dashboard']) assert.ok(validDesignDocument({layers: designStarter(kind)}), kind)
})
test('painting keeps each screen below its own children regardless of array order', () => {
    assert.deepEqual(designPaintOrder(scene()).map(l => l.id), ['a', 'button', 'b'])
})
test('moving a frame translates children once when both are selected', () => {
    const doc = scene(), before = structuredClone(doc)
    const next = moveDesignLayers(doc, [{id: 'a', x: 150, y: 180}, {id: 'button', x: 999, y: 999}])
    assert.deepEqual(next.layers.find(l => l.id === 'button'), {...doc.layers[2], x: 174, y: 280})
    assert.deepEqual(doc, before)
})
test('locked frames protect descendants; moving a frame still carries locked children', () => {
    const doc = scene(); doc.layers[0].locked = true
    assert.ok(layerUnavailable(doc, doc.layers[2], 'locked'))
    assert.equal(moveDesignLayers(doc, [{id: 'button', x: 999, y: 999}]).layers[2].x, 124)
    assert.equal(removeDesignLayers(doc, ['button']).layers.length, 3)
    doc.layers[0].locked = false; doc.layers[2].locked = true
    assert.equal(moveDesignLayers(doc, [{id: 'a', x: 200, y: 100}]).layers[2].x, 224)
})
test('deleting a destination removes dangling links and the starting point', () => {
    const doc = scene(), next = removeDesignLayers(doc, ['b'])
    assert.equal(next.layers.find(l => l.id === 'button').interaction, undefined)
    assert.ok(validDesignDocument(next))
    const withoutStart = removeDesignLayers(doc, ['a'])
    assert.equal(withoutStart.startFrameId, undefined)
    assert.deepEqual(withoutStart.layers.map(l => l.id), ['b'])
})
test('duplicating a flow remaps screens, children, and prototype targets', () => {
    const doc = scene(), pasted = pasteDesignLayers(doc, copyDesignLayers(doc, ['a', 'b']), 40)
    assert.ok(pasted)
    assert.equal(pasted.document.layers.length, 6)
    const [a, b, button] = pasted.document.layers.slice(3)
    assert.notEqual(a.id, 'a'); assert.equal(button.parentId, a.id); assert.equal(button.interaction.targetId, b.id)
    assert.equal(a.x, 140); assert.equal(button.x, 164)
    assert.deepEqual(pasted.ids, [a.id, b.id]); assert.ok(validDesignDocument(pasted.document))
})
test('duplicating a button preserves its existing screen and external prototype target', () => {
    const doc = scene(), pasted = pasteDesignLayers(doc, copyDesignLayers(doc, ['button']))
    const button = pasted.document.layers.at(-1)
    assert.equal(button.parentId, 'a'); assert.equal(button.interaction.targetId, 'b'); assert.deepEqual(pasted.ids, [button.id])
    assert.ok(validDesignDocument(pasted.document))
})
test('pasting into another project detaches missing parents and targets safely', () => {
    const pasted = pasteDesignLayers({layers: []}, copyDesignLayers(scene(), ['button']))
    assert.equal(pasted.document.layers[0].parentId, undefined)
    assert.equal(pasted.document.layers[0].interaction, undefined)
    assert.ok(validDesignDocument(pasted.document))
})
test('import preserves layer names and remaps the starting point without replacing an existing flow', () => {
    const doc = scene(), imported = pasteDesignLayers({layers: []}, copyDesignLayers(doc, ['a', 'b']), 0, {preserveNames: true})
    assert.equal(imported.document.startFrameId, imported.document.layers[0].id)
    assert.equal(imported.document.layers[0].name, doc.layers[0].name)
    assert.ok(validDesignDocument(imported.document))
    assert.equal(pasteDesignLayers(doc, copyDesignLayers(doc, ['a', 'b'])).document.startFrameId, 'a')
})
test('clipboard rejects malformed shapes and invalid interactions', () => {
    assert.equal(pasteDesignLayers(scene(), 'not json'), null)
    assert.equal(pasteDesignLayers(scene(), JSON.stringify({type: 'devhub-design', layers: [{id: 'bad'}]})), null)
    const doc = scene(); doc.layers[2].interaction.action = 'execute'
    assert.equal(pasteDesignLayers(scene(), copyDesignLayers(doc, ['button'])), null)
})
test('reordering touches only siblings and cannot detach children from frames', () => {
    const doc = scene(); doc.layers.push(newDesignLayer('text', {id: 'text', parentId: 'a'}))
    const next = reorderDesignLayer(doc, 'button', 1)
    assert.deepEqual(designPaintOrder(next).map(l => l.id), ['a', 'text', 'button', 'b'])
    assert.equal(next.layers.find(l => l.id === 'button').parentId, 'a')
})
test('auto layout responds to child size, padding, gap, and visibility', () => {
    const doc = scene(); doc.layers[0] = {...doc.layers[0], layout: 'vertical', padding: 20, gap: 12}
    doc.layers.push(newDesignLayer('text', {id: 'text', parentId: 'a', height: 30}))
    const next = layoutDesignFrames(doc)
    assert.equal(next.layers[2].x, 120); assert.equal(next.layers[2].y, 120)
    assert.equal(next.layers[3].y, 180)
    doc.layers[2].hidden = true
    assert.equal(layoutDesignFrames(doc).layers[3].y, 120)
})
test('validation rejects duplicate IDs, invalid geometry, broken parents, and missing targets', () => {
    for (const change of [doc => doc.layers.push({...doc.layers[0]}), doc => doc.layers[0].width = -1, doc => doc.layers[0].x = NaN, doc => doc.layers[2].parentId = 'missing', doc => doc.layers[2].interaction.targetId = 'missing', doc => doc.startFrameId = 'button', doc => doc.layers[0].parentId = 'b']) {
        const doc = scene(); change(doc); assert.equal(validDesignDocument(doc), false)
    }
})
test('SVG escapes content, excludes hidden trees, clips children and exports selected screens', () => {
    const doc = scene(); doc.layers[2].text = '<script>& "hello"'
    const svg = designSvg(doc, 'a')
    assert.match(svg, /viewBox="100 100 390 844"/)
    assert.match(svg, /&lt;script&gt;&amp; &quot;hello&quot;/)
    assert.match(svg, /clip-path="url\(#frame-0\)"/)
    assert.doesNotMatch(svg, /translate\(600 100\)/)
    doc.layers[0].hidden = true
    assert.doesNotMatch(designSvg(doc), /hello/)
})
test('image fills accept embedded raster images and reject remote or executable sources', () => {
    const doc = scene(); doc.layers[2].image = 'data:image/png;base64,YWJjZA=='
    assert.ok(validDesignDocument(doc)); assert.match(designSvg(doc), /<image href="data:image\/png;base64,YWJjZA=="/)
    for (const image of ['https://example.com/image.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,YWJjZA==']) {doc.layers[2].image = image; assert.equal(validDesignDocument(doc), false)}
})
