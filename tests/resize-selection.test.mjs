import test from 'node:test'
import assert from 'node:assert/strict'
import { resizeSelection } from '../src/features/workshop/resize-selection.ts'

const items = [{ id: 'a', x: -100, y: 0, width: 100, height: 50, color: 'red' }, { id: 'b', x: 100, y: 100, width: 50, height: 100, color: 'blue' }]
const bounds = { x: -100, y: 0, width: 250, height: 200 }

test('corner resizing scales all sizes, positions and gaps from the original selection', () => {
  const result = resizeSelection(items, bounds, { x: -100, y: 0, width: 500, height: 400 })
  assert.deepEqual(result.items, [{ ...items[0], width: 200, height: 100 }, { ...items[1], x: 300, y: 200, width: 100, height: 200 }])
  assert.equal(items[0].width, 100)
})

test('left edge resizing anchors the right edge and leaves heights unchanged', () => {
  const result = resizeSelection(items, bounds, { x: -350, y: 0, width: 500, height: 200 })
  assert.equal(result.bounds.x + result.bounds.width, 150)
  assert.equal(result.items[0].height, 50)
  assert.equal(result.items[1].y, 100)
  assert.equal(result.items[1].x + result.items[1].width, 150)
})

test('minimum size protects the smallest member while preserving relative scale and fixed edges', () => {
  const result = resizeSelection(items, bounds, { x: 140, y: 190, width: 10, height: 10 })
  assert.equal(result.items[1].width, 24)
  assert.equal(result.items[0].height, 24)
  assert.equal(result.items[0].width, 48)
  assert.equal(result.bounds.x + result.bounds.width, 150)
  assert.equal(result.bounds.y + result.bounds.height, 200)
})
