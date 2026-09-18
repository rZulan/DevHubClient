import type { Bounds } from "./canvas-view"

export function resizeSelection<T extends Bounds>(items: T[], original: Bounds, requested: Bounds) {
  const minimumScaleX = Math.max(...items.map((item) => 24 / item.width))
  const minimumScaleY = Math.max(...items.map((item) => 24 / item.height))
  const scaleX = Math.max(minimumScaleX, requested.width / original.width)
  const scaleY = Math.max(minimumScaleY, requested.height / original.height)
  const width = original.width * scaleX
  const height = original.height * scaleY
  const x = requested.x === original.x ? original.x : original.x + original.width - width
  const y = requested.y === original.y ? original.y : original.y + original.height - height
  return {
    bounds: { x, y, width, height },
    items: items.map((item) => ({ ...item, x: x + (item.x - original.x) * scaleX, y: y + (item.y - original.y) * scaleY, width: item.width * scaleX, height: item.height * scaleY })),
  }
}
