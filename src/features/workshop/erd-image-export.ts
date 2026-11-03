import type {ErdDocument} from "./tool-documents.ts"
import type {ErdImageOptions} from "./erd-image-scene.ts"
import {runErdPngWorker} from "./erd-png-worker-client.ts"
import {exportManager} from "../exports/export-manager.ts"
export {erdDiagramImage, erdPngSize} from "./erd-image-scene.ts"
type ExportOptions = ErdImageOptions & {taskKey?: string; projectName?: string}

export async function exportErdPng(document: ErdDocument, workspace: HTMLElement, filename: string, options: ExportOptions = {}) {
    const style = (selector: string) => getComputedStyle(workspace.querySelector(selector) ?? workspace)
    const table = style(".erd-table"), header = style(".erd-table > header"), fieldType = style(".erd-field-row small")
    const palette = {
        background: style(".tool-canvas").backgroundColor,
        surface: table.backgroundColor, header: header.backgroundColor, text: table.color, muted: fieldType.color,
        border: table.borderTopColor, connector: style(".erd-table > header svg").color,
        accent: style(".erd-table > header svg").color,
    }
    // Overview cards omit field text, and offscreen cards may be unmounted.
    // Resolve missing colors from the theme instead of inheriting workspace text.
    if (!workspace.querySelector(".erd-table") || !workspace.querySelector(".erd-field-row small")) {
        const probe = window.document.createElement("span")
        probe.hidden = true; workspace.append(probe)
        const color = (value: string) => {probe.style.color = value; return getComputedStyle(probe).color}
        try {
            palette.muted = color("var(--muted-foreground)")
            if (!workspace.querySelector(".erd-table")) {
                palette.surface = color("var(--popover)"); palette.text = color("var(--popover-foreground)")
                palette.header = color("color-mix(in oklab, var(--primary) 13%, var(--popover))")
                palette.border = color("var(--border)")
                palette.accent = color("var(--primary)"); palette.connector = color("var(--primary)")
            }
        } finally {probe.remove()}
    }
    return exportManager.run({key: options.taskKey, label: "ERD · HD PNG", detail: options.projectName}, async context => {
        const {blob} = await runErdPngWorker({document, palette, options: {showNotations: options.showNotations, showRelationships: options.showRelationships}}, context)
        context.signal.throwIfAborted()
        const downloadUrl = URL.createObjectURL(blob)
        const link = window.document.createElement("a")
        link.href = downloadUrl; link.download = filename; link.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000)
    })
}
