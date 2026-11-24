import {useEffect, useEffectEvent, useRef, useState, type SetStateAction} from "react"
import {useAppDispatch} from "@/app/hooks"
import {createClientId} from "@/lib/create-client-id"
import {emptyDocuments, validToolDocument, type DocumentTool, type ToolDocumentMap} from "./tool-documents"
import {toolDocumentStorageKey, toolDocumentsApi, type ToolKey, type SavedToolDocument, type SdlcSetup} from "./tool-documents-api"
import {todoApi} from "./todo-api"
import {useProjectToolUpdates} from "./use-project-tool-updates"
import {normalizeSdlcDocument, type SdlcDocument} from "./sdlc-document"
import {canvasObjectCount, canGrowCanvas, retrySeconds, saveFailureDetail, workshopDefaults} from "./workshop-limits"
import {useGetWorkshopLimitsQuery} from "./workshop-limits-api"
import {useRetryCountdown} from "./use-retry-countdown"

type Status = "loading" | "saved" | "unsaved" | "saving" | "error" | "conflict" | "load-error"
export function useToolDocument<T extends DocumentTool>(key: ToolKey & {tool: T}, userId: string, canWrite: boolean, persisted: boolean) {
    type Document = ToolDocumentMap[T]
    const normalize = (value: Document): Document => key.tool === "sdlc" ? normalizeSdlcDocument(value as SdlcDocument) as Document : value
    const dispatch = useAppDispatch()
    const {data: limits} = useGetWorkshopLimitsQuery(key.organizationId, {skip: !persisted})
    const [retryAt, setRetryAt] = useState(0)
    const countdown = useRetryCountdown(retryAt)
    const notBefore = useRef(0), savedObjects = useRef(0)
    const [document, renderDocument] = useState<Document>(emptyDocuments[key.tool] as Document)
    const [hasDocument, setHasDocument] = useState(false)
    const [status, renderStatus] = useState<Status>("loading")
    const [error, setError] = useState("")
    const [historyVersion, setHistoryVersion] = useState(0)
    const current = useRef(document), revision = useRef(0), state = useRef<Status>("loading")
    const alive = useRef(true), pending = useRef(false), saving = useRef(false)
    const initializing = useRef(false)
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const past = useRef<Document[]>([]), future = useRef<Document[]>([]), transaction = useRef<Document | undefined>(undefined)
    const queuedRemote = useRef<SavedToolDocument | null>(null)
    const storageKey = toolDocumentStorageKey(key, userId)
    function setStatus(next: Status) {state.current = next; if (alive.current) renderStatus(next)}
    function clearHistory() {
        past.current = []; future.current = []; transaction.current = undefined
        if (alive.current) setHistoryVersion(value => value + 1)
    }
    function refreshTodos() {
        dispatch(todoApi.util.invalidateTags([{type: "Todos", id: `/organizations/${key.organizationId}/projects/${key.projectId}/todos`}]))
    }
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
        const next = normalize((saved.document ?? emptyDocuments[key.tool]) as Document)
        revision.current = saved.revision; current.current = next; renderDocument(next)
        setHasDocument(saved.document !== null)
        savedObjects.current = canvasObjectCount(key.tool, next) ?? 0
        clearHistory()
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
        if (persisted && Date.now() < notBefore.current) {
            if (alive.current) timer.current = setTimeout(() => void flush(), notBefore.current - Date.now() + 50)
            return
        }
        saving.current = true
        try {
            while (pending.current) {
                if (persisted && Date.now() < notBefore.current) {
                    setStatus("unsaved")
                    if (alive.current) timer.current = setTimeout(() => void flush(), notBefore.current - Date.now() + 50)
                    break
                }
                const snapshot = current.current
                pending.current = false; setStatus("saving")
                try {
                    let creatorId: string | undefined
                    if (persisted) {
                        notBefore.current = Date.now() + Math.ceil(60_000 / (limits?.savesPerMinute ?? workshopDefaults.savesPerMinute)) + 100
                        const response = await dispatch(toolDocumentsApi.endpoints.saveToolDocument.initiate({...key, revision: revision.current, document: snapshot})).unwrap()
                        revision.current = response.revision
                        if (key.tool === "sdlc") {
                            const roadmap = response.document as SdlcDocument | null
                            creatorId = roadmap?.creatorId
                            if (roadmap?.connectToTodo) refreshTodos()
                        }
                        savedObjects.current = canvasObjectCount(key.tool, snapshot) ?? 0
                        if (alive.current) setRetryAt(0)
                    }
                    pending.current = current.current !== snapshot
                    if (creatorId && (current.current as SdlcDocument).creatorId !== creatorId) {
                        current.current = {...current.current, creatorId}
                        if (alive.current) renderDocument(current.current)
                    }
                    const remote = queuedRemote.current; queuedRemote.current = null
                    if (remote && remote.revision > revision.current) acceptRemote(remote, true)
                    if (!backup() && !persisted) throw new Error("Browser storage unavailable")
                    if (!pending.current) {setStatus("saved"); if (alive.current) setError("")}
                    if (state.current === "conflict") break
                } catch (failure) {
                    pending.current = true; backup()
                    const conflict = (failure as {status?: number}).status === 409
                    const cooldown = retrySeconds(failure)
                    if (cooldown !== null) {
                        notBefore.current = Date.now() + cooldown * 1000 + Math.floor(Math.random() * 300)
                        if (alive.current) {
                            setRetryAt(notBefore.current)
                            timer.current = setTimeout(() => void flush(), notBefore.current - Date.now() + 50)
                        }
                    }
                    setStatus(conflict ? "conflict" : "error")
                    if (alive.current) setError(conflict ? "Another session saved changes. Download your draft before reloading the saved document." : saveFailureDetail(failure, persisted ? "Saving failed. Download your draft or retry to save it to the project." : "Browser storage is unavailable. Download your draft to keep your changes."))
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
            let available = response.document !== null
            savedObjects.current = canvasObjectCount(key.tool, next) ?? 0
            revision.current = response.revision; pending.current = false
            let conflict = false
            try {
                const draft = JSON.parse(localStorage.getItem(storageKey) ?? "null")
                if (!discard && (key.tool !== "sdlc" || available || !persisted) && Number.isInteger(draft?.revision) &&
                    validToolDocument(key.tool, draft?.document) && (canWrite || !persisted) && (!persisted || draft.pending)) {
                    next = draft.document as Document
                    available = true
                    pending.current = persisted && Boolean(draft.pending) && JSON.stringify(next) !== JSON.stringify(response.document)
                    conflict = pending.current && draft.revision !== response.revision
                }
            } catch { /* A malformed backup cannot grant project access. */ }
            next = normalize(next)
            current.current = next; renderDocument(next)
            setHasDocument(available)
            clearHistory()
            setError(conflict ? "A recovered draft conflicts with the saved project. Download your draft before reloading." : "")
            setStatus(conflict ? "conflict" : pending.current ? "unsaved" : "saved")
            if (discard) backup()
            const remote = queuedRemote.current; queuedRemote.current = null
            if (remote) acceptRemote(remote)
            if (pending.current && state.current !== "conflict") void flush()
        } catch {if (alive.current) {setStatus("load-error"); setError("The project document could not be loaded. Retry to continue.")}}
    }
    async function initializeSdlc(setup: SdlcSetup) {
        if (key.tool !== "sdlc" || !canWrite || state.current !== "saved" || saving.current || pending.current) {
            throw new Error("Save or reload the current roadmap before starting setup.")
        }
        let refresh = false
        initializing.current = true
        saving.current = true
        setStatus("saving")
        try {
            const saved = persisted
                ? await dispatch(toolDocumentsApi.endpoints.initializeSdlc.initiate({
                    organizationId: key.organizationId, projectId: key.projectId, ...setup, revision: revision.current,
                })).unwrap()
                : {revision: revision.current + 1, document: {...emptyDocuments.sdlc, ...setup, connectToTodo: false, roadmapId: createClientId(), creatorId: userId}}
            if (!validToolDocument("sdlc", saved.document)) throw new Error("The saved roadmap could not be loaded.")
            const next = normalize(saved.document as Document)
            if (!persisted) localStorage.setItem(storageKey, JSON.stringify({revision: saved.revision, document: next, pending: false}))
            revision.current = saved.revision
            current.current = next
            clearHistory()
            if (alive.current) {renderDocument(next); setHasDocument(true); setError("")}
            if (persisted) {backup(); refreshTodos()}
        } catch (failure) {
            refresh = (failure as {status?: number})?.status === 409
            throw failure
        } finally {
            initializing.current = false
            saving.current = false
            setStatus("saved")
            const remote = queuedRemote.current; queuedRemote.current = null
            if (remote && alive.current) acceptRemote(remote)
            if (refresh) void refreshSharedDocument()
        }
    }
    function update(next: Document) {
        if (!canWrite || initializing.current || ["loading", "load-error", "conflict"].includes(state.current)) return
        if (key.tool === "sdlc") {
            const creatorId = (current.current as SdlcDocument).creatorId ?? (persisted ? undefined : userId)
            if (creatorId && (next as SdlcDocument).creatorId !== creatorId) next = {...next, creatorId}
        }
        current.current = next; renderDocument(next); pending.current = true; backup(); setStatus("unsaved")
        clearTimeout(timer.current); timer.current = setTimeout(() => void flush(), 500)
    }
    function setDocument(action: SetStateAction<Document>) {
        if (!canWrite || initializing.current || ["loading", "load-error", "conflict"].includes(state.current)) return
        const next = typeof action === "function" ? (action as (value: Document) => Document)(current.current) : action
        if (next === current.current) return
        const count = canvasObjectCount(key.tool, next)
        if (count !== null && !canGrowCanvas(canvasObjectCount(key.tool, current.current) ?? 0, count, savedObjects.current, limits?.canvasMaximumObjects)) {
            setError("Canvas limit reached. Edit or remove existing objects before adding more; your existing work is preserved.")
            return
        }
        if (!transaction.current) {past.current.push(current.current); if (past.current.length > 100) past.current.shift()}
        future.current = []; setHistoryVersion(value => value + 1); update(next)
    }
    function beginTransaction() {transaction.current ??= current.current}
    function endTransaction() {
        if (transaction.current && transaction.current !== current.current) {past.current.push(transaction.current); if (past.current.length > 100) past.current.shift(); setHistoryVersion(value => value + 1)}
        transaction.current = undefined
    }
    function undo() {if (initializing.current) return; const previous = past.current.pop(); if (previous) {future.current.push(current.current); update(previous); setHistoryVersion(value => value + 1)}}
    function redo() {if (initializing.current) return; const next = future.current.pop(); if (next) {past.current.push(current.current); update(next); setHistoryVersion(value => value + 1)}}
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
    const canEdit = canWrite && !initializing.current && !["loading", "load-error", "conflict"].includes(status)
    return {document, hasDocument, initializeSdlc, setDocument, status, error: countdown > 0 ? `Saving resumes in ${countdown}s. Your draft is kept locally and remains editable.` : error, canEdit, save: flush, retry: () => status === "load-error" ? void load() : void flush(), reload: () => void load(true),
        undo, redo, canUndo: historyVersion >= 0 && past.current.length > 0, canRedo: future.current.length > 0, beginTransaction, endTransaction}
}
