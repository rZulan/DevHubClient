import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {bugFileError, bugFileLimits, bugFormData, bugStatuses, bugPriorities} from '../src/features/workshop/bug-reports.ts'
import {grantsWorkshopPermission} from '../src/features/workshop/workshop-permissions.ts'

test('attachment limits handle file count, individual and combined sizes, types and empty files', () => {
    const file = {name: 'screenshot.PNG', size: 100}
    assert.equal(bugFileError([]), '')
    assert.equal(bugFileError([file]), '')
    assert.match(bugFileError(Array(6).fill(file)), /5 files/)
    assert.match(bugFileError([{...file,size: 0}]), /nonempty/)
    assert.match(bugFileError([{...file,size: bugFileLimits.file + 1}]), /10 MB/)
    assert.match(bugFileError(Array(3).fill({...file,size: bugFileLimits.file})), /25 MB/)
    assert.match(bugFileError([{...file,name: 'executable.exe'}]), /Use images/)
    assert.match(bugFileError([{...file,name: 'unsafe.svg'}]), /Use images/)
    for (const name of ['recording.mp4','recording.webm','debug.log','error.json','notes.txt','report.pdf','screenshot.webp','evidence.zip']) assert.equal(bugFileError([{...file,name}]),'')
})

test('multipart submission retains the email, category, stable submission id and file bytes', async () => {
    const file = new File(['console error'],'console.log',{type:'text/plain'})
    const data = bugFormData('stable-request', {email:' tester@example.test ',title:'Broken button',description:'Expected save to work',steps:'Click save',environment:'Chrome',priority:'high',categoryId:'category'},[file])
    assert.equal(data.get('email'),'tester@example.test')
    assert.equal(data.get('submissionId'),'stable-request')
    assert.equal(data.get('categoryId'),'category')
    assert.equal(data.get('files').name,'console.log')
    assert.equal(await data.get('files').text(),'console error')
    const uncategorized = bugFormData('stable-request',{email:'a@example.test',title:'Bug',description:'Broken',steps:'',environment:'',priority:'medium',categoryId:''},[])
    assert.equal(uncategorized.has('categoryId'),false)
})

test('bug triage is a separate permission and does not expand project access', () => {
    assert.equal(grantsWorkshopPermission(['Manage bug reports'],'Manage bug reports'),true)
    assert.equal(grantsWorkshopPermission(['Administrator'],'Manage bug reports'),true)
    for (const permission of ['Manage notes','Manage wiki','Manage projects','Edit ideation']) assert.equal(grantsWorkshopPermission([permission],'Manage bug reports'),false)
    assert.equal(grantsWorkshopPermission(['Manage bug reports'],'View all projects'),false)
    assert.deepEqual(bugStatuses.map(status=>status.id),['new','triaged','in-progress','resolved','closed'])
    assert.deepEqual(bugPriorities.map(priority=>priority.id),['low','medium','high','critical'])
})

test('public route stays outside authentication and has a submission-only API', () => {
    const router = readFileSync(new URL('../src/app/router.tsx',import.meta.url),'utf8')
    assert.ok(router.indexOf('path: "report-bug/:token"') < router.indexOf('id: "protected"'))
    const loaders = readFileSync(new URL('../src/app/route-loaders.ts',import.meta.url),'utf8')
    assert.ok(loaders.indexOf('url.pathname.startsWith("/report-bug/")') < loaders.indexOf('await ensureSessionRestored()'))
})
