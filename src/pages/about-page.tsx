import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const sessionFeatures = [
  {
    title: "HTTP-only cookie",
    description: "Sent on same-origin API requests with credentials enabled.",
  },
  {
    title: "Bearer access token",
    description: "Held in Redux memory and attached to protected API requests.",
  },
  {
    title: "Rotating refresh token",
    description: "Exchanged once after a 401, then immediately replaced.",
  },
]

export function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-3">
        <Badge variant="secondary">DevHub architecture</Badge>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          A session flow designed around the .NET API.
        </h1>
        <p className="text-lg text-muted-foreground">
          RTK Query coordinates all three authentication mechanisms exposed by
          the backend while Redux keeps UI state predictable.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {sessionFeatures.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <CardTitle className="text-base">{feature.title}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {feature.description}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
