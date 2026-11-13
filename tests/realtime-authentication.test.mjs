import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(fs.readFileSync(new URL('../src/services/realtime.ts', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
}).outputText

function harness({supportsRefresh = true} = {}) {
    const user = {id: 'alice'}
    const state = {auth: {user, accessToken: 'initial', accessTokenExpiresAtUtc: new Date(Date.now() + 300_000).toISOString()}}
    let renewals = 0
    let renew = async () => {
        state.auth = {...state.auth, accessToken: 'renewed', accessTokenExpiresAtUtc: new Date(Date.now() + 300_000).toISOString()}
        return {userId: user.id, accessToken: state.auth.accessToken}
    }
    class Builder {
        withUrl(path, options) { this.path = path; this.options = options; return this }
    }
    if (supportsRefresh) {
        Builder.prototype.withAuthenticationRefresh = function (options) { this.refresh = options; return this }
    }
    const store = {
        getState: () => state,
        dispatch: () => ({unwrap: () => { renewals++; return renew() }}),
    }
    const exports = {}
    vm.runInNewContext(source, {exports, require: name => {
        if (name === '@microsoft/signalr') return {HubConnectionBuilder: Builder}
        if (name === '@/app/store') return {store}
        if (name === '@/services/api') return {api: {endpoints: {refresh: {initiate: () => ({})}}}}
        throw new Error(name)
    }})
    return {state, builder: exports.realtimeConnection('/hubs/chat', user.id),
        renewWith: implementation => { renew = implementation },
        get renewals() { return renewals }}
}

test('a stale SignalR dependency can still build a connection and supply its token', async () => {
    const h = harness({supportsRefresh: false})
    assert.equal(h.builder.path, '/hubs/chat')
    assert.equal(await h.builder.options.accessTokenFactory(), 'initial')
})

test('realtime connections renew near expiry and reuse the new token on the same builder', async () => {
    const h = harness()
    const {accessTokenFactory} = h.builder.options
    assert.equal(h.builder.refresh.refreshBeforeExpirationInMilliseconds, 60_000)
    assert.equal(await accessTokenFactory(), 'initial')
    assert.equal(h.renewals, 0)

    h.state.auth.accessTokenExpiresAtUtc = new Date(Date.now() + 30_000).toISOString()
    assert.equal(await accessTokenFactory(), 'renewed')
    assert.equal(await accessTokenFactory(), 'renewed')
    assert.equal(h.renewals, 1)
})

test('a refresh failure can use a still-valid token, and a signed-out connection cannot get another token', async () => {
    const h = harness()
    const {accessTokenFactory} = h.builder.options
    h.state.auth.accessTokenExpiresAtUtc = new Date(Date.now() + 30_000).toISOString()
    h.renewWith(async () => { throw new Error('offline') })
    assert.equal(await accessTokenFactory(), 'initial')

    h.state.auth.accessTokenExpiresAtUtc = new Date(0).toISOString()
    await assert.rejects(accessTokenFactory, /Unable to refresh/)
    h.renewWith(async () => {
        h.state.auth.user = null
        return {userId: 'alice', accessToken: 'stale'}
    })
    await assert.rejects(accessTokenFactory, /Unable to refresh/)
    await assert.rejects(accessTokenFactory, /active session changed/)
})
