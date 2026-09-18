import { useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react"

type Position = { x: number; y: number }
type Drag = { pointerId: number; start: Position; origin: Position; moved: boolean }

const storageKey = "devhub.chat-launcher-position"

export function useChatLauncherPosition() {
  const ref = useRef<HTMLButtonElement>(null)
  const drag = useRef<Drag | null>(null)
  const suppressClick = useRef(false)
  const currentPosition = useRef<Position | null>(null)
  const [position, setPosition] = useState<Position | null>(null)
  const [dragging, setDragging] = useState(false)

  function moveTo(next: Position) {
    const button = ref.current
    if (!button) return
    const margin = 8
    const clamped = {
      x: Math.max(margin, Math.min(next.x, window.innerWidth - button.offsetWidth - margin)),
      y: Math.max(margin, Math.min(next.y, window.innerHeight - button.offsetHeight - margin)),
    }
    currentPosition.current = clamped
    setPosition(clamped)
  }

  function savePosition() {
    if (!currentPosition.current) return
    try {
      localStorage.setItem(storageKey, JSON.stringify(currentPosition.current))
    } catch { /* Dragging still works when browser storage is unavailable. */ }
  }

  useLayoutEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "null")
      if (saved && typeof saved === "object" && "x" in saved && "y" in saved
        && typeof saved.x === "number" && Number.isFinite(saved.x)
        && typeof saved.y === "number" && Number.isFinite(saved.y)) {
        moveTo({ x: saved.x, y: saved.y })
        savePosition()
      }
    } catch { /* Ignore malformed or unavailable storage. */ }

    function handleResize() {
      if (currentPosition.current) {
        moveTo(currentPosition.current)
        savePosition()
      }
    }
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || drag.current) return
    const bounds = event.currentTarget.getBoundingClientRect()
    suppressClick.current = false
    drag.current = {
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      origin: { x: bounds.left, y: bounds.top },
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
    moveTo({ x: active.origin.x + dx, y: active.origin.y + dy })
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
    style: position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined,
    "data-dragging": dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp: finishDrag,
    onPointerCancel: finishDrag,
    onLostPointerCapture: finishDrag,
    onClickCapture,
  }
}
