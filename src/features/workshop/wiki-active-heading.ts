type HeadingPosition = {id: string; top: number}
type ScrollPosition = {top: number; height: number; scrollTop: number; scrollHeight: number}
export type WikiHeadingNavigation = {contentKey: string; id: string; sequence: number}
export type WikiHeadingSelection = {id: string; scrollTop: number | null}

const headingOffset = 100

/** Leave room for the final heading to reach the same reading position as earlier headings. */
export function wikiScrollTail(lastHeadingTop: number, contentBottom: number, viewportHeight: number): number {
    // Scroll extents round to whole pixels while heading bounds can be fractional.
    return Math.max(64, Math.ceil(viewportHeight - headingOffset - (contentBottom - lastHeadingTop)) + 1)
}

export function activeWikiHeading(headings: HeadingPosition[], scroller: ScrollPosition, selection: WikiHeadingSelection | null = null): string {
    if (!headings.length) return ""
    // A clicked section can be selected even when it cannot reach the top of the viewport.
    if (selection && headings.some(heading => heading.id === selection.id)
        && (selection.scrollTop === null || Math.abs(scroller.scrollTop - selection.scrollTop) <= 1)) return selection.id
    let active = headings[0].id
    for (const heading of headings) {
        if (heading.top > scroller.top + headingOffset) break
        active = heading.id
    }
    return active
}
