import test from 'node:test'
import assert from 'node:assert/strict'
import {sdlcLinks,sdlcQuality,sdlcRework} from '../src/features/workshop/sdlc-flow.ts'
import {sdlcModels} from '../src/features/workshop/sdlc-models.ts'
import {advanceSdlc,setSdlcPhase} from '../src/features/workshop/sdlc-document.ts'

test('V links pair development artifacts with the corresponding executable test levels',()=>{
    const links=sdlcLinks('v-model')
    assert.deepEqual(links.filter(l=>l.kind==='validation').map(l=>[l.from,l.to]),[[0,8],[1,7],[2,6],[3,5]])
    assert.deepEqual(links.filter(l=>l.kind==='flow').map(l=>[l.from,l.to]),[[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]])
    for(const phase of sdlcModels['v-model'].phases.slice(0,4)) assert.match(sdlcQuality('v-model',phase),/prepare.*after implementation/)
    for(const phase of sdlcModels['v-model'].phases.slice(5)) assert.match(sdlcQuality('v-model',phase),/^Execute/)
    for(const index of [5,6,7,8]) assert.equal(sdlcRework('v-model',index),4)
})

test('Scrum has a direct Done-to-Review path, an optional release branch and a new Sprint loop',()=>{
    const links=sdlcLinks('agile')
    assert(links.some(l=>l.from===4&&l.to===6&&l.kind==='flow'))
    assert(links.some(l=>l.from===4&&l.to===5&&l.kind==='optional'))
    assert(links.some(l=>l.from===5&&l.to===6&&l.kind==='optional'))
    assert(links.some(l=>l.from===6&&l.to===7&&l.kind==='flow'))
    assert(links.some(l=>l.from===7&&l.to===1&&l.kind==='cycle'))
    assert(links.some(l=>l.from===7&&l.to===0&&l.kind==='feedback'))
    assert(links.some(l=>l.from===4&&l.to===2&&l.kind==='feedback'))
    assert.equal(sdlcRework('agile',4),3)
})

test('Waterfall and V rework retain evidence and require later stages to be revisited',()=>{
    for(const [model,currentPhase] of [['waterfall',3],['v-model',7]]) {
        const document={model,currentPhase,completed:false,notes:{[sdlcModels[model].phases[currentPhase].id]:'Failing test evidence'}}
        const rework=setSdlcPhase(document,sdlcRework(model,currentPhase))
        assert(rework.currentPhase<currentPhase)
        assert.deepEqual(rework.notes,document.notes)
        assert.equal(rework.completed,false)
        assert.equal(advanceSdlc(rework).currentPhase,rework.currentPhase+1)
    }
})

test('all 2D links refer to real phases and the Iterative model keeps its 3D cycle',()=>{
    for(const model of ['waterfall','v-model','agile','iterative']) {
        for(const link of sdlcLinks(model)) {
            assert(sdlcModels[model].phases[link.from])
            assert(sdlcModels[model].phases[link.to])
            assert(!/NaN|undefined/.test(link.path))
        }
        assert(sdlcModels[model].sources.every(source=>source.url.startsWith('https://')))
    }
    assert.deepEqual(sdlcLinks('iterative'),[])
})
