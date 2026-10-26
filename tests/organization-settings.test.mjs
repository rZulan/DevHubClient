import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {availablePermissions, grantsWorkshopPermission} from '../src/features/workshop/workshop-permissions.ts'
import {hasWorkshopPermission, canManageWorkshopMember, canAssignWorkshopRole} from '../src/features/workshop/workshop-access.ts'
import {organizationProfileDraft, syncOrganizationProfileDraft} from '../src/features/workshop/organization-profile-draft.ts'

const model = permissions => ({members:[{id:'owner',isOwner:true,roleId:'owner'},{id:'actor',roleId:'manager'},{id:'target',roleId:'member'}],roles:[{id:'owner',order:0,permissions:[]},{id:'manager',order:1,permissions},{id:'member',order:1000,permissions:[]}],teams:[]})
test('individual tool grants stay isolated and never grant project visibility or administration', () => {
    for (const permission of ['Edit ERD','Edit UI designs','Manage notes','Manage roadmap','Manage dashboard']) {
        const org = model([permission])
        assert.ok(hasWorkshopPermission(org,'actor',permission))
        for (const other of availablePermissions.filter(other => other !== permission)) assert.equal(hasWorkshopPermission(org,'actor',other),false,`${permission} must not imply ${other}`)
    }
    assert.equal(hasWorkshopPermission(model(['Administrator']),'outsider','Manage notes'),false)
    assert.ok(hasWorkshopPermission(model([]),'owner','Manage roadmap'))
})
test('legacy and broader grants retain existing access without granting unrelated tools', () => {
    for (const tool of ['Edit ERD','Edit UI designs','Manage notes']) assert.ok(grantsWorkshopPermission(['Edit ideation'],tool))
    assert.ok(grantsWorkshopPermission(['Manage projects'],'Manage roadmap'))
    assert.ok(grantsWorkshopPermission(['Manage organization'],'Manage dashboard'))
    assert.ok(grantsWorkshopPermission(['Manage invites'],'Create invites'))
    assert.equal(grantsWorkshopPermission(['Create invites'],'Manage invites'),false)
    assert.equal(grantsWorkshopPermission(['Edit ideation'],'Manage roadmap'),false)
    assert.equal(grantsWorkshopPermission(['Manage projects'],'Edit UI designs'),false)
    for (const permission of availablePermissions) assert.ok(grantsWorkshopPermission(['Administrator'],permission))
})
test('member removal and role assignments require their own permissions and respect hierarchy', () => {
    const manager = model(['Manage roles'])
    assert.equal(canManageWorkshopMember(manager,'actor','target'),false)
    assert.ok(canAssignWorkshopRole(manager,'actor','target',manager.roles[2])) // default flag is not present in this test role
    const remover = model(['Manage members'])
    assert.ok(canManageWorkshopMember(remover,'actor','target'))
    assert.equal(canAssignWorkshopRole(remover,'actor','target',remover.roles[2]),false)
    remover.teams.push({leaderId:'target'})
    assert.equal(canManageWorkshopMember(remover,'actor','target'),false)
    assert.equal(canManageWorkshopMember(remover,'owner','target'),false,'reassign team leadership first')
    assert.equal(canManageWorkshopMember(manager,'owner','owner'),false)
    assert.equal(canAssignWorkshopRole(manager,'actor','owner',manager.roles[2]),false)
    assert.equal(canAssignWorkshopRole(manager,'actor','target',{...manager.roles[2],isDefaultRole:true}),false)
})
test('permission catalog matches the API catalog, with no duplicates', () => {
    const source = readFileSync(new URL('../../api/src/DevHub.Domain/Organizations/OrganizationPermissions.cs',import.meta.url),'utf8')
    const server = [...source.matchAll(/public const string \w+ = "([^"]+)"/g)].map(match => match[1])
    assert.deepEqual([...availablePermissions].sort(),server.sort())
    assert.equal(new Set(availablePermissions).size,availablePermissions.length)
})
test('profile load and refresh preserve edited fields while hydrating untouched fields', () => {
    let draft = organizationProfileDraft('org','Original','')
    draft = {...draft,name:'Typing a new name'}
    draft = syncOrganizationProfileDraft(draft,'org','Original','Saved description loaded later')
    assert.equal(draft.name,'Typing a new name')
    assert.equal(draft.description,'Saved description loaded later')
    draft = {...draft,description:'My unsaved description'}
    const refreshed = syncOrganizationProfileDraft(draft,'org','Renamed remotely','Remote description')
    assert.equal(refreshed.name,'Typing a new name')
    assert.equal(refreshed.description,'My unsaved description')
    assert.equal(refreshed.savedDescription,'Remote description')
    assert.deepEqual(syncOrganizationProfileDraft(draft,'other','Another org','New description'),organizationProfileDraft('other','Another org','New description'))
})
