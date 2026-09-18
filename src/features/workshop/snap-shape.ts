import type { ResizeDirection } from "./resize-rectangle"

type Rectangle = { id: string; x: number; y: number; width: number; height: number }
export type SnapGuide = { axis: "x" | "y"; position: number; start: number; end: number }

// Use screen pixels for the capture distance so snapping feels the same at every zoom.
export function snapShape<T extends Rectangle>(shape: T, others: Rectangle[], zoom: number, direction?: ResizeDirection) {
  const result = { ...shape }
  const guides: SnapGuide[] = []
  const threshold = 6 / zoom
  for (const axis of ["x", "y"] as const) {
    const size = axis === "x" ? "width" : "height"
    const cross = axis === "x" ? "y" : "x"
    const crossSize = axis === "x" ? "height" : "width"
    const leading = axis === "x" ? "w" : "n"
    const trailing = axis === "x" ? "e" : "s"
    if (direction && !direction.includes(leading) && !direction.includes(trailing)) continue
    const offsets = direction
      ? [direction.includes(leading) ? 0 : shape[size]]
      : [0, shape[size] / 2, shape[size]]
    let best: { delta: number; position: number; target: Rectangle } | undefined
    for (const target of others) {
      if (target.id === shape.id) continue
      for (const position of [target[axis], target[axis] + target[size] / 2, target[axis] + target[size]]) {
        for (const offset of offsets) {
          const delta = position - (shape[axis] + offset)
          if (Math.abs(delta) > threshold || (best && Math.abs(delta) >= Math.abs(best.delta))) continue
          if (direction && shape[size] + (direction.includes(leading) ? -delta : delta) < 24) continue
          best = { delta, position, target }
        }
      }
    }
    if (!best) continue
    if (!direction) result[axis] += best.delta
    else if (direction.includes(leading)) {
      result[axis] += best.delta
      result[size] -= best.delta
    } else result[size] += best.delta
    guides.push({ axis, position: best.position, start: Math.min(result[cross], best.target[cross]), end: Math.max(result[cross] + result[crossSize], best.target[cross] + best.target[crossSize]) })
  }
  return { shape: result, guides }
}
