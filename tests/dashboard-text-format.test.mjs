import assert from 'node:assert/strict'
import test from 'node:test'
import {dashboardFormattingRange, dashboardTextRuns, editDashboardRowText, replaceDashboardRuns, resolveDashboardTextRuns, sliceDashboardRuns} from '../src/features/workshop/dashboard-text-format.ts'

test('formatting any part of a placeholder styles the full token and its resolved value', () => {
  const row = {text: 'Hi %org_name%, welcome', bold: true}
  const range = dashboardFormattingRange(row.text, {start: 6, end: 9})
  assert.deepEqual(range, {start: 3, end: 13})
  assert.deepEqual(dashboardFormattingRange(row.text, {start: 8, end: 8}), range)
  const runs = dashboardTextRuns(row)
  const replacement = sliceDashboardRuns(runs, range.start, range.end).map(run => ({...run, color: '#168b67', font: 'Georgia'}))
  const edited = replaceDashboardRuns(runs, range, replacement)
  const shown = resolveDashboardTextRuns({...row, runs: edited}, {org_name: 'Design Studio'})
  assert.deepEqual(shown.map(({text, bold, color, font}) => [text, bold, color, font]), [
    ['Hi ', true, undefined, undefined], ['Design Studio', true, '#168b67', 'Georgia'], [', welcome', true, undefined, undefined],
  ])
})

test('a selection does not split a visible character or style the rest of its row', () => {
  const row = {text: 'A👩🏽‍💻B', italic: true}
  const range = dashboardFormattingRange(row.text, {start: 2, end: 3})
  const runs = dashboardTextRuns(row)
  const selected = sliceDashboardRuns(runs, range.start, range.end)
  assert.equal(selected[0].text, '👩🏽‍💻')
  const edited = replaceDashboardRuns(runs, range, selected.map(run => ({...run, italic: false, underline: true})))
  assert.deepEqual(edited.map(({text, italic, underline}) => [text, italic, underline]), [
    ['A', true, undefined], ['👩🏽‍💻', undefined, true], ['B', true, undefined],
  ])
})

test('editing caption text in image settings preserves formatting outside the edit', () => {
  const row = {text: 'Hi 👩🏽‍💻 from %org_name%', align: 'right', runs: [
    {text: 'Hi ', bold: true}, {text: '👩🏽‍💻 from '}, {text: '%org_name%', color: '#168b67'},
  ]}
  const edited = editDashboardRowText(row, 'Hi 👨🏽‍💻 from %org_name%')
  assert.equal(edited.align, 'right')
  assert.deepEqual(resolveDashboardTextRuns(edited, {org_name: 'Zevont'}).map(({text, bold, color}) => [text, bold, color]), [
    ['Hi ', true, undefined], ['👨🏽‍💻 from ', undefined, undefined], ['Zevont', undefined, '#168b67'],
  ])
})
