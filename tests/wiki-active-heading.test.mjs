import test from 'node:test'
import assert from 'node:assert/strict'
import {activeWikiHeading, wikiScrollTail} from '../src/features/workshop/wiki-active-heading.ts'

const headings = [{id: 'release', top: -30}, {id: 'troubleshooting', top: 220}, {id: 'related', top: 380}, {id: 'decisions', top: 510}]
const bottom = {top: 0, height: 600, scrollTop: 1000, scrollHeight: 1600}

test('reaching the article bottom does not skip the intermediate sections', () => {
    assert.equal(activeWikiHeading(headings, bottom), 'release')
    assert.equal(activeWikiHeading(headings, {...bottom, scrollTop: 999.5}), 'release')
})

test('each clicked entry near the bottom remains selected when anchor scrolling is clamped', () => {
    for (const id of ['troubleshooting', 'related', 'decisions']) {
        assert.equal(activeWikiHeading(headings, bottom, {id, scrollTop: null}), id)
        assert.equal(activeWikiHeading(headings, bottom, {id, scrollTop: 1000}), id)
    }
})

test('manual scrolling away from the clicked position restores position-based highlighting', () => {
    assert.equal(activeWikiHeading(headings, {...bottom, scrollTop: 900}, {id: 'related', scrollTop: 1000}), 'release')
    assert.equal(activeWikiHeading(headings, bottom), 'release')
})

test('normal scrolling uses the heading threshold relative to the actual scroll container', () => {
    const sections = [{id: 'first', top: 110}, {id: 'second', top: 190}, {id: 'third', top: 350}]
    assert.equal(activeWikiHeading(sections, {top: 100, height: 600, scrollTop: 100, scrollHeight: 1800}), 'second')
})

test('an article that does not scroll starts at the first section and still allows explicit selection', () => {
    const short = {...bottom, scrollTop: 0, scrollHeight: 500}
    assert.equal(activeWikiHeading(headings, short), 'release')
    assert.equal(activeWikiHeading(headings, short, {id: 'related', scrollTop: 0}), 'related')
})

test('hidden or removed selected headings cannot retain an active indicator', () => {
    assert.equal(activeWikiHeading(headings.slice(0, 2), bottom, {id: 'related', scrollTop: 1000}), 'release')
    assert.equal(activeWikiHeading([], bottom, {id: 'related', scrollTop: 1000}), '')
})

test('scrolling through the final sections highlights each heading in order and works in reverse', () => {
    const offsets = [0, 121, 281, 411]
    for (const offset of [...offsets, ...offsets.toReversed()]) {
        const positions = headings.map(heading => ({...heading, top: heading.top - offset}))
        const expected = ['release', 'troubleshooting', 'related', 'decisions'][offsets.indexOf(offset)]
        assert.equal(activeWikiHeading(positions, {...bottom, scrollTop: 1000 + offset, scrollHeight: 2100}), expected)
    }
})

test('scroll tail makes the final heading reachable using the actual viewport height', () => {
    assert.equal(wikiScrollTail(510, 600, 600), 411)
    assert.equal(wikiScrollTail(910, 1000, 600), 411)
    assert.equal(wikiScrollTail(510.25, 600, 600), 412)
    assert.equal(wikiScrollTail(510, 1200, 600), 64)
    assert.equal(wikiScrollTail(510, 600, 400), 211)
    const tail = wikiScrollTail(510, 600, 600)
    assert.equal(activeWikiHeading(headings.map(h => ({...h, top: h.top - tail})), {...bottom, scrollTop: 1000 + tail, scrollHeight: 1600 + tail}), 'decisions')
})
