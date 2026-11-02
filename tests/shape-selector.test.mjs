import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync, existsSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
import {umlPresets} from '../src/features/workshop/uml-catalog.ts'

const require = createRequire(import.meta.url)
function harness(umlType = 'state-machine') {
    const hooks = [], added = [], cache = new Map()
    let cursor = 0, closed = 0
    const react = {
        useState(initial) {
            const index = cursor++
            if (!(index in hooks)) hooks[index] = initial
            return [hooks[index], value => {hooks[index] = value}]
        },
        useRef(initial) {return hooks[cursor++] ??= {current: initial}},
        useId() {return `id-${cursor++}`},
    }
    function load(path) {
        if (cache.has(path)) return cache.get(path)
        const exports = {}
        cache.set(path, exports)
        const source = ts.transpileModule(readFileSync(path, 'utf8'), {compilerOptions: {
            module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        }}).outputText
        vm.runInNewContext(source, {exports, require(name) {
            if (name === 'react') return react
            if (name.endsWith('.css')) return {}
            if (name.startsWith('.')) {
                const base = resolve(dirname(path), name)
                if (existsSync(base + '.tsx')) return load(base + '.tsx')
                if (existsSync(base + '.ts')) return require(base + '.ts')
            }
            return require(name)
        }}, {filename: path})
        return exports
    }
    const {ShapeSelector} = load(fileURLToPath(new URL('../src/features/workshop/ideas/shape-selector.tsx', import.meta.url)))
    function walk(node, result = []) {
        if (Array.isArray(node)) node.forEach(child => walk(child, result))
        else if (node?.props) {
            result.push(node)
            if (typeof node.type === 'function') walk(node.type(node.props), result)
            else walk(node.props.children, result)
        }
        return result
    }
    function render() {cursor = 0; return ShapeSelector({umlType: umlType === 'ideas' ? undefined : umlType, onAdd: preset => added.push(preset), onClose: () => {closed++}})}
    const all = () => walk(render())
    const find = predicate => all().find(predicate)
    return {
        all, find, added, render,
        get closed() {return closed},
        search(value) {find(node => node.props['aria-label'] === 'Search shapes').props.onChange({target: {value}})},
        category(value) {find(node => node.type === 'select').props.onChange({target: {value}})},
        card(label) {return find(node => node.props['aria-label'] === `Add ${label.toLowerCase()}`)},
        descendants: walk,
        escape() {render().props.onKeyDown({key: 'Escape', stopPropagation() {}})},
    }
}

test('terminate is a square X and every UML thumbnail retains its catalog proportions', () => {
    const h = harness()
    const terminate = h.descendants(h.card('Terminate'))
    const art = terminate.find(node => node.props.className === 'shape-library-art')
    assert.equal(art.props.style.width, art.props.style.height)
    const path = terminate.find(node => node.type === 'path')
    const coordinates = path.props.d.match(/[\d.]+/g).map(Number)
    assert.ok(Math.abs(coordinates[2] - coordinates[0]) === Math.abs(coordinates[3] - coordinates[1]), 'the X has 45-degree strokes')
    h.category('all')
    const cards = h.all().filter(node => node.props.className === 'shape-library-card')
    assert.equal(cards.length, umlPresets.length)
    for (const card of cards) {
        const preset = umlPresets.find(preset => preset.id === card.key)
        const preview = h.descendants(card).find(node => node.props.className === 'shape-library-art')
        assert.ok(Math.abs(preview.props.style.width / preview.props.style.height - preset.changes.width / preset.changes.height) < 1e-9, preset.label)
        assert.ok(preview.props.style.width <= 60 && preview.props.style.height <= 44)
    }
})

test('categories focus the library and search finds shapes across diagram types', () => {
    const h = harness()
    assert.ok(h.card('Terminate'))
    assert.equal(h.card('Activation'), undefined)
    h.search('activation')
    assert.ok(h.card('Activation'))
    assert.equal(h.card('Terminate'), undefined)
    h.search('  CLASS  ')
    assert.ok(h.card('Class'))
    h.category('Sequence')
    assert.ok(h.card('Activation'))
    assert.equal(h.card('Class'), undefined)
})

test('adding and dragging preserve the real preset and Escape clears search before closing', () => {
    const h = harness(), terminate = h.card('Terminate'), data = new Map()
    terminate.props.onClick()
    assert.equal(h.added[0], umlPresets.find(preset => preset.label === 'Terminate'))
    assert.ok(h.card('Terminate'), 'the library stays open after insertion')
    const transfer = {setData: (type, value) => data.set(type, value)}
    terminate.props.onDragStart({dataTransfer: transfer})
    assert.equal(data.get('application/x-zevont-uml-preset'), h.added[0].id)
    assert.equal(transfer.effectAllowed, 'copy')
    h.search('not-a-shape')
    assert.ok(h.find(node => node.props.className === 'shape-library-empty'))
    h.escape()
    assert.ok(h.card('Terminate'))
    assert.equal(h.closed, 0)
    h.escape()
    assert.equal(h.closed, 1)
})

test('the ordinary shape library remains available without UML drag behavior', () => {
    const h = harness('ideas')
    assert.ok(h.card('Rectangle'))
    assert.ok(h.card('Ellipse'))
    assert.equal(h.card('Terminate'), undefined)
    assert.equal(h.card('Rectangle').props.draggable, false)
    h.search('caption')
    assert.ok(h.card('Caption'))
})

test('a UML diagram with no preferred type opens every category', () => {
    const h = harness(null)
    assert.ok(h.card('Class'))
    assert.ok(h.card('Terminate'))
    assert.ok(h.card('Activation'))
    assert.equal(h.all().filter(node => node.props.className === 'shape-library-card').length, umlPresets.length)
})
