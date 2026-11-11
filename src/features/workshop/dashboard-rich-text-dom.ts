import {appendDashboardRun, cleanDashboardTextStyle, dashboardTextStyle, type DashboardTextRun, type DashboardTextStyle, type TextRange} from "./dashboard-text-format"

export function readDashboardEditor(root: Node, base: DashboardTextStyle) {
    const runs: DashboardTextRun[] = []
    function visit(node: Node, style: DashboardTextStyle) {
        if (node.nodeType === Node.TEXT_NODE) {
            appendDashboardRun(runs, node.textContent ?? "", style)
            return
        }
        if (!(node instanceof HTMLElement)) return
        if (node.tagName === "BR") {
            if (node.parentNode !== root || root.childNodes.length > 1) appendDashboardRun(runs, "\n", style)
            return
        }
        if ((node.tagName === "DIV" || node.tagName === "P") && runs.length && !runs.at(-1)?.text.endsWith("\n")) appendDashboardRun(runs, "\n", style)
        const encoded = node.dataset.dashboardRunStyle
        if (encoded) {
            try { style = cleanDashboardTextStyle(JSON.parse(encoded) ?? {}) }
            catch { /* The surrounding text keeps its style. */ }
        }
        node.childNodes.forEach(child => visit(child, style))
    }
    root.childNodes.forEach(node => visit(node, base))
    return runs
}

export function writeDashboardEditor(root: HTMLElement, runs: DashboardTextRun[]) {
    root.replaceChildren(...runs.map(run => {
        const span = root.ownerDocument.createElement("span")
        const marks = cleanDashboardTextStyle(run)
        span.dataset.dashboardRunStyle = JSON.stringify(marks)
        Object.assign(span.style, Object.fromEntries(Object.entries(dashboardTextStyle(marks))
            .filter(([, value]) => value !== undefined).map(([key, value]) => [key, key === "fontSize" ? `${value}px` : value])))
        span.textContent = run.text
        return span
    }))
}

export function dashboardEditorSelection(root: HTMLElement): TextRange | undefined {
    const selection = root.ownerDocument.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return
    const before = range.cloneRange()
    before.selectNodeContents(root)
    before.setEnd(range.startContainer, range.startOffset)
    const start = before.toString().length
    return {start, end: start + range.toString().length}
}

export function selectDashboardEditorText(root: HTMLElement, {start, end}: TextRange, focus = true) {
    const document = root.ownerDocument
    const range = document.createRange()
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const position = (offset: number): [Node, number] => {
        walker.currentNode = root
        let previous: Node = root
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const length = node.textContent?.length ?? 0
            if (offset <= length) return [node, offset]
            offset -= length
            previous = node
        }
        return [previous, previous === root ? 0 : previous.textContent?.length ?? 0]
    }
    range.setStart(...position(start))
    range.setEnd(...position(end))
    if (focus) root.focus({preventScroll: true})
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
}
