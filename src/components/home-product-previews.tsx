import {Check, CheckCheck, Compass, Database, LayoutDashboard, LayoutGrid, ListTodo, MousePointer2, Network, Plus, StickyNote, Users} from "lucide-react"
import {type CSSProperties, useEffect, useState} from "react"
import {UserAvatar} from "@/components/user-avatar"
import type {AuthUser} from "@/features/auth/auth-types"
import {getUserHandle} from "@/features/auth/user-display"

type WorkshopTool = "todos" | "erd" | "notes"
const tourTools: WorkshopTool[] = ["todos", "erd", "notes"]

export function WorkshopTour() {
    const [step, setStep] = useState(0)
    useEffect(() => {
        const timer = window.setInterval(() => setStep(value => (value + 1) % tourTools.length), 3600)
        return () => window.clearInterval(timer)
    }, [])
    return <WorkshopScene hero preview tool={tourTools[step]}/>
}

const previewTodoColumns = [
    {name: "To do", state: "pending", tasks: [{title: "Build the homepage", label: "Frontend", assignee: "A"}, {title: "Check mobile layout", label: "Design", assignee: "K"}]},
    {name: "In progress", state: "progress", tasks: [{title: "Review the schema", label: "Database", assignee: "M"}]},
    {name: "Done", state: "done", tasks: [{title: "Choose the stack", label: "Planning", assignee: "A"}]},
]

export function WorkshopScene({hero = false, preview = false, tool = "todos"}: {hero?: boolean, preview?: boolean, tool?: WorkshopTool}) {
    return <div className={`landing-workshop-scene ${hero ? "landing-workshop-hero" : ""} ${preview ? "landing-workshop-playing" : ""}`} data-tool={tool} aria-hidden="true">
        <div className="landing-app-window">
            <div className="landing-window-bar"><span/><span/><span/><small>DevHub Workshop</small><LayoutGrid/></div>
            <div className="landing-app-layout">
                <div className="landing-app-sidebar"><strong><span>N</span>Northstar</strong><span><LayoutDashboard/>Dashboard</span><span><Users/>Teams</span><small>WEBSITE LAUNCH</small><span className={tool === "todos" ? "active" : ""}><ListTodo/>TODOs</span><span className={tool === "erd" ? "active" : ""}><Database/>ERD maker</span>{preview && <span className={tool === "notes" ? "active" : ""}><StickyNote/>Notes</span>}<div className="landing-app-members"><i>A</i><i>K</i><i>M</i></div></div>
                <div className="landing-app-main"><div className="landing-app-heading"><span><small>{preview ? {todos: "01 / TODOs", erd: "02 / ERD MAKER", notes: "03 / NOTES"}[tool] : "PROJECT"}</small><strong>Website launch</strong></span><Plus/></div><div className="landing-tour-panel" key={tool}>{tool === "todos" ? <TodoBoardPreview playing={preview}/> : tool === "erd" ? <ErdBoardPreview/> : <NoteEditorPreview/>}</div></div>
            </div>
        </div>
        {hero && <>{!preview && <div className="landing-floating-cursor"><MousePointer2/><span>Your team</span></div>}<div className="landing-floating-people">{[3, 8, 13].map(index => <img key={index} src={`/avatars/discovery/profile-${String(index).padStart(2, "0")}.png`} alt=""/>)}</div></>}
    </div>
}

function ErdBoardPreview() {
    return <div className="landing-tour-erd">
        <svg viewBox="0 0 320 190" fill="none"><path className="landing-tour-relationship" d="M130 62H164V134H190"/><circle cx="130" cy="62" r="3"/><path d="m181 126 9 8-9 8"/></svg>
        <div className="landing-tour-table"><strong><Database/>projects</strong><span>⌑ id <small>UUID</small></span><span>name <small>TEXT</small></span></div>
        <div className="landing-tour-table"><strong><Database/>tasks</strong><span>⌑ project_id <small>UUID</small></span><span>title <small>TEXT</small></span></div>
        <span className="landing-tour-sql">CREATE TABLE tasks (…)<i/></span>
    </div>
}

function NoteEditorPreview() {
    return <div className="landing-tour-notes"><div><span>✨ Sprint notes</span><h3>Make room for ideas.</h3><p><Check/>Plan the next release</p><p><Check/>Share it with the team</p><div className="landing-tour-typing">Write. Refine. Build together.</div><footer><CheckCheck/>Draft saved</footer></div><span className="landing-tour-note-back"/></div>
}

export function DiscoveryOrbitPreview({user}: {user?: AuthUser | null}) {
    const name = user ? `${user.firstName} ${user.lastName}`.trim() || getUserHandle(user) : "Alex Chen"
    return <div className="landing-orbit-preview" aria-hidden="true">
        <div className="landing-orbit-heading"><Compass/><span>Discovery</span><small>Find your people</small></div>
        {Array.from({length: 20}, (_, i) => <i className="landing-space-star" key={i} style={{left: `${(i * 43 + 9) % 95}%`, top: `${(i * 29 + 7) % 94}%`}}/>)}
        <div className="landing-orbit-system">
            <span className="landing-orbit-track"/><span className="landing-orbit-track landing-orbit-track-inner"/>
            <div className="landing-orbit-center">{user ? <UserAvatar className="landing-orbit-avatar" user={user}/> : <img src="/avatars/discovery/profile-06.png" alt=""/>}<strong>{name}</strong></div>
            {[{id: 2, name: "Maya", tech: "Design"}, {id: 9, name: "Leo", tech: "React"}, {id: 14, name: "Sam", tech: "Python"}, {id: 20, name: "Jules", tech: "Rust"}, {id: 23, name: "Kai", tech: "Node.js"}].map((person, index) => <div className="landing-orbit-person" key={person.id} style={{"--orbit-start": `${index * 72}deg`} as CSSProperties}><div><img src={`/avatars/discovery/profile-${String(person.id).padStart(2, "0")}.png`} alt=""/><strong>{person.name}</strong><span>{person.tech}</span></div></div>)}
        </div>
        <div className="landing-orbit-caption"><i/>A whole universe of people.</div>
    </div>
}

function TodoBoardPreview({playing = false}: {playing?: boolean}) {
    return <><div className="landing-todo-board">
        {previewTodoColumns.map(column => <div className="landing-todo-column" data-state={column.state} key={column.state}>
            <header><i/><strong>{column.name}</strong><small>{column.tasks.length}</small></header>
            {column.tasks.map((task, index) => <div className="landing-todo-card" key={task.title}>
                <span>{task.label}</span><strong>{task.title}</strong><footer><i>{task.assignee}</i>{column.state === "done" ? <Check/> : <small>Today</small>}</footer>
                {playing && column.state === "pending" && index === 0 && <div className="landing-task-cursor"><i/><MousePointer2/><span>Your team</span></div>}
            </div>)}
        </div>)}
    </div><div className="landing-todo-progress"><span>1 of 4 complete</span><div><i/></div></div></>
}

export function NotesSchemaScene() {
    return <div className="landing-tools-scene" aria-hidden="true">
        <div className="landing-tool-note"><div><span>✨ Sprint notes</span><small>•••</small></div><h3>The next<br/>good idea.</h3><p><Check/>Keep the useful bits</p><p><Check/>Make the connections</p><pre><span>## Next steps</span><br/>Ship the first version.</pre><footer><CheckCheck/>Draft saved in this browser</footer></div>
        <svg className="landing-schema-lines" viewBox="0 0 500 400" fill="none"><path d="M230 170 H292 V262 H334"/><circle cx="230" cy="170" r="4"/><path d="m326 254 8 8-8 8"/></svg>
        <div className="landing-schema-table landing-schema-project"><strong><Database/>projects</strong><span><b>id</b><small>UUID</small></span><span>name<small>TEXT</small></span></div>
        <div className="landing-schema-table landing-schema-task"><strong><Database/>tasks</strong><span><b>project_id</b><small>UUID</small></span><span>title<small>TEXT</small></span></div>
        <span className="landing-sql-tag"><Network/>SQL ↔ diagram</span>
    </div>
}

export function DiscoveryScene() {
    return <div className="landing-discovery-scene" aria-hidden="true">
        <span className="landing-discovery-orbit"/><span className="landing-discovery-orbit landing-discovery-orbit-two"/>
        {Array.from({length: 15}, (_, i) => <i className="landing-space-star" key={i} style={{left: `${(i * 43 + 9) % 95}%`, top: `${(i * 29 + 7) % 94}%`}}/>)}
        {[2, 9, 14, 20, 23].map(index => <img className="landing-discovery-traveler" key={index} src={`/avatars/discovery/profile-${String(index).padStart(2, "0")}.png`} alt="" loading="lazy"/>)}
        <div className="landing-profile-card"><span>PROFILE PREVIEW</span><img src="/avatars/discovery/profile-06.png" alt="" loading="lazy"/><strong>Your next discovery</strong><div><span>React</span><span>TypeScript</span><span>Node.js</span></div></div>
        <div className="landing-flight-speed"><span>Flight speed</span><strong>30%</strong><div><i/></div></div>
    </div>
}
