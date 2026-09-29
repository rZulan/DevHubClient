import * as React from "react"
import {ContextMenu as ContextMenuPrimitive} from "radix-ui"
import {CheckIcon} from "lucide-react"
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

export const ContextMenuSub = ContextMenuPrimitive.Sub
export const ContextMenuSubTrigger = React.forwardRef<React.ElementRef<typeof ContextMenuPrimitive.SubTrigger>, React.ComponentPropsWithoutRef<typeof ContextMenuPrimitive.SubTrigger>>(({
                                                                                                                                                                                             className,
                                                                                                                                                                                             children,
                                                                                                                                                                                             ...props
                                                                                                                                                                                         }, ref) =>
    <ContextMenuPrimitive.SubTrigger ref={ref}
                                     className={cn("flex cursor-default select-none items-center rounded-md px-2 py-1.5 text-sm outline-hidden focus:bg-accent data-open:bg-accent data-disabled:pointer-events-none data-disabled:opacity-45", className)} {...props}>{children}<span
        className="ml-auto">›</span></ContextMenuPrimitive.SubTrigger>)

export function ContextMenuSubContent({
                                          className,
                                          ...props
                                      }: React.ComponentProps<typeof ContextMenuPrimitive.SubContent>) {
    return <ContextMenuPrimitive.Portal><ContextMenuPrimitive.SubContent
        className={cn("z-50 min-w-48 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-xl", className)} {...props} /></ContextMenuPrimitive.Portal>
}
