import test from 'node:test'
import assert from 'node:assert/strict'
import { snapShape } from '../src/features/workshop/snap-shape.ts'

const target = { id: 'target', x: 100, y: 100, width: 100, height: 100 }
const moving = { id: 'moving', x: 104, y: 300, width: 40, height: 40 }

test('moving snaps edges and centers and excludes itself', () => {
  const result = snapShape(moving, [moving, target], 1)
  assert.equal(result.shape.x, 100)
  assert.equal(result.shape.y, 300)
  assert.equal(result.guides[0].position, 100)
  assert.equal(snapShape({ ...moving, x: 133 }, [target], 1).shape.x, 130)
  assert.deepEqual(snapShape(moving, [moving], 1).guides, [])
})

test('capture distance stays six screen pixels across zoom levels and releases outside it', () => {
  assert.equal(snapShape({ ...moving, x: 91 }, [target], 0.5).shape.x, 100)
  assert.equal(snapShape(moving, [target], 2).shape.x, 104)
  assert.deepEqual(snapShape({ ...moving, x: 400 }, [target], 1).guides, [])
})

test('resize snaps only moving edges, keeps opposite edges anchored, and respects minimum size', () => {
  const east = snapShape({ ...moving, x: 10, width: 87 }, [target], 1, 'e')
  assert.equal(east.shape.x, 10)
  assert.equal(east.shape.width, 90)
  assert.equal(east.shape.height, 40)
  const west = snapShape(moving, [target], 1, 'w')
  assert.equal(west.shape.x, 100)
  assert.equal(west.shape.x + west.shape.width, moving.x + moving.width)
  const small = { ...moving, x: 76, width: 24 }
  const tooClose = { ...target, x: 97, y: 500 }
  assert.equal(snapShape(small, [tooClose], 1, 'e').shape.width, 24)
})

test('corner resizing snaps both axes without mutating its inputs', () => {
  const shape = { ...moving, x: 0, y: 0, width: 97, height: 103 }
  const result = snapShape(shape, [target], 1, 'se')
  assert.equal(result.shape.width, 100)
  assert.equal(result.shape.height, 100)
  assert.equal(result.guides.length, 2)
  assert.equal(shape.width, 97)
})
