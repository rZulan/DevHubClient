import type {CSSProperties} from "react"
import {SlidersHorizontal} from "lucide-react"
import {Popover} from "radix-ui"
import {Button} from "@/components/ui/button"
import {isHexColor, readableForeground} from "./appearance/color-schemes"
import {WorkshopSelect} from "./workshop-select"
import type {DashboardWidget, DashboardWidgetAppearance, DashboardWidgetThemeColor} from "./workshop-types"

const maxRadius = 48
const themeColors = {
    primary: "Primary", secondary: "Secondary", accent: "Accent", muted: "Muted",
    background: "Background", card: "Card", popover: "Popover", sidebar: "Sidebar",
} satisfies Record<DashboardWidgetThemeColor, string>

function isThemeColor(value: unknown): value is DashboardWidgetThemeColor {
    return typeof value === "string" && Object.hasOwn(themeColors, value)
}

export function dashboardWidgetAppearanceStyle(appearance?: DashboardWidgetAppearance | null): CSSProperties {
    const {radius, color, opacity} = appearance ?? {}
    const themeColor = isThemeColor(color) ? color : undefined
    const customColor = isHexColor(color) ? color : undefined
    const fill = themeColor ? `var(--${themeColor})` : customColor
    const alpha = typeof opacity === "number" && opacity >= 0 && opacity <= 100 ? opacity : 100
    const foreground = alpha === 100 && (themeColor
        ? `var(--${themeColor === "background" ? "foreground" : `${themeColor}-foreground`})`
        : customColor && readableForeground(customColor))
    return {
        "--dashboard-widget-radius": typeof radius === "number" && radius >= 0 && radius <= maxRadius ? `${radius}px` : undefined,
        "--dashboard-widget-fill": fill || alpha !== 100 ? `color-mix(in oklab, ${fill ?? "var(--card)"} ${alpha}%, transparent)` : undefined,
        "--dashboard-widget-image-matte": fill || alpha !== 100 ? "transparent" : undefined,
        "--dashboard-widget-ink": foreground || undefined,
    } as CSSProperties
}

export function normalizeDashboardImageFrame(widget: DashboardWidget): DashboardWidget {
    if (widget.type !== "image-rounded") return widget
    return {...widget, type: "image-full", appearance: {...widget.appearance, radius: widget.appearance?.radius ?? 9}}
}

export function DashboardWidgetAppearanceControl({widget, title, onChange}: {
    widget: DashboardWidget; title: string; onChange: (appearance?: DashboardWidgetAppearance) => void
}) {
    const {appearance} = widget
    const radius = appearance?.radius ?? 5
    const opacity = appearance?.opacity ?? 100
    const color = appearance?.color
    const colorMode = isThemeColor(color) ? color : isHexColor(color) ? "custom" : "default"
    const update = (patch: DashboardWidgetAppearance) => onChange({...appearance, ...patch})

    function chooseColor(value: string) {
        if (isThemeColor(value)) update({color: value})
        else if (value === "custom") {
            const root = document.documentElement
            const current = getComputedStyle(root).getPropertyValue(`--${isThemeColor(color) ? color : "card"}`).trim()
            update({color: isHexColor(current) ? `#${current.slice(1)}` : root.classList.contains("dark") ? "#171717" : "#ffffff"})
        } else update({color: undefined})
    }

    return <Popover.Root>
        <Popover.Trigger asChild>
            <Button type="button" size="icon-xs" variant="ghost" className="dashboard-widget-config dashboard-widget-appearance-trigger"
                title={`Style ${title}`} aria-label={`Style ${title}`}><SlidersHorizontal aria-hidden="true"/></Button>
        </Popover.Trigger>
        <Popover.Portal>
            <Popover.Content className="dashboard-widget-appearance-panel" aria-label="Widget appearance" align="end" sideOffset={8} collisionPadding={8}>
                <h3>Widget appearance</h3>
                <label className="dashboard-widget-field">
                    <span>Corner radius <span aria-hidden="true">{radius} px</span></span>
                    <input type="range" min={0} max={maxRadius} value={radius} aria-valuetext={`${radius} pixels`}
                        onChange={event => update({radius: event.currentTarget.valueAsNumber})}/>
                </label>
                <div className="dashboard-widget-field">
                    <span>Background color</span>
                    <WorkshopSelect aria-label="Background color" value={colorMode} onValueChange={chooseColor}>
                        <option value="default">Theme default</option>
                        {Object.entries(themeColors).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                        <option value="custom">Custom color</option>
                    </WorkshopSelect>
                    {isHexColor(color) && <label className="dashboard-widget-custom-color">
                        <input type="color" aria-label="Custom background color" value={color}
                            onChange={event => update({color: `#${event.currentTarget.value.slice(1)}`})}/><span>{color.toUpperCase()}</span>
                    </label>}
                </div>
                <label className="dashboard-widget-field">
                    <span>Background opacity <span aria-hidden="true">{opacity}%</span></span>
                    <input type="range" min={0} max={100} value={opacity} aria-valuetext={`${opacity}%`}
                        onChange={event => update({opacity: event.currentTarget.valueAsNumber})}/>
                </label>
                <div className="dashboard-widget-appearance-actions">
                    <Button type="button" size="xs" variant="ghost" onClick={() => onChange()}>Reset appearance</Button>
                    <Popover.Close asChild><Button type="button" size="xs">Done</Button></Popover.Close>
                </div>
            </Popover.Content>
        </Popover.Portal>
    </Popover.Root>
}
