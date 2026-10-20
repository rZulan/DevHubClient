import {combinedBounds} from "./canvas-view.ts"
import {normalizeRotation, type CanvasItem} from "./shape-clipboard.ts"

export function rotateSelection(items: CanvasItem[], degrees: number) {
    if (!items.length || degrees === 0) return items
    const bounds = combinedBounds(items)
    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const radians = degrees * Math.PI / 180
    const cosine = Math.cos(radians)
    const sine = Math.sin(radians)

    return items.map((item) => {
        const itemCenterX = item.x + item.width / 2
        const itemCenterY = item.y + item.height / 2
        const offsetX = itemCenterX - centerX
        const offsetY = itemCenterY - centerY
        const rotatedCenterX = centerX + offsetX * cosine - offsetY * sine
        const rotatedCenterY = centerY + offsetX * sine + offsetY * cosine
        return {
            ...item,
            x: rotatedCenterX - item.width / 2,
            y: rotatedCenterY - item.height / 2,
            rotation: normalizeRotation(item.rotation + degrees),
        }
    })
}
