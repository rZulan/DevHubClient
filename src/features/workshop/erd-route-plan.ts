import {createErdRouteCache, routeErdPorts, type ErdPort} from "./erd-connection.ts"
import {avoidErdObstacles, routePoints, erdPortLead, erdRouteClearance, type Rectangle, type RouteSegment, type Route} from "./erd-obstacle-route.ts"
import {tableHeight, type ErdDocument, type ErdEdge, type ErdTable} from "./tool-documents.ts"

export const erdMarkerSpacing = 28
export function erdMarkerArea(port: ErdPort, extent = 36): Rectangle {
    const {x,y,edge} = port
    return {id:"", left:x-(edge === "left" ? extent : edge === "right" ? 0 : 12), right:x+(edge === "right" ? extent : edge === "left" ? 0 : 12),
        top:y-(edge === "top" ? extent : edge === "bottom" ? 0 : 12), bottom:y+(edge === "bottom" ? extent : edge === "top" ? 0 : 12)}
}
const overlaps = (a: Rectangle,b: Rectangle) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const samePort = (a: ErdPort,b: ErdPort) => a.x === b.x && a.y === b.y && a.edge === b.edge

/** A small spatial index keeps joint routing local on large diagrams. */
function spatialIndex<T extends Rectangle>() {
    const cells = new Map<string,Set<T>>(), size = 512
    function keys(rect: Rectangle) {
        const result: string[] = []
        for(let x=Math.floor(rect.left/size);x<=Math.floor(rect.right/size);x++) for(let y=Math.floor(rect.top/size);y<=Math.floor(rect.bottom/size);y++) result.push(`${x}:${y}`)
        return result
    }
    return {add(item:T) {for(const key of keys(item)) {let cell=cells.get(key); if(!cell) {cell=new Set();cells.set(key,cell)} cell.add(item)}},
        query(rect:Rectangle) {const result=new Set<T>();for(const key of keys(rect)) for(const item of cells.get(key)??[]) if(overlaps(rect,item)) result.add(item);return [...result]}}
}

/** Allocate visible ports without changing the saved column mapping or manual pins. */
function allocatePort(table: ErdTable, preferred: ErdPort, occupied: (area:Rectangle)=>Rectangle[], cards: (area:Rectangle)=>Rectangle[]): ErdPort {
    const score=(port:ErdPort) => {
        const area=erdMarkerArea(port,erdPortLead)
        const corridor={...area,left:area.left-erdRouteClearance,right:area.right+erdRouteClearance,top:area.top-erdRouteClearance,bottom:area.bottom+erdRouteClearance}
        return occupied(area).length*1e8 + cards(corridor).filter(rect=>rect.id!==table.id).length*1e9
            + Math.abs(port.x-preferred.x)+Math.abs(port.y-preferred.y)+(port.edge===preferred.edge?0:120)
    }
    if(score(preferred)===0) return preferred
    const candidates: ErdPort[] = [preferred], height=tableHeight(table)
    for(const edge of [preferred.edge,...(["left","right","top","bottom"] as ErdEdge[]).filter(edge=>edge!==preferred.edge)]) {
        const vertical=edge==="left"||edge==="right", length=vertical?height:300
        const ideal=vertical?preferred.y-table.y:preferred.x-table.x
        const coordinates=[Math.max(14,Math.min(length-14,ideal)),...Array.from({length:Math.floor((length-28)/erdMarkerSpacing)+1},(_,i)=>14+i*erdMarkerSpacing)]
        for(const offset of coordinates) candidates.push({edge,x:table.x+(vertical?(edge==="left"?0:300):offset),y:table.y+(vertical?offset:edge==="top"?0:height)})
    }
    const selected=candidates.reduce((best,port)=>score(port)<score(best)?port:best)
    return selected
}

const plans = new WeakMap<ErdDocument, ReturnType<typeof computeErdRoutes>>()
type SharedRoute = {input:string;signature:string;route:Route}
const sharedCaches = new WeakMap<ReturnType<typeof createErdRouteCache>,Map<string,SharedRoute>>()
export function planErdRoutes(document: ErdDocument, cache = createErdRouteCache()) {
    const saved=plans.get(document)
    if(saved) return saved
    const plan=computeErdRoutes(document,cache);plans.set(document,plan);return plan
}
function computeErdRoutes(document: ErdDocument, cache: ReturnType<typeof createErdRouteCache>) {
    let shared=sharedCaches.get(cache)
    if(!shared) {shared=new Map();sharedCaches.set(cache,shared)}
    const tables=new Map(document.tables.map(table=>[table.id,table])), pairCounts=new Map<string,number>()
    const ordered=[...document.relationships].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)
    const entries=ordered.flatMap(relation=>{
        const from=tables.get(relation.fromTable),to=tables.get(relation.toTable)
        if(!from||!to) return []
        const pair=[from.id,to.id].sort().join("\0"), rank=pairCounts.get(pair)??0
        pairCounts.set(pair,rank+1)
        const laneOffset=Math.min(rank*16,256)
        return [{relation,from,to,laneOffset,route:cache(from,to,relation,laneOffset,document.tables)}]
    })
    const markers=spatialIndex<Rectangle & {owner:string}>(), cards=spatialIndex<Rectangle>()
    for(const table of document.tables) cards.add({id:table.id,left:table.x,right:table.x+300,top:table.y,bottom:table.y+tableHeight(table)})
    // Explicit pins get first choice; ties use relationship identity, never array order.
    const endpoints=entries.flatMap(entry=>(["source","target"] as const).map(end=>({entry,end,table:end==="source"?entry.from:entry.to,
        pinned:!!entry.relation[end==="source"?"fromAnchor":"toAnchor"]}))).sort((a,b)=>Number(b.pinned)-Number(a.pinned)|| (a.entry.relation.id<b.entry.relation.id?-1:a.entry.relation.id>b.entry.relation.id?1:0)||a.end.localeCompare(b.end))
    const ports=new Map<string,{source:ErdPort;target:ErdPort}>()
    for(const entry of entries) ports.set(entry.relation.id,{source:entry.route.source,target:entry.route.target})
    for(const {entry,end,table} of endpoints) {
        const port=allocatePort(table,entry.route[end],markers.query,cards.query)
        ports.get(entry.relation.id)![end]=port
        markers.add({...erdMarkerArea(port,erdPortLead),id:`marker:${entry.relation.id}:${end}`,owner:entry.relation.id})
    }
    const lines=spatialIndex<Rectangle & RouteSegment>()
    for(const entry of entries) {
        const port=ports.get(entry.relation.id)!
        const input=JSON.stringify([entry.route.path,entry.laneOffset,port.source,port.target])
        const previous=shared.get(entry.relation.id)
        const regionOf=(route:Route) => {const {x,y,width,height}=route.bounds;return {id:"",left:x-96,right:x+width+96,top:y-96,bottom:y+height+96}}
        const signatureOf=(route:Route) => {
            const region=regionOf(route)
            return JSON.stringify([markers.query(region).filter(marker=>marker.owner!==entry.relation.id),lines.query(region),cards.query(region)])
        }
        if(previous?.input===input && previous.signature===signatureOf(previous.route)) entry.route=previous.route
        else {
          if(!samePort(port.source,entry.route.source)||!samePort(port.target,entry.route.target)) entry.route=routeErdPorts(port.source,port.target,entry.from,entry.to,entry.laneOffset,document.tables)
          for(let pass=0;pass<2;pass++) {
            const {x,y,width,height}=entry.route.bounds, region={id:"",left:x-96,right:x+width+96,top:y-96,bottom:y+height+96}
            const next=avoidErdObstacles(entry.route,entry.from,entry.to,document.tables,entry.laneOffset,
                {areas:markers.query(region).filter(marker=>marker.owner!==entry.relation.id),segments:lines.query(region),
                    querySegments:(a,b)=>lines.query({id:"",left:Math.min(a.x,b.x)-1,right:Math.max(a.x,b.x)+1,top:Math.min(a.y,b.y)-1,bottom:Math.max(a.y,b.y)+1})})
            if(next===entry.route) break
            entry.route=next
          }
          shared.set(entry.relation.id,{input,signature:signatureOf(entry.route),route:entry.route})
        }
        const points=routePoints(entry.route.path)
        for(let i=1;i<points.length;i++) {const a=points[i-1],b=points[i];lines.add({id:entry.relation.id,a,b,left:Math.min(a.x,b.x)-1,right:Math.max(a.x,b.x)+1,top:Math.min(a.y,b.y)-1,bottom:Math.max(a.y,b.y)+1})}
    }
    for(const id of shared.keys()) if(!ports.has(id)) shared.delete(id)
    const byId=new Map(entries.map(entry=>[entry.relation.id,entry]))
    return document.relationships.flatMap(relation=>{const entry=byId.get(relation.id);return entry?[entry]:[]})
}

/** Every crossing has a small gap beneath the overpassing line, selected or not. */
export function erdCrossingGaps(routes: ReturnType<typeof planErdRoutes>) {
    const gaps=new Map<string, {x:number;y:number}[]>(), segments=spatialIndex<Rectangle & RouteSegment & {owner:string}>()
    // Paint order and gap ownership are stable when relationships are reordered.
    for(const entry of [...routes].sort((a,b)=>a.relation.id<b.relation.id?-1:1)) {
        const points=routePoints(entry.route.path)
        for(let i=1;i<points.length;i++) {
            const a=points[i-1],b=points[i], rect={id:"",left:Math.min(a.x,b.x)-1,right:Math.max(a.x,b.x)+1,top:Math.min(a.y,b.y)-1,bottom:Math.max(a.y,b.y)+1}
            for(const other of segments.query(rect)) {
                if(other.owner===entry.relation.id || (a.x===b.x)===(other.a.x===other.b.x)) continue
                const v=a.x===b.x?{a,b}:other,h=a.x===b.x?other:{a,b},x=v.a.x,y=h.a.y
                if(x<Math.min(h.a.x,h.b.x)||x>Math.max(h.a.x,h.b.x)||y<Math.min(v.a.y,v.b.y)||y>Math.max(v.a.y,v.b.y)) continue
                const list=gaps.get(other.owner)??[]
                if(!list.some(point=>point.x===x&&point.y===y)) list.push({x,y})
                gaps.set(other.owner,list)
            }
            segments.add({...rect,a,b,owner:entry.relation.id})
        }
    }
    return gaps
}
