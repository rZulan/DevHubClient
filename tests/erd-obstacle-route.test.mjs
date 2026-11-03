import test from 'node:test'
import assert from 'node:assert/strict'
import {routeErdRelationship, erdConnectionBounds, createErdRouteCache} from '../src/features/workshop/erd-connection.ts'
import {erdDiagramImage} from '../src/features/workshop/erd-image-export.ts'
import {tableHeight} from '../src/features/workshop/tool-documents.ts'
import {planErdRoutes} from '../src/features/workshop/erd-route-plan.ts'
import {avoidErdObstacles,routePoints,erdRouteClearance} from '../src/features/workshop/erd-obstacle-route.ts'

const table = (id, x, y, count = 2) => ({id, name: id, x, y, fields: Array.from({length: count}, (_, i) => ({id: i ? `column_${i}` : 'id', name: i ? `column_${i}` : 'id', type: 'INT', length: '', primary: i === 0, nullable: false, unique: false, defaultValue: ''}))})
const relation = {id: 'r', fromTable: 'a', toTable: 'b', fromField: 'id', toField: 'column_1', cardinality: '1:N', onDelete: 'RESTRICT'}

test('shared routing cannot double back onto its own table border after leaving a port',()=>{
    const a=table('a',0,0),b=table('b',1000,200)
    const original={source:{x:0,y:66,edge:'left'},target:{x:1000,y:266,edge:'left'},path:'M0 66 L-48 66 L0 66 L0 -48 L952 -48 L952 266 L1000 266',bounds:{x:-60,y:-60,width:1072,height:338}}
    const route=avoidErdObstacles(original,a,b,[a,b],0,{areas:[],segments:[]})
    assert.notEqual(route.path,original.path)
    const path=routePoints(route.path)
    assert.ok(path[1].x<=-48,'leave room for the complete source notation before turning')
    for(let i=1;i<path.length;i++) {
        const p=path[i-1],q=path[i]
        if(p.x===q.x && Math.min(Math.max(p.y,q.y),tableHeight(a))-Math.max(Math.min(p.y,q.y),0)>0) {
            assert.ok(Math.abs(p.x-a.x)>=erdRouteClearance && Math.abs(p.x-a.x-300)>=erdRouteClearance)
        }
    }
})
function points(path) {
    const result = []
    for (const m of path.matchAll(/([MLHV])(-?[\d.]+)(?: (-?[\d.]+))?/g)) result.push(m[1] === 'H' ? {x:+m[2],y:result.at(-1).y} : m[1] === 'V' ? {x:result.at(-1).x,y:+m[2]} : {x:+m[2],y:+m[3]})
    return result
}
function clear(route, tables) {
    const path = points(route.path)
    for (let i = 1; i < path.length; i++) {
        const a = path[i-1], b = path[i]
        assert.ok(a.x === b.x || a.y === b.y)
        for (const t of tables) assert.ok(!(a.x === b.x
            ? a.x > t.x && a.x < t.x+300 && Math.max(a.y,b.y) > t.y && Math.min(a.y,b.y) < t.y+tableHeight(t)
            : a.y > t.y && a.y < t.y+tableHeight(t) && Math.max(a.x,b.x) > t.x && Math.min(a.x,b.x) < t.x+300), `route crosses ${t.id}`)
    }
    for (const p of path) assert.ok(p.x >= route.bounds.x && p.y >= route.bounds.y && p.x <= route.bounds.x+route.bounds.width && p.y <= route.bounds.y+route.bounds.height)
}

test('automatic connections can weave through multiple blockers with more than four bends', () => {
    const a = table('a',0,0), b = table('b',1900,0)
    const tables = [a,b,table('wall-a',480,-2400,86),table('wall-b',960,-400,86),table('wall-c',1440,-2400,86)]
    const before = structuredClone(tables), route = routeErdRelationship(a,b,'id','column_1',0,relation,tables)
    clear(route,tables)
    assert.ok(points(route.path).length >= 8, route.path)
    assert.deepEqual(route.source,{x:300,y:66,edge:'right'})
    assert.deepEqual(route.target,{x:1900,y:98,edge:'left'})
    assert.deepEqual(tables,before)
    const document = {tables,relationships:[relation]}
    const planned = planErdRoutes(document)[0].route
    clear(planned,tables)
    assert.deepEqual(planned.source,route.source)
    assert.deepEqual(planned.target,route.target)
    assert.deepEqual(erdConnectionBounds(document),[planned.bounds])
    assert.ok(erdDiagramImage(document).svg.includes(`d="${planned.path}"`), 'PNG uses the same cleared detour as the canvas')
})

test('manual attachments and coincident self loops avoid unrelated tables', () => {
    const a=table('a',0,0), b=table('b',1000,300), blocker=table('blocker',500,-100,20), tables=[a,b,blocker]
    const anchors={fromAnchor:{edge:'top',offset:.5},toAnchor:{edge:'bottom',offset:.5}}
    const route=routeErdRelationship(a,b,'id','column_1',0,anchors,tables)
    clear(route,tables)
    assert.equal(route.source.edge,'top'); assert.equal(route.target.edge,'bottom')
    const close=table('close',340,-50,6)
    const loop=routeErdRelationship(a,a,'id','id',0,{},[a,close])
    clear(loop,[a,close]); assert.ok(points(loop.path).length>=6)
})

test('moving, removing, or adding an obstacle invalidates affected routes but preserves distant cached paths', () => {
    const a=table('a',0,0), b=table('b',1000,0), blocker=table('blocker',500,-50,8), far=table('far',3000,3000)
    const cached=createErdRouteCache(), original=cached(a,b,relation,0,[a,b,blocker,far])
    clear(original,[a,b,blocker,far])
    assert.equal(cached(a,b,relation,0,[a,b,blocker,{...far,x:4000}]),original)
    const moved={...blocker,y:1200}, direct=cached(a,b,relation,0,[a,b,moved,far])
    assert.notEqual(direct,original); assert.equal(direct.path,routeErdRelationship(a,b,'id','column_1').path)
    const obstructed=cached(a,b,relation,0,[a,b,blocker,far])
    assert.notEqual(obstructed,direct); clear(obstructed,[a,b,blocker,far])
    const removed=cached(a,b,relation,0,[a,b,far])
    assert.equal(removed.path,direct.path)
})
