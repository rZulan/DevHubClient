// Disposable anonymous benchmark and independent SVG/canvas comparison.
import {useEffect, useRef, useState} from "react"
import {createRoot} from "react-dom/client"
import {runErdPngWorker} from "@/features/workshop/erd-png-worker-client"
import {defaultPalette, erdDiagramImage} from "@/features/workshop/erd-image-scene"
import {arrangeErd} from "@/features/workshop/erd-layout"
import {newField, type ErdDocument} from "@/features/workshop/tool-documents"
import geometry from "./erd-dense-routing.json"
import "@/index.css"

const dense:ErdDocument=arrangeErd({tables:geometry.tables.map(table=>({...table,name:table.id,fields:Array.from({length:table.columns},(_,i)=>({...newField(),id:`field-${i}`,name:i?`column_${i}`:"id",primary:i===0}))})),relationships:geometry.relationships as ErdDocument["relationships"]})
const small:ErdDocument={tables:[{id:"a",name:'accounts < & "',x:-100,y:0,fields:[{...newField(),id:"a-id",name:"id",primary:true},{...newField(),id:"a-name",name:"a very long field name to clip",nullable:true}]},{id:"b",name:"orders",x:700,y:180,fields:[{...newField(),id:"b-id",name:"account_id"}]}],relationships:[{id:"r",fromTable:"a",fromField:"a-id",toTable:"b",toField:"b-id",cardinality:"1:N",leftEnd:"one",rightEnd:"zero-many",onDelete:"RESTRICT"}]}
async function pixels(blob:Blob,width:number,height:number) {
    const image=new Image(),url=URL.createObjectURL(blob)
    try {image.src=url;await image.decode();const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const context=canvas.getContext("2d")!;context.drawImage(image,0,0);return context.getImageData(0,0,width,height).data}
    finally {URL.revokeObjectURL(url)}
}
function Preview() {
    const [ticks,setTicks]=useState(0),[clicks,setClicks]=useState(0),[status,setStatus]=useState("Ready"),[busy,setBusy]=useState(false),[preview,setPreview]=useState("")
    const controller=useRef<AbortController|null>(null),maxGap=useRef(0)
    useEffect(()=>{let last=performance.now();const interval=setInterval(()=>{const now=performance.now();maxGap.current=Math.max(maxGap.current,now-last);last=now;setTicks(value=>value+1)},100);return()=>{clearInterval(interval);controller.current?.abort()}},[])
    async function run(kind:"dense"|"wide") {
        const abort=new AbortController();controller.current=abort;setBusy(true);maxGap.current=0
        const start=performance.now(),document=kind==="dense"?dense:{...small,tables:small.tables.map(table=>table.id==="b"?{...table,x:9000}:table)}
        try {
            const result=await runErdPngWorker({document,palette:defaultPalette,options:{}},{signal:abort.signal,onProgress:value=>setStatus(value?`Exporting ${value}%`:"Preparing…")})
            setStatus(`Exported ${result.width} × ${result.height} in ${((performance.now()-start)/1000).toFixed(1)}s. Max UI tick gap ${Math.round(maxGap.current)}ms.`)
            const url=URL.createObjectURL(result.blob),link=window.document.createElement("a");link.href=url;link.download=`erd-worker-${kind}.png`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000)
        } catch(error) {setStatus(abort.signal.aborted?"Cancelled":String(error))}
        finally {controller.current=null;setBusy(false)}
    }
    async function compare() {
        setBusy(true)
        try {
            const results=[]
            for(const options of [{},{showNotations:false},{showRelationships:false}]) {
                const reference=erdDiagramImage(small,defaultPalette,options),result=await runErdPngWorker({document:small,palette:defaultPalette,options})
                if(result.width!==reference.width||result.height!==reference.height) throw Error("Dimensions changed")
                const actual=await pixels(result.blob,result.width,result.height),expected=await pixels(new Blob([reference.svg],{type:"image/svg+xml"}),reference.width,reference.height)
                let changed=0
                for(let i=0;i<actual.length;i+=4) if(Math.max(...[0,1,2,3].map(c=>Math.abs(actual[i+c]-expected[i+c])))>16) changed++
                const percent=changed/(result.width*result.height)*100
                if(percent>1) throw Error(`Rendering differs at ${percent.toFixed(3)}% of pixels`)
                results.push(`${percent.toFixed(3)}%`)
                if(!Object.keys(options).length) setPreview(URL.createObjectURL(result.blob))
            }
            setStatus(`Rendering comparison passed (normal / no notations / no relationships): ${results.join(" / ")} pixels differ by more than 16/255.`)
        } catch(error) {setStatus(String(error))}
        finally {setBusy(false)}
    }
    return <main style={{padding:24,fontFamily:"Arial",display:"grid",gap:16}}><h1>ERD background PNG export</h1><p>75 anonymous tables / 148 relationships · 4× HD</p><div style={{display:"flex",gap:16}}><button disabled={busy} onClick={()=>void run("dense")}>Export dense HD PNG</button><button disabled={busy} onClick={()=>void run("wide")}>Export beyond canvas width</button><button disabled={busy} onClick={()=>void compare()}>Compare rendering</button><button disabled={!busy} onClick={()=>controller.current?.abort()}>Cancel export</button><button onClick={()=>setClicks(value=>value+1)}>UI response check: {clicks}</button></div><p role="status">{status}</p><p>UI ticks: {ticks}</p>{preview&&<img alt="Worker PNG rendering preview" src={preview} style={{maxWidth:1000,border:"1px solid #aaa"}}/>}</main>
}
createRoot(document.getElementById("root")!).render(<Preview/>);
