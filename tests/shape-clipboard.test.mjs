import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultTextStyle, cloneShapes, decodeShapes, encodeShapes, normalizeCanvasItem } from '../src/features/workshop/shape-clipboard.ts'

const shape = normalizeCanvasItem({ ...defaultTextStyle, kind: 'rectangle', id: 'one', x: -10, y: 50, width: 150, height: 80, appearance: 'fill', fillColor: '#abcdef', outlineColor: '#123456', cornerRadius: 12, outlineWidth: 3, outlineStyle: 'dashed', text: 'First line\nSecond line', textAlign: 'right', verticalAlign: 'bottom', noteHeader: '', noteBody: '' })

test('clipboard round trip preserves all shape properties', () => {
  assert.deepEqual(decodeShapes(encodeShapes([shape])), [shape])
})

test('formatting and alignment survive copy and duplication together', () => {
  const formatted = {
    ...shape,
    fontFamily: 'Montserrat',
    fontSize: 32,
    bold: true,
    italic: true,
    underline: true,
    strikethrough: true,
    textColor: '#ff0000',
    textAlign: 'left',
    verticalAlign: 'top',
    letterSpacing: 2.5,
    lineHeight: 1.8,
    textIndent: 24,
    textRuns: [
      { text: 'First ', bold: true, italic: false, underline: false, strikethrough: false, fontFamily: 'Poppins', fontSize: 28, textColor: '#123456', letterSpacing: 1.5 },
      { text: 'line\nSecond line', bold: false, italic: true, underline: true, strikethrough: false },
    ],
  }
  assert.deepEqual(decodeShapes(encodeShapes([formatted])), [formatted])
  assert.deepEqual(cloneShapes([formatted], 24, () => 'new')[0], { ...formatted, id: 'new', x: formatted.x + 24, y: formatted.y + 24 })
  assert.deepEqual(decodeShapes(encodeShapes([{ ...formatted, fontSize: -5 }])), [])
})

test('duplicates have fresh IDs while preserving group spacing, ordering, and source shapes', () => {
  const source = [shape, { ...shape, id: 'two', x: 200, y: -30 }]
  let id = 0
  const copies = cloneShapes(source, 24, () => `copy-${++id}`)
  assert.deepEqual(copies.map((item) => item.id), ['copy-1', 'copy-2'])
  assert.equal(copies[1].x - copies[0].x, 210)
  assert.equal(copies[1].y - copies[0].y, -80)
  assert.deepEqual(copies[0], { ...shape, id: 'copy-1', x: 14, y: 74 })
  assert.equal(shape.x, -10)
})

test('copy remaps group IDs once and preserves note header and body', () => {
  const source = [{ ...shape, groupId: 'old' }, { ...shape, id: 'two', kind: 'note', groupId: 'old', noteHeader: 'Header', noteBody: 'Body' }]
  let id = 0
  const copies = cloneShapes(source, 10, () => `new-${++id}`)
  assert.notEqual(copies[0].groupId, 'old')
  assert.equal(copies[0].groupId, copies[1].groupId)
  assert.equal(copies[1].noteHeader, 'Header')
  assert.equal(copies[1].noteBody, 'Body')
})

test('note header and body keep independent text styles', () => {
  const note = {
    ...shape,
    kind: 'note',
    noteHeader: 'Heading',
    noteBody: 'Details',
    noteHeaderStyle: { ...shape.noteHeaderStyle, fontFamily: 'Montserrat', fontSize: 28, bold: true, textColor: '#ff0000', textAlign: 'center' },
    noteBodyStyle: { ...shape.noteBodyStyle, fontFamily: 'Roboto Mono', fontSize: 13, italic: true, lineHeight: 1.8, textColor: '#0000ff', textAlign: 'right' },
  }
  assert.deepEqual(decodeShapes(encodeShapes([note])), [note])
})

test('unrelated clipboard text and malformed shapes are ignored', () => {
  for (const text of ['hello', 'null', '{}', encodeShapes([{ ...shape, width: -1 }]), encodeShapes([{ ...shape, x: '10' }]), encodeShapes([{ ...shape, outlineStyle: 'invalid' }])]) {
    assert.deepEqual(decodeShapes(text), [])
  }
})
