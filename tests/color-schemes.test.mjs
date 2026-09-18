import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildColorSchemeCss,
  contrastRatio,
  findColorScheme,
  isValidPalette,
  paletteContrastIssues,
  paletteTokens,
  readableForeground,
} from '../src/features/workshop/appearance/color-schemes.ts'

const light = { accent: '#2563eb', background: '#f8fafc', surface: '#ffffff', sidebar: '#f1f5f9', text: '#0f172a' }
const dark = { accent: '#60a5fa', background: '#0b1220', surface: '#111b2e', sidebar: '#0d1627', text: '#e2e8f0' }
const ocean = { id: 'ocean', name: 'Ocean', isPreset: true, light, dark }

test('contrast math matches WCAG reference values', () => {
  assert.equal(contrastRatio('#000000', '#ffffff'), 21)
  assert.equal(contrastRatio('#777777', '#777777'), 1)
  assert.equal(contrastRatio('#ffffff', '#000000'), contrastRatio('#000000', '#ffffff'))
})

test('accent labels pick whichever foreground reads better', () => {
  assert.equal(readableForeground('#2563eb'), '#ffffff')
  assert.equal(readableForeground('#60a5fa'), '#0a0a0a')
  assert.equal(paletteTokens(light, 'light')['--primary-foreground'], '#ffffff')
  assert.equal(paletteTokens(dark, 'dark')['--sidebar-primary-foreground'], '#0a0a0a')
})

test('schemes emit light and dark rules scoped to the workshop attribute', () => {
  const css = buildColorSchemeCss(ocean)
  assert.match(css, /^:root\[data-workshop-scheme\]\{--background:#f8fafc;/)
  assert.match(css, /:root\.dark\[data-workshop-scheme\]\{--background:#0b1220;/)
  assert.ok(css.includes('--muted-foreground:color-mix(in oklab, #0f172a 57%, #f8fafc);'))
  assert.equal(css.split('{').length - 1, 2)
})

test('the default scheme and unsafe palettes keep stylesheet defaults', () => {
  assert.equal(buildColorSchemeCss({ ...ocean, id: 'default' }), '')
  assert.equal(buildColorSchemeCss(undefined), '')
  assert.equal(buildColorSchemeCss({ ...ocean, light: { ...light, accent: 'red;}body{display:none' } }), '')
  assert.equal(isValidPalette({ ...dark, text: '#fff' }), false)
})

test('contrast warnings flag unreadable text per mode', () => {
  assert.deepEqual(paletteContrastIssues(ocean), [])
  const issues = paletteContrastIssues({ light: { ...light, text: '#d4d4d8' }, dark })
  assert.equal(issues.length, 1)
  assert.equal(issues[0].mode, 'light')
  assert.match(issues[0].message, /on the sidebar \(1\.3:1/, 'reports the weakest of background, surface, and sidebar')
  // Mid-luminance accents are the only ones where neither white nor near-black labels reach 4.5:1.
  assert.deepEqual(paletteContrastIssues({ light: { ...light, accent: '#ff6a00' }, dark }), [])
  assert.match(paletteContrastIssues({ light: { ...light, accent: '#787878' }, dark })[0].message, /accent \(4\.4:1\)/)
})

test('scheme lookup searches presets and custom schemes', () => {
  const appearance = { presets: [ocean], customSchemes: [{ ...ocean, id: 'custom', isPreset: false }] }
  assert.equal(findColorScheme(appearance, 'ocean'), ocean)
  assert.equal(findColorScheme(appearance, 'custom')?.isPreset, false)
  assert.equal(findColorScheme(appearance, 'missing'), undefined)
})
