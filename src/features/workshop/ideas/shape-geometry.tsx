import type {CanvasItem} from "../shape-clipboard"

export function ShapeGeometry({item}: { item: CanvasItem }) {
    const {kind, width: w, height: h, outlineWidth: stroke} = item
    const inset = stroke / 2
    const right = w - inset, bottom = h - inset
    const polygon = (points: number[][]) => <polygon
        points={points.map(([x, y]) => `${inset + x * (w - stroke)},${inset + y * (h - stroke)}`).join(" ")}/>
    const regular = (sides: number, star = false) => polygon(Array.from({length: star ? sides * 2 : sides}, (_, i) => {
        const angle = -Math.PI / 2 + i * Math.PI * 2 / (star ? sides * 2 : sides)
        const radius = star && i % 2 ? .22 : .5
        return [.5 + Math.cos(angle) * radius, .5 + Math.sin(angle) * radius]
    }))
    const linear = ["line", "arrow", "double-arrow", "elbow-arrow"].includes(kind)
    const tip = Math.min(14 + stroke, w / 4, h / 3)
    let geometry
    switch (kind) {
        case "ellipse":
            geometry = <ellipse cx={w / 2} cy={h / 2} rx={(w - stroke) / 2} ry={(h - stroke) / 2}/>;
            break
        case "triangle":
            geometry = polygon([[.5, 0], [1, 1], [0, 1]]);
            break
        case "diamond":
            geometry = polygon([[.5, 0], [1, .5], [.5, 1], [0, .5]]);
            break
        case "pentagon":
            geometry = regular(5);
            break
        case "hexagon":
            geometry = regular(6);
            break
        case "star":
            geometry = regular(5, true);
            break
        case "parallelogram":
            geometry = polygon([[.2, 0], [1, 0], [.8, 1], [0, 1]]);
            break
        case "database":
            geometry = <>
                <path
                    d={`M ${inset} ${h * .15} A ${(w - stroke) / 2} ${h * .14} 0 0 1 ${right} ${h * .15} V ${h * .85} A ${(w - stroke) / 2} ${h * .14} 0 0 1 ${inset} ${h * .85} Z`}/>
                <path fill="none"
                      d={`M ${inset} ${h * .15} A ${(w - stroke) / 2} ${h * .14} 0 0 0 ${right} ${h * .15}`}/>
            </>;
            break
        case "document":
            geometry = <path
                d={`M ${inset} ${inset} H ${right} V ${h * .85} C ${w * .65} ${h * .65}, ${w * .35} ${h * 1.05}, ${inset} ${h * .85} Z`}/>;
            break
        case "line":
        case "arrow":
        case "double-arrow":
            geometry = <>
                <path d={`M ${inset} ${h / 2} H ${right}`}/>
                {kind !== "line" && <path
                    d={`M ${right - tip} ${h / 2 - tip} L ${right} ${h / 2} L ${right - tip} ${h / 2 + tip}`}/>}{kind === "double-arrow" &&
                <path d={`M ${inset + tip} ${h / 2 - tip} L ${inset} ${h / 2} L ${inset + tip} ${h / 2 + tip}`}/>}</>;
            break
        case "elbow-arrow":
            geometry = <path
                d={`M ${inset} ${inset} V ${h / 2} H ${right - tip} V ${bottom} M ${right - tip * 2} ${bottom - tip} L ${right - tip} ${bottom} L ${right} ${bottom - tip}`}/>;
            break
        default:
            geometry = <rect x={inset} y={inset} width={w - stroke} height={h - stroke}
                             rx={kind === "terminator" ? Math.min(w, h) / 2 : item.cornerRadius}/>
    }
    return <svg aria-hidden="true" className="workshop-shape-geometry" viewBox={`0 0 ${w} ${h}`}
                preserveAspectRatio="none" fill={!linear && item.appearance === "fill" ? item.fillColor : "none"}
                stroke={item.outlineStyle === "none" ? "none" : item.outlineColor} strokeWidth={stroke}
                strokeLinejoin="round"
                strokeDasharray={item.outlineStyle === "dashed" ? `${stroke * 4} ${stroke * 3}` : item.outlineStyle === "dotted" ? `${stroke} ${stroke * 2}` : undefined}>{geometry}</svg>
}
