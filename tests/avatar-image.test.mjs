import test from 'node:test'
import assert from 'node:assert/strict'
import {avatarFileError, avatarMaxFileBytes} from '../src/features/workshop/avatar-image.ts'

test('avatar uploads accept supported raster formats and reject active/empty/oversized files', () => {
    for(const type of ['image/png','image/jpeg','image/webp']) assert.equal(avatarFileError({type,size:1024}),'')
    for(const type of ['image/svg+xml','text/html','image/gif','']) assert.match(avatarFileError({type,size:1024}),/PNG/)
    assert.match(avatarFileError({type:'image/png',size:0}),/10 MB/)
    assert.match(avatarFileError({type:'image/png',size:avatarMaxFileBytes+1}),/10 MB/)
})
