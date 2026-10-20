import test from 'node:test'
import assert from 'node:assert/strict'
import { axisAlignedBounds, canvasGridBackground, combinedBounds, fitBounds, zoomAt, pinchView } from '../src/features/workshop/canvas-view.ts'

test('zoomed-out dot grids stay sparse for both canvas grid sizes, including extreme zoom', () => {
  for (const base of [22,24]) for (const zoom of [1,.75,.666,.5,.25,.1,.01,.001,1e-100,1e-300,Number.MIN_VALUE]) {
    const grid=canvasGridBackground(zoom,{x:0,y:0},base)
    const spacing=parseFloat(grid.backgroundSize)
    assert.ok(Number.isFinite(spacing) && spacing>=16 && spacing<32, `${base} at ${zoom}: ${spacing}`)
    assert.equal(grid.backgroundSize.split(' ')[0],grid.backgroundSize.split(' ')[1])
  }
})

test('normal zoom retains the original grid size and magnifies it when zooming in', () => {
  assert.equal(canvasGridBackground(1,{x:0,y:0}).backgroundSize,'24px 24px')
  assert.equal(canvasGridBackground(1,{x:0,y:0},22).backgroundSize,'22px 22px')
  assert.equal(canvasGridBackground(2,{x:0,y:0}).backgroundSize,'48px 48px')
})

test('coarser grid dots are a subset of the finer world grid, anchored to panning', () => {
  const pan={x:-173.5,y:82.25}
  for (const zoom of [1,.67,.66,.34,.33,.1,.01]) {
    const grid=canvasGridBackground(zoom,pan), spacing=parseFloat(grid.backgroundSize)
    const [x,y]=grid.backgroundPosition.split(' ').map(parseFloat)
    assert.equal(x+spacing/2,pan.x)
    assert.equal(y+spacing/2,pan.y)
    const multiple=spacing/zoom/24
    assert.ok(Math.abs(Math.log2(multiple)-Math.round(Math.log2(multiple)))<1e-10)
  }
})

test('grid redraws at the threshold in either direction without retaining a stale density', () => {
  const pan={x:0,y:0}, threshold=16/24
  assert.equal(parseFloat(canvasGridBackground(threshold,pan).backgroundSize),16)
  assert.ok(parseFloat(canvasGridBackground(threshold-.001,pan).backgroundSize)>31)
  assert.ok(parseFloat(canvasGridBackground(threshold+.001,pan).backgroundSize)<17)
  for (const zoom of [0,-1,NaN,Infinity]) assert.equal(canvasGridBackground(zoom,pan).backgroundSize,'24px 24px')
})

test('pinch navigation keeps the world point under the moving finger midpoint', () => {
  const view = {zoom: .5, pan: {x: -100, y: 25}}
  const start = [{x: 50, y: 100}, {x: 150, y: 100}]
  const next = pinchView(view, start, [{x: 20, y: 160}, {x: 220, y: 160}])
  assert.equal(next.zoom, 1)
  assert.equal((120 - next.pan.x) / next.zoom, (100 - view.pan.x) / view.zoom)
  assert.equal((160 - next.pan.y) / next.zoom, (100 - view.pan.y) / view.zoom)
  assert.deepEqual(pinchView(view, start, [{x: 100, y: 100}, {x: 100, y: 100}]), view)
})

test('zoom keeps the world point beneath its anchor stationary beyond the old limits', () => {
  const pan = { x: -400, y: 70 }
  const anchor = { x: 600, y: 350 }
  for (const next of [0.001, 1, 1000]) {
    const result = zoomAt(0.85, pan, next, anchor)
    assert.ok(Math.abs((anchor.x - result.x) / next - (anchor.x - pan.x) / 0.85) < 1e-7)
    assert.ok(Math.abs((anchor.y - result.y) / next - (anchor.y - pan.y) / 0.85) < 1e-7)
  }
})

test('fit centers all content including negative coordinates, leaving room for Properties', () => {
  const bounds = combinedBounds([{ x: -500, y: -300, width: 100, height: 200 }, { x: 400, y: 250, width: 300, height: 100 }])
  assert.deepEqual(bounds, { x: -500, y: -300, width: 1200, height: 650 })
  const { zoom, pan } = fitBounds(bounds, { width: 1400, height: 900 }, 300)
  assert.equal((bounds.x + bounds.width / 2) * zoom + pan.x, 550)
  assert.equal((bounds.y + bounds.height / 2) * zoom + pan.y, 450)
  assert.ok(bounds.width * zoom <= 1004)
  assert.ok(bounds.height * zoom <= 740)
})

test('minimap bounds include both offscreen shapes and the visible viewport', () => {
  assert.deepEqual(combinedBounds([{ x: -1000, y: -500, width: 40, height: 30 }, { x: 0, y: 0, width: 800, height: 600 }]), { x: -1000, y: -500, width: 1800, height: 1100 })
})

test('rotated shapes contribute their visual axis-aligned bounds', () => {
  const rotated = axisAlignedBounds({x: 100, y: 200, width: 120, height: 40, rotation: 90})
  assert.ok(Math.abs(rotated.x - 140) < 1e-9)
  assert.ok(Math.abs(rotated.y - 160) < 1e-9)
  assert.ok(Math.abs(rotated.width - 40) < 1e-9)
  assert.ok(Math.abs(rotated.height - 120) < 1e-9)
  const bounds = combinedBounds([{x: 100, y: 200, width: 120, height: 40, rotation: 90}])
  assert.ok(Math.abs(bounds.x - rotated.x) < 1e-9)
  assert.ok(Math.abs(bounds.y - rotated.y) < 1e-9)
  assert.ok(Math.abs(bounds.width - rotated.width) < 1e-9)
  assert.ok(Math.abs(bounds.height - rotated.height) < 1e-9)
})
