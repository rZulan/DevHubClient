import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {MemoryRouter} from 'react-router-dom'
import * as highlighter from '../src/features/workshop/shiki-highlighter.ts'
import * as codeHighlight from '../src/features/workshop/use-note-code-highlight.ts'
import * as wikiDocument from '../src/features/workshop/wiki-document.ts'

const require = createRequire(import.meta.url)
function load(file, dependencies = {}) {
    const exports = {}
    const source = ts.transpileModule(readFileSync(new URL(`../src/features/workshop/${file}`, import.meta.url), 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
    }).outputText
    vm.runInNewContext(source, {exports, require: name => dependencies[name] ?? require(name)})
    return exports
}
const tokens = load('note-code-highlight.tsx')
const workshopSelect = load('workshop-select.tsx')
const notes = load('note-markdown.tsx', {'./shiki-highlighter.ts': highlighter, './note-code-highlight.tsx': tokens, './use-note-code-highlight.ts': codeHighlight, '@/features/workshop/workshop-select': workshopSelect})
const copyLink = load('wiki-copy-link.tsx')
const sections = load('wiki-sections.ts')
const images = load('wiki-images.ts')
const {WikiMarkdown} = load('wiki-markdown.tsx', {'./note-markdown': notes, './wiki-document': wikiDocument, './wiki-copy-link': copyLink, './wiki-sections': sections, './wiki-images': images})
const render = (body, props = {}) => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(WikiMarkdown, {body, pages: [], projectId: 'sample', ...props})))
const headingIds = html => [...html.matchAll(/<h[1-6][^>]* id="([^"]+)"/g)].map(match => match[1])

test('inline image references render safe dimensions in both paragraphs and links', () => {
    const html = render('![Diagram](https://example.com/image.png){width=400 height=240}\n\n[![Logo](/logo.png){height=80}](https://example.com)\n\n![Original](/original.png)')
    assert.match(html, /alt="Diagram"[^>]*width="400"[^>]*height="240"/)
    assert.match(html, /width:400px;height:240px;max-width:100%;object-fit:contain/)
    assert.match(html, /alt="Logo"[^>]*height="80"/)
    assert.doesNotMatch(html, /\{width=|\{height=/)
    assert.match(html, /alt="Original"/)
})

test('image size extensions never execute HTML and stay literal inside code', () => {
    const html = render('`![Example](/image.png){width=40}`\n\n![Invalid](/image.png){width=20 onerror=alert(1)}\n\n<img src="x" onerror="alert(1)">\n\n![Bad](javascript:alert)')
    assert.match(html, /<code>!\[Example\]\(\/image.png\)\{width=40\}<\/code>/)
    assert.match(html, /\{width=20 onerror=alert\(1\)\}/)
    assert.doesNotMatch(html, /<img[^>]*\sonerror=|src="javascript:|src="x"/)
})

test('wiki heading anchors cover nested, Setext, formatted, and Unicode headings without treating code as sections', () => {
    const html = render('# Overview\n\n## **Local** setup\n\n### Café & 日本語\n\nSetext heading\n---\n\n```md\n# Not a heading\n```')
    assert.deepEqual(headingIds(html), ['overview', 'local-setup', 'café-日本語', 'setext-heading'])
    assert.match(html, /<strong>Local<\/strong> setup/)
})

test('repeated headings and titles resembling generated anchors remain unique and stable', () => {
    const body = '## Setup\n\n## Setup\n\n## Setup-1\n\n## Setup\n\n## Setup-1\n\n## !!!\n\n## !!!'
    const ids = headingIds(render(body))
    assert.deepEqual(ids, ['setup', 'setup-1', 'setup-1-1', 'setup-2', 'setup-1-2', 'section', 'section-1'])
    assert.equal(new Set(ids).size, ids.length)
    assert.deepEqual(headingIds(render(body)), ids)
})

test('collapsing a section wraps its subsections without swallowing the next peer or introductory prose', () => {
    const html = render('Introduction.\n\n## Setup\n\nSetup instructions.\n\n### Install\n\nRun the installer.\n\n## Release\n\nRelease instructions.', {collapsedSections: new Set(['setup']), onToggleSection() {}})
    assert.match(html, /<p>Introduction\.<\/p>\s*<section/)
    assert.match(html, /data-wiki-section-body="setup"[^>]*>|hidden=""[^>]*data-wiki-section-body="setup"/)
    assert.match(html, /class="wiki-section-body" hidden="" data-wiki-section-body="setup"/)
    assert.match(html, /Run the installer\.<\/p>\s*<\/div><\/section><\/div><\/section><section[^>]*><h2[^>]*id="release"/)
    assert.match(html, /aria-label="Expand Setup section"[^>]*aria-expanded="false"/)
    assert.match(html, /aria-label="Collapse Release section"[^>]*aria-expanded="true"/)
    assert.match(html, /class="wiki-heading-anchor" href="#setup"/)
    assert.match(html, /<\/a><button[^>]*class="wiki-copy-link"/)
})
