import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {createElement, Fragment} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import * as shikiHighlighter from '../src/features/workshop/shiki-highlighter.ts'
import * as codeHighlightHook from '../src/features/workshop/use-note-code-highlight.ts'

const require = createRequire(import.meta.url)
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/note-markdown.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText
const exports = {}
const tokenComponentSource = ts.transpileModule(readFileSync(new URL('../src/features/workshop/note-code-highlight.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText
const tokenExports = {}
vm.runInNewContext(tokenComponentSource, {exports: tokenExports, require})
const selectSource = ts.transpileModule(readFileSync(new URL('../src/features/workshop/workshop-select.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText
const selectExports = {}
vm.runInNewContext(selectSource, {exports: selectExports, require})
vm.runInNewContext(source, {exports, require: name => name === './shiki-highlighter.ts' ? shikiHighlighter : name === './note-code-highlight.tsx' ? tokenExports : name === './use-note-code-highlight.ts' ? codeHighlightHook : name === '@/features/workshop/workshop-select' ? selectExports : require(name)})
const render = (body, compact = false) => renderToStaticMarkup(createElement(exports.NoteMarkdown, {body, compact}))

test('note bodies render headings, emphasis, lists, quotes and code as Markdown', () => {
    const html = render('# Release notes\n\n**Bold** and *italic* with `code`.\n\n- First\n- Second\n\n1. Start\n2. Finish\n\n> Keep it focused.\n\n```js\nconst ready = true\n```')
    for (const pattern of [/<h1>Release notes<\/h1>/, /<strong>Bold<\/strong>/, /<em>italic<\/em>/, /<code>code<\/code>/, /<ul>/, /<ol>/, /<blockquote>/, /<code class="language-js">/]) assert.match(html, pattern)
})

test('GitHub-style tables, checklists and strikethrough appear in note previews', () => {
    const html = render('- [x] Done\n- [ ] Next\n\n~~Old plan~~\n\n| Item | Status |\n| --- | --- |\n| Design | Ready |')
    assert.match(html, /aria-label="Completed task"/)
    assert.match(html, /aria-label="Incomplete task"/)
    assert.match(html, /<del>Old plan<\/del>/)
    assert.match(html, /<table>/)
    assert.match(html, /<th>Item<\/th>/)
})

test('Markdown cannot execute HTML or unsafe link and image URLs', () => {
    const html = render('<script>alert(1)</script>\n\n[Run](javascript:alert%281%29)\n\n![Image](javascript:alert%281%29)\n\n<img src="x" onerror="alert(1)">')
    assert.doesNotMatch(html, /<script|<img|onerror|href="javascript:|src="javascript:/i)
    assert.match(html, /Run/)
    assert.match(html, /Image/)
})

test('reading view links are usable while card previews contain no nested controls', () => {
    const markdown = '[Docs](https://example.com/docs)\n\n![Diagram](https://example.com/diagram.png)\n\n- [x] Ready'
    const html = render(markdown)
    assert.match(html, /href="https:\/\/example.com\/docs" target="_blank" rel="noreferrer"/)
    assert.match(html, /loading="lazy"/)
    const compact = render(markdown, true)
    assert.doesNotMatch(compact, /<a\b|<input\b|<img\b/)
    assert.match(compact, /Docs/)
    assert.match(compact, /Diagram/)
})

test('all six heading levels, Setext headings, and inline heading formatting are preserved', () => {
    const markdown = '# Heading 1\n\n## Heading 2\n\n### Heading 3\n\n#### Heading 4\n\n##### Heading 5\n\n###### Heading 6\n\nTitle\n=====\n\nSubtitle\n--------\n\n### **Bold heading**'
    for (const compact of [false, true]) {
        const html = render(markdown, compact)
        for (let level = 1; level <= 6; level++) assert.match(html, new RegExp(`<h${level}>Heading ${level}</h${level}>`))
        assert.match(html, /<h1>Title<\/h1>/)
        assert.match(html, /<h2>Subtitle<\/h2>/)
        assert.match(html, /<h3><strong>Bold heading<\/strong><\/h3>/)
    }
})

test('nested lists, numbered-list starts, hard breaks, dividers, escapes and indented code render', () => {
    const html = render('- Parent\n  - Child\n    - Grandchild\n\n5. Fifth\n6. Sixth\n\nFirst line  \nSecond line\\\nThird line\n\n---\n\n\\*literal asterisks\\*\n\n    <code example>')
    assert.equal((html.match(/<ul>/g) ?? []).length, 3)
    assert.match(html, /<ol start="5">/)
    assert.equal((html.match(/<br\/>/g) ?? []).length, 2)
    assert.match(html, /<hr\/>/)
    assert.match(html, /\*literal asterisks\*/)
    assert.match(html, /<pre[^>]*><code>&lt;code example&gt;/)
})

test('table alignment, reference links, autolinks and link/image titles survive rendering', () => {
    const html = render('| Left | Center | Right |\n| :--- | :---: | ---: |\n| A | B | C |\n\n[Reference][docs]\n\n[docs]: https://example.com/docs "Documentation title"\n\nhttps://example.com\n\n![Diagram](https://example.com/diagram.png "Diagram title")')
    for (const alignment of ['left', 'center', 'right']) assert.match(html, new RegExp(`style="text-align:${alignment}"`))
    assert.match(html, /title="Documentation title"/)
    assert.match(html, /href="https:\/\/example.com"/)
    assert.match(html, /title="Diagram title"/)
    assert.match(html, /alt="Diagram"/)
})

test('footnote references and backlinks target their own note without duplicate IDs or new tabs', () => {
    const body = 'A footnote[^1].\n\n[^1]: More information.'
    const html = renderToStaticMarkup(createElement(Fragment, null,
        createElement(exports.NoteMarkdown, {body}), createElement(exports.NoteMarkdown, {body})))
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    assert.equal(ids.length, new Set(ids).size)
    assert.equal((html.match(/data-footnote-ref=/g) ?? []).length, 2)
    assert.equal((html.match(/data-footnote-backref=/g) ?? []).length, 2)
    for (const [, target] of html.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(target), target)
    for (const [, label] of html.matchAll(/aria-describedby="([^"]+)"/g)) assert.ok(ids.includes(label), label)
    assert.doesNotMatch(html, /target="_blank"/)
})

test('fenced HTML code stays readable and literal while Shiki loads', () => {
    const html = render('```html\n<script>alert("example")</script>\n<div class="card">Hello</div>\n```')
    assert.match(html, /class="language-html"/)
    assert.match(html, /aria-label="html code block"/)
    assert.match(html, /&lt;/)
    assert.match(html, /aria-label="Copy code"/)
    assert.doesNotMatch(html, /<script\b|<div class="card"/)
})

test('unlabeled and unknown-language fences remain readable and preserve indentation', () => {
    for (const language of ['', 'text', 'not-a-real-language']) {
        const html = render(`\`\`\`${language}\nfirst line\n    indented line\n\`\`\``)
        assert.match(html, /first line\n {4}indented line\n/)
        assert.match(html, /class="note-code-block"/)
    }
})

test('inline code stays inline and compact code blocks have no copy button or focus target', () => {
    const inline = render('Use `npm run build`.')
    assert.match(inline, /<code>npm run build<\/code>/)
    assert.doesNotMatch(inline, /note-code-block/)
    const compact = render('```html\n<div>Hello</div>\n```', true)
    assert.match(compact, /class="language-html"/)
    assert.doesNotMatch(compact, /<button\b|tabindex=/)
})

test('code fence themes survive Markdown rendering independently per block', () => {
    const html = render('```python theme=github-light\nprint("light")\n```\n\n```js theme=github-dark\nconst dark = true\n```')
    assert.match(html, /data-theme="github-light"/)
    assert.match(html, /data-theme="github-dark"/)
    assert.match(html, /print\(/)
    assert.match(html, /const dark/)
})
