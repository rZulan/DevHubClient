import type {Bounds} from "./canvas-view.ts"
import {erdPngSize} from "./erd-image-scene.ts"
import {erdPortAngles} from "./erd-connection.ts"
import {erdCrossingGaps, planErdRoutes} from "./erd-route-plan.ts"
import {routePoints, type Point} from "./erd-obstacle-route.ts"
import {erdDisplayType} from "./erd-schema.ts"
import {relationshipColumns, relationshipEnds, tableHeight, type RelationshipEnd} from "./tool-documents.ts"
import type {ErdPngRequest} from "./erd-png-protocol.ts"

// Remove crossing gaps from the line itself. Unlike an SVG mask, this never
// allocates a diagram-sized intermediate image for every relationship/tile.
export function erdPathWithGaps(path: string, gaps: Point[]) {
    const points = routePoints(path)
    let result = "", previous: Point | undefined
    const add = (a: Point, b: Point) => {
        result += `${previous?.x === a.x && previous.y === a.y ? "" : `M${a.x} ${a.y} `}L${b.x} ${b.y} `
        previous = b
    }
    for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.y - a.y)
        if (!length) continue
        const dx = (b.x - a.x) / length, dy = (b.y - a.y) / length
        const cuts = gaps.flatMap(gap => {
            const along = (gap.x - a.x) * dx + (gap.y - a.y) * dy, across = (gap.x - a.x) * dy - (gap.y - a.y) * dx
            if (Math.abs(across) >= 5) return []
            const radius = Math.sqrt(25 - across * across), start = Math.max(0, along - radius), end = Math.min(length, along + radius)
            return start < end ? [{start, end}] : []
        }).sort((a, b) => a.start - b.start)
        const at = (distance: number) => ({x: a.x + distance * dx, y: a.y + distance * dy})
        let start = 0
        for (const cut of cuts) {
            if (cut.start > start) add(at(start), at(cut.start))
            start = Math.max(start, cut.end)
        }
        if (start < length) add(at(start), b)
    }
    return result.trim()
}

const intersects = (a: Bounds, b: Bounds) => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
type Context = OffscreenCanvasRenderingContext2D

export function prepareErdCanvas({document, palette, options}: ErdPngRequest) {
    const routes = planErdRoutes(document), gaps = erdCrossingGaps(routes)
    const {view, width, height} = erdPngSize(document), scale = Math.min(width / view.width, height / view.height)
    const padX = (width - view.width * scale) / 2, padY = (height - view.height * scale) / 2
    const foreignKeys = new Set<string>()
    for (const {relation} of routes) {
        const keys = relationshipColumns(document, relation)
        if (relation.cardinality !== "N:M") keys.children.forEach(field => {if (field && keys.childTable) foreignKeys.add(`${keys.childTable.id}\0${field.id}`)})
    }
    const lines = options.showRelationships === false ? [] : routes.map(({relation, route}) => ({
        ...route, path: new Path2D(erdPathWithGaps(route.path, gaps.get(relation.id) ?? [])), ends: relationshipEnds(relation),
    }))
    const tables = document.tables.map(table => ({...table, width: 300, height: tableHeight(table), fields: table.fields.map(field => ({...field, displayType: erdDisplayType(field), key: field.primary ? "PK" : foreignKeys.has(`${table.id}\0${field.id}`) ? "FK" : ""}))}))
    function symbol(context: Context, port: typeof routes[number]["route"]["source"], end: RelationshipEnd) {
        context.save(); context.translate(port.x, port.y); context.rotate(erdPortAngles[port.edge] * Math.PI / 180)
        context.lineWidth = 2.2; context.lineCap = "round"; context.lineJoin = "round"
        context.beginPath()
        if (end === "many" || end === "zero-many") {context.moveTo(3, -9); context.lineTo(17, 0); context.lineTo(3, 9); context.moveTo(3, 0); context.lineTo(17, 0)}
        else {context.moveTo(8, -9); context.lineTo(8, 9)}
        if (end === "zero-one" || end === "zero-many") {
            context.stroke(); context.beginPath(); context.arc(25, 0, 5, 0, Math.PI * 2)
            context.fillStyle = palette.background; context.fill(); context.stroke()
        } else {context.moveTo(25, -9); context.lineTo(25, 9); context.stroke()}
        context.restore()
    }
    function text(context: Context, value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
        context.font = font; context.fillStyle = color; context.textAlign = align; context.fillText(value, x, y)
    }
    function clippedText(context: Context, value: string, x: number, y: number, font: string, color: string, left: number, top: number, clipWidth: number, clipHeight: number, align: CanvasTextAlign = "left") {
        context.save(); context.beginPath(); context.rect(left, top, clipWidth, clipHeight); context.clip()
        text(context, value, x, y, font, color, align); context.restore()
    }
    return {width, height, draw(context: Context, x: number, y: number, tileWidth: number, tileHeight: number) {
        const tile = {x: view.x + (x - padX) / scale - 1, y: view.y + (y - padY) / scale - 1, width: tileWidth / scale + 2, height: tileHeight / scale + 2}
        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, tileWidth, tileHeight)
        context.setTransform(scale, 0, 0, scale, padX - view.x * scale - x, padY - view.y * scale - y)
        context.fillStyle = palette.background; context.fillRect(view.x, view.y, view.width, view.height)
        context.strokeStyle = palette.connector; context.lineWidth = 1.5; context.lineJoin = "round"; context.lineCap = "butt"
        for (const line of lines) {
            if (!intersects(line.bounds, tile)) continue
            context.stroke(line.path)
            if (options.showNotations !== false) {symbol(context, line.source, line.ends.leftEnd); symbol(context, line.target, line.ends.rightEnd)}
        }
        for (const table of tables) {
            if (!intersects(table, tile)) continue
            context.save(); context.translate(table.x, table.y)
            context.beginPath(); context.roundRect(0, 0, 300, table.height, 10)
            context.fillStyle = palette.surface; context.fill(); context.save(); context.clip()
            context.fillStyle = palette.header; context.fillRect(0, 0, 300, 48)
            context.strokeStyle = palette.border; context.lineWidth = 1; context.beginPath(); context.moveTo(0, 48); context.lineTo(300, 48); context.stroke()
            clippedText(context, table.name, 14, 29, "600 14px Arial, sans-serif", palette.text, 14, 0, 194, 48)
            text(context, `${table.fields.length} columns`, 286, 29, "11px Arial, sans-serif", palette.muted, "right")
            const first = Math.max(0, Math.floor((tile.y - table.y - 48) / 32)), last = Math.min(table.fields.length, Math.ceil((tile.y + tile.height - table.y - 48) / 32))
            for (let i = first; i < last; i++) {
                const field = table.fields[i], fieldY = 48 + i * 32
                context.save(); context.globalAlpha = .5; context.beginPath(); context.moveTo(0, fieldY + 32); context.lineTo(300, fieldY + 32); context.stroke(); context.restore()
                text(context, field.key, 12, fieldY + 21, "600 10px Arial, sans-serif", palette.accent)
                clippedText(context, field.name, 42, fieldY + 21, "13px monospace", palette.text, 42, 48, 130, table.height - 48)
                clippedText(context, `${field.displayType}${field.autoIncrement ? " ↗" : ""}`, 280, fieldY + 21, "12px monospace", palette.muted, 178, 48, 104, table.height - 48, "right")
                if (field.nullable) text(context, "?", 288, fieldY + 21, "12px Arial, sans-serif", palette.muted)
            }
            if (!table.fields.length) text(context, "No columns yet", 14, 69, "13px Arial, sans-serif", palette.muted)
            context.restore(); context.strokeStyle = palette.border; context.lineWidth = 1
            context.beginPath(); context.roundRect(0, 0, 300, table.height, 10); context.stroke(); context.restore()
        }
    }}
}
