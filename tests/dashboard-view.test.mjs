import assert from 'node:assert/strict'
import test from 'node:test'
import {getDashboardView, setDashboardView} from '../src/features/workshop/dashboard-view.ts'

test('last dashboard view survives returning and stays isolated by account and organization', () => {
    const values = new Map()
    globalThis.localStorage = {getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value)}
    try {
        assert.equal(getDashboardView('alice', 'org-a'), 'organization')
        setDashboardView('alice', 'org-a', 'personal')
        assert.equal(getDashboardView('alice', 'org-a'), 'personal')
        assert.equal(getDashboardView('bob', 'org-a'), 'organization')
        assert.equal(getDashboardView('alice', 'org-b'), 'organization')
        assert.equal(getDashboardView('alice', 'org-a', 'organization'), 'organization')
        setDashboardView('alice', 'org-a', 'organization')
        assert.equal(getDashboardView('alice', 'org-a'), 'organization')
        assert.equal(getDashboardView('alice', 'org-a', 'personal'), 'personal')
        assert.equal(getDashboardView('alice', 'org-a', 'invalid'), 'organization')
    } finally {delete globalThis.localStorage}
})

test('blocked browser storage still allows explicit dashboard switching', () => {
    globalThis.localStorage = {getItem() {throw new Error('Blocked')}, setItem() {throw new Error('Blocked')}}
    try {
        assert.doesNotThrow(() => setDashboardView('alice', 'org-a', 'personal'))
        assert.equal(getDashboardView('alice', 'org-a'), 'organization')
        assert.equal(getDashboardView('alice', 'org-a', 'personal'), 'personal')
    } finally {delete globalThis.localStorage}
})
