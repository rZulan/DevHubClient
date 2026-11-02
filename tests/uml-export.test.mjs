import {umlConnectionLabel} from "../src/features/workshop/uml-connections.ts"
import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFileSync,existsSync} from 'node:fs'
import {dirname,resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url),cache=new Map()
function load(path){if(cache.has(path))return cache.get(path);const exports={};cache.set(path,exports);const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,require:name=>{if(name.startsWith('.')){const base=resolve(dirname(path),name);for(const ext of ['.tsx','.ts'])if(existsSync(base+ext))return ext==='.tsx'?load(base+ext):require(base+ext)}return require(name)}},{filename:path});return exports}
const {umlSvg}=load(fileURLToPath(new URL('../src/features/workshop/ideas/uml-export.tsx',import.meta.url)))
const fixture=()=>JSON.parse(readFileSync(new URL('../../api/tests/DevHub.ProjectToolsSmoke/Fixtures/uml-library.json',import.meta.url),'utf8')).diagrams[0]
test('standalone SVG exports actual sized UML shapes, compartment text, relationships and safe labels',()=>{
 const diagram=fixture();diagram.name='<script>title</script>';diagram.items[0].umlDetails.name='<img src=x onerror=alert(1)>';diagram.items[2].text='owns <children>';diagram.items[2].connection.effect='attach()'
 const svg=umlSvg(diagram);assert.match(svg,/xmlns="http:\/\/www.w3.org\/2000\/svg"/);assert.match(svg,/width="200" height="180"/);assert.match(svg,/0\.\.\*/);assert.match(svg,/attach\(\)/);assert.match(svg,/&lt;img/);assert.equal(svg.includes('<script>'),false);assert.equal(svg.includes('<img'),false);assert.match(svg,/marker-start="url\(#/);assert.match(svg,/- id: UUID/)
})
test('hidden nodes and their incident edges do not leak into an export or break rendering',()=>{
 const diagram=fixture();diagram.items[1].hidden=true;const svg=umlSvg(diagram);assert.equal(svg.includes('Related'),false);assert.equal(svg.includes('owns'),false);assert.equal(svg.includes('marker-start='),false)
 const empty=umlSvg({...diagram,items:[]});assert.match(empty,/<svg/);assert.equal(empty.includes('NaN'),false)
})
test('UML transition labels put guards before effects and preserve include and sequence notation',()=>{
 const link=fixture().items[2];link.text='submit';link.connection.guard='valid';link.connection.effect='save()';assert.equal(umlConnectionLabel(link),'submit [valid] / save()')
 link.umlSymbol='include';link.text='«include» Authenticate';link.connection.guard='';link.connection.effect='';assert.equal(umlConnectionLabel(link),'«include» Authenticate');link.umlSymbol='sync';link.text='request()';link.connection.number=2;assert.equal(umlConnectionLabel(link),'2: request()')
})
