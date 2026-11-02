import test from 'node:test'
import assert from 'node:assert/strict'
import {normalizeCanvasItem} from '../src/features/workshop/shape-clipboard.ts'
import {umlPresets} from '../src/features/workshop/uml-catalog.ts'
import {newUmlConnection,umlAnchorPoint,umlEndpointPoint} from '../src/features/workshop/uml-connections.ts'
import {addUmlSuggestedElement,createUmlPresetItems,validUmlConnectionSuggestion} from '../src/features/workshop/uml-connection-drop.ts'
import {validUmlLibrary} from '../src/features/workshop/uml-library.ts'
const node=()=>normalizeCanvasItem({id:'a',x:0,y:100,width:200,height:160,umlSymbol:'class',kind:'rectangle',text:'Customer',appearance:'outlined',fillColor:'#a78bfa',outlineColor:'#a78bfa',outlineWidth:2,outlineStyle:'solid',cornerRadius:0})
const ids=()=>{let n=0;return()=>`new-${++n}`}
function scene(){const a=node(),link=newUmlConnection([a],{shapeId:a.id,side:'right',offset:.5},{x:900,y:400},'composition');link.text='owns';link.connection.guard='valid';link.connection.targetMultiplicity='*';return{items:[a,link],suggestion:{connectionId:link.id,end:'end',point:{x:900,y:400}}}}
test('a suggested element is created at the drop, attached, styled normally and valid to save',()=>{
 const {items,suggestion}=scene(),preset=umlPresets.find(p=>p.changes.umlSymbol==='state'),result=addUmlSuggestedElement(items,suggestion,preset.id,ids()),shape=result.items[2],link=result.items[1]
 assert.equal(items.length,2);assert.equal(result.items.length,3);assert.equal(shape.umlSymbol,'state');assert.equal(shape.x+shape.width/2,900);assert.equal(shape.y+shape.height/2,400);assert.equal(link.connection.end.shapeId,shape.id);assert.deepEqual(umlEndpointPoint(result.items,link.connection.end),umlAnchorPoint(shape,link.connection.end.side));assert.equal(link.text,'owns');assert.equal(link.connection.guard,'valid');assert.equal(link.connection.targetMultiplicity,'*')
 const ordinary=createUmlPresetItems(preset,{x:0,y:0},ids())[0];assert.equal(shape.text,ordinary.text);assert.equal(shape.fontSize,ordinary.fontSize);assert.equal(shape.outlineColor,ordinary.outlineColor)
 assert.ok(validUmlLibrary({version:1,diagrams:[{id:'d',name:'Model',type:'state-machine',updatedAt:new Date().toISOString(),items:result.items}]}))
})
test('reconnecting a free source can suggest a new source while retaining the target',()=>{
 const {items,suggestion}=scene(),link={...items[1],connection:{...items[1].connection,start:{x:-200,y:300},end:{shapeId:'a',side:'left',offset:.75}}},draft={...suggestion,end:'start',point:{x:-200,y:300}},result=addUmlSuggestedElement([items[0],link],draft,umlPresets.find(p=>p.changes.umlSymbol==='class').id,ids())
 assert.equal(result.items[1].connection.start.shapeId,result.items[2].id);assert.equal(result.items[1].connection.end.shapeId,'a');assert.equal(result.items[1].connection.end.offset,.75)
})
test('dismissed or stale suggestions never retarget moved, deleted, hidden or locked connections',()=>{
 const {items,suggestion}=scene(),preset=umlPresets.find(p=>p.changes.umlSymbol==='state').id
 for(const modified of [items.slice(0,1),items.map(n=>n.connection?{...n,locked:true}:n),items.map(n=>n.connection?{...n,hidden:true}:n),items.map(n=>n.connection?{...n,connection:{...n.connection,end:{x:950,y:400}}}:n),items.map(n=>n.id==='a'?{...n,hidden:true}:n)]){assert.equal(validUmlConnectionSuggestion(modified,suggestion),false);assert.equal(addUmlSuggestedElement(modified,suggestion,preset,ids()),null)}
 assert.equal(addUmlSuggestedElement(items,suggestion,umlPresets.find(p=>p.changes.umlSymbol==='dependency').id,ids()),null)
})
