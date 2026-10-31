import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
import {createElement as h, Fragment} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

const require = createRequire(import.meta.url), exports = {}
const source = ts.transpileModule(readFileSync(new URL('../src/features/workshop/workshop-select.tsx', import.meta.url), 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX},
}).outputText
vm.runInNewContext(source, {exports, require})
const render = (props, children) => renderToStaticMarkup(h(exports.WorkshopSelect, props, children))

test('empty-value options remain real choices and retain their form value', () => {
    const html = render({name:'category', value:'', 'aria-label':'Category'}, [h('option',{key:'empty',value:''},'Uncategorized'),h('option',{key:'api',value:'api'},'API')])
    assert.match(html, /type="hidden" name="category" value=""/)
    assert.match(html, /role="combobox"/)
    assert.match(html, /Uncategorized/)
    assert.doesNotMatch(html, /name="category" value="0"/)
})

test('numeric values and options inside fragments resolve to the correct label', () => {
    const html = render({value:1,'aria-label':'Phase'}, h(Fragment,null,h('option',{value:0},'Planning'),h('option',{value:1},'Implementation')))
    assert.match(html, /Implementation/)
    assert.doesNotMatch(html, />Planning</)
})

test('uncontrolled form fields preserve their actual default value rather than an option index', () => {
    const html = render({name:'status',defaultValue:'doing',id:'task-status'}, [h('option',{key:'todo',value:'todo'},'To do'),h('option',{key:'doing',value:'doing'},'In progress')])
    assert.match(html, /type="hidden" name="status" value="doing"/)
    assert.match(html, /id="task-status"/)
    assert.match(html, /In progress/)
})

test('disabled fields keep both the trigger and submitted value disabled', () => {
    const html = render({name:'status',value:'todo',disabled:true}, h('option',{value:'todo'},'To do'))
    assert.match(html, /<input(?=[^>]*type="hidden")(?=[^>]*name="status")(?=[^>]*value="todo")(?=[^>]*disabled="")[^>]*>/)
    assert.match(html, /<button[^>]*disabled=""/)
})
