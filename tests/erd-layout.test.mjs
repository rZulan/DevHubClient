import test from 'node:test'
import assert from 'node:assert/strict'
import {applyErdAutoArrange, arrangeErd} from '../src/features/workshop/erd-layout.ts'
import {routeErdRelationship} from '../src/features/workshop/erd-connection.ts'
import {tableHeight} from '../src/features/workshop/tool-documents.ts'

const table = (id, count = 2) => ({id, name: id, x: -300, y: -100, fields: Array.from({length:count}, (_, index) => ({id:`field-${index}`, name:`column_${index}`, type:'UUID', length:'', primary:index===0, nullable:false, unique:false, defaultValue:''}))})
const relation = (fromTable, toTable, id = `${fromTable}-${toTable}`) => ({id, fromTable, toTable, fromField:'field-0', toField:'field-1', cardinality:'1:N', leftEnd:'one', rightEnd:'many', onDelete:'RESTRICT'})
const positions = document => Object.fromEntries(document.tables.map(({id,x,y}) => [id,{x,y}]))

test('auto arrange off preserves manual positions when the schema changes', () => {
    const current = {tables:[table('users')],relationships:[]}
    const next = {...current,tables:[...current.tables,{...table('orders'),x:700,y:240}]}
    assert.equal(applyErdAutoArrange(current,next,false),next)
    assert.deepEqual(positions(next),{users:{x:-300,y:-100},orders:{x:700,y:240}})
})

test('auto arrange on reflows added tables, relationships and changed table heights', () => {
    const current = {tables:[table('users'),table('orders')],relationships:[]}
    const related = {...current,relationships:[relation('users','orders')]}
    assert.deepEqual(applyErdAutoArrange(current,related,true),arrangeErd(related))
    const larger = {...current,tables:[table('users',12),current.tables[1]]}
    const arranged = applyErdAutoArrange(current,larger,true)
    assert.deepEqual(arranged,arrangeErd(larger))
    noOverlap(arranged)
    const added = {...current,tables:[...current.tables,table('products')]}
    noOverlap(applyErdAutoArrange(current,added,true))
})

test('auto arrange reflows completed drops and table edits, while off preserves those positions', () => {
    const current = {tables:[table('users'),table('orders')],relationships:[relation('users','orders')]}
    const moved = {...current,tables:current.tables.map((value,index)=>({...value,x:index*650,y:120}))}
    assert.deepEqual(applyErdAutoArrange(current,moved,true),arrangeErd(moved))
    assert.equal(applyErdAutoArrange(current,moved,false),moved)
    const edited = {...current,tables:[{...current.tables[0],fields:current.tables[0].fields.map(field=>({...field,name:'renamed_column'}))},current.tables[1]]}
    assert.deepEqual(applyErdAutoArrange(current,edited,true),arrangeErd(edited))
    assert.equal(applyErdAutoArrange(current,edited,false),edited)
})

test('auto arrange retains direct relationship pins and ignores unchanged documents', () => {
    const current = {tables:[table('users'),table('orders')],relationships:[relation('users','orders')]}
    const pinned = {...current,relationships:[{...current.relationships[0],fromAnchor:{edge:'bottom',offset:.5}}]}
    assert.equal(applyErdAutoArrange(current,pinned,true),pinned)
    assert.equal(applyErdAutoArrange(current,current,true),current)
})
function noOverlap(document) {
    for (const [i, a] of document.tables.entries()) for (const b of document.tables.slice(i+1)) {
        assert.ok(a.x+300<=b.x || b.x+300<=a.x || a.y+tableHeight(a)<=b.y || b.y+tableHeight(b)<=a.y, `${a.id} overlaps ${b.id}`)
    }
}
function clearPaths(document) {
    const tables = new Map(document.tables.map(t=>[t.id,t]))
    for (const [index, r] of document.relationships.entries()) {
        const route = routeErdRelationship(tables.get(r.fromTable),tables.get(r.toTable),r.fromField,r.toField,index%6*12,r,document.tables)
        let previous
        for (const match of route.path.matchAll(/([MHVL])(-?[\d.]+)(?: (-?[\d.]+))?/g)) {
            const next = match[1]==='H' ? {x:+match[2],y:previous.y} : match[1]==='V' ? {x:previous.x,y:+match[2]} : {x:+match[2],y:+match[3]}
            if (previous) for (const t of document.tables) {
                const crosses = previous.x===next.x
                    ? next.x>t.x && next.x<t.x+300 && Math.max(previous.y,next.y)>t.y && Math.min(previous.y,next.y)<t.y+tableHeight(t)
                    : next.y>t.y && next.y<t.y+tableHeight(t) && Math.max(previous.x,next.x)>t.x && Math.min(previous.x,next.x)<t.x+300
                assert.ok(!crosses, `${r.id} crosses ${t.id}`)
            }
            previous=next
        }
    }
}

test('auto arrange preserves schema and constraints, replaces manual pins, and does not mutate its input', () => {
    const document = {tables:[table('users'),table('orders',8),table('isolated')],relationships:[{...relation('users','orders'),fromAnchor:{edge:'bottom',offset:.2},toAnchor:{edge:'top',offset:.8}}]}
    const before = structuredClone(document), arranged = arrangeErd(document)
    assert.deepEqual(document,before)
    assert.deepEqual(arranged.tables.map(({x:_x,y:_y,...t})=>t),before.tables.map(({x:_x,y:_y,...t})=>t))
    assert.deepEqual(arranged.relationships,[relation('users','orders')])
    assert.equal(arranged.tables[0].y,arranged.tables[1].y, 'simple chains align their table headers')
    assert.ok(arranged.tables.every(t=>Number.isInteger(t.x)&&Number.isInteger(t.y)&&t.x>=80&&t.y>=80))
    noOverlap(arranged); clearPaths(arranged)
})

test('branches, shared children, cycles, and differently sized tables have clear connection gutters', () => {
    const document = {tables:[table('a',12),table('b'),table('c',8),table('d',1),table('e',20),table('f'),table('g')],
        relationships:[relation('a','b'),relation('a','c'),relation('b','d'),relation('c','d'),relation('d','e'),relation('e','b'),relation('d','f'),relation('f','g'),relation('g','g')]}
    const arranged=arrangeErd(document)
    noOverlap(arranged); clearPaths(arranged)
    const self=routeErdRelationship(arranged.tables.at(-1),arranged.tables.at(-1),'field-0','field-0')
    assert.ok(self.bounds.height>24, 'automatic self references retain a visible loop')
})

test('layout is stable across repeated clicks, table order, and relationship order', () => {
    const document={tables:['a','b','c','d','e'].map(id=>table(id)),relationships:[relation('a','b'),relation('b','c'),relation('c','a'),relation('e','d')]}
    const arranged=arrangeErd(document)
    assert.equal(arrangeErd(arranged),arranged,'an unchanged layout must not add another undo step')
    assert.deepEqual(positions(arrangeErd({tables:[...document.tables].reverse(),relationships:[...document.relationships].reverse()})),positions(arranged))
})

test('long chains fold into rows while every route avoids table bodies', () => {
    const document={tables:Array.from({length:25},(_,i)=>table(`table-${String(i).padStart(2,'0')}`,i%5+1)),relationships:Array.from({length:24},(_,i)=>relation(`table-${String(i).padStart(2,'0')}`,`table-${String(i+1).padStart(2,'0')}`))}
    const arranged=arrangeErd(document)
    assert.ok(Math.max(...arranged.tables.map(t=>t.x))-Math.min(...arranged.tables.map(t=>t.x))<=1500)
    noOverlap(arranged); clearPaths(arranged)
})

test('unconnected tables pack into rows rather than one tall stack', () => {
    const arranged=arrangeErd({tables:Array.from({length:30},(_,i)=>table(`table-${i}`,i%7+1)),relationships:[]})
    noOverlap(arranged)
    assert.ok(new Set(arranged.tables.map(t=>t.x)).size>1)
    assert.ok(new Set(arranged.tables.map(t=>t.y)).size>1)
})

test('a broad hub uses multiple columns and fills its unused column space with disconnected tables', () => {
    const children = Array.from({length: 36}, (_, i) => table(`child-${String(i).padStart(2, '0')}`, i % 7 + 3))
    const hub = table('hub', 12), connected = {tables: [hub, ...children], relationships: children.map(t => relation(hub.id, t.id))}
    const arranged = arrangeErd(connected)
    const height = Math.max(...arranged.tables.map(t => t.y + tableHeight(t))) - 80
    const formerTower = children.reduce((sum, t) => sum + tableHeight(t) + 80, -80)
    assert.ok(height < formerTower / 2, `${height} should use less than half the former ${formerTower} tower height`)
    assert.ok(new Set(arranged.tables.filter(t => t.id !== hub.id).map(t => t.x)).size >= 3)
    noOverlap(arranged); clearPaths(arranged)
    const withIsolated = arrangeErd({...connected, tables: [...connected.tables, table('isolated-a'), table('isolated-b')]})
    assert.ok(withIsolated.tables.filter(t => t.id.startsWith('isolated')).every(t => t.y + tableHeight(t) <= 80 + height), 'disconnected tables reuse vertical gaps')
    noOverlap(withIsolated); clearPaths(withIsolated)
    assert.equal(arrangeErd(withIsolated), withIsolated)
    assert.deepEqual(positions(arrangeErd({tables: [...connected.tables].reverse(), relationships: [...connected.relationships].reverse()})), positions(arranged))
})

test('empty documents and missing relationship targets are handled without losing data', () => {
    const empty={tables:[],relationships:[]}; assert.equal(arrangeErd(empty),empty)
    const document={tables:[table('a')],relationships:[relation('a','missing')]}
    assert.deepEqual(arrangeErd(document).relationships,document.relationships)
})

test('the supported 500-table and 2000-relationship limit produces finite, non-overlapping positions', () => {
    const tables=Array.from({length:500},(_,i)=>table(String(i).padStart(3,'0'),i%10+1))
    const relationships=Array.from({length:2000},(_,i)=>relation(tables[i%500].id,tables[(i*17+1)%500].id,String(i)))
    const arranged=arrangeErd({tables,relationships})
    assert.equal(arranged.relationships.length,2000)
    assert.ok(arranged.tables.every(t=>Number.isFinite(t.x)&&Number.isFinite(t.y)))
    noOverlap(arranged)
})
