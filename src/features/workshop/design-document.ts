import {createClientId} from "../../lib/create-client-id.ts"

export type DesignKind = "frame" | "rectangle" | "ellipse" | "text" | "button"
export type DesignInteraction = {action: "navigate" | "back" | "overlay" | "close"; targetId?: string; transition: "instant" | "fade" | "slide"}
export type DesignLayer = {
    id: string; name: string; kind: DesignKind; parentId?: string; x: number; y: number; width: number; height: number
    fill: string; stroke: string; strokeWidth: number; radius: number; opacity: number; text: string; fontSize: number; textColor: string; hidden: boolean; locked: boolean
    fontFamily?: string; fontWeight?: number; textAlign?: "left" | "center" | "right"; lineHeight?: number; shadow?: boolean
    layout?: "free" | "vertical" | "horizontal"; gap?: number; padding?: number; interaction?: DesignInteraction
    image?: string; imageFit?: "cover" | "contain"
    control?: "input" | "checkbox" | "toggle"
}
export type DesignDocument = {layers: DesignLayer[]; startFrameId?: string}
export const designFonts = ["Inter", "Geist Variable", "Manrope Variable", "Arial", "Georgia", "IBM Plex Mono"]
export const framePresets = [{name: "Phone", width: 390, height: 844}, {name: "Tablet", width: 834, height: 1194}, {name: "Desktop", width: 1440, height: 900}]
export function newDesignLayer(kind: DesignKind, changes: Partial<DesignLayer> = {}): DesignLayer {
    return {id: createClientId(), kind, name: kind[0].toUpperCase() + kind.slice(1), x: 0, y: 0, width: kind === "frame" ? 390 : kind === "text" ? 240 : 180,
        height: kind === "frame" ? 844 : kind === "button" || kind === "text" ? 48 : 120,
        fill: kind === "frame" ? "#ffffff" : kind === "button" ? "#7561df" : "#ddd6fe", stroke: "#dce0e8", strokeWidth: 0,
        radius: kind === "button" ? 10 : kind === "rectangle" ? 8 : 0, opacity: 1, text: kind === "text" ? "Your text here" : kind === "button" ? "Continue" : "",
        fontSize: kind === "text" ? 24 : 14, fontFamily: "Geist Variable", fontWeight: kind === "button" ? 600 : 400, textAlign: kind === "button" ? "center" : "left",
        textColor: kind === "button" ? "#ffffff" : "#202332", hidden: false, locked: false, ...changes}
}
export function designDescendants(doc: DesignDocument, ids: string[]) {
    const found = new Set(ids)
    for (let count = 0; count < doc.layers.length; count++) {
        const before = found.size
        for (const layer of doc.layers) if (layer.parentId && found.has(layer.parentId)) found.add(layer.id)
        if (found.size === before) break
    }
    return found
}
export function layerUnavailable(doc: DesignDocument, layer: DesignLayer, flag: "hidden" | "locked"): boolean {
    return layer[flag] || !!doc.layers.find(parent => parent.id === layer.parentId)?.[flag]
}
export function designPaintOrder(doc: DesignDocument) {
    const children = new Map<string, DesignLayer[]>()
    for (const layer of doc.layers) if (layer.parentId) {const siblings = children.get(layer.parentId) ?? []; siblings.push(layer); children.set(layer.parentId, siblings)}
    return doc.layers.filter(layer => !layer.parentId).flatMap(layer => [layer, ...(children.get(layer.id) ?? [])])
}
export function moveDesignLayers(doc: DesignDocument, positions: {id: string; x: number; y: number; width?: number; height?: number}[]): DesignDocument {
    const moved = new Map(positions.filter(p => {const l = doc.layers.find(layer => layer.id === p.id); return l && !layerUnavailable(doc, l, "locked")}).map(p => [p.id, p]))
    return {...doc, layers: doc.layers.map(layer => {
        const own = moved.get(layer.id), parent = layer.parentId && moved.get(layer.parentId), original = doc.layers.find(item => item.id === layer.parentId)
        // The frame delta takes precedence when a marquee selects both a frame and its children.
        if (parent && original) return {...layer, x: layer.x + parent.x - original.x, y: layer.y + parent.y - original.y}
        return own ? {...layer, ...own, width: Math.max(16, Math.min(10000, own.width ?? layer.width)), height: Math.max(16, Math.min(10000, own.height ?? layer.height))} : layer
    })}
}
export function removeDesignLayers(doc: DesignDocument, ids: string[]): DesignDocument {
    const removed = designDescendants(doc, ids.filter(id => {const layer = doc.layers.find(l => l.id === id); return layer && !layerUnavailable(doc, layer, "locked")}))
    return {...doc, ...(removed.has(doc.startFrameId ?? "") ? {startFrameId: undefined} : {}), layers: doc.layers.filter(l => !removed.has(l.id)).map(layer => layer.interaction?.targetId && removed.has(layer.interaction.targetId) ? {...layer, interaction: undefined} : layer)}
}
export function copyDesignLayers(doc: DesignDocument, ids: string[]) {
    const included = designDescendants(doc, ids)
    return JSON.stringify({type: "devhub-design", layers: doc.layers.filter(l => included.has(l.id)), startFrameId: included.has(doc.startFrameId ?? "") ? doc.startFrameId : undefined})
}
export function pasteDesignLayers(doc: DesignDocument, text: string, offset = 32, options: {preserveNames?: boolean} = {}): {document: DesignDocument; ids: string[]} | null {
    try {
        if (text.length > 4000000) return null
        const data = JSON.parse(text)
        if (data.type !== "devhub-design" || !Array.isArray(data.layers) || !data.layers.length) return null
        // External parents and targets are detached before validating the standalone clipboard document.
        const copiedIds = new Set<string>(data.layers.map((l: DesignLayer) => l.id))
        const layers: DesignLayer[] = data.layers.map((layer: DesignLayer) => ({...layer, parentId: copiedIds.has(layer.parentId ?? "") ? layer.parentId : undefined,
            interaction: layer.interaction?.targetId && !copiedIds.has(layer.interaction.targetId) ? undefined : layer.interaction}))
        const externalTargets = new Map<string, DesignLayer>()
        for (const layer of data.layers as DesignLayer[]) {
            if (!layer?.interaction) continue
            const target = layer.interaction.targetId
            if (target && !copiedIds.has(target)) externalTargets.set(target, newDesignLayer("frame", {id: target}))
        }
        const detached = data.layers.map((layer: DesignLayer) => ({...layer, parentId: copiedIds.has(layer.parentId ?? "") ? layer.parentId : undefined}))
        if (!validDesignDocument({layers: [...detached, ...externalTargets.values()], startFrameId: data.startFrameId}) || layers.length + doc.layers.length > 5000) return null
        const remap = new Map(layers.map(layer => [layer.id, createClientId()]))
        const copies = layers.map(layer => {
            const original: DesignLayer = data.layers.find((l: DesignLayer) => l.id === layer.id), interaction = original.interaction
            const targetId = remap.get(interaction?.targetId ?? "") ?? (doc.layers.some(l => l.id === interaction?.targetId && l.kind === "frame") ? interaction?.targetId : undefined)
            return {...layer, id: remap.get(layer.id)!, name: options.preserveNames ? layer.name : `${layer.name.slice(0, 144)} copy`, x: layer.x + offset, y: layer.y + offset, locked: false,
            parentId: remap.get(layer.parentId ?? "") ?? (doc.layers.some(l => l.id === data.layers.find((l: DesignLayer) => l.id === layer.id)?.parentId) ? data.layers.find((l: DesignLayer) => l.id === layer.id).parentId : undefined),
            interaction: interaction && (["back", "close"].includes(interaction.action) || targetId) ? {...interaction, targetId} : undefined}})
        return {document: {...doc, startFrameId: doc.startFrameId ?? remap.get(data.startFrameId), layers: [...doc.layers, ...copies]}, ids: copies.filter(l => !copies.some(p => p.id === l.parentId)).map(l => l.id)}
    } catch {return null}
}
export function reorderDesignLayer(doc: DesignDocument, id: string, direction: -1 | 1): DesignDocument {
    const layer = doc.layers.find(l => l.id === id)
    if (!layer || layerUnavailable(doc, layer, "locked")) return doc
    const siblings = doc.layers.filter(l => l.parentId === layer.parentId), index = siblings.findIndex(l => l.id === id), sibling = siblings[index + direction]
    if (!sibling) return doc
    const layers = [...doc.layers], a = layers.indexOf(layer), b = layers.indexOf(sibling)
    ;[layers[a], layers[b]] = [layers[b], layers[a]]
    return {...doc, layers}
}
export function layoutDesignFrames(doc: DesignDocument): DesignDocument {
    let layers = doc.layers
    for (const frame of layers.filter(l => l.kind === "frame" && l.layout && l.layout !== "free" && !l.locked)) {
        let cursor = frame.padding ?? 24
        layers = layers.map(layer => {
            if (layer.parentId !== frame.id || layer.hidden) return layer
            const vertical = frame.layout === "vertical", position = {x: frame.x + (vertical ? frame.padding ?? 24 : cursor), y: frame.y + (vertical ? cursor : frame.padding ?? 24)}
            cursor += (vertical ? layer.height : layer.width) + (frame.gap ?? 16)
            return {...layer, ...position}
        })
    }
    return {...doc, layers}
}
export function validDesignDocument(value: unknown): value is DesignDocument {
    if (!value || typeof value !== "object") return false
    const doc = value as DesignDocument
    if (!Array.isArray(doc.layers) || doc.layers.length > 5000) return false
    const ids = new Set<string>(), frames = new Set(doc.layers.filter(l => l?.kind === "frame").map(l => l.id))
    return (doc.startFrameId === undefined || frames.has(doc.startFrameId)) && doc.layers.every(l => {
        if (!l || typeof l !== "object" || typeof l.id !== "string" || !l.id.trim() || l.id.length > 100 || ids.has(l.id)) return false
        ids.add(l.id)
        const number = (key: keyof DesignLayer, min: number, max: number, optional = false) => optional && l[key] === undefined || typeof l[key] === "number" && Number.isFinite(l[key]) && Number(l[key]) >= min && Number(l[key]) <= max
        return typeof l.name === "string" && !!l.name.trim() && l.name.length <= 150 && typeof l.text === "string" && l.text.length <= 100000
            && ["frame", "rectangle", "ellipse", "text", "button"].includes(l.kind) && ["fill", "stroke", "textColor"].every(k => /^#[a-f\d]{6}$/i.test(l[k as "fill"]))
            && number("x", -1e6, 1e6) && number("y", -1e6, 1e6) && number("width", 16, 10000) && number("height", 16, 10000) && number("radius", 0, 5000) && number("strokeWidth", 0, 20) && number("opacity", 0, 1) && number("fontSize", 1, 500)
            && typeof l.hidden === "boolean" && typeof l.locked === "boolean" && (l.parentId === undefined || l.kind !== "frame" && frames.has(l.parentId))
            && (l.fontFamily === undefined || designFonts.includes(l.fontFamily)) && number("fontWeight", 100, 900, true) && number("lineHeight", .8, 3, true)
            && (l.textAlign === undefined || ["left", "center", "right"].includes(l.textAlign)) && (l.shadow === undefined || typeof l.shadow === "boolean")
            && (l.layout === undefined || ["free", "horizontal", "vertical"].includes(l.layout)) && number("gap", 0, 500, true) && number("padding", 0, 500, true)
            && (l.image === undefined || typeof l.image === "string" && l.image.length <= 2800000 && /^data:image\/(png|jpeg|webp|gif);base64,[a-z\d+/]+={0,2}$/i.test(l.image))
            && (l.imageFit === undefined || ["cover", "contain"].includes(l.imageFit))
            && (l.control === undefined || ["input", "checkbox", "toggle"].includes(l.control))
            && (l.interaction === undefined || !!l.interaction && ["navigate", "back", "overlay", "close"].includes(l.interaction.action) && ["instant", "fade", "slide"].includes(l.interaction.transition)
                && (["back", "close"].includes(l.interaction.action) ? l.interaction.targetId === undefined : frames.has(l.interaction.targetId ?? "")))
    })
}

export type ComponentPreset = "button" | "input" | "card" | "badge" | "toggle" | "checkbox"
export function designComponent(kind: ComponentPreset, x: number, y: number, parentId?: string): DesignLayer[] {
    const base = {x, y, ...(parentId ? {parentId} : {})}
    if (kind === "button") return [newDesignLayer("button", {...base, name: "Primary button", width: 220})]
    if (kind === "input") return [newDesignLayer("rectangle", {...base, control: "input", name: "Text input", width: 280, height: 48, fill: "#ffffff", strokeWidth: 1, radius: 8, text: "Enter your email", fontSize: 14, textColor: "#8b8e9e"})]
    if (kind === "badge") return [newDesignLayer("button", {...base, name: "Status badge", text: "In progress", width: 112, height: 28, fill: "#ede9fe", textColor: "#7561df", radius: 14, fontSize: 12})]
    if (kind === "toggle") return [newDesignLayer("rectangle", {...base, control: "toggle", name: "Toggle", width: 48, height: 28, fill: "#7561df", radius: 14})]
    if (kind === "checkbox") return [newDesignLayer("button", {...base, control: "checkbox", name: "Checkbox", width: 24, height: 24, text: "✓", radius: 5}), newDesignLayer("text", {...base, name: "Checkbox label", x: x + 36, height: 24, fontSize: 14, text: "Remember me"})]
    return [newDesignLayer("rectangle", {...base, name: "Card surface", width: 300, height: 180, fill: "#ffffff", strokeWidth: 1, radius: 16, shadow: true}),
        newDesignLayer("text", {...base, name: "Card heading", x: x + 24, y: y + 24, text: "Make room for ideas", width: 252, height: 32, fontSize: 20, fontWeight: 600}),
        newDesignLayer("text", {...base, name: "Card description", x: x + 24, y: y + 66, text: "Bring your next great idea to life.", width: 252, height: 44, fontSize: 14, textColor: "#7c8091"}),
        newDesignLayer("button", {...base, name: "Card action", x: x + 24, y: y + 122, text: "Explore →", width: 130, height: 36})]
}
export function designStarter(kind: "onboarding" | "dashboard", x = 80): DesignLayer[] {
    const desktop = kind === "dashboard", frame = newDesignLayer("frame", {name: desktop ? "Dashboard" : "Welcome", x, y: 80, width: desktop ? 1120 : 390, height: desktop ? 760 : 844, fill: "#f7f8fc"})
    const at = (kind: DesignKind, changes: Partial<DesignLayer>) => newDesignLayer(kind, {parentId: frame.id, x: x + 28, y: 108, ...changes})
    if (desktop) return [frame,
        at("rectangle", {name: "Sidebar", x, y: 80, width: 220, height: 760, fill: "#ffffff"}),
        at("text", {name: "Brand", text: "◈  workspace", y: 112, fontSize: 22, fontWeight: 700, width: 180}),
        ...["Overview", "Projects", "Messages", "Settings"].map((text, i) => at("button", {name: text, text, y: 200 + i * 56, width: 164, height: 40, fill: i ? "#ffffff" : "#ede9fe", textColor: i ? "#7c8091" : "#7561df", textAlign: "left"})),
        at("text", {name: "Page title", text: "A little progress, every day.", x: x + 260, y: 124, width: 700, height: 52, fontSize: 30, fontWeight: 600}),
        at("text", {name: "Page subtitle", text: "Here’s what’s happening in your workspace.", x: x + 260, y: 184, width: 600, height: 30, fontSize: 16, textColor: "#7c8091"}),
        ...["Projects", "Tasks completed", "Team members"].flatMap((text, i) => [at("rectangle", {name: `${text} card`, x: x + 260 + i * 276, y: 260, width: 252, height: 150, radius: 16, fill: "#ffffff", strokeWidth: 1}),
            at("text", {name: text, text, x: x + 284 + i * 276, y: 284, width: 204, height: 24, fontSize: 14, textColor: "#7c8091"}),
            at("text", {name: `${text} value`, text: ["12", "48", "08"][i], x: x + 284 + i * 276, y: 324, width: 204, height: 54, fontSize: 36, fontWeight: 600})]),
        at("rectangle", {name: "Activity surface", x: x + 260, y: 444, width: 804, height: 320, radius: 16, fill: "#ffffff", strokeWidth: 1}),
        at("text", {name: "Activity title", text: "Recent activity", x: x + 284, y: 472, width: 400, height: 32, fontSize: 20, fontWeight: 600}),
        ...["Website refresh", "Mobile onboarding", "Design system"].flatMap((text, i) => [at("text", {name: text, text, x: x + 284, y: 540 + i * 64, width: 480, height: 32, fontSize: 15}),
            at("button", {name: `${text} status`, text: i ? "In progress" : "Completed", x: x + 916, y: 536 + i * 64, width: 120, height: 28, fontSize: 12, fill: i ? "#ede9fe" : "#dcfce7", textColor: i ? "#7561df" : "#15803d"})])]
    return [frame,
        at("text", {name: "Status bar", text: "9:41                                             ▰ ▰", y: 96, width: 334, height: 24, fontSize: 13, fontWeight: 600}),
        at("button", {name: "Brand mark", text: "◈", x: x + 155, y: 222, width: 80, height: 80, fontSize: 40, fill: "#ede9fe", textColor: "#7561df", radius: 24}),
        at("text", {name: "Welcome heading", text: "A fresh space.\nA bright beginning.", y: 350, width: 334, height: 110, fontSize: 34, fontWeight: 600, textAlign: "center"}),
        at("text", {name: "Welcome description", text: "Bring your ideas, projects, and people\ntogether. Make something wonderful.", y: 478, width: 334, height: 64, fontSize: 15, textColor: "#7c8091", textAlign: "center"}),
        at("button", {name: "Get started", text: "Get started  →", y: 656, width: 334, height: 52}),
        at("button", {name: "Sign in", text: "I already have an account", y: 720, width: 334, height: 48, fill: "#f7f8fc", textColor: "#7561df"}),
        at("text", {name: "Terms", text: "Made for your next big idea.", y: 808, width: 334, height: 24, fontSize: 12, textColor: "#8b8e9e", textAlign: "center"})]
}
