// Isolated toast examples and real dialog/validation behavior; no API writes.
import {useEffect, useState} from "react"
import {createRoot} from "react-dom/client"
import {WorkshopToaster} from "@/features/workshop/workshop-toaster"
import {WorkshopToast} from "@/features/workshop/workshop-toast"
import {workshopToast} from "@/features/workshop/workshop-toast-store"
import {Button} from "@/components/ui/button"
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger} from "@/components/ui/dialog"
import "@/index.css"

const messages={error:"The diagram could not be saved. Your changes are still available.",warning:"This canvas is approaching its object limit.",success:"Your changes have been saved.",info:"The export continues when you open another page.",tip:"Use Auto arrange to organize tables and their relationships."}
function Preview() {
    const [theme,setTheme]=useState(true),[error,setError]=useState(""),[recovery,setRecovery]=useState(false),[name,setName]=useState("")
    useEffect(()=>{document.documentElement.classList.toggle("dark",theme);return()=>document.documentElement.classList.remove("dark")},[theme])
    return <div className={theme?"dark":""} style={{minHeight:"100svh",background:"var(--background)",color:"var(--foreground)",padding:28}}><h1 style={{fontSize:24,fontWeight:600}}>Workshop messages</h1><p style={{margin:"8px 0 24px",color:"var(--muted-foreground)"}}>One toast design for errors, warnings, success, information and tips.</p><div style={{display:"flex",gap:12,flexWrap:"wrap"}}>{Object.entries(messages).map(([variant,message])=><Button key={variant} variant="outline" onClick={()=>workshopToast[variant as keyof typeof messages](message,{id:`preview-${variant}`})}>{variant[0].toUpperCase()+variant.slice(1)} message</Button>)}<Button variant="ghost" onClick={()=>setTheme(value=>!value)}>Toggle theme</Button><Button variant="outline" onClick={()=>setRecovery(true)}>Recovery message</Button><Dialog><DialogTrigger asChild><Button variant="outline">Open validation dialog</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create test team</DialogTitle><DialogDescription>Test toast feedback while a modal is open.</DialogDescription></DialogHeader><label>Team name<input aria-label="Team name" value={name} onChange={event=>setName(event.target.value)} style={{display:"block",border:"1px solid var(--border)",padding:8,borderRadius:6,width:"100%"}}/></label><Button onClick={()=>{setError("");if(name.trim().length<2)setError("Use at least 2 characters for the team name.");else workshopToast.success("The team name is valid.")}}>Validate team</Button>{error&&<WorkshopToast variant="error" onDismiss={()=>setError("")}>{error}</WorkshopToast>}</DialogContent></Dialog></div>{recovery&&<WorkshopToast variant="error" title="Save failed" onDismiss={()=>setRecovery(false)}>Your changes could not be saved.<div><Button variant="outline" size="sm" onClick={()=>{setRecovery(false);workshopToast.success("Your changes have been saved.")}}>Retry save</Button></div></WorkshopToast>}<WorkshopToaster/></div>
}
createRoot(document.getElementById("root")!).render(<Preview/>);
