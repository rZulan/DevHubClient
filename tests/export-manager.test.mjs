import test from 'node:test'
import assert from 'node:assert/strict'
import {createExportManager} from '../src/features/exports/export-manager.ts'

function deferred() {let resolve,reject;const promise=new Promise((done,fail)=>{resolve=done;reject=fail});return{promise,resolve,reject}}
test('jobs survive subscriber/page changes, retain progress and serialize exports',async()=>{
    const manager=createExportManager(),first=deferred(),second=deferred(),contexts=[]
    const unsubscribe=manager.subscribe(()=>{})
    const a=manager.run({key:'erd:a',label:'ERD',detail:'Alpha'},async context=>{contexts.push(context);await first.promise})
    const b=manager.run({key:'erd:b',label:'ERD',detail:'Beta'},async context=>{contexts.push(context);await second.promise})
    assert.equal(manager.run({key:'erd:a',label:'Duplicate'},async()=>{throw Error('duplicate ran')}),a)
    assert.deepEqual(manager.getSnapshot().map(job=>job.status),['queued','queued'])
    await Promise.resolve()
    contexts[0].onProgress(45)
    unsubscribe() // The originating page navigates away.
    assert.equal(contexts[0].signal.aborted,false)
    assert.deepEqual(manager.getSnapshot().map(job=>[job.status,job.progress]),[['running',45],['queued',0]])
    contexts[0].onProgress(10);contexts[0].onProgress(NaN)
    assert.equal(manager.getSnapshot()[0].progress,45)
    first.resolve();await a
    assert.equal(contexts.length,2)
    assert.equal(manager.getSnapshot()[0].detail,'Beta')
    second.resolve();await b
    assert.deepEqual(manager.getSnapshot(),[])
})
test('cancel queued and active jobs without starting the queued work or blocking later exports',async()=>{
    const manager=createExportManager(),block=deferred();let queuedRan=false,signal
    const active=manager.run({key:'active',label:'Active'},async context=>{signal=context.signal;await new Promise((resolve,reject)=>context.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))})
    const queued=manager.run({key:'queued',label:'Queued'},async()=>{queuedRan=true})
    await Promise.resolve()
    manager.cancel(manager.getSnapshot().find(job=>job.key==='queued').id)
    await assert.rejects(queued,{name:'AbortError'})
    assert.equal(queuedRan,false)
    manager.cancel(manager.getSnapshot()[0].id)
    await assert.rejects(active,{name:'AbortError'});assert.equal(signal.aborted,true)
    const next=manager.run({label:'Next'},()=>block.promise)
    await Promise.resolve();assert.equal(manager.getSnapshot()[0].status,'running')
    block.resolve();await next
    assert.deepEqual(manager.getSnapshot(),[])
})
test('failures remain dismissible, queue continues, and clearing stops active jobs',async()=>{
    const manager=createExportManager()
    const failure=manager.run({label:'Failed export'},async()=>{throw Error('No image available')})
    const success=manager.run({label:'Successful export'},async({onProgress})=>{onProgress(100)})
    await assert.rejects(failure,/No image available/);await success
    assert.deepEqual(manager.getSnapshot().map(job=>[job.status,job.error]),[['error','No image available']])
    manager.dismiss(manager.getSnapshot()[0].id)
    let signal
    const active=manager.run({label:'To clear'},async context=>{signal=context.signal;await new Promise((resolve,reject)=>context.signal.addEventListener('abort',()=>reject(Error('stop')),{once:true}))})
    await Promise.resolve();manager.clear();await assert.rejects(active,{name:'AbortError'})
    assert.equal(signal.aborted,true);assert.deepEqual(manager.getSnapshot(),[])
})
