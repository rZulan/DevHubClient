import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {normalizeCanvasItem,cloneShapes,encodeShapes,decodeShapes} from '../src/features/workshop/shape-clipboard.ts'
import {newUmlConnection,umlAnchorPoint,umlLocalPoint,umlEndpointAt,umlEndpointPoint,umlConnectionRoute,syncUmlConnections,umlSelectionWithConnections,translateUmlItems,upgradeUmlConnections} from '../src/features/workshop/uml-connections.ts'
import {validUmlLibrary} from '../src/features/workshop/uml-library.ts'
import {umlConnectorSymbols} from '../src/features/workshop/uml-connection-types.ts'
import {arrangeUmlItems,autoLayoutUml} from '../src/features/workshop/uml-layout.ts'
import {umlElementDetails,withUmlDetails,umlElementCompartments} from '../src/features/workshop/uml-elements.ts'

export const node=(id,x=0,y=0,symbol='class')=>normalizeCanvasItem({id,x,y,width:200,height:160,kind:'rectangle',umlSymbol:symbol,text:id,appearance:'outlined',fillColor:'#a78bfa',outlineColor:'#a78bfa',outlineWidth:2,outlineStyle:'solid',cornerRadius:0})
const attach=(id,side='right',offset=.5)=>({shapeId:id,side,offset})
test('anchors follow shape geometry, rotations, flips, ellipse/diamond boundaries and lifeline timing',()=>{
 const n=node('a',20,30);assert.deepEqual(umlAnchorPoint(n,'right'),{x:220,y:110})
 const rotated={...n,rotation:90};const p=umlAnchorPoint(rotated,'right');assert.ok(Math.abs(p.x-120)<.001);assert.ok(Math.abs(p.y-210)<.001);const local=umlLocalPoint(rotated,p);assert.ok(Math.abs(local.x-200)<.001)
 assert.deepEqual(umlAnchorPoint({...n,flipHorizontal:true},'right'),{x:20,y:110})
 for(const symbol of ['use-case','decision']){const shape={...n,umlSymbol:symbol},point=umlAnchorPoint(shape,'top',.9),nx=(point.x-120)/100,ny=(point.y-110)/80;assert.ok(Math.abs((symbol==='decision'?Math.abs(nx)+Math.abs(ny):Math.hypot(nx,ny))-1)<.001)}
 assert.deepEqual(umlAnchorPoint({...n,umlSymbol:'lifeline',height:480},'right',.75),{x:120,y:390})
 const frame={...node('frame',-100,-100,'boundary'),width:900,height:900};assert.equal(umlEndpointAt([n,frame],{x:210,y:100}).shapeId,'a')
 assert.equal(umlEndpointAt([n],{x:1000,y:1000}),null)
})
test('all UML relationship styles support routing, self transitions, waypoints and free endpoints',()=>{
 const nodes=[node('a'),node('b',450,300)]
 for(const symbol of umlConnectorSymbols)for(const routing of ['straight','orthogonal','curve']){
   const link=newUmlConnection(nodes,attach('a'),attach('b','left'),symbol,routing),route=umlConnectionRoute(nodes,link)
   assert.ok(route.path.startsWith('M'));assert.ok(route.points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));assert.deepEqual(route.start,{x:200,y:80});assert.deepEqual(route.end,{x:450,y:380});assert.ok(route.bounds.width>=24)
 }
 const loop=newUmlConnection(nodes,attach('a'),attach('a','top'));assert.ok(umlConnectionRoute(nodes,loop).points.length>4)
 const link=newUmlConnection(nodes,{x:-120,y:30},{x:80,y:30});link.connection.bends=[{x:-40,y:-60}];assert.match(umlConnectionRoute(nodes,link).path,/L-40 -60/)
 const moved=translateUmlItems([link],{x:10,y:20})[0];assert.deepEqual(moved.connection.start,{x:-110,y:50});assert.deepEqual(moved.connection.bends,[{x:-30,y:-40}])
})
test('connections move with nodes, survive resizing, and delete atomically with their endpoint node',()=>{
 const a=node('a'),b=node('b',450),link=newUmlConnection([a,b],attach('a'),attach('b','left')),initial=[a,b,link]
 assert.equal(syncUmlConnections(initial)[2],link,'unchanged connections retain identity')
 const changed=syncUmlConnections([{...a,x:120,width:300,rotation:90},b,link]),route=umlConnectionRoute(changed,changed[2]);assert.deepEqual(route.start,umlAnchorPoint(changed[0],'right'));assert.notEqual(changed[2].x,link.x)
 assert.deepEqual(syncUmlConnections(initial.filter(n=>n.id!=='a')).map(n=>n.id),['b'])
})
test('existing arrow glyphs become editable connections without losing their identity or style',()=>{
 const a=node('a'),b=node('b',450),old={...node('old',200,56,'generalization'),kind:'arrow',width:250,height:48,text:'inherits'},items=[a,b,old],upgraded=upgradeUmlConnections(items)
 assert.equal(upgraded[2].id,'old');assert.equal(upgraded[2].umlSymbol,'generalization');assert.equal(upgraded[2].text,'inherits');assert.equal(upgraded[2].connection.start.shapeId,'a');assert.equal(upgraded[2].connection.end.shapeId,'b');assert.equal(items[2].connection,undefined);assert.equal(upgradeUmlConnections(upgraded),upgraded)
})
test('copying nodes carries their links, remaps endpoints and groups, while copying one link detaches it safely',()=>{
 const a=node('a'),b=node('b',450),link=newUmlConnection([a,b],attach('a'),attach('b','left')),items=[a,b,link];let id=0
 const source=umlSelectionWithConnections(items,['a','b']),copies=cloneShapes(source,30,()=>`copy-${++id}`);assert.equal(copies.length,3);assert.equal(copies[2].connection.start.shapeId,copies[0].id);assert.equal(copies[2].connection.end.shapeId,copies[1].id);assert.equal(copies[0].x,30)
 const edgeOnly=umlSelectionWithConnections(items,[link.id]);assert.deepEqual(edgeOnly[0].connection.start,{x:200,y:80});assert.deepEqual(edgeOnly[0].connection.end,{x:450,y:80});assert.equal(decodeShapes(encodeShapes(edgeOnly)).length,1)
 const partial=umlSelectionWithConnections(items,['a',link.id]);assert.equal(partial[1].connection.start.shapeId,'a');assert.deepEqual(partial[1].connection.end,{x:450,y:80})
})
test('client validation matches the database fixture and rejects invalid links and UML fields',()=>{
 const good=JSON.parse(readFileSync(new URL('../../api/tests/DevHub.ProjectToolsSmoke/Fixtures/uml-library.json',import.meta.url),'utf8'));assert.ok(validUmlLibrary(good))
 for(const mutate of [d=>d.diagrams[0].items[2].connection.start.offset=2,d=>d.diagrams[0].items[2].connection.end.shapeId='missing',d=>d.diagrams[0].items[2].connection.end.shapeId='relationship-one',d=>d.diagrams[0].items[2].connection.bends=[{shapeId:'shape-one',side:'right',offset:.5}],d=>d.diagrams[0].items[2].connection.number=1.5,d=>d.diagrams[0].items[0].locked='false',d=>d.diagrams[0].items[0].umlDetails.name='x'.repeat(151),d=>d.diagrams[0].items[0].connection=d.diagrams[0].items[2].connection,d=>d.diagrams[1].items.push(d.diagrams[0].items.splice(1,1)[0])]){const bad=structuredClone(good);mutate(bad);assert.equal(validUmlLibrary(bad),false)}
})
test('aligning and arranging nodes preserves attachments and respects locked and hidden layers',()=>{
 const a=node('a'),b=node('b',450,300),c={...node('locked',900,200),locked:true},link=newUmlConnection([a,b],attach('a'),attach('b','left')),items=[a,b,c,link]
 const arranged=arrangeUmlItems(items,['a','b','locked'],'left');assert.equal(arranged[1].x,0);assert.equal(arranged[2],c);assert.equal(arranged[3].connection.end.shapeId,'b')
 const flow=autoLayoutUml(items);assert.ok(flow[1].y>flow[0].y);assert.equal(flow[2],c);assert.deepEqual(umlEndpointPoint(flow,flow[3].connection.end),umlAnchorPoint(flow[1],'left'))
 const sequence=autoLayoutUml(items,true);assert.equal(sequence[0].y,sequence[1].y);assert.ok(sequence[1].x>sequence[0].x+sequence[0].width)
})
test('structured UML fields preserve visibility signatures, state behavior and interaction operands',()=>{
 const a={...node('a'),text:'«interface»\nService\n- id: UUID\n+ save(): void'},d=umlElementDetails(a);assert.equal(d.stereotype,'interface');assert.equal(d.attributes,'- id: UUID');assert.equal(d.operations,'+ save(): void')
 const updated=withUmlDetails(a,{...d,name:'Repository'});assert.deepEqual(umlElementCompartments(updated),['«interface»\nRepository','- id: UUID','+ save(): void']);assert.ok(updated.text.includes('Repository'))
 const state=withUmlDetails(node('s',0,0,'state'),{...d,name:'Active',entry:'setup()',activity:'work()',exit:'close()'});assert.match(state.text,/entry \/ setup\(\)/);assert.match(state.text,/exit \/ close\(\)/)
 const fragment=withUmlDetails(node('f',0,0,'fragment'),{...d,name:'Checkout',operator:'alt',operands:'[valid]\n---\n[else]'});assert.deepEqual(umlElementCompartments(fragment),['alt Checkout','[valid]','[else]'])
})
