import {sdlcModels, type SdlcModel, type SdlcPhase} from "./sdlc-models.ts"
import {waterfallConnection, waterfallFeedbackConnection} from "./sdlc-waterfall-geometry.ts"

export type SdlcLink = {from: number; to: number; kind: "flow" | "feedback" | "validation" | "optional" | "cycle"; path: string; label?: string; labelX?: number; labelY?: number}

/** Sequence arrows, test-basis links and optional branches have different meanings. */
export function sdlcLinks(model: SdlcModel): SdlcLink[] {
    const definition = sdlcModels[model], positions = definition.positions
    function link(from: number, to: number, kind: SdlcLink["kind"] = "flow", path?: string, label?: string, labelX?: number, labelY?: number): SdlcLink {
        const a = positions[from], b = positions[to]
        return {from, to, kind, path: path ?? `M${a.x} ${a.y}L${b.x} ${b.y}`, label, labelX, labelY}
    }
    if (model === "waterfall") return [
        ...positions.slice(1).map((position, index) => link(index, index + 1, "flow", waterfallConnection(positions[index], position))),
        link(3, 2, "feedback", waterfallFeedbackConnection(), "Fix & retest"),
    ]
    if (model === "v-model") return [
        ...positions.slice(1).map((_, index) => link(index, index + 1)),
        ...[0, 1, 2, 3].map(from => {
            const to = 8 - from
            return link(from, to, "validation", undefined, ["Acceptance test basis", "System test basis", "Integration test basis", "Component test basis"][from], 500, positions[from].y - 12)
        }),
    ]
    if (model === "agile") return [
        link(0, 1), link(1, 2), link(2, 3), link(3, 4), link(4, 6), link(6, 7),
        link(4, 2, "feedback", "M565 635Q470 355 715 320", "Adapt & retest", 560, 435),
        link(4, 5, "optional", "M565 635Q710 590 820 700", "Release when Done", 755, 620),
        link(5, 6, "optional", "M820 700C810 840 410 840 330 690"),
        link(7, 0, "feedback", "M205 460Q100 250 250 140"),
        link(7, 1, "cycle", "M205 460C45 80 385 25 500 170", "Next Sprint", 295, 88),
    ]
    return [] // Iterative uses its world-space 3D helix, followed by the release decision.
}

export function sdlcQuality(model: SdlcModel, phase: SdlcPhase): string {
    if (phase.quality) return phase.quality
    const pair = sdlcModels[model].phases.find(item => item.id === phase.pair)
    if (model === "v-model" && pair) {
        const developing = sdlcModels[model].phases.indexOf(phase) < 4
        return developing ? `Review ${phase.title.toLowerCase()} now and prepare ${pair.title.toLowerCase()}. Execute those tests on the right arm after implementation.`
            : `Execute ${phase.title.toLowerCase()} against ${pair.title.toLowerCase()}. Fix defects in implementation and repeat affected tests before advancing.`
    }
    return ({planning: "Review the iteration goals and risks with stakeholders.", analysis: "Review and clarify requirements and plan how to test them.", design: "Review designs for correctness and testability before implementation.", build: "Review code and run component and integration tests as the version grows.", test: "Run appropriate component, integration, system and acceptance tests, including regression checks.", evaluate: "Inspect the working version and test evidence with stakeholders before deciding to repeat or release."} as Record<string, string>)[phase.id] ?? "Review the work and record evidence before advancing."
}

export function sdlcRework(model: SdlcModel, index: number): number | null {
    const phases = sdlcModels[model].phases
    if (model === "v-model" && index >= 5) return 4
    const id = phases[index].rework
    return id ? phases.findIndex(phase => phase.id === id) : null
}

export function sdlcAdvanceLabel(model: SdlcModel, index: number): string {
    const phase = sdlcModels[model].phases[index]
    if (phase.exit) return phase.exit
    if (model === "v-model") return index < 4 ? "Reviewed & tests planned" : index === 8 ? "Acceptance passed · complete" : "Tests passed · continue"
    return index === sdlcModels[model].phases.length - 1 ? "Complete evaluation" : "Complete phase & continue"
}
