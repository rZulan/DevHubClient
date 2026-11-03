import test from 'node:test'
import assert from 'node:assert/strict'
import {runErdPngWorker} from '../src/features/workshop/erd-png-worker-client.ts'
import {erdPathWithGaps} from '../src/features/workshop/erd-canvas-export.ts'

const fakeWorker=()=>({terminated:0,sent:[],postMessage(value){this.sent.push(value)},terminate(){this.terminated++}})
test('cancellation immediately terminates background work, including during preparation',async()=>{
    const worker=fakeWorker(),controller=new AbortController()
    const pending=runErdPngWorker({document:{tables:[],relationships:[]}}, {signal:controller.signal},()=>worker)
    controller.abort()
    await assert.rejects(pending,{name:'AbortError'})
    assert.equal(worker.terminated,1)
    let started=false
    await assert.rejects(runErdPngWorker({}, {signal:controller.signal},()=>{started=true;return worker}),{name:'AbortError'})
    assert.equal(started,false)
})
test('worker progress, completion, and errors release the worker',async()=>{
    const worker=fakeWorker(),progress=[],controller=new AbortController(),blob=new Blob(['png'])
    const pending=runErdPngWorker({}, {signal:controller.signal,onProgress:value=>progress.push(value)},()=>worker)
    worker.onmessage({data:{type:'progress',percent:45}})
    worker.onmessage({data:{type:'done',blob,width:40001,height:20000}})
    assert.deepEqual(await pending,{blob,width:40001,height:20000})
    assert.deepEqual(progress,[45]);assert.equal(worker.terminated,1)
    controller.abort();assert.equal(worker.terminated,1)
    const failure=fakeWorker(),failed=runErdPngWorker({}, {},()=>failure)
    failure.onmessage({data:{type:'error',message:'render failed'}})
    await assert.rejects(failed,/render failed/);assert.equal(failure.terminated,1)
    const crash=fakeWorker(),crashed=runErdPngWorker({}, {},()=>crash)
    crash.onerror();await assert.rejects(crashed,/Please retry/);assert.equal(crash.terminated,1)
})
test('crossing gaps split only the affected line and merge overlapping gaps',()=>{
    assert.equal(erdPathWithGaps('M0 0 L100 0 L100 100',[{x:50,y:0}]),'M0 0 L45 0 M55 0 L100 0 L100 100')
    assert.equal(erdPathWithGaps('M0 0 L100 0',[{x:50,y:0},{x:52,y:0}]),'M0 0 L45 0 M57 0 L100 0')
    assert.equal(erdPathWithGaps('M100 0 L0 0',[{x:50,y:0}]),'M100 0 L55 0 M45 0 L0 0')
    assert.equal(erdPathWithGaps('M0 0 L0 100',[{x:0,y:50}]),'M0 0 L0 45 M0 55 L0 100')
    assert.equal(erdPathWithGaps('M0 0 L100 0',[{x:50,y:20}]),'M0 0 L100 0')
})
