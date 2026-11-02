import type {LucideIcon} from "lucide-react"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"
import {WorkshopEmptyPage} from "./workshop-empty-state"

export function WorkshopPagePlaceholder({title, description, icon: Icon}: {title: string; description: string; icon: LucideIcon}) {
    return <WorkshopEmptyPage icon={Icon} title={title} description={description}
        action={<span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><UnderConstructionIndicator/>Under construction</span>}/>
}
