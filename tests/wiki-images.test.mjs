import test from 'node:test'
import assert from 'node:assert/strict'
import {wikiImageReference, wikiImageSize} from '../src/features/workshop/wiki-images.ts'

test('image references escape descriptions and URLs and accept optional pixel sizes', () => {
    assert.equal(wikiImageReference('https://example.com/a (1).png', 'Flow [diagram]', '400', '240'), '![Flow \\[diagram\\]](<https://example.com/a%20(1).png>){width=400 height=240}')
    assert.equal(wikiImageReference('/images/example.png', 'Logo', '', '120'), '![Logo](</images/example.png>){height=120}')
    assert.equal(wikiImageReference('./images/example.png', 'Logo'), '![Logo](<./images/example.png>)')
    assert.equal(wikiImageReference('/images/my%20diagram.png', 'Diagram'), '![Diagram](</images/my%20diagram.png>)')
    assert.deepEqual(wikiImageSize('height=240 width=400px'), {height: 240, width: 400})
    for (const size of ['width=0', 'width=4097', 'height=-1', 'width=20%', 'width=10.5', 'width=10 width=20', 'width=20 onerror=alert(1)', 'style=color:red', '']) assert.equal(wikiImageSize(size), null)
    for (const url of ['javascript:alert(1)', 'data:image/svg+xml,abc', 'file:///secret', 'https://example.com/a>\ntext', '']) assert.throws(() => wikiImageReference(url, 'Image'))
    assert.throws(() => wikiImageReference('https://example.com/a.png', '', '0'), /pixels/)
})
