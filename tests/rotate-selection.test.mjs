import test from 'node:test'
import assert from 'node:assert/strict'
import { rotateSelection } from '../src/features/workshop/rotate-selection.ts'

const shape = (id, x, y, rotation = 0) => ({id, x, y, width: 20, height: 10, rotation})

test('group rotation orbits member centers and rotates each member', () => {
  const rotated = rotateSelection([shape('left', 0, 0), shape('right', 40, 0)], 90)
  assert.ok(Math.abs(rotated[0].x - 20) < 1e-9)
  assert.ok(Math.abs(rotated[0].y + 20) < 1e-9)
  assert.ok(Math.abs(rotated[1].x - 20) < 1e-9)
  assert.ok(Math.abs(rotated[1].y - 20) < 1e-9)
  assert.equal(rotated[0].rotation, 90)
  assert.equal(rotated[1].rotation, 90)
})

test('zero-degree group rotation preserves the selection', () => {
  const items = [shape('one', 10, 20), shape('two', 50, 60)]
  assert.equal(rotateSelection(items, 0), items)
})
