import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as projectTools from '../src/features/workshop/project-tools.ts'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/project-tools-navigation.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText

// Drive the real component handlers while holding capture, including intermediate drag frames.
function navigation() {
    const dragTools = projectTools.projectToolIds.filter(id => !['calendar', 'bug-reports', 'project-wiki'].includes(id))
    const states = [], storage = new Map()
    let cursor = 0, order = [...dragTools]
    const bounds = {left:100, right:364, top:100, bottom:100 + dragTools.length * 45 - 3}
    const container = {
        setPointerCapture() {},
        getBoundingClientRect: () => bounds,
        querySelectorAll: () => order.map((id, index) => ({dataset:{toolId:id}, clientHeight:42,
            getBoundingClientRect: () => ({top:100 + index * 45, bottom:142 + index * 45}),
        })),
    }
    const react = {
        useState(initial) {const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => {states[i] = typeof next === 'function' ? next(states[i]) : next}]},
        useRef(initial) {const i = cursor++; states[i] ??= {current:initial}; return states[i]},
        useEffect() {}, useId: () => 'drag-help',
    }
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => {
        if (name === 'react') return react
        if (name === './project-tools') return projectTools
        if (name === '@/lib/utils') return {cn: (...parts) => parts.filter(Boolean).join(' ')}
        if (name === '@/components/under-construction-indicator') return {UnderConstructionIndicator: () => null}
        return require(name)
    }, localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value)}})
    function nodes(node, all = []) {
        if (Array.isArray(node)) node.forEach(child => nodes(child, all))
        else if (node?.props) {all.push(node); nodes(node.props.children, all)}
        return all
    }
    function render() {
        cursor = 0
        const all = nodes(exports.ProjectToolsNavigation({userId:'test',organizationId:'preview',expanded:true,onToggle(){},category:{id:'drag-preview',title:'Pages',tools:dragTools}}))
        const list = all.find(node => node.props.className === 'project-tools-sort-list')
        list.props.ref.current = container
        order = all.filter(node=>node.props['data-tool-id']).map(node=>node.props['data-tool-id'])
        return all
    }
    const event = (y, x = 200, pointerId = 1) => ({button:0,isPrimary:true,pointerId,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}})
    const list = () => render().find(node => node.props.className === 'project-tools-sort-list')
    return {
        start(id, y) {render().find(node=>node.props['data-tool-id']===id).props.children[0].props.onPointerDown(event(y))},
        move(y,x,pointerId) {list().props.onPointerMove(event(y,x,pointerId))},
        drop(y,x) {list().props.onPointerUp(event(y,x))},
        cancel() {list().props.onPointerCancel(event(200))},
        lostCapture() {list().props.onLostPointerCapture(event(200))},
        indicator: () => render().find(node=>node.props.className === 'project-tool-drop-indicator'),
        preview: () => render().find(node=>node.props.className === 'project-tool-drag-preview'),
        order: () => {render(); return [...order]}, storage,
    }
}

test('drop line follows every destination during one captured drag, including top and bottom', () => {
    const n = navigation()
    n.start('todo',121)
    assert.equal(n.indicator(),undefined)
    for (const [pointerY, lineY] of [[160,45],[200,90],[250,135],[330,225],[375,267],[100,45]]) {
        n.move(pointerY)
        assert.equal(n.indicator().props.style.top,lineY)
        assert.equal(n.preview().props.style.top,pointerY - 120)
        assert.equal(n.indicator().props['aria-hidden'],'true')
    }
    n.drop(250)
    assert.deepEqual(n.order(),['notes','erd','todo','ui-editor','sdlc','state-machine'])
    assert.equal(n.indicator(),undefined)
    assert.equal(n.preview(),undefined)
    assert.equal(n.storage.size,1)
})

test('leaving and reentering the list hides and restores the line; dropping outside does not reorder', () => {
    const n = navigation(), original = n.order()
    n.start('todo',121); n.move(250)
    assert.ok(n.indicator())
    n.move(250,500)
    assert.equal(n.indicator(),undefined)
    n.move(250)
    assert.equal(n.indicator().props.style.top,135)
    n.drop(250,500)
    assert.deepEqual(n.order(),original)
    assert.equal(n.storage.size,0)
})

test('dropping reads the final pointer position, and cancelled gestures leave no indicator or saved changes', () => {
    const n = navigation()
    n.start('sdlc',301); n.move(250); n.drop(100)
    assert.equal(n.order()[0],'sdlc')
    for (const cancel of ['cancel','lostCapture']) {
        const current = navigation(), original = current.order()
        current.start('todo',121); current.move(250); current[cancel]()
        assert.equal(current.indicator(),undefined)
        assert.equal(current.preview(),undefined)
        assert.deepEqual(current.order(),original)
        assert.equal(current.storage.size,0)
    }
})
