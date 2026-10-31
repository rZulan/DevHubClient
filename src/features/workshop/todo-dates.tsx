import {useId, useState} from "react"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
export function TodoDateFields({startDate, targetDate}: {startDate?: string | null; targetDate?: string | null}) {
    const id = useId(), [start, setStart] = useState(startDate ?? ""), [target, setTarget] = useState(targetDate ?? "")
    return <div className="todo-date-fields">
        <div><Label htmlFor={`${id}-from`}>From <span>Optional</span></Label><Input id={`${id}-from`} type="date" name="startDate" value={start} max={target || "9999-12-31"} onChange={event => setStart(event.target.value)}/></div>
        <div><Label htmlFor={`${id}-target`}>Target date <span>{start ? "Required" : "Optional"}</span></Label><Input id={`${id}-target`} type="date" name="targetDate" value={target} required={!!start} min={start || "0001-01-01"} max="9999-12-31" onChange={event => setTarget(event.target.value)}/></div>
    </div>
}
