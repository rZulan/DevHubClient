import test from 'node:test'
import assert from 'node:assert/strict'
import {advanceSdlc, advanceSdlcRelease, normalizeSdlcDocument, sdlcPhaseDone, setSdlcPhase, setSdlcReleasePhase, startSdlcCycle, startSdlcRelease, switchSdlcModel, validSdlcDocument} from '../src/features/workshop/sdlc-document.ts'
import {sdlcModelIds, sdlcModels} from '../src/features/workshop/sdlc-models.ts'
import {emptyDocuments, validToolDocument, waterfallPhases} from '../src/features/workshop/tool-documents.ts'

const legacy = {model:'waterfall',currentPhase:2,completed:false,notes:{implementation:'Existing project work'}}
test('legacy Waterfall loads unchanged and round-trips through every model without sharing notes', () => {
    assert.equal(validToolDocument('sdlc',legacy),true)
    assert.deepEqual(emptyDocuments.sdlc,{model:'waterfall',currentPhase:0,completed:false,notes:{}})
    assert.equal(waterfallPhases[2].id,'implementation')
    let doc=legacy
    const snapshots=new Map([['waterfall',legacy]])
    for (const model of sdlcModelIds.slice(1)) {
        doc=switchSdlcModel(doc,model)
        assert.equal(doc.currentPhase,0)
        assert.deepEqual(doc.notes,{})
        doc=setSdlcPhase(doc,sdlcModels[model].phases.length-1)
        doc={...advanceSdlc(doc),notes:{[sdlcModels[model].phases[0].id]:`${model} work`}}
        snapshots.set(model,doc)
        assert.equal(validSdlcDocument(doc),true)
    }
    doc=JSON.parse(JSON.stringify(doc))
    for (const model of sdlcModelIds) {
        doc=switchSdlcModel(doc,model)
        const expected=snapshots.get(model)
        assert.equal(doc.currentPhase,expected.currentPhase)
        assert.equal(doc.completed,expected.completed)
        assert.deepEqual(doc.notes,expected.notes)
        assert.equal(validSdlcDocument(doc),true)
        assert.equal(doc.modelStates[model],undefined)
    }
    assert.deepEqual(legacy.notes,{implementation:'Existing project work'})
    assert.equal(switchSdlcModel(doc,doc.model),doc)
})

test('each model completes only at its real final phase; V Model has reciprocal validation pairs', () => {
    for (const model of sdlcModelIds) {
        let doc=switchSdlcModel(emptyDocuments.sdlc,model)
        const definition=sdlcModels[model]
        assert.equal(definition.positions.length,definition.phases.length)
        for(const phase of definition.phases.map((item,index)=>item.optional?null:index).filter(index=>index!==null)) {
            assert.equal(doc.currentPhase,phase)
            assert.equal(doc.completed,false)
            assert.equal(validSdlcDocument(doc),true)
            doc=advanceSdlc(doc)
        }
        assert.equal(doc.currentPhase,definition.phases.length-1)
        assert.equal(doc.completed,true)
        assert.equal(advanceSdlc(doc),doc)
        assert.equal(setSdlcPhase(doc,-1),doc)
        assert.equal(setSdlcPhase(doc,definition.phases.length),doc)
        assert.equal(setSdlcPhase(doc,1.5),doc)
        assert.equal(setSdlcPhase(doc,0).completed,false)
    }
    const v=sdlcModels['v-model']
    assert.equal(v.phases.length,9)
    for(const phase of v.phases.filter(phase=>phase.pair)) assert.equal(v.phases.find(item=>item.id===phase.pair).pair,phase.id)
    assert.equal(v.phases[4].id,'implementation')
    assert.equal(v.loop,undefined)
})

test('repeating models archive all cycle notes and keep their history when switching away', () => {
    for(const model of ['agile','iterative']) {
        let doc=switchSdlcModel(legacy,model)
        assert.equal(startSdlcCycle(doc),doc)
        const first=sdlcModels[model].phases[0].id
        doc={...doc,notes:{[first]:'First cycle'}}
        doc=advanceSdlc(setSdlcPhase(doc,sdlcModels[model].phases.length-1))
        const finished=doc
        doc=startSdlcCycle(doc)
        assert.equal(doc.cycle,2)
        assert.deepEqual(doc.notes,{})
        assert.deepEqual(doc.history,[{cycle:1,notes:{[first]:'First cycle'},...(model==='agile'?{released:false}:{})}])
        assert.equal(finished.cycle,undefined)
        doc={...doc,notes:{[first]:'Second cycle'}}
        doc=switchSdlcModel(switchSdlcModel(doc,'waterfall'),model)
        assert.equal(doc.cycle,2)
        assert.equal(doc.notes[first],'Second cycle')
        assert.equal(doc.history[0].notes[first],'First cycle')
        doc=advanceSdlc(setSdlcPhase(doc,sdlcModels[model].phases.length-1))
        doc=startSdlcCycle(doc)
        assert.equal(doc.cycle,3)
        assert.deepEqual(doc.history.map(entry=>entry.cycle),[1,2])
        assert.equal(validSdlcDocument(doc),true)
    }
    assert.equal(startSdlcCycle(advanceSdlc(setSdlcPhase(legacy,5))).cycle,undefined)
})

test('validation rejects invalid active, inactive and historical data', () => {
    const valid={model:'agile',currentPhase:6,completed:true,notes:{review:'Learned'},cycle:2,history:[{cycle:1,notes:{backlog:'First'}}],modelStates:{waterfall:legacy}}
    assert.equal(validSdlcDocument(valid),true)
    for(const bad of [
        {...legacy,model:'unknown'}, {...legacy,currentPhase:6}, {...legacy,completed:true}, {...legacy,currentPhase:{}},
        {...legacy,notes:{invalid:'Unknown phase'}}, {...legacy,notes:{implementation:'x'.repeat(10001)}},
        {...valid,currentPhase:8}, {...valid,history:undefined}, {...valid,history:[{cycle:2,notes:{}}]},
        {...valid,history:[{cycle:1,notes:{maintenance:'Wrong model'}}]}, {...valid,cycle:2.5},
        {...valid,modelStates:{waterfall:{...legacy,currentPhase:7}}}, {...valid,modelStates:{agile:valid}},
        {...valid,modelStates:{unknown:legacy}}, {...valid,modelStates:[]}, {...legacy,history:[]},
    ]) assert.equal(validToolDocument('sdlc',bad),false)
})

test('Scrum can finish a Sprint without a release and keeps Review and Retrospective separate', () => {
    let doc={model:'agile',currentPhase:4,completed:false,notes:{test:'Definition of Done met'},released:false}
    doc=advanceSdlc(doc)
    assert.equal(sdlcModels.agile.phases[doc.currentPhase].id,'review')
    assert.equal(doc.completed,false)
    assert.equal(sdlcPhaseDone(doc,5),false)
    doc=advanceSdlc(doc)
    assert.equal(sdlcModels.agile.phases[doc.currentPhase].id,'retrospective')
    assert.equal(doc.completed,false)
    doc={...doc,notes:{...doc.notes,review:'Stakeholder feedback',retrospective:'Improve CI'}}
    doc=advanceSdlc(doc)
    assert.equal(doc.completed,true)
    assert.equal(sdlcPhaseDone(doc,5),false)
    const next=startSdlcCycle(doc)
    assert.equal(next.cycle,2)
    assert.equal(next.currentPhase,1)
    assert.equal(sdlcPhaseDone(next,0),false)
    assert.equal(next.history[0].released,false)
    assert.equal(next.history[0].notes.retrospective,'Improve CI')
    assert.equal(next.released,false)
    assert.equal(validSdlcDocument(next),true)
})

test('recording an optional release does not complete the Sprint or skip feedback events', () => {
    let doc={model:'agile',currentPhase:4,completed:false,notes:{},released:false}
    doc=advanceSdlc(setSdlcPhase(doc,5))
    assert.equal(doc.currentPhase,6)
    assert.equal(doc.completed,false)
    assert.equal(doc.released,true)
    assert.equal(sdlcPhaseDone(doc,5),true)
    assert.equal(validSdlcDocument(doc),true)
    const rework=setSdlcPhase({...doc,notes:{test:'Failure details',release:'Version shipped'}},3)
    assert.equal(rework.notes.test,'Failure details')
    assert.equal(sdlcPhaseDone(rework,4),false)
    assert.equal(rework.released,true)
    assert.equal(validSdlcDocument(rework),true)
})

test('legacy combined Review and Retrospective completion migrates without losing notes or history', () => {
    const old={model:'agile',currentPhase:6,completed:true,notes:{review:'Review and retrospective notes'},cycle:2,history:[{cycle:1,notes:{review:'Earlier findings'}}]}
    assert.equal(validSdlcDocument(old),true)
    const upgraded=normalizeSdlcDocument(old)
    assert.equal(upgraded.currentPhase,7)
    assert.equal(upgraded.completed,true)
    assert.equal(upgraded.released,true)
    assert.deepEqual(upgraded.notes,old.notes)
    assert.deepEqual(upgraded.history,old.history)
    assert.equal(validSdlcDocument(upgraded),true)
    assert.equal(normalizeSdlcDocument(upgraded),upgraded)
    const inactive=normalizeSdlcDocument({...legacy,modelStates:{agile:old}})
    assert.equal(inactive.modelStates.agile.currentPhase,7)
    assert.deepEqual(inactive.modelStates.agile.notes,old.notes)
    assert.equal(validSdlcDocument(inactive),true)
    assert.equal(normalizeSdlcDocument({...old,completed:false}).currentPhase,6)
    for(const bad of [{...old,released:false},{...old,released:'yes'},{...legacy,released:false},{...old,currentPhase:7,history:[{cycle:1,notes:{},released:'no'}]}]) assert.equal(validSdlcDocument(bad),false)
})

test('Iterative requires evaluation before choosing another iteration or release', () => {
    const testing={model:'iterative',currentPhase:4,completed:false,notes:{test:'Regression tests passed'}}
    assert.equal(startSdlcRelease(testing),testing)
    assert.equal(startSdlcCycle(testing),testing)
    const evaluating=advanceSdlc(testing)
    assert.equal(evaluating.currentPhase,5)
    assert.equal(evaluating.completed,false)
    assert.equal(startSdlcRelease(evaluating),evaluating)
    const reviewed=advanceSdlc({...evaluating,notes:{...evaluating.notes,evaluate:'Stakeholders approved'}})
    const repeat=startSdlcCycle(reviewed)
    assert.equal(repeat.cycle,2)
    assert.equal(repeat.currentPhase,0)
    assert.equal(repeat.release,undefined)
    assert.deepEqual(repeat.history[0].notes,reviewed.notes)
    const release=startSdlcRelease(reviewed)
    assert.equal(release.cycle,undefined)
    assert.equal(release.history,undefined)
    assert.deepEqual(release.notes,reviewed.notes)
    assert.deepEqual(release.release,{currentPhase:0,completed:false,notes:{}})
    assert.equal(startSdlcRelease(release),release)
    assert.equal(setSdlcPhase(release,0),release)
    assert.equal(startSdlcCycle(release),release)
    assert.equal(validSdlcDocument(release),true)
    assert.equal(startSdlcRelease(legacy),legacy)
})

test('release milestones, notes and completed release history survive reloads and model switches', () => {
    let doc=startSdlcRelease({model:'iterative',currentPhase:5,completed:true,notes:{evaluate:'Ready for users'}})
    doc={...doc,release:{...doc.release,notes:{deployment:'Version 1 shipped'}}}
    doc=advanceSdlcRelease(doc)
    assert.equal(doc.release.currentPhase,1)
    assert.equal(doc.release.completed,false)
    assert.equal(startSdlcCycle(doc),doc)
    doc={...doc,release:{...doc.release,notes:{...doc.release.notes,maintenance:'Monitor error rates'}}}
    doc=advanceSdlcRelease(doc)
    assert.equal(doc.release.completed,true)
    assert.equal(advanceSdlcRelease(doc),doc)
    assert.equal(setSdlcReleasePhase(doc,-1),doc)
    assert.equal(setSdlcReleasePhase(doc,2),doc)
    assert.equal(setSdlcReleasePhase(doc,.5),doc)
    assert.equal(setSdlcReleasePhase(doc,0).release.completed,false)
    const restored=switchSdlcModel(JSON.parse(JSON.stringify(switchSdlcModel(doc,'waterfall'))),'iterative')
    assert.deepEqual(restored.release,doc.release)
    assert.equal(validSdlcDocument(restored),true)
    const next=startSdlcCycle(restored)
    assert.equal(next.cycle,2)
    assert.equal(next.release,undefined)
    assert.deepEqual(next.notes,{})
    assert.deepEqual(next.history[0],{cycle:1,notes:doc.notes,release:doc.release})
    assert.equal(validSdlcDocument(JSON.parse(JSON.stringify(next))),true)
})

test('validation rejects premature or malformed release paths in active, inactive and archived state', () => {
    const release={currentPhase:1,completed:true,notes:{deployment:'Shipped',maintenance:'Monitoring'}}
    const doc={model:'iterative',currentPhase:5,completed:true,notes:{evaluate:'Approved'},release}
    assert.equal(validToolDocument('sdlc',doc),true)
    const archived={...doc,release:undefined,cycle:2,history:[{cycle:1,notes:{},release}]}
    assert.equal(validToolDocument('sdlc',archived),true)
    for(const bad of [
        {...doc,completed:false}, {...doc,release:null}, {...doc,release:{...release,currentPhase:2}},
        {...doc,release:{...release,currentPhase:0}}, {...doc,release:{...release,currentPhase:1.5}},
        {...doc,release:{...release,notes:{build:'Wrong path'}}}, {...doc,release:{...release,notes:{deployment:'x'.repeat(10001)}}},
        {...legacy,release}, {...doc,model:'agile',currentPhase:6},
        {...archived,history:[{cycle:1,notes:{},release:{...release,completed:false}}]},
        {...archived,history:[{cycle:1,notes:{},release:{...release,currentPhase:'1'}}]},
        {...legacy,modelStates:{iterative:{...doc,release:{...release,currentPhase:2}}}},
    ]) assert.equal(validToolDocument('sdlc',bad),false)
})
