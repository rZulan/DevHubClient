import test from 'node:test'
import assert from 'node:assert/strict'
import {splitNoteBody, replaceNoteCode} from '../src/features/workshop/note-code-fences.ts'

const blocks = body => splitNoteBody(body).filter(segment => segment.type === 'code')

test('three backticks on their own line immediately become an inline empty code block', () => {
    const body = 'My note\n\n```'
    const [block] = blocks(body)
    assert.equal(block.source, '')
    assert.equal(block.closed, false)
    assert.equal(block.language, 'text')
    assert.equal(splitNoteBody(body)[0].text, 'My note\n\n')
    assert.equal(blocks('Use `code` and ``` inline').length, 0)
    assert.equal(blocks('    ```').length, 0)
})

test('closed, unfinished, indented and tilde fences retain exact source ranges', () => {
    const body = 'Before\n```python theme=github-light\nprint(1)\n```\nBetween\n  ~~~js\n  const n = 2\n  ~~~\nAfter'
    const segments = splitNoteBody(body)
    assert.equal(segments.map(part => body.slice(part.start, part.end)).join(''), body)
    const [a, b] = blocks(body)
    assert.equal(a.source, 'print(1)')
    assert.equal(a.theme, 'github-light')
    assert.equal(b.source, 'const n = 2')
    assert.equal(b.indent, '  ')
    assert.equal(blocks('```js\none\n\n')[0].source, 'one\n\n')
})

test('editing code preserves surrounding prose, other code blocks and per-block themes', () => {
    const body = 'Before\n```js\nold\n```\nAfter\n```html\n<b>keep</b>\n```'
    const next = replaceNoteCode(body, blocks(body)[0], 'def hello():\n    return 1\n', 'python', 'github-light')
    assert.equal(next, 'Before\n```python theme=github-light\ndef hello():\n    return 1\n\n```\nAfter\n```html\n<b>keep</b>\n```')
    assert.equal(blocks(next)[0].source, 'def hello():\n    return 1\n')
})

test('literal closing fences in pasted source stay inside the edited block', () => {
    const body = 'Before\n```'
    const source = '```html\n<div>literal</div>\n```\n````'
    const next = replaceNoteCode(body, blocks(body)[0], source, 'markdown', 'material-theme-darker')
    assert.equal(blocks(next).length, 1)
    assert.equal(blocks(next)[0].source, source)
    assert.match(next, /`````markdown/)
})
