import {isSdlcModel, iterativeReleasePhases, sdlcModels, type SdlcModel} from "./sdlc-models.ts"

export type SdlcRelease = {currentPhase: number; completed: boolean; notes: Record<string, string>}
export type SdlcCycle = {cycle: number; notes: Record<string, string>; release?: SdlcRelease}
export type SdlcProgress = {currentPhase: number; completed: boolean; notes: Record<string, string>; cycle?: number; history?: SdlcCycle[]; release?: SdlcRelease}
// The active model retains the legacy top-level shape; inactive models are stored alongside it.
export type SdlcDocument = SdlcProgress & {model: SdlcModel; modelStates?: Partial<Record<SdlcModel, SdlcProgress>>}
export const maxSdlcHistory = 1000

function progressOf(document: SdlcDocument): SdlcProgress {
    return {currentPhase: document.currentPhase, completed: document.completed, notes: document.notes, ...(document.cycle !== undefined ? {cycle: document.cycle} : {}), ...(document.history ? {history: document.history} : {}), ...(document.release ? {release: document.release} : {})}
}
export function switchSdlcModel(document: SdlcDocument, model: SdlcModel): SdlcDocument {
    if (model === document.model) return document
    const modelStates = {...document.modelStates, [document.model]: progressOf(document)}
    const next = modelStates[model] ?? {currentPhase: 0, completed: false, notes: {}}
    delete modelStates[model]
    return {model, ...next, modelStates}
}
export function setSdlcPhase(document: SdlcDocument, index: number): SdlcDocument {
    if (document.release || !Number.isInteger(index) || index < 0 || index >= sdlcModels[document.model].phases.length) return document
    return {...document, currentPhase: index, completed: false}
}
export function advanceSdlc(document: SdlcDocument): SdlcDocument {
    if (document.completed) return document
    const last = sdlcModels[document.model].phases.length - 1
    return document.currentPhase < last ? setSdlcPhase(document, document.currentPhase + 1) : {...document, completed: true}
}
export function startSdlcCycle(document: SdlcDocument): SdlcDocument {
    if (!sdlcModels[document.model].cycle || !document.completed || document.release && !document.release.completed || (document.history?.length ?? 0) >= maxSdlcHistory) return document
    const cycle = document.cycle ?? 1
    const next = {...document}; delete next.release
    return {...next, currentPhase: 0, completed: false, notes: {}, cycle: cycle + 1, history: [...document.history ?? [], {cycle, notes: {...document.notes}, ...(document.release ? {release: {...document.release, notes: {...document.release.notes}}} : {})}]}
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
        if (!record(progress) || !Number.isInteger(progress.currentPhase) || Number(progress.currentPhase) < 0 || Number(progress.currentPhase) >= sdlcModels[model].phases.length || typeof progress.completed !== "boolean" || progress.completed && progress.currentPhase !== sdlcModels[model].phases.length - 1 || !notesValid(progress.notes, model)) return false
        if (progress.release !== undefined && (model !== "iterative" || !progress.completed || !releaseValid(progress.release))) return false
        if (progress.cycle !== undefined && (!sdlcModels[model].cycle || !Number.isInteger(progress.cycle) || Number(progress.cycle) < 1 || Number(progress.cycle) > maxSdlcHistory + 1)) return false
        if (progress.history !== undefined) {
            if (!sdlcModels[model].cycle || !Array.isArray(progress.history) || progress.history.length > maxSdlcHistory) return false
            if (progress.history.length !== Number(progress.cycle ?? 1) - 1) return false
            return progress.history.every((entry, index) => record(entry) && entry.cycle === index + 1 && notesValid(entry.notes, model)
                && (entry.release === undefined || model === "iterative" && releaseValid(entry.release) && entry.release.completed))
        }
        return (progress.cycle ?? 1) === 1
    }
    if (!progressValid(value, value.model)) return false
    return value.modelStates === undefined || record(value.modelStates) && Object.entries(value.modelStates).every(([model, progress]) => isSdlcModel(model) && model !== value.model && progressValid(progress, model))
}
