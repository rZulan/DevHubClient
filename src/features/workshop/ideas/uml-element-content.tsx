import {shapeTextColor} from "./shape-presentation"
import {shapeFontStack} from "../shape-fonts"
import type {CanvasItem} from "../shape-clipboard"
import {umlElementCompartments} from "../uml-elements"
export function UmlElementContent({item}:{item:CanvasItem}){return <div className={`uml-element-content uml-element-${item.umlSymbol}`} style={{fontSize:item.fontSize,fontFamily:shapeFontStack(item.fontFamily),lineHeight:item.lineHeight,color:item.textColor==="auto"?item.appearance==="fill"?shapeTextColor(item.fillColor):"var(--foreground)":item.textColor,"--uml-border":item.outlineColor,"--uml-stroke":`${item.outlineWidth}px`} as React.CSSProperties}>{umlElementCompartments(item).map((text,i)=><div key={i} className={i?"uml-compartment":"uml-element-name"}>{text}</div>)}</div>}
