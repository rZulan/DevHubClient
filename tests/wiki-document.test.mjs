import test from 'node:test'
import assert from 'node:assert/strict'
import {deleteWikiPage, findWikiPage, saveWikiPage, uniqueWikiSlug, validWikiDocument, wikiPageHref, wikiSlug} from '../src/features/workshop/wiki-document.ts'
import {validToolDocument} from '../src/features/workshop/tool-documents.ts'
import {grantsWorkshopPermission} from '../src/features/workshop/workshop-permissions.ts'

const empty = {pages: [], homePageId: null}
const draft = {id: 'home', title: 'Home', body: '# Welcome\n\n[Setup](getting-started)', message: 'Initial documentation'}
const save = (document, next = draft, revision = 'revision-1') => saveWikiPage(document, next, 'author', revision, '2026-10-26T05:00:00.000Z')

test('first page becomes home and page creation never changes its input', () => {
    const doc = save(empty, {...draft, baseVersion: 'browser-only draft metadata'})
    assert.equal(doc.homePageId, 'home')
    assert.equal(doc.pages[0].slug, 'home')
    assert.equal(doc.pages[0].history.length, 0)
    assert.equal(doc.pages[0].baseVersion, undefined)
    assert.equal(empty.pages.length, 0)
    assert.ok(validWikiDocument(doc))
    assert.ok(validToolDocument('wiki', doc))
    const next = save(doc, {...draft, id: 'setup', title: 'Getting started'})
    assert.equal(next.homePageId, 'home')
    assert.equal(next.pages[1].slug, 'getting-started')
})

test('renaming keeps addresses stable, records previous content and supports restoration', () => {
    const first = save(empty)
    const edited = save(first, {...draft, title: 'Project overview', body: 'Updated', message: 'Clarify scope'})
    assert.equal(edited.pages[0].slug, 'home')
    assert.equal(edited.pages[0].history[0].body, draft.body)
    assert.equal(edited.pages[0].history[0].message, draft.message)
    assert.equal(findWikiPage(edited.pages, 'Home').id, 'home')
    assert.equal(findWikiPage(edited.pages, 'PROJECT OVERVIEW').id, 'home')
    const restored = save(edited, {...edited.pages[0].history[0], id: 'home', message: 'Restore'}, 'revision-2')
    assert.equal(restored.pages[0].body, draft.body)
    assert.equal(restored.pages[0].history[0].body, 'Updated')
    assert.equal(restored.pages[0].history.length, 2)
})

test('slugs handle punctuation, Unicode, collisions and long names', () => {
    assert.equal(wikiSlug('  Café: API & setup!  '), 'cafe-api-setup')
    assert.equal(wikiSlug('日本語'), 'page')
    assert.equal(uniqueWikiSlug('API / setup', [{slug: 'api-setup'}, {slug: 'api-setup-2'}]), 'api-setup-3')
    assert.ok(uniqueWikiSlug('x'.repeat(150), [{slug: 'x'.repeat(100)}]).length <= 100)
})

test('duplicate titles, invalid home references and oversized content cannot be saved', () => {
    const doc = save(empty)
    assert.throws(() => save(doc, {...draft, id: 'another', title: ' home '}), /already exists/)
    assert.throws(() => save(doc, {...draft, title: ' '}), /title/)
    assert.throws(() => save(doc, {...draft, body: 'a'.repeat(100001)}), /limit/)
    assert.equal(validWikiDocument({...doc, homePageId: 'missing'}), false)
    assert.equal(validWikiDocument({...doc, pages: [...doc.pages, doc.pages[0]]}), false)
    assert.equal(validWikiDocument({...doc, pages: [{...doc.pages[0], history: [null]}]}), false)
    assert.equal(validWikiDocument({...doc, pages: [{...doc.pages[0], updatedAt: 'not-a-date'}]}), false)
    assert.equal(validWikiDocument({...doc, pages: [{...doc.pages[0], slug: '../x'}]}), false)
})

test('history is bounded and removing home chooses an existing page or an empty wiki', () => {
    let doc = save(empty)
    for (let i = 0; i < 25; i++) doc = save(doc, {...draft, body: `Version ${i}`}, `revision-${i}`)
    assert.equal(doc.pages[0].history.length, 20)
    assert.equal(doc.pages[0].history[0].body, 'Version 23')
    doc = save(doc, {...draft, id: 'setup', title: 'Setup'})
    const next = deleteWikiPage(doc, 'home')
    assert.equal(next.homePageId, 'setup')
    assert.ok(validWikiDocument(next))
    assert.deepEqual(deleteWikiPage(next, 'setup'), empty)
})

test('shared page addresses carry project identity and preserve unrelated query parameters', () => {
    const href = wikiPageHref('?page=old&project=old&view=compact', 'project-2', 'getting-started')
    const params = new URLSearchParams(href.slice(1))
    assert.equal(params.get('project'), 'project-2')
    assert.equal(params.get('page'), 'getting-started')
    assert.equal(params.get('view'), 'compact')
})

test('wiki editing is independently grantable and Administrator includes it', () => {
    assert.ok(grantsWorkshopPermission(['Manage wiki'], 'Manage wiki'))
    assert.ok(grantsWorkshopPermission(['Administrator'], 'Manage wiki'))
    for (const permission of ['Manage notes', 'Manage projects', 'Edit ideation']) assert.equal(grantsWorkshopPermission([permission], 'Manage wiki'), false)
    assert.equal(grantsWorkshopPermission(['Manage wiki'], 'View all projects'), false)
})
