import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const source=ts.transpileModule(fs.readFileSync(new URL('../src/features/workshop/todo-api.ts',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText
const exports={}
const api={enhanceEndpoints(){return this},injectEndpoints(definition){return {endpoints:definition.endpoints({query:x=>x,mutation:x=>x,infiniteQuery:x=>x})}}}
vm.runInNewContext(source,{exports,require:name=>{if(name==='@/services/api')return {api};throw Error(name)}})
const list=exports.todoApi.endpoints.listTodos.queryFn
test('calendar fetches bounded TODO pages without silently dropping later boards',async()=>{
    const requests=[]
    const result=await list({organizationId:'org',projectId:'project'},null,null,async url=>{
        requests.push(url)
        return {data:{items:[{id:requests.length}],hasMore:requests.length<3}}
    })
    assert.deepEqual(Array.from(result.data,item=>item.id),[1,2,3])
    assert.equal(requests.length,3)
    assert.ok(requests.every((url,index)=>url.endsWith(`/pages?page=${index}&pageSize=50`)))
})
test('a failed later page reports the failure instead of treating partial calendar data as complete',async()=>{
    let calls=0
    const result=await list({organizationId:'org',projectId:'project'},null,null,async()=>++calls===1
        ? {data:{items:[{id:'one'}],hasMore:true}} : {error:{status:429,data:{detail:'Wait'}}})
    assert.equal(result.error.status,429)
    assert.equal(result.data,undefined)
})
