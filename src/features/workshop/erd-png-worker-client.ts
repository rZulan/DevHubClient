import type {ErdPngMessage, ErdPngRequest, ErdPngResult} from "./erd-png-protocol.ts"

export function runErdPngWorker(request: ErdPngRequest, {signal, onProgress}: {signal?: AbortSignal; onProgress?: (percent: number) => void} = {}, createWorker = () => new Worker(new URL("./erd-png.worker.ts", import.meta.url), {type: "module"})) {
    return new Promise<ErdPngResult>((resolve, reject) => {
        if (signal?.aborted) {reject(new DOMException("Export cancelled.", "AbortError")); return}
        const worker = createWorker()
        const cleanup = () => {worker.terminate(); signal?.removeEventListener("abort", abort)}
        const abort = () => {cleanup(); reject(new DOMException("Export cancelled.", "AbortError"))}
        signal?.addEventListener("abort", abort, {once: true})
        worker.onmessage = ({data}: MessageEvent<ErdPngMessage>) => {
            if (data.type === "progress") {onProgress?.(data.percent); return}
            cleanup()
            if (data.type === "error") reject(new Error(data.message))
            else resolve({blob: data.blob, width: data.width, height: data.height})
        }
        worker.onerror = () => {cleanup(); reject(new Error("Could not export the PNG. Please retry."))}
        worker.onmessageerror = () => {cleanup(); reject(new Error("Could not receive the exported PNG. Please retry."))}
        try {worker.postMessage(request)} catch (error) {cleanup(); reject(error)}
    })
}
