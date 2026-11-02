import type {ReactNode} from "react"
import {Label} from "@/components/ui/label"

export function ProjectFormField({id, label, hint, wide = false, children}: {
    id: string
    label: string
    hint?: string
    wide?: boolean
    children: ReactNode
}) {
    return <div className={`project-create-field${wide ? " wide" : ""}`}>
        <div className="project-create-field-label"><Label htmlFor={id}>{label}</Label>{hint && <span>{hint}</span>}</div>
        {children}
    </div>
}
