import {useRef, type PointerEvent, type RefObject} from "react"
import {pinchView, type CanvasView} from "./canvas-view"

type Point = {x: number; y: number}
/** Two-finger navigation takes over from editing; a single finger can still move a selected item. */
export function useCanvasTouch(root: RefObject<HTMLDivElement | null>, view: CanvasView, onView: (view: CanvasView) => void, onStart: () => void) {
    const touches = useRef(new Map<number, Point>())
    const pinch = useRef<{points: [Point, Point]; view: CanvasView} | null>(null)
    const navigating = useRef(false)
    function point(event: PointerEvent): Point {
        const bounds = root.current!.getBoundingClientRect()
        return {x: event.clientX - bounds.left, y: event.clientY - bounds.top}
    }
    function onPointerDownCapture(event: PointerEvent) {
        if (event.pointerType !== "touch" || !root.current || (event.target as Element).closest(".tool-canvas-actions, .workshop-canvas-toolbar, .workshop-shape-menu, .workshop-shape-properties, .workshop-zoom-control, button:not(.tool-connect-handle), input, textarea, select, [contenteditable=true]")) return
        if (navigating.current) {event.preventDefault(); event.stopPropagation(); return}
        touches.current.set(event.pointerId, point(event))
        if (touches.current.size !== 2) return
        onStart()
        pinch.current = {points: [...touches.current.values()] as [Point, Point], view}
        navigating.current = true
        event.preventDefault(); event.stopPropagation()
        root.current.setPointerCapture(event.pointerId)
    }
    function onPointerMoveCapture(event: PointerEvent) {
        if (!touches.current.has(event.pointerId) || !root.current) return
        touches.current.set(event.pointerId, point(event))
        if (!navigating.current) return
        event.preventDefault(); event.stopPropagation()
        if (touches.current.size === 2 && pinch.current) onView(pinchView(pinch.current.view, pinch.current.points, [...touches.current.values()] as [Point, Point]))
    }
    function finish(event: PointerEvent) {
        touches.current.delete(event.pointerId)
        // Let child pointer-up handlers release capture and finish their edit transaction.
        if (!touches.current.size) {pinch.current = null; navigating.current = false}
    }
    return {onPointerDownCapture, onPointerMoveCapture, onPointerUpCapture: finish, onPointerCancelCapture: finish}
}
