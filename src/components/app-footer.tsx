import { Code2 } from "lucide-react"
import { Link } from "react-router-dom"

const footerLinks = [
  { label: "Home", to: "/" },
  { label: "Account", to: "/account/profile" },
]

export function AppFooter() {
  return (
    <footer className="border-t bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Link className="inline-flex items-center gap-2 font-semibold" to="/">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Code2 className="size-3.5" />
            </span>
            Dev Hub
          </Link>
          <p className="text-sm text-muted-foreground">
            Built for developers, with React and .NET.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:items-end">
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <Link
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                key={link.to}
                to={link.to}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} Dev Hub. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
