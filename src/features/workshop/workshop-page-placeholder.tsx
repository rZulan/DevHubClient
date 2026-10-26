import {useId} from "react"
import type {LucideIcon} from "lucide-react"
import {UnderConstructionIndicator} from "@/components/under-construction-indicator"

export function WorkshopPagePlaceholder({title, description, icon: Icon}: {title: string; description: string; icon: LucideIcon}) {
    const titleId = useId()
    return <div className="workshop-page">
        <section aria-labelledby={titleId} className="flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border bg-background p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary"><Icon className="size-6" aria-hidden="true"/></div>
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">{title}</h2>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
            <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><UnderConstructionIndicator/>Under construction</span>
        </section>
    </div>
}
