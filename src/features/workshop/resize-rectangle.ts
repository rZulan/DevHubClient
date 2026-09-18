export type ResizeDirection = "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se"

export function resizeRectangle(
  rectangle: { x: number; y: number; width: number; height: number },
  direction: ResizeDirection,
  dx: number,
  dy: number,
) {
  const minimumSize = 24
  let { x, y, width, height } = rectangle
  if (direction.includes("e")) width = Math.max(minimumSize, rectangle.width + dx)
  if (direction.includes("s")) height = Math.max(minimumSize, rectangle.height + dy)
  if (direction.includes("w")) {
    width = Math.max(minimumSize, rectangle.width - dx)
    x = rectangle.x + rectangle.width - width
  }
  if (direction.includes("n")) {
    height = Math.max(minimumSize, rectangle.height - dy)
    y = rectangle.y + rectangle.height - height
  }
  return { x, y, width, height }
}
