import { Monitor, Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme, type Theme } from "@/components/theme-provider"

const themeOptions = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
] satisfies Array<{ value: Theme; label: string; Icon: typeof Sun }>

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const selectedTheme = themeOptions.find((option) => option.value === theme)!
  const SelectedIcon = selectedTheme.Icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Theme: ${selectedTheme.label}`}
          size="icon-sm"
          title={`Theme: ${selectedTheme.label}`}
          variant="ghost"
        >
          <SelectedIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          {themeOptions.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
