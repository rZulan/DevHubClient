import test from 'node:test'
import assert from 'node:assert/strict'
import {boundRoadmap, elasticRoadmap, fitRoadmap, roadmapPositions, roadmapSize} from '../src/features/workshop/sdlc-camera.ts'

test('overview includes all phases; the initial phone view keeps labels readable', () => {
    for (const viewport of [{width: 1080, height: 560}, {width: 350, height: 360}, {width: 800, height: 260}]) {
        const overview = fitRoadmap(viewport)
        assert.ok(overview.x >= 0 && overview.y >= 0)
        assert.ok(overview.x + roadmapSize.width * overview.zoom <= viewport.width + 1e-8)
        assert.ok(overview.y + roadmapSize.height * overview.zoom <= viewport.height + 1e-8)
        for (const position of roadmapPositions) {
            assert.ok(position.x * overview.zoom + overview.x >= 0)
            assert.ok((position.y + 100) * overview.zoom + overview.y <= viewport.height)
        }
    }
    assert.ok(fitRoadmap({width: 350, height: 360}, true).zoom >= .6)
})

test('large roadmap pans only between its edges; small roadmap stays centered', () => {
    const viewport = {width: 400, height: 300}
    assert.deepEqual(boundRoadmap({zoom: 1, x: 9000, y: -9000}, viewport), {zoom: 1, x: 0, y: -600})
    assert.deepEqual(boundRoadmap({zoom: 1, x: -9000, y: 9000}, viewport), {zoom: 1, x: -600, y: 0})
    assert.deepEqual(boundRoadmap({zoom: .2, x: 9000, y: -9000}, viewport), {zoom: .2, x: 100, y: 60})
})

test('overscroll resists long gestures and settles to the nearest edge without changing zoom', () => {
    const viewport = {width: 400, height: 300}
    for (const distance of [1, 20, 100, 10000]) {
        const raw = {zoom: 1, x: distance, y: -600 - distance}
        const elastic = elasticRoadmap(raw, viewport)
        assert.ok(elastic.x > 0 && elastic.x <= 72)
        assert.ok(elastic.y < -600 && elastic.y >= -672)
        assert.ok(elastic.x < distance)
        assert.deepEqual(boundRoadmap(elastic, viewport), {zoom: 1, x: 0, y: -600})
    }
    const inBounds = {zoom: 1, x: -100, y: -70}
    assert.deepEqual(elasticRoadmap(inBounds, viewport), inBounds)
})
