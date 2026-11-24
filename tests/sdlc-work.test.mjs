import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceSdlc, advanceSdlcRelease, setSdlcPhase, startSdlcCycle, startSdlcRelease, switchSdlcModel, updateSdlcNote, updateSdlcWork, validSdlcDate, validSdlcDocument} from '../src/features/workshop/sdlc-document.ts'
import {sdlcModels} from '../src/features/workshop/sdlc-models.ts'
import {sdlcAssignees, sdlcCompletion, sdlcDeliverableDate, sdlcMarkdown, sdlcOverdue, sdlcPhaseState, sdlcReadiness, sdlcStoredModels} from '../src/features/workshop/sdlc-work.ts'

const empty = () => ({model:'waterfall', currentPhase:0, completed:false, notes:{}})
test('phase work is optional for old roadmaps and isolated between models', () => {
    const legacy = empty(), doc = updateSdlcWork(legacy, 'waterfall', 'requirements', {ownerId:'member',targetDate:'2026-11-01',checked:['Requirements specification']})
    assert.ok(validSdlcDocument(legacy)); assert.ok(validSdlcDocument(doc))
    assert.equal(legacy.work, undefined)
    const v = switchSdlcModel(doc, 'v-model'); assert.equal(v.work, undefined)
    assert.deepEqual(switchSdlcModel(v, 'waterfall').work, doc.work)
    assert.deepEqual(sdlcStoredModels(v), ['waterfall','v-model'])
})
test('phase work updates cannot leak into another model, an unknown phase, or completed iteration work during release', () => {
    const doc = empty()
    assert.equal(updateSdlcWork(doc, 'agile', 'requirements', {blocked:true}), doc)
    assert.equal(updateSdlcWork(doc, 'waterfall', 'missing', {blocked:true}), doc)
    assert.equal(updateSdlcWork(doc, 'waterfall', 'requirements', {ownerId:''}), doc)
    const releasing = startSdlcRelease({...switchSdlcModel(doc,'iterative'),currentPhase:5,completed:true})
    assert.equal(updateSdlcWork(releasing,'iterative','build',{blocked:true}), releasing)
    assert.equal(updateSdlcNote(releasing,'iterative','build','late note'), releasing)
})
test('unchanged work and notes do not create redundant undo entries', () => {
    const doc = updateSdlcWork(empty(),'waterfall','requirements',{ownerId:'member'})
    assert.equal(updateSdlcWork(doc,'waterfall','requirements',{ownerId:'member'}),doc)
    assert.equal(updateSdlcNote(doc,'waterfall','requirements',''),doc)
    const next = updateSdlcNote(doc,'waterfall','requirements','Reviewed with the team')
    assert.equal(updateSdlcNote(next,'waterfall','requirements','Reviewed with the team'),next)
    assert.equal(setSdlcPhase(doc,0),doc)
    assert.equal(updateSdlcNote(doc,'waterfall','requirements','x'.repeat(10001)),doc)
})
test('blockers stop normal completion until resolved without deleting the blocker record', () => {
    const blocked = updateSdlcWork(empty(),'waterfall','requirements',{blocked:true,blocker:'Waiting for scope approval'})
    assert.equal(advanceSdlc(blocked),blocked)
    const resolved = updateSdlcWork(blocked,'waterfall','requirements',{blocked:false})
    assert.equal(advanceSdlc(resolved).currentPhase,1)
    assert.equal(resolved.work.requirements.blocker,'Waiting for scope approval')
})
test('starting a Sprint archives ownership, dates and checks and starts the next cycle cleanly', () => {
    let doc = switchSdlcModel(empty(),'agile')
    doc = updateSdlcWork(doc,'agile','planning',{ownerId:'member',checked:['Sprint Goal'],targetDate:'2027-01-10',deliverableTargetDates:{'Sprint Goal':'2027-01-08'}})
    doc = advanceSdlc(setSdlcPhase(doc,7))
    const next = startSdlcCycle(doc)
    assert.equal(next.work,undefined); assert.deepEqual(next.history[0].work,doc.work)
    assert.notEqual(next.history[0].work,doc.work)
    doc.work.planning.checked.push('Changed afterwards')
    doc.work.planning.deliverableTargetDates['Sprint Goal'] = '2027-01-09'
    assert.deepEqual(next.history[0].work.planning.checked,['Sprint Goal'])
    assert.equal(next.history[0].work.planning.deliverableTargetDates['Sprint Goal'],'2027-01-08')
    assert.ok(validSdlcDocument(next))
})
test('release work is independent, respects blockers, and survives archive and model switches', () => {
    let doc = startSdlcRelease({...switchSdlcModel(empty(),'iterative'),currentPhase:5,completed:true})
    doc = updateSdlcWork(doc,'iterative','deployment',{blocked:true,blocker:'Release window'},true)
    assert.equal(advanceSdlcRelease(doc),doc)
    doc = updateSdlcWork(doc,'iterative','deployment',{blocked:false,targetDate:'2026-11-02'},true)
    doc = updateSdlcNote(doc,'iterative','deployment','Shipped and monitored',true)
    doc = advanceSdlcRelease(advanceSdlcRelease(doc))
    const next = startSdlcCycle(doc)
    assert.deepEqual(next.history[0].release.work,doc.release.work)
    assert.equal(next.release,undefined)
    assert.equal(switchSdlcModel(switchSdlcModel(next,'waterfall'),'iterative').history[0].release.notes.deployment,'Shipped and monitored')
    assert.ok(validSdlcDocument(next))
})
test('dates are real ISO calendar dates, including leap-year rules', () => {
    for (const date of ['2026-10-25','2028-02-29','1900-01-01']) assert.ok(validSdlcDate(date),date)
    for (const date of ['2026-02-29','2026-13-01','2026-04-31','2026-1-01','1899-12-31','',null,'tomorrow']) assert.equal(validSdlcDate(date),false,String(date))
})
test('deliverable dates survive serialization and are removed with their deliverable', () => {
    const phase = 'requirements'
    const doc = updateSdlcWork(empty(), 'waterfall', phase, {
        targetDate: '2027-01-10',
        deliverableTargetDates: {'Requirements specification': '2026-12-15'},
    })
    const reloaded = JSON.parse(JSON.stringify(doc))
    assert.ok(validSdlcDocument(reloaded))
    assert.equal(sdlcDeliverableDate(reloaded.work[phase], 'Requirements specification'), '2026-12-15')
    assert.equal(sdlcDeliverableDate(reloaded.work[phase], 'constructor'), undefined)
    assert.match(sdlcMarkdown(reloaded, 'Demo'), /Requirements specification \(target 2026-12-15\)/)
    assert.equal(updateSdlcWork(doc, 'waterfall', phase, {deliverableTargetDates: {'Requirements specification': '2026-02-29'}}), doc)
    assert.equal(updateSdlcWork(doc, 'waterfall', phase, {deliverables: ['stakeholder approval']}).work[phase].deliverableTargetDates, undefined)
})
test('initialized roadmaps retain their identity and allow writes only to their selected model', () => {
    const doc = {...empty(), roadmapId: 'd23145a7-cb7a-4c4e-b8aa-4369f62058a6', connectToTodo: true}
    assert.ok(validSdlcDocument(doc))
    assert.equal(switchSdlcModel(doc, 'iterative'), doc)
    const updated = updateSdlcWork(doc, 'waterfall', 'requirements', {targetDate: '2027-01-10'})
    assert.equal(updated.roadmapId, doc.roadmapId)
    assert.equal(updated.connectToTodo, true)
    assert.equal(validSdlcDocument({...doc, roadmapId: 'invalid'}), false)
    assert.equal(validSdlcDocument({...doc, connectToTodo: 'true'}), false)
})
test('validation covers phase work in active, inactive, archived, and release state', () => {
    const good = updateSdlcWork(empty(),'waterfall','requirements',{ownerId:'member',checked:['Requirements specification'],blocked:false})
    for (const work of [null,[],{missing:{}},{requirements:{ownerId:''}},{requirements:{targetDate:'2026-02-29'}},{requirements:{blocked:'yes'}},{requirements:{blocker:'x'.repeat(2001)}},{requirements:{checked:['same','same']}},{requirements:{checked:[{}]}}]) assert.equal(validSdlcDocument({...empty(),work}),false)
    assert.equal(validSdlcDocument({...good, modelStates:{agile:{currentPhase:0,completed:false,notes:{},work:{requirements:{}}}}}),false)
    assert.equal(validSdlcDocument({model:'agile',currentPhase:1,completed:false,notes:{},cycle:2,history:[{cycle:1,notes:{},work:{planning:{targetDate:'bad'}}}]}),false)
    assert.equal(validSdlcDocument({model:'iterative',currentPhase:5,completed:true,notes:{},release:{currentPhase:0,completed:false,notes:{},work:{build:{}}}}),false)
})
test('readiness counts visible deliverables, while attention status respects completion and ongoing activities', () => {
    const phase = sdlcModels.waterfall.phases[0], readiness = sdlcReadiness(phase,{checked:['Requirements specification','Old label'],blocked:true})
    assert.equal(readiness.done,1); assert.deepEqual(readiness.missing,['stakeholder approval']); assert.ok(readiness.blocked)
    assert.equal(sdlcPhaseState(phase,{blocked:true},false,true),'blocked')
    assert.equal(sdlcPhaseState(phase,{blocked:true},true,false),'completed')
    assert.equal(sdlcPhaseState(sdlcModels.agile.phases[0],undefined,false,false),'ongoing')
    assert.ok(sdlcOverdue({targetDate:'2026-10-24'},false,new Date(2026,9,25)))
    assert.equal(sdlcOverdue({targetDate:'2026-10-25'},false,new Date(2026,9,25)),false)
    assert.equal(sdlcOverdue({targetDate:'2026-10-24'},true,new Date(2026,9,25)),false)
})
test('custom phase lists override presets and survive model changes with the roadmap creator', () => {
    const phase = sdlcModels.waterfall.phases[0]
    const legacy = {ownerId:'original',checked:['Requirements specification']}
    assert.deepEqual(sdlcAssignees(legacy),['original'])

    const work = {...legacy,assigneeIds:['original','teammate'],deliverables:['Scope brief'],checked:['Scope brief']}
    const saved = updateSdlcWork({...empty(),creatorId:'author'},'waterfall',phase.id,work)
    const restored = switchSdlcModel(switchSdlcModel(saved,'iterative'),'waterfall')
    assert.equal(restored.creatorId,'author')
    assert.ok(validSdlcDocument(restored))
    assert.deepEqual(sdlcAssignees(restored.work[phase.id]),['original','teammate'])
    assert.deepEqual(sdlcReadiness(phase,restored.work[phase.id]).missing,[])
    assert.deepEqual(sdlcReadiness(phase,{deliverables:[]}).items,[])
    assert.deepEqual(sdlcAssignees({...legacy,assigneeIds:[]}),[])
    assert.equal(updateSdlcWork(saved,'waterfall',phase.id,{deliverables:['duplicate','duplicate']}),saved)
    assert.equal(updateSdlcWork(saved,'waterfall',phase.id,{assigneeIds:['']}),saved)
})
test('Markdown reports include model snapshots, real checklist state, names, blockers and release history', () => {
    let doc = updateSdlcWork(empty(),'waterfall','requirements',{ownerId:'member',targetDate:'2026-11-01',checked:['Requirements specification'],blocked:true,blocker:'Waiting for review'})
    doc = updateSdlcNote(doc,'waterfall','requirements','Decision notes retained.')
    doc = switchSdlcModel(doc,'iterative'); doc = {...doc,currentPhase:5,completed:true}
    doc = startSdlcRelease(doc); doc = updateSdlcNote(doc,'iterative','deployment','Release evidence',true)
    doc = startSdlcCycle(advanceSdlcRelease(advanceSdlcRelease(doc)))
    const report = sdlcMarkdown(doc,'Project [alpha]',{member:'Preview owner'})
    for (const text of ['Waterfall · Saved model','Owner: Preview owner','Target date: 2026-11-01','Blocker: Waiting for review','- [x] Requirements specification','- [ ] stakeholder approval','Decision notes retained.','Iteration 1 · Archived Iterative','Release evidence']) assert.ok(report.includes(text),text)
    assert.ok(report.includes('Project \\[alpha\\]'))
})
test('release completion follows deployment and maintenance instead of inheriting 100% iteration progress', () => {
    const iteration = {currentPhase:5,completed:true,notes:{}}
    assert.deepEqual(sdlcCompletion('iterative',iteration),{done:6,total:6,percent:100})
    assert.deepEqual(sdlcCompletion('iterative',{currentPhase:0,completed:false,notes:{}},true),{done:0,total:2,percent:0})
    assert.deepEqual(sdlcCompletion('iterative',{currentPhase:1,completed:false,notes:{}},true),{done:1,total:2,percent:50})
    assert.deepEqual(sdlcCompletion('iterative',{currentPhase:1,completed:true,notes:{}},true),{done:2,total:2,percent:100})
    assert.deepEqual(sdlcCompletion('agile',{currentPhase:7,completed:true,released:false,notes:{}}),{done:6,total:6,percent:100})
})
