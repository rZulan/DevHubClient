export type ExportJob = {
    id: string; key: string; label: string; detail?: string
    status: "queued" | "running" | "error"; progress: number; error?: string
}
export type ExportTaskContext = {signal: AbortSignal; onProgress: (percent: number) => void}
export type ExportTaskInfo = {key?: string; label: string; detail?: string}
type Task = {controller: AbortController; run: (context: ExportTaskContext) => Promise<void>; promise: Promise<void>; resolve: () => void; reject: (error: unknown) => void}
const cancelled = () => new DOMException("Export cancelled.", "AbortError")

export function createExportManager() {
    let jobs: readonly ExportJob[] = [], activeId: string | undefined, sequence = 0
    const listeners = new Set<() => void>(), tasks = new Map<string, Task>()
    const publish = (next: readonly ExportJob[]) => {jobs = next; listeners.forEach(listener => listener())}
    const remove = (id: string) => publish(jobs.filter(job => job.id !== id))
    async function pump() {
        if (activeId) return
        const job = jobs.find(item => item.status === "queued")
        if (!job) return
        const task = tasks.get(job.id)!
        activeId = job.id
        publish(jobs.map(item => item.id === job.id ? {...item, status: "running"} : item))
        try {
            task.controller.signal.throwIfAborted()
            await task.run({signal: task.controller.signal, onProgress(percent) {
                if (task.controller.signal.aborted || !Number.isFinite(percent)) return
                const progress = Math.max(0, Math.min(99, Math.floor(percent)))
                if (jobs.find(item => item.id === job.id)?.progress === progress) return
                publish(jobs.map(item => item.id === job.id ? {...item, progress: Math.max(item.progress, progress)} : item))
            }})
            task.controller.signal.throwIfAborted()
            remove(job.id); task.resolve()
        } catch (error) {
            if (task.controller.signal.aborted) remove(job.id)
            else publish(jobs.map(item => item.id === job.id ? {...item, status: "error", error: error instanceof Error ? error.message : "Could not export this file."} : item))
            task.reject(task.controller.signal.aborted ? cancelled() : error)
        } finally {
            tasks.delete(job.id); activeId = undefined; void pump()
        }
    }
    function cancel(id: string) {
        const task = tasks.get(id)
        if (!task) return
        task.controller.abort()
        remove(id)
        if (activeId !== id) {tasks.delete(id); task.reject(cancelled())}
    }
    return {
        getSnapshot: () => jobs,
        subscribe(listener: () => void) {listeners.add(listener); return () => {listeners.delete(listener)}},
        run(info: ExportTaskInfo, run: Task["run"]) {
            const existing = info.key && jobs.find(job => job.key === info.key && job.status !== "error")
            if (existing) return tasks.get(existing.id)!.promise
            const id = `export-${++sequence}`
            let resolve!: () => void, reject!: (error: unknown) => void
            const promise = new Promise<void>((done, fail) => {resolve = done; reject = fail})
            tasks.set(id, {controller: new AbortController(), run, promise, resolve, reject})
            // The queue owns failure display, even when the originating page is gone.
            void promise.catch(() => {})
            publish([...jobs, {id, key: info.key ?? id, label: info.label, detail: info.detail, status: "queued", progress: 0}])
            queueMicrotask(() => {void pump()})
            return promise
        },
        cancel,
        dismiss(id: string) {if (jobs.find(job => job.id === id)?.status === "error") remove(id)},
        clear() {for (const id of tasks.keys()) cancel(id); publish([])},
    }
}

export const exportManager = createExportManager()
if (import.meta.hot) import.meta.hot.dispose(() => exportManager.clear())
