import test from 'node:test'
import assert from 'node:assert/strict'
import { expandGroupedIds, groupShapes, ungroupShapes } from '../src/features/workshop/shape-groups.ts'

const items = [
  { id: 'a', groupId: 'one' }, { id: 'b', groupId: 'one' },
  { id: 'c' }, { id: 'd', groupId: 'two' }, { id: 'e', groupId: 'two' },
]

test('selecting any member expands to the full persistent group', () => {
  assert.deepEqual(expandGroupedIds(items, ['b']), ['a', 'b'])
  assert.deepEqual(expandGroupedIds(items, ['c']), ['c'])
  assert.deepEqual(expandGroupedIds(items, ['b', 'e']), ['a', 'b', 'd', 'e'])
})

test('grouping absorbs complete existing groups and leaves unrelated shapes alone', () => {
  const grouped = groupShapes(items, ['a', 'c'], 'combined')
  assert.deepEqual(grouped.filter((item) => item.groupId === 'combined').map((item) => item.id), ['a', 'b', 'c'])
  assert.equal(grouped.find((item) => item.id === 'd').groupId, 'two')
})

test('ungrouping one member separates the full group', () => {
  const result = ungroupShapes(items, ['b'])
  assert.equal(result.find((item) => item.id === 'a').groupId, undefined)
  assert.equal(result.find((item) => item.id === 'b').groupId, undefined)
  assert.equal(result.find((item) => item.id === 'd').groupId, 'two')
})
