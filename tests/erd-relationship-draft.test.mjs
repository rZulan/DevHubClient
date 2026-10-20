import test from 'node:test'
import assert from 'node:assert/strict'
import {erdRelationshipError, reattachErdEnd, suggestErdColumns} from '../src/features/workshop/erd-relationship-draft.ts'
import {connectionTargetAt} from '../src/features/workshop/connection-drag.ts'

const column = (id, changes = {}) => ({id, name: id, type:'UUID', primary:false, unique:false, nullable:false, ...changes})
const source = {id:'users', name:'users', x:0, y:0, fields:[column('name',{type:'TEXT'}), column('id',{primary:true})]}
const target = {id:'orders', name:'orders', x:500, y:0, fields:[column('id',{primary:true}), column('user_id',{nullable:true}), column('reviewer_id')]}
const document = {tables:[source,target],relationships:[]}
const relation = {id:'new',fromTable:'users',fromField:'id',toTable:'orders',toField:'user_id',cardinality:'1:N',leftEnd:'one',rightEnd:'many',onDelete:'RESTRICT'}

test('reattaching within a table preserves the schema and freezes the other endpoint', () => {
    const before=structuredClone(document), next=reattachErdEnd(document,relation,'to',{tableId:'orders',anchor:{edge:'bottom',offset:.7}})
    assert.deepEqual({...next,fromAnchor:undefined,toAnchor:undefined},{...relation,fromAnchor:undefined,toAnchor:undefined})
    assert.deepEqual(next.toAnchor,{edge:'bottom',offset:.7})
    assert.equal(next.fromAnchor.edge,'right')
    assert.deepEqual(document,before)
})
test('reattaching to a new table proposes compatible columns and keeps the original unchanged until saved', () => {
    const another={...target,id:'invoices',fields:[column('invoice_id',{primary:true}),column('customer_id',{nullable:true})]}
    const doc={tables:[source,target,another],relationships:[relation]}, before=structuredClone(doc)
    const next=reattachErdEnd(doc,{...relation,onDelete:'SET NULL'},'to',{tableId:'invoices',anchor:{edge:'top',offset:.5}})
    assert.equal(next.id,relation.id); assert.equal(next.fromField,'id'); assert.equal(next.toField,'customer_id')
    assert.equal(next.onDelete,'SET NULL'); assert.equal(next.cardinality,'1:N')
    assert.equal(erdRelationshipError(doc,next),'')
    assert.deepEqual(doc,before)
    assert.equal(reattachErdEnd(doc,relation,'from',{tableId:'missing',anchor:{edge:'right',offset:.5}}),undefined)
})
test('a new table without a valid column requires an explicit choice instead of changing constraints', () => {
    const another={...target,id:'no-valid-key',fields:[column('text',{type:'TEXT'})]}
    const next=reattachErdEnd({...document,tables:[source,target,another]},relation,'from',{tableId:another.id,anchor:{edge:'left',offset:.5}})
    assert.equal(next.fromField,''); assert.equal(next.toField,'user_id'); assert.equal(next.onDelete,'RESTRICT')
})

test('drag suggestions choose a compatible key and non-primary target without mutating fields', () => {
    const before = structuredClone(document)
    assert.deepEqual(suggestErdColumns(document,'users','orders'),{fromField:'id',toField:'user_id'})
    assert.deepEqual(document,before)
    assert.equal(erdRelationshipError(document,relation),'')
})
test('drag suggestions avoid columns that already have the same relationship', () => {
    assert.deepEqual(suggestErdColumns({...document,relationships:[relation]},'users','orders'),{fromField:'id',toField:'reviewer_id'})
    assert.match(erdRelationshipError({...document,relationships:[relation]}, {...relation,id:'other'}),/already connected/)
    assert.equal(erdRelationshipError({...document,relationships:[relation]},relation),'')
})
test('self references use different columns and missing/empty tables stay unselected', () => {
    assert.deepEqual(suggestErdColumns(document,'orders','orders'),{fromField:'id',toField:'user_id'})
    assert.match(erdRelationshipError(document,{...relation,toTable:'users',toField:'id'}),/different columns/)
    assert.deepEqual(suggestErdColumns(document,'missing','orders'),{fromField:'',toField:''})
    assert.deepEqual(suggestErdColumns({tables:[{...source,fields:[]},target],relationships:[]},'users','orders'),{fromField:'',toField:'id'})
})
test('exhausted key relationships do not suggest an invalid non-key pair', () => {
    const doc = {...document,tables:[source,{...target,fields:[...target.fields,column('title',{type:'TEXT'})]}],relationships:target.fields.map(field=>({...relation,id:field.id,toField:field.id}))}
    assert.deepEqual(suggestErdColumns(doc,'users','orders'),{fromField:'id',toField:''})
})
test('relationship validation rejects stale columns, incompatible types and non-key references', () => {
    assert.match(erdRelationshipError(document,{...relation,fromField:'missing'}),/Choose a column/)
    assert.match(erdRelationshipError(document,{...relation,fromField:'name'}),/same data type/)
    assert.match(erdRelationshipError(document,{...relation,fromTable:'orders',fromField:'reviewer_id',toTable:'users',toField:'id'}),/primary or unique/)
})
test('SET NULL requires a nullable foreign key and many-to-one checks the right key', () => {
    assert.equal(erdRelationshipError(document,{...relation,onDelete:'SET NULL'}),'')
    assert.match(erdRelationshipError(document,{...relation,toField:'id',onDelete:'SET NULL'}),/nullable target/)
    const reversed = {...relation,fromTable:'orders',fromField:'user_id',toTable:'users',toField:'id',cardinality:'N:1',leftEnd:'many',rightEnd:'one'}
    assert.equal(erdRelationshipError(document,reversed),'')
    assert.match(erdRelationshipError(document,{...reversed,toTable:'orders',toField:'reviewer_id'}),/primary or unique/)
})
test('drag targets exclude the source, prefer the frontmost table, and reject empty canvas drops', () => {
    const nodes = [{id:'source',x:0,y:0,width:300,height:114},{id:'a',x:400,y:100,width:300,height:114},{id:'b',x:410,y:110,width:300,height:114}]
    assert.equal(connectionTargetAt(nodes,{x:50,y:50},'source'),undefined)
    assert.equal(connectionTargetAt(nodes,{x:420,y:120},'source')?.id,'b')
    assert.equal(connectionTargetAt(nodes,{x:405,y:105},'source')?.id,'a')
    assert.equal(connectionTargetAt(nodes,{x:395,y:105},'source',6)?.id,'a')
    assert.equal(connectionTargetAt(nodes,{x:-50,y:200},'source'),undefined)
})
