// Uses the real page and navigation with isolated, persistent preview API responses.
import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, Outlet, Route, Routes, useLocation} from "react-router-dom"
import {store} from "@/app/store"
import {WorkshopCalendarPage} from "@/pages/workshop/workshop-calendar-page"
import {WorkshopTodoPage} from "@/pages/workshop/workshop-todo-page"
import {ProjectToolsNavigation} from "@/features/workshop/project-tools-navigation"
import {projectNavigationCategories} from "@/features/workshop/project-tools"
import {toolDocumentsApi, type SavedToolDocument} from "@/features/workshop/tool-documents-api"
import {todoApi, type Todo} from "@/features/workshop/todo-api"
import {calendarToday, shiftCalendarDate, validCalendarDocument} from "@/features/workshop/calendar-document"
import {seedOrganizations} from "@/features/workshop/workshop-data"
import {ResponsiveWorkshopPanel} from "@/features/workshop/responsive-workshop-panel"
import {todoDateError} from "@/features/workshop/todo-schedule"
import {useCompactWorkshop} from "@/hooks/use-compact-workshop"
import type {WorkshopOutletContext} from "@/layouts/workshop-layout"
import "@/index.css"

const today = calendarToday('Asia/Manila'), org = seedOrganizations[0]
const project = {...org.projects[0],id:'calendar-preview-project',name:'Atlas workspace'}
const key = (id: string) => `isolated-calendar-api:${id}`
function load(id: string): SavedToolDocument {
    const cached = localStorage.getItem(key(id)); if (cached) return JSON.parse(cached)
    return {revision:0, document:{timeZone:'Asia/Manila',events: id === project.id ? [
        {id:'planning',title:'Sprint planning',description:'Review the next sprint together.',kind:'meeting',startDate:today,endDate:today,allDay:false,startTime:'09:00',endTime:'10:00'},
        {id:'release',title:'Release candidate',description:'Feature freeze and final checks.',kind:'milestone',startDate:shiftCalendarDate(today,3),endDate:shiftCalendarDate(today,3),allDay:true,startTime:'',endTime:''},
        {id:'research',title:'Usability review',description:'Test the Workshop flow.',kind:'event',startDate:shiftCalendarDate(today,-2),endDate:today,allDay:true,startTime:'',endTime:''},
    ]:[]}}
}
toolDocumentsApi.injectEndpoints({overrideExisting:true,endpoints:builder=>({
    getToolDocument:builder.query({queryFn:({projectId}:{projectId:string})=>({data:load(projectId)})}),
    saveToolDocument:builder.mutation({queryFn:({projectId,revision,document}:{projectId:string}&SavedToolDocument)=>{
        if (!validCalendarDocument(document)) return {error:{status:400,data:'Invalid calendar'}}
        if (load(projectId).revision !== revision) return {error:{status:409,data:'Conflict'}}
        const next={revision:revision+1,document}; localStorage.setItem(key(projectId),JSON.stringify(next)); return {data:next}
    }}),
})})
const todoKey = (id: string) => `isolated-calendar-todos-v2:${id}`
function loadTodos(id: string): Todo[] {
    const saved = localStorage.getItem(todoKey(id)); if (saved) return JSON.parse(saved)
    return id === project.id ? [{id:'deadline',projectId:id,name:'Ship calendar & navigation',description:'Validate the release.',startDate:shiftCalendarDate(today,-3),targetDate:shiftCalendarDate(today,5),createdAtUtc:new Date().toISOString(),tasks:[
        {id:'review',todoId:'deadline',projectId:id,title:'Review the calendar layout',description:'Check dates on desktop and mobile.',status:'progress',assigneeId:null,assigneeIds:[],startDate:shiftCalendarDate(today,-1),targetDate:shiftCalendarDate(today,2)},
        {id:'regression',todoId:'deadline',projectId:id,title:'Run regression tests',description:'',status:'pending',assigneeId:null,assigneeIds:[],startDate:shiftCalendarDate(today,2),targetDate:shiftCalendarDate(today,4)},
        {id:'done',todoId:'deadline',projectId:id,title:'Confirm release scope',description:'',status:'done',assigneeId:null,assigneeIds:[],targetDate:today},
    ],columns:[{id:'pending',name:'Pending'},{id:'progress',name:'In progress'},{id:'done',name:'Done'}],boardRevision:0}] : []
}
type PreviewScope = {organizationId:string;projectId:string}
const tags = (scope:PreviewScope) => [{type:'Todos' as const,id:`/organizations/${scope.organizationId}/projects/${scope.projectId}/todos`}]
function savePreviewDates(arg:PreviewScope & {todoId:string;boardRevision:number;startDate:string|null;targetDate:string|null;taskId?:string;title?:string;description?:string;status?:string;assigneeIds?:string[]}) {
    const boards=loadTodos(arg.projectId), board=boards.find(item=>item.id===arg.todoId)
    if(!board) return {error:{status:404,data:'Missing'}}
    if(board.boardRevision!==arg.boardRevision) return {error:{status:409,data:'Conflict'}}
    if(todoDateError(arg.startDate,arg.targetDate)) return {error:{status:400,data:'Invalid range'}}
    const task=arg.taskId ? board.tasks.find(item=>item.id===arg.taskId) : undefined
    if(arg.taskId && !task) return {error:{status:404,data:'Missing'}}
    if(task) Object.assign(task,{title:arg.title,description:arg.description,status:arg.status,assigneeIds:arg.assigneeIds,startDate:arg.startDate,targetDate:arg.targetDate})
    else Object.assign(board,{startDate:arg.startDate,targetDate:arg.targetDate})
    board.boardRevision++; localStorage.setItem(todoKey(arg.projectId),JSON.stringify(boards))
    return {data:task ?? board}
}
todoApi.injectEndpoints({overrideExisting:true,endpoints:builder=>({
    listTodos:builder.query<Todo[],PreviewScope>({queryFn:({projectId})=>({data:loadTodos(projectId)}),providesTags:(_data,_error,scope)=>tags(scope)}),
    getTodo:builder.query({queryFn:({projectId,todoId}:PreviewScope & {todoId:string})=>{const board=loadTodos(projectId).find(item=>item.id===todoId);return board?{data:board}:{error:{status:404,data:'Missing'}}},providesTags:(_data,_error,scope)=>tags(scope)}),
    todoPages:builder.infiniteQuery({infiniteQueryOptions:{initialPageParam:0,getNextPageParam:()=>undefined},queryFn:({queryArg}:{queryArg:PreviewScope})=>({data:{items:loadTodos(queryArg.projectId),hasMore:false}}),providesTags:(_data,_error,scope)=>tags(scope)}),
    updateTodoDates:builder.mutation({queryFn:savePreviewDates,invalidatesTags:(_data,_error,scope)=>tags(scope)}),
    updateTodoTask:builder.mutation({queryFn:savePreviewDates,invalidatesTags:(_data,_error,scope)=>tags(scope)}),
    createTodo:builder.mutation({queryFn:(arg:PreviewScope & {name:string;description:string;startDate:string|null;targetDate:string|null})=>{
        const boards=loadTodos(arg.projectId),board:Todo={id:crypto.randomUUID(),projectId:arg.projectId,name:arg.name,description:arg.description,startDate:arg.startDate,targetDate:arg.targetDate,createdAtUtc:new Date().toISOString(),tasks:[],columns:[{id:'pending',name:'Pending'},{id:'progress',name:'In progress'},{id:'done',name:'Done'}],boardRevision:0};boards.push(board);localStorage.setItem(todoKey(arg.projectId),JSON.stringify(boards));return {data:board}
    },invalidatesTags:(_data,_error,scope)=>tags(scope)}),
    createTodoTask:builder.mutation({queryFn:(arg:PreviewScope & {todoId:string;title:string;description:string;status:string;assigneeIds:string[];startDate:string|null;targetDate:string|null})=>{
        const boards=loadTodos(arg.projectId),board=boards.find(item=>item.id===arg.todoId);if(!board)return {error:{status:404,data:'Missing'}}
        const task={id:crypto.randomUUID(),todoId:board.id,projectId:arg.projectId,title:arg.title,description:arg.description,status:arg.status,assigneeId:null,assigneeIds:arg.assigneeIds,startDate:arg.startDate,targetDate:arg.targetDate};board.tasks.push(task);board.boardRevision++;localStorage.setItem(todoKey(arg.projectId),JSON.stringify(boards));return {data:task}
    },invalidatesTags:(_data,_error,scope)=>tags(scope)}),
})})
export function Preview() {
    const [dark,setDark]=useState(false),[readonly,setReadonly]=useState(false),[projectId,setProjectId]=useState(project.id),[open,setOpen]=useState(false),[groups,setGroups]=useState<Record<string,boolean>>({planning:true,design:true,knowledge:true})
    const compact=useCompactWorkshop(), location=useLocation()
    useEffect(()=>{document.documentElement.classList.toggle('dark',dark);return()=>document.documentElement.classList.remove('dark')},[dark])
    useEffect(()=>setOpen(false),[location.pathname])
    const context:WorkshopOutletContext={organization:{...org,ownerUserId:readonly?'other-owner':'current',roles:readonly?[]:org.roles},project:{...project,id:projectId,name:projectId===project.id?'Atlas workspace':'Another project'},isPersistedOrganization:true,selectProject:setProjectId,canInvite:false,openInviteDialog(){},previewColorScheme(){}}
    return <div className="workshop-shell members-collapsed">
        <ResponsiveWorkshopPanel compact={compact} open={open} onOpenChange={setOpen} title="Workshop navigation" side="left"><aside className="workshop-sidebar"><div className="workshop-org-header"><strong style={{padding:16,fontSize:16}}>Atlas Studio</strong></div><nav className="workshop-nav" aria-label="Project navigation">{projectNavigationCategories.map(category=><ProjectToolsNavigation key={category.id} userId="calendar-preview" organizationId="calendar-preview" category={category} expanded={groups[category.id]} onToggle={()=>setGroups(current=>({...current,[category.id]:!current[category.id]}))}/>)}</nav></aside></ResponsiveWorkshopPanel>
        <section className="workshop-main-column"><header className="workshop-topbar"><div>{compact&&<button onClick={()=>setOpen(true)} aria-label="Open workshop navigation">Menu</button>}<h1>Calendar</h1></div><div style={{display:'flex',gap:14,fontSize:12,flexWrap:'wrap',alignItems:'center'}}><label><input type="checkbox" checked={dark} onChange={event=>setDark(event.target.checked)}/> Dark theme</label><label><input type="checkbox" checked={readonly} onChange={event=>setReadonly(event.target.checked)}/> Read-only</label><select aria-label="Preview project" value={projectId} onChange={event=>setProjectId(event.target.value)}><option value={project.id}>Atlas workspace</option><option value="other-project">Another project</option></select></div></header><main className="workshop-content"><Outlet context={context}/></main></section>
    </div>
}
createRoot(document.getElementById('root')!).render(<Provider store={store}><MemoryRouter initialEntries={['/calendar']}><Routes><Route element={<Preview/>}><Route path="calendar" element={<WorkshopCalendarPage/>}/><Route path="todo" element={<WorkshopTodoPage/>}/><Route path="workshop/:organizationId/todo" element={<WorkshopTodoPage/>}/><Route path="*" element={<p style={{padding:24}}>Isolated preview</p>}/></Route></Routes></MemoryRouter></Provider>)
