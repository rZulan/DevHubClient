import {isSdlcModel, iterativeReleasePhases, sdlcModels, type SdlcModel} from "./sdlc-models.ts"

export type SdlcPhaseWork = {ownerId?: string; targetDate?: string; checked?: string[]; blocked?: boolean; blocker?: string}
export type SdlcWork = Record<string, SdlcPhaseWork>
export type SdlcRelease = {currentPhase: number; completed: boolean; notes: Record<string, string>; work?: SdlcWork}
export type SdlcCycle = {cycle: number; notes: Record<string, string>; work?: SdlcWork; release?: SdlcRelease; released?: boolean}
export type SdlcProgress = {currentPhase: number; completed: boolean; notes: Record<string, string>; work?: SdlcWork; cycle?: number; history?: SdlcCycle[]; release?: SdlcRelease; released?: boolean}
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
    return {currentPhase: document.currentPhase, completed: document.completed, notes: document.notes, ...(document.work ? {work: document.work} : {}), ...(document.cycle !== undefined ? {cycle: document.cycle} : {}), ...(document.history ? {history: document.history} : {}), ...(document.release ? {release: document.release} : {}), ...(document.released !== undefined ? {released: document.released} : {})}
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
    if (index === document.currentPhase && !document.completed) return document
    return {...document, currentPhase: index, completed: false, ...(document.model === "agile" ? {released: document.released ?? false} : {})}
}
export function advanceSdlc(document: SdlcDocument): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (document.completed || document.work?.[sdlcModels[document.model].phases[document.currentPhase].id]?.blocked) return document
    const next = nextSdlcPhase(document)
    const value = document.model === "agile" ? {...document, released: document.released === true || document.currentPhase === 5} : document
    return next !== null ? setSdlcPhase(value, next) : {...value, completed: true}
}
export function startSdlcCycle(document: SdlcDocument): SdlcDocument {
    document = normalizeSdlcDocument(document)
    if (!sdlcModels[document.model].cycle || !document.completed || document.release && !document.release.completed || (document.history?.length ?? 0) >= maxSdlcHistory) return document
    const cycle = document.cycle ?? 1
    const next = {...document}; delete next.release; delete next.work
    return {...next, currentPhase: document.model === "agile" ? 1 : 0, completed: false, notes: {}, ...(document.model === "agile" ? {released: false} : {}), cycle: cycle + 1, history: [...document.history ?? [], {cycle, notes: {...document.notes}, ...(document.work ? {work: structuredClone(document.work)} : {}), ...(document.release ? {release: structuredClone(document.release)} : {}), ...(document.model === "agile" ? {released: document.released ?? true} : {})}]}
}
export function startSdlcRelease(document: SdlcDocument): SdlcDocument {
    if (document.model !== "iterative" || !document.completed || document.release) return document
    return {...document, release: {currentPhase: 0, completed: false, notes: {}}}
}
export function setSdlcReleasePhase(document: SdlcDocument, index: number): SdlcDocument {
    if (document.model !== "iterative" || !document.release || !Number.isInteger(index) || index < 0 || index >= iterativeReleasePhases.length) return document
    if (index === document.release.currentPhase && !document.release.completed) return document
    return {...document, release: {...document.release, currentPhase: index, completed: false}}
}
export function advanceSdlcRelease(document: SdlcDocument): SdlcDocument {
    if (document.model !== "iterative" || !document.release || document.release.completed || document.release.work?.[iterativeReleasePhases[document.release.currentPhase].id]?.blocked) return document
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
            && validSdlcWork(release.work, iterativeReleasePhases.map(phase => phase.id))
    }
    function progressValid(progress: unknown, model: SdlcModel) {
        if (!record(progress) || !Number.isInteger(progress.currentPhase) || Number(progress.currentPhase) < 0 || Number(progress.currentPhase) >= sdlcModels[model].phases.length || typeof progress.completed !== "boolean" || progress.completed && progress.currentPhase !== sdlcModels[model].phases.length - 1 && !(model === "agile" && progress.currentPhase === 6 && progress.released === undefined) || !notesValid(progress.notes, model)) return false
        if (progress.released !== undefined && (model !== "agile" || typeof progress.released !== "boolean")) return false
        if (!validSdlcWork(progress.work, sdlcModels[model].phases.map(phase => phase.id))) return false
        if (progress.release !== undefined && (model !== "iterative" || !progress.completed || !releaseValid(progress.release))) return false
        if (progress.cycle !== undefined && (!sdlcModels[model].cycle || !Number.isInteger(progress.cycle) || Number(progress.cycle) < 1 || Number(progress.cycle) > maxSdlcHistory + 1)) return false
        if (progress.history !== undefined) {
            if (!sdlcModels[model].cycle || !Array.isArray(progress.history) || progress.history.length > maxSdlcHistory) return false
            if (progress.history.length !== Number(progress.cycle ?? 1) - 1) return false
            return progress.history.every((entry, index) => record(entry) && entry.cycle === index + 1 && notesValid(entry.notes, model)
                && validSdlcWork(entry.work, sdlcModels[model].phases.map(phase => phase.id))
                && (entry.released === undefined || model === "agile" && typeof entry.released === "boolean")
                && (entry.release === undefined || model === "iterative" && releaseValid(entry.release) && entry.release.completed))
        }
        return (progress.cycle ?? 1) === 1
    }
    if (!progressValid(value, value.model)) return false
    return value.modelStates === undefined || record(value.modelStates) && Object.entries(value.modelStates).every(([model, progress]) => isSdlcModel(model) && model !== value.model && progressValid(progress, model))
}

export function validSdlcDate(value: unknown): value is string {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "1900-01-01") return false
    const parsed = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
export function validSdlcWork(value: unknown, phases: string[]): value is SdlcWork | undefined {
    if (value === undefined) return true
    if (!value || typeof value !== "object" || Array.isArray(value)) return false
    return Object.entries(value).every(([phase, work]) => phases.includes(phase) && !!work && typeof work === "object" && !Array.isArray(work)
        && (work.ownerId === undefined || typeof work.ownerId === "string" && !!work.ownerId.trim() && work.ownerId.length <= 100)
        && (work.targetDate === undefined || validSdlcDate(work.targetDate)) && (work.blocked === undefined || typeof work.blocked === "boolean")
        && (work.blocker === undefined || typeof work.blocker === "string" && work.blocker.length <= 2000)
        && (work.checked === undefined || Array.isArray(work.checked) && work.checked.length <= 50 && new Set(work.checked).size === work.checked.length && work.checked.every((item: unknown) => typeof item === "string" && item.trim().length > 0 && item.length <= 500)))
}
/** The model argument prevents a late field event from editing another model after navigation. */
export function updateSdlcWork(document: SdlcDocument, model: SdlcModel, phase: string, changes: Partial<SdlcPhaseWork>, release = false): SdlcDocument {
    if (document.model !== model || !(release ? iterativeReleasePhases : sdlcModels[model].phases).some(p => p.id === phase) || release && !document.release || !release && document.release) return document
    const progress = release ? document.release! : document, work = {...progress.work?.[phase], ...changes}
    for (const key of Object.keys(work) as (keyof SdlcPhaseWork)[]) if (work[key] === undefined) delete work[key]
    if (!validSdlcWork({[phase]: work}, [phase]) || JSON.stringify(work) === JSON.stringify(progress.work?.[phase] ?? {})) return document
    const next = {...progress, work: {...progress.work, [phase]: work}}
    return release ? {...document, release: next as SdlcRelease} : {...document, ...next}
}
export function updateSdlcNote(document: SdlcDocument, model: SdlcModel, phase: string, text: string, release = false): SdlcDocument {
    if (document.model !== model || text.length > 10000 || !(release ? iterativeReleasePhases : sdlcModels[model].phases).some(p => p.id === phase) || release && !document.release || !release && document.release) return document
    const progress = release ? document.release! : document
    if ((progress.notes[phase] ?? "") === text) return document
    const next = {...progress, notes: {...progress.notes, [phase]: text}}
    return release ? {...document, release: next as SdlcRelease} : {...document, ...next}
}
