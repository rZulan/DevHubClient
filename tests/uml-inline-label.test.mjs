import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as connections from '../src/features/workshop/uml-connections.ts'

const require=createRequire(import.meta.url)
const compile=name=>ts.transpileModule(readFileSync(new URL(`../src/features/workshop/ideas/${name}.tsx`,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
const source=compile('uml-connection-label-editor'),layerSource=compile('uml-connections-layer')
const item=()=>connections.newUmlConnection([],{x:0,y:100},{x:400,y:100},'directed','straight')
function all(n,out=[]){if(Array.isArray(n))n.forEach(c=>all(c,out));else if(n?.props){out.push(n);all(n.props.children,out)}return out}

function editor(text='',zoom=1){
 const slots=[],effects=[],saves=[],exports={};let cursor=0,cancels=0,focuses=0,selections=0,canvasFocus=0
 const link={...item(),text},element={style:{},scrollHeight:42,focus(){focuses++},select(){selections++},closest:()=>({focus(){canvasFocus++}})}
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],v=>slots[i]=v]},useRef(initial){return slots[cursor++]??={current:initial}},useLayoutEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){slots[i]=deps;effects.push(fn)}}}
 vm.runInNewContext(source,{exports,require:name=>name==='react'?react:name==='../uml-connections'?connections:require(name)})
 function render(){cursor=0;const tree=exports.UmlConnectionLabelEditor({item:link,items:[link],zoom,onCommit:text=>saves.push(text),onCancel:()=>cancels++});all(tree).find(n=>n.type==='textarea').props.ref.current=element;effects.splice(0).forEach(fn=>fn());return tree}
 const input=()=>all(render()).find(n=>n.type==='textarea')
 return{render,input,saves,element,get cancels(){return cancels},get focuses(){return focuses},get selections(){return selections},get canvasFocus(){return canvasFocus},change(text){input().props.onChange({target:{value:text}});render()},key(key,extra={}){let prevented=false;input().props.onKeyDown({key,nativeEvent:{isComposing:false},stopPropagation(){},preventDefault(){prevented=true},...extra});return prevented}}
}

test('the inline label editor focuses/selects existing text and tracks the arrow at any zoom',()=>{
 const e=editor('Existing',.5),tree=e.render();assert.equal(e.focuses,1);assert.equal(e.selections,1);assert.equal(tree.props.style.left,200);assert.equal(tree.props.style.top,100);assert.equal(e.input().props.style.fontSize,28);assert.equal(tree.props.style.width,320)
 e.change('replacement');assert.equal(e.focuses,1,'typing does not reselect the draft');assert.equal(e.saves.length,0);assert.ok(e.key('Enter'));assert.deepEqual(e.saves,['replacement']);assert.equal(e.canvasFocus,1)
 e.input().props.onBlur();assert.equal(e.saves.length,1,'the blur after Enter does not save twice')
})

test('Escape discards changes, clicking away commits, and empty labels remove the text',()=>{
 const cancelled=editor('Existing');cancelled.change('Draft');assert.ok(cancelled.key('Escape'));cancelled.input().props.onBlur();assert.equal(cancelled.cancels,1);assert.equal(cancelled.saves.length,0)
 const blurred=editor();blurred.change('Click away');blurred.input().props.onBlur();assert.deepEqual(blurred.saves,['Click away']);assert.equal(blurred.canvasFocus,0,'clicking away retains focus on the clicked control')
 const cleared=editor('Remove me');cleared.change('');cleared.key('Enter');assert.deepEqual(cleared.saves,[''])
})

test('Shift+Enter and IME composition do not prematurely commit a label',()=>{
 const e=editor();e.change('First\nSecond');assert.equal(e.key('Enter',{shiftKey:true}),false);assert.equal(e.key('Enter',{nativeEvent:{isComposing:true}}),false);assert.equal(e.saves.length,0);e.key('Enter');assert.deepEqual(e.saves,['First\nSecond'])
})

function layer({canEdit=true,canInteract=true,locked=false,editingLabelId}={}){
 const exports={},edits=[],link={...item(),locked,text:'Label'},bendCalls=[]
 vm.runInNewContext(layerSource,{exports,require:name=>name==='react'?{useId:()=>':test:'}:name==='../uml-connections'?connections:require(name)})
 const tree=exports.UmlConnectionsLayer({items:[link],selectedIds:[link.id],canEdit,canInteract,editingLabelId:editingLabelId?link.id:undefined,zoom:1,onSelect(){},onEditLabel:id=>edits.push(id),onEndpoint(){},onBend:(...args)=>bendCalls.push(args)})
 return{tree,edits,link,bendCalls,group:all(tree).find(n=>n.props['data-canvas-item-id']===link.id)}
}

test('the arrow and its label respond to double-click; the waypoint handle leaves the center available',()=>{
 const l=layer(),route=connections.umlConnectionRoute([l.link],l.link);l.group.props.onDoubleClick({stopPropagation(){}});assert.deepEqual(l.edits,[l.link.id])
 const handle=all(l.tree).find(n=>n.props['aria-label']==='Drag to add waypoint');assert.equal(handle.props.cx,100);assert.equal(route.label.x,200);assert.notEqual(handle.props.cx,route.label.x)
 const editing=layer({editingLabelId:true});assert.equal(all(editing.tree).some(n=>n.props.className==='uml-connection-label-background'),false);assert.equal(all(editing.tree).some(n=>n.props.className==='uml-bend-handle'),false)
})

test('locked, read-only and hand-mode connections cannot start label editing by mouse or keyboard',()=>{
 for(const options of [{canEdit:false},{canInteract:false},{locked:true}]){const l=layer(options);l.group.props.onDoubleClick({stopPropagation(){}});l.group.props.onKeyDown({key:'Enter',preventDefault(){},stopPropagation(){}});assert.equal(l.edits.length,0)}
})
