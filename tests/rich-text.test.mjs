import test from 'node:test'
import assert from 'node:assert/strict'

import { formatRunsRange, selectedCharacterStyle, styleRunsRange } from '../src/features/workshop/ideas/rich-text.ts'

const plain = (text) => ({ text, bold: false, italic: false, underline: false, strikethrough: false })

test('formatting splits the exact selected letters instead of expanding to a word', () => {
  assert.deepEqual(formatRunsRange([plain('Formatting')], 3, 6, 'bold'), [
    plain('For'),
    { ...plain('mat'), bold: true },
    plain('ting'),
  ])
})

test('formatting toggles and merges adjacent character runs', () => {
  const bold = { ...plain('letter'), bold: true }
  assert.deepEqual(formatRunsRange([plain('A'), bold, plain(' B')], 1, 7, 'bold'), [
    plain('Aletter B'),
  ])
})

test('formatting can span partial sections of existing runs', () => {
  const italic = { ...plain('world'), italic: true }
  assert.deepEqual(formatRunsRange([plain('hello '), italic], 4, 9, 'underline'), [
    plain('hell'),
    { ...plain('o '), underline: true },
    { ...plain('wor'), italic: true, underline: true },
    { ...italic, text: 'ld' },
  ])
})

test('character styling changes only the exact selected characters', () => {
  assert.deepEqual(styleRunsRange([plain('Canvas')], 1, 4, { fontFamily: 'Poppins', fontSize: 24, letterSpacing: 1.5, textColor: '#123456' }), [
    plain('C'),
    { ...plain('anv'), fontFamily: 'Poppins', fontSize: 24, letterSpacing: 1.5, textColor: '#123456' },
    plain('as'),
  ])
})

test('selected character properties show a shared value and blank mixed values', () => {
  const item = {
    text: 'AB', fontFamily: 'Geist', fontSize: 16, textColor: 'auto', letterSpacing: 0,
    textRuns: [
      { ...plain('A'), fontFamily: 'Pacifico', fontSize: 24, textColor: '#123456' },
      { ...plain('B'), fontFamily: 'Poppins', fontSize: 24, textColor: '#123456' },
    ],
  }
  assert.deepEqual(selectedCharacterStyle(item, 'text', 0, 1), { fontFamily: 'Pacifico', fontSize: 24, textColor: '#123456', letterSpacing: 0 })
  assert.deepEqual(selectedCharacterStyle(item, 'text', 0, 2), { fontFamily: '', fontSize: 24, textColor: '#123456', letterSpacing: 0 })
  assert.deepEqual(selectedCharacterStyle(item, 'text', 1, 1), { fontFamily: 'Pacifico', fontSize: 24, textColor: '#123456', letterSpacing: 0 })
  assert.deepEqual(selectedCharacterStyle(item, 'text', 2, 2), { fontFamily: 'Poppins', fontSize: 24, textColor: '#123456', letterSpacing: 0 })
})
