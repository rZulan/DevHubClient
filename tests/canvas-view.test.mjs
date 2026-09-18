import test from 'node:test'
import assert from 'node:assert/strict'
import { combinedBounds, fitBounds, zoomAt } from '../src/features/workshop/canvas-view.ts'

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
