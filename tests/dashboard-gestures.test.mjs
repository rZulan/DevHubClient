import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)

// Exercise the actual component's pointer handlers and draft state without auth/network.
function dashboard(saved) {
  const values = []
  let cursor = 0
  let hit
  let published = 0
  let payload
  let cached = saved
  const react = {
    useState(initial) {
      const index = cursor++
      if (!(index in values)) values[index] = typeof initial === 'function' ? initial() : initial
      return [values[index], next => { values[index] = typeof next === 'function' ? next(values[index]) : next }]
    },
    useRef(initial) {
      const index = cursor++
      if (!(index in values)) values[index] = { current: initial }
      return values[index]
    },
    useMemo: fn => fn(), useEffect: () => {},
  }
  const mocks = {
    react,
    'react-router-dom': { useOutletContext: () => ({ organization: { id: '12345678-1234-4234-8234-123456789012', name: 'Test', members: [], teams: [], tasks: [] } }) },
    '@/app/hooks': { useAppDispatch: () => action => { cached = action.saved; }, useAppSelector: fn => fn({ auth: { user: { id: 'owner', firstName: 'Test', lastName: 'User' } } }) },
    '@/features/workshop/workshop-access': { hasWorkshopPermission: () => true },
    '@/services/api': { api: { util: { updateQueryData: (_endpoint, _id, update) => ({ saved: update() }) } }, useGetOrganizationDashboardQuery: () => ({ data: cached }), usePublishOrganizationDashboardMutation: () => [body => { published++; payload = body; return { unwrap: async () => ({ widgets: body.widgets, publishedAtUtc: "2026-09-28T00:00:00Z" }) } }, {}] },
    '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
  }
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL('../src/pages/workshop/workshop-lobby-page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    module, exports: module.exports,
    require: name => mocks[name] ?? (name.startsWith('@/') ? new Proxy({}, { get: (_, key) => key }) : require(name)),
    document: { elementFromPoint: () => hit ? { closest: () => hit } : null },
    getComputedStyle: () => ({ columnGap: '20', rowGap: '20', gridAutoRows: '80' }),
  })
  const render = () => { cursor = 0; return module.exports.WorkshopLobbyPage() }
  function nodes(node, result = []) {
    if (Array.isArray(node)) node.forEach(child => nodes(child, result))
    else if (node && typeof node === 'object' && node.props) { result.push(node); nodes(node.props.children, result) }
    return result
  }
  const all = () => nodes(render())
  const manage = all().find(node => node.props.onClick && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Manage Dashboard'))
  assert.ok(manage, 'manage dashboard button available')
  manage.props.onClick()
  const widgets = () => all().filter(node => node.props['data-widget-id'])
  const widget = id => widgets().find(node => node.props['data-widget-id'] === id)
  const event = (x, y, options = {}) => ({ button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {}, target: { closest: () => null },
    currentTarget: { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, closest: () => ({ clientWidth: 780 }) }, ...options,
  })
  return { all, widget, widgets, event, hit: value => { hit = value }, published: () => published, payload: () => payload, cached: () => cached }
}

test('dragging a quick-action body reorders within a row and across sections without publishing', () => {
  const d = dashboard()
  const source = 'default-create-project', target = 'default-task-board'
  d.widget(source).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetId: target } })
  d.widget(source).props.onPointerMove(d.event(300, 100))
  assert.match(d.widget(source).props.className, /is-dragging/)
  assert.match(d.widget(target).props.className, /is-drop-target/)
  d.widget(source).props.onPointerUp(d.event(300, 100))
  assert.ok(d.widgets().findIndex(n => n.props['data-widget-id'] === source) > d.widgets().findIndex(n => n.props['data-widget-id'] === target))
  d.widget(source).props.onPointerDown(d.event(300, 100))
  d.hit({ dataset: { widgetId: 'default-welcome' } })
  d.widget(source).props.onPointerMove(d.event(200, 20))
  d.widget(source).props.onPointerUp(d.event(200, 20))
  assert.equal(d.widgets()[0].props['data-widget-id'], source)
  assert.equal(d.published(), 0)
})

test('clicks, cancelled gestures, and releases outside a target do not reorder', () => {
  const d = dashboard(), id = 'default-create-project'
  const order = () => d.widgets().map(node => node.props['data-widget-id']).join(',')
  const original = order()
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.widget(id).props.onPointerMove(d.event(102, 102))
  d.widget(id).props.onPointerUp(d.event(102, 102))
  assert.equal(order(), original)
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetId: 'default-welcome' } })
  d.widget(id).props.onPointerMove(d.event(200, 20))
  d.widget(id).props.onPointerCancel(d.event(200, 20))
  assert.equal(order(), original)
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.hit(null)
  d.widget(id).props.onPointerMove(d.event(300, 300))
  d.widget(id).props.onPointerUp(d.event(300, 300))
  assert.equal(order(), original)
})

test('eight Ideas handles resize the correct axis, snap to the grid, and respect minimum size', () => {
  const d = dashboard(), id = 'default-create-project'
  const handle = direction => d.all().find(node => node.props['aria-label'] === `Resize Create new project from ${direction}`)
  for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) assert.ok(handle(direction))
  handle('e').props.onPointerDown(d.event(200, 100))
  handle('e').props.onPointerMove(d.event(400, 300))
  handle('e').props.onPointerUp()
  assert.match(d.widget(id).props.className, /width-2 /)
  assert.match(d.widget(id).props.className, /height-1 /)
  handle('s').props.onPointerDown(d.event(200, 100))
  handle('s').props.onPointerMove(d.event(400, 200))
  handle('s').props.onPointerUp()
  assert.match(d.widget(id).props.className, /width-2 /)
  assert.match(d.widget(id).props.className, /height-1-5 /)
  handle('nw').props.onPointerDown(d.event(100, 100))
  handle('nw').props.onPointerMove(d.event(2000, 2000))
  handle('nw').props.onPointerUp()
  assert.match(d.widget(id).props.className, /width-1 /)
  assert.match(d.widget(id).props.className, /height-1 /)
  assert.equal(d.published(), 0)
})


test('empty spaces exchange positions with widgets, and the layout survives publishing and reloading', async () => {
  const d = dashboard(), source = 'default-create-project'
  const original = d.widget(source).props.style
  const gap = d.all().find(node => node.props['data-widget-space'])
  assert.ok(gap)
  d.widget(source).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetSpace: gap.props['data-widget-space'], widgetSection: gap.props['data-widget-section'] } })
  d.widget(source).props.onPointerMove(d.event(600, 600))
  d.widget(source).props.onPointerUp(d.event(600, 600))
  assert.equal(d.widget(source).props.style.gridColumn, '5 / span 2')
  assert.equal(d.widget(source).props.style.gridRow, '3 / span 2')
  const vacated = d.all().find(node => node.props['data-widget-section'] === 'default-actions-section')
  assert.equal(vacated.props.style.gridColumn, original.gridColumn)
  assert.equal(vacated.props.style.gridRow, original.gridRow)
  // The remainder of the larger target is still a usable gap.
  assert.ok(d.all().filter(node => node.props['data-widget-space']).length >= 2)
  const publish = d.all().find(node => node.props.children === 'Publish for everyone')
  publish.props.onClick()
  await new Promise(setImmediate)
  const restored = dashboard({ widgets: d.payload().widgets, publishedAtUtc: '2026-09-28T00:00:00Z' })
  assert.equal(restored.widget(source).props.style.gridColumn, '5 / span 2')
  assert.equal(restored.widget(source).props.style.gridRow, '3 / span 2')
  assert.equal(restored.widget('default-task-board').props.style.gridColumn, '3 / span 2')
})

test('only the selected widget is marked focused', () => {
  const d = dashboard()
  assert.equal(d.widgets().filter(node => node.props.className.includes('is-focused')).length, 0)
  d.widget('default-create-project').props.onFocus()
  assert.match(d.widget('default-create-project').props.className, /is-focused/)
  d.widget('default-task-board').props.onFocus()
  assert.ok(!d.widget('default-create-project').props.className.includes('is-focused'))
  assert.equal(d.widgets().filter(node => node.props.className.includes('is-focused')).length, 1)
})


test('publishing slot four immediately updates the view while the old query is still cached', async () => {
  const widgets = ['one', 'two', 'three'].map((id, index) => ({ id, type: 'quick-action-project', sectionId: 'row', size: 'third', width: 1, height: 1, column: index * 2, row: 0 }))
  const d = dashboard({ widgets, publishedAtUtc: '2026-09-27T00:00:00Z' })
  const gap = d.all().find(node => node.props['data-widget-space'])
  d.widget('three').props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetSpace: gap.props['data-widget-space'], widgetSection: gap.props['data-widget-section'] } })
  d.widget('three').props.onPointerMove(d.event(300, 100))
  d.widget('three').props.onPointerUp(d.event(300, 100))
  assert.equal(d.widget('three').props.style.gridColumn, '7 / span 2')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.ok(!d.widget('three').props.className.includes('is-editing'))
  assert.equal(d.widget('three').props.style.gridColumn, '7 / span 2')
  assert.equal(d.cached().widgets.find(widget => widget.id === 'three').column, 6)
  assert.equal(dashboard(JSON.parse(JSON.stringify(d.cached()))).widget('three').props.style.gridColumn, '7 / span 2')
})

test('reset restores the standard draft without publishing and discard keeps the saved layout', () => {
  const saved = {
    widgets: [{ id: 'custom-note', type: 'text', sectionId: 'custom-section', size: 'half', width: 2, height: 1, content: 'Keep me' }],
    publishedAtUtc: '2026-09-28T00:00:00Z',
  }
  const d = dashboard(saved)
  assert.ok(d.widget('custom-note'))
  const reset = d.all().find(node => [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Reset to default'))
  assert.ok(reset)
  reset.props.onClick()
  assert.equal(d.widgets().length, 9)
  assert.ok(d.widget('default-welcome'))
  assert.equal(d.widget('custom-note'), undefined)
  assert.equal(d.published(), 0)
  d.all().find(node => node.props.children === 'Discard').props.onClick()
  assert.ok(d.widget('custom-note'))
  assert.equal(d.published(), 0)
})

