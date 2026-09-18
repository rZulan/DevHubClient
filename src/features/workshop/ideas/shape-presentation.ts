import type { CanvasItem } from "../shape-clipboard"

export function shapeTextColor(fillColor: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(fillColor.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
  return luminance > 0.179 ? "#000000" : "#ffffff"
}

export function groupMemberLabel(item: CanvasItem, index: number) {
  if (item.kind === "note") return item.noteHeader.trim() ? `Note · ${item.noteHeader.trim().slice(0, 36)}` : `Note ${index + 1}`
  const text = item.text.trim().split(/\r?\n/, 1)[0]
  return text ? `Rectangle · ${text.slice(0, 36)}` : `Rectangle ${index + 1}`
}
