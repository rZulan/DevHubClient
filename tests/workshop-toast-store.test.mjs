import test from 'node:test'
import assert from 'node:assert/strict'
import {createWorkshopToastStore} from '../src/features/workshop/workshop-toast-store.ts'

test('toast variants provide consistent titles and readable durations, with persistent actions supported',()=>{
    const store=createWorkshopToastStore()
    for(const variant of ['error','warning','success','info','tip'])store.show(variant,`${variant} message`)
    assert.deepEqual(store.getSnapshot().map(item=>item.title),['Error','Warning','Success','Information','Tip'])
    assert.ok(store.getSnapshot().every(item=>item.duration>=5000))
    const id=store.show('error','Unsaved changes',{title:'Save failed',duration:Infinity})
    const item=store.getSnapshot().find(item=>item.id===id)
    assert.equal(item.title,'Save failed');assert.equal(item.duration,Infinity)
})
test('deduplication prevents repeated mounted warnings, and updates preserve toast lifetime',()=>{
    const store=createWorkshopToastStore()
    const first=store.show('warning','Storage unavailable',{id:'page-a',dedupeKey:'storage'})
    assert.equal(store.show('warning','Storage unavailable',{id:'page-b',dedupeKey:'storage'}),first)
    assert.equal(store.getSnapshot().length,1)
    const revision=store.getSnapshot()[0].revision
    store.update(first,'Retry is now available')
    assert.equal(store.getSnapshot()[0].revision,revision)
    assert.equal(store.getSnapshot()[0].message,'Retry is now available')
    store.show('error','A different failure',{id:first})
    assert.equal(store.getSnapshot().length,1)
    assert.equal(store.getSnapshot()[0].revision,revision+1)
})
test('dismiss resets source feedback once; unmount cleanup and sign-out do not execute actions',()=>{
    const store=createWorkshopToastStore();let dismissed=0,updates=0
    const unsubscribe=store.subscribe(()=>updates++)
    const id=store.show('error','Failure',{onDismiss:()=>dismissed++})
    store.dismiss(id);store.dismiss(id)
    assert.equal(dismissed,1)
    const other=store.show('info','Contextual message',{onDismiss:()=>dismissed++})
    store.remove(other);assert.equal(dismissed,1)
    for(let i=0;i<20;i++)store.show('info',`Message ${i}`)
    assert.equal(store.getSnapshot().length,5)
    assert.equal(store.getSnapshot().at(-1).message,'Message 19')
    unsubscribe();const previous=updates;store.clear()
    assert.equal(updates,previous);assert.deepEqual(store.getSnapshot(),[])
})
