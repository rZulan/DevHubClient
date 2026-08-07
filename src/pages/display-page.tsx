import { Check, Monitor, Moon, Sun } from "lucide-react"

import { useTheme, type Theme } from "@/components/theme-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const themes = [
  {
    id: "system",
    label: "System",
    description: "Follow your device appearance.",
    Icon: Monitor,
  },
  {
    id: "light",
    label: "Light",
    description: "Use the light appearance.",
    Icon: Sun,
  },
  {
    id: "dark",
    label: "Dark",
    description: "Use the dark appearance.",
    Icon: Moon,
  },
] satisfies Array<{
  id: Theme
  label: string
  description: string
  Icon: typeof Sun
}>

export function DisplayPage() {
  const { theme, setTheme } = useTheme()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Display</h2>
        <p className="text-sm text-muted-foreground">
          Choose how DevHub looks on this device.
        </p>
      </div>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardHeader>
          <CardTitle>Theme</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {themes.map(({ id, label, description, Icon }) => {
            const isSelected = theme === id

            return (
              <button
                aria-pressed={isSelected}
                className={cn(
                  "relative rounded-xl border bg-background/50 p-4 text-left transition-all hover:border-foreground/25 hover:bg-muted/70",
                  isSelected && "border-primary ring-2 ring-primary/15",
                )}
                key={id}
                type="button"
                onClick={() => setTheme(id)}
              >
                {isSelected && (
                  <span className="absolute top-3 right-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                )}
                <Icon className="mb-8 size-5" />
                <p className="font-medium">{label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{description}</p>
              </button>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
