export type Bounds = { x: number; y: number; width: number; height: number }

export function combinedBounds(items: Bounds[]): Bounds {
  if (!items.length) return { x: -100, y: -100, width: 200, height: 200 }
  const x = Math.min(...items.map((item) => item.x))
  const y = Math.min(...items.map((item) => item.y))
  return { x, y, width: Math.max(...items.map((item) => item.x + item.width)) - x, height: Math.max(...items.map((item) => item.y + item.height)) - y }
}

export function zoomAt(zoom: number, pan: { x: number; y: number }, next: number, anchor: { x: number; y: number }) {
  return { x: anchor.x - (anchor.x - pan.x) * next / zoom, y: anchor.y - (anchor.y - pan.y) * next / zoom }
}

export function fitBounds(bounds: Bounds, viewport: { width: number; height: number }, rightInset = 0) {
  const width = Math.max(1, viewport.width - rightInset)
  const height = Math.max(1, viewport.height)
  const zoom = Math.min(Math.max(1, width - 96) / Math.max(1, bounds.width), Math.max(1, height - 160) / Math.max(1, bounds.height))
  return { zoom, pan: { x: width / 2 - (bounds.x + bounds.width / 2) * zoom, y: height / 2 - (bounds.y + bounds.height / 2) * zoom } }
}
