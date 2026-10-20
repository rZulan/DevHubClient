import * as React from "react"
import {ContextMenu as ContextMenuPrimitive} from "radix-ui"
import {CheckIcon, ChevronRightIcon} from "lucide-react"
import {cn} from "@/lib/utils"

export const ContextMenu = ContextMenuPrimitive.Root
export const ContextMenuTrigger = ContextMenuPrimitive.Trigger

export function ContextMenuContent({className, ...props}: React.ComponentProps<typeof ContextMenuPrimitive.Content>) {
    return <ContextMenuPrimitive.Portal><ContextMenuPrimitive.Content data-slot="context-menu-content"
                                                                      className={cn("z-50 min-w-48 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl", className)} {...props} /></ContextMenuPrimitive.Portal>
}

export function ContextMenuItem({
                                    className,
                                    inset,
                                    variant = "default",
                                    ...props
                                }: React.ComponentProps<typeof ContextMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: "default" | "destructive"
}) {
    return <ContextMenuPrimitive.Item data-slot="context-menu-item" data-inset={inset} data-variant={variant}
                                      className={cn("relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-45 data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10", className)} {...props} />
}

export function ContextMenuCheckboxItem({
                                            className,
                                            children,
                                            checked,
                                            ...props
                                        }: React.ComponentProps<typeof ContextMenuPrimitive.CheckboxItem>) {
    return <ContextMenuPrimitive.CheckboxItem data-slot="context-menu-checkbox-item"
                                              className={cn("relative flex cursor-default select-none items-center gap-2 rounded-md py-1.5 pr-2 pl-8 text-sm outline-hidden focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-45", className)}
                                              checked={checked} {...props}>
        <span
            className="absolute left-2 flex size-4 items-center justify-center"><ContextMenuPrimitive.ItemIndicator><CheckIcon
            className="size-4"/></ContextMenuPrimitive.ItemIndicator></span>{children}
    </ContextMenuPrimitive.CheckboxItem>
}

export function ContextMenuLabel({className, ...props}: React.ComponentProps<typeof ContextMenuPrimitive.Label>) {
    return <ContextMenuPrimitive.Label
        className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", className)} {...props} />
}

export function ContextMenuSeparator({
                                         className,
                                         ...props
                                     }: React.ComponentProps<typeof ContextMenuPrimitive.Separator>) {
    return <ContextMenuPrimitive.Separator className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
}

type SubmenuSide = "left" | "right"
const SubmenuSideContext = React.createContext<{side: SubmenuSide; setSide: React.Dispatch<React.SetStateAction<SubmenuSide>>} | null>(null)

export function ContextMenuSub({children, ...props}: React.ComponentProps<typeof ContextMenuPrimitive.Sub>) {
    const [side, setSide] = React.useState<SubmenuSide>("right")
    const value = React.useMemo(() => ({side, setSide}), [side])
    return <SubmenuSideContext value={value}><ContextMenuPrimitive.Sub {...props}>{children}</ContextMenuPrimitive.Sub></SubmenuSideContext>
}
export const ContextMenuSubTrigger = React.forwardRef<React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger>>(({
                                                                                                                                                                                             className,
                                                                                                                                                                                             children,
                                                                                                                                                                                             ...props
                                                                                                                                                                                         }, ref) => {
    const submenu = React.useContext(SubmenuSideContext), side = submenu?.side ?? "right", setSide = submenu?.setSide
    const trigger = React.useRef<React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>>(null)
    React.useImperativeHandle(ref, () => trigger.current!, [])
    React.useLayoutEffect(() => {
        if (!setSide) return
        // Predict the collapsed arrow from available space; the open content reports its exact side.
        const update = () => {
            const element = trigger.current
            if (!element || element.dataset.state === "open") return
            const rect = element.getBoundingClientRect(), width = element.closest('[role="menu"]')?.getBoundingClientRect().width ?? 192
            const right = window.innerWidth - rect.right, left = rect.left
            setSide(right >= width + 14 || right >= left ? "right" : "left")
        }
        const frame = requestAnimationFrame(update)
        window.addEventListener("resize", update)
        window.addEventListener("scroll", update, true)
        return () => {cancelAnimationFrame(frame); window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true)}
    }, [setSide])
    return <ContextMenuPrimitive.SubTrigger ref={trigger} data-slot="context-menu-sub-trigger" data-submenu-side={side}
                                     className={cn("flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-hidden focus:bg-accent data-[state=open]:bg-accent data-disabled:pointer-events-none data-disabled:opacity-45", className)} {...props}>{children}<ChevronRightIcon
        className="context-menu-submenu-arrow ml-auto size-3.5 shrink-0" aria-hidden="true" style={{transform: side === "left" ? "rotate(180deg)" : undefined}}/></ContextMenuPrimitive.SubTrigger>
})

export function ContextMenuSubContent({
                                          className,
                                          ...props
                                      }: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
    const [content, setContent] = React.useState<HTMLDivElement | null>(null)
    const setSide = React.useContext(SubmenuSideContext)?.setSide
    React.useLayoutEffect(() => {
        if (!content || !setSide) return
        // Radix can flip a portaled submenu after measuring available space.
        const update = () => {const side = content.dataset.side; if (side === "left" || side === "right") setSide(side)}
        update()
        const observer = new MutationObserver(update)
        observer.observe(content, {attributes: true, attributeFilter: ["data-side"]})
        return () => observer.disconnect()
    }, [content, setSide])
    return <ContextMenuPrimitive.Portal><ContextMenuPrimitive.SubContent
        ref={setContent} data-slot="context-menu-sub-content" sideOffset={6} collisionPadding={8}
        className={cn("z-50 min-w-48 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl", className)} {...props} /></ContextMenuPrimitive.Portal>
}
