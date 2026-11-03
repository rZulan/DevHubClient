import type {ReactNode} from "react"

export type WorkshopToastVariant = "error" | "warning" | "success" | "info" | "tip"
export type WorkshopToastItem = {id: string; revision: number; variant: WorkshopToastVariant; title: string; message: ReactNode; duration: number; dedupeKey?: string; onDismiss?: () => void}
export type WorkshopToastOptions = {id?: string; title?: string; duration?: number; dedupeKey?: string; onDismiss?: () => void}
const titles = {error: "Error", warning: "Warning", success: "Success", info: "Information", tip: "Tip"}
const durations = {error: 12000, warning: 10000, success: 5000, info: 7000, tip: 7000}

export function createWorkshopToastStore() {
    let items: readonly WorkshopToastItem[] = [], nextId = 0
    const listeners = new Set<() => void>()
    const publish = (next: readonly WorkshopToastItem[]) => {items = next; listeners.forEach(listener => listener())}
    const remove = (id: string) => {if (items.some(item => item.id === id)) publish(items.filter(item => item.id !== id))}
    return {
        subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener)}},
        getSnapshot: () => items,
        show(variant: WorkshopToastVariant, message: ReactNode, options: WorkshopToastOptions = {}) {
            const duplicate = options.dedupeKey && items.find(item => item.dedupeKey === options.dedupeKey)
            if (duplicate && duplicate.id !== options.id) return duplicate.id
            const id = options.id ?? `workshop-toast-${++nextId}`, previous = items.find(item => item.id === id)
            const item = {id, revision: (previous?.revision ?? 0) + 1, variant, title: options.title ?? titles[variant], message, duration: options.duration ?? durations[variant], dedupeKey: options.dedupeKey, onDismiss: options.onDismiss}
            publish([...items.filter(item => item.id !== id), item].slice(-5))
            return id
        },
        update(id: string, message: ReactNode, onDismiss?: () => void) {
            if (items.some(item => item.id === id)) publish(items.map(item => item.id === id ? {...item, message, onDismiss} : item))
        },
        dismiss(id: string) {const item = items.find(item => item.id === id); remove(id); item?.onDismiss?.()},
        remove,
        clear() {publish([])},
    }
}

export const workshopToastStore = createWorkshopToastStore()
export const workshopToast = {
    error: (message: ReactNode, options?: WorkshopToastOptions) => workshopToastStore.show("error", message, options),
    warning: (message: ReactNode, options?: WorkshopToastOptions) => workshopToastStore.show("warning", message, options),
    success: (message: ReactNode, options?: WorkshopToastOptions) => workshopToastStore.show("success", message, options),
    info: (message: ReactNode, options?: WorkshopToastOptions) => workshopToastStore.show("info", message, options),
    tip: (message: ReactNode, options?: WorkshopToastOptions) => workshopToastStore.show("tip", message, options),
    dismiss: workshopToastStore.dismiss,
}
if (import.meta.hot) import.meta.hot.dispose(() => workshopToastStore.clear())
