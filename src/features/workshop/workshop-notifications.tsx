import {useId, useState} from "react"
import {Bell, BellOff, Bug, Check, CheckCheck, ChevronRight, CircleCheck, Folder, LoaderCircle, RefreshCw, Users, X} from "lucide-react"
import {Popover} from "radix-ui"
import {useNavigate} from "react-router-dom"
import {Button} from "@/components/ui/button"
import {notificationAction, notificationHref, type WorkshopNotification} from "./notifications"
import {useNotificationsInfiniteQuery, useReadAllNotificationsMutation, useReadNotificationMutation} from "./notifications-api"
import "./notifications.css"

function ActivityIcon({kind}: {kind: string}) {
    if (kind.startsWith("team-")) return <Users/>
    if (kind.startsWith("task-") || kind.startsWith("todo-")) return <CircleCheck/>
    if (kind.startsWith("bug-")) return <Bug/>
    return <Folder/>
}

export function WorkshopNotifications({organizationId, userId, enabled}: {organizationId: string; userId: string; enabled: boolean}) {
    const headingId = useId(), descriptionId = useId()
    const [open, setOpen] = useState(false), [unreadOnly, setUnreadOnly] = useState(false), [error, setError] = useState("")
    const navigate = useNavigate(), scope = {organizationId, userId}
    const inbox = useNotificationsInfiniteQuery({...scope, unreadOnly}, {skip: !enabled, pollingInterval: 30000, skipPollingIfUnfocused: true, refetchOnFocus: true, refetchOnReconnect: true, refetchOnMountOrArgChange: true})
    const [read, reading] = useReadNotificationMutation(), [readAll, readingAll] = useReadAllNotificationsMutation()
    const data = inbox.currentData, first = data?.pages[0], unreadCount = first?.unreadCount ?? 0
    const items = [...new Map(data?.pages.flatMap(page => page.items).map(item => [item.id, item])).values()]
    const busy = reading.isLoading || readingAll.isLoading
    function changeOpen(next: boolean) {setOpen(next); setError(""); if (next && enabled) void inbox.refetch()}
    async function markRead(item: WorkshopNotification, follow = false) {
        setError("")
        try {
            if (!item.readAtUtc) await read({...scope, id: item.id}).unwrap()
            if (follow) {setOpen(false); navigate(notificationHref(organizationId, item))}
        } catch {setError("Could not update this notification. Please try again.")}
    }
    async function markAllRead() {
        if (!first) return
        setError("")
        try {await readAll({...scope, throughId: first.latestId}).unwrap()}
        catch {setError("Could not mark notifications as read. Please try again.")}
    }
    return <Popover.Root open={open} onOpenChange={changeOpen}>
        <Popover.Trigger asChild><Button variant="ghost" size="icon" className="workshop-icon-button workshop-notifications-trigger" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} title="Notifications"><Bell/>{unreadCount > 0 && <span className="workshop-notification-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span>}</Button></Popover.Trigger>
        <Popover.Portal><Popover.Content className="workshop-notifications-panel" side="bottom" align="end" sideOffset={10} collisionPadding={12} aria-labelledby={headingId} aria-describedby={descriptionId}>
            <header className="workshop-notifications-heading"><div className="workshop-notifications-title"><span><Bell/></span><h2 id={headingId}>Notifications</h2>{unreadCount > 0 && <small>{unreadCount} new</small>}</div><p id={descriptionId}>Your project and team activity, in one place.</p><Popover.Close asChild><Button className="workshop-notifications-close" variant="ghost" size="icon-sm" aria-label="Close notifications"><X/></Button></Popover.Close></header>
            <div className="workshop-notifications-controls"><div role="group" aria-label="Filter notifications"><Button variant="ghost" size="sm" aria-pressed={!unreadOnly} onClick={() => {setUnreadOnly(false); setError("")}}>All</Button><Button variant="ghost" size="sm" aria-pressed={unreadOnly} onClick={() => {setUnreadOnly(true); setError("")}}>Unread</Button></div><Button size="sm" variant="ghost" disabled={!enabled || !unreadCount || busy || !first} onClick={() => void markAllRead()}><CheckCheck/>Mark all read</Button></div>
            {error && <p className="workshop-notifications-error" role="alert">{error}</p>}
            <div className="workshop-notifications-scroll" aria-label="Notification inbox" aria-busy={inbox.isFetching}>
                {enabled && inbox.isError && <div className="workshop-notifications-empty" role="alert"><BellOff/><h3>Couldn’t load notifications</h3><p>Your activity will appear when the connection is restored.</p><Button variant="outline" size="sm" onClick={() => void inbox.refetch()}><RefreshCw/>Try again</Button></div>}
                {enabled && !data && !inbox.isError ? <div className="workshop-notifications-empty" role="status"><LoaderCircle className="animate-spin"/><p>Loading notifications…</p></div> : (!enabled || data) && !items.length && !inbox.isError ? <div className="workshop-notifications-empty"><span className="workshop-notifications-empty-icon">{unreadOnly ? <CheckCheck/> : <Bell/>}</span><h3>{unreadOnly ? "You’re all caught up" : "No notifications yet"}</h3><p>{!enabled ? "Activity notifications appear here for shared organizations." : unreadOnly ? "There are no unread updates right now." : "Updates to your projects and teams will appear here."}</p></div> : null}
                {!!items.length && <ul className="workshop-notifications-list">{items.map(item => <li key={item.id} data-unread={!item.readAtUtc}>
                    <button type="button" className="workshop-notification-open" disabled={busy} onClick={() => void markRead(item, true)}><span className="workshop-notification-icon"><ActivityIcon kind={item.kind}/></span><span className="workshop-notification-copy"><span><strong>{item.actorName}</strong> {notificationAction(item.kind)}</span><b>{item.title}</b><small>{item.projectName && <span>{item.projectName}<i aria-hidden="true">·</i></span>}<time dateTime={item.createdAtUtc} title={new Date(item.createdAtUtc).toLocaleString()}>{new Date(item.createdAtUtc).toLocaleString(undefined, {month: "short", day: "numeric", hour: "numeric", minute: "2-digit"})}</time>{!item.readAtUtc && <span className="sr-only">Unread</span>}</small></span><ChevronRight className="workshop-notification-arrow"/></button>
                    {!item.readAtUtc && <Button className="workshop-notification-read" variant="ghost" size="icon-sm" disabled={busy} aria-label={`Mark “${item.title}” as read`} title="Mark as read" onClick={() => void markRead(item)}><Check/></Button>}
                </li>)}</ul>}
                {inbox.hasNextPage && <div className="workshop-notifications-more"><Button variant="outline" size="sm" disabled={inbox.isFetching} onClick={() => void inbox.fetchNextPage()}>{inbox.isFetchingNextPage ? <LoaderCircle className="animate-spin"/> : null}Load older notifications</Button></div>}
            </div>
            <footer className="workshop-notifications-footer"><span>Only activity you have access to is shown.</span>{enabled && <Button variant="ghost" size="icon-sm" aria-label="Refresh notifications" disabled={inbox.isFetching} onClick={() => void inbox.refetch()}><RefreshCw className={inbox.isFetching ? "animate-spin" : ""}/></Button>}</footer>
            <Popover.Arrow className="workshop-notifications-arrow" width={12} height={6}/>
        </Popover.Content></Popover.Portal>
    </Popover.Root>
}
