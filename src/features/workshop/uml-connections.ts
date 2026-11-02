import {normalizeCanvasItem, type CanvasItem} from "./shape-clipboard.ts"
import {createClientId} from "../../lib/create-client-id.ts"
import {umlConnectorSymbols, umlSides, type UmlConnection, type UmlConnectorSymbol, type UmlEndpoint, type UmlPoint, type UmlSide} from "./uml-connection-types.ts"

export const isUmlConnector = (item: CanvasItem) => !!item.umlSymbol && (umlConnectorSymbols as readonly string[]).includes(item.umlSymbol)
export const canConnectUmlShape = (item: CanvasItem) => !item.connection && !isUmlConnector(item) && !item.hidden
export function visibleUmlItems(items:CanvasItem[]){const visible=new Set(items.filter(n=>!n.hidden).map(n=>n.id));return items.filter(n=>!n.hidden&&(!n.connection||[n.connection.start,n.connection.end].every(e=>!("shapeId"in e)||visible.has(e.shapeId))))}
function rotate(point: UmlPoint, center: UmlPoint, angle: number): UmlPoint {const r = angle * Math.PI / 180, dx = point.x - center.x, dy = point.y - center.y; return {x: center.x + dx * Math.cos(r) - dy * Math.sin(r), y: center.y + dx * Math.sin(r) + dy * Math.cos(r)}}
export function umlLocalPoint(item: CanvasItem, world: UmlPoint) {const p = rotate(world, {x:item.x+item.width/2,y:item.y+item.height/2}, -item.rotation); return {x: item.flipHorizontal ? item.x+item.width-p.x : p.x-item.x, y: item.flipVertical ? item.y+item.height-p.y : p.y-item.y}}
export function umlAnchorPoint(item: CanvasItem, side: UmlSide, offset = .5): UmlPoint {
    let x = side === "left" ? 0 : side === "right" ? item.width : item.width * offset, y = side === "top" ? 0 : side === "bottom" ? item.height : item.height * offset
    if (["use-case","initial","final","flow-final","history","deep-history","provided-interface","entry-point","exit-point","junction"].includes(item.umlSymbol ?? "")) {const nx = (x-item.width/2)/(item.width/2), ny = (y-item.height/2)/(item.height/2), length = Math.max(1,Math.hypot(nx,ny)); x=item.width/2+nx/length*item.width/2; y=item.height/2+ny/length*item.height/2}
    if (item.umlSymbol === "decision") {const nx = (x-item.width/2)/(item.width/2), ny = (y-item.height/2)/(item.height/2), length = Math.max(1,Math.abs(nx)+Math.abs(ny)); x=item.width/2+nx/length*item.width/2; y=item.height/2+ny/length*item.height/2}
    if (item.umlSymbol === "lifeline") {x = item.width/2; y = side === "top" ? 0 : side === "bottom" ? item.height : Math.max(64,item.height*offset)}
    if (item.flipHorizontal) x=item.width-x; if (item.flipVertical) y=item.height-y
    return rotate({x:item.x+x,y:item.y+y},{x:item.x+item.width/2,y:item.y+item.height/2},item.rotation)
}
export function umlEndpointPoint(items: CanvasItem[], endpoint: UmlEndpoint): UmlPoint {if (!("shapeId" in endpoint)) return endpoint; const item=items.find(n=>n.id===endpoint.shapeId); return item ? umlAnchorPoint(item,endpoint.side,endpoint.offset) : {x:0,y:0}}
export function umlEndpointAt(items: CanvasItem[], point: UmlPoint, tolerance = 12, preferredId?: string): UmlEndpoint | null {
    const hits = items.filter(canConnectUmlShape).map((item,index) => {const p=umlLocalPoint(item,point); const inside=p.x>=-tolerance&&p.x<=item.width+tolerance&&p.y>=-tolerance&&p.y<=item.height+tolerance
        if (!inside) return null
        const side = [...umlSides].sort((a,b)=>{const distance=(s:UmlSide)=>s==="left"?Math.abs(p.x):s==="right"?Math.abs(item.width-p.x):s==="top"?Math.abs(p.y):Math.abs(item.height-p.y);return distance(a)-distance(b)})[0]
        return {item,index,side,offset:Math.max(0,Math.min(1,side==="left"||side==="right"?p.y/item.height:p.x/item.width))}}
    ).filter((h):h is NonNullable<typeof h>=>!!h)
    // Prefer a small shape over its enclosing frame, then use paint order.
    const hit=hits.sort((a,b)=>Number(b.item.id===preferredId)-Number(a.item.id===preferredId)||a.item.width*a.item.height-b.item.width*b.item.height||b.index-a.index)[0]
    return hit ? {shapeId:hit.item.id,side:hit.side,offset:hit.offset} : null
}
export function newUmlConnection(items: CanvasItem[], start: UmlEndpoint, end: UmlEndpoint, symbol: UmlConnectorSymbol = "directed", routing: UmlConnection["routing"] = "orthogonal") {
    const item=normalizeCanvasItem({id:createClientId(),kind:"arrow",umlSymbol:symbol,x:0,y:0,width:24,height:24,appearance:"outlined",fillColor:"#a78bfa",outlineColor:"#a78bfa",outlineWidth:2,outlineStyle:["realization","dependency","include","extend","reply","create-message","note-link"].includes(symbol)?"dashed":"solid",cornerRadius:0,text:symbol==="include"?"«include»":symbol==="extend"?"«extend»":"",fontSize:12,
        connection:{start,end,routing,bends:[],sourceMultiplicity:"",targetMultiplicity:"",sourceRole:"",targetRole:"",guard:"",effect:"",number:null}})
    return syncUmlConnections([...items,item]).find(n=>n.id===item.id)!
}
/** Older canvases stored connector glyphs as shapes. Keep their IDs and appearance while giving them editable endpoints. */
export function upgradeUmlConnections(items:CanvasItem[]):CanvasItem[]{
    if(!items.some(item=>isUmlConnector(item)&&!item.connection))return items
    return syncUmlConnections(items.map(item=>{
        if(!isUmlConnector(item)||item.connection)return item
        const start=umlAnchorPoint(item,"left"),end=umlAnchorPoint(item,"right")
        return {...item,connection:{start:umlEndpointAt(items,start)??start,end:umlEndpointAt(items,end)??end,routing:"straight",bends:[],sourceMultiplicity:"",targetMultiplicity:"",sourceRole:"",targetRole:"",guard:"",effect:"",number:null} as UmlConnection}
    }))
}
export function umlConnectionRoute(items: CanvasItem[], item: CanvasItem) {
    const c=item.connection!, start=umlEndpointPoint(items,c.start), end=umlEndpointPoint(items,c.end), sourceId="shapeId" in c.start?c.start.shapeId:null, source=items.find(n=>n.id===sourceId)
    const sideVector=(e:UmlEndpoint,from:UmlPoint,to:UmlPoint):UmlPoint=>{
        if("shapeId"in e){const shape=items.find(n=>n.id===e.shapeId)!;let x=e.side==="left"?-1:e.side==="right"?1:0,y=e.side==="top"?-1:e.side==="bottom"?1:0;if(shape.flipHorizontal)x=-x;if(shape.flipVertical)y=-y;return rotate({x,y},{x:0,y:0},shape.rotation)}
        const dx=to.x-from.x,dy=to.y-from.y;return Math.abs(dx)>=Math.abs(dy)?{x:dx>=0?1:-1,y:0}:{x:0,y:dy>=0?1:-1}
    }
    const a=sideVector(c.start,start,end), b=sideVector(c.end,end,start), stub=30, first={x:start.x+a.x*stub,y:start.y+a.y*stub},last={x:end.x+b.x*stub,y:end.y+b.y*stub}
    let points:UmlPoint[],path:string
    if(c.bends.length) points=[start,...c.bends,end]
    else if(source&&"shapeId"in c.end&&c.end.shapeId===source.id){const right=source.x+source.width+60,top=source.y-50;points=[start,first,{x:right,y:first.y},{x:right,y:top},{x:last.x,y:top},last,end]}
    else if(c.routing==="straight")points=[start,end]
    else if(Math.abs(a.x)>.7&&Math.abs(b.x)>.7){const mid=(first.x+last.x)/2;points=[start,first,{x:mid,y:first.y},{x:mid,y:last.y},last,end]}
    else if(Math.abs(a.y)>.7&&Math.abs(b.y)>.7){const mid=(first.y+last.y)/2;points=[start,first,{x:first.x,y:mid},{x:last.x,y:mid},last,end]}
    else points=[start,first,{x:Math.abs(a.x)>.7?last.x:first.x,y:Math.abs(a.x)>.7?first.y:last.y},last,end]
    points=points.filter((p,i)=>!i||Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y)>.01)
    if(c.routing==="curve"&&!c.bends.length&&!(source&&"shapeId"in c.end&&c.end.shapeId===source.id)){const length=Math.max(60,Math.hypot(end.x-start.x,end.y-start.y)/2),p={x:start.x+a.x*length,y:start.y+a.y*length},q={x:end.x+b.x*length,y:end.y+b.y*length};path=`M${start.x} ${start.y}C${p.x} ${p.y} ${q.x} ${q.y} ${end.x} ${end.y}`;points=[start,p,q,end]}
    else path=points.map((p,i)=>`${i?"L":"M"}${p.x} ${p.y}`).join(" ")
    const left=Math.min(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),right=Math.max(...points.map(p=>p.x)),bottom=Math.max(...points.map(p=>p.y))
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p.x-points[i].x,p.y-points[i].y)),length=lengths.reduce((a,b)=>a+b,0)
    function pointAt(fraction:number):UmlPoint {
        if(path.includes("C")) {const t=fraction,u=1-t;return {x:u**3*start.x+3*u*u*t*points[1].x+3*u*t*t*points[2].x+t**3*end.x,y:u**3*start.y+3*u*u*t*points[1].y+3*u*t*t*points[2].y+t**3*end.y}}
        const distance=length*fraction
        let traveled=0
        for(let i=0;i<lengths.length;i++){if(traveled+lengths[i]>=distance){const t=(distance-traveled)/Math.max(.001,lengths[i]);return {x:points[i].x+(points[i+1].x-points[i].x)*t,y:points[i].y+(points[i+1].y-points[i].y)*t}}traveled+=lengths[i]}
        return start
    }
    return{path,points,start,end,label:pointAt(.5),waypoint:pointAt(.25),bounds:{x:left-16,y:top-24,width:Math.max(24,right-left+32),height:Math.max(24,bottom-top+48)}}
}
export function validUmlConnections(items: CanvasItem[]) {
    const index=new Map(items.map(n=>[n.id,n]));return items.every(item=>!item.connection||isUmlConnector(item)&&[item.connection.start,item.connection.end].every(e=>!("shapeId"in e)||!!index.get(e.shapeId)&&e.shapeId!==item.id&&canConnectUmlShape({...index.get(e.shapeId)!,hidden:false})))
}
export function syncUmlConnections(items: CanvasItem[]):CanvasItem[]{const index=new Map(items.map(n=>[n.id,n]));return items.filter(item=>!item.connection||[item.connection.start,item.connection.end].every(e=>!("shapeId"in e)||index.has(e.shapeId)&&e.shapeId!==item.id&&!index.get(e.shapeId)?.connection)).map(item=>{if(!item.connection)return item;const r=umlConnectionRoute(items,item),b=r.bounds;return item.x===b.x&&item.y===b.y&&item.width===b.width&&item.height===b.height&&item.rotation===0?item:{...item,...b,rotation:0,flipHorizontal:false,flipVertical:false}})}
export function umlSelectionWithConnections(items:CanvasItem[],ids:string[]){const selected=new Set(ids);return items.filter(item=>selected.has(item.id)||!!item.connection&&[item.connection.start,item.connection.end].every(e=>"shapeId"in e&&selected.has(e.shapeId))).map(item=>!item.connection?item:{...item,connection:{...item.connection,start:"shapeId"in item.connection.start&&!selected.has(item.connection.start.shapeId)?umlEndpointPoint(items,item.connection.start):item.connection.start,end:"shapeId"in item.connection.end&&!selected.has(item.connection.end.shapeId)?umlEndpointPoint(items,item.connection.end):item.connection.end}})}
export function translateUmlItems(items:CanvasItem[],offset:UmlPoint):CanvasItem[]{const point=(p:UmlPoint)=>({x:p.x+offset.x,y:p.y+offset.y});const endpoint=(e:UmlEndpoint)=>"shapeId"in e?e:point(e);return items.map(item=>({...item,x:item.x+offset.x,y:item.y+offset.y,...(item.connection?{connection:{...item.connection,start:endpoint(item.connection.start),end:endpoint(item.connection.end),bends:item.connection.bends.map(point)}}:{})}))}

export function umlConnectionLabel(item:CanvasItem){const c=item.connection!,prefix=item.umlSymbol==="include"?"«include» ":item.umlSymbol==="extend"?"«extend» ":"";return `${c.number===null?"":`${c.number}: `}${prefix}${item.text.replace(/^«(?:include|extend)»\s*/,"")}${c.guard?` [${c.guard}]`:""}${c.effect?` / ${c.effect}`:""}`.trim()}
