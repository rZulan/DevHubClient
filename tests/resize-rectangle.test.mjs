import test from 'node:test'
import assert from 'node:assert/strict'
import { resizeRectangle } from '../src/features/workshop/resize-rectangle.ts'

const rectangle = { x: 100, y: 80, width: 190, height: 105 }

test('all eight handles resize the intended edges and keep opposite edges fixed', () => {
  const expected = {
    n: { x: 100, y: 100, width: 190, height: 85 },
    s: { x: 100, y: 80, width: 190, height: 125 },
    e: { x: 100, y: 80, width: 220, height: 105 },
    w: { x: 130, y: 80, width: 160, height: 105 },
    nw: { x: 130, y: 100, width: 160, height: 85 },
    ne: { x: 100, y: 100, width: 220, height: 85 },
    sw: { x: 130, y: 80, width: 160, height: 125 },
    se: { x: 100, y: 80, width: 220, height: 125 },
  }
  for (const [direction, result] of Object.entries(expected)) {
    assert.deepEqual(resizeRectangle(rectangle, direction, 30, 20), result)
  }
})

test('shrinking past opposite edges clamps size without shifting the anchor', () => {
  assert.deepEqual(resizeRectangle(rectangle, 'nw', 1000, 1000), { x: 266, y: 161, width: 24, height: 24 })
  assert.deepEqual(resizeRectangle(rectangle, 'se', -1000, -1000), { x: 100, y: 80, width: 24, height: 24 })
})

test('outward resizing allows negative canvas coordinates and fractional zoom deltas', () => {
  assert.deepEqual(resizeRectangle(rectangle, 'nw', -200, -100), { x: -100, y: -20, width: 390, height: 205 })
  const result = resizeRectangle(rectangle, 'se', 30 / 0.5, 20 / 0.5)
  assert.equal(result.width, 250)
  assert.equal(result.height, 145)
  assert.deepEqual(rectangle, { x: 100, y: 80, width: 190, height: 105 })
})
