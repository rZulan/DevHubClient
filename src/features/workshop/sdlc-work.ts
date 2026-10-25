import {iterativeReleasePhases, sdlcModelIds, sdlcModels, type SdlcModel, type SdlcPhase} from "./sdlc-models.ts"
import {sdlcPhaseDone, type SdlcDocument, type SdlcPhaseWork, type SdlcProgress, type SdlcRelease} from "./sdlc-document.ts"

export function sdlcDeliverables(phase: SdlcPhase) {return phase.deliverables.split(", ").map(label => label.trim()).filter(Boolean)}
export function sdlcReadiness(phase: SdlcPhase, work?: SdlcPhaseWork) {
    const items = sdlcDeliverables(phase), checked = new Set(work?.checked)
    return {items, done: items.filter(item => checked.has(item)).length, missing: items.filter(item => !checked.has(item)), blocked: work?.blocked === true}
}
export function sdlcPhaseState(phase: SdlcPhase, work: SdlcPhaseWork | undefined, done: boolean, current: boolean) {
    return done ? "completed" : work?.blocked ? "blocked" : phase.ongoing ? "ongoing" : current ? "current" : phase.optional ? "optional" : "upcoming"
}
export function sdlcOverdue(work?: SdlcPhaseWork, done = false, now = new Date()) {
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    return !done && !!work?.targetDate && work.targetDate < today
}
export function sdlcDateLabel(date: string) {return new Intl.DateTimeFormat(undefined, {month: "short", day: "numeric", year: "numeric", timeZone: "UTC"}).format(new Date(`${date}T00:00:00Z`))}
export function sdlcStoredModels(document: SdlcDocument) {return sdlcModelIds.filter(model => model === document.model || document.modelStates?.[model])}
export function sdlcCompletion(model: SdlcModel, progress: SdlcProgress | SdlcRelease, release = false) {
    const phases = release ? iterativeReleasePhases : sdlcModels[model].phases
    const required = phases.map((phase, index) => ({phase, index})).filter(({phase}) => !phase.optional && !phase.ongoing)
    const done = required.filter(({index}) => release ? progress.completed || index < progress.currentPhase : sdlcPhaseDone({...progress, model}, index)).length
    return {done, total: required.length, percent: Math.round(done / required.length * 100)}
}

export function sdlcMarkdown(document: SdlcDocument, project: string, owners: Record<string, string> = {}) {
    const escape = (value: string) => value.replaceAll(/([\\`*_{}[\]<>#|])/g, "\\$1").replaceAll(/[\r\n]+/g, " ")
    const lines = [`# ${escape(project)} — Development roadmap`, "", `Active model: **${sdlcModels[document.model].title}**`, ""]
    function phases(model: SdlcModel, progress: SdlcProgress | SdlcRelease, release = false) {
        const definition = release ? iterativeReleasePhases : sdlcModels[model].phases
        for (const [index, phase] of definition.entries()) {
            const work = progress.work?.[phase.id], done = release ? progress.completed || index < progress.currentPhase : sdlcPhaseDone({...progress, model}, index)
            const status = sdlcPhaseState(phase, work, done, !progress.completed && index === progress.currentPhase)
            lines.push(`### ${escape(phase.title)}`, "", `Status: **${status}**`, "")
            if (work?.ownerId) lines.push(`Owner: ${escape(owners[work.ownerId] ?? "Former or unavailable member")}`, "")
            if (work?.targetDate) lines.push(`Target date: ${work.targetDate}`, "")
            if (work?.blocked) lines.push(`Blocker: ${escape(work.blocker || "Needs attention")}`, "")
            lines.push(phase.description, "", "Deliverables:", "", ...sdlcDeliverables(phase).map(item => `- [${work?.checked?.includes(item) ? "x" : " "}] ${escape(item)}`), "")
            if (progress.notes[phase.id]) lines.push("Notes:", "", progress.notes[phase.id], "")
        }
    }
    for (const model of sdlcStoredModels(document)) {
        const progress = model === document.model ? document : document.modelStates![model]!, definition = sdlcModels[model]
        lines.push(`## ${definition.title}${model === document.model ? " · Active" : " · Saved model"}`, "", definition.summary, "")
        if (definition.cycle) lines.push(`### ${definition.cycle} ${progress.cycle ?? 1}${progress.completed ? " · Complete" : " · In progress"}`, "")
        phases(model, progress)
        if (progress.release) {lines.push("### Release milestones", ""); phases(model, progress.release, true)}
        for (const archive of progress.history ?? []) {
            lines.push(`## ${definition.cycle} ${archive.cycle} · Archived ${definition.title}`, "")
            phases(model, {...archive, currentPhase: definition.phases.length - 1, completed: true, released: archive.released ?? (model === "agile" ? true : undefined)})
            if (archive.release) {lines.push("### Archived release milestones", ""); phases(model, archive.release, true)}
        }
        lines.push("References:", "", ...definition.sources.map(source => `- [${source.title}](${source.url})`), "")
    }
    return lines.join("\n")
}
