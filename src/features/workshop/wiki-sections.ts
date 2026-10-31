import type {Element, Root, RootContent} from "hast"

function headingText(node: RootContent): string {
    if (node.type === "text") return node.value
    return node.type === "element" ? node.children.map(headingText).join("") : ""
}

/** Give headings stable anchors, then group each heading with its content and subsections. */
export function rehypeWikiSections({collapsedSections, prefix = "wiki-section"}: {collapsedSections?: ReadonlySet<string>; prefix?: string} = {}) {
    return (root: Root) => {
        const counts = new Map<string, number>(), used = new Set<string>()
        function anchors(nodes: RootContent[]) {
            for (const node of nodes) {
                if (node.type !== "element") continue
                if (/^h[1-6]$/.test(node.tagName)) {
                    const base = headingText(node).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-") || "section"
                    let count = counts.get(base) ?? 0
                    let anchor = String(node.properties.id ?? `${base}${count ? `-${count}` : ""}`)
                    while (used.has(anchor)) {count++; anchor = `${base}-${count}`}
                    counts.set(base, count + 1); used.add(anchor); node.properties.id = anchor
                }
                anchors(node.children)
            }
        }
        function group(nodes: RootContent[]): RootContent[] {
            const result: RootContent[] = [], stack: {level: number; body: Element}[] = []
            for (const node of nodes) {
                const level = node.type === "element" && /^h[1-6]$/.test(node.tagName) ? Number(node.tagName[1]) : 0
                if (level && node.type === "element") {
                    while (stack.length && stack[stack.length - 1].level >= level) stack.pop()
                    const anchor = String(node.properties.id)
                    const body: Element = {type: "element", tagName: "div", properties: {id: `${prefix}-${anchor}`, className: ["wiki-section-body"], hidden: collapsedSections?.has(anchor) ?? false, dataWikiSectionBody: anchor}, children: []}
                    const section: Element = {type: "element", tagName: "section", properties: {className: ["wiki-section"]}, children: [node, body]}
                    const parent = stack[stack.length - 1]
                    const siblings = parent ? parent.body.children : result
                    siblings.push(section)
                    stack.push({level, body})
                } else {
                    if (node.type === "element") node.children = group(node.children) as Element["children"]
                    const parent = stack[stack.length - 1]
                    const siblings = parent ? parent.body.children : result
                    siblings.push(node)
                }
            }
            return result
        }
        anchors(root.children)
        root.children = group(root.children)
    }
}
