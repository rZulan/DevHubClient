import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as library from '../src/features/workshop/uml-library.ts'
import * as catalog from '../src/features/workshop/uml-catalog.ts'
const require=createRequire(import.meta.url),code=ts.transpileModule(readFileSync(new URL('../src/pages/workshop/workshop-uml-library-page.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
function all(n,out=[]){if(Array.isArray(n))n.forEach(c=>all(c,out));else if(n?.props){out.push(n);all(n.props.children,out)}return out}
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):''
function harness(canEdit=true,initial={version:1,diagrams:[]}){
 let cursor=0,doc=initial;const slots=[],writes=[],exports={},components=new Proxy({},{get:(_,k)=>String(k)})
 const react={useState(v){const i=cursor++;if(!(i in slots))slots[i]=v;return[slots[i],next=>slots[i]=typeof next==='function'?next(slots[i]):next]},useRef(v){return slots[cursor++]??={current:v}}}
 vm.runInNewContext(code,{exports,require:name=>name==='react'?react:name==='react-router-dom'?{useOutletContext:()=>({organization:{id:'org'},project:{id:'project',name:'Project'},isPersistedOrganization:true})}:name==='@/app/hooks'?{useAppSelector:f=>f({auth:{user:{id:'user'}}})}:name.endsWith('/workshop-access')?{hasWorkshopPermission:()=>canEdit}:name.endsWith('/use-tool-document')?{useToolDocument:()=>({document:doc,canEdit,status:'saved',error:'',setDocument(next){doc=typeof next==='function'?next(doc):next;writes.push(doc)}})}:name.endsWith('/canvas-view-storage')?require('../src/features/workshop/canvas-view-storage.ts'):name.endsWith('/uml-library')?library:name.endsWith('/uml-catalog')?catalog:name.endsWith('.css')?{}:name.startsWith('@')||name.startsWith('.')?components:require(name)})
 function render(){cursor=0;return exports.WorkshopUmlLibraryPage().type()}
 function find(fn){return all(render()).find(fn)}
 function button(label){const n=find(n=>['button','Button'].includes(n.type)&&text(n)===label);assert.ok(n,label);return n}
 function inputName(name){find(n=>n.type==='input'&&n.props.maxLength===150).props.onChange({target:{value:name}})}
 return{find,button,inputName,writes,get doc(){return doc}}
}
test('the directory opens first, names are required, and a preferred type is optional',()=>{
 const h=harness();assert.equal(h.find(n=>n.type==='PlaygroundCanvas'),undefined)
 h.button('Create UML').props.onClick();h.find(n=>n.type==='form').props.onSubmit({preventDefault(){}});assert.equal(h.writes.length,0)
 h.inputName('Checkout');h.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 assert.equal(h.doc.diagrams[0].name,'Checkout');assert.equal(h.doc.diagrams[0].type,null)
 let canvas=h.find(n=>n.type==='PlaygroundCanvas');assert.ok(canvas);canvas.props.onBack()
 assert.equal(h.find(n=>n.type==='PlaygroundCanvas'),undefined)
 h.find(n=>n.props.className==='uml-directory-open').props.onClick();assert.ok(h.find(n=>n.type==='PlaygroundCanvas'))
})
test('diagram settings change category priority without clearing the canvas; viewers cannot mutate it',()=>{
 const d=library.newUmlDiagram('Model','class'),h=harness(true,{version:1,diagrams:[d]})
 h.find(n=>n.props.className==='uml-directory-open').props.onClick();h.button('Settings').props.onClick()
 h.find(n=>n.type==='WorkshopSelect').props.onValueChange('activity');h.inputName('Workflow');h.find(n=>n.type==='form').props.onSubmit({preventDefault(){}})
 const canvas=h.find(n=>n.type==='PlaygroundCanvas');assert.equal(canvas.props.diagram.type,'activity');assert.equal(canvas.props.diagram.name,'Workflow');assert.deepEqual(canvas.props.diagram.items,[])
 const viewer=harness(false,{version:1,diagrams:[d]});viewer.find(n=>n.props.className==='uml-directory-open').props.onClick();const view=viewer.find(n=>n.type==='PlaygroundCanvas');assert.equal(view.props.adapter.canEdit,false);view.props.adapter.setItems([]);assert.equal(viewer.writes.length,0)
})
