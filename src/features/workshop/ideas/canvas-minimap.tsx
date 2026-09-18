import { Maximize2 } from "lucide-react"
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react"

import { combinedBounds, type Bounds } from "../canvas-view"
import type { CanvasItem } from "../shape-clipboard"

export function CanvasMinimap({ items, viewport, onNavigate }: { items: CanvasItem[]; viewport: Bounds; onNavigate: (x: number, y: number) => void }) {
  const [dragBounds, setDragBounds] = useState<Bounds>()
  const pointer = useRef<number | null>(null)
  const bounds = dragBounds ?? combinedBounds([...items, viewport])
  const scale = Math.min(144 / Math.max(bounds.width, 1), 74 / Math.max(bounds.height, 1))
  const offsetX = (160 - bounds.width * scale) / 2
  const offsetY = (90 - bounds.height * scale) / 2

  function navigate(event: ReactPointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    onNavigate(bounds.x + ((event.clientX - rect.left) * 160 / rect.width - offsetX) / scale, bounds.y + ((event.clientY - rect.top) * 90 / rect.height - offsetY) / scale)
  }

  function stop(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointer.current !== event.pointerId) return
    pointer.current = null
    setDragBounds(undefined)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function mapped(rect: Bounds) {
    return { x: offsetX + (rect.x - bounds.x) * scale, y: offsetY + (rect.y - bounds.y) * scale, width: Math.max(.5, rect.width * scale), height: Math.max(.5, rect.height * scale) }
  }

  return (
    <div className="workshop-canvas-minimap" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
      <svg className="workshop-minimap-map" viewBox="0 0 160 90" role="img" aria-label="Canvas overview. Click or drag to navigate; highlighted rectangle shows the visible area." onPointerDown={(event) => {
        if (event.button !== 0 || !event.isPrimary) return
        event.preventDefault()
        pointer.current = event.pointerId
        setDragBounds(bounds)
        event.currentTarget.setPointerCapture(event.pointerId)
        navigate(event)
      }} onPointerMove={(event) => { if (pointer.current === event.pointerId) navigate(event) }} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}>
        {items.map((item) => <rect key={item.id} {...mapped(item)} rx={item.cornerRadius * scale} fill={item.appearance === "fill" ? item.fillColor : "none"} stroke={item.outlineStyle === "none" ? "none" : item.outlineColor} strokeWidth={1} />)}
        <rect {...mapped(viewport)} fill="#818cf81a" stroke="#818cf8" strokeWidth={1} />
      </svg>
      <span><Maximize2 /> Drag to navigate</span>
    </div>
  )
}
