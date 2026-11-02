import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'
import {readGitHubSelections} from '../src/features/workshop/github-repository-selection.ts'
const require = createRequire(import.meta.url)

function field(initial = []) {
    const values = []
    let cursor = 0
    const react = {useState(value) {
        const index = cursor++
        if (!(index in values)) values[index] = value
        return [values[index], next => {values[index] = typeof next === 'function' ? next(values[index]) : next}]
    }}
    const module = {exports: {}}
    const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/github-repositories-field.tsx', import.meta.url), 'utf8'), {
        compilerOptions: {module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022},
    }).outputText
    vm.runInNewContext(source, {module, exports: module.exports, require: name => name === 'react' ? react : name === 'react/jsx-runtime' ? require(name) : new Proxy({}, {get: (_, key) => key})})
    function walk(node, items = []) {
        if (Array.isArray(node)) node.forEach(child => walk(child, items))
        else if (node?.props) {items.push(node); walk(node.props.children, items)}
        return items
    }
    const all = () => {cursor = 0; return walk(module.exports.GitHubRepositoriesField({initial}))}
    const selections = () => readGitHubSelections(all().find(node => node.props.name === 'githubRepositories').props.value)
    const open = () => all().find(node => node.props.children?.[1] === 'Add repositories' || node.props.children === 'Add repositories')?.props.onClick()
    const add = repo => {const picker = all().find(node => node.props.onAdd); assert.ok(picker, 'picker is open'); picker.props.onAdd(repo)}
    return {all, selections, open, add}
}
const repo = (id, name = `repo-${id}`) => ({repositoryId: id, installationId: 100, label: name, fullName: `owner/${name}`, url: `https://github.com/owner/${name}`, defaultBranch: 'main', private: false})

test('create picker selects multiple repositories, edits labels, and serializes only identifiers and labels', () => {
    const f = field()
    assert.deepEqual(f.selections(), [])
    f.open(); f.add(repo(1, 'frontend')); f.add(repo(2, 'backend')); f.add(repo(1, 'frontend'))
    assert.equal(f.selections().length, 2)
    f.all().find(node => node.props['aria-label'] === 'Label for owner/frontend').props.onChange({target: {value: 'Frontend'}})
    f.all().find(node => node.props['aria-label'] === 'Label for owner/backend').props.onChange({target: {value: 'Backend'}})
    assert.deepEqual(f.selections(), [
        {installationId: 100, repositoryId: 1, label: 'Frontend'}, {installationId: 100, repositoryId: 2, label: 'Backend'},
    ])
})

test('edit picker retains existing labels and removes one repository without changing the others', () => {
    const f = field([repo(1, 'Frontend'), repo(2, 'Backend')])
    f.all().find(node => node.props['aria-label'] === 'Remove owner/Frontend').props.onClick()
    assert.deepEqual(f.selections(), [{installationId: 100, repositoryId: 2, label: 'Backend'}])
})

test('picker does not add more than ten repositories', () => {
    const f = field(); f.open()
    for (let id = 1; id <= 11; id++) f.add(repo(id))
    assert.equal(f.selections().length, 10)
})
