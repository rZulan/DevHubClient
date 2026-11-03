import {Children, cloneElement, isValidElement, useEffect, useId, useLayoutEffect, useRef, type HTMLAttributes, type ReactNode} from "react"
import {workshopToastStore, type WorkshopToastVariant} from "./workshop-toast-store"

function contentSignature(children: ReactNode): string {
    return Children.toArray(children).map(child => isValidElement<{children?: ReactNode}>(child) ? contentSignature(child.props.children) : String(child)).join(" ").trim()
}
function hasAction(children: ReactNode): boolean {
    return Children.toArray(children).some(child => isValidElement<{children?: ReactNode; onClick?: unknown}>(child) && (!!child.props.onClick || hasAction(child.props.children)))
}
function messageContent(children: ReactNode) {
    const actions: ReactNode[] = []
    function extract(nodes: ReactNode): ReactNode {
        return Children.map(nodes, child => {
            if (!isValidElement<{children?: ReactNode; onClick?: unknown}>(child)) return child
            if (child.props.onClick) {actions.push(cloneElement(child, {key: actions.length})); return null}
            return child.props.children ? cloneElement(child, {children: extract(child.props.children)}) : child
        })
    }
    const body = extract(children)
    return <>{body}{actions.length > 0 && <div className="workshop-toast-actions">{actions}</div>}</>
}

/** State-driven feedback shares the same toast service as event-driven actions. */
export function WorkshopToast({children, variant = "error", title, duration, onDismiss, ...props}: HTMLAttributes<HTMLDivElement> & {variant?: WorkshopToastVariant; duration?: number; onDismiss?: () => void}) {
    const id = useId(), signature = contentSignature(children), interactive = hasAction(children)
    const latest = useRef({children, onDismiss, props}); latest.current = {children, onDismiss, props}
    useLayoutEffect(() => {workshopToastStore.update(id, <div {...props}>{messageContent(children)}</div>, onDismiss)})
    useEffect(() => {
        if (!signature) return
        workshopToastStore.show(variant, <div {...latest.current.props}>{messageContent(latest.current.children)}</div>, {
            id, title, duration: duration ?? (interactive ? Infinity : undefined),
            dedupeKey: interactive ? undefined : `${variant}:${title ?? ""}:${signature}`,
            onDismiss: () => latest.current.onDismiss?.(),
        })
        return () => workshopToastStore.remove(id)
    }, [id, signature, interactive, variant, title, duration])
    return null
}
