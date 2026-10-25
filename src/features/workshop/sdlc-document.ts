import {isSdlcModel, iterativeReleasePhases, sdlcModels, type SdlcModel} from "./sdlc-models.ts"

export type SdlcRelease = {currentPhase: number; completed: boolean; notes: Record<string, string>}
export type SdlcCycle = {cycle: number; notes: Record<string, string>; release?: SdlcRelease; released?: boolean}
export type SdlcProgress = {currentPhase: number; completed: boolean; notes: Record<string, string>; cycle?: number; history?: SdlcCycle[]; release?: SdlcRelease; released?: boolean}
// The active model retains the legacy top-level shape; inactive models are stored alongside it.
export type SdlcDocument = SdlcProgress & {model: SdlcModel; modelStates?: Partial<Record<SdlcModel, SdlcProgress>>}
export const maxSdlcHistory = 1000

/** Older Scrum roadmaps combined Review and Retrospective at index 6 and required release. */
export function normalizeSdlcDocument(document: SdlcDocument): SdlcDocument {
    function normalize(progress: SdlcProgress): SdlcProgress {
        const legacy = progress.released === undefined && progress.currentPhase >= 6
        if (!legacy) return progress
        return {...progress, currentPhase: progress.completed && progress.currentPhase === 6 ? 7 : progress.currentPhase, released: true}
    }
    let next = document.model === "agile" ? normalize(document) as SdlcDocument : document
    if (document.modelStates?.agile) {
        const agile = normalize(document.modelStates.agile)
        if (agile !== document.modelStates.agile) next = {...next, modelStates: {...document.modelStates, agile}}
    }
    return next
}
export function sdlcPhaseDone(document: SdlcProgress & {model: SdlcModel}, index: number): boolean {
    if (sdlcModels[document.model].phases[index].ongoing) return false
    if (document.model === "agile" && index === 5) return document.currentPhase !== 5 && (document.released ?? document.currentPhase >= 6)
    return document.completed || index < document.currentPhase
}
export function nextSdlcPhase(document: SdlcDocument): number | null {
    if (document.completed) return null
    if (document.model === "agile" && document.currentPhase === 4) return 6
    return document.currentPhase < sdlcModels[document.model].phases.length - 1 ? document.currentPhase + 1 : null
}

function progressOf(document: SdlcDocument): SdlcProgress {
    return {currentPhase: document.currentPhase, completed: document.completed, notes: document.notes, ...(document.cycle !== undefined ? {cycle: document.cycle} : {}), ...(document.history ? {history: document.history} : {}), ...(document.release ? {release: document.release} : {}), ...(document.released !== undefined ? {released: document.released} : {})}
}
export function switchSdlcModel(document: SdlcDocument, model: SdlcModel): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (model === document.model) return document
    const modelStates = {...document.modelStates, [document.model]: progressOf(document)}
    const next = modelStates[model] ?? {currentPhase: 0, completed: false, notes: {}}
    delete modelStates[model]
    return {model, ...next, modelStates}
}
export function setSdlcPhase(document: SdlcDocument, index: number): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (document.release || !Number.isInteger(index) || index < 0 || index >= sdlcModels[document.model].phases.length) return document
    return {...document, currentPhase: index, completed: false, ...(document.model === "agile" ? {released: document.released ?? false} : {})}
}
export function advanceSdlc(document: SdlcDocument): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (document.completed) return document
    const next = nextSdlcPhase(document)
    const value = document.model === "agile" ? {...document, released: document.released === true || document.currentPhase === 5} : document
    return next !== null ? setSdlcPhase(value, next) : {...value, completed: true}
}
export function startSdlcCycle(document: SdlcDocument): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (!sdlcModels[document.model].cycle || !document.completed || document.release && !document.release.completed || (document.history?.length ?? 0) >= maxSdlcHistory) return document
    const cycle = document.cycle ?? 1
    const next = {...document}; delete next.release
    return {...next, currentPhase: document.model === "agile" ? 1 : 0, completed: false, notes: {}, ...(document.model === "agile" ? {released: false} : {}), cycle: cycle + 1, history: [...document.history ?? [], {cycle, notes: {...document.notes}, ...(document.release ? {release: {...document.release, notes: {...document.release.notes}}} : {}), ...(document.model === "agile" ? {released: document.released ?? true} : {})}]}
}
export function startSdlcRelease(document: SdlcDocument): SdlcDocument {
    if (document.model !== "iterative" || !document.completed || document.release) return document
    return {...document, release: {currentPhase: 0, completed: false, notes: {}}}
}
export function setSdlcReleasePhase(document: SdlcDocument, index: number): SdlcDocument {
    if (document.model !== "iterative" || !document.release || !Number.isInteger(index) || index < 0 || index >= iterativeReleasePhases.length) return document
    return {...document, release: {...document.release, currentPhase: index, completed: false}}
}
export function advanceSdlcRelease(document: SdlcDocument): SdlcDocument {
    if (document.model !== "iterative" || !document.release || document.release.completed) return document
    return document.release.currentPhase < iterativeReleasePhases.length - 1 ? setSdlcReleasePhase(document, document.release.currentPhase + 1)
        : {...document, release: {...document.release, completed: true}}
}

export function validSdlcDocument(value: unknown): value is SdlcDocument {
    const record = (item: unknown): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)
    if (!record(value) || !isSdlcModel(value.model)) return false
    function notesValid(notes: unknown, model: SdlcModel) {
        return record(notes) && Object.entries(notes).every(([key, note]) => sdlcModels[model].phases.some(phase => phase.id === key) && typeof note === "string" && note.length <= 10000)
    }
    function releaseValid(release: unknown): release is SdlcRelease {
        return record(release) && Number.isInteger(release.currentPhase) && Number(release.currentPhase) >= 0 && Number(release.currentPhase) < iterativeReleasePhases.length
            && typeof release.completed === "boolean" && (!release.completed || release.currentPhase === iterativeReleasePhases.length - 1)
            && record(release.notes) && Object.entries(release.notes).every(([key, note]) => iterativeReleasePhases.some(phase => phase.id === key) && typeof note === "string" && note.length <= 10000)
    }
    function progressValid(progress: unknown, model: SdlcModel) {
        if (!record(progress) || !Number.isInteger(progress.currentPhase) || Number(progress.currentPhase) < 0 || Number(progress.currentPhase) >= sdlcModels[model].phases.length || typeof progress.completed !== "boolean" || progress.completed && progress.currentPhase !== sdlcModels[model].phases.length - 1 && !(model === "agile" && progress.currentPhase === 6 && progress.released === undefined) || !notesValid(progress.notes, model)) return false
        if (progress.released !== undefined && (model !== "agile" || typeof progress.released !== "boolean")) return false
        if (progress.release !== undefined && (model !== "iterative" || !progress.completed || !releaseValid(progress.release))) return false
        if (progress.cycle !== undefined && (!sdlcModels[model].cycle || !Number.isInteger(progress.cycle) || Number(progress.cycle) < 1 || Number(progress.cycle) > maxSdlcHistory + 1)) return false
        if (progress.history !== undefined) {
            if (!sdlcModels[model].cycle || !Array.isArray(progress.history) || progress.history.length > maxSdlcHistory) return false
            if (progress.history.length !== Number(progress.cycle ?? 1) - 1) return false
            return progress.history.every((entry, index) => record(entry) && entry.cycle === index + 1 && notesValid(entry.notes, model)
                && (entry.released === undefined || model === "agile" && typeof entry.released === "boolean")
                && (entry.release === undefined || model === "iterative" && releaseValid(entry.release) && entry.release.completed))
        }
        return (progress.cycle ?? 1) === 1
    }
    if (!progressValid(value, value.model)) return false
    return value.modelStates === undefined || record(value.modelStates) && Object.entries(value.modelStates).every(([model, progress]) => isSdlcModel(model) && model !== value.model && progressValid(progress, model))
}
