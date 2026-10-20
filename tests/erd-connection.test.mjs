import test from 'node:test'
import assert from 'node:assert/strict'
import {erdAnchorPort, erdAttachmentAt, erdConnectionBounds, routeErdRelationship} from '../src/features/workshop/erd-connection.ts'
import {tableHeight, validToolDocument} from '../src/features/workshop/tool-documents.ts'
import {combinedBounds, fitBounds} from '../src/features/workshop/canvas-view.ts'

const table = (id, x, y) => ({id, name: id, x, y, fields: [{id: 'id'}, {id: 'parent_id'}]})
test('separated tables connect facing column rows with room for both notations', () => {
    const route = routeErdRelationship(table('a', 0, 0), table('b', 500, 100), 'id', 'parent_id')
    assert.deepEqual(route.source, {x: 300, y: 66, edge: 'right'})
    assert.deepEqual(route.target, {x: 500, y: 198, edge: 'left'})
    assert.equal(route.path, 'M300 66 H400 V198 H500')
})
test('reversed tables orient both notations outside their cards', () => {
    const route = routeErdRelationship(table('a', 500, 0), table('b', 0, 100), 'id', 'parent_id')
    assert.equal(route.source.edge, 'left')
    assert.equal(route.target.edge, 'right')
    assert.equal(route.path, 'M500 66 H400 V198 H300')
})
test('stacked tables route around the outer edge instead of through card bodies', () => {
    const route = routeErdRelationship(table('a', 0, 0), table('b', 0, 250), 'id', 'parent_id')
    assert.equal(route.source.x, 300)
    assert.equal(route.target.x, 300)
    assert.equal(route.source.edge, 'right')
    assert.equal(route.target.edge, 'right')
    assert.equal(route.path, 'M300 66 H348 V348 H300')
})
test('nearby tables keep the same compact route as the canvas zoom changes', () => {
    const a = table('a', 0, 0), b = table('b', 400, 150)
    assert.equal(routeErdRelationship(a, b, 'id', 'parent_id').target.edge, 'left')
    const document = {tables: [a, b], relationships: [{fromTable:'a', toTable:'b', fromField:'id', toField:'parent_id'}]}
    const bounds = erdConnectionBounds(document)
    assert.deepEqual(bounds, [{x: 300, y: 54, width: 100, height: 206}])
})

test('endpoint drops choose the nearest edge, preserve offsets, and ignore empty canvas', () => {
    const a = table('a', 100, 200), height = tableHeight(a)
    for (const [point, edge, offset] of [
        [{x: 100, y: 200 + height / 4}, 'left', .25],
        [{x: 400, y: 200 + height * .75}, 'right', .75],
        [{x: 175, y: 200}, 'top', .25],
        [{x: 325, y: 200 + height}, 'bottom', .75],
    ]) {
        const target = erdAttachmentAt([a], point)
        assert.deepEqual(target, {tableId:'a', anchor:{edge,offset}})
        assert.deepEqual(erdAnchorPort(a, target.anchor), {...point,edge})
    }
    assert.equal(erdAttachmentAt([a], {x:0,y:0}), undefined)
    assert.equal(erdAttachmentAt([a], {x:95,y:220}, 8)?.anchor.edge, 'left')
    assert.equal(erdAttachmentAt([a, {...a,id:'front'}], {x:100,y:220})?.tableId, 'front')
})

test('all sixteen manual edge pairs route outside table interiors and move with their tables', () => {
    const a = table('a', -200, 0), b = table('b', 450, 250), edges = ['left','right','top','bottom']
    for (const left of edges) for (const right of edges) {
        const anchors = {fromAnchor:{edge:left,offset:.4},toAnchor:{edge:right,offset:.6}}
        const route = routeErdRelationship(a,b,'id','parent_id',0,anchors)
        assert.deepEqual(route.source, erdAnchorPort(a,anchors.fromAnchor))
        assert.deepEqual(route.target, erdAnchorPort(b,anchors.toAnchor))
        const points = [...route.path.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map(match=>({x:Number(match[1]),y:Number(match[2])}))
        for (let i=1;i<points.length;i++) {
            const p=points[i-1], q=points[i]
            assert.ok(p.x===q.x || p.y===q.y, `${left}/${right}: orthogonal`)
            for (const t of [a,b]) for(let step=1;step<20;step++) {
                const x=p.x+(q.x-p.x)*step/20, y=p.y+(q.y-p.y)*step/20
                assert.ok(!(x>t.x && x<t.x+300 && y>t.y && y<t.y+tableHeight(t)),`${left}/${right}: avoids ${t.id}`)
            }
        }
        const moved = routeErdRelationship({...a,x:a.x+40,y:a.y-30},b,'id','parent_id',0,anchors)
        assert.equal(moved.source.x,route.source.x+40); assert.equal(moved.source.y,route.source.y-30)
        assert.deepEqual(moved.target,route.target)
    }
})

test('manual self-references use different edges and retain a visible loop', () => {
    const a = table('a',0,0)
    const route = routeErdRelationship(a,a,'id','parent_id',0,{fromAnchor:{edge:'top',offset:.25},toAnchor:{edge:'bottom',offset:.75}})
    assert.equal(route.source.y,0); assert.equal(route.target.y,tableHeight(a))
    assert.ok(route.bounds.x<0 || route.bounds.x+route.bounds.width>300)
    const samePort = routeErdRelationship(a,a,'id','parent_id',0,{fromAnchor:{edge:'right',offset:.5},toAnchor:{edge:'right',offset:.5}})
    assert.ok(samePort.bounds.height>=48)
    assert.ok((samePort.path.match(/L/g)??[]).length>=4)
})

test('manual attachments in narrow gaps shorten their leads instead of crossing table bodies', () => {
    const a=table('a',0,0), b=table('b',320,0)
    const route=routeErdRelationship(a,b,'id','parent_id',0,{fromAnchor:{edge:'right',offset:.5},toAnchor:{edge:'left',offset:.5}})
    assert.equal(route.path,'M300 57 L320 57')
    assert.ok(route.bounds.x<=290 && route.bounds.x+route.bounds.width>=330)
})

test('draft validation preserves valid attachments and rejects malformed positions', () => {
    const fields=[{id:'id',name:'id',type:'UUID',length:'',defaultValue:'',primary:true,nullable:false,unique:false}]
    const doc={tables:[{...table('a',0,0),fields},{...table('b',500,0),fields}],relationships:[{id:'r',fromTable:'a',toTable:'b',fromField:'id',toField:'id',cardinality:'1:1',onDelete:'RESTRICT',fromAnchor:{edge:'bottom',offset:.4}}]}
    assert.equal(validToolDocument('erd',JSON.parse(JSON.stringify(doc))),true)
    for(const anchor of [{edge:'diagonal',offset:.5},{edge:'left',offset:-1},{edge:'top',offset:1.1},{edge:'right',offset:'0.5'},{edge:'bottom',offset:Infinity},null]) {
        assert.equal(validToolDocument('erd',{...doc,relationships:[{...doc.relationships[0],fromAnchor:anchor}]}),false)
    }
})
test('self relationships loop outside the card and parallel lanes remain distinct', () => {
    const a = table('a', -200, -100)
    assert.equal(routeErdRelationship(a, a, 'id', 'parent_id').path, 'M100 -34 H148 V-2 H100')
    assert.equal(routeErdRelationship(a, a, 'id', 'parent_id', 12).path, 'M100 -34 H160 V-2 H100')
})
test('fit includes outer routes and notations, even with negative positions and reduced zoom', () => {
    const tables = [table('a', -400, -200), table('b', -400, 200)]
    const document = {tables, relationships: [{fromTable:'a', toTable:'b', fromField:'id', toField:'parent_id'}]}
    const viewport = {width: 400, height: 350}
    const nodes = tables.map(item => ({...item, width:300, height:114}))
    const bounds = combinedBounds([...nodes, ...erdConnectionBounds(document)])
    const view = fitBounds(bounds, viewport)
    assert.ok(bounds.x * view.zoom + view.pan.x >= 0)
    assert.ok((bounds.x + bounds.width) * view.zoom + view.pan.x <= viewport.width)
    assert.ok(bounds.y * view.zoom + view.pan.y >= 0)
    assert.ok((bounds.y + bounds.height) * view.zoom + view.pan.y <= viewport.height)
    assert.deepEqual(erdConnectionBounds({tables, relationships:[{fromTable:'missing',toTable:'b'}]}), [])
})
