import test from 'node:test'
import assert from 'node:assert/strict'
import {validToolDocument, emptyDocuments} from '../src/features/workshop/tool-documents.ts'
import {noteTextColor, noteColors} from '../src/features/workshop/sticky-notes.ts'

const note = {id: 'note-1', title: 'Next release', body: 'Review onboarding', color: '#f6e7a6', updatedAt: '2026-10-20T00:00:00.000Z'}
test('notes recovery accepts valid notes and rejects corrupt drafts', () => {
    assert.equal(validToolDocument('notes', emptyDocuments.notes), true)
    assert.equal(validToolDocument('notes', {notes: [note]}), true)
    for (const notes of [[note, note], [{...note, color: 'red'}], [{...note, title: ' '}], [{...note, body: 'a'.repeat(10001)}], [{...note, updatedAt: 'invalid'}], [null], Array.from({length: 1001}, (_, i) => ({...note, id: String(i)}))]) {
        assert.equal(validToolDocument('notes', {notes}), false)
    }
})
test('preset and custom note colors retain accessible text contrast', () => {
    for (const color of [...noteColors.map(preset => preset.color), '#ffffff', '#000000', '#ff0000', '#0000ff', '#777777']) {
        const luminance = hex => {
            const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
            return .2126 * r + .7152 * g + .0722 * b
        }
        const values = [luminance(color), luminance(noteTextColor(color))].sort((a, b) => b - a)
        assert.ok((values[0] + .05) / (values[1] + .05) >= 4.5, color)
    }
})
