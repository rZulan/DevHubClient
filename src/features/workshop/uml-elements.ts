import type {CanvasItem} from "./shape-clipboard.ts"
import type {UmlDetails} from "./uml-connection-types.ts"

export function umlElementDetails(item:CanvasItem):UmlDetails {
    if(item.umlDetails)return item.umlDetails
    const lines=item.text.split("\n"),stereotype=lines[0]?.match(/^«(.*)»$/)?.[1]??""
    if(stereotype)lines.shift()
    const name=lines.shift()??"",rest=lines.filter(Boolean)
    return {name,stereotype,attributes:rest.filter(s=>!s.includes("(")&&!/^(entry|do|exit)\s*\//.test(s)).join("\n"),operations:rest.filter(s=>s.includes("(")&&!/^(entry|do|exit)\s*\//.test(s)).join("\n"),entry:rest.find(s=>/^entry\s*\//.test(s))?.replace(/^entry\s*\/\s*/,"")??"",activity:rest.find(s=>/^do\s*\//.test(s))?.replace(/^do\s*\/\s*/,"")??"",exit:rest.find(s=>/^exit\s*\//.test(s))?.replace(/^exit\s*\/\s*/,"")??"",operator:item.umlSymbol==="fragment"?name.split(" ")[0]:"",operands:""}
}
export function umlElementCompartments(item:CanvasItem):string[]{
    const d=item.umlDetails
    if(!d)return [item.text]
    const header=[d.stereotype?`«${d.stereotype}»`:"",d.name].filter(Boolean).join("\n")
    if(["class","interface","enumeration","object","stereotype"].includes(item.umlSymbol??""))return [header,d.attributes,...(item.umlSymbol!=="enumeration"?[d.operations]:[])]
    if(item.umlSymbol==="state")return [header,[d.entry?`entry / ${d.entry}`:"",d.activity?`do / ${d.activity}`:"",d.exit?`exit / ${d.exit}`:""].filter(Boolean).join("\n")]
    if(item.umlSymbol==="fragment")return [[d.operator,d.name].filter(Boolean).join(" "),...d.operands.split("\n---\n")]
    return [header,...(d.attributes?[d.attributes]:[])]
}
export function withUmlDetails(item:CanvasItem,details:UmlDetails):CanvasItem {const next={...item,umlDetails:details,textRuns:undefined};return {...next,text:umlElementCompartments(next).join("\n\n")}}
