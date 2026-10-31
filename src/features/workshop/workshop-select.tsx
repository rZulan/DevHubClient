import {Children, isValidElement, useState, type ReactNode} from "react"
import {Select} from "radix-ui"
import {Check, ChevronDown} from "lucide-react"

type Option = {value: string; label: ReactNode; text: string; disabled: boolean}
type OptionProps = {value?: string | number; children?: ReactNode; disabled?: boolean}
function text(children: ReactNode): string {
    return Children.toArray(children).map(child => isValidElement<OptionProps>(child) ? text(child.props.children) : typeof child === "string" || typeof child === "number" ? String(child) : "").join("")
}
function optionsFrom(children: ReactNode, disabled = false): Option[] {
    return Children.toArray(children).flatMap(child => {
        if (!isValidElement<OptionProps>(child)) return []
        if (child.type === "option") return [{value: String(child.props.value ?? text(child.props.children)), label: child.props.children, text: text(child.props.children), disabled: disabled || !!child.props.disabled}]
        return optionsFrom(child.props.children, disabled || !!child.props.disabled)
    })
}

/** A keyboard-accessible workshop select with a styleable, portalled option list. */
export function WorkshopSelect({children, value, defaultValue, onValueChange, disabled, name, id, title, className, "aria-label": ariaLabel}: {
    children: ReactNode; value?: string | number; defaultValue?: string | number; onValueChange?: (value: string) => void
    disabled?: boolean; name?: string; id?: string; title?: string; className?: string; "aria-label"?: string
}) {
    const options = optionsFrom(children)
    const [localValue, setLocalValue] = useState(() => String(defaultValue ?? options[0]?.value ?? ""))
    const selectedValue = value === undefined ? localValue : String(value)
    const selectedIndex = options.findIndex(option => option.value === selectedValue)
    return <>
        {name && <input type="hidden" name={name} value={selectedValue} disabled={disabled}/>}
        <Select.Root value={selectedIndex < 0 ? "" : String(selectedIndex)} disabled={disabled} onValueChange={index => {
            const option = options[Number(index)]
            if (!option || option.disabled) return
            setLocalValue(option.value); onValueChange?.(option.value)
        }}>
            <Select.Trigger id={id} title={title} aria-label={ariaLabel} data-workshop-select="" className={["workshop-select-trigger", className].filter(Boolean).join(" ")}>
                <Select.Value placeholder="Choose…">{options[selectedIndex]?.label}</Select.Value>
                <Select.Icon className="workshop-select-icon"><ChevronDown aria-hidden="true"/></Select.Icon>
            </Select.Trigger>
            <Select.Portal><Select.Content className="workshop-select-menu workshop-scrollbar" position="popper" align="start" sideOffset={4} collisionPadding={8}>
                <Select.Viewport className="workshop-select-viewport workshop-scrollbar">
                    {options.map((option, index) => <Select.Item key={`${index}:${option.value}`} value={String(index)} textValue={option.text} disabled={option.disabled} className="workshop-select-option">
                        <Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className="workshop-select-check"><Check aria-hidden="true"/></Select.ItemIndicator>
                    </Select.Item>)}
                </Select.Viewport>
            </Select.Content></Select.Portal>
        </Select.Root>
    </>
}
