import {prepareErdCanvas} from "./erd-canvas-export.ts"
import {encodePng} from "./png-stream.ts"
import type {ErdPngMessage, ErdPngRequest} from "./erd-png-protocol.ts"

const send = (message: ErdPngMessage) => self.postMessage(message)
self.onmessage = async ({data}: MessageEvent<ErdPngRequest>) => {
    try {
        send({type: "progress", percent: 0})
        const scene = prepareErdCanvas(data), canvas = new OffscreenCanvas(1, 1)
        const context = canvas.getContext("2d", {willReadFrequently: true})
        if (!context) throw new Error("PNG rendering is unavailable in this browser.")
        const tileWidth = 4096, rows = Math.max(1, Math.min(512, Math.floor(32 * 1024 * 1024 / (scene.width * 4))))
        let progress = 0
        try {
            const blob = await encodePng(scene.width, scene.height, async (y, height) => {
                const band = new Uint8Array(scene.width * height * 4)
                for (let x = 0; x < scene.width; x += tileWidth) {
                    const width = Math.min(tileWidth, scene.width - x)
                    if (canvas.width !== width) canvas.width = width
                    if (canvas.height !== height) canvas.height = height
                    scene.draw(context, x, y, width, height)
                    const pixels = context.getImageData(0, 0, width, height).data
                    for (let row = 0; row < height; row++) band.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (row * scene.width + x) * 4)
                }
                const next = Math.floor((y + height) / scene.height * 99)
                if (next > progress) {progress = next; send({type: "progress", percent: progress})}
                return band
            }, rows)
            send({type: "done", blob, width: scene.width, height: scene.height})
        } finally {canvas.width = 0; canvas.height = 0}
    } catch (error) {send({type: "error", message: error instanceof Error ? error.message : "Could not export the PNG."})}
}
