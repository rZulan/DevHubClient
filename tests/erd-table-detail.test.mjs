import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {renderToStaticMarkup} from 'react-dom/server'
import {createElement} from 'react'
import {isErdTableOverview} from '../src/features/workshop/erd-table-detail.ts'

test('unreadable columns simplify below 50 percent; selected and readable tables retain details', () => {
    for(const zoom of [.01,.1,.3,.499]) {
        assert.equal(isErdTableOverview(zoom,false),true)
        assert.equal(isErdTableOverview(zoom,true),false)
    }
    for(const zoom of [.5,.85,1,2]) assert.equal(isErdTableOverview(zoom,false),false)
})

const require=createRequire(import.meta.url), exports={}
const source=ts.transpileModule(readFileSync(new URL('../src/features/workshop/erd-table-overview.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText
vm.runInNewContext(source,{exports,require})

test('overview markup stays constant for large tables while retaining their name and column count', () => {
    const render=count=>renderToStaticMarkup(createElement(exports.ErdTableOverview,{table:{name:'orders',fields:Array.from({length:count},(_,i)=>({name:`column_${i}`}))}}))
    const small=render(2),large=render(200)
    assert.equal((large.match(/<[a-z]/g)??[]).length,(small.match(/<[a-z]/g)??[]).length)
    assert.match(large,/orders, 200 columns/)
    assert.match(large,/erd-column-skeleton/)
    assert.doesNotMatch(large,/column_199|erd-field-row|<input|<button/)
})
