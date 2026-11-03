import test from 'node:test'
import assert from 'node:assert/strict'
import {planErdRoutes,erdMarkerArea,erdCrossingGaps} from '../src/features/workshop/erd-route-plan.ts'
import {routePoints} from '../src/features/workshop/erd-obstacle-route.ts'
import {erdDiagramImage} from '../src/features/workshop/erd-image-export.ts'
import {arrangeErd} from '../src/features/workshop/erd-layout.ts'
import {tableHeight} from '../src/features/workshop/tool-documents.ts'
import {createErdRouteCache} from '../src/features/workshop/erd-connection.ts'
import {readFileSync} from 'node:fs'

const table=(id,x,y)=>({id,name:id,x,y,fields:[{id:'id',name:'id',type:'INT',length:'',primary:true,nullable:false,unique:false,defaultValue:''},{id:'parent',name:'parent',type:'INT',length:'',primary:false,nullable:false,unique:false,defaultValue:''}]})
const relation=(id,fromTable,toTable,changes={})=>({id,fromTable,toTable,fromField:'id',toField:'parent',cardinality:'1:N',onDelete:'RESTRICT',...changes})
const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top
function segments(route){const points=routePoints(route.path);return points.slice(1).map((b,i)=>({a:points[i],b}))}
function shared(a,b){
    if(a.a.x===a.b.x&&b.a.x===b.b.x&&a.a.x===b.a.x) return Math.min(Math.max(a.a.y,a.b.y),Math.max(b.a.y,b.b.y))-Math.max(Math.min(a.a.y,a.b.y),Math.min(b.a.y,b.b.y))>0
    if(a.a.y===a.b.y&&b.a.y===b.b.y&&a.a.y===b.a.y) return Math.min(Math.max(a.a.x,a.b.x),Math.max(b.a.x,b.b.x))-Math.max(Math.min(a.a.x,a.b.x),Math.min(b.a.x,b.b.x))>0
    return false
}
function clearSymbols(routes){
    const markers=routes.flatMap(({relation,route})=>[route.source,route.target].map(port=>({...erdMarkerArea(port),owner:relation.id})))
    for(let i=0;i<markers.length;i++) for(const marker of markers.slice(i+1)) assert.ok(!overlap(markers[i],marker),'endpoint symbols must not overlap')
    for(const {relation,route} of routes) for(const {a,b} of segments(route)) for(const marker of markers.filter(m=>m.owner!==relation.id)) {
        const crosses=a.x===b.x?a.x>marker.left&&a.x<marker.right&&Math.max(a.y,b.y)>marker.top&&Math.min(a.y,b.y)<marker.bottom
            :a.y>marker.top&&a.y<marker.bottom&&Math.max(a.x,b.x)>marker.left&&Math.min(a.x,b.x)<marker.right
        assert.ok(!crosses,`${relation.id} crosses another endpoint's notation`)
    }
}

test('dense imported diagrams stay clear of borders and symbols before and after compact auto-arrange',()=>{
    // Geometry-only reproduction: no project, table, or column names are retained.
    const fixture=JSON.parse(readFileSync(new URL('./fixtures/erd-dense-routing.json',import.meta.url),'utf8'))
    const document={tables:fixture.tables.map(t=>({...table(t.id,t.x,t.y),fields:Array.from({length:t.columns},(_,i)=>({...table('sample',0,0).fields[0],id:`field-${i}`}))})),relationships:fixture.relationships}
    const compact=arrangeErd(document)
    const width=doc=>Math.max(...doc.tables.map(t=>t.x+300))-Math.min(...doc.tables.map(t=>t.x))
    assert.ok(width(compact)<width(document)*.9,'compaction must noticeably reduce the dense diagram width')
    for(const layout of [document,compact]) {
        const routes=planErdRoutes(layout)
        clearSymbols(routes)
        const tracks=routes.flatMap(({relation,route})=>segments(route).map(segment=>({...segment,owner:relation.id})))
        for(let i=0;i<tracks.length;i++) for(const other of tracks.slice(i+1)) {
            if(tracks[i].owner!==other.owner) assert.ok(!shared(tracks[i],other),`compaction must not merge relationship tracks: ${JSON.stringify({compact:layout===compact,a:tracks[i],b:other})}`)
        }
        for(const {relation,route} of routes) for(const {a,b} of segments(route)) for(const t of layout.tables) {
            const hugs=a.x===b.x?(Math.abs(a.x-t.x)<24||Math.abs(a.x-t.x-300)<24)&&Math.min(Math.max(a.y,b.y),t.y+tableHeight(t))-Math.max(Math.min(a.y,b.y),t.y)>0
                :(Math.abs(a.y-t.y)<24||Math.abs(a.y-t.y-tableHeight(t))<24)&&Math.min(Math.max(a.x,b.x),t.x+300)-Math.max(Math.min(a.x,b.x),t.x)>0
            assert.ok(!hugs,`${relation.id} runs along ${t.id}'s border: ${route.path}`)
        }
    }
})

test('shared fields receive separate visible ports and tracks beyond the former six-lane cycle',()=>{
    const document={tables:[table('a',0,0),table('b',800,200)],relationships:Array.from({length:8},(_,i)=>relation(`r${i}`,'a','b'))}
    const before=structuredClone(document),routes=planErdRoutes(document)
    clearSymbols(routes)
    for(let i=0;i<routes.length;i++) for(const other of routes.slice(i+1)) for(const a of segments(routes[i].route)) for(const b of segments(other.route)) assert.ok(!shared(a,b),`${routes[i].relation.id}/${other.relation.id} share a line segment`)
    assert.deepEqual(document,before,'routing must preserve saved pins and column semantics')
    const reversed=planErdRoutes({tables:[...document.tables].reverse(),relationships:[...document.relationships].reverse()})
    assert.deepEqual(Object.fromEntries(routes.map(r=>[r.relation.id,r.route])),Object.fromEntries(reversed.map(r=>[r.relation.id,r.route])))
    const image=erdDiagramImage(document)
    for(const {route} of routes) assert.ok(image.svg.includes(`d="${route.path}"`),'exports share the canvas routing')
})

test('opposing endpoint symbols in a narrow gap are moved to free attachment positions',()=>{
    const document={tables:[table('a',0,0),table('b',340,0)],relationships:[relation('r','a','b',{fromAnchor:{edge:'right',offset:.5},toAnchor:{edge:'left',offset:.5}})]}
    clearSymbols(planErdRoutes(document))
    assert.equal(document.relationships[0].fromAnchor.offset,.5)
})

test('unavoidable crossings have one underpass gap in both the canvas plan and export',()=>{
    const document={tables:[table('left',0,0),table('right',1000,0),table('top',500,-400),table('bottom',500,400)],relationships:[relation('horizontal','left','right',{toField:'id'}),relation('vertical','top','bottom',{fromAnchor:{edge:'bottom',offset:.5},toAnchor:{edge:'top',offset:.5}})]}
    const routes=planErdRoutes(document),gaps=erdCrossingGaps(routes)
    clearSymbols(routes)
    assert.ok([...gaps.values()].flat().length>0,JSON.stringify(routes.map(r=>[r.relation.id,r.route.path])))
    assert.match(erdDiagramImage(document).svg,/mask="url\(#erd-crossing-/)
})

test('auto-arrange widens gutters for busy entities, retains data, and stays deterministic',()=>{
    const document={tables:[table('hub',0,0),...Array.from({length:14},(_,i)=>table(`child${i}`,0,0))],relationships:Array.from({length:14},(_,i)=>relation(`r${i}`,'hub',`child${i}`))}
    const arranged=arrangeErd(document),xs=[...new Set(arranged.tables.map(t=>t.x))].sort((a,b)=>a-b)
    assert.ok(xs[1]-xs[0]>428,'busy boundaries receive more than the minimum 128px gutter')
    assert.ok(xs[1]-xs[0]<=540,'busy boundaries stay within a compact 240px gutter')
    assert.equal(arrangeErd(arranged),arranged)
    assert.deepEqual(arranged.relationships,document.relationships)
    clearSymbols(planErdRoutes(arranged))
    for(const {route} of planErdRoutes(arranged)) for(const {a,b} of segments(route)) for(const table of arranged.tables) {
        const crosses=a.x===b.x?a.x>table.x&&a.x<table.x+300&&Math.max(a.y,b.y)>table.y&&Math.min(a.y,b.y)<table.y+tableHeight(table)
            :a.y>table.y&&a.y<table.y+tableHeight(table)&&Math.max(a.x,b.x)>table.x&&Math.min(a.x,b.x)<table.x+300
        assert.ok(!crosses)
    }
})

test('joint routing reuses unaffected paths and invalidates a moved obstacle',()=>{
    const a=table('a',0,0),b=table('b',1000,0),far=table('far',3000,3000)
    const document={tables:[a,b,far],relationships:[relation('r','a','b')]},cache=createErdRouteCache()
    const original=planErdRoutes(document,cache)[0].route
    assert.equal(planErdRoutes({...document,tables:[a,b,{...far,x:3500}]},cache)[0].route,original)
    const blocked=planErdRoutes({...document,tables:[a,b,{...far,x:500,y:0}]},cache)[0].route
    assert.notEqual(blocked,original)
    assert.notEqual(blocked.path,original.path)
})

test('the 500-table, 2000-relationship layout keeps finite paths and reuses most routes during a drag',()=>{
    const tables=Array.from({length:500},(_,i)=>table(String(i).padStart(3,'0'),0,0))
    const relationships=Array.from({length:2000},(_,i)=>relation(`r${String(i).padStart(4,'0')}`,tables[i%500].id,tables[(i*17+1)%500].id))
    const document=arrangeErd({tables,relationships}),cache=createErdRouteCache(),first=planErdRoutes(document,cache)
    assert.equal(first.length,2000)
    assert.ok(first.every(entry=>Object.values(entry.route.bounds).every(Number.isFinite)))
    assert.equal(planErdRoutes(document,cache),first)
    const moved=planErdRoutes({...document,tables:document.tables.map((table,i)=>i?table:{...table,x:table.x+10})},cache)
    assert.ok(moved.filter((entry,i)=>entry.route===first[i].route).length>1900)
})
