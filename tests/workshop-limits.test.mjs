import test from 'node:test'
import assert from 'node:assert/strict'
import {canGrowCanvas, canvasObjectCount, retrySeconds, saveFailureDetail} from '../src/features/workshop/workshop-limits.ts'

test('canvas growth preserves old large documents while blocking further growth', () => {
    assert.equal(canGrowCanvas(1999, 2000, 1999), true)
    assert.equal(canGrowCanvas(2000, 2001, 2000), false)
    assert.equal(canGrowCanvas(3000, 3000, 3000), true)
    assert.equal(canGrowCanvas(3000, 2999, 3000), true)
    assert.equal(canGrowCanvas(3000, 3001, 3000), false)
    assert.equal(canGrowCanvas(50, 51, 50, 50), false)
})
test('rate-limit cooldowns are bounded and preserve server instructions', () => {
    assert.equal(retrySeconds({status: 429, data: {retryAfterSeconds: 86400}}), 86400)
    assert.equal(retrySeconds({status: 429, data: {retryAfterSeconds: -1}}), 1)
    assert.equal(retrySeconds({status: 429}), 60)
    assert.equal(retrySeconds({status: 400}), null)
})
test('quota errors retain meaningful server details and canvas counters use the right collection', () => {
    assert.equal(saveFailureDetail({data: {detail: 'Canvas limit reached'}}, 'fallback'), 'Canvas limit reached')
    assert.equal(saveFailureDetail({}, 'fallback'), 'fallback')
    assert.equal(canvasObjectCount('ideas', [{}, {}]), 2)
    assert.equal(canvasObjectCount('ui-editor', {layers: [{}]}), 1)
    assert.equal(canvasObjectCount('notes', {notes: [{}]}), null)
})
