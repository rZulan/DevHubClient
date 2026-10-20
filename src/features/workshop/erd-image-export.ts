import {combinedBounds} from "./canvas-view.ts"
import {erdConnectionBounds, erdPortAngles, routeErdRelationship} from "./erd-connection.ts"
import {erdSqlType} from "./erd-schema.ts"
import {relationshipColumns, relationshipEnds, tableHeight, type ErdDocument, type RelationshipEnd} from "./tool-documents.ts"

type ErdImagePalette = {background: string; surface: string; header: string; text: string; muted: string; border: string; connector: string; accent: string}
const defaultPalette: ErdImagePalette = {background: "#ffffff", surface: "#ffffff", header: "#f2ecff", text: "#172033", muted: "#64748b", border: "#cbd5e1", connector: "#8064c6", accent: "#8064c6"}
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")

export function erdPngSize(document: ErdDocument) {
    if (!document.tables.length) throw new Error("Add a table before exporting a PNG.")
    const bounds = combinedBounds([...document.tables.map(table => ({...table, width: 300, height: tableHeight(table)})), ...erdConnectionBounds(document)])
    const view = {x: bounds.x - 48, y: bounds.y - 48, width: bounds.width + 96, height: bounds.height + 96}
    if (![view.x, view.y, view.width, view.height].every(Number.isFinite) || view.width <= 0 || view.height <= 0) throw new Error("The diagram is too large to export. Move the tables closer together and try again.")
    // Sharp at normal sizes; bound allocations for very large or spread-out diagrams.
    const scale = Math.min(2, 8192 / view.width, 8192 / view.height, Math.sqrt(16_000_000 / view.width / view.height))
    return {view, width: Math.max(1, Math.floor(view.width * scale)), height: Math.max(1, Math.floor(view.height * scale))}
}

function endSymbol(end: RelationshipEnd, background: string) {
    const many = end === "many" || end === "zero-many", optional = end === "zero-one" || end === "zero-many"
    return `${many ? '<path d="M3 -9 L17 0 L3 9 M3 0 H17"/>' : '<path d="M8 -9 V9"/>'}${optional ? `<circle cx="25" cy="0" r="5" fill="${background}"/>` : '<path d="M25 -9 V9"/>'}`
}

export function erdDiagramImage(document: ErdDocument, palette: ErdImagePalette = defaultPalette) {
    const {view, width, height} = erdPngSize(document)
    const colors = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, escape(value)])) as ErdImagePalette
    const tables = new Map(document.tables.map(table => [table.id, table]))
    const foreignKeys = new Set<string>()
    const connections = document.relationships.map((relation, index) => {
        const from = tables.get(relation.fromTable), to = tables.get(relation.toTable)
        if (!from || !to) return ""
        const keys = relationshipColumns(document, relation)
        if (relation.cardinality !== "N:M") keys.children.forEach(field => {if (field && keys.childTable) foreignKeys.add(`${keys.childTable.id}\0${field.id}`)})
        const route = routeErdRelationship(from, to, relation.fromField, relation.toField, index % 6 * 12, relation), ends = relationshipEnds(relation)
        return `<g fill="none" stroke="${colors.connector}" stroke-linecap="round" stroke-linejoin="round"><path d="${route.path}" stroke-width="1.5"/>${(["source", "target"] as const).map((end, index) => {
            const port = route[end]
            return `<g transform="translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})" stroke-width="2.2">${endSymbol(index === 0 ? ends.leftEnd : ends.rightEnd, colors.background)}</g>`
        }).join("")}</g>`
    }).join("")
    const cards = document.tables.map((table, index) => {
        const height = tableHeight(table)
        return `<g transform="translate(${table.x} ${table.y})"><defs><clipPath id="card-${index}"><rect width="300" height="${height}" rx="10"/></clipPath><clipPath id="name-${index}"><rect x="14" y="0" width="194" height="48"/></clipPath><clipPath id="fields-${index}"><rect x="42" y="48" width="130" height="${height - 48}"/></clipPath><clipPath id="types-${index}"><rect x="178" y="48" width="104" height="${height - 48}"/></clipPath></defs>
            <rect width="300" height="${height}" rx="10" fill="${colors.surface}"/>
            <g clip-path="url(#card-${index})"><rect width="300" height="48" fill="${colors.header}"/><path d="M0 48H300" stroke="${colors.border}"/>
                <text x="14" y="29" font-size="14" font-weight="600" clip-path="url(#name-${index})">${escape(table.name)}</text><text x="286" y="29" font-size="11" fill="${colors.muted}" text-anchor="end">${table.fields.length} columns</text>
                ${table.fields.map((field, fieldIndex) => {
                    const y = 48 + fieldIndex * 32, key = field.primary ? "PK" : foreignKeys.has(`${table.id}\0${field.id}`) ? "FK" : ""
                    return `<path d="M0 ${y + 32}H300" stroke="${colors.border}" stroke-opacity=".5"/><text x="12" y="${y + 21}" font-size="10" font-weight="600" fill="${colors.accent}">${key}</text><text x="42" y="${y + 21}" font-family="monospace" font-size="13" clip-path="url(#fields-${index})">${escape(field.name)}</text><text x="280" y="${y + 21}" font-family="monospace" font-size="12" fill="${colors.muted}" text-anchor="end" clip-path="url(#types-${index})">${escape(erdSqlType(field, document.dialect))}${field.autoIncrement ? " ↗" : ""}</text>${field.nullable ? `<text x="288" y="${y + 21}" font-size="12" fill="${colors.muted}">?</text>` : ""}`
                }).join("")}
                ${!table.fields.length ? `<text x="14" y="69" font-size="13" fill="${colors.muted}">No columns yet</text>` : ""}
            </g><rect width="300" height="${height}" rx="10" fill="none" stroke="${colors.border}"/>
        </g>`
    }).join("")
    return {width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view.x} ${view.y} ${view.width} ${view.height}" fill="${colors.text}" font-family="Arial, sans-serif"><rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="${colors.background}"/>${connections}${cards}</svg>`}
}

export async function exportErdPng(document: ErdDocument, workspace: HTMLElement, filename: string) {
    const style = (selector: string) => getComputedStyle(workspace.querySelector(selector) ?? workspace)
    const table = style(".erd-table"), header = style(".erd-table > header"), fieldType = style(".erd-field-row small")
    const palette = {
        background: style(".tool-canvas").backgroundColor,
        surface: table.backgroundColor, header: header.backgroundColor, text: table.color, muted: fieldType.color,
        border: table.borderTopColor, connector: style(".erd-connection-line").stroke || defaultPalette.connector,
        accent: style(".erd-table > header svg").color,
    }
    // Offscreen table cards may be unmounted. Resolve theme colors without requiring a visible card.
    if (!workspace.querySelector(".erd-table")) {
        const probe = window.document.createElement("span")
        probe.hidden = true; workspace.append(probe)
        const color = (value: string) => {probe.style.color = value; return getComputedStyle(probe).color}
        try {
            palette.surface = color("var(--popover)"); palette.text = color("var(--popover-foreground)")
            palette.header = color("color-mix(in oklab, var(--primary) 13%, var(--popover))")
            palette.muted = color("var(--muted-foreground)"); palette.border = color("var(--border)")
            palette.accent = color("var(--primary)"); palette.connector = color("color-mix(in oklab, #8b5cf6 75%, var(--foreground))")
        } finally {probe.remove()}
    }
    const image = erdDiagramImage(document, palette)
    const url = URL.createObjectURL(new Blob([image.svg], {type: "image/svg+xml;charset=utf-8"}))
    try {
        const bitmap = new Image()
        bitmap.src = url
        await bitmap.decode()
        const canvas = window.document.createElement("canvas")
        canvas.width = image.width; canvas.height = image.height
        const context = canvas.getContext("2d")
        if (!context) throw new Error("PNG export is unavailable in this browser.")
        context.drawImage(bitmap, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not create the PNG. Try a smaller diagram.")), "image/png"))
        const downloadUrl = URL.createObjectURL(blob)
        const link = window.document.createElement("a")
        link.href = downloadUrl; link.download = filename; link.click()
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
    } finally {URL.revokeObjectURL(url)}
}
