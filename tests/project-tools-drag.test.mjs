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
function navigation({tools = projectTools.projectToolIds.filter(id => !['calendar', 'bug-reports', 'project-wiki'].includes(id)), ...scope} = {}) {
    const states = [], storage = new Map()
    let cursor = 0, order = [...tools], visualOrder = [...tools]
    const bounds = {left:100, right:364, top:100, bottom:100 + tools.length * 45 - 3}
    const container = {
        setPointerCapture() {},
        getBoundingClientRect: () => bounds,
        querySelectorAll: () => order.map(id => {
            const index = visualOrder.indexOf(id)
            return {dataset:{toolId:id}, offsetTop:index * 45, offsetHeight:42}
        }),
    }
    const react = {
        useState(initial) {const i = cursor++; if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial; return [states[i], next => {states[i] = typeof next === 'function' ? next(states[i]) : next}]},
        useRef(initial) {const i = cursor++; states[i] ??= {current:initial}; return states[i]},
        useEffect() {}, useLayoutEffect() {}, useId: () => 'drag-help',
    }
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => {
        if (name === 'react') return react
        if (name === '@/features/workshop/workshop-toast') return {WorkshopToast: () => null}
        if (name === './project-tools') return projectTools
        if (name === './connections/connection-lightning') return {ConnectionLightning: () => null}
        if (name === './project-tools-navigation.css') return {}
        if (name === '@/lib/utils') return {cn: (...parts) => parts.filter(Boolean).join(' ')}
        if (name === '@/components/under-construction-indicator') return {UnderConstructionIndicator: () => null}
        return require(name)
    }, window:{matchMedia: () => ({matches:true})},
    localStorage:{getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value)}})
    function nodes(node, all = []) {
        if (Array.isArray(node)) node.forEach(child => nodes(child, all))
        else if (node?.props) {all.push(node); nodes(node.props.children, all)}
        return all
    }
    function render() {
        cursor = 0
        const all = nodes(exports.ProjectToolsNavigation({userId:'test',organizationId:'preview',expanded:true,onToggle(){},category:{id:'drag-preview',title:'Pages',tools},...scope}))
        const list = all.find(node => node.props.className === 'project-tools-sort-list')
        list.props.ref.current = container
        const rows = all.filter(node=>node.props['data-tool-id'])
        order = rows.map(node=>node.props['data-tool-id'])
        visualOrder = rows.toSorted((a,b) => (a.props.style?.order ?? 0) - (b.props.style?.order ?? 0))
            .map(node=>node.props['data-tool-id'])
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
        target: () => render().find(node=>node.props['data-tool-id'] && node.props.className.split(' ').includes('drop-target')),
        visualOrder: () => {render(); return [...visualOrder]},
        toolRows: () => render().filter(node=>node.props.className?.startsWith?.('project-tool-nav-row')),
        order: () => {render(); return [...order]}, storage,
    }
}

test('the highlighted row previews its destination from top to bottom without changing the saved order', () => {
    const n = navigation()
    const original = n.order(), bottomPointer = 100 + original.length * 45
    n.start('todo',121)
    assert.equal(n.target(),undefined)
    for (const [pointerY, slot] of [[160,0],[200,1],[250,2],[330,4],[375,5],[bottomPointer,5],[100,0]]) {
        const expected = original.slice(1).toSpliced(slot, 0, 'todo')
        n.move(pointerY)
        assert.equal(n.target().props['data-tool-id'],'todo')
        assert.deepEqual(n.visualOrder(),expected)
        n.move(pointerY)
        assert.deepEqual(n.visualOrder(),expected)
        assert.deepEqual(n.order(),original)
        assert.equal(n.storage.size,0)
    }
    n.drop(250)
    assert.deepEqual(n.order(),['notes','erd','todo',...original.slice(3)])
    assert.equal(n.target(),undefined)
    assert.equal(n.storage.size,1)
})

test('leaving the list restores the original order and reentering resumes the preview', () => {
    const n = navigation(), original = n.order()
    n.start('todo',121); n.move(250)
    assert.ok(n.target())
    n.move(250,500)
    assert.equal(n.target(),undefined)
    assert.deepEqual(n.visualOrder(),original)
    n.move(250)
    assert.equal(n.visualOrder()[2],'todo')
    n.drop(250,500)
    assert.deepEqual(n.order(),original)
    assert.equal(n.target(),undefined)
    assert.equal(n.storage.size,0)
})

test('dropping reads the final pointer position, and cancelled gestures clear the preview without saving', () => {
    const n = navigation()
    n.start('sdlc',301); n.move(250); n.drop(100)
    assert.equal(n.order()[0],'sdlc')
    for (const cancel of ['cancel','lostCapture']) {
        const current = navigation(), original = current.order()
        current.start('todo',121); current.move(250); current[cancel]()
        assert.equal(current.target(),undefined)
        assert.deepEqual(current.visualOrder(),original)
        assert.deepEqual(current.order(),original)
        assert.equal(current.storage.size,0)
    }
})

test('project tool rows reveal separate connection controls for the selected project', () => {
    const tools = projectTools.projectToolIds
    const rows = navigation({tools, organizationId:'organization', projectId:'selected-project', isPersistedOrganization:true}).toolRows()
    assert.equal(rows.length, tools.length)
    for (const [index, row] of rows.entries()) {
        const [link, bolt] = row.props.children
        const tool = tools[index]
        assert.equal(link.props.to, tool)
        assert.equal(bolt.props.node.kind, tool === 'project-wiki' ? 'wiki' : tool)
        assert.match(row.props.className, /\bconnection-node-anchor\b/)
        assert.match(bolt.props.className, /\bproject-tool-nav-lightning\b/)
        assert.deepEqual({...bolt.props.scope}, {organizationId:'organization', projectId:'selected-project', isPersistedOrganization:true})
    }
    assert.ok(navigation().toolRows().every(row => !row.props.children[1]))
})
