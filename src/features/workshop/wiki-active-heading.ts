type HeadingPosition = {id: string; top: number}
type ScrollPosition = {top: number; height: number; scrollTop: number; scrollHeight: number}
export type WikiHeadingNavigation = {contentKey: string; id: string; sequence: number}
export type WikiHeadingSelection = {id: string; scrollTop: number | null}

export function activeWikiHeading(headings: HeadingPosition[], scroller: ScrollPosition, selection: WikiHeadingSelection | null = null): string {
    if (!headings.length) return ""
    // A clicked section can be selected even when it cannot reach the top of the viewport.
    if (selection && headings.some(heading => heading.id === selection.id)
        && (selection.scrollTop === null || Math.abs(scroller.scrollTop - selection.scrollTop) <= 1)) return selection.id
    if (scroller.scrollHeight > scroller.height + 1 && scroller.scrollTop + scroller.height >= scroller.scrollHeight - 2) return headings[headings.length - 1].id
    let active = headings[0].id
    for (const heading of headings) {
        if (heading.top > scroller.top + 100) break
        active = heading.id
    }
    return active
}
