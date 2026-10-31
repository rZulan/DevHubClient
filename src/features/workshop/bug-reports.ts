export const bugStatuses = [{id: "new", label: "New"}, {id: "triaged", label: "Triaged"}, {id: "in-progress", label: "In progress"}, {id: "resolved", label: "Resolved"}, {id: "closed", label: "Closed"}] as const
export const bugPriorities = [{id: "low", label: "Low"}, {id: "medium", label: "Medium"}, {id: "high", label: "High"}, {id: "critical", label: "Critical"}] as const
export type BugCategory = {id: string; name: string; archived: boolean}
export type BugPortal = {token: string; enabled: boolean; revision: number; shortCode?: string | null}
export type BugSummary = {id: string; reference: string; email: string; title: string; status: string; priority: string; categoryId: string | null; source: string; createdAtUtc: string; attachmentCount: number}
export type BugAttachment = {id: string; fileName: string; contentType: string; size: number}
export type BugDetail = Omit<BugSummary, "attachmentCount"> & {description: string; steps: string; environment: string; internalNotes: string; updatedAtUtc: string | null; revision: number; attachments: BugAttachment[]}
export type BugInbox = {items: BugSummary[]; total: number; newCount: number; openCount: number; resolvedCount: number; categories: BugCategory[]}
export type PublicBugForm = {projectName: string; categories: BugCategory[]}
export type BugFormValues = {email: string; title: string; description: string; steps: string; environment: string; priority: string; categoryId: string}
export type BugReceipt = {reference: string}
export const bugFileAccept = ".png,.jpg,.jpeg,.gif,.webp,.pdf,.zip,.mp4,.webm,.txt,.log,.csv,.json"
export const bugFileLimits = {count: 5, file: 10 * 1024 * 1024, total: 25 * 1024 * 1024} as const
export function bugFileError(files: Pick<File, "name" | "size">[]) {
    if (files.length > bugFileLimits.count) return "You can attach up to 5 files."
    if (files.some(file => !file.size || file.size > bugFileLimits.file)) return "Each attachment must be nonempty and no larger than 10 MB."
    if (files.reduce((sum, file) => sum + file.size, 0) > bugFileLimits.total) return "Attachments must be no larger than 25 MB in total."
    if (files.some(file => !bugFileAccept.split(",").some(extension => file.name.toLowerCase().endsWith(extension)))) return "Use images, PDF, ZIP, MP4, WebM, or text, log, CSV, JSON files."
    return ""
}
export function bugFormData(submissionId: string, values: BugFormValues, files: File[]) {
    const data = new FormData()
    data.set("submissionId", submissionId)
    for (const [key, value] of Object.entries(values)) if (value || key !== "categoryId") data.set(key, value.trim())
    for (const file of files) data.append("files", file, file.name)
    return data
}
export function bugError(error: unknown, fallback = "The request could not be completed. Please try again.") {
    const failure = error as {data?: {detail?: string; errors?: Record<string, string[]>}; message?: string; status?: number}
    if (failure?.status === 413) return "These attachments exceed the server's upload limit. Try smaller files."
    if (failure?.status === 429) return "Too many requests. Please wait before trying again."
    return failure?.data?.detail ?? Object.values(failure?.data?.errors ?? {}).flat()[0] ?? failure?.message ?? fallback
}
export function bugFileSize(bytes: number) {return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`}
export const bugApiBase = (import.meta.env?.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "")
export async function publicBugRequest<T>(token: string, body?: FormData, signal?: AbortSignal): Promise<T> {
    const response = await fetch(`${bugApiBase}/public/bug-reports/${encodeURIComponent(token)}`, {method: body ? "POST" : "GET", body, credentials: "omit", referrerPolicy: "no-referrer", signal})
    const data = await response.json().catch(() => null)
    if (!response.ok) throw {status: response.status, data}
    return data as T
}
