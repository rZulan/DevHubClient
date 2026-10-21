import test from 'node:test'
import assert from 'node:assert/strict'
import data from 'emoji-picker-react/data/emojis-en'
import {searchEmojis} from 'emoji-picker-react/data'
import {validNoteEmoji} from '../src/features/workshop/note-emojis.ts'
import {keepNoteDraft, readNoteDrafts, writeNoteDrafts} from '../src/features/workshop/note-drafts.ts'

const choices = new Set(Object.values(data.emojis).flat().flatMap(item => [item.u, ...(item.v ?? [])]))
const characters = unified => String.fromCodePoint(...unified.split('-').map(part => parseInt(part, 16)))

test('full catalog includes thousands of choices across every standard category', () => {
    assert.ok(choices.size > 3900, `Only ${choices.size} emoji choices available`)
    for (const category of ['smileys_people', 'animals_nature', 'food_drink', 'travel_places', 'activities', 'objects', 'symbols', 'flags']) {
        assert.ok(data.emojis[category].length > 50, category)
    }
    assert.ok(data.emojis.flags.length > 250)
    for (const unified of ['1f1f5-1f1ed', '1f44d-1f3fd', '1f469-200d-1f4bb']) assert.ok(choices.has(unified), unified)
})

test('full catalog search can find flags, people, objects, and animals', () => {
    for (const [query, unified] of [['philippines', '1f1f5-1f1ed'], ['technologist', '1f469-200d-1f4bb'], ['rocket', '1f680'], ['otter', '1f9a6']]) {
        assert.ok(searchEmojis(query).some(item => item.unified === unified), query)
    }
})

test('every catalog entry and skin-tone variation fits note validation and survives draft recovery', () => {
    let stored = null
    const storage = {getItem: () => stored, setItem: (_, value) => {stored = value}, removeItem: () => {stored = null}}
    const base = {id: 'note', title: 'Full emoji support', body: '', color: '#f6e7a6', updatedAt: '2026-10-21T00:00:00.000Z'}
    for (const unified of choices) {
        const emoji = characters(unified)
        assert.ok(validNoteEmoji(emoji), unified)
        writeNoteDrafts(storage, 'draft', keepNoteDraft([], {...base, emoji}, false))
        assert.equal(readNoteDrafts(storage, 'draft')[0].note.emoji, emoji, unified)
    }
})
