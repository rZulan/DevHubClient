import {combinedBounds} from "./canvas-view.ts"
import {erdConnectionBounds, erdPortAngles} from "./erd-connection.ts"
import {planErdRoutes, erdCrossingGaps} from "./erd-route-plan.ts"
import {erdDisplayType} from "./erd-schema.ts"
import {relationshipColumns, relationshipEnds, tableHeight, type ErdDocument, type RelationshipEnd} from "./tool-documents.ts"


export type ErdImagePalette = {background: string; surface: string; header: string; text: string; muted: string; border: string; connector: string; accent: string}
export type ErdImageOptions = {showNotations?: boolean; showRelationships?: boolean}
export const defaultPalette: ErdImagePalette = {background: "#ffffff", surface: "#ffffff", header: "#f2ecff", text: "#172033", muted: "#64748b", border: "#cbd5e1", connector: "#8064c6", accent: "#8064c6"}
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")

export function erdPngSize(document: ErdDocument) {
    if (!document.tables.length) throw new Error("Add a table before exporting a PNG.")
    const bounds = combinedBounds([...document.tables.map(table => ({...table, width: 300, height: tableHeight(table)})), ...erdConnectionBounds(document)])
    const view = {x: bounds.x - 48, y: bounds.y - 48, width: bounds.width + 96, height: bounds.height + 96}
    if (![view.x, view.y, view.width, view.height].every(Number.isFinite) || view.width <= 0 || view.height <= 0) throw new Error("The diagram has invalid positions or dimensions.")
    // Render the vector diagram at 4x detail, regardless of diagram or download size.
    // Round up so fractional relationship bounds cannot clip the outermost pixels.
    return {view, width: Math.ceil(view.width * 4), height: Math.ceil(view.height * 4)}
}

function endSymbol(end: RelationshipEnd, background: string) {
    const many = end === "many" || end === "zero-many", optional = end === "zero-one" || end === "zero-many"
    return `${many ? '<path d="M3 -9 L17 0 L3 9 M3 0 H17"/>' : '<path d="M8 -9 V9"/>'}${optional ? `<circle cx="25" cy="0" r="5" fill="${background}"/>` : '<path d="M25 -9 V9"/>'}`
}

export function erdDiagramImage(document: ErdDocument, palette: ErdImagePalette = defaultPalette, {showNotations = true, showRelationships = true}: ErdImageOptions = {}) {
    const {view, width, height} = erdPngSize(document)
    const colors = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, escape(value)])) as ErdImagePalette
    const foreignKeys = new Set<string>()
    const routes=planErdRoutes(document), crossings=erdCrossingGaps(routes)
    const connections = routes.map(({relation,route}, index) => {
        const keys = relationshipColumns(document, relation)
        if (relation.cardinality !== "N:M") keys.children.forEach(field => {if (field && keys.childTable) foreignKeys.add(`${keys.childTable.id}\0${field.id}`)})
        if (!showRelationships) return ""
        const ends = relationshipEnds(relation), gaps=crossings.get(relation.id)
        const mask=gaps?`<defs><mask id="erd-crossing-${index}" maskUnits="userSpaceOnUse" x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" style="mask-type:luminance"><rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="white"/>${gaps.map(point=>`<circle cx="${point.x}" cy="${point.y}" r="5" fill="black"/>`).join("")}</mask></defs>`:""
        return `${mask}<g fill="none" stroke="${colors.connector}" stroke-linecap="round" stroke-linejoin="round"><path d="${route.path}" stroke-width="1.5"${gaps?` mask="url(#erd-crossing-${index})"`:""}/>${showNotations ? (["source", "target"] as const).map((end, index) => {
            const port = route[end]
            return `<g transform="translate(${port.x} ${port.y}) rotate(${erdPortAngles[port.edge]})" stroke-width="2.2">${endSymbol(index === 0 ? ends.leftEnd : ends.rightEnd, colors.background)}</g>`
        }).join("") : ""}</g>`
    }).join("")
    const cards = document.tables.map((table, index) => {
        const height = tableHeight(table)
        return `<g transform="translate(${table.x} ${table.y})"><defs><clipPath id="card-${index}"><rect width="300" height="${height}" rx="10"/></clipPath><clipPath id="name-${index}"><rect x="14" y="0" width="194" height="48"/></clipPath><clipPath id="fields-${index}"><rect x="42" y="48" width="130" height="${height - 48}"/></clipPath><clipPath id="types-${index}"><rect x="178" y="48" width="104" height="${height - 48}"/></clipPath></defs>
            <rect width="300" height="${height}" rx="10" fill="${colors.surface}"/>
            <g clip-path="url(#card-${index})"><rect width="300" height="48" fill="${colors.header}"/><path d="M0 48H300" stroke="${colors.border}"/>
                <text x="14" y="29" font-size="14" font-weight="600" clip-path="url(#name-${index})">${escape(table.name)}</text><text x="286" y="29" font-size="11" fill="${colors.muted}" text-anchor="end">${table.fields.length} columns</text>
                ${table.fields.map((field, fieldIndex) => {
                    const y = 48 + fieldIndex * 32, key = field.primary ? "PK" : foreignKeys.has(`${table.id}\0${field.id}`) ? "FK" : ""
                    return `<path d="M0 ${y + 32}H300" stroke="${colors.border}" stroke-opacity=".5"/><text x="12" y="${y + 21}" font-size="10" font-weight="600" fill="${colors.accent}">${key}</text><text x="42" y="${y + 21}" font-family="monospace" font-size="13" clip-path="url(#fields-${index})">${escape(field.name)}</text><text x="280" y="${y + 21}" font-family="monospace" font-size="12" fill="${colors.muted}" text-anchor="end" clip-path="url(#types-${index})">${escape(erdDisplayType(field))}${field.autoIncrement ? " ↗" : ""}</text>${field.nullable ? `<text x="288" y="${y + 21}" font-size="12" fill="${colors.muted}">?</text>` : ""}`
                }).join("")}
                ${!table.fields.length ? `<text x="14" y="69" font-size="13" fill="${colors.muted}">No columns yet</text>` : ""}
            </g><rect width="300" height="${height}" rx="10" fill="none" stroke="${colors.border}"/>
        </g>`
    }).join("")
    return {view, width, height, svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${view.x} ${view.y} ${view.width} ${view.height}" fill="${colors.text}" font-family="Arial, sans-serif"><rect x="${view.x}" y="${view.y}" width="${view.width}" height="${view.height}" fill="${colors.background}"/>${connections}${cards}</svg>`}
}

