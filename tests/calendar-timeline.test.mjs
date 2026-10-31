import test from 'node:test'
import assert from 'node:assert/strict'
import {calendarDayOffset, calendarGanttRange} from '../src/features/workshop/calendar-timeline.ts'

test('timeline day widths stay inclusive over DST, leap days and year boundaries', () => {
    assert.equal(calendarDayOffset('2026-03-07', '2026-03-10'), 3)
    assert.equal(calendarDayOffset('2026-10-31', '2026-11-03'), 3)
    assert.equal(calendarDayOffset('2024-02-28', '2024-03-01'), 2)
    assert.equal(calendarDayOffset('2026-12-31', '2027-01-01'), 1)
    assert.deepEqual(calendarGanttRange({startDate:'2026-10-29',endDate:'2026-10-29'}, '2026-10-01', '2026-10-31'), {first:28,span:1,continuesBefore:false,continuesAfter:false})
})

test('Gantt ranges clip to the visible month without losing continuation or end dates', () => {
    const range = (startDate, endDate) => calendarGanttRange({startDate,endDate}, '2026-10-01', '2026-10-31')
    assert.deepEqual(range('2026-09-28','2026-10-03'), {first:0,span:3,continuesBefore:true,continuesAfter:false})
    assert.deepEqual(range('2026-10-29','2026-11-04'), {first:28,span:3,continuesBefore:false,continuesAfter:true})
    assert.deepEqual(range('2026-09-01','2026-12-31'), {first:0,span:31,continuesBefore:true,continuesAfter:true})
    assert.equal(range('2026-09-01','2026-09-30'), null)
    assert.equal(range('2026-11-01','2026-11-02'), null)
})
