import {
  Activity,
  Boxes,
  Braces,
  Check,
  Code2,
  Database,
  GitBranch,
  Layers3,
  LockKeyhole,
  RefreshCw,
  Route,
  ShieldCheck,
  Terminal,
  Users,
} from "lucide-react"
import { memo, type ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { ScrollAssemble } from "@/components/scroll-assemble"
import { cn } from "@/lib/utils"

const placeholderFeatures = [
  {
    title: "Composable UI",
    description: "Build new screens from accessible primitives and consistent design tokens.",
    Icon: Boxes,
  },
  {
    title: "Route-aware data",
    description: "Load the right data before protected pages render and preserve navigation intent.",
    Icon: GitBranch,
  },
  {
    title: "Predictable state",
    description: "Keep application state explicit, typed, and easy to inspect as the product grows.",
    Icon: Layers3,
  },
  {
    title: "Secure by default",
    description: "Coordinate cookie sessions, bearer tokens, and refresh rotation in one flow.",
    Icon: LockKeyhole,
  },
  {
    title: "Ready for teams",
    description: "Leave space for organizations, permissions, connected accounts, and collaboration.",
    Icon: Users,
  },
  {
    title: "Easy to observe",
    description: "Give every request, route, and error a clear place to surface useful feedback.",
    Icon: Activity,
  },
]

export const DeveloperFeatures = memo(function DeveloperFeatures() {
  return (
    <section aria-labelledby="developer-features" className="mt-20 space-y-8 pt-10 sm:pt-16">
      <ScrollAssemble>
        <div className="max-w-2xl space-y-3">
          <h2
            className="text-4xl font-semibold tracking-tight sm:text-5xl"
            id="developer-features"
          >
            Built for developers.
          </h2>
          <p className="text-lg text-muted-foreground">
            Sensible defaults for shipping secure, maintainable products without
            rebuilding the foundation every time.
          </p>
        </div>
      </ScrollAssemble>

      <div className="grid gap-5 lg:grid-cols-2">
        <ScrollAssemble delay={40}>
          <FeaturePanel
            eyebrow="Type-safe from end to end"
            title="Move from API contract to interface with confidence."
          >
            <CodePreview />
          </FeaturePanel>
        </ScrollAssemble>

        <ScrollAssemble delay={110}>
          <FeaturePanel
            eyebrow="Authentication included"
            title="Keep sessions secure without slowing users down."
          >
            <AuthenticationPreview />
          </FeaturePanel>
        </ScrollAssemble>

        <ScrollAssemble className="lg:col-span-2" delay={80}>
          <FeaturePanel
          eyebrow="A stack that works together"
          title="Spend your time building features—not wiring tools."
        >
            <ToolchainPreview />
          </FeaturePanel>
        </ScrollAssemble>
      </div>

      <div className="space-y-8 pt-20 sm:pt-28">
        <ScrollAssemble>
          <div className="max-w-2xl space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Placeholder capabilities</p>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Keep scrolling. There is more to assemble.
            </h2>
            <p className="text-muted-foreground">
              These temporary blocks give you enough vertical space to test the
              entrance and reverse disintegration behavior in both directions.
            </p>
          </div>
        </ScrollAssemble>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placeholderFeatures.map(({ title, description, Icon }, index) => (
            <ScrollAssemble delay={(index % 3) * 55} key={title}>
              <article className="h-full min-h-52 rounded-2xl border bg-card/75 p-5 shadow-sm backdrop-blur transition-colors hover:bg-card dark:bg-card/65">
                <span className="mb-12 flex size-10 items-center justify-center rounded-xl border bg-background shadow-xs">
                  <Icon className="size-4" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </article>
            </ScrollAssemble>
          ))}
        </div>

        <ScrollAssemble delay={80}>
          <div className="rounded-2xl border bg-primary px-6 py-16 text-center text-primary-foreground shadow-xl sm:px-10 sm:py-24">
            <p className="text-sm font-medium text-primary-foreground/70">End of the test area</p>
            <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
              Scroll back up to watch every block disintegrate.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-primary-foreground/70">
              The content will assemble again the next time it crosses into view.
            </p>
          </div>
        </ScrollAssemble>
      </div>
    </section>
  )
})

function FeaturePanel({
  children,
  className,
  eyebrow,
  title,
}: {
  children: ReactNode
  className?: string
  eyebrow: string
  title: string
}) {
  return (
    <article
      className={cn(
        "group h-full overflow-hidden rounded-2xl border bg-muted/55 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-foreground/15 hover:shadow-xl hover:shadow-black/5 dark:bg-muted/35 dark:hover:shadow-black/20 sm:p-6",
        className,
      )}
    >
      <div className="mb-8 flex items-start justify-between gap-6">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{eyebrow}</p>
          <h3 className="max-w-xl text-xl font-semibold tracking-tight sm:text-2xl">
            {title}
          </h3>
        </div>
      </div>
      {children}
    </article>
  )
}

function CodePreview() {
  return (
    <div className="overflow-hidden rounded-xl border bg-card/90 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Code2 className="size-4 text-blue-500" />
          auth-api.ts
        </div>
        <div className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-red-400" />
          <span className="size-2 rounded-full bg-amber-400" />
          <span className="size-2 rounded-full bg-emerald-400" />
        </div>
      </div>
      <div className="grid min-h-64 grid-cols-[auto_1fr] gap-x-4 overflow-hidden p-5 font-mono text-xs leading-7 sm:text-sm">
        <div aria-hidden="true" className="select-none text-right text-muted-foreground/50">
          1<br />2<br />3<br />4<br />5<br />6
        </div>
        <code className="whitespace-nowrap">
          <span className="text-violet-500">export const</span>{" "}
          <span className="text-blue-500">authApi</span> = api.injectEndpoints({"{"}
          <br />
          &nbsp;&nbsp;endpoints: (build) =&gt; ({"{"}
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-600 dark:text-emerald-400">login</span>:
          build.mutation&lt;Session, Credentials&gt;({"{"}
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;query: (body) =&gt; ({"{"} url:{" "}
          <span className="text-amber-600 dark:text-amber-400">&quot;/auth/login&quot;</span>, body {"}"}),
          <br />
          &nbsp;&nbsp;&nbsp;&nbsp;{"}"}),
          <br />
          &nbsp;&nbsp;{"}"}),
          <br />
          {"}"})
        </code>
      </div>
    </div>
  )
}

function AuthenticationPreview() {
  return (
    <div className="relative flex min-h-64 items-center justify-center overflow-hidden rounded-xl border bg-card/90 p-6 shadow-sm backdrop-blur">
      <div className="absolute inset-x-16 top-1/2 h-px bg-border" aria-hidden="true" />
      <div className="relative grid w-full max-w-lg grid-cols-3 items-center gap-3">
        <AuthStep icon={<ShieldCheck />} label="Sign in" detail="Secure cookie" />
        <AuthStep icon={<Braces />} label="Access" detail="Bearer JWT" />
        <AuthStep icon={<RefreshCw />} label="Refresh" detail="Auto rotate" />
      </div>
      <Badge className="absolute bottom-5 left-1/2 -translate-x-1/2" variant="secondary">
        <Check data-icon="inline-start" />
        Session restored
      </Badge>
    </div>
  )
}

function AuthStep({
  detail,
  icon,
  label,
}: {
  detail: string
  icon: ReactNode
  label: string
}) {
  return (
    <div className="relative flex min-w-0 flex-col items-center text-center">
      <div className="mb-3 flex size-11 items-center justify-center rounded-xl border bg-background shadow-sm [&_svg]:size-5">
        {icon}
      </div>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function ToolchainPreview() {
  const tools = [
    { icon: <Route />, label: "React Router", tone: "text-blue-500" },
    { icon: <Database />, label: "RTK Query", tone: "text-violet-500" },
    { icon: <Braces />, label: "TypeScript", tone: "text-sky-500" },
  ]

  return (
    <div className="grid overflow-hidden rounded-xl border bg-card/90 shadow-sm backdrop-blur md:grid-cols-[0.9fr_1.1fr]">
      <div className="flex flex-col justify-center gap-3 border-b p-5 md:border-r md:border-b-0 sm:p-7">
        {tools.map((tool) => (
          <div
            className="flex items-center gap-3 rounded-lg border bg-background/80 p-3 shadow-xs transition-transform duration-300 hover:translate-x-1"
            key={tool.label}
          >
            <span className={cn("[&_svg]:size-4", tool.tone)}>{tool.icon}</span>
            <span className="text-sm font-medium">{tool.label}</span>
            <Check className="ml-auto size-4 text-emerald-500" />
          </div>
        ))}
      </div>
      <div className="min-h-56 bg-zinc-950 p-5 font-mono text-xs text-zinc-300 sm:p-7 sm:text-sm">
        <div className="mb-5 flex items-center gap-2 border-b border-white/10 pb-3 text-zinc-400">
          <Terminal className="size-4" />
          dev-hub / terminal
        </div>
        <p><span className="text-emerald-400">$</span> npm run build</p>
        <p className="mt-3 text-zinc-500">transforming modules...</p>
        <p className="mt-1 text-zinc-500">rendering chunks...</p>
        <p className="mt-4 flex items-center gap-2 text-emerald-400">
          <Check className="size-4" />
          built successfully in 648ms
        </p>
      </div>
    </div>
  )
}
