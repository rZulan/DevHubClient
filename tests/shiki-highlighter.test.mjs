import test from 'node:test'
import assert from 'node:assert/strict'
import {highlightNoteCode, getNoteCodeTheme, loadNoteCodeOptions} from '../src/features/workshop/shiki-highlighter.ts'

const text = tokens => tokens.map(line => line.map(token => token.content).join('')).join('\n')

test('Shiki highlights common languages and aliases while preserving the exact code', async () => {
    for (const [lang, source] of [
        ['html', '<div class="card">Hello</div>\n'],
        ['js', 'const ready = true;\n'],
        ['ts', 'const count: number = 1;\n'],
        ['tsx', 'const View = () => <div>Hello</div>;\n'],
        ['python', 'def greet():\n    return "hello"\n'],
    ]) {
        const tokens = await highlightNoteCode(source, lang)
        assert.equal(text(tokens), source, lang)
        assert.ok(new Set(tokens.flat().map(token => token.color)).size > 1, lang)
    }
})

test('languages outside the previous common bundle are available on demand', async () => {
    const snippets = [
        ['dart', 'final message = "hello";\n'],
        ['powershell', '$message = "hello"\nWrite-Host $message\n'],
        ['dockerfile', 'FROM node:22\nWORKDIR /app\n'],
    ]
    const results = await Promise.all(snippets.map(([lang, source]) => highlightNoteCode(source, lang)))
    for (const [index, tokens] of results.entries()) {
        assert.equal(text(tokens), snippets[index][1])
        assert.ok(new Set(tokens.flat().map(token => token.color)).size > 1, snippets[index][0])
    }
})

test('plain text and unknown language labels fall back without losing the source', async () => {
    for (const language of [undefined, '', 'text', 'txt', 'plaintext', 'not-a-language', '__proto__', 'constructor']) {
        assert.equal(await highlightNoteCode('    <script>example</script>\n', language), null)
    }
})

test('cards and reading previews reuse highlighting and updated source gets new tokens', async () => {
    const source = 'const cacheExample = 1;\n'
    const card = highlightNoteCode(source, 'js'), preview = highlightNoteCode(source, 'JS')
    assert.equal(card, preview)
    const first = await card
    const edited = await highlightNoteCode('const cacheExample = 2;\n', 'js')
    assert.equal(text(first), source)
    assert.equal(text(edited), 'const cacheExample = 2;\n')
})

test('different themes use separate cached tokens and matching light/dark palettes', async () => {
    const source = 'const themeExample = "hello";'
    const light = highlightNoteCode(source, 'js', 'github-light')
    const dark = highlightNoteCode(source, 'js', 'github-dark')
    assert.notEqual(light, dark)
    const [a, b, lightTheme, darkTheme] = await Promise.all([light, dark, getNoteCodeTheme('github-light'), getNoteCodeTheme('github-dark')])
    assert.equal(text(a), source)
    assert.equal(text(b), source)
    assert.notDeepEqual(a, b)
    assert.equal(lightTheme.type, 'light')
    assert.equal(darkTheme.type, 'dark')
    assert.notEqual(lightTheme.background, darkTheme.background)
    assert.equal((await getNoteCodeTheme('__proto__')).id, 'material-theme-darker')
})

test('editor options include the full bundled grammars, aliases, and themes', async () => {
    const {languages, themes} = await loadNoteCodeOptions()
    assert.ok(languages.length > 200)
    assert.ok(languages.find(item => item.id === 'javascript').aliases.includes('js'))
    assert.ok(languages.some(item => item.id === 'dart'))
    assert.ok(themes.some(item => item.id === 'material-theme-darker'))
    assert.ok(themes.some(item => item.id === 'github-light'))
})
