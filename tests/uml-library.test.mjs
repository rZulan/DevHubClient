import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {umlPresets,umlTypes,prioritizedUmlPresets} from '../src/features/workshop/uml-catalog.ts'
import {emptyUmlLibrary,newUmlDiagram,updateUmlDiagram,validUmlLibrary} from '../src/features/workshop/uml-library.ts'
import {decodeShapes,encodeShapes,normalizeCanvasItem} from '../src/features/workshop/shape-clipboard.ts'
import {validToolDocument} from '../src/features/workshop/tool-documents.ts'

test('all UML categories stay available and selecting a type only prioritizes its category',()=>{
    for(const type of umlTypes){const ordered=prioritizedUmlPresets(type.id);assert.equal(ordered[0].category,type.label);assert.equal(ordered.length,umlPresets.length);assert.deepEqual([...ordered.map(p=>p.id)].sort(),[...umlPresets.map(p=>p.id)].sort())}
    assert.equal(prioritizedUmlPresets(null),umlPresets)
    assert.ok(umlPresets.every(p=>p.changes.umlSymbol));assert.equal(umlPresets.some(p=>p.category==='Basic shapes'),false)
    for(const p of umlPresets){const item=normalizeCanvasItem({id:p.id,x:0,y:0,width:200,height:110,appearance:'outlined',fillColor:'#a78bfa',outlineColor:'#a78bfa',outlineWidth:2,outlineStyle:'solid',cornerRadius:0,...p.changes,kind:p.kind});assert.equal(decodeShapes(encodeShapes([item]))[0]?.umlSymbol,p.changes.umlSymbol)}
})
test('named diagrams allow optional types, isolate their canvases, and reject malformed libraries',()=>{
    const a=newUmlDiagram('  Checkout  ',null),b=newUmlDiagram('Model','class'),library={version:1,diagrams:[a,b]}
    assert.equal(a.name,'Checkout');assert.ok(validToolDocument('uml',library));assert.ok(validUmlLibrary(emptyUmlLibrary))
    const updated=updateUmlDiagram(library,a.id,{name:'Checkout v2',type:'activity'});assert.equal(updated.diagrams[1],b);assert.equal(library.diagrams[0].name,'Checkout')
    for(const mutate of [d=>d.diagrams[0].name=' ',d=>d.diagrams[0].type='invalid',d=>d.diagrams[0].updatedAt='invalid',d=>d.diagrams[1].id=d.diagrams[0].id]){const bad=structuredClone(library);mutate(bad);assert.equal(validUmlLibrary(bad),false)}
    assert.equal(updateUmlDiagram(library,'missing',{name:'No overwrite'}),library)
})
test('client and API share the same universal library fixture, including UML metadata',()=>{
    const fixture=JSON.parse(readFileSync(new URL('../../api/tests/DevHub.ProjectToolsSmoke/Fixtures/uml-library.json',import.meta.url),'utf8'))
    assert.ok(validUmlLibrary(fixture));assert.equal(fixture.diagrams[1].type,null)
    const bad=structuredClone(fixture);delete bad.diagrams[0].items[0].umlSymbol;assert.equal(validUmlLibrary(bad),false)
})
