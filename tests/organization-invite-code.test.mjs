import test from 'node:test'
import assert from 'node:assert/strict'
import {extractInviteToken} from '../src/features/workshop/organization-invite-code.ts'

test('short invite codes normalize case, whitespace, query links and path links', () => {
    const code = 'ABCD2345EFGH'
    for (const input of [code, ` ${code.toLowerCase()} `, `https://devhub.app/workshop?invite=${code.toLowerCase()}&choose=1`, `/workshop?invite=${code}`, `https://devhub.app/invite/${code}?ref=team`, `https://devhub.app/invites/${code}/accept`, `https://devhub.app/invite/%41BCD2345EFGH`]) assert.equal(extractInviteToken(input), code)
})

test('existing long invitation links remain usable', () => {
    const token = 'ab'.repeat(32)
    for (const input of [token, token.toUpperCase(), `https://devhub.app/workshop?invite=${token}`, `https://devhub.app/invite/${token}`]) assert.equal(extractInviteToken(input), token)
})

test('incomplete codes, GUIDs, unrelated URLs and unsafe schemes cannot become invite codes', () => {
    for (const input of ['', 'ABCD2345', 'ABCD2345EFGHZ', 'ABCD0145EFGH', 'a0c060bd-b73f-4d30-96cd-77e77c4c590a', 'https://devhub.app/workshop', 'https://devhub.app/workshop?invite=wrong', 'javascript:alert(1)?invite=ABCD2345EFGH', 'https://devhub.app/invite/%ZZ']) assert.equal(extractInviteToken(input), null)
})
