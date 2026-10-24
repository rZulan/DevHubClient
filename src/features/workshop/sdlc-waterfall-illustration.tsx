import {waterfallDrawing} from "./sdlc-waterfall-geometry"

const dropSize = {x: 110, y: 120}

/** A shared smooth profile keeps both banks and every repeated drop consistent. */
function flow(x: number, y: number, drops: number) {
    const point = (t: number) => ({x: dropSize.x * t, y: dropSize.y * (6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3)})
    const tangent = (t: number) => ({x: dropSize.x, y: dropSize.y * 30 * t ** 2 * (1 - t) ** 2})
    const pair = (px: number, py: number) => `${px.toFixed(2)} ${py.toFixed(2)}`
    let path = `M${pair(x, y)}`
    for (let drop = 0; drop < drops; drop++) {
        for (let segment = 0; segment < 8; segment++) {
            const start = segment / 8, end = (segment + 1) / 8, handle = 1 / 24
            const a = point(start), b = point(end), da = tangent(start), db = tangent(end)
            path += `C${pair(x + a.x + da.x * handle, y + a.y + da.y * handle)} ${pair(x + b.x - db.x * handle, y + b.y - db.y * handle)} ${pair(x + b.x, y + b.y)}`
        }
        x += dropSize.x; y += dropSize.y
    }
    return path
}

/** Three matched, tangent-continuous drops preserve the flowing reference silhouette. */
export function SdlcWaterfallIllustration() {
    const {x, y, scale} = waterfallDrawing
    return <g className="sdlc-illustration-contour" transform={`translate(${x} ${y}) scale(${scale})`}>
        {/* Both banks use the same curve, translated across the width of the water. */}
        <path d={flow(190, 200, 3)}/>
        <path d={flow(430, 135, 3)}/>
        {/* A rounded headwater meets the horizontal tangents of both banks. */}
        <path d="M430 135C404 135 414 110 360 110C270 110 222 112 177 135C127 160 127 200 166 200C174 200 182 200 190 200"/>
        {/* Inner currents repeat the same profile; the gaps keep the drawing light. */}
        <g className="sdlc-illustration-detail">
            <path d={flow(350, 157, 2)}/>
            {[0, 1, 2].map(index => <path key={index} d={flow(270 + index * dropSize.x, 178 + index * dropSize.y, 1)}/>)}
        </g>
        {/* The far bank settles into a level, shallow pool on the ground plane. */}
        <path d="M760 495C790 495 777 555 801 560"/>
        <g transform="translate(657 590) scale(1 .55)">
            <path d="M-144 -54A205 75 0 1 0 144 -54"/>
            <path className="sdlc-illustration-detail" d="M-112 -33A156 49 0 1 0 112 -33"/>
        </g>
    </g>
}
