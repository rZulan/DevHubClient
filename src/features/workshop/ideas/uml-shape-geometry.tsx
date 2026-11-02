import type {CanvasItem} from "../shape-clipboard"

export function UmlShapeGeometry({item}: {item: CanvasItem}) {
    const {width: w, height: h, umlSymbol: symbol, outlineColor: color, outlineWidth: stroke} = item
    const l = stroke / 2, r = w - l, b = h - l, x = w / 2, y = h / 2, tip = Math.min(15, w / 5, h / 3)
    const rect = (radius = 0) => <rect x={l} y={l} width={w - stroke} height={h - stroke} rx={radius}/>
    const circle = (radius: number, filled = false) => <circle cx={x} cy={y} r={Math.max(2,radius)} fill={filled ? color : "none"}/>
    let geometry
    switch (symbol) {
        case "actor": geometry = <><circle cx={x} cy={h * .12} r={Math.min(w * .14,h * .1)}/><path d={`M${x} ${h * .22}V${h * .56} M${w * .2} ${h * .34}H${w * .8} M${x} ${h * .56}L${w * .22} ${h * .76} M${x} ${h * .56}L${w * .78} ${h * .76}`}/></>; break
        case "provided-interface": case "entry-point": geometry = circle(Math.min(w,h)/2-stroke); break
        case "required-interface": geometry = <path d={`M${w*.7} ${l}A${w*.45} ${h*.48} 0 0 0 ${w*.7} ${b}`}/>; break
        case "exit-point": geometry = <>{circle(Math.min(w,h)/2-stroke)}<path d={`M${w*.25} ${h*.25}L${w*.75} ${h*.75}M${w*.75} ${h*.25}L${w*.25} ${h*.75}`}/></>;break
        case "send-signal": geometry = <path d={`M${l} ${l}H${w*.75}L${r} ${y}L${w*.75} ${b}H${l}Z`}/>;break
        case "accept-event": geometry = <path d={`M${l} ${l}H${r}V${b}H${l}L${w*.25} ${y}Z`}/>;break
        case "time-event": geometry = <path d={`M${l} ${l}H${r}L${l} ${b}H${r}Z`}/>;break
        case "region": geometry = <rect x={l} y={l} width={w-stroke} height={h-stroke} strokeDasharray="8 5"/>;break
        case "artifact": geometry = <>{rect()}<path d={`M${w-30} 8H${w-17}L${w-8} 17V38H${w-30}Z M${w-17} 8V17H${w-8}`}/></>;break
        case "use-case": geometry = <ellipse cx={x} cy={y} rx={(w - stroke) / 2} ry={(h - stroke) / 2}/>; break
        case "junction": case "initial": geometry = circle(Math.min(w,h) / 2 - stroke,true); break
        case "final": geometry = <>{circle(Math.min(w,h) / 2 - stroke)}{circle(Math.min(w,h) / 2 - stroke - 7,true)}</>; break
        case "flow-final": geometry = <>{circle(Math.min(w,h) / 2 - stroke)}<path d={`M${w * .25} ${h * .25}L${w * .75} ${h * .75} M${w * .75} ${h * .25}L${w * .25} ${h * .75}`}/></>; break
        case "destruction": case "terminate": geometry = <path d={`M${w * .2} ${h * .2}L${w * .8} ${h * .8} M${w * .8} ${h * .2}L${w * .2} ${h * .8}`}/>; break
        case "history": case "deep-history": geometry = <>{circle(Math.min(w,h) / 2 - stroke)}<text x={x} y={y + 6} textAnchor="middle" fill={color} stroke="none" fontSize={18}>{symbol === "history" ? "H" : "H*"}</text></>; break
        case "decision": geometry = <path d={`M${x} ${l}L${r} ${y}L${x} ${b}L${l} ${y}Z`}/>; break
        case "fork": geometry = <rect x={l} y={h * .3} width={w - stroke} height={h * .4} fill={color}/>; break
        case "lifeline": geometry = <><rect x={l} y={l} width={w - stroke} height={Math.min(64,h * .3)}/><path d={`M${x} ${Math.min(64,h * .3)}V${b}`} strokeDasharray="7 5"/></>; break
        case "class": case "interface": case "enumeration": case "state": geometry = <>{rect(symbol === "state" ? 12 : 0)}{!item.umlDetails&&<path d={`M${l} ${Math.min(40,h * .3)}H${r}${symbol === "class" ? ` M${l} ${Math.min(84,h * .6)}H${r}` : ""}`}/>}</>; break
        case "action": geometry = rect(12); break
        case "fragment": case "boundary": geometry = <>{rect()}{!item.umlDetails&&<path d={`M${l} ${Math.min(40,h * .2)}H${r}`}/>}</>; break
        case "package": geometry = <path d={`M${l} ${h * .2}V${l}H${w * .4}V${h * .2}H${r}V${b}H${l}Z M${l} ${h * .2}H${w * .4}`}/>; break
        case "component": geometry = <>{rect()}<path d={`M${w * .8} ${h * .12}H${w * .94}V${h * .38}H${w * .8}Z M${w * .76} ${h * .17}H${w * .84}V${h * .23}H${w * .76}Z M${w * .76} ${h * .28}H${w * .84}V${h * .34}H${w * .76}Z`}/></>; break
        case "node": geometry = <path d={`M${l} ${h * .15}L${w * .15} ${l}H${r}V${h * .85}L${w * .85} ${b}H${l}Z M${l} ${h * .15}H${w * .85}V${b} M${w * .85} ${h * .15}L${r} ${l}`}/>; break
        case "note": geometry = <path d={`M${l} ${l}H${w - 20}L${r} 20V${b}H${l}Z M${w - 20} ${l}V20H${r}`}/>; break
        case "timing": geometry = <><path d={`M${w * .1} ${l}V${h * .85}H${r}`} /><path d={`M${w * .1} ${h * .7}H${w * .35}V${h * .3}H${w * .65}V${h * .55}H${r}`}/></>; break
        case "constraint": geometry = <></>; break
        case "create-message": case "destroy-message": case "note-link": case "extension": case "containment": case "association": case "directed": case "generalization": case "realization": case "dependency": case "aggregation": case "composition": case "include": case "extend": case "sync": case "async": case "reply": {
            const diamond = symbol === "aggregation" || symbol === "composition", triangle = ["generalization","realization","sync","extension"].includes(symbol), arrow = !["association","aggregation","composition","note-link","containment"].includes(symbol)
            geometry = <><path d={`M${diamond ? l + tip * 2 : l} ${y}H${triangle ? r - tip : r}`}/>{diamond && <path d={`M${l} ${y}L${l + tip} ${y - tip}L${l + tip * 2} ${y}L${l + tip} ${y + tip}Z`} fill={symbol === "composition" ? color : "none"}/>}{arrow && <path d={`M${r - tip} ${y - tip}L${r} ${y}L${r - tip} ${y + tip}${triangle ? "Z" : ""}`} fill={symbol === "sync" ? color : "none"}/>}</>; break
        }
        default: geometry = rect()
    }
    return <svg className="workshop-shape-geometry" aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" fill={item.appearance === "fill" ? item.fillColor : "none"} stroke={item.outlineStyle === "none" ? "none" : color} strokeWidth={stroke} strokeLinejoin="round" strokeDasharray={item.outlineStyle === "dashed" ? `${stroke * 4} ${stroke * 3}` : item.outlineStyle === "dotted" ? `${stroke} ${stroke * 2}` : undefined}>{geometry}</svg>
}
