import {designPaintOrder, layerUnavailable, type DesignDocument, type DesignLayer} from "./design-document.ts"

export function designSvg(document: DesignDocument, frameId?: string): string {
    const escape = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;")
    const frame = document.layers.find(l => l.id === frameId && l.kind === "frame")
    const visible = designPaintOrder(document).filter(l => !layerUnavailable(document, l, "hidden") && (!frame || l.id === frame.id || l.parentId === frame.id))
    const x = frame?.x ?? Math.min(0, ...visible.map(l => l.x)), y = frame?.y ?? Math.min(0, ...visible.map(l => l.y))
    const width = frame?.width ?? Math.max(100, ...visible.map(l => l.x + l.width)) - x, height = frame?.height ?? Math.max(100, ...visible.map(l => l.y + l.height)) - y
    const clips = visible.filter(l => l.kind === "frame").map((l, i) => ({id: l.id, key: `frame-${i}`, layer: l}))
    const measure = typeof window === "undefined" ? null : window.document.createElement("canvas").getContext("2d")
    const text = (l: DesignLayer) => {
        if (!l.text) return ""
        const align = l.textAlign ?? (l.kind === "button" ? "center" : "left"), inset = l.kind === "text" ? 0 : 12, tx = align === "center" ? l.width / 2 : align === "right" ? l.width - inset : inset
        if (measure) measure.font = `${l.fontWeight ?? 400} ${l.fontSize}px "${l.fontFamily ?? "Arial"}"`
        const available = Math.max(1, l.width - inset * 2), glyphs = new Map<string, number>(), lines: string[] = []
        const width = (s: string) => [...s].reduce((sum, char) => {if (!glyphs.has(char)) glyphs.set(char, measure?.measureText(char).width ?? l.fontSize * (char === " " ? .28 : .52)); return sum + glyphs.get(char)!}, 0)
        for (const paragraph of l.text.split("\n")) {
            let line = "", used = 0
            for (const char of paragraph) {
                const next = width(char)
                if (line && used + next > available) {
                    const split = line.lastIndexOf(" ")
                    if (split > 0) {lines.push(line.slice(0, split)); line = line.slice(split + 1)} else {lines.push(line); line = ""}
                    used = width(line)
                }
                line += char; used += next
            }
            lines.push(line)
        }
        const lineHeight = l.fontSize * (l.lineHeight ?? 1.4), ty = l.kind === "button" ? (l.height - lines.length * lineHeight) / 2 + l.fontSize * 1.05 : inset + l.fontSize * 1.05
        return `<text xml:space="preserve" x="${tx}" y="${ty}" text-anchor="${align === "center" ? "middle" : align === "right" ? "end" : "start"}" font-family="${escape(l.fontFamily ?? "Arial")}, sans-serif" font-weight="${l.fontWeight ?? 400}" font-size="${l.fontSize}" fill="${l.textColor}">${lines.map((line, i) => `<tspan x="${tx}" dy="${i ? lineHeight : 0}">${escape(line)}</tspan>`).join("")}</text>`
    }
    const shapes = visible.map((l, i) => {
        const parent = clips.find(c => c.id === l.parentId), common = `fill="${l.kind === "text" ? "none" : l.fill}" stroke="${l.stroke}" stroke-width="${l.strokeWidth}"${l.shadow ? ' filter="url(#shadow)"' : ""}`
        const shape = l.kind === "ellipse" ? `<ellipse cx="${l.width / 2}" cy="${l.height / 2}" rx="${l.width / 2}" ry="${l.height / 2}" ${common}/>` : `<rect width="${l.width}" height="${l.height}" rx="${l.radius}" ${common}/>`
        const image = l.image ? `<g clip-path="url(#text-${i})"><image href="${escape(l.image)}" width="${l.width}" height="${l.height}" preserveAspectRatio="xMidYMid ${l.imageFit === "contain" ? "meet" : "slice"}"/></g>` : ""
        const control = l.control === "toggle" ? `<circle cx="${Math.max(4, l.width - l.height + 4) + Math.max(8, l.height - 8) / 2}" cy="${l.height / 2}" r="${Math.max(8, l.height - 8) / 2}" fill="#ffffff"/>` : ""
        return `<g${parent ? ` clip-path="url(#${parent.key})"` : ""}><g transform="translate(${l.x} ${l.y})" opacity="${l.opacity * (parent?.layer.opacity ?? 1)}">${shape}${image}${control}<g clip-path="url(#text-${i})">${text(l)}</g></g></g>`
    }).join("\n")
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${width} ${height}" width="${width}" height="${height}"><defs>${clips.map(c => `<clipPath id="${c.key}"><rect x="${c.layer.x}" y="${c.layer.y}" width="${c.layer.width}" height="${c.layer.height}" rx="${c.layer.radius}"/></clipPath>`).join("")}${visible.map((l, i) => `<clipPath id="text-${i}">${l.kind === "ellipse" ? `<ellipse cx="${l.width / 2}" cy="${l.height / 2}" rx="${l.width / 2}" ry="${l.height / 2}"/>` : `<rect width="${l.width}" height="${l.height}" rx="${l.radius}"/>`}</clipPath>`).join("")}<filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#18213b" flood-opacity=".1"/></filter></defs>${shapes}</svg>`
}
export async function designPng(document: DesignDocument, frameId?: string) {
    const source = designSvg(document, frameId), url = URL.createObjectURL(new Blob([source], {type: "image/svg+xml"}))
    try {
        const image = new Image(); image.src = url; await image.decode()
        const scale = Math.min(2, 8192 / Math.max(image.width, image.height), Math.sqrt(32e6 / (image.width * image.height)))
        const canvas = window.document.createElement("canvas"); canvas.width = Math.ceil(image.width * scale); canvas.height = Math.ceil(image.height * scale)
        const context = canvas.getContext("2d"); if (!context) throw new Error("Image export is unavailable in this browser.")
        context.scale(scale, scale); context.drawImage(image, 0, 0)
        const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create PNG.")), "image/png"))
        const download = URL.createObjectURL(blob), link = window.document.createElement("a"); link.href = download; link.download = "interface-design.png"; link.click(); setTimeout(() => URL.revokeObjectURL(download), 1000)
    } finally {URL.revokeObjectURL(url)}
}
