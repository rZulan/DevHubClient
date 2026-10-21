import test from 'node:test'
import assert from 'node:assert/strict'
import {keepNoteDraft, noteDraftKey, readNoteDrafts, withoutSavedNoteDrafts, writeNoteDrafts} from '../src/features/workshop/note-drafts.ts'

const note = {id: 'note-1', title: '', body: 'Writing before choosing a title\n```js\nconst answer = 42', color: '#f6e7a6', updatedAt: '2026-10-21T00:00:00.000Z'}
function browserStorage() {
    const values = new Map()
    return {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key)}
}

test('untitled writing, unfinished code, colors, and new-note state survive a reload', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    writeNoteDrafts(storage, key, keepNoteDraft([], note, true))
    const reloaded = readNoteDrafts(storage, key)
    assert.equal(reloaded.length, 1)
    assert.deepEqual(reloaded[0].note, note)
    assert.equal(reloaded[0].creating, true)
    assert.ok(Number.isFinite(Date.parse(reloaded[0].savedAt)))
})

test('each edit replaces its own draft while other note drafts remain resumable', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    writeNoteDrafts(storage, key, keepNoteDraft(keepNoteDraft([], note, true), {...note, id: 'note-2', title: 'Another note'}, false))
    writeNoteDrafts(storage, key, keepNoteDraft(readNoteDrafts(storage, key), {...note, body: 'Latest keystroke', color: '#000000'}, true))
    const restored = readNoteDrafts(storage, key)
    assert.equal(restored.length, 2)
    assert.equal(restored.find(draft => draft.note.id === 'note-1').note.body, 'Latest keystroke')
    assert.equal(restored.find(draft => draft.note.id === 'note-1').note.color, '#000000')
    assert.equal(restored.find(draft => draft.note.id === 'note-2').creating, false)
})

test('drafts stay isolated by user, organization, and project', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    writeNoteDrafts(storage, key, keepNoteDraft([], note, true))
    for (const otherKey of [noteDraftKey('other', 'org', 'project'), noteDraftKey('user', 'other', 'project'), noteDraftKey('user', 'org', 'other')]) {
        assert.deepEqual(readNoteDrafts(storage, otherKey), [])
    }
})

test('saved copies clear only matching drafts; changed or remotely deleted notes remain recoverable', () => {
    const edited = {...note, title: '  Title  '}, drafts = keepNoteDraft([], edited, false)
    assert.equal(withoutSavedNoteDrafts(drafts, []).length, 1)
    for (const different of [{...edited, body: 'Remote body'}, {...edited, color: '#ffffff'}, {...edited, title: 'Other title'}, {...edited, id: 'other'}]) {
        assert.equal(withoutSavedNoteDrafts(drafts, [different]).length, 1)
    }
    assert.deepEqual(withoutSavedNoteDrafts(drafts, [{...edited, title: 'Title', updatedAt: '2026-10-22T00:00:00.000Z'}]), [])
})

test('discard persists across reloads without affecting another draft', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    writeNoteDrafts(storage, key, keepNoteDraft(keepNoteDraft([], note, true), {...note, id: 'note-2'}, true))
    writeNoteDrafts(storage, key, readNoteDrafts(storage, key).filter(draft => draft.note.id !== note.id))
    assert.deepEqual(readNoteDrafts(storage, key).map(draft => draft.note.id), ['note-2'])
    writeNoteDrafts(storage, key, [])
    assert.equal(storage.getItem(key), null)
})

test('malformed drafts do not prevent recovery of valid drafts', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    storage.setItem(key, '{broken')
    assert.deepEqual(readNoteDrafts(storage, key), [])
    const valid = keepNoteDraft([], note, true)[0]
    storage.setItem(key, JSON.stringify({version: 1, drafts: [null, {}, {...valid, note: {...note, color: 'red'}}, {...valid, note: {...note, body: 'x'.repeat(10001)}}, {...valid, creating: 'yes'}, valid]}))
    assert.deepEqual(readNoteDrafts(storage, key), [valid])
})

test('unavailable or full browser storage reports failure instead of claiming the draft was saved', () => {
    const key = noteDraftKey('user', 'org', 'project')
    assert.throws(() => readNoteDrafts({getItem() {throw new Error('Blocked')}}, key), /Blocked/)
    assert.throws(() => writeNoteDrafts({setItem() {throw new Error('Full')}}, key, keepNoteDraft([], note, true)), /Full/)
})

test('emoji choices and None survive refresh and remain drafts until that choice is saved', () => {
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    for (const emoji of ['🚀', '👩🏽‍💻', null]) {
        const edited = {...note, title: 'Emoji only change', emoji}
        writeNoteDrafts(storage, key, keepNoteDraft([], edited, false))
        const restored = readNoteDrafts(storage, key)
        assert.equal(restored[0].note.emoji, emoji)
        assert.equal(withoutSavedNoteDrafts(restored, [{...edited, emoji: undefined}]).length, 1)
        assert.deepEqual(withoutSavedNoteDrafts(restored, [edited]), [])
    }
})

test('explicit default emoji matches older notes, while invalid emoji drafts are ignored', () => {
    const edited = {...note, title: 'Same note', emoji: '📝'}
    assert.deepEqual(withoutSavedNoteDrafts(keepNoteDraft([], edited, false), [{...edited, emoji: undefined}]), [])
    const storage = browserStorage(), key = noteDraftKey('user', 'org', 'project')
    writeNoteDrafts(storage, key, keepNoteDraft([], {...note, emoji: {}}, false))
    assert.deepEqual(readNoteDrafts(storage, key), [])
})
