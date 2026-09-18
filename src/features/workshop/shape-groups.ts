import type { CanvasItem } from "./shape-clipboard"

export function expandGroupedIds(items: CanvasItem[], ids: string[]) {
  const selected = new Set(ids)
  const groups = new Set(items.filter((item) => selected.has(item.id) && item.groupId).map((item) => item.groupId))
  if (!groups.size) return ids
  return items.filter((item) => selected.has(item.id) || (item.groupId && groups.has(item.groupId))).map((item) => item.id)
}

export function groupShapes(items: CanvasItem[], ids: string[], groupId: string) {
  const selected = new Set(expandGroupedIds(items, ids))
  return items.map((item) => selected.has(item.id) ? { ...item, groupId } : item)
}

export function ungroupShapes(items: CanvasItem[], ids: string[]) {
  const selected = new Set(expandGroupedIds(items, ids))
  return items.map((item) => selected.has(item.id) ? { ...item, groupId: undefined } : item)
}
