import {downloadUmlFile} from "./uml-download"
import {visibleUmlItems} from "../uml-connections"
import {renderToStaticMarkup} from "react-dom/server"
import {combinedBounds} from "../canvas-view"
import type {UmlDiagram} from "../uml-library"
import {umlElementCompartments} from "../uml-elements"
import {UmlShapeGeometry} from "./uml-shape-geometry"
import {UmlConnectionsLayer} from "./uml-connections-layer"

export function umlSvg(diagram:UmlDiagram){
    const items=visibleUmlItems(diagram.items),bounds=items.length?combinedBounds(items):{x:0,y:0,width:640,height:400},padding=50,w=bounds.width+padding*2,h=bounds.height+padding*2
    const markup=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={Math.ceil(w)} height={Math.ceil(h)} viewBox={`${bounds.x-padding} ${bounds.y-padding} ${w} ${h}`}><title>{diagram.name}</title><style>{`.workshop-shape-geometry{overflow:visible}.uml-live-connections{overflow:visible}.uml-connection-hit,.uml-reconnect-handle,.uml-bend-handle{display:none}.uml-connection-line{fill:none}.uml-live-connection text{paint-order:stroke;stroke:#151212;stroke-width:4px;fill:#f5f5f5}.uml-end-label{font-size:12px}`}</style><rect x={bounds.x-padding} y={bounds.y-padding} width={w} height={h} fill="#151212"/>{items.filter(n=>!n.connection).map(item=>{
        const lines=item.umlDetails?umlElementCompartments(item):[item.text],lineHeight=item.fontSize*item.lineHeight
        let top=10
        return <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rotation} ${item.width/2} ${item.height/2}) translate(${item.flipHorizontal?item.width:0} ${item.flipVertical?item.height:0}) scale(${item.flipHorizontal?-1:1} ${item.flipVertical?-1:1})`}><UmlShapeGeometry item={item}/>{lines.map((section,i)=>{const rows=section.split("\n"),sectionY=item.umlDetails?top:item.verticalAlign==="bottom"?item.height-rows.length*lineHeight-8:item.verticalAlign==="center"?(item.height-rows.length*lineHeight)/2:top;top+=item.umlDetails&&i>0?Math.max(28,(item.height-(lines[0].split("\n").length*lineHeight+16))/(lines.length-1)):Math.max(28,rows.length*lineHeight+16);return <g key={i}>{i>0&&<line x1={0} x2={item.width} y1={sectionY-8} y2={sectionY-8} stroke={item.outlineColor} strokeWidth={item.outlineWidth}/>}<text x={item.umlDetails&&i>0||item.textAlign==="left"?10:item.textAlign==="right"?item.width-10:item.width/2} y={sectionY+item.fontSize} textAnchor={item.umlDetails&&i>0||item.textAlign==="left"?"start":item.textAlign==="right"?"end":"middle"} fill={item.textColor==="auto"?"#f5f5f5":item.textColor} fontSize={item.fontSize} fontFamily={item.fontFamily} fontWeight={item.bold||item.umlDetails&&i===0?700:400} fontStyle={item.italic?"italic":undefined} textDecoration={item.underline?"underline":undefined}>{rows.map((line,j)=><tspan key={j} x={item.umlDetails&&i>0||item.textAlign==="left"?10:item.textAlign==="right"?item.width-10:item.width/2} dy={j?lineHeight:0}>{line}</tspan>)}</text></g>})}</g>
    })}<UmlConnectionsLayer items={items} selectedIds={[]} canEdit={false} zoom={1} onSelect={()=>{}} onEditLabel={()=>{}} onEndpoint={()=>{}} onBend={()=>{}}/></svg>)
    return markup.replaceAll("var(--background)","#151212").replaceAll("var(--foreground)","#f5f5f5")
}

export async function exportUmlPng(svg:string,name:string){
    const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml;charset=utf-8"}))
    try{const img=new Image();await new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error("Could not render diagram image"));img.src=url});const scale=Math.min(2,8192/img.width,8192/img.height,Math.sqrt(16_000_000/(img.width*img.height))),canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image export unavailable");ctx.drawImage(img,0,0,canvas.width,canvas.height);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("Image export failed")),"image/png"));downloadUmlFile(name,blob)}finally{URL.revokeObjectURL(url)}
}
