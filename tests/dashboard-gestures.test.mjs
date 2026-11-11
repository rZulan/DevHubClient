import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const widgetCatalog = require('../src/features/workshop/dashboard-widget-catalog.ts')

// Exercise the actual component's pointer handlers and draft state without auth/network.
function dashboard(saved, options = {}) {
  const values = []
  let cursor = 0
  let hit
  let published = 0
  let payload
  let cached = saved
  let personalCached = options.personalSaved
  let personalSaves = 0
  let paletteRefocuses = 0
  let params = new URLSearchParams(options.personal ? 'view=personal' : '')
  let mountedKey
  let nextId = 0
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
    '@/features/workshop/dashboard-widget-catalog': widgetCatalog,
    '@/features/workshop/dashboard-widget-picker': {DashboardWidgetPicker: 'DashboardWidgetPicker', dashboardWidgetDragMime: 'application/x-zevont-dashboard-widget', useDashboardPaletteWindow: () => ({open() {}, refocusAfterDrop() {paletteRefocuses++}})},
    '@/features/workshop/dashboard-widget-appearance': {DashboardWidgetAppearanceControl: 'DashboardWidgetAppearanceControl', dashboardWidgetAppearanceStyle: () => ({}), normalizeDashboardImageFrame: widget => widget},
    '@/features/workshop/dashboard-widget-settings': {dashboardWidgetStarterContent: () => null},
    '@/lib/create-client-id': {createClientId: () => String(++nextId)},
    '@/features/workshop/dashboard-view': {getDashboardView: (_user, _org, view) => view === 'personal' ? 'personal' : 'organization', setDashboardView: () => {}},
    react,
    'react-router-dom': { useSearchParams: () => [params, update => {params = update(params)}], useOutletContext: () => ({ organization: { id: '12345678-1234-4234-8234-123456789012', name: 'Test', members: [], teams: [], tasks: [] } }) },
    '@/app/hooks': { useAppDispatch: () => action => { if (action.endpoint === 'getPersonalDashboard') personalCached = action.saved; else cached = action.saved; }, useAppSelector: fn => fn({ auth: { user: { id: 'owner', firstName: 'Test', lastName: 'User' } } }) },
    '@/features/workshop/workshop-access': { hasWorkshopPermission: () => options.canManage !== false },
    '@/services/api': {
      api: { util: { updateQueryData: (endpoint, _id, update) => ({ endpoint, saved: update() }) } },
      useGetOrganizationDashboardQuery: () => ({ currentData: cached, error: options.orgError }),
      useGetPersonalDashboardQuery: () => ({ currentData: personalCached, error: options.personalError }),
      usePublishOrganizationDashboardMutation: () => [body => { published++; payload = body; return { unwrap: async () => ({ widgets: body.widgets, widgetGap: body.widgetGap, publishedAtUtc: '2026-09-28T00:00:00Z' }) } }, {}],
      useSavePersonalDashboardMutation: () => [body => { personalSaves++; payload = body; return { unwrap: async () => ({ widgets: body.widgets, widgetGap: body.widgetGap, savedAtUtc: '2026-11-01T00:00:00Z' }) } }, {}],
    },
    '@/lib/utils': { cn: (...classes) => classes.filter(Boolean).join(' ') },
  }
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(new URL('../src/pages/workshop/workshop-lobby-page.tsx', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, {
    module, exports: module.exports,
    URLSearchParams,
    require: name => mocks[name] ?? (name.startsWith('@/') ? new Proxy({}, { get: (_, key) => key }) : require(name)),
    document: {
      elementFromPoint: () => hit ? { closest: () => hit } : null,
      elementsFromPoint: () => hit ? [{ closest: () => hit }] : [],
    },
    getComputedStyle: () => ({ columnGap: '20', rowGap: '20', gridAutoRows: '80' }),
  })
  const render = () => {
    cursor = 0
    const page = module.exports.WorkshopLobbyPage()
    if (mountedKey !== page.key) {values.length = 0; mountedKey = page.key}
    return page.type(page.props)
  }
  function nodes(node, result = []) {
    if (Array.isArray(node)) node.forEach(child => nodes(child, result))
    else if (node && typeof node === 'object' && node.props) { result.push(node); nodes(node.props.children, result) }
    return result
  }
  const all = () => nodes(render())
  const manage = all().find(node => node.props.onClick && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Manage Dashboard'))
  if (options.autoEdit !== false) {
    assert.ok(manage, 'manage dashboard button available')
    manage.props.onClick()
  }
  const widgets = () => all().filter(node => node.props['data-widget-id'])
  const widget = id => widgets().find(node => node.props['data-widget-id'] === id)
  const event = (x, y, options = {}) => ({ button: 0, isPrimary: true, pointerId: 1, clientX: x, clientY: y,
    preventDefault() {}, stopPropagation() {}, target: { closest: () => null },
    currentTarget: { setPointerCapture() {}, hasPointerCapture: () => true, releasePointerCapture() {}, closest: () => ({ clientWidth: 980 }) }, ...options,
  })
  return { all, widget, widgets, event, switchView: view => params.set('view', view), hit: value => { hit = value }, published: () => published, personalSaves: () => personalSaves, payload: () => payload, cached: () => cached, personalCached: () => personalCached, paletteRefocuses: () => paletteRefocuses }
}

test('regular members can save their personal layout without publishing the organization dashboard', async () => {
  const saved = {widgets: [{id: 'org-note', type: 'text-rows-1', content: '{"rows":[{"text":"Shared"}]}', width: 2, height: 1}], publishedAtUtc: '2026-11-01T00:00:00Z'}
  const d = dashboard(saved, {personal: true, canManage: false})
  assert.ok(d.widget('default-info-personal-tasks'))
  assert.equal(d.widget('org-note'), undefined)
  d.all().find(node => node.props.children === 'Save personal dashboard').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.personalSaves(), 1)
  assert.equal(d.published(), 0)
  assert.deepEqual(d.cached(), saved)
  assert.equal(d.payload().userId, 'owner')
  assert.ok(d.personalCached().savedAtUtc)
  d.switchView('organization')
  assert.ok(d.widget('org-note'))
  assert.equal(d.all().some(node => node.props.onClick && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Manage Dashboard')), false)
  d.switchView('personal')
  assert.ok(d.widget('default-info-personal-tasks'))
  assert.equal(d.widget('org-note'), undefined)
})

test('two copies of a fixed widget save independently and expose no resize handles', async () => {
  const d = dashboard(undefined, {personal: true, personalSaved: {widgets: [], savedAtUtc: '2026-11-01T00:00:00Z'}})
  const item = widgetCatalog.dashboardWidgetByType.get('link-teams-chip')
  const picker = () => d.all().find(node => node.props.fits && node.props.onAdd)
  picker().props.onAdd(item)
  picker().props.onAdd(item)
  const widgets = d.widgets()
  assert.equal(widgets.length, 2)
  assert.notEqual(widgets[0].props['data-widget-id'], widgets[1].props['data-widget-id'])
  assert.ok(widgets.every(widget => widget.props['data-widget-scope'] === 'Global'))
  assert.ok(!d.all().some(node => node.props.className?.includes('workshop-widget-resize')))
  d.all().find(node => node.props.children === 'Save personal dashboard').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets.length, 2)
  assert.ok(d.payload().widgets.every(widget => widget.type === 'link-teams-chip' && widget.width === 1 && widget.height === .5))
})

test('clicking palette widgets fills the top rows from left to right and respects a selected gap', async () => {
  const existing = (id, sectionId, column, row) => ({id, sectionId, column, row, type: 'link-teams-chip', width: 1, height: .5})
  const d = dashboard({publishedAtUtc: '2026-11-01T00:00:00Z', widgets: [
    existing('left', 'top', 0, 0), existing('middle', 'top', 4, 0), existing('next-row', 'top', 2, 1),
    existing('lower-row', 'lower', 2, 0),
  ]})
  const item = widgetCatalog.dashboardWidgetByType.get('link-calendar-chip')
  const picker = () => d.all().find(node => node.props.fits && node.props.onAdd)
  for (let i = 0; i < 4; i++) picker().props.onAdd(item)
  d.all().find(node => node.props['data-widget-space'] === 'lower:0:0').props.onClick()
  picker().props.onAdd(item)
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  const placements = Array.from(d.payload().widgets.filter(widget => widget.type === item.type),
    ({sectionId, column, row}) => [sectionId, column, row])
  assert.deepEqual(placements, [['top', 2, 0], ['top', 6, 0], ['top', 8, 0], ['top', 0, 1], ['lower', 0, 0]])
})

test('four Quick Link cards and five chips fit across the 5-unit grid', async () => {
  const oldCard = (id, type, column) => ({id, type, sectionId: 'links', column, row: 0, width: 4 / 3, height: 1})
  const d = dashboard({publishedAtUtc: '2026-11-01T00:00:00Z', widgets: [
    oldCard('teams', 'link-teams-card', 0), oldCard('calendar', 'link-calendar-card', 8 / 3),
    oldCard('notes', 'link-todo-card', 16 / 3),
  ]})
  const picker = d.all().find(node => node.props.fits && node.props.onAdd)
  picker.props.onAdd(widgetCatalog.dashboardWidgetByType.get('link-erd-card'))
  const row = ['1 / span 5', '6 / span 5', '11 / span 5', '16 / span 5']
  assert.deepEqual(d.widgets().map(widget => widget.props.style.gridColumn), row)
  assert.ok(d.widgets().every(widget => widget.props.style.gridRow === '1 / span 2'))
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.deepEqual(Array.from(d.payload().widgets, widget => widget.column), [0, 2.5, 5, 7.5])
  assert.ok(d.payload().widgets.every(widget => widget.width === 1.25 && widget.height === 1))
  assert.deepEqual(dashboard(d.cached()).widgets().map(widget => widget.props.style.gridColumn), row)

  const chips = dashboard(undefined, {personal: true, personalSaved: {widgets: [], savedAtUtc: '2026-11-01T00:00:00Z'}})
  for (let i = 0; i < 5; i++) chips.all().find(node => node.props.fits && node.props.onAdd).props.onAdd(widgetCatalog.dashboardWidgetByType.get('link-teams-chip'))
  assert.deepEqual(chips.widgets().map(widget => widget.props.style.gridColumn), ['1 / span 4', '5 / span 4', '9 / span 4', '13 / span 4', '17 / span 4'])
  assert.ok(chips.widgets().every(widget => widget.props.style.gridRow === '1 / span 1'))
})

test('a palette drop inserts the preview size and leaves the palette open for another widget', async () => {
  const d = dashboard(undefined, {personal: true, personalSaved: {widgets: [], savedAtUtc: '2026-11-01T00:00:00Z'}})
  const item = widgetCatalog.dashboardWidgetByType.get('graph-tasks')
  const picker = () => d.all().find(node => node.props.fits && node.props.onAdd)
  d.all().find(node => node.props.title === 'No widgets yet').props.action.props.onClick()
  picker().props.onDrop(item, 100, 100)
  assert.equal(d.widgets().length, 0)
  d.hit({dataset: {widgetInsert: '0'}})
  assert.equal(picker().props.onDragOver(item, 100, 100), true)
  picker().props.onDrop(item, 100, 100)
  assert.equal(d.widgets().length, 1)
  assert.equal(picker().props.open, true)
  d.all().find(node => node.props.children === 'Save personal dashboard').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets[0].type, 'graph-tasks')
  assert.equal(d.payload().widgets[0].width, item.defaultWidth)
  assert.equal(d.payload().widgets[0].height, item.defaultHeight)
})

test('older graphs reflow to two per row without shifting unchanged widgets', async () => {
  const oldGraph = (id, type, column, row, width, height) => ({id, type, sectionId: 'charts', width, height, column, row})
  const d = dashboard({publishedAtUtc: '2026-11-01T00:00:00Z', widgets: [
    oldGraph('comparison', 'graph-todos', 0, 0, 1.5, 1), oldGraph('pie', 'graph-bug-status', 3, 0, 2, 1.5),
    oldGraph('activity', 'graph-task-activity', 4, 3, 2, 1),
    {id: 'note', type: 'text-rows-1', sectionId: 'charts', width: 1, height: .5, column: 8, row: 3},
  ]})
  assert.equal(d.widget('comparison').props.style.gridColumn, '1 / span 10')
  assert.equal(d.widget('pie').props.style.gridColumn, '11 / span 10')
  assert.equal(d.widget('pie').props.style.gridRow, '1 / span 3')
  assert.equal(d.widget('note').props.style.gridColumn, '17 / span 4')
  assert.equal(d.widget('note').props.style.gridRow, '4 / span 1')
  assert.equal(d.widget('activity').props.style.gridRow, '4 / span 2')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  const dimensions = Array.from(d.payload().widgets, ({width, height}) => [width, height])
  assert.deepEqual(dimensions, [[2.5, 1], [2.5, 1.5], [2.5, 1], [1, .5]])
})

test('a native drag into a valid dashboard slot copies the widget and brings the palette forward', () => {
  const d = dashboard(undefined, {personal: true, personalSaved: {widgets: [], savedAtUtc: '2026-11-01T00:00:00Z'}})
  const item = widgetCatalog.dashboardWidgetByType.get('link-teams-chip')
  const picker = () => d.all().find(node => node.props.onNativeDragStart)
  const area = () => d.all().find(node => node.props['data-widget-insert'] === 0 && node.props.onDragOver)
  d.all().find(node => node.props.title === 'No widgets yet').props.action.props.onClick()
  const mime = 'application/x-zevont-dashboard-widget'
  let allowed = false
  const dataTransfer = {types: [mime], getData: () => item.type}
  const event = d.event(100, 100, {dataTransfer, preventDefault: () => {allowed = true}})
  d.hit({dataset: {widgetInsert: '0'}})
  area().props.onDragOver(event)
  assert.equal(allowed, false)
  picker().props.onNativeDragStart(item)
  area().props.onDragOver(event)
  assert.equal(allowed, true)
  assert.equal(dataTransfer.dropEffect, 'copy')
  area().props.onDrop({...event, dataTransfer: {...dataTransfer, getData: () => 'graph-tasks'}})
  assert.equal(d.widgets().length, 0)
  assert.equal(d.paletteRefocuses(), 0)
  area().props.onDrop(event)
  assert.equal(d.widgets().length, 1)
  assert.match(d.widgets()[0].props['data-widget-id'], /^link-teams-chip-/)
  assert.equal(picker().props.open, true)
  assert.equal(d.paletteRefocuses(), 1)
})

test('an intentionally empty personal layout stays empty after reload', () => {
  const d = dashboard(undefined, {personal: true, personalSaved: {widgets: [], savedAtUtc: '2026-11-01T00:00:00Z'}, autoEdit: false})
  assert.equal(d.widgets().length, 0)
  assert.ok(d.all().some(node => node.props.title === 'No widgets yet'))
})

test('saved dashboards omit retired widgets while keeping the placement and content of revamp widgets', async () => {
  const content = '{"rows":[{"text":"Keep this"}]}'
  const saved = {publishedAtUtc: '2026-11-01T00:00:00Z', widgets: [
    {id: 'welcome', type: 'welcome', sectionId: 'old', width: 4, height: 1},
    {id: 'actions', type: 'quick-actions', sectionId: 'mixed', width: 2, height: 1.5},
    {id: 'custom', type: 'text-rows-1', sectionId: 'mixed', width: 2, height: .5, column: 4, row: 0, content},
  ]}
  const d = dashboard(saved)
  assert.deepEqual(d.widgets().map(widget => widget.props['data-widget-id']), ['custom'])
  assert.equal(d.widget('custom').props.style.gridColumn, '9 / span 8')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets.length, 1)
  assert.equal(d.payload().widgets[0].content, content)
  assert.equal(d.payload().widgets[0].column, 4)
})

test('a failed personal load cannot be overwritten with the default layout', () => {
  const d = dashboard(undefined, {personal: true, personalError: {status: 500}, autoEdit: false})
  assert.ok(d.all().some(node => node.props.title === 'Could not load dashboard'))
  const manage = d.all().find(node => node.props.onClick && [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Manage Dashboard'))
  assert.equal(manage.props.disabled, true)
  manage.props.onClick()
  assert.equal(d.all().some(node => node.props.children === 'Save personal dashboard'), false)
})

const gestureLayout = {
  publishedAtUtc: '2026-09-28T00:00:00Z',
  widgets: [
    {id: 'fixture-header', sectionId: 'header', type: 'text-rows-1', width: 4, height: 1},
    ...['alpha', 'beta', 'gamma', 'delta'].map(id => ({id: `fixture-${id}`, sectionId: 'actions', type: 'text-rows-2', width: 1, height: 1})),
    {id: 'fixture-tall', sectionId: 'info', type: 'info-org-teams', width: 2, height: 2},
    {id: 'fixture-short', sectionId: 'info', type: 'info-org-todos', width: 2, height: 1},
  ],
}

test('dragging a widget body reorders within a row and across sections without publishing', () => {
  const d = dashboard(gestureLayout)
  const source = 'fixture-alpha', target = 'fixture-beta'
  d.widget(source).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetId: target } })
  d.widget(source).props.onPointerMove(d.event(300, 100))
  assert.match(d.widget(source).props.className, /is-dragging/)
  assert.match(d.widget(target).props.className, /is-drop-target/)
  d.widget(source).props.onPointerUp(d.event(300, 100))
  assert.ok(d.widgets().findIndex(n => n.props['data-widget-id'] === source) > d.widgets().findIndex(n => n.props['data-widget-id'] === target))
  d.widget(source).props.onPointerDown(d.event(300, 100))
  d.hit({ dataset: { widgetId: 'fixture-header' } })
  d.widget(source).props.onPointerMove(d.event(200, 20))
  d.widget(source).props.onPointerUp(d.event(200, 20))
  assert.equal(d.widgets()[0].props['data-widget-id'], source)
  assert.equal(d.published(), 0)
})

test('clicks, cancelled gestures, and releases outside a target do not reorder', () => {
  const d = dashboard(gestureLayout), id = 'fixture-alpha'
  const order = () => d.widgets().map(node => node.props['data-widget-id']).join(',')
  const original = order()
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.widget(id).props.onPointerMove(d.event(102, 102))
  d.widget(id).props.onPointerUp(d.event(102, 102))
  assert.equal(order(), original)
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetId: 'fixture-header' } })
  d.widget(id).props.onPointerMove(d.event(200, 20))
  d.widget(id).props.onPointerCancel(d.event(200, 20))
  assert.equal(order(), original)
  d.widget(id).props.onPointerDown(d.event(100, 100))
  d.hit(null)
  d.widget(id).props.onPointerMove(d.event(300, 300))
  d.widget(id).props.onPointerUp(d.event(300, 300))
  assert.equal(order(), original)
})

test('eight text-widget handles resize the correct axis, snap to the grid, and respect minimum size', () => {
  const id = 'fixture-alpha'
  const d = dashboard({...gestureLayout, widgets: gestureLayout.widgets.filter(widget => widget.id === id)})
  const handle = direction => d.all().find(node => node.props['aria-label'] === `Resize 2 Rows from ${direction}`)
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
  assert.match(d.widget(id).props.className, /height-0-5 /)
  assert.equal(d.published(), 0)
})

test('left resize keeps the right edge fixed and stops at the neighboring widget', async () => {
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'neighbor', type: 'text-rows-2', sectionId: 'row', column: 0, row: 1, width: 1.5, height: 1},
    {id: 'image', type: 'image-full', sectionId: 'row', column: 4, row: 1, width: 1.5, height: 1},
  ]})
  const handle = direction => d.all().find(node => node.props['aria-label'] === `Resize Whole image from ${direction}`)
  handle('w').props.onPointerDown(d.event(400, 100))
  handle('w').props.onPointerMove(d.event(100, 100))
  handle('w').props.onPointerUp()
  assert.equal(d.widget('image').props.style.gridColumn, '7 / span 8')
  assert.equal(d.widget('neighbor').props.style.gridColumn, '1 / span 6')
  handle('w').props.onKeyDown({...d.event(0, 0), key: 'ArrowRight'})
  assert.equal(d.widget('image').props.style.gridColumn, '9 / span 6')
  handle('nw').props.onKeyDown({...d.event(0, 0), key: 'ArrowUp'})
  assert.equal(d.widget('image').props.style.gridRow, '1 / span 3')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  const restored = dashboard(d.cached())
  assert.equal(restored.widget('image').props.style.gridColumn, '9 / span 6')
  assert.equal(restored.widget('image').props.style.gridRow, '1 / span 3')
  assert.equal(restored.widget('neighbor').props.style.gridRow, '2 / span 2')
})

test('image handles resize width and height independently and keep the new size after saving', async () => {
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'image', type: 'image-full', sectionId: 'row', column: 0, row: 0, width: 1.5, height: 1},
  ]})
  const handle = direction => d.all().find(node => node.props['aria-label'] === `Resize Whole image from ${direction}`)
  handle('se').props.onPointerDown(d.event(100, 100))
  handle('se').props.onPointerMove(d.event(800, 700))
  handle('se').props.onPointerUp()
  assert.equal(d.widget('image').props.style.gridColumn, '1 / span 20')
  assert.equal(d.widget('image').props.style.gridRow, '1 / span 8')
  handle('s').props.onPointerDown(d.event(100, 700))
  handle('s').props.onPointerMove(d.event(100, 0))
  handle('s').props.onPointerUp()
  assert.equal(d.widget('image').props.style.gridColumn, '1 / span 20')
  assert.equal(d.widget('image').props.style.gridRow, '1 / span 1')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets[0].width, 5)
  assert.equal(d.payload().widgets[0].height, .5)
  assert.equal(dashboard(d.cached()).widget('image').props.style.gridColumn, '1 / span 20')
})

test('widening a widget pushes both rows of neighbors into free space and restores them when pulled back', async () => {
  const chip = (id, column, row) => ({id, type: 'link-teams-chip', sectionId: 'row', column, row, width: 1, height: .5})
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'text', type: 'text-rows-2', sectionId: 'row', column: 0, row: 0, width: 2.5, height: 1},
    chip('top-a', 5, 0), chip('top-b', 7, 0), chip('bottom-a', 5, 1), chip('bottom-b', 7, 1), chip('below', 6, 2),
  ]})
  const handle = () => d.all().find(node => node.props['aria-label'] === 'Resize 2 Rows from e')
  const positions = () => ['text', 'top-a', 'top-b', 'bottom-a', 'bottom-b', 'below'].map(id => d.widget(id).props.style.gridColumn)
  const initial = ['1 / span 10', '11 / span 4', '15 / span 4', '11 / span 4', '15 / span 4', '13 / span 4']
  const widened = ['1 / span 12', '13 / span 4', '17 / span 4', '13 / span 4', '17 / span 4', '13 / span 4']
  handle().props.onPointerDown(d.event(500, 100))
  handle().props.onPointerMove(d.event(700, 100))
  assert.deepEqual(positions(), widened)
  handle().props.onPointerMove(d.event(500, 100))
  assert.deepEqual(positions(), initial)
  handle().props.onPointerMove(d.event(600, 100))
  handle().props.onPointerUp()
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(dashboard(d.cached()).widget('bottom-b').props.style.gridColumn, '17 / span 4')
})

test('a row without room blocks an east resize without pushing neighbors in another row', () => {
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'text', type: 'text-rows-2', sectionId: 'row', column: 0, row: 0, width: 2.5, height: 1},
    {id: 'chip', type: 'link-teams-chip', sectionId: 'row', column: 5, row: 0, width: 1, height: .5},
    {id: 'card', type: 'link-org-chart-card', sectionId: 'row', column: 7, row: 1, width: 1.25, height: 1},
    {id: 'bottom-chip', type: 'link-erd-chip', sectionId: 'row', column: 5, row: 1, width: 1, height: .5},
  ]})
  const handle = d.all().find(node => node.props['aria-label'] === 'Resize 2 Rows from e')
  handle.props.onKeyDown({...d.event(0, 0), key: 'ArrowRight'})
  assert.equal(d.widget('text').props.style.gridColumn, '1 / span 10')
  assert.equal(d.widget('chip').props.style.gridColumn, '11 / span 4')
  assert.equal(d.widget('bottom-chip').props.style.gridColumn, '11 / span 4')
})

test('a previously saved quarter-height widget snaps to the half-unit grid', async () => {
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'text', type: 'text-rows-2', sectionId: 'row', column: 0, row: 1.5, width: 2, height: .25},
  ]})
  assert.equal(d.widget('text').props.style.gridRow, '3 / span 1')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets[0].height, .5)
  assert.equal(d.payload().widgets[0].row, 2)
})

test('a widget can slide left into an adjacent half-width gap without shrinking', () => {
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'neighbor', type: 'text-rows-2', sectionId: 'row', column: 0, row: 0, width: 1, height: 1},
    {id: 'image', type: 'image-full', sectionId: 'row', column: 3, row: 0, width: 2, height: 1},
  ]})
  d.widget('image').props.onPointerDown(d.event(430, 100))
  d.hit({dataset: {widgetSpace: 'row:0:2', widgetSection: 'row'}})
  d.widget('image').props.onPointerMove(d.event(245, 100))
  assert.match(d.all().find(node => node.props['data-widget-space'] === 'row:0:2').props.className, /is-drop-target/)
  d.widget('image').props.onPointerUp(d.event(245, 100))
  assert.equal(d.widget('image').props.style.gridColumn, '5 / span 8')
  assert.equal(d.widget('neighbor').props.style.gridColumn, '1 / span 4')

  d.widget('image').props.onPointerDown(d.event(430, 100))
  d.hit({dataset: {widgetGrid: 'row'}, clientWidth: 980})
  d.widget('image').props.onPointerMove(d.event(530, 100))
  d.widget('image').props.onPointerUp(d.event(530, 100))
  assert.equal(d.widget('image').props.style.gridColumn, '7 / span 8')
})

test('a fixed chip can slide to the right edge using part of its previous footprint', async () => {
  const chip = (id, row) => ({id, type: 'link-erd-chip', sectionId: 'row', column: 7, row, width: 1, height: .5})
  const d = dashboard({...gestureLayout, widgets: [
    {id: 'left', type: 'text-rows-2', sectionId: 'row', column: 0, row: 0, width: 3.5, height: 1},
    chip('top-chip', 0), chip('bottom-chip', 1),
  ]})
  const gapId = 'row:0:9'
  d.widget('bottom-chip').props.onPointerDown(d.event(825, 140))
  d.hit({dataset: {widgetSpace: gapId, widgetSection: 'row'}})
  d.widget('bottom-chip').props.onPointerMove(d.event(975, 140))
  assert.match(d.all().find(node => node.props['data-widget-space'] === gapId).props.className, /is-drop-target/)
  d.widget('bottom-chip').props.onPointerUp(d.event(975, 140))
  assert.equal(d.widget('bottom-chip').props.style.gridColumn, '17 / span 4')
  assert.equal(d.widget('bottom-chip').props.style.gridRow, '2 / span 1')
  assert.equal(d.widget('top-chip').props.style.gridColumn, '15 / span 4')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(dashboard(d.cached()).widget('bottom-chip').props.style.gridColumn, '17 / span 4')
})


test('empty spaces exchange positions with widgets, and the layout survives publishing and reloading', async () => {
  const d = dashboard(gestureLayout), source = 'fixture-alpha'
  const original = d.widget(source).props.style
  const gap = d.all().find(node => node.props['data-widget-space'] === 'info:2:4')
  assert.ok(gap)
  d.widget(source).props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetSpace: gap.props['data-widget-space'], widgetSection: gap.props['data-widget-section'] } })
  d.widget(source).props.onPointerMove(d.event(600, 600))
  d.widget(source).props.onPointerUp(d.event(600, 600))
  assert.equal(d.widget(source).props.style.gridColumn, '9 / span 4')
  assert.equal(d.widget(source).props.style.gridRow, '3 / span 2')
  const vacated = d.all().find(node => node.props['data-widget-section'] === 'actions')
  assert.equal(vacated.props.style.gridColumn, original.gridColumn)
  assert.equal(vacated.props.style.gridRow, original.gridRow)
  // The remainder of the larger target is still a usable gap.
  assert.ok(d.all().filter(node => node.props['data-widget-space']).length >= 2)
  const publish = d.all().find(node => node.props.children === 'Publish for everyone')
  publish.props.onClick()
  await new Promise(setImmediate)
  const restored = dashboard({ widgets: d.payload().widgets, publishedAtUtc: '2026-09-28T00:00:00Z' })
  assert.equal(restored.widget(source).props.style.gridColumn, '9 / span 4')
  assert.equal(restored.widget(source).props.style.gridRow, '3 / span 2')
  assert.equal(restored.widget('fixture-beta').props.style.gridColumn, '5 / span 4')
})

test('only the selected widget is marked focused', () => {
  const d = dashboard(gestureLayout)
  assert.equal(d.widgets().filter(node => node.props.className.includes('is-focused')).length, 0)
  d.widget('fixture-alpha').props.onFocus()
  assert.match(d.widget('fixture-alpha').props.className, /is-focused/)
  d.widget('fixture-beta').props.onFocus()
  assert.ok(!d.widget('fixture-alpha').props.className.includes('is-focused'))
  assert.equal(d.widgets().filter(node => node.props.className.includes('is-focused')).length, 1)
})


test('publishing slot four immediately updates the view while the old query is still cached', async () => {
  const widgets = ['one', 'two', 'three'].map((id, index) => ({ id, type: 'text-rows-2', sectionId: 'row', size: 'third', width: 1, height: 1, column: index * 2, row: 0 }))
  const d = dashboard({ widgets, publishedAtUtc: '2026-09-27T00:00:00Z' })
  const gap = d.all().find(node => node.props['data-widget-space'])
  d.widget('three').props.onPointerDown(d.event(100, 100))
  d.hit({ dataset: { widgetSpace: gap.props['data-widget-space'], widgetSection: gap.props['data-widget-section'] } })
  d.widget('three').props.onPointerMove(d.event(300, 100))
  d.widget('three').props.onPointerUp(d.event(300, 100))
  assert.equal(d.widget('three').props.style.gridColumn, '13 / span 4')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.ok(!d.widget('three').props.className.includes('is-editing'))
  assert.equal(d.widget('three').props.style.gridColumn, '13 / span 4')
  assert.equal(d.cached().widgets.find(widget => widget.id === 'three').column, 6)
  assert.equal(dashboard(JSON.parse(JSON.stringify(d.cached()))).widget('three').props.style.gridColumn, '13 / span 4')
})

test('a saved compact members widget grows without moving neighboring custom widgets', async () => {
  const d = dashboard({publishedAtUtc: '2026-11-01T00:00:00Z', widgets: [
    {id: 'presence', type: 'info-org-members', sectionId: 'header', column: 7, row: 0, width: 1.5, height: .5},
    {id: 'note', type: 'text-rows-1', sectionId: 'header', column: 7, row: 1, width: 1.5, height: .5, content: 'Keep me'},
  ]})
  assert.equal(d.widget('note').props.style.gridColumn, '15 / span 6')
  assert.equal(d.widget('note').props.style.gridRow, '2 / span 1')
  assert.equal(d.widget('presence').props.style.gridColumn, '9 / span 6')
  assert.equal(d.widget('presence').props.style.gridRow, '1 / span 2')
  d.all().find(node => node.props.children === 'Publish for everyone').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgets.find(widget => widget.id === 'presence').height, 1)
})

test('changing the widget gap previews it, and only save updates the active dashboard', async () => {
  const d = dashboard({widgets: [], widgetGap: 24, publishedAtUtc: '2026-11-01T00:00:00Z'}, {
    personal: true, personalSaved: {widgets: [], widgetGap: 12, savedAtUtc: '2026-11-01T00:00:00Z'},
  })
  const slider = () => d.all().find(node => node.props.type === 'range')
  const gap = () => d.all().find(node => node.props.className?.includes('workshop-widget-sections')).props.style?.['--dashboard-widget-gap']
  assert.equal(slider().props.value, 12)
  slider().props.onChange({currentTarget: {valueAsNumber: 8}})
  assert.equal(gap(), '8px')
  d.all().find(node => node.props.children === 'Discard').props.onClick()
  assert.equal(gap(), '12px')
  d.all().find(node => [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Manage Dashboard')).props.onClick()
  slider().props.onChange({currentTarget: {valueAsNumber: 10}})
  d.all().find(node => node.props.children === 'Save personal dashboard').props.onClick()
  await new Promise(setImmediate)
  assert.equal(d.payload().widgetGap, 10)
  assert.equal(gap(), '10px')
  d.switchView('organization')
  assert.equal(gap(), '24px')
})

test('reset restores the standard draft without publishing and discard keeps the saved layout', () => {
  const saved = {
    widgets: [{ id: 'custom-note', type: 'text-rows-1', sectionId: 'custom-section', size: 'half', width: 2, height: 1, content: 'Keep me' }],
    publishedAtUtc: '2026-09-28T00:00:00Z', widgetGap: 14,
  }
  const d = dashboard(saved)
  assert.ok(d.widget('custom-note'))
  const reset = d.all().find(node => [node.props.children].flat().some(child => typeof child === 'string' && child.trim() === 'Reset to default'))
  assert.ok(reset)
  reset.props.onClick()
  assert.equal(d.all().find(node => node.props.type === 'range').props.value, 20)
  assert.equal(d.widgets().length, 11)
  assert.equal(d.widget('default-org-heading').props.style.gridColumn, '1 / span 14')
  assert.equal(d.widget('default-info-org-members').props.style.gridColumn, '15 / span 6')
  assert.equal(d.widget('default-info-org-members').props.style.gridRow, '1 / span 2')
  assert.ok(d.widget('default-link-teams-chip'))
  assert.equal(d.widget('custom-note'), undefined)
  assert.equal(d.published(), 0)
  d.all().find(node => node.props.children === 'Discard').props.onClick()
  assert.ok(d.widget('custom-note'))
  assert.equal(d.published(), 0)
})

