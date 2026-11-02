import test from 'node:test'
import assert from 'node:assert/strict'
import {canvasViewKey, readCanvasView, saveCanvasView} from '../src/features/workshop/canvas-view-storage.ts'
import {canvasStorage} from './fixtures/canvas-storage.mjs'

test('canvas views stay separate by user, organization, project, tool and UML diagram', t => {
    canvasStorage(t)
    const scope = ['user', 'org', 'project', 'uml', 'diagram']
    const key = canvasViewKey(...scope), view = {zoom: .19, pan: {x: -1234.5, y: 456.25}}
    saveCanvasView(key, view)
    assert.deepEqual(readCanvasView(key), view)
    for (let i = 0; i < scope.length; i++) {
        const other = [...scope]; other[i] += '-other'
        assert.equal(readCanvasView(canvasViewKey(...other)), undefined)
    }
    assert.notEqual(canvasViewKey('a:b', 'c', 'd', 'erd'), canvasViewKey('a', 'b:c', 'd', 'erd'))
})

test('invalid or inaccessible storage falls back without breaking navigation', t => {
    const storage = canvasStorage(t), key = 'view'
    for (const value of ['{', 'null', '{}', '{"zoom":0,"pan":{"x":1,"y":2}}', '{"zoom":1,"pan":{"x":"1","y":2}}', '{"zoom":1e400,"pan":{"x":1,"y":2}}']) {
        storage.setItem(key, value)
        assert.equal(readCanvasView(key), undefined)
    }
    for (const zoom of [0, -1, NaN, Infinity]) {
        saveCanvasView(key, {zoom, pan: {x: 1, y: 2}})
        assert.equal(readCanvasView(key), undefined)
    }
    storage.getItem = () => {throw new Error('Storage blocked')}
    storage.setItem = () => {throw new Error('Quota exceeded')}
    assert.equal(readCanvasView(key), undefined)
    assert.doesNotThrow(() => saveCanvasView(key, {zoom: 1, pan: {x: 1, y: 2}}))
})
