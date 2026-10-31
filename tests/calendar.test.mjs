import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarDate, calendarEventError, calendarItems, calendarItemsOnDay, calendarMonthDays, calendarToday, calendarWeekSegments, shiftCalendarDate, shiftCalendarMonth, validCalendarDate, validCalendarDocument} from '../src/features/workshop/calendar-document.ts'
import {todoDateError, readTodoDates} from '../src/features/workshop/todo-schedule.ts'

const event = {id:'event',title:'Release review',description:'Review',kind:'meeting',startDate:'2026-10-28',endDate:'2026-10-28',allDay:false,startTime:'09:00',endTime:'10:00'}
test('month grids start on Monday, cross years, and retain leap days', () => {
    const days = calendarMonthDays('2026-10-28')
    assert.equal(days.length,42); assert.equal(days[0],'2026-09-28'); assert.equal(days.at(-1),'2026-11-08')
    assert.equal(new Set(days).size,42)
    assert.ok(calendarMonthDays('2024-02-16').includes('2024-02-29'))
    assert.equal(shiftCalendarDate('2026-12-31',1),'2027-01-01')
    assert.equal(shiftCalendarMonth('2024-01-31',1),'2024-02-29')
    assert.equal(shiftCalendarMonth('2026-03-31',-1),'2026-02-28')
    assert.equal(calendarDate(new Date('2026-10-28T12:00:00')),'2026-10-28')
    assert.equal(calendarToday('Asia/Manila',new Date('2026-10-27T17:00:00Z')),'2026-10-28')
})

test('TODO and task schedules are inclusive, independent and linked to the correct task', () => {
    const items = calendarItems({timeZone:'Asia/Manila',events:[]},[
        {id:'board',name:'Launch',description:'Board',startDate:'2026-10-26',targetDate:'2026-11-02',columns:[{id:'queue'},{id:'shipped'}],tasks:[
            {id:'design',title:'Design',description:'Task',status:'queue',startDate:'2026-10-28',targetDate:'2026-10-30'},
            {id:'ship',title:'Ship',status:'shipped',targetDate:'2026-11-03'},
            {id:'unscheduled',title:'Backlog',status:'queue'},
        ]},
        {id:'no-board-date',name:'Unscheduled board',description:'',targetDate:null,columns:[],tasks:[{id:'standalone',title:'Own date',status:'pending',targetDate:'2026-10-29'}]},
    ])
    assert.equal(items.length,4)
    const task = items.find(item=>item.id==='task:design')
    assert.equal(task.todoId,'board'); assert.equal(task.taskId,'design'); assert.equal(task.parentTitle,'Launch')
    assert.equal(task.startDate,'2026-10-28'); assert.equal(task.endDate,'2026-10-30'); assert.equal(task.completed,false)
    assert.equal(items.find(item=>item.id==='task:ship').completed,true)
    assert.equal(items.find(item=>item.id==='task:ship').startDate,'2026-11-03')
    assert.equal(items.find(item=>item.id==='todo:board').completed,false)
    assert.equal(calendarItemsOnDay(items,'2026-10-30').some(item=>item.id===task.id),true)
    assert.equal(calendarItemsOnDay(items,'2026-10-31').some(item=>item.id===task.id),false)
    assert.equal(items.some(item=>item.id==='task:standalone'),true)
})

test('week bars clip across weeks and months while preserving inclusive endpoints', () => {
    const item={...event,id:'range',startDate:'2026-10-29',endDate:'2026-11-04'}
    let [segment]=calendarWeekSegments([item],'2026-10-26')
    assert.deepEqual([segment.first,segment.last,segment.lane,segment.continuesBefore,segment.continuesAfter],[3,6,0,false,true])
    ;[segment]=calendarWeekSegments([item],'2026-11-02')
    assert.deepEqual([segment.first,segment.last,segment.continuesBefore,segment.continuesAfter],[0,2,true,false])
    assert.equal(calendarWeekSegments([item],'2026-11-09').length,0)
    const sunday={...item,startDate:'2026-11-01',endDate:'2026-11-01'}
    assert.equal(calendarWeekSegments([sunday],'2026-10-26')[0].first,6)
    assert.equal(calendarWeekSegments([sunday],'2026-11-02').length,0)
})

test('overlapping ranges never share a lane, while separated ranges reuse it', () => {
    const ranges=[['a','2026-10-26','2026-10-28'],['b','2026-10-28','2026-10-30'],['c','2026-10-29','2026-10-29'],['d','2026-10-28','2026-10-28'],['e','2026-10-28','2026-10-28'],['f','2026-10-28','2026-10-28']].map(([id,startDate,endDate])=>({...event,id,startDate,endDate}))
    const segments=calendarWeekSegments(ranges,'2026-10-26')
    for(const a of segments) for(const b of segments) if(a.item.id!==b.item.id && a.lane===b.lane) assert.ok(a.last<b.first || b.last<a.first)
    assert.equal(segments.find(s=>s.item.id==='a').lane,segments.find(s=>s.item.id==='c').lane)
    assert.ok(segments.some(s=>s.lane>=3),'busy weeks retain hidden entries for the overflow counts and agenda')
    assert.deepEqual(calendarWeekSegments([...ranges].reverse(),'2026-10-26'),segments,'ordering is deterministic')
})

test('TODO schedule validates optional From, target-only, clearing and reversed ranges', () => {
    for(const [start,target] of [[null,null],[null,'2026-10-28'],['2026-10-28','2026-10-28'],['2026-10-28','2026-11-02']]) assert.equal(todoDateError(start,target),'')
    assert.match(todoDateError('2026-10-28',null),/target/)
    assert.match(todoDateError('2026-10-29','2026-10-28'),/after/)
    assert.match(todoDateError(null,'2026-02-29'),/valid/)
    const form=new FormData(); form.set('startDate',''); form.set('targetDate','2026-10-28')
    assert.deepEqual(readTodoDates(form),{startDate:null,targetDate:'2026-10-28'})
})
test('event validation rejects invalid dates, durations, duplicates and malformed data', () => {
    const valid = events => validCalendarDocument({timeZone:'Asia/Manila',events})
    assert.equal(valid([event]),true)
    assert.equal(valid([{...event,allDay:true,startTime:'',endTime:''}]),true)
    for(const value of ['2026-02-29','2026-02-30','not-a-date',null,'2026-13-01']) assert.equal(validCalendarDate(value),false)
    for(const change of [{title:''},{endDate:'2026-10-27'},{endTime:'08:00'},{endTime:'09:00'},{startTime:'24:00'},{allDay:true},{description:null},{kind:'todo'}]) assert.equal(valid([{...event,...change}]),false)
    assert.equal(valid([event,event]),false)
    assert.equal(validCalendarDocument({timeZone:'invalid',events:[]}),false)
    assert.equal(validCalendarDocument({timeZone:'Pacific Standard Time',events:[]}),false)
    assert.match(calendarEventError({...event,endTime:'08:00'}),/after/)
    assert.equal(valid([{...event,endDate:'2026-10-29',endTime:'08:00'}]),true)
})
test('calendar includes inclusive multi-day events and real TODO board deadlines without inventing task dates', () => {
    const items=calendarItems({timeZone:'UTC',events:[{...event,id:'span',startDate:'2026-10-27',endDate:'2026-10-30'},{...event,id:'later',startTime:'15:00',endTime:'16:00'}]},[
        {id:'board',name:'Release',description:'Ship',targetDate:'2026-10-28',tasks:[{status:'finished'}],columns:[{id:'pending'},{id:'finished'}]},
        {id:'undated',name:'Backlog',description:'',targetDate:null,tasks:[],columns:[]},
    ])
    assert.equal(items.length,3)
    assert.equal(calendarItemsOnDay(items,'2026-10-30').length,1)
    assert.equal(calendarItemsOnDay(items,'2026-10-31').length,0)
    assert.equal(items.find(item=>item.kind==='todo').completed,true)
    assert.equal(items.find(item=>item.kind==='todo').todoId,'board')
    assert.deepEqual(calendarItemsOnDay(items,'2026-10-28').map(item=>item.id),['span','todo:board','later'])
})
