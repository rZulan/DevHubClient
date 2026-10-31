import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeToolPreferences, moveTool, reorderTool, projectToolIds, projectNavigationCategories} from '../src/features/workshop/project-tools.ts'
import {newField, removeField, removeTable, erdSql, designSvg} from '../src/features/workshop/tool-documents.ts'

test('preferences retain customized order, deduplicate and exclude archived tools', () => {
    assert.deepEqual(normalizeToolPreferences({order: ['todo', 'todo', 'unknown', 'ideation'], hidden: ['todo', 'unknown', 'ideation']}), {order: [...projectToolIds], hidden: ['todo']})
    const preferences = normalizeToolPreferences(null)
    assert.equal(moveTool(preferences, 'todo', -1), preferences)
    assert.deepEqual(moveTool(preferences, 'erd', -1).order, ['todo', 'erd', 'notes', 'ui-editor', 'sdlc', 'state-machine', 'calendar', 'bug-reports', 'project-wiki'])
})
test('drag arrangement moves tools across the list while preserving visibility and rejecting invalid drops', () => {
    const original = {...normalizeToolPreferences(null), hidden: ['todo']}
    const last = reorderTool(original, 'todo', 5)
    assert.deepEqual(last.order, ['notes', 'erd', 'ui-editor', 'sdlc', 'state-machine', 'todo', 'calendar', 'bug-reports', 'project-wiki'])
    assert.deepEqual(last.hidden, ['todo'])
    assert.deepEqual(reorderTool(last, 'sdlc', 0).order, ['sdlc', 'notes', 'erd', 'ui-editor', 'state-machine', 'todo', 'calendar', 'bug-reports', 'project-wiki'])
    assert.equal(reorderTool(original, 'erd', -1), original)
    assert.equal(reorderTool(original, 'erd', projectToolIds.length), original)
    assert.equal(reorderTool(original, 'erd', 1.5), original)
    assert.equal(reorderTool(original, 'erd', 2), original)
    assert.deepEqual(original.order, normalizeToolPreferences(null).order)
})
test('categories migrate legacy visibility and order without moving pages across groups', () => {
    const legacy = {order: ['notes', 'sdlc', 'todo', 'erd', 'state-machine'], hidden: ['todo', 'notes']}
    const planning = normalizeToolPreferences(legacy, projectNavigationCategories[0].tools)
    const knowledge = normalizeToolPreferences(legacy, projectNavigationCategories[2].tools)
    assert.deepEqual(planning, {order: ['sdlc', 'todo', 'calendar', 'bug-reports'], hidden: ['todo']})
    assert.deepEqual(knowledge, {order: ['notes', 'project-wiki'], hidden: ['notes']})
    assert.deepEqual(normalizeToolPreferences(null, projectNavigationCategories[0].tools).order, ['todo', 'calendar', 'bug-reports', 'sdlc'])
    const paths = projectNavigationCategories.flatMap(group => group.tools)
    assert.equal(new Set(paths).size, paths.length)
    assert.deepEqual([...paths].sort(), [...projectToolIds].sort())
})
const parent = {id: 'parent', name: 'users', x: 0, y: 0, fields: [{...newField(), id: 'pk'}]}
const child = {id: 'child', name: 'orders', x: 400, y: 0, fields: [{...newField('user_id'), id: 'fk', type: 'UUID', length: ''}]}
const relationship = {id: 'relation', fromTable: 'parent', fromField: 'pk', toTable: 'child', toField: 'fk', cardinality: '1:N', onDelete: 'CASCADE'}
const document = {tables: [parent, child], relationships: [relationship]}
test('deleting a table or column removes its dangling relationships', () => {
    assert.equal(removeField(document, 'parent', 'pk').relationships.length, 0)
    assert.equal(removeTable(document, 'child').relationships.length, 0)
    assert.equal(document.relationships.length, 1)
})
test('SQL creates tables before constraints and escapes identifiers', () => {
    const sql = erdSql(document)
    assert.match(sql, /PRIMARY KEY \("id"\)/)
    assert.match(sql, /ALTER TABLE "orders" ADD FOREIGN KEY \("user_id"\) REFERENCES "users" \("id"\) ON DELETE CASCADE/)
    assert.ok(sql.indexOf('CREATE TABLE "orders"') < sql.indexOf('ALTER TABLE'))
    assert.match(erdSql({tables: [{...parent, name: 'a"b'}], relationships: []}), /CREATE TABLE "a""b"/)
    assert.throws(() => erdSql({...document, relationships: [{...relationship, cardinality: 'N:M'}]}), /junction table/)
})
test('SVG skips hidden frames and children, and escapes text markup', () => {
    const layer = {id: 'text', kind: 'text', x: 10, y: 20, width: 100, height: 60, radius: 0, fill: '#ffffff', stroke: '#000000', strokeWidth: 0, opacity: 1, textColor: '#000000', fontSize: 16, text: '<script>&', hidden: false}
    assert.match(designSvg({layers: [layer]}), /&lt;script&gt;&amp;/)
    const svg = designSvg({layers: [{...layer, id: 'frame', kind: 'frame', hidden: true}, {...layer, parentId: 'frame'}]})
    assert.doesNotMatch(svg, /<g /)
})
