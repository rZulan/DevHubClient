import test from 'node:test'
import assert from 'node:assert/strict'
import {notificationAction, notificationHref} from '../src/features/workshop/notifications.ts'

const item = {id: 1, kind: 'task-assigned', title: 'Review release', actorName: 'Nina', projectId: 'project-2', projectName: 'Atlas', contextId: 'board-1', targetId: 'task-4', createdAtUtc: '2026-10-27T01:00:00Z', readAtUtc: null}
test('assignment links identify the project, board and task even when a different project is selected', () => {
    const url = new URL(notificationHref('org-1', item), 'https://example.test')
    assert.equal(url.pathname, '/workshop/org-1/todo')
    assert.equal(url.searchParams.get('project'), 'project-2')
    assert.equal(url.searchParams.get('todoProject'), 'project-2')
    assert.equal(url.searchParams.get('todo'), 'board-1')
    assert.equal(url.searchParams.get('task'), 'task-4')
})
test('deleted targets lead to surviving lists or boards', () => {
    assert.equal(notificationHref('org', {...item, kind: 'project-deleted'}), '/workshop/org/projects')
    assert.equal(notificationHref('org', {...item, kind: 'team-deleted'}), '/workshop/org/teams')
    const url = new URL(notificationHref('org', {...item, kind: 'task-deleted'}), 'https://example.test')
    assert.equal(url.searchParams.get('todo'), 'board-1')
    assert.equal(url.searchParams.has('task'), false)
})
test('bug activity opens the report while category and portal updates open the inbox', () => {
    assert.equal(new URL(notificationHref('org', {...item, kind: 'bug-created'}), 'https://example.test').searchParams.get('report'), 'task-4')
    assert.equal(new URL(notificationHref('org', {...item, kind: 'bug-settings'}), 'https://example.test').searchParams.has('report'), false)
})
test('activity descriptions distinguish assignments, membership and lifecycle events', () => {
    assert.equal(notificationAction('task-assigned'), 'assigned you a task')
    assert.equal(notificationAction('team-member-added'), 'added a team member')
    assert.equal(notificationAction('project-created'), 'created')
    assert.equal(notificationAction('task-deleted'), 'deleted')
    assert.equal(notificationAction('project-updated'), 'updated')
})
