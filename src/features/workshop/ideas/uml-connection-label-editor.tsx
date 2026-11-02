import {useLayoutEffect, useRef, useState} from "react"
import type {CanvasItem} from "../shape-clipboard"
import {umlConnectionRoute} from "../uml-connections"

export function UmlConnectionLabelEditor({item, items, zoom, onCommit, onCancel}: {
    item: CanvasItem
    items: CanvasItem[]
    zoom: number
    onCommit: (text: string) => void
    onCancel: () => void
}) {
    const [text, setText] = useState(item.text)
    const input = useRef<HTMLTextAreaElement>(null)
    const finished = useRef(false)
    const point = umlConnectionRoute(items, item).label
    const width = Math.min(360, Math.max(160, text.split("\n").reduce((longest,line) => Math.max(longest,line.length),0) * 8 + 24)) / zoom

    useLayoutEffect(() => {
        input.current?.focus({preventScroll: true})
        input.current?.select()
    }, [])
    useLayoutEffect(() => {
        const element = input.current
        if (!element) return
        element.style.height = "auto"
        element.style.height = `${Math.min(180 / zoom, Math.max(36 / zoom, element.scrollHeight))}px`
    }, [text, zoom])

    function finish(cancel: boolean, restoreFocus: boolean) {
        if (finished.current) return
        finished.current = true
        const canvas = input.current?.closest<HTMLElement>(".workshop-ideation")
        if (cancel) onCancel()
        else onCommit(text)
        if (restoreFocus) canvas?.focus({preventScroll: true})
    }

    return <div className="uml-connection-label-editor" style={{
        left: point.x, top: point.y, width, zIndex: items.length + 5,
    }} onPointerDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
        onWheel={event => event.stopPropagation()}>
        <textarea ref={input} aria-label="Connection label" value={text} rows={1} maxLength={100000}
            placeholder="Label" title="Enter to save · Shift+Enter for a new line · Escape to cancel"
            style={{fontSize: 14 / zoom, lineHeight: `${20 / zoom}px`, padding: `${8 / zoom}px`, borderWidth: 1 / zoom, borderRadius: 6 / zoom}}
            onChange={event => setText(event.target.value)} onBlur={() => finish(false, false)}
            onKeyDown={event => {
                event.stopPropagation()
                if (event.key === "Escape") {event.preventDefault(); finish(true, true)}
                else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    finish(false, true)
                }
            }}/>
    </div>
}
