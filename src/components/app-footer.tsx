import {memo} from "react"
import {Link} from "react-router-dom"

import {BrandMark} from "@/components/brand-mark"

const footerLinks = [
    {label: "Home", to: "/"},
    {label: "Account", to: "/account/profile"},
]

export const AppFooter = memo(function AppFooter() {
    return (
        <footer className="border-t bg-background/70 backdrop-blur-md">
            <div
                className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                    <Link aria-label="DevHub home" className="inline-flex items-center gap-2 font-semibold tracking-tight" to="/">
                        <BrandMark className="size-8"/>
                        <span>Dev<span className="text-primary">Hub</span></span>
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
                        &copy; {new Date().getFullYear()} DevHub. All rights reserved.
                    </p>
                </div>
            </div>
        </footer>
    )
})
