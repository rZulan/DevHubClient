// PNG uses one zlib stream across all IDAT chunks, with a filter byte per row.
// https://www.w3.org/TR/png-3/#10Compression
const crcTable = Uint32Array.from({length: 256}, (_, index) => {
    let crc = index
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1
    return crc >>> 0
})

function chunk(type: string, data = new Uint8Array()) {
    const bytes = new Uint8Array(data.length + 12), view = new DataView(bytes.buffer)
    view.setUint32(0, data.length)
    for (let i = 0; i < 4; i++) bytes[i + 4] = type.charCodeAt(i)
    bytes.set(data, 8)
    let crc = 0xffffffff
    for (let i = 4; i < bytes.length - 4; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ crc >>> 8
    view.setUint32(bytes.length - 4, (crc ^ 0xffffffff) >>> 0)
    return bytes
}

export async function encodePng(width: number, height: number, readRows: (y: number, rows: number) => Promise<Uint8Array>, bandRows = 256) {
    if (![width, height, bandRows].every(value => Number.isInteger(value) && value > 0) || width > 0x7fffffff || height > 0x7fffffff) throw new Error("Invalid PNG dimensions.")
    const header = new Uint8Array(13), view = new DataView(header.buffer)
    view.setUint32(0, width); view.setUint32(4, height)
    header[8] = 8; header[9] = 6 // 8-bit RGBA, no interlacing.
    const parts: BlobPart[] = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header)]
    let y = 0
    const stride = width * 4
    const pixels = new ReadableStream<BufferSource>({
        async pull(controller) {
            if (y === height) {controller.close(); return}
            const rows = Math.min(bandRows, height - y), rgba = await readRows(y, rows)
            if (rgba.length !== stride * rows) throw new Error("Incomplete PNG image section.")
            const filtered = new Uint8Array((stride + 1) * rows)
            for (let row = 0; row < rows; row++) {
                const source = row * stride, target = row * (stride + 1)
                filtered[target] = 1 // Sub filter: lossless, with good compression for diagrams.
                for (let x = 0; x < stride; x++) filtered[target + 1 + x] = rgba[source + x] - (x < 4 ? 0 : rgba[source + x - 4])
            }
            y += rows
            controller.enqueue(filtered)
        },
    }, {highWaterMark: 0})
    const reader = pixels.pipeThrough(new CompressionStream("deflate")).getReader()
    try {
        while (true) {
            const {done, value} = await reader.read()
            if (done) break
            parts.push(chunk("IDAT", new Uint8Array(value)))
        }
    } finally {reader.releaseLock()}
    parts.push(chunk("IEND"))
    return new Blob(parts, {type: "image/png"})
}
