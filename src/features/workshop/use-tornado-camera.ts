import {useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent} from "react"
import {boundTornadoCamera, defaultTornadoCamera, elasticTornadoCamera, tornadoProjection, type TornadoCamera, type TornadoScene} from "./tornado-geometry"

type Point = {x: number; y: number}
type Gesture = {kind: "single"; start: Point; camera: TornadoCamera; pan: boolean} | {kind: "pinch"; center: Point; distance: number; camera: TornadoCamera}
export function useTornadoCamera(scene: TornadoScene) {
    const root = useRef<HTMLDivElement>(null)
    const [viewport, setViewport] = useState({width: 1, height: 1})
    const [camera, setCamera] = useState(defaultTornadoCamera)
    const [mode, setMode] = useState<"orbit" | "pan">("orbit")
    const [dragging, setDragging] = useState(false)
    const value = useRef(camera), size = useRef(viewport), geometry = useRef(scene)
    const pointers = useRef(new Map<number, Point>()), gesture = useRef<Gesture | null>(null), suppressClick = useRef(false)
    const animation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const commit = useCallback((next: TornadoCamera) => {value.current = next; setCamera(next)}, [])
    const stop = useCallback(() => {cancelAnimationFrame(animation.current); clearTimeout(timer.current)}, [])
    const fit = useCallback(() => {stop(); commit({...value.current, zoom: 1, panX: 0, panY: 0})}, [commit, stop])
    const reset = useCallback(() => {stop(); commit(defaultTornadoCamera)}, [commit, stop])
    const settle = useCallback(() => {
        stop()
        const from = value.current, bound = boundTornadoCamera(from, size.current)
        if (Math.abs(from.panX - bound.panX) < .1 && Math.abs(from.panY - bound.panY) < .1 || matchMedia("(prefers-reduced-motion: reduce)").matches) {commit(bound); return}
        const start = performance.now()
        function spring(now: number) {
            const t = Math.min(1, (now - start) / 650), remaining = t === 1 ? 0 : Math.exp(-8 * t) * Math.cos(7 * t)
            commit({...bound, panX: bound.panX + (from.panX - bound.panX) * remaining, panY: bound.panY + (from.panY - bound.panY) * remaining})
            if (t < 1) animation.current = requestAnimationFrame(spring)
        }
        animation.current = requestAnimationFrame(spring)
    }, [commit, stop])
    const zoom = useCallback((factor: number, anchor?: Point) => {
        stop()
        const current = value.current, nextZoom = Math.max(.45, Math.min(5, current.zoom * factor)), ratio = nextZoom / current.zoom
        const point = anchor ?? {x: size.current.width / 2, y: size.current.height / 2}
        commit(boundTornadoCamera({...current, zoom: nextZoom,
            panX: point.x - size.current.width / 2 - (point.x - size.current.width / 2 - current.panX) * ratio,
            panY: point.y - size.current.height / 2 - (point.y - size.current.height / 2 - current.panY) * ratio}, size.current))
    }, [commit, stop])
    const focus = useCallback((cycle: number, phase: number) => {
        stop()
        const point = geometry.current.layers[cycle - 1]?.phases[phase]
        if (!point) return
        const next = {...value.current, yaw: Math.atan2(point.z, point.x) - Math.PI / 2, panX: 0, panY: 0}
        const projected = tornadoProjection(geometry.current, next, size.current)(point)
        commit(boundTornadoCamera({...next, panX: size.current.width / 2 - projected.x, panY: size.current.height / 2 - projected.y}, size.current))
    }, [commit, stop])
    const preset = useCallback((view: "front" | "top") => {
        stop(); commit({...value.current, yaw: 0, pitch: view === "top" ? -1.28 : 0, panX: 0, panY: 0, zoom: 1})
    }, [commit, stop])
    useEffect(() => {geometry.current = scene; fit()}, [scene, fit])
    useEffect(() => {
        const element = root.current
        if (!element) return
        const observer = new ResizeObserver(([entry]) => {
            const next = {width: entry.contentRect.width, height: entry.contentRect.height}
            if (!next.width || !next.height) return
            size.current = next; setViewport(next); commit(boundTornadoCamera(value.current, next))
        })
        observer.observe(element)
        function wheel(event: WheelEvent) {
            event.preventDefault()
            const bounds = element!.getBoundingClientRect(), unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1
            zoom(Math.exp(-Math.max(-600, Math.min(600, event.deltaY * unit)) * .002), {x: event.clientX - bounds.left, y: event.clientY - bounds.top})
        }
        element.addEventListener("wheel", wheel, {passive: false})
        return () => {observer.disconnect(); element.removeEventListener("wheel", wheel); stop()}
    }, [commit, stop, zoom])
    function point(event: PointerEvent): Point {
        const bounds = root.current!.getBoundingClientRect()
        return {x: event.clientX - bounds.left, y: event.clientY - bounds.top}
    }
    function onPointerDown(event: PointerEvent<HTMLDivElement>) {
        if ((event.target as Element).closest(".tornado-toolbar, .tornado-layer-legend")) return
        stop(); suppressClick.current = false
        pointers.current.set(event.pointerId, point(event))
        if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()]
            gesture.current = {kind: "pinch", center: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), camera: value.current}
            suppressClick.current = true
            for (const id of pointers.current.keys()) event.currentTarget.setPointerCapture(id)
        } else if (pointers.current.size === 1) {
            gesture.current = {kind: "single", start: point(event), camera: value.current, pan: mode === "pan" || event.shiftKey || event.button === 1 || event.button === 2}
            if (!(event.target as Element).closest(".tornado-phase")) event.currentTarget.setPointerCapture(event.pointerId)
        }
    }
    function onPointerMove(event: PointerEvent<HTMLDivElement>) {
        const start = gesture.current
        if (!start || !pointers.current.has(event.pointerId)) return
        const next = point(event); pointers.current.set(event.pointerId, next)
        if (start.kind === "single") {
            const dx = next.x - start.start.x, dy = next.y - start.start.y
            if (Math.hypot(dx, dy) < 5 && !suppressClick.current) return
            commit(start.pan ? elasticTornadoCamera({...start.camera, panX: start.camera.panX + dx, panY: start.camera.panY + dy}, size.current)
                : boundTornadoCamera({...start.camera, yaw: start.camera.yaw + dx * .007, pitch: start.camera.pitch + dy * .006}, size.current))
        } else if (pointers.current.size === 2) {
            const [a, b] = [...pointers.current.values()], center = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}
            const nextZoom = Math.max(.45, Math.min(5, start.camera.zoom * Math.hypot(a.x - b.x, a.y - b.y) / start.distance)), ratio = nextZoom / start.camera.zoom
            commit(elasticTornadoCamera({...start.camera, zoom: nextZoom,
                panX: center.x - size.current.width / 2 - (start.center.x - size.current.width / 2 - start.camera.panX) * ratio,
                panY: center.y - size.current.height / 2 - (start.center.y - size.current.height / 2 - start.camera.panY) * ratio}, size.current))
        }
        suppressClick.current = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId)
    }
    function finish(event: PointerEvent<HTMLDivElement>) {
        if (!pointers.current.delete(event.pointerId)) return
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (pointers.current.size === 1) gesture.current = {kind: "single", start: [...pointers.current.values()][0], camera: value.current, pan: mode === "pan"}
        else {gesture.current = null; setDragging(false); settle()}
    }
    function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) return
        const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key]
        if (direction) {
            event.preventDefault(); stop()
            commit(event.shiftKey ? elasticTornadoCamera({...value.current, panX: value.current.panX - direction[0] * 40, panY: value.current.panY - direction[1] * 40}, size.current)
                : boundTornadoCamera({...value.current, yaw: value.current.yaw + direction[0] * .18, pitch: value.current.pitch + direction[1] * .12}, size.current))
            timer.current = setTimeout(settle, 140)
        } else if (event.key === "Home" || event.key === "0") {event.preventDefault(); reset()}
        else if (event.key === "+" || event.key === "=") {event.preventDefault(); zoom(1.2)}
        else if (event.key === "-") {event.preventDefault(); zoom(1 / 1.2)}
    }
    return {root, viewport, camera, mode, setMode, dragging, fit, reset, preset, zoom, focus, handlers: {
        onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish, onKeyDown,
        onContextMenu: (event: React.MouseEvent) => event.preventDefault(),
        onClickCapture: (event: React.MouseEvent) => {if (suppressClick.current && event.detail > 0) {event.preventDefault(); event.stopPropagation(); suppressClick.current = false}},
        onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => {
            if (event.target !== event.currentTarget || event.currentTarget.hasPointerCapture(event.pointerId) || !pointers.current.has(event.pointerId)) return
            pointers.current.clear(); gesture.current = null; setDragging(false); settle()
        },
    }}
}
