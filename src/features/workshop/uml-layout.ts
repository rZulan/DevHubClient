import type {CanvasItem} from "./shape-clipboard.ts"
import {syncUmlConnections} from "./uml-connections.ts"
export type UmlArrangement="left"|"center"|"right"|"top"|"middle"|"bottom"|"distribute-x"|"distribute-y"
export function arrangeUmlItems(items:CanvasItem[],ids:string[],mode:UmlArrangement):CanvasItem[]{
    const nodes=items.filter(n=>ids.includes(n.id)&&!n.connection&&!n.locked&&!n.hidden)
    if(nodes.length<2)return items
    const x=Math.min(...nodes.map(n=>n.x)),y=Math.min(...nodes.map(n=>n.y)),r=Math.max(...nodes.map(n=>n.x+n.width)),b=Math.max(...nodes.map(n=>n.y+n.height)),positions=new Map<string,{x:number;y:number}>()
    if(mode.startsWith("distribute")){
        if(nodes.length<3)return items
        const horizontal=mode==="distribute-x",sorted=[...nodes].sort((a,b)=>horizontal?a.x-b.x:a.y-b.y),size=sorted.reduce((s,n)=>s+(horizontal?n.width:n.height),0),gap=((horizontal?r-x:b-y)-size)/(sorted.length-1)
        let cursor=horizontal?x:y
        for(const node of sorted){positions.set(node.id,{x:horizontal?cursor:node.x,y:horizontal?node.y:cursor});cursor+=(horizontal?node.width:node.height)+gap}
    }else for(const n of nodes)positions.set(n.id,{x:mode==="left"?x:mode==="center"?(x+r-n.width)/2:mode==="right"?r-n.width:n.x,y:mode==="top"?y:mode==="middle"?(y+b-n.height)/2:mode==="bottom"?b-n.height:n.y})
    return syncUmlConnections(items.map(n=>positions.has(n.id)?{...n,...positions.get(n.id)}:n))
}
export function autoLayoutUml(items:CanvasItem[],sequence=false):CanvasItem[]{
    const nodes=items.filter(n=>!n.connection&&!n.locked&&!n.hidden&&!['boundary','fragment','package','activation','port','note','constraint'].includes(n.umlSymbol??"")),ids=new Set(nodes.map(n=>n.id)),incoming=new Map(nodes.map(n=>[n.id,0])),outgoing=new Map(nodes.map(n=>[n.id,[] as string[]]))
    for(const n of items){const c=n.connection;if(c&&"shapeId"in c.start&&"shapeId"in c.end&&c.start.shapeId!==c.end.shapeId&&ids.has(c.start.shapeId)&&ids.has(c.end.shapeId)){outgoing.get(c.start.shapeId)!.push(c.end.shapeId);incoming.set(c.end.shapeId,incoming.get(c.end.shapeId)!+1)}}
    const levels=new Map<string,number>(),queue=nodes.filter(n=>incoming.get(n.id)===0).map(n=>n.id)
    for(const id of queue)levels.set(id,0)
    for(let i=0;i<queue.length;i++){const id=queue[i];for(const next of outgoing.get(id)??[]){levels.set(next,Math.max(levels.get(next)??0,levels.get(id)!+1));incoming.set(next,incoming.get(next)!-1);if(incoming.get(next)===0)queue.push(next)}}
    for(const n of nodes)if(!levels.has(n.id))levels.set(n.id,0)
    const rowCount=new Map<number,number>(),heights=new Map<number,number>()
    for(const n of nodes)heights.set(levels.get(n.id)!,Math.max(heights.get(levels.get(n.id)!)??0,n.height))
    const rowY=new Map<number,number>();let y=80;for(const level of [...heights.keys()].sort((a,b)=>a-b)){rowY.set(level,y);y+=heights.get(level)!+110}
    let cursor=80
    return syncUmlConnections(items.map(n=>{if(!ids.has(n.id))return n;const level=levels.get(n.id)!,column=rowCount.get(level)??0;rowCount.set(level,column+1);const next={...n,x:sequence?cursor:80+column*320,y:sequence?80:rowY.get(level)!};cursor+=n.width+100;return next}))
}
