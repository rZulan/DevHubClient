import {useSyncExternalStore} from "react"
import {exportManager} from "./export-manager"

export function useExportJobs() {
    return useSyncExternalStore(exportManager.subscribe, exportManager.getSnapshot, exportManager.getSnapshot)
}
export function useExporting(key: string) {
    return useSyncExternalStore(exportManager.subscribe, () => exportManager.getSnapshot().some(job => job.key === key && job.status !== "error"), () => false)
}
