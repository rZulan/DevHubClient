import type {Root, RootContent} from "hast"

export const wikiImageMaxDimension = 4096
function dimension(value: string) {
    if (!/^\d{1,4}(?:px)?$/.test(value)) return undefined
    const number = Number(value.replace(/px$/, ""))
    return number >= 1 && number <= wikiImageMaxDimension ? number : undefined
}

export function wikiImageSize(attributes: string): {width?: number; height?: number} | null {
    const size: {width?: number; height?: number} = {}, tokens = attributes.trim().split(/\s+/)
    if (!tokens.length || tokens.length > 2) return null
    for (const token of tokens) {
        const match = /^(width|height)=(\d+(?:px)?)$/.exec(token)
        if (!match) return null
        const key = match[1] as "width" | "height", value = dimension(match[2])
        if (size[key] !== undefined || value === undefined) return null
        size[key] = value
    }
    return size
}

/** Markdown remains safe: only numeric image dimensions become element properties. */
export function rehypeWikiImages() {
    return (root: Root) => {
        function walk(nodes: RootContent[]) {
            for (let index = 0; index < nodes.length; index++) {
                const node = nodes[index], following = nodes[index + 1]
                if (node.type !== "element") continue
                if (node.tagName === "code" || node.tagName === "pre") continue
                if (node.tagName === "img" && following?.type === "text") {
                    const match = /^[ \t]*\{([^{}\n]{1,100})\}/.exec(following.value)
                    const size = match ? wikiImageSize(match[1]) : null
                    if (match && size) {
                        Object.assign(node.properties, size)
                        following.value = following.value.slice(match[0].length)
                    }
                }
                walk(node.children)
            }
        }
        walk(root.children)
    }
}

export function wikiImageReference(url: string, alt: string, width = "", height = "") {
    const source = url.trim()
    if (!source || /[<>\r\n]/.test(source)) throw new Error("Enter an image URL.")
    let normalized: string
    try {
        const parsed = new URL(source, "https://wiki.invalid/")
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
        normalized = /^(https?:)?\/\//i.test(source) ? parsed.href : encodeURI(source).replace(/%25([a-f0-9]{2})/gi, "%$1")
    } catch {throw new Error("Use an HTTP, HTTPS or relative image URL.")}
    const attributes = [width.trim() && `width=${width.trim()}`, height.trim() && `height=${height.trim()}`].filter(Boolean).join(" ")
    if (attributes && !wikiImageSize(attributes)) throw new Error("Width and height must be whole pixels between 1 and 4096.")
    const description = alt.replace(/[\r\n]+/g, " ").replace(/[\\[\]]/g, "\\$&")
    return `![${description}](<${normalized}>)${attributes ? `{${attributes}}` : ""}`
}
