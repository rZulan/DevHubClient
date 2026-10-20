import {useEffect, useEffectEvent, useRef, useState, type SetStateAction} from "react"
import {useAppDispatch} from "@/app/hooks"
import {emptyDocuments, validToolDocument, type DocumentTool, type ToolDocumentMap} from "./tool-documents"
import {toolDocumentsApi, type ToolKey, type SavedToolDocument} from "./tool-documents-api"
import {useProjectToolUpdates} from "./use-project-tool-updates"

type Status = "loading" | "saved" | "unsaved" | "saving" | "error" | "conflict" | "load-error"
export function useToolDocument<T extends DocumentTool>(key: ToolKey & {tool: T}, userId: string, canWrite: boolean, persisted: boolean) {
    type Document = ToolDocumentMap[T]
    const dispatch = useAppDispatch()
    const [document, renderDocument] = useState<Document>(emptyDocuments[key.tool] as Document)
    const [status, renderStatus] = useState<Status>("loading")
    const [error, setError] = useState("")
    const [historyVersion, setHistoryVersion] = useState(0)
    const current = useRef(document), revision = useRef(0), state = useRef<Status>("loading")
    const alive = useRef(true), pending = useRef(false), saving = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const past = useRef<Document[]>([]), future = useRef<Document[]>([]), transaction = useRef<Document | undefined>(undefined)
    const queuedRemote = useRef<SavedToolDocument | null>(null)
    const storageKey = `devhub.tool-document:${userId}:${key.organizationId}:${key.projectId}:${key.tool}`
    function setStatus(next: Status) {state.current = next; if (alive.current) renderStatus(next)}
    function backup() {
        try { localStorage.setItem(storageKey, JSON.stringify({revision: revision.current, document: current.current, pending: pending.current})); return true }
        catch {if (alive.current) setError("Browser recovery storage is unavailable. Keep this page open until saved."); return false}
    }
    function acceptRemote(saved: SavedToolDocument, afterSave = false) {
        if (saved.revision <= revision.current) return
        if (state.current === "loading" || saving.current && !afterSave) {
            if (!queuedRemote.current || saved.revision > queuedRemote.current.revision) queuedRemote.current = saved
            return
        }
        if (pending.current || state.current === "conflict") {
            queuedRemote.current = saved; clearTimeout(timer.current); timer.current = undefined
            setStatus("conflict"); backup()
            if (alive.current) setError("A teammate saved changes while you were editing. Download your draft before reloading the shared document.")
            return
        }
        const next = (saved.document ?? emptyDocuments[key.tool]) as Document
        revision.current = saved.revision; current.current = next; renderDocument(next)
        past.current = []; future.current = []; transaction.current = undefined; setHistoryVersion(value => value + 1)
        queuedRemote.current = null; setError(""); setStatus("saved"); backup()
    }
    async function refreshSharedDocument(noticeRevision?: number) {
        if (!persisted || !alive.current || noticeRevision !== undefined && noticeRevision <= revision.current) return
        if (state.current === "load-error") {void load(); return}
        try {
            const saved = await dispatch(toolDocumentsApi.endpoints.getToolDocument.initiate(key, {forceRefetch: true, subscribe: false})).unwrap()
            if (alive.current) acceptRemote(saved)
        } catch { /* The existing document and recovery draft remain intact; reconnect/focus retries. */ }
    }
    useProjectToolUpdates(key, persisted, noticeRevision => void refreshSharedDocument(noticeRevision))
    async function flush() {
        clearTimeout(timer.current); timer.current = undefined
        if (saving.current || !pending.current || !canWrite || ["loading", "load-error", "conflict"].includes(state.current)) return
        saving.current = true
        try {
            while (pending.current) {
                const snapshot = current.current
                pending.current = false; setStatus("saving")
                try {
                    if (persisted) {
                        const response = await dispatch(toolDocumentsApi.endpoints.saveToolDocument.initiate({...key, revision: revision.current, document: snapshot})).unwrap()
                        revision.current = response.revision
                    }
                    pending.current = current.current !== snapshot
                    const remote = queuedRemote.current; queuedRemote.current = null
                    if (remote && remote.revision > revision.current) acceptRemote(remote, true)
                    if (!backup() && !persisted) throw new Error("Browser storage unavailable")
                    if (!pending.current) {setStatus("saved"); if (alive.current) setError("")}
                    if (state.current === "conflict") break
                } catch (failure) {
                    pending.current = true; backup()
                    const conflict = (failure as {status?: number}).status === 409
                    setStatus(conflict ? "conflict" : "error")
                    if (alive.current) setError(conflict ? "Another session saved changes. Download your draft before reloading the saved document." : persisted ? "Saving failed. Download your draft or retry to save it to the project." : "Browser storage is unavailable. Download your draft to keep your changes.")
                    break
                }
            }
        } finally {saving.current = false}
    }
    async function load(discard = false) {
        if (saving.current) return
        setStatus("loading")
        try {
            const response = persisted ? await dispatch(toolDocumentsApi.endpoints.getToolDocument.initiate(key, {forceRefetch: true, subscribe: false})).unwrap() : {revision: 0, document: null}
            if (!alive.current) return
            let next = (response.document ?? emptyDocuments[key.tool]) as Document
            revision.current = response.revision; pending.current = false
            let conflict = false
            try {
                const draft = JSON.parse(localStorage.getItem(storageKey) ?? "null")
                if (!discard && Number.isInteger(draft?.revision) && validToolDocument(key.tool, draft?.document) && (canWrite || !persisted) && (!persisted || draft.pending)) {
                    next = draft.document as Document
                    pending.current = persisted && Boolean(draft.pending) && JSON.stringify(next) !== JSON.stringify(response.document)
                    conflict = pending.current && draft.revision !== response.revision
                }
            } catch { /* A malformed backup cannot grant project access. */ }
            current.current = next; renderDocument(next)
            past.current = []; future.current = []; transaction.current = undefined; setHistoryVersion(value => value + 1)
            setError(conflict ? "A recovered draft conflicts with the saved project. Download your draft before reloading." : "")
            setStatus(conflict ? "conflict" : pending.current ? "unsaved" : "saved")
            if (discard) backup()
            const remote = queuedRemote.current; queuedRemote.current = null
            if (remote) acceptRemote(remote)
            if (pending.current && state.current !== "conflict") void flush()
        } catch {if (alive.current) {setStatus("load-error"); setError("The project document could not be loaded. Retry to continue.")}}
    }
    function update(next: Document) {
        if (!canWrite || ["loading", "load-error", "conflict"].includes(state.current)) return
        current.current = next; renderDocument(next); pending.current = true; backup(); setStatus("unsaved")
        clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 500)
    }
    function setDocument(action: SetStateAction<Document>) {
        if (!canWrite || ["loading", "load-error", "conflict"].includes(state.current)) return
        const next = typeof action === "function" ? (action as (value: Document) => Document)(current.current) : action
        if (next === current.current) return
        if (!transaction.current) {past.current.push(current.current); if (past.current.length > 100) past.current.shift()}
        future.current = []; setHistoryVersion(value => value + 1); update(next)
    }
    function beginTransaction() {transaction.current ??= current.current}
    function endTransaction() {
        if (transaction.current && transaction.current !== current.current) {past.current.push(transaction.current); if (past.current.length > 100) past.current.shift(); setHistoryVersion(value => value + 1)}
        transaction.current = undefined
    }
    function undo() {const previous = past.current.pop(); if (previous) {future.current.push(current.current); update(previous); setHistoryVersion(value => value + 1)}}
    function redo() {const next = future.current.pop(); if (next) {past.current.push(current.current); update(next); setHistoryVersion(value => value + 1)}}
    const loadLatest = useEffectEvent(() => void load())
    const flushLatest = useEffectEvent(() => void flush())
    useEffect(() => {
        alive.current = true; loadLatest()
        function leaving(event: BeforeUnloadEvent) {if (pending.current) {event.preventDefault(); flushLatest()}}
        function saveShortcut(event: KeyboardEvent) {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {event.preventDefault(); flushLatest()}
        }
        window.addEventListener("beforeunload", leaving)
        window.addEventListener("keydown", saveShortcut)
        return () => {alive.current = false; clearTimeout(timer.current); flushLatest(); window.removeEventListener("beforeunload", leaving); window.removeEventListener("keydown", saveShortcut)}
    }, [])
    const canEdit = canWrite && !["loading", "load-error", "conflict"].includes(status)
    return {document, setDocument, status, error, canEdit, save: flush, retry: () => status === "load-error" ? void load() : void flush(), reload: () => void load(true),
        undo, redo, canUndo: historyVersion >= 0 && past.current.length > 0, canRedo: future.current.length > 0, beginTransaction, endTransaction}
}
