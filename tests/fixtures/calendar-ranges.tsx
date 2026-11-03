import {useState} from "react"
import {createRoot} from "react-dom/client"
import {ProjectCalendar} from "@/features/workshop/project-calendar"
import type {CalendarItem} from "@/features/workshop/calendar-document"
import "@/index.css"

const defaults = {description:"Overlapping schedules must keep their full date range visible.", allDay:true, startTime:"", endTime:""}
const items: CalendarItem[] = [
    {...defaults, id:"todo", title:"Workspace release", kind:"todo", startDate:"2026-10-22", endDate:"2026-10-30"},
    {...defaults, id:"milestone", title:"Release milestone", kind:"milestone", startDate:"2026-10-29", endDate:"2026-11-06", allDay:false, startTime:"09:00", endTime:"10:00"},
    ...Array.from({length:5}, (_, index): CalendarItem => ({...defaults, id:`meeting-${index}`, title:`Review ${index + 1}`, kind:"meeting", startDate:"2026-10-29", endDate:"2026-10-29"})),
]
export function Preview() {
    const [opened, setOpened] = useState<CalendarItem | null>(null)
    return <main className="dark" style={{minHeight:"100dvh", background:"var(--background)", color:"var(--foreground)"}}>
        <ProjectCalendar items={items} timeZone="Asia/Manila" canEdit={false} onAdd={() => {}} onOpen={setOpened}/>
        {opened && <p role="status" style={{padding:16}}>{opened.title}: {opened.startDate} – {opened.endDate}</p>}
    </main>
}
createRoot(document.getElementById("root")!).render(<Preview/>)
