import {useCallback, useEffect, useState, useSyncExternalStore} from "react"
import {createPortal} from "react-dom"
import {Toast} from "radix-ui"
import {CircleAlert, CircleCheck, Info, Lightbulb, TriangleAlert, X} from "lucide-react"
import {workshopToastStore} from "./workshop-toast-store"
import "./workshop-toaster.css"

const icons = {error: CircleAlert, warning: TriangleAlert, success: CircleCheck, info: Info, tip: Lightbulb}
export function WorkshopToaster() {
    const items = useSyncExternalStore(workshopToastStore.subscribe, workshopToastStore.getSnapshot, workshopToastStore.getSnapshot)
    const [announcer, setAnnouncer] = useState<Element>()
    const viewport = useCallback((node: HTMLOListElement | null) => {
        if (node && typeof node.showPopover === "function" && !node.matches(":popover-open")) node.showPopover()
    }, [])
    useEffect(() => {
        function update() {setAnnouncer([...document.querySelectorAll('[data-slot="dialog-content"][data-state="open"], [role="alertdialog"][data-state="open"]')].at(-1))}
        const observer = new MutationObserver(update)
        observer.observe(document.body, {childList: true, subtree: true})
        update()
        return () => observer.disconnect()
    }, [])
    return <Toast.Provider swipeDirection="right" announcerContainer={announcer} label="Workshop message">
        {items.map(item => {
            const Icon = icons[item.variant]
            return <Toast.Root key={`${item.id}:${item.revision}`} className="workshop-toast" data-variant={item.variant} duration={item.duration} type={item.variant === "error" || item.variant === "warning" ? "foreground" : "background"} open onOpenChange={open => {if (!open) workshopToastStore.dismiss(item.id)}}>
                <span className="workshop-toast-icon"><Icon aria-hidden="true"/></span>
                <div className="workshop-toast-body"><Toast.Title className="workshop-toast-title">{item.title}</Toast.Title><Toast.Description asChild><div className="workshop-toast-description">{item.message}</div></Toast.Description></div>
                <Toast.Close className="workshop-toast-close" aria-label={`Dismiss ${item.title.toLowerCase()}`}><X aria-hidden="true"/></Toast.Close>
            </Toast.Root>
        })}
        {createPortal(<Toast.Viewport ref={viewport} popover="manual" aria-live="off" className="workshop-toast-viewport" label="Workshop messages ({hotkey})"/>, typeof HTMLElement.prototype.showPopover === "function" ? announcer ?? document.body : document.body)}
    </Toast.Provider>
}
