import test from 'node:test'
import assert from 'node:assert/strict'
import {
  allGradientTargets,
  buildColorSchemeCss,
  contrastRatio,
  findColorScheme,
  isValidPalette,
  paletteContrastIssues,
  paletteTokens,
  readableForeground,
  relativeLuminance,
} from '../src/features/workshop/appearance/color-schemes.ts'

const light = { accent: '#2563eb', background: '#f8fafc', surface: '#ffffff', sidebar: '#f1f5f9', text: '#0f172a' }
const dark = { accent: '#60a5fa', background: '#0b1220', surface: '#111b2e', sidebar: '#0d1627', text: '#e2e8f0' }
const ocean = { id: 'ocean', name: 'Ocean', isPreset: true, light, dark }
const gradient = { layout: 'aurora', placement: 'both', first: '#0879e8', second: '#4125c9', third: '#a328d4' }

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
  const tokens = paletteTokens(light, 'light')
  assert.ok(css.startsWith(`:root[data-workshop-scheme]{--background:${tokens['--background']};`))
  assert.match(css, /:root\.dark\[data-workshop-scheme\]\{--background:#0b1220;/)
  assert.ok(css.includes(`--muted-foreground:color-mix(in oklab, #0f172a 68%, ${tokens['--background']});`))
  assert.equal(css.split('{').length - 1, 2)
})

test('bright light presets reduce glare and separate cards from their canvas', () => {
  const palettes = [light,
    { accent: '#15803d', background: '#f7faf8', surface: '#ffffff', sidebar: '#eef5f0', text: '#10231a' },
    { accent: '#c2410c', background: '#fffaf5', surface: '#ffffff', sidebar: '#fdf2e9', text: '#2b1a10' },
    { accent: '#7c3aed', background: '#faf9ff', surface: '#ffffff', sidebar: '#f3f0fd', text: '#1d1733' },
  ]
  for (const palette of palettes) {
    const tokens = paletteTokens(palette, 'light')
    assert.ok(relativeLuminance(tokens['--background']) < .85)
    assert.ok(relativeLuminance(tokens['--card']) < .95)
    assert.ok(relativeLuminance(tokens['--card']) > relativeLuminance(tokens['--background']))
    assert.ok(contrastRatio(tokens['--card'], tokens['--background']) >= 1.12)
    for (const key of ['--background', '--card', '--sidebar']) {
      assert.ok(contrastRatio(palette.text, tokens[key]) >= 4.5)
    }
  }
  for (const mode of ['light', 'dark']) {
    const tokens = paletteTokens(dark, mode)
    assert.equal(tokens['--background'], dark.background)
    assert.equal(tokens['--card'], dark.surface)
    assert.equal(tokens['--sidebar'], dark.sidebar)
  }
})
test('sidebar states stay neutral when the workspace accent changes', () => {
  for (const [palette, mode] of [[light, 'light'], [dark, 'dark']]) {
    const first = paletteTokens(palette, mode)
    const second = paletteTokens({ ...palette, accent: '#ef4444' }, mode)
    for (const key of ['--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-ring']) {
      assert.equal(first[key], second[key], `${key} is independent of the accent`)
    }
    assert.notEqual(first['--primary'], second['--primary'])
  }
})

test('the default scheme and unsafe palettes keep stylesheet defaults', () => {
  assert.equal(buildColorSchemeCss({ ...ocean, id: 'default' }), '')
  assert.equal(buildColorSchemeCss(undefined), '')
  assert.equal(buildColorSchemeCss({ ...ocean, light: { ...light, accent: 'red;}body{display:none' } }), '')
  assert.equal(isValidPalette({ ...dark, text: '#fff' }), false)
})

test('gradient layouts and placement are independent for each mode, with a flat fallback', () => {
  const aurora = paletteTokens({ ...dark, gradient }, 'dark')
  const horizon = paletteTokens({ ...dark, gradient: { ...gradient, layout: 'horizon', placement: 'background' } }, 'dark')
  const corners = paletteTokens({ ...dark, gradient: { ...gradient, layout: 'corners', placement: 'buttons' } }, 'dark')
  assert.equal(aurora['--workshop-gradient-background'].match(/radial-gradient/g).length, 3)
  assert.equal(aurora['--workshop-gradient-sidebar'], 'none', 'legacy both affects background and buttons only')
  assert.equal(aurora['--workshop-gradient-container'], 'none')
  assert.match(horizon['--workshop-gradient-background'], /^linear-gradient\(152deg/)
  assert.equal(horizon['--workshop-gradient-button'], 'none')
  assert.equal(corners['--workshop-gradient-background'], 'none')
  assert.match(corners['--workshop-gradient-button'], /^linear-gradient\(73deg/)
  assert.equal(paletteTokens(dark, 'dark')['--workshop-gradient-button'], 'none')

  const css = buildColorSchemeCss({ ...ocean, id: 'default', dark: { ...dark, gradient } })
  assert.match(css, /:root\[data-workshop-scheme\]\{--workshop-gradient-background:none;/)
  assert.match(css, /:root\.dark\[data-workshop-scheme\]\{--workshop-gradient-background:radial-gradient/)
  assert.ok(!css.includes('--background:'))
})

test('sidebar and container gradients work independently without painting other surfaces', () => {
  const sidebars = paletteTokens({ ...dark, gradient: { ...gradient, placement: 'sidebars' } }, 'dark')
  const containers = paletteTokens({ ...dark, gradient: { ...gradient, placement: 'containers' } }, 'dark')
  const both = paletteTokens({ ...dark, gradient: { ...gradient, placement: 'sidebars,containers' } }, 'dark')
  assert.match(sidebars['--workshop-gradient-sidebar'], /^radial-gradient/)
  assert.equal(sidebars['--workshop-gradient-container'], 'none')
  assert.equal(containers['--workshop-gradient-sidebar'], 'none')
  assert.match(containers['--workshop-gradient-container'], /^radial-gradient/)
  assert.equal(both['--workshop-gradient-sidebar'], sidebars['--workshop-gradient-sidebar'])
  assert.equal(both['--workshop-gradient-container'], containers['--workshop-gradient-container'])
  assert.notEqual(both['--workshop-gradient-sidebar'], both['--workshop-gradient-container'])
  assert.equal(both['--workshop-gradient-background'], 'none')
  assert.equal(both['--workshop-gradient-button'], 'none')
})

test('top bars and switch controls can be themed independently or with every surface', () => {
  const topbars = paletteTokens({ ...dark, gradient: { ...gradient, placement: 'topbars' } }, 'dark')
  const switches = paletteTokens({ ...dark, gradient: { ...gradient, placement: 'switches' } }, 'dark')
  assert.match(topbars['--workshop-gradient-topbar'], /^radial-gradient/)
  assert.equal(topbars['--workshop-gradient-switch'], 'none')
  assert.equal(switches['--workshop-gradient-topbar'], 'none')
  assert.match(switches['--workshop-gradient-switch'], /^linear-gradient/)
  assert.equal(switches['--workshop-gradient-button'], 'none')
  const all = { ...dark, gradient: { ...gradient, placement: allGradientTargets } }
  assert.equal(isValidPalette(all), true)
  const everything = paletteTokens(all, 'dark')
  for (const surface of ['background', 'sidebar', 'container', 'topbar', 'button', 'switch']) {
    assert.notEqual(everything['--workshop-gradient-' + surface], 'none')
  }
})

test('gradient color stops keep button labels readable and reject unsupported values', () => {
  const tokens = paletteTokens({ ...dark, gradient: { ...gradient, first: '#ffffff', second: '#ffff00', third: '#ff00ff' } }, 'dark')
  for (const token of ['--workshop-gradient-button', '--workshop-gradient-button-hover']) {
    const colors = tokens[token].match(/#[a-f0-9]{6}/g)
    assert.equal(colors.length, 3)
    for (const color of colors) assert.ok(contrastRatio(color, tokens['--workshop-gradient-button-text']) >= 4.5)
  }
  for (const invalid of [{ ...gradient, layout: 'custom' }, { ...gradient, placement: 'all' },
    { ...gradient, placement: 'sidebars,sidebars' }, { ...gradient, third: '#abcdef\n' }]) {
    assert.equal(buildColorSchemeCss({ ...ocean, dark: { ...dark, gradient: invalid } }), '')
  }
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
