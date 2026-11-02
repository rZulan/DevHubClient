import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {fileURLToPath} from 'node:url'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {canvasStorage} from './fixtures/canvas-storage.mjs'
import {canvasViewKey} from '../src/features/workshop/canvas-view-storage.ts'
import {normalizeCanvasItem} from '../src/features/workshop/shape-clipboard.ts'
import {umlPresets} from '../src/features/workshop/uml-catalog.ts'
import {umlAnchorPoint,umlEndpointPoint,umlConnectionRoute} from '../src/features/workshop/uml-connections.ts'
const require=createRequire(import.meta.url),source=ts.transpileModule(readFileSync(new URL('../src/pages/workshop/workshop-ideation-page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
function all(n,out=[]){if(Array.isArray(n))n.forEach(c=>all(c,out));else if(n?.props){out.push(n);all(n.props.children,out)}return out}
const shape=(id,x,y)=>normalizeCanvasItem({id,x,y,width:200,height:160,kind:'rectangle',umlSymbol:'class',text:id,appearance:'outlined',fillColor:'#a78bfa',outlineColor:'#a78bfa',outlineWidth:2,outlineStyle:'solid',cornerRadius:0})
function harness(canEdit=true,items=[shape('a',0,0),shape('b',450,300)],viewStorageKey){
 const hooks=[],effects=[],writes=[],listeners=new Map(),exports={},components=new Proxy({},{get:(_,k)=>String(k)})
 let cursor=0,dirty=false,diagram={id:'diagram',name:'Model',type:'class',items,updatedAt:new Date().toISOString()}
 const root={clientWidth:1200,clientHeight:800,focus(){},getBoundingClientRect:()=>({left:220,top:80}),setPointerCapture(){},hasPointerCapture:()=>true,releasePointerCapture(){}}
 const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],next=>{const value=typeof next==='function'?next(hooks[i]):next;if(!Object.is(value,hooks[i])){hooks[i]=value;dirty=true}}]},useRef(initial){return hooks[cursor++]??={current:initial}},useMemo(fn){return fn()},useEffect(fn,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){hooks[i]=deps;effects.push(fn)}}};react.useLayoutEffect=react.useEffect
 const pure=new Set(['canvas-view','canvas-view-storage','shape-catalog','shape-clipboard','uml-catalog','uml-connections','uml-connection-drop','uml-connection-types','resize-selection','rotate-selection','snap-shape','shape-groups'])
 vm.runInNewContext(source,{exports,Element:class{},HTMLElement:class{},window:{addEventListener:(name,fn)=>listeners.set(name,[...(listeners.get(name)??[]),fn]),removeEventListener(){},confirm:()=>true},ResizeObserver:class{constructor(fn){this.fn=fn}observe(){this.fn()}disconnect(){}},require:name=>{
   if(name==='react')return react
   if(name==='react-router-dom')return {useOutletContext:()=>({project:{id:'project',name:'Project'}})}
   if(name.endsWith('/use-canvas-touch'))return {useCanvasTouch:()=>({})}
   if(name.endsWith('/create-client-id'))return require('../src/lib/create-client-id.ts')
   if(name.startsWith('@/features/workshop/')&&pure.has(name.split('/').at(-1)))return require(fileURLToPath(new URL(`../src/features/workshop/${name.split('/').at(-1)}.ts`,import.meta.url)))
   if(name.startsWith('@'))return components
   return require(name)
 }})
 function render(){let tree,loops=0;do{dirty=false;cursor=0;tree=exports.PlaygroundCanvas({diagram,viewStorageKey,adapter:{canEdit,status:'saved',error:'',setItems(next){diagram={...diagram,items:next};writes.push(next);dirty=true},save(){},reload(){},retry(){}},onBack(){}});tree.props.ref.current=root;effects.splice(0).forEach(fn=>fn());assert.ok(loops++<12,'render settles')}while(dirty);return tree}
 const find=fn=>all(render()).find(fn),card=id=>find(n=>n.type==='CanvasCard'&&n.props.item.id===id)
 function event(x,y,extra={}){return{pointerId:1,isPrimary:true,pointerType:'mouse',button:0,clientX:220+60+x*.85,clientY:80+30+y*.85,currentTarget:root,target:{closest:()=>null},preventDefault(){},stopPropagation(){},...extra}}
 return{render,find,card,writes,listeners,event,get items(){return diagram.items},handle(id,side){return all(card(id)).find(n=>n.props.className==='uml-edge-handle'&&n.props['data-side']===side)},move(x,y){render().props.onPointerMove(event(x,y));render()},up(x,y){render().props.onPointerUp(event(x,y));render()},drop(preset,x,y){const e=event(x,y,{dataTransfer:{getData:()=>preset.id}});render().props.onDrop(e);render()},key(key,extra={}){render().props.onKeyDown({key,target:{closest:()=>null},preventDefault(){},...extra});render()}}
}

test('UML keeps the zoom and position of each diagram when reopened', t => {
 const storage=canvasStorage(t),key=canvasViewKey('user','org','project','uml','diagram')
 const first=harness(true,undefined,key)
 first.find(n=>n.type==='ZoomControls').props.onZoom(.23)
 first.find(n=>n.type==='CanvasMinimap').props.onNavigate(600,-350)
 first.render()
 const saved=JSON.parse(storage.getItem(key)),reopened=harness(true,undefined,key)
 assert.equal(reopened.find(n=>n.type==='ZoomControls').props.zoom,saved.zoom)
 const viewport=reopened.find(n=>n.type==='CanvasMinimap').props.viewport
 assert.equal(viewport.x,-saved.pan.x/saved.zoom)
 assert.equal(viewport.y,-saved.pan.y/saved.zoom)
 assert.equal(harness(true,undefined,canvasViewKey('user','org','project','uml','other-diagram')).find(n=>n.type==='ZoomControls').props.zoom,.85)
 assert.equal(first.writes.length,0,'camera changes never save the shared document')
})
test('dragging an edge creates one attached connection at world coordinates and undo/redo preserves it',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.move(450,380);assert.equal(h.writes.length,0,'preview does not save partial edges');h.up(450,380)
 assert.equal(h.items.length,3);const link=h.items[2];assert.equal(link.connection.start.shapeId,'a');assert.equal(link.connection.end.shapeId,'b');assert.equal(link.connection.end.side,'left');assert.equal(link.connection.end.offset,.5);assert.equal(h.writes.length,1)
 h.key('z',{ctrlKey:true});assert.equal(h.items.length,2);h.key('z',{ctrlKey:true,shiftKey:true});assert.equal(h.items.length,3)
 const a=h.card('a');a.props.onChange({...a.props.item,x:120,width:300,rotation:90});h.render();assert.deepEqual(umlEndpointPoint(h.items,h.items[2].connection.start),umlAnchorPoint(h.items[0],'right'))
})
test('connections reconnect, accept a waypoint, edit their labels and delete with their endpoint',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(450,380);let layer=h.find(n=>n.type==='UmlConnectionsLayer'),id=h.items[2].id
 layer.props.onEndpoint(h.event(450,380),id,'end');h.up(850,250);assert.deepEqual({...h.items[2].connection.end},{x:850,y:250})
 layer=h.find(n=>n.type==='UmlConnectionsLayer');layer.props.onBend(h.event(400,150),id,0);h.up(420,90);assert.deepEqual({...h.items[2].connection.bends[0]},{x:420,y:90})
 layer=h.find(n=>n.type==='UmlConnectionsLayer');layer.props.onEditLabel(id);assert.ok(h.find(n=>n.type==='UmlConnectionLabelEditor'));const panel=h.find(n=>n.type==='UmlConnectorPanel');panel.props.onChange({...panel.props.item,text:'save()',connection:{...panel.props.item.connection,guard:'valid',targetMultiplicity:'0..*'}});h.render();assert.equal(h.items[2].text,'save()')
 const a=h.card('a');a.props.onSelect(false,false);a.props.onDragEnd();h.key('Delete');assert.equal(h.items.some(n=>n.connection),false);assert.deepEqual(Array.from(h.items,n=>n.id),['b'])
})
test('cancelled, tiny, escaped and blurred drags never commit a connection',()=>{
 for(const method of ['cancel','escape','blur','tiny']){const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));if(method!=='tiny')h.move(400,200);if(method==='cancel')h.render().props.onPointerCancel();if(method==='escape')h.key('Escape');if(method==='blur')h.listeners.get('blur').forEach(fn=>fn());h.up(method==='tiny'?201:450,method==='tiny'?80:380);assert.equal(h.writes.length,0,method)}
})
test('palette stays open, relationship choice changes the connector tool, and read-only/locked nodes cannot be dragged',()=>{
 const h=harness(),preset=umlPresets.find(p=>p.changes.umlSymbol==='state');h.find(n=>n.type==='ShapeSelector').props.onAdd(preset);assert.ok(h.find(n=>n.type==='ShapeSelector'));assert.equal(h.items.length,3)
 h.find(n=>n.type==='ShapeSelector').props.onAdd(umlPresets.find(p=>p.changes.umlSymbol==='composition'));assert.equal(h.items.length,3,'a relationship selects a tool, not a standalone arrow glyph');assert.equal(h.find(n=>n.props['aria-label']==='Connection type').props.value,'composition')
 const readonly=harness(false);assert.equal(readonly.handle('a','right'),undefined);assert.equal(readonly.card('a').props.canDrag,false);assert.equal(readonly.find(n=>n.type==='ShapeSelector'),undefined)
 const locked=harness(true,[{...shape('a',0,0),locked:true}]);assert.equal(locked.handle('a','right'),undefined);assert.equal(locked.card('a').props.canDrag,false);locked.card('a').props.onSelect(false,false);locked.card('a').props.onDragEnd();locked.key('Delete');assert.equal(locked.items.length,1)
})
test('duplicate and clipboard include links between selected shapes and remap both endpoint identities',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(450,380);h.key('a',{ctrlKey:true});h.key('d',{ctrlKey:true});assert.equal(h.items.length,6)
 const copied=h.items[5];assert.equal(copied.connection.start.shapeId,h.items[3].id);assert.equal(copied.connection.end.shapeId,h.items[4].id);assert.notEqual(copied.id,h.items[2].id)
 let copiedText='';h.render().props.onCopy({target:{closest:()=>null},preventDefault(){},clipboardData:{setData(type,value){copiedText=value}}});const decoded=JSON.parse(copiedText);assert.ok(copiedText.includes(copied.connection.start.shapeId));assert.ok(decoded)
})

test('arrow labels edit at their midpoint, save as one undoable change, and preserve all relationship metadata',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(450,380)
 const layer=h.find(n=>n.type==='UmlConnectionsLayer'),link=h.items[2],center=umlConnectionRoute(h.items,link).label
 h.render().props.onDoubleClick(h.event(center.x,center.y))
 let editor=h.find(n=>n.type==='UmlConnectionLabelEditor');assert.equal(editor.props.item.id,link.id);assert.equal(h.find(n=>n.type==='UmlConnectionsLayer').props.editingLabelId,link.id)
 const writes=h.writes.length;editor.props.onCommit('submit');h.render();assert.equal(h.items[2].text,'submit');assert.equal(h.writes.length,writes+1);assert.equal(h.items[2].connection,link.connection);assert.equal(h.find(n=>n.type==='UmlConnectionLabelEditor'),undefined)
 h.key('z',{ctrlKey:true});assert.equal(h.items[2].text,'');h.key('z',{ctrlKey:true,shiftKey:true});assert.equal(h.items[2].text,'submit')
 layer.props.onEditLabel(link.id);editor=h.find(n=>n.type==='UmlConnectionLabelEditor');editor.props.onCancel();assert.equal(h.items[2].text,'submit')
 h.find(n=>n.type==='UmlConnectionsLayer').props.onEditLabel(link.id);h.find(n=>n.type==='UmlConnectionLabelEditor').props.onCommit('');h.render();assert.equal(h.items[2].text,'')
 h.find(n=>n.type==='UmlConnectionsLayer').props.onEditLabel(link.id);const unchanged=h.writes.length;h.find(n=>n.type==='UmlConnectionLabelEditor').props.onCommit('');h.render();assert.equal(h.writes.length,unchanged,'unchanged labels do not add undo entries or saves')
})

test('inline editing cannot open on locked arrows, in hand mode, or in a read-only canvas',()=>{
 const source=harness();source.handle('a','right').props.onPointerDown(source.event(200,80));source.up(450,380);const id=source.items[2].id
 const locked=harness(true,source.items.map(n=>n.id===id?{...n,locked:true}:n)),readonly=harness(false,source.items)
 for(const h of [locked,readonly]){h.find(n=>n.type==='UmlConnectionsLayer').props.onEditLabel(id);assert.equal(h.find(n=>n.type==='UmlConnectionLabelEditor'),undefined)}
 source.find(n=>n.type==='CanvasToolbar').props.onHandTool();source.find(n=>n.type==='UmlConnectionsLayer').props.onEditLabel(id);assert.equal(source.find(n=>n.type==='UmlConnectionLabelEditor'),undefined)
})

test('blank connector drops show optional suggestions, and dismissing keeps the saved arrow',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(850,500)
 const popup=h.find(n=>n.type==='UmlConnectionSuggestions');assert.ok(popup);assert.equal(h.items.length,3);assert.equal(h.writes.length,1);assert.deepEqual({...h.items[2].connection.end},{x:850,y:500});assert.equal(h.find(n=>n.type==='UmlConnectionsLayer').props.draft,undefined)
 popup.props.onClose();h.render();assert.equal(h.find(n=>n.type==='UmlConnectionSuggestions'),undefined);assert.equal(h.items.length,3);assert.equal(h.writes.length,1)
 h.key('z',{ctrlKey:true});assert.equal(h.items.length,2)
})

test('choosing a suggestion adds and connects a shape at the drop point with one undo for the whole action',()=>{
 const h=harness(),preset=umlPresets.find(p=>p.changes.umlSymbol==='state')
 h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(800,500)
 const popup=h.find(n=>n.type==='UmlConnectionSuggestions');assert.equal(popup.props.onChoose(preset.id),'');h.render()
 assert.equal(h.items.length,4);const state=h.items.find(n=>n.umlSymbol==='state'),link=h.items.find(n=>n.connection)
 assert.equal(state.x+state.width/2,800);assert.equal(state.y+state.height/2,500);assert.equal(link.connection.start.shapeId,'a');assert.equal(link.connection.end.shapeId,state.id);assert.equal(h.find(n=>n.type==='UmlConnectionSuggestions'),undefined)
 h.key('z',{ctrlKey:true});assert.equal(h.items.length,2);h.key('z',{ctrlKey:true,shiftKey:true});assert.equal(h.items.length,4)
})

test('dropping on an existing shape connects directly, including relationship drops from the palette',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(450,380);assert.equal(h.items.length,3);assert.equal(h.find(n=>n.type==='UmlConnectionSuggestions'),undefined)
 const a=h.card('a');a.props.onSelect(false,false);a.props.onDragEnd();h.drop(umlPresets.find(p=>p.changes.umlSymbol==='composition'),460,380)
 assert.equal(h.items.length,4);assert.equal(h.items[3].umlSymbol,'composition');assert.equal(h.items[3].connection.start.shapeId,'a');assert.equal(h.items[3].connection.end.shapeId,'b');assert.equal(h.find(n=>n.type==='UmlConnectionSuggestions'),undefined)
 h.drop(umlPresets.find(p=>p.changes.umlSymbol==='dependency'),900,500);assert.ok(h.find(n=>n.type==='UmlConnectionSuggestions'));assert.equal(h.items.length,5)
})

test('suggestions follow blank endpoint reconnections but do not open for waypoints',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(450,380);const id=h.items[2].id
 h.find(n=>n.type==='UmlConnectionsLayer').props.onEndpoint(h.event(450,380),id,'end');h.up(900,500)
 assert.ok(h.find(n=>n.type==='UmlConnectionSuggestions'));assert.deepEqual({...h.items[2].connection.end},{x:900,y:500});h.find(n=>n.type==='UmlConnectionSuggestions').props.onClose();h.render()
 h.find(n=>n.type==='UmlConnectionsLayer').props.onBend(h.event(400,200),id,0);h.up(500,200);assert.equal(h.find(n=>n.type==='UmlConnectionSuggestions'),undefined)
})

test('adding a suggested shape after another edit does not absorb that edit into the arrow undo',()=>{
 const h=harness();h.handle('a','right').props.onPointerDown(h.event(200,80));h.up(850,500)
 const popup=h.find(n=>n.type==='UmlConnectionSuggestions'),a=h.card('a');a.props.onChange({...a.props.item,x:70});h.render()
 popup.props.onChoose(umlPresets.find(p=>p.changes.umlSymbol==='state').id);h.render();assert.equal(h.items.length,4)
 h.key('z',{ctrlKey:true});assert.equal(h.items.length,3);assert.equal(h.items[0].x,70);h.key('z',{ctrlKey:true});assert.equal(h.items[0].x,0)
})
