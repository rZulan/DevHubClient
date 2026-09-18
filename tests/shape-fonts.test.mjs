import test from 'node:test'
import assert from 'node:assert/strict'

import { googleFontStylesheet, isGoogleFont, isShapeFont, shapeFontStack } from '../src/features/workshop/shape-fonts.ts'

test('Google fonts produce a CSS2 stylesheet URL and safe fallback stack', () => {
  assert.equal(isGoogleFont('Playfair Display'), true)
  assert.equal(googleFontStylesheet('Playfair Display'), 'https://fonts.googleapis.com/css2?family=Playfair+Display&display=swap')
  assert.equal(shapeFontStack('Playfair Display'), '"Playfair Display", serif')
  assert.equal(shapeFontStack('Roboto Mono'), '"Roboto Mono", monospace')
})

test('font validation accepts the supported catalog and rejects arbitrary values', () => {
  assert.equal(isShapeFont('Montserrat'), true)
  assert.equal(isShapeFont('Arial'), true)
  assert.equal(isShapeFont('url(javascript:bad)'), false)
  assert.equal(googleFontStylesheet('Arial'), undefined)
})
