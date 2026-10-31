// Uses real inbox UI with isolated in-memory API responses. No application writes.
import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {Provider} from "react-redux"
import {MemoryRouter, useLocation} from "react-router-dom"
import {store} from "@/app/store"
import {WorkshopNotifications} from "@/features/workshop/workshop-notifications"
import {notificationsApi} from "@/features/workshop/notifications-api"
import type {NotificationPage, WorkshopNotification} from "@/features/workshop/notifications"
import "@/index.css"

const orgId = "notification-preview"
let failRead = false, failWrite = false, serial = 35
const items: WorkshopNotification[] = [
    {kind: "task-assigned", title: "Review release checklist", actorName: "Nina Chen", projectId: "atlas", projectName: "Atlas workspace", contextId: "release-board", targetId: "review-release"},
    {kind: "team-member-added", title: "Platform team", actorName: "Alex Morgan", projectId: null, projectName: null, contextId: "platform", targetId: "platform"},
    {kind: "bug-created", title: "Search results overlap on mobile", actorName: "Public reporter", projectId: "atlas", projectName: "Atlas workspace", contextId: "search-bug", targetId: "search-bug"},
    {kind: "project-updated", title: "Atlas workspace", actorName: "Sam Rivera", projectId: "atlas", projectName: "Atlas workspace", contextId: "atlas", targetId: "atlas"},
    {kind: "task-updated", title: "Ship onboarding flow", actorName: "Alex Morgan", projectId: "atlas", projectName: "Atlas workspace", contextId: "sprint-board", targetId: "onboarding"},
    ...Array.from({length: 30}, (_, index) => ({kind: "team-updated", title: `Earlier team activity ${index + 1}`, actorName: "Alex Morgan", projectId: null, projectName: null, contextId: "platform", targetId: "platform"})),
].map((item, index) => ({...item, id: 35 - index, createdAtUtc: new Date(Date.UTC(2026, 9, 27, 2, 30 - index * 5)).toISOString(), readAtUtc: index < 5 ? null : "2026-10-27T02:30:00Z"}))
notificationsApi.injectEndpoints({overrideExisting: true, endpoints: builder => ({
    notifications: builder.infiniteQuery<NotificationPage, {organizationId: string; userId: string; unreadOnly: boolean}, number | null>({
        infiniteQueryOptions: {initialPageParam: null, getNextPageParam: last => last.nextCursor ?? undefined},
        queryFn: ({queryArg, pageParam}) => {
            if (failRead) return {error: {status: 503, data: {detail: "Preview connection error"}}}
            const available = queryArg.userId === "preview-user" ? items : []
            const filtered = available.filter(item => (!queryArg.unreadOnly || !item.readAtUtc) && (pageParam === null || item.id < pageParam))
            return {data: structuredClone({items: filtered.slice(0, 25), unreadCount: available.filter(item => !item.readAtUtc).length, latestId: available[0]?.id ?? 0, nextCursor: filtered.length > 25 ? filtered[24].id : null})}
        }, providesTags: [{type: "Notifications", id: orgId}],
    }),
    readNotification: builder.mutation({queryFn: ({id}: {id: number}) => {if (failWrite) return {error: {status: 503, data: {detail: "Preview update failed"}}}; const item = items.find(item => item.id === id); if (item) item.readAtUtc = new Date().toISOString(); return {data: undefined}}, invalidatesTags: [{type: "Notifications", id: orgId}]}),
    readAllNotifications: builder.mutation({queryFn: ({throughId}: {throughId: number}) => {if (failWrite) return {error: {status: 503, data: {detail: "Preview update failed"}}}; items.filter(item => item.id <= throughId).forEach(item => item.readAtUtc ??= new Date().toISOString()); return {data: undefined}}, invalidatesTags: [{type: "Notifications", id: orgId}]}),
})})
export function Preview() {
    const [userId, setUserId] = useState("preview-user"), [dark, setDark] = useState(true)
    const location = useLocation()
    useEffect(() => {document.documentElement.classList.toggle("dark", dark)}, [dark])
    function refresh() {store.dispatch(notificationsApi.util.invalidateTags([{type: "Notifications", id: orgId}]))}
    return <div style={{display: "flex", height: "100dvh", flexDirection: "column", background: "var(--background)", color: "var(--foreground)"}}>
        <nav aria-label="Preview controls" style={{display: "flex", flexWrap: "wrap", gap: 16, padding: "12px 20px", fontSize: 12, borderBottom: "1px solid var(--border)"}}>
            <strong>Isolated notification preview</strong><label><input type="checkbox" checked={dark} onChange={event => setDark(event.target.checked)}/> Dark theme</label>
            <label>User <select aria-label="Preview user" value={userId} onChange={event => setUserId(event.target.value)}><option value="preview-user">Alex</option><option value="other-user">Other account</option></select></label>
            <label><input type="checkbox" onChange={event => {failRead = event.target.checked; refresh()}}/> Connection error</label><label><input type="checkbox" onChange={event => {failWrite = event.target.checked}}/> Update error</label>
            <button onClick={() => {items.unshift({...items[0], id: ++serial, title: "New release activity", readAtUtc: null, createdAtUtc: new Date().toISOString()}); refresh()}}>Add activity</button>
        </nav>
        <header className="workshop-topbar" style={{background: "var(--background)", minHeight: 72, padding: "16px 28px"}}><div><small>Atlas workspace</small><h1>Workshop</h1></div><div className="workshop-topbar-actions"><WorkshopNotifications key={userId} organizationId={orgId} userId={userId} enabled/></div></header>
        <main style={{padding: "48px 36px", flex: 1}}><span style={{fontSize: 11, color: "var(--muted-foreground)"}}>PROJECT WORKSPACE</span><h2 style={{fontSize: 30, marginTop: 12}}>Your work, together.</h2><p style={{color: "var(--muted-foreground)", marginTop: 12, fontSize: 14}}>Use the bell to see project and team activity.</p><output aria-label="Current destination" style={{display: "block", marginTop: 40, fontSize: 12}}>{location.pathname}{location.search}</output></main>
    </div>
}
const root = createRoot(document.getElementById("root")!)
root.render(<Provider store={store}><MemoryRouter initialEntries={[`/workshop/${orgId}/dashboard`]}><Preview/></MemoryRouter></Provider>)
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount())
