import {useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from "react"
import {boundRoadmap, elasticRoadmap, fitRoadmap, type RoadmapCamera, type RoadmapPoint} from "./sdlc-camera"

export function useSdlcCamera(enabled = true) {
    const viewport = useRef<HTMLDivElement>(null)
    const size = useRef({width: 1, height: 1})
    const [camera, setCamera] = useState<RoadmapCamera>({x: 0, y: 0, zoom: 1})
    const value = useRef(camera), raw = useRef(camera)
    const frame = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const drag = useRef<{id: number; start: RoadmapPoint; camera: RoadmapCamera; moved: boolean} | null>(null)
    const [dragging, setDragging] = useState(false)
    const suppressClick = useRef(false)
    const commit = useCallback((next: RoadmapCamera) => {value.current = next; setCamera(next)}, [])
    const stop = useCallback(() => {cancelAnimationFrame(frame.current); clearTimeout(timer.current)}, [])
    const settle = useCallback(() => {
        stop()
        const from = value.current, edge = boundRoadmap(from, size.current)
        raw.current = edge
        if (Math.abs(from.x - edge.x) < .1 && Math.abs(from.y - edge.y) < .1 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {commit(edge); return}
        const start = performance.now()
        function spring(now: number) {
            const t = Math.min((now - start) / 650, 1)
            const remaining = t === 1 ? 0 : Math.exp(-8 * t) * Math.cos(7 * t)
            commit({...edge, x: edge.x + (from.x - edge.x) * remaining, y: edge.y + (from.y - edge.y) * remaining})
            if (t < 1) frame.current = requestAnimationFrame(spring)
        }
        frame.current = requestAnimationFrame(spring)
    }, [commit, stop])
    const zoom = useCallback((factor: number, anchor?: RoadmapPoint) => {
        stop()
        const previous = value.current, next = Math.max(.2, Math.min(2, previous.zoom * factor))
        const point = anchor ?? {x: size.current.width / 2, y: size.current.height / 2}
        const result = boundRoadmap({zoom: next, x: point.x - (point.x - previous.x) * next / previous.zoom, y: point.y - (point.y - previous.y) * next / previous.zoom}, size.current)
        raw.current = result; commit(result)
    }, [commit, stop])
    const fit = useCallback(() => {stop(); const next = fitRoadmap(size.current); raw.current = next; commit(next)}, [commit, stop])
    const reset = useCallback((point: RoadmapPoint) => {
        stop()
        const next = fitRoadmap(size.current)
        const focused = boundRoadmap({...next, x: size.current.width / 2 - point.x * next.zoom, y: size.current.height / 2 - point.y * next.zoom}, size.current)
        raw.current = focused; commit(focused)
    }, [commit, stop])
    const reveal = useCallback((point: RoadmapPoint) => {
        stop()
        const previous = value.current
        const next = boundRoadmap({...previous, x: size.current.width / 2 - point.x * previous.zoom, y: size.current.height / 2 - (point.y + 30) * previous.zoom}, size.current)
        raw.current = next; commit(next)
    }, [commit, stop])
    useEffect(() => {
        if (!enabled) return
        const element = viewport.current
        if (!element) return
        let initialized = false, windowWidth = window.innerWidth, windowHeight = window.innerHeight
        const observer = new ResizeObserver(([entry]) => {
            size.current = {width: entry.contentRect.width, height: entry.contentRect.height}
            if (!size.current.width || !size.current.height) return
            stop()
            const resized = windowWidth !== window.innerWidth || windowHeight !== window.innerHeight
            const next = initialized && !resized ? boundRoadmap(value.current, size.current) : fitRoadmap(size.current)
            // Fit the entire lifecycle initially; zoom and phase details provide a closer view.
            windowWidth = window.innerWidth; windowHeight = window.innerHeight
            initialized = true; raw.current = next; commit(next)
        })
        observer.observe(element)
        function wheel(event: WheelEvent) {
            event.preventDefault()
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1
            const rect = element!.getBoundingClientRect()
            zoom(Math.exp(-Math.max(-600, Math.min(600, event.deltaY * unit)) * .002), {x: event.clientX - rect.left, y: event.clientY - rect.top})
        }
        element.addEventListener("wheel", wheel, {passive: false})
        return () => {observer.disconnect(); element.removeEventListener("wheel", wheel); stop()}
    }, [commit, enabled, stop, zoom])
    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if (event.button !== 0 || !event.isPrimary) return
        stop(); raw.current = value.current; suppressClick.current = false
        drag.current = {id: event.pointerId, start: {x: event.clientX, y: event.clientY}, camera: value.current, moved: false}
    }
    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const gesture = drag.current
        if (!gesture || gesture.id !== event.pointerId || !event.buttons) return
        const dx = event.clientX - gesture.start.x, dy = event.clientY - gesture.start.y
        if (!gesture.moved && Math.hypot(dx, dy) < 5) return
        gesture.moved = true; suppressClick.current = true; setDragging(true)
        event.currentTarget.setPointerCapture(event.pointerId)
        raw.current = {...gesture.camera, x: gesture.camera.x + dx, y: gesture.camera.y + dy}
        commit(elasticRoadmap(raw.current, size.current))
    }
    function onPointerUp(event: PointerEvent<HTMLDivElement>) {
        if (drag.current?.id !== event.pointerId) return
        drag.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        setDragging(false); settle()
    }
    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) return
        const delta = {ArrowLeft: {x: 60, y: 0}, ArrowRight: {x: -60, y: 0}, ArrowUp: {x: 0, y: 60}, ArrowDown: {x: 0, y: -60}}[event.key]
        if (delta) {
            event.preventDefault(); stop()
            raw.current = {...value.current, x: value.current.x + delta.x, y: value.current.y + delta.y}
            commit(elasticRoadmap(raw.current, size.current)); timer.current = setTimeout(settle, 140)
        } else if (event.key === "Home" || event.key === "0") {event.preventDefault(); fit()}
        else if (event.key === "+" || event.key === "=") {event.preventDefault(); zoom(1.15)}
        else if (event.key === "-") {event.preventDefault(); zoom(1 / 1.15)}
    }
    function onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
        // Touch transfers implicit capture from a star to the canvas when a drag begins.
        if (event.target !== event.currentTarget || event.currentTarget.hasPointerCapture(event.pointerId)) return
        setDragging(false)
        if (drag.current) {drag.current = null; settle()}
    }
    return {viewport, camera, dragging, zoom, fit, reset, reveal, handlers: {onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onLostPointerCapture, onKeyDown,
        onClickCapture: (event: React.MouseEvent) => {if (suppressClick.current && event.detail > 0) {suppressClick.current = false; event.preventDefault(); event.stopPropagation()}}}}
}
