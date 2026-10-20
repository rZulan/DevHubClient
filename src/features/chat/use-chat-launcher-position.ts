import {type MouseEvent, type PointerEvent, useCallback, useLayoutEffect, useRef, useState} from "react"
import {fitLauncherPosition, isLauncherPosition, launcherSize, readLauncherPositions, type LauncherPositions} from "./chat-launcher-position"

type Position = { x: number; y: number }
type Drag = { pointerId: number; start: Position; origin: Position; moved: boolean }

export function useChatLauncherPosition(userId = "guest") {
    const storageKey = `devhub.chat-launcher-positions.v2:${userId}`
    const ref = useRef<HTMLButtonElement>(null)
    const drag = useRef<Drag | null>(null)
    const suppressClick = useRef(false)
    const currentPosition = useRef<Position | null>(null)
    const preferred = useRef<LauncherPositions>({})
    const [position, setPosition] = useState<Position | null>(null)
    const [dragging, setDragging] = useState(false)

    const moveTo = useCallback((next: Position) => {
        const button = ref.current
        if (!button) return
        const clamped = fitLauncherPosition(next, {width: window.innerWidth, height: window.innerHeight}, {width: button.offsetWidth, height: button.offsetHeight})
        currentPosition.current = clamped
        setPosition(clamped)
    }, [])

    function savePosition() {
        if (!currentPosition.current) return
        preferred.current[launcherSize(window.innerWidth)] = currentPosition.current
        try {
            localStorage.setItem(storageKey, JSON.stringify(preferred.current))
        } catch { /* Dragging still works when browser storage is unavailable. */
        }
    }

    useLayoutEffect(() => {
        preferred.current = {}
        try {
            preferred.current = readLauncherPositions(localStorage.getItem(storageKey))
            const legacy: unknown = JSON.parse(localStorage.getItem("devhub.chat-launcher-position") ?? "null")
            if (!Object.keys(preferred.current).length && isLauncherPosition(legacy)) {
                preferred.current[launcherSize(window.innerWidth)] = legacy
                localStorage.setItem(storageKey, JSON.stringify(preferred.current))
                localStorage.removeItem("devhub.chat-launcher-position")
            }
        } catch { /* Ignore malformed or unavailable storage. */
        }

        function handleResize() {
            drag.current = null
            setDragging(false)
            const saved = preferred.current[launcherSize(window.innerWidth)]
            if (saved) moveTo(saved)
            else {currentPosition.current = null; setPosition(null)}
        }
        handleResize()
        window.addEventListener("resize", handleResize)
        return () => window.removeEventListener("resize", handleResize)
    }, [storageKey, moveTo])

    function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
        if (!event.isPrimary || event.button !== 0 || drag.current) return
        const bounds = event.currentTarget.getBoundingClientRect()
        suppressClick.current = false
        drag.current = {
            pointerId: event.pointerId,
            start: {x: event.clientX, y: event.clientY},
            origin: {x: bounds.left, y: bounds.top},
            moved: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
    }

    function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
        const active = drag.current
        if (!active || active.pointerId !== event.pointerId) return
        const dx = event.clientX - active.start.x
        const dy = event.clientY - active.start.y
        if (!active.moved && Math.hypot(dx, dy) < 5) return
        active.moved = true
        suppressClick.current = true
        setDragging(true)
        moveTo({x: active.origin.x + dx, y: active.origin.y + dy})
    }

    function finishDrag(event: PointerEvent<HTMLButtonElement>) {
        if (drag.current?.pointerId !== event.pointerId) return
        if (drag.current.moved) savePosition()
        drag.current = null
        setDragging(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId)
        }
    }

    function onClickCapture(event: MouseEvent<HTMLButtonElement>) {
        if (suppressClick.current && event.detail !== 0) {
            event.preventDefault()
            event.stopPropagation()
        }
        suppressClick.current = false
    }

    return {
        ref,
        style: position ? {left: position.x, top: position.y, right: "auto", bottom: "auto"} : undefined,
        "data-dragging": dragging,
        onPointerDown,
        onPointerMove,
        onPointerUp: finishDrag,
        onPointerCancel: finishDrag,
        onLostPointerCapture: finishDrag,
        onClickCapture,
    }
}
