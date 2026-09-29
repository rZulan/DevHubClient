import test from 'node:test'
import assert from 'node:assert/strict'
import { shapePresets, presetItems } from '../src/features/workshop/shape-catalog.ts'
import { normalizeCanvasItem, encodeShapes, decodeShapes, cloneShapes } from '../src/features/workshop/shape-clipboard.ts'

test('every library preset survives save recovery and clipboard duplication', () => {
  for (const preset of shapePresets) {
    const items = presetItems(preset).map((part, index) => normalizeCanvasItem({
      id: `${preset.id}-${index}`, width: 190, height: 105, appearance: 'outlined',
      fillColor: '#a78bfa', outlineColor: '#a78bfa', outlineWidth: 2, outlineStyle: 'solid', cornerRadius: 0,
      ...part,
    }))
    assert.deepEqual(decodeShapes(encodeShapes(items)), items, preset.id)
    const copies = cloneShapes(items, 24, () => 'copy')
    assert.deepEqual(copies.map(item => item.kind), items.map(item => item.kind))
  }
})

test('diagram starters contain individually editable nodes and connectors', () => {
  const waterfall = presetItems(shapePresets.find(preset => preset.id === 'waterfall'))
  assert.equal(waterfall.filter(item => item.kind === 'rectangle').length, 5)
  assert.equal(waterfall.filter(item => item.kind === 'elbow-arrow').length, 4)
  const erd = presetItems(shapePresets.find(preset => preset.id === 'erd'))
  assert.equal(erd.filter(item => item.kind === 'entity').length, 2)
  assert.ok(erd.some(item => item.text?.includes('FK')))
  assert.ok(erd.some(item => item.kind === 'arrow'))
})
