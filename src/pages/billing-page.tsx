import { Check, CreditCard } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const includedFeatures = [
  "Personal developer profile",
  "Project and team access",
  "Secure account sessions",
]

export function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Billing</h2>
        <p className="text-sm text-muted-foreground">
          Plans, invoices, and payment methods will live here.
        </p>
      </div>

      <Card className="bg-card/85 backdrop-blur-xl dark:bg-card/80">
        <CardHeader className="flex-row items-start justify-between">
          <div className="space-y-2">
            <Badge variant="secondary">Current plan</Badge>
            <CardTitle className="text-2xl">Free</CardTitle>
          </div>
          <span className="flex size-10 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="size-4" />
          </span>
        </CardHeader>
        <CardContent className="space-y-6">
          <ul className="space-y-3 text-sm">
            {includedFeatures.map((feature) => (
              <li className="flex items-center gap-2" key={feature}>
                <Check className="size-4 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Premium plans are coming later</p>
              <p className="text-sm text-muted-foreground">
                Billing is a frontend placeholder until subscriptions are added.
              </p>
            </div>
            <Button disabled variant="outline">Manage billing</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
