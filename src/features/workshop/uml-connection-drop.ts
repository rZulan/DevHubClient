import {combinedBounds} from "./canvas-view.ts"
import {presetItems, type ShapePreset} from "./shape-catalog.ts"
import {defaultTextStyle, normalizeCanvasItem, type CanvasItem} from "./shape-clipboard.ts"
import {umlPresets} from "./uml-catalog.ts"
import {canConnectUmlShape, isUmlConnector, syncUmlConnections, translateUmlItems, umlEndpointPoint, umlLocalPoint} from "./uml-connections.ts"
import type {UmlEndpoint, UmlPoint} from "./uml-connection-types.ts"

export type UmlConnectionSuggestion = {connectionId:string; end:"start"|"end"; point:UmlPoint}

export function createUmlPresetItems(preset:ShapePreset,origin:UmlPoint,createId:()=>string):CanvasItem[] {
    const parts=presetItems(preset),groupId=parts.length>1 ? createId() : undefined
    return parts.map(part=>normalizeCanvasItem({
        ...defaultTextStyle,width:190,height:105,appearance:"outlined",fillColor:"#a78bfa",outlineColor:"#a78bfa",
        text:"",textAlign:"center",verticalAlign:"center",cornerRadius:0,outlineWidth:2,outlineStyle:"solid",
        ...part,id:createId(),groupId,x:origin.x+(part.x??0),y:origin.y+(part.y??0),
    }))
}

export function umlFacingEndpoint(item:CanvasItem,toward:UmlPoint):UmlEndpoint {
    const point=umlLocalPoint(item,toward),dx=(point.x-item.width/2)/item.width,dy=(point.y-item.height/2)/item.height
    return {shapeId:item.id,side:Math.abs(dx)>=Math.abs(dy) ? dx>=0 ? "right" : "left" : dy>=0 ? "bottom" : "top",offset:.5}
}

export function validUmlConnectionSuggestion(items:CanvasItem[],suggestion:UmlConnectionSuggestion) {
    const link=items.find(item=>item.id===suggestion.connectionId && !item.locked && !item.hidden),connection=link?.connection
    if(!connection) return false
    const end=connection[suggestion.end]
    return !("shapeId" in end) && end.x===suggestion.point.x && end.y===suggestion.point.y && [connection.start,connection.end].every(endpoint=>!("shapeId" in endpoint) || items.some(item=>item.id===endpoint.shapeId && canConnectUmlShape(item)))
}

export function addUmlSuggestedElement(items:CanvasItem[],suggestion:UmlConnectionSuggestion,presetId:string,createId:()=>string):{items:CanvasItem[];id:string}|null {
    if(!validUmlConnectionSuggestion(items,suggestion)) return null
    const preset=umlPresets.find(p=>p.id===presetId && !isUmlConnector({umlSymbol:p.changes?.umlSymbol} as CanvasItem))
    if(!preset) return null
    const shapes=createUmlPresetItems(preset,{x:0,y:0},createId),bounds=combinedBounds(shapes)
    const added=translateUmlItems(shapes,{x:suggestion.point.x-bounds.x-bounds.width/2,y:suggestion.point.y-bounds.y-bounds.height/2}),target=added.find(canConnectUmlShape)
    if(!target) return null
    const base=items.find(item=>item.id===suggestion.connectionId)!,other=suggestion.end==="start" ? "end" : "start"
    const connection={...base.connection!,[suggestion.end]:umlFacingEndpoint(target,umlEndpointPoint(items,base.connection![other]))}
    return {items:syncUmlConnections([...items.map(item=>item.id===base.id ? {...base,connection} : item),...added]),id:base.id}
}
