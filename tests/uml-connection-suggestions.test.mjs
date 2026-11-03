import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as clipboard from '../src/features/workshop/shape-clipboard.ts'
import * as catalog from '../src/features/workshop/uml-catalog.ts'
import * as types from '../src/features/workshop/uml-connection-types.ts'
const require=createRequire(import.meta.url),code=ts.transpileModule(readFileSync(new URL('../src/features/workshop/ideas/uml-connection-suggestions.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
function all(n,out=[]){if(Array.isArray(n))n.forEach(c=>all(c,out));else if(n?.props){out.push(n);all(n.props.children,out)}return out}
function popup(failure=''){
 const slots=[],effects=[],choices=[],dismissals=[],listeners=new Map(),exports={},components=new Proxy({},{get:(_,key)=>String(key)})
 let cursor=0
 class Node{}
 const inside=new Node(),outside=new Node(),panel={contains:target=>target===inside}
 const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>slots[i]=value]},useRef(initial){return slots[cursor++]??={current:initial}},useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((d,j)=>!Object.is(d,old[j]))){slots[i]=deps;effects.push(fn)}}}
 const onClose=restore=>dismissals.push(restore)
 vm.runInNewContext(code,{exports,Node,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener(){}},require:name=>name==='react'?react:name==='../shape-clipboard'?clipboard:name==='../uml-catalog'?catalog:name==='../uml-connection-types'?types:name.startsWith('@')||name==='./shape-geometry'?components:require(name)})
 function render(){cursor=0;const tree=exports.UmlConnectionSuggestions({anchor:{x:200,y:100},viewport:{width:1200,height:800},umlType:'state-machine',onChoose:id=>{choices.push(id);return failure},onClose});tree.props.ref.current=panel;effects.splice(0).forEach(fn=>fn());return tree}
 const find=fn=>all(render()).find(fn)
 return{render,find,choices,dismissals,listeners,inside,outside,query(value){find(n=>n.type==='input').props.onChange({target:{value}})}}
}

test('the picker is a small non-modal popup with six suggestions and no forced keyboard focus',()=>{
 const p=popup(),tree=p.render(),suggestions=all(tree).filter(n=>n.props.className==='uml-suggestion');assert.equal(tree.type,'div');assert.equal(tree.props['aria-modal'],false);assert.equal(suggestions.length,6);assert.equal(suggestions[0].props.title,'State');assert.equal(tree.props.style.left,212);assert.equal(tree.props.style.top,112);assert.equal(p.find(n=>n.type==='input').props.autoFocus,undefined)
 suggestions[0].props.onClick();assert.equal(p.choices[0],catalog.umlPresets.find(p=>p.category==='State Machine'&&p.changes.umlSymbol==='state').id)
})

test('search can choose other UML shapes without offering connector glyphs',()=>{
 const p=popup();p.query('Deep history');const match=p.find(n=>n.props.className==='uml-suggestion');assert.equal(match.props.title,'Deep history');match.props.onClick();assert.equal(p.choices.length,1)
 p.query('Merge');assert.equal(p.find(n=>n.props.className==='uml-suggestion').props.title,'Merge','alternate names for the same geometry remain searchable')
 p.query('Synchronous message');assert.equal(p.find(n=>n.props.className==='uml-suggestion'),undefined)
})

test('outside clicks and Escape dismiss suggestions without consuming the canvas click or choosing a shape',()=>{
 const p=popup();p.render();let prevented=false,stopped=false
 p.listeners.get('pointerdown')({target:p.inside});assert.equal(p.dismissals.length,0)
 p.listeners.get('pointerdown')({target:p.outside,preventDefault(){prevented=true},stopPropagation(){stopped=true}});assert.equal(p.dismissals.length,1);assert.equal(prevented,false);assert.equal(stopped,false);assert.equal(p.choices.length,0)
 p.listeners.get('keydown')({key:'Escape',preventDefault(){prevented=true},stopPropagation(){stopped=true}});assert.equal(p.dismissals[1],true);assert.equal(prevented,true);assert.equal(stopped,true)
})

test('stale connection errors use an error toast and the close button only dismisses the popup',()=>{
 const p=popup('The connection changed.');p.find(n=>n.props.className==='uml-suggestion').props.onClick();const message=p.find(n=>n.type==='WorkshopToast');assert.equal(message.props.variant,'error');assert.equal(message.props.children,'The connection changed.')
 p.find(n=>n.props['aria-label']==='Dismiss suggestions').props.onClick();assert.equal(p.dismissals[0],true)
})
