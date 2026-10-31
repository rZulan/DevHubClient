import test from 'node:test'
import assert from 'node:assert/strict'
import {deleteWikiPage, findWikiPage, saveWikiPage, uniqueWikiSlug, validWikiDocument, wikiPageHref, wikiSlug, wikiAncestors, wikiParentOptions, wikiCanAddSubpage} from '../src/features/workshop/wiki-document.ts'
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

test('nested pages can move without changing addresses and cannot be moved into their own branch', () => {
    let doc = save(empty)
    doc = save(doc, {...draft, id: 'child', title: 'Setup', parentId: 'home'})
    doc = save(doc, {...draft, id: 'grandchild', title: 'Install', parentId: 'child'})
    doc = save(doc, {...draft, id: 'other', title: 'Architecture'})
    assert.deepEqual(wikiAncestors(doc.pages, 'grandchild').map(page => page.id), ['home', 'child'])
    assert.deepEqual(wikiParentOptions(doc.pages, 'home').map(page => page.id), ['other'])
    assert.throws(() => save(doc, {...draft, parentId: 'grandchild'}), /parent/)
    assert.throws(() => save(doc, {...draft, parentId: 'home'}), /parent/)
    assert.throws(() => save(doc, {...draft, parentId: 'missing'}), /parent/)
    const moved = save(doc, {...draft, id: 'child', title: 'New setup title', parentId: 'other'})
    assert.equal(moved.pages.find(page => page.id === 'child').slug, 'setup')
    assert.deepEqual(wikiAncestors(moved.pages, 'grandchild').map(page => page.id), ['other', 'child'])
    const root = save(moved, {...draft, id: 'child', title: 'New setup title', parentId: null}, 'revision-2')
    assert.deepEqual(wikiAncestors(root.pages, 'grandchild').map(page => page.id), ['child'])
    const edited = save(doc, {...draft, id: 'child', title: 'Setup', body: 'Legacy edit without a parent field'})
    assert.equal(edited.pages.find(page => page.id === 'child').parentId, 'home')
    assert.ok(validWikiDocument(moved))
})

test('deleting a parent keeps child content, history and links, moving only direct children up a level', () => {
    let doc = save(empty)
    doc = save(doc, {...draft, id: 'child', title: 'Setup', parentId: 'home'})
    doc = save(doc, {...draft, id: 'grandchild', title: 'Install', parentId: 'child'})
    doc = save(doc, {...draft, id: 'leaf', title: 'Linux', parentId: 'grandchild'})
    const removed = deleteWikiPage(doc, 'child')
    assert.deepEqual(removed.pages.find(page => page.id === 'grandchild'), {...doc.pages.find(page => page.id === 'grandchild'), parentId: 'home'})
    assert.equal(removed.pages.find(page => page.id === 'leaf').parentId, 'grandchild')
    const homeRemoved = deleteWikiPage(doc, 'home')
    assert.equal(homeRemoved.pages.find(page => page.id === 'child').parentId, null)
    assert.ok(validWikiDocument(removed) && validWikiDocument(homeRemoved))
})

test('legacy flat documents remain valid; missing parents, cycles and malformed parent IDs are rejected', () => {
    const doc = save(empty), root = doc.pages[0]
    const {parentId: _parent, ...legacyRoot} = root
    assert.ok(validWikiDocument({...doc, pages: [legacyRoot]}))
    for (const parentId of ['missing', 'home', '', ' ', 42, {}, false]) {
        assert.equal(validWikiDocument({...doc, pages: [{...root, parentId}]}), false)
    }
    const child = {...root, id: 'child', slug: 'child', title: 'Child', parentId: 'home'}
    assert.equal(validWikiDocument({...doc, pages: [{...root, parentId: 'child'}, child]}), false)
    assert.ok(validWikiDocument({...doc, pages: [root, child]}))
})

test('a page accepts two subpages and blocks a third through creation, movement and document validation', () => {
    let doc = save(empty)
    doc = save(doc, {...draft, id: 'a', title: 'First', parentId: 'home'})
    doc = save(doc, {...draft, id: 'b', title: 'Second', parentId: 'home'})
    doc = save(doc, {...draft, id: 'c', title: 'Top-level page'})
    assert.ok(validWikiDocument(doc))
    assert.equal(wikiCanAddSubpage(doc.pages, 'home'), false)
    assert.equal(wikiParentOptions(doc.pages, 'c').find(option => option.id === 'home').disabled, true)
    assert.equal(wikiParentOptions(doc.pages, 'a').find(option => option.id === 'home').disabled, false)
    assert.throws(() => save(doc, {...draft, id: 'third', title: 'Third', parentId: 'home'}), /maximum of 2/)
    assert.throws(() => save(doc, {...draft, id: 'c', title: 'Top-level page', parentId: 'home'}), /maximum of 2/)
    assert.equal(validWikiDocument({...doc, pages: doc.pages.map(page => page.id === 'c' ? {...page, parentId: 'home'} : page)}), false)
    const edited = save(doc, {...draft, id: 'a', title: 'First', body: 'Updated content', parentId: 'home'})
    assert.equal(edited.pages.find(page => page.id === 'a').body, 'Updated content')
    const freed = save(doc, {...draft, id: 'a', title: 'First', parentId: null})
    assert.ok(wikiCanAddSubpage(freed.pages, 'home'))
    assert.ok(validWikiDocument(save(freed, {...draft, id: 'c', title: 'Top-level page', parentId: 'home'})))
})

test('deleting a branch keeps children and moves overflow to the top level', () => {
    let doc = save(empty)
    for (const page of [
        {id: 'parent', title: 'Parent', parentId: 'home'}, {id: 'sibling', title: 'Sibling', parentId: 'home'},
        {id: 'a', title: 'A', parentId: 'parent'}, {id: 'b', title: 'B', parentId: 'parent'},
    ]) doc = save(doc, {...draft, ...page})
    const result = deleteWikiPage(doc, 'parent')
    assert.equal(result.pages.find(page => page.id === 'a').parentId, 'home')
    assert.equal(result.pages.find(page => page.id === 'b').parentId, null)
    assert.equal(result.pages.find(page => page.id === 'b').slug, 'b')
    assert.equal(result.pages.find(page => page.id === 'b').body, draft.body)
    assert.ok(validWikiDocument(result))
})
